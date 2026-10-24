/**
 * Trip Coordinator Service
 *
 * Centralized, authoritative business logic for the GPS trip lifecycle.
 * Serves both:
 * 1. Headless background execution (widgetTaskHandler, TaskManager)
 * 2. Foreground React runtime (useTripStore, HomeScreen UI)
 *
 * GUARANTEES:
 * - Exactly one active GPS trip globally across the entire database.
 * - Active trip ownership is bound to trip.vehicle_id and NEVER mutated by next-trip vehicle cycling.
 * - Idempotent action execution that deduplicates OS retries while allowing distinct user taps.
 * - Durable pause/resume distance anchoring that never accrues or reintroduces paused displacement.
 * - Pure read/render separation for widgets.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as tripRepo from '@/database/repositories/tripRepo';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import {
  startBackgroundLocationUpdates,
  stopBackgroundLocationUpdates,
  resetBackgroundLocationAnchor,
} from '@/tasks/backgroundLocationTask';
import { checkLocationPermissionStatus } from '@/services/locationPermissionService';
import { haversineDistance, buildQualityWarning } from '@/engine/distanceEngine';

import { storeRegistry } from '@/stores/storeRegistry';
import type { Trip, TripLocation, TripDiagnostics, FinishTripOptions } from '@/types/trip';
import type { Vehicle } from '@/types/vehicle';
import { nowISO } from '@/utils/date';

export const WIDGET_VEHICLE_KEY = 'driveledger_widget_vehicle_id';

// ─── Interaction Deduplication Buffer ──────────────────────────────────────────

const handledInteractions = new Map<string, number>();

/**
 * Checks whether an interactionId has been processed recently (within 4 seconds).
 * Filters out duplicate Android OS broadcast delivery retries while allowing
 * subsequent distinct user taps.
 */
export function isDuplicateInteraction(interactionId?: string): boolean {
  if (!interactionId) return false;
  const now = Date.now();

  // Prune stale interactions older than 10 seconds
  for (const [id, timestamp] of handledInteractions.entries()) {
    if (now - timestamp > 10000) {
      handledInteractions.delete(id);
    }
  }

  const existing = handledInteractions.get(interactionId);
  if (existing && now - existing < 4000) {
    return true;
  }

  handledInteractions.set(interactionId, now);
  return false;
}

export function resetInteractionsForTesting(): void {
  handledInteractions.clear();
}

// ─── Pure Vehicle Rotation Logic ──────────────────────────────────────────────

/**
 * Deterministically determines the next vehicle in a circular rotation.
 * Vehicles with trip history remain fully eligible.
 *
 * @param vehicles - Canonical list of active vehicles
 * @param currentId - Currently selected vehicle ID
 * @returns Next vehicle ID, or null if no vehicles exist
 */
export function getNextVehicleId(vehicles: Vehicle[], currentId?: string | null): string | null {
  if (!vehicles || vehicles.length === 0) return null;
  if (vehicles.length === 1) return String(vehicles[0].id);

  const idx = vehicles.findIndex((v) => String(v.id) === String(currentId));
  if (idx === -1) {
    return String(vehicles[0].id);
  }
  const next = vehicles[(idx + 1) % vehicles.length];
  return String(next.id);
}

// ─── Durable Distance Calculation Across Pause Boundaries ────────────────────

/**
 * Calculates distance from accepted GPS points, strictly excluding any displacement
 * that occurred across pause intervals.
 */
export function calculateDurableTripDistance(
  locations: Array<{ latitude: number; longitude: number; timestamp: number }>,
  pauseIntervals?: Array<{ paused_at: number; resumed_at: number }>
): number {
  if (!locations || locations.length < 2) return 0;
  let totalMeters = 0;

  for (let i = 1; i < locations.length; i++) {
    const prev = locations[i - 1];
    const curr = locations[i];

    // Check if this segment crosses or is contained within any pause interval
    let crossesPause = false;
    if (pauseIntervals && pauseIntervals.length > 0) {
      crossesPause = pauseIntervals.some(
        (p) =>
          // Spans across the pause boundary (prev before/at resume and curr at/after pause)
          (prev.timestamp <= p.resumed_at && curr.timestamp >= p.paused_at) ||
          // Either point occurred during the pause interval
          (curr.timestamp >= p.paused_at && curr.timestamp <= p.resumed_at) ||
          (prev.timestamp >= p.paused_at && prev.timestamp <= p.resumed_at)
      );
    }

    if (!crossesPause) {
      totalMeters += haversineDistance(
        prev.latitude,
        prev.longitude,
        curr.latitude,
        curr.longitude
      );
    }
  }

  return Math.round((totalMeters / 1000) * 100) / 100;
}

// ─── Coordinated Trip Lifecycle Actions ────────────────────────────────────────

export interface CoordinatorResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  isDuplicate?: boolean;
}

/**
 * Starts a GPS trip on the specified vehicle (or current next-trip vehicle).
 * Checks permissions, validates global single-session invariant, and launches background tracking.
 */
export async function startGpsTripCoordinator(
  targetVehicleId?: string,
  interactionId?: string
): Promise<CoordinatorResult<Trip>> {
  if (isDuplicateInteraction(interactionId)) {
    return { success: false, error: 'Duplicate interaction ignored', isDuplicate: true };
  }

  // 1. Invariant: Check if ANY trip is actively recording or paused globally
  const existingActive = tripRepo.getActiveTrip();
  if (existingActive) {
    return {
      success: false,
      error: `A trip is already ${existingActive.status} on vehicle ${existingActive.vehicle_id}. Only one active trip can exist globally.`,
    };
  }

  // 2. Resolve target vehicle
  const vehicles = vehicleRepo.getActiveVehicles();
  if (!vehicles || vehicles.length === 0) {
    return { success: false, error: 'No vehicles available. Add a vehicle first.' };
  }

  let vehicleId = targetVehicleId;
  if (!vehicleId) {
    try {
      vehicleId = (await AsyncStorage.getItem(WIDGET_VEHICLE_KEY)) ?? undefined;
    } catch {}
  }
  const resolvedVehicle =
    (vehicleId ? vehicles.find((v) => String(v.id) === String(vehicleId)) : null) ?? vehicles[0];

  // 3. Permission check
  const perm = await checkLocationPermissionStatus();
  if (!perm.servicesEnabled) {
    return { success: false, error: 'Location services are disabled on this device.' };
  }
  if (!perm.foregroundGranted) {
    return { success: false, error: 'Location permission is required to start GPS tracking.' };
  }

  // 4. Create trip in SQLite
  const startOdo = resolvedVehicle.current_odometer ?? null;
  const initialDiagnostics: TripDiagnostics = {
    rejection_counts: {
      invalid_coordinates: 0,
      poor_accuracy: 0,
      unknown_accuracy: 0,
      stale_or_duplicate_timestamp: 0,
      stationary_drift: 0,
      implausible_speed: 0,
    },
    total_samples_received: 0,
    accepted_samples_count: 0,
    rejected_samples_count: 0,
    gap_count: 0,
    max_gap_seconds: 0,
    has_gap_warning: false,
    anchor_needed: true,
  };

  const trip = tripRepo.createTrip({
    vehicle_id: resolvedVehicle.id,
    trip_type: 'gps',
    start_odometer: startOdo,
    diagnostics: JSON.stringify(initialDiagnostics),
  });

  resetBackgroundLocationAnchor();

  // 5. Start background tracking
  try {
    await startBackgroundLocationUpdates();
  } catch (err) {
    console.warn('[TripCoordinator] Failed to launch background location updates:', err);
  }

  // 6. Notify UI store if registered
  storeRegistry.refreshTrips(resolvedVehicle.id);

  // 7. Synchronize native Android widget


  return { success: true, data: trip };
}

/**
 * Pauses the current active recording GPS trip.
 * Halts location updates, records paused timestamp, and arms the resume anchor.
 */
export async function pauseGpsTripCoordinator(
  tripId?: string,
  interactionId?: string
): Promise<CoordinatorResult<Trip>> {
  if (isDuplicateInteraction(interactionId)) {
    return { success: false, error: 'Duplicate interaction ignored', isDuplicate: true };
  }

  const activeTrip = tripRepo.getActiveTrip();
  if (!activeTrip || activeTrip.status !== 'recording') {
    return { success: false, error: 'No active recording trip to pause.' };
  }
  if (tripId && activeTrip.id !== tripId) {
    return { success: false, error: 'Mismatched trip ID.' };
  }

  // Stop background updates immediately
  try {
    await stopBackgroundLocationUpdates();
  } catch (e) {
    console.warn('[TripCoordinator] Error stopping background location on pause:', e);
  }

  // Update diagnostics in SQLite
  let diagnostics: TripDiagnostics = {
    rejection_counts: {
      invalid_coordinates: 0,
      poor_accuracy: 0,
      unknown_accuracy: 0,
      stale_or_duplicate_timestamp: 0,
      stationary_drift: 0,
      implausible_speed: 0,
    },
    total_samples_received: 0,
    accepted_samples_count: 0,
    rejected_samples_count: 0,
    gap_count: 0,
    max_gap_seconds: 0,
    has_gap_warning: false,
  };

  if (activeTrip.diagnostics) {
    try {
      diagnostics = { ...diagnostics, ...JSON.parse(activeTrip.diagnostics) };
    } catch {}
  }

  diagnostics.paused_at = Date.now();
  diagnostics.anchor_needed = true;

  const updated = tripRepo.updateTrip(activeTrip.id, {
    status: 'paused',
    diagnostics: JSON.stringify(diagnostics),
  });

  storeRegistry.refreshTrips(activeTrip.vehicle_id);


  return { success: true, data: updated ?? undefined };
}

/**
 * Resumes a paused GPS trip.
 * Appends the pause interval, sets anchor_needed so the next fix establishes a baseline with 0 distance,
 * and restarts background location tracking.
 */
export async function resumeGpsTripCoordinator(
  tripId?: string,
  interactionId?: string
): Promise<CoordinatorResult<Trip>> {
  if (isDuplicateInteraction(interactionId)) {
    return { success: false, error: 'Duplicate interaction ignored', isDuplicate: true };
  }

  const activeTrip = tripRepo.getActiveTrip();
  if (!activeTrip || activeTrip.status !== 'paused') {
    return { success: false, error: 'No paused trip to resume.' };
  }
  if (tripId && activeTrip.id !== tripId) {
    return { success: false, error: 'Mismatched trip ID.' };
  }

  const nowMs = Date.now();
  let diagnostics: TripDiagnostics = {
    rejection_counts: {
      invalid_coordinates: 0,
      poor_accuracy: 0,
      unknown_accuracy: 0,
      stale_or_duplicate_timestamp: 0,
      stationary_drift: 0,
      implausible_speed: 0,
    },
    total_samples_received: 0,
    accepted_samples_count: 0,
    rejected_samples_count: 0,
    gap_count: 0,
    max_gap_seconds: 0,
    has_gap_warning: false,
  };

  if (activeTrip.diagnostics) {
    try {
      diagnostics = { ...diagnostics, ...JSON.parse(activeTrip.diagnostics) };
    } catch {}
  }

  diagnostics.resumed_at = nowMs;
  if (!Array.isArray(diagnostics.pause_intervals)) {
    diagnostics.pause_intervals = [];
  }
  if (diagnostics.paused_at) {
    diagnostics.pause_intervals.push({
      paused_at: diagnostics.paused_at,
      resumed_at: nowMs,
    });
  }
  diagnostics.anchor_needed = true;

  resetBackgroundLocationAnchor();

  const updated = tripRepo.updateTrip(activeTrip.id, {
    status: 'recording',
    diagnostics: JSON.stringify(diagnostics),
  });

  try {
    await startBackgroundLocationUpdates();
  } catch (err) {
    console.warn('[TripCoordinator] Failed to restart background location on resume:', err);
  }

  storeRegistry.refreshTrips(activeTrip.vehicle_id);


  return { success: true, data: updated ?? undefined };
}

/**
 * Finishes the active GPS trip, flushes data, calculates durable distance, and persists completed state.
 */
export async function finishGpsTripCoordinator(
  tripId?: string,
  options?: FinishTripOptions,
  interactionId?: string
): Promise<CoordinatorResult<Trip>> {
  if (isDuplicateInteraction(interactionId)) {
    return { success: false, error: 'Duplicate interaction ignored', isDuplicate: true };
  }

  const activeTrip = tripRepo.getActiveTrip();
  if (!activeTrip) {
    return { success: false, error: 'No active trip to finish.' };
  }
  if (tripId && activeTrip.id !== tripId) {
    return { success: false, error: 'Mismatched trip ID.' };
  }

  // 1. Stop background tracking
  try {
    await stopBackgroundLocationUpdates();
  } catch (e) {
    console.warn('[TripCoordinator] Error stopping background location on finish:', e);
  }

  // 2. Derive durable distance
  const storedLocations = tripRepo.getTripLocations(activeTrip.id);
  const acceptedPoints = storedLocations.filter((l) => l.is_rejected === 0);

  let pauseIntervals: Array<{ paused_at: number; resumed_at: number }> = [];
  let diagnosticsObj: TripDiagnostics | null = null;
  if (activeTrip.diagnostics) {
    try {
      diagnosticsObj = JSON.parse(activeTrip.diagnostics);
      if (diagnosticsObj && Array.isArray(diagnosticsObj.pause_intervals)) {
        pauseIntervals = diagnosticsObj.pause_intervals;
      }
    } catch {}
  }

  let finalDistanceKm = 0;
  if (typeof options?.distance_km === 'number' && options.distance_km > 0) {
    finalDistanceKm = Math.round(options.distance_km * 100) / 100;
  } else if (typeof activeTrip.distance_km === 'number' && activeTrip.distance_km > 0) {
    finalDistanceKm = activeTrip.distance_km;
  } else if (acceptedPoints.length >= 2) {
    finalDistanceKm = calculateDurableTripDistance(acceptedPoints, pauseIntervals);
  }

  let elapsedSeconds = activeTrip.duration_seconds || 0;
  if (activeTrip.start_time) {
    const startMs = new Date(activeTrip.start_time).getTime();
    if (!isNaN(startMs)) {
      elapsedSeconds = Math.max(elapsedSeconds, Math.floor((Date.now() - startMs) / 1000));
    }
  }

  const qualityNotes = buildQualityWarning({
    hasGapWarning: diagnosticsObj?.has_gap_warning ?? false,
    totalReceived: diagnosticsObj?.total_samples_received ?? acceptedPoints.length,
    rejectedCount: diagnosticsObj?.rejected_samples_count ?? 0,
    rejectionCounts: diagnosticsObj?.rejection_counts,
  });

  const finalized = tripRepo.finalizeTrip(activeTrip.id, {
    distance_km: finalDistanceKm,
    duration_seconds: elapsedSeconds,
    notes: options?.notes,
    purpose: options?.purpose ?? activeTrip.purpose,
    end_odometer: options?.endOdometer,
    has_quality_warnings: (diagnosticsObj?.gap_count ?? 0) > 0 || (diagnosticsObj?.rejected_samples_count ?? 0) > 0,
    quality_notes: qualityNotes,
    diagnostics: diagnosticsObj,
  });

  storeRegistry.refreshTrips(activeTrip.vehicle_id);


  return { success: true, data: finalized ?? undefined };
}

/**
 * Cycles the selected vehicle intended for the NEXT trip.
 * Atomically rotates through active vehicles in order.
 * NEVER reassigns or cancels an ongoing active trip.
 */
export async function cycleNextVehicleCoordinator(
  interactionId?: string
): Promise<CoordinatorResult<string>> {
  if (isDuplicateInteraction(interactionId)) {
    return { success: false, error: 'Duplicate interaction ignored', isDuplicate: true };
  }

  const vehicles = vehicleRepo.getActiveVehicles();
  if (!vehicles || vehicles.length < 2) {
    return { success: false, error: 'At least two active vehicles are required to cycle.' };
  }

  let storedId: string | null = null;
  try {
    storedId = await AsyncStorage.getItem(WIDGET_VEHICLE_KEY);
  } catch {}

  const nextId = getNextVehicleId(vehicles, storedId);
  if (nextId) {
    try {
      await AsyncStorage.setItem(WIDGET_VEHICLE_KEY, nextId);
    } catch (e) {
      console.warn('[TripCoordinator] Failed to persist cycled vehicle ID:', e);
    }
  }


  return { success: true, data: nextId ?? undefined };
}
