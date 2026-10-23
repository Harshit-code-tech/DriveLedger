/**
 * Background Location Task
 *
 * Defines and registers the top-level TaskManager background task for
 * GPS trip tracking on Android 8.0+ and iOS.
 *
 * ARCHITECTURAL REQUIREMENTS:
 * - Defined at top-level module scope outside React components and hooks
 * - Imported at the application entry point (index.js / app/_layout.tsx)
 * - Durable persistence: directly persists accepted samples and diagnostics to SQLite
 * - Independent of mounted React components or live Zustand store
 * - Coordinates with UI through an in-memory listener pattern to eliminate duplicate samples
 * - Safe lifecycle management: automatically stops tracking if no recording trip exists in SQLite
 */

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import type {
  RawLocationSample,
  FilteredLocationSample,
  TripDiagnostics,
  RejectionCounts,
} from '@/types/trip';
import * as tripRepo from '@/database/repositories/tripRepo';
import {
  processLocationSample,
  haversineDistance,
  buildQualityWarning,
} from '@/engine/distanceEngine';
import { syncGpsWidgetState } from '@/widgets/widgetDataService';

export const BACKGROUND_LOCATION_TASK = 'DRIVELEDGER_BACKGROUND_LOCATION_TASK';

/** Throttle background widget updates to at most once every 15 seconds */
let lastBgWidgetSync = 0;
function maybeSyncGpsWidgetFromBackground(): void {
  const now = Date.now();
  if (now - lastBgWidgetSync >= 15000) {
    lastBgWidgetSync = now;
    void syncGpsWidgetState();
  }
}

/** Flag indicating the next location fix must act as an anchor (e.g. initial start or post-pause resume) */
let needsNewAnchor = true;

export function resetBackgroundLocationAnchor(): void {
  needsNewAnchor = true;
}

export interface BackgroundLocationUpdateEvent {
  tripId: string;
  totalDistanceKm: number;
  acceptedSamplesCount: number;
  rejectedSamplesCount: number;
  currentSpeed: number | null;
  currentAccuracy: number | null;
  gpsQuality: 'good' | 'fair' | 'poor' | 'none';
  hasGaps: boolean;
  latestSample: FilteredLocationSample | null;
}

type BackgroundLocationListener = (event: BackgroundLocationUpdateEvent) => void;
const listeners = new Set<BackgroundLocationListener>();

/**
 * Registers an in-memory listener to receive updates when background locations are processed.
 * Used by tripStore to keep UI metrics updated in real time when app is in foreground.
 */
export function addBackgroundLocationListener(listener: BackgroundLocationListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function determineGpsQuality(accuracy: number | null | undefined): 'good' | 'fair' | 'poor' | 'none' {
  if (typeof accuracy !== 'number' || isNaN(accuracy) || !isFinite(accuracy) || accuracy <= 0) {
    return 'none';
  }
  if (accuracy > 35) return 'poor';
  if (accuracy > 15) return 'fair';
  return 'good';
}

interface LocationTaskData {
  locations?: Location.LocationObject[];
}

/**
 * Core processing logic for background location fixes.
 * Exposed for testing and executed by TaskManager.
 */
export async function handleBackgroundLocations(locations: Location.LocationObject[]): Promise<void> {
  if (!locations || locations.length === 0) return;

  // 1. Durable check: get the current active trip from SQLite
  const activeTrip = tripRepo.getActiveTrip();
  if (!activeTrip || activeTrip.status !== 'recording') {
    // If no trip is actively recording in SQLite, stop background updates
    try {
      const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      if (isRunning) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      }
    } catch (e) {
      console.warn('[BackgroundLocationTask] Failed to stop updates for inactive trip:', e);
    }
    return;
  }

  // 2. Load existing persisted locations to determine the last accepted fix
  let lastAccepted: FilteredLocationSample | null = null;
  if (!needsNewAnchor) {
    const storedLocations = tripRepo.getTripLocations(activeTrip.id);
    const acceptedExisting = storedLocations.filter((l) => l.is_rejected === 0);
    if (acceptedExisting.length > 0) {
      const lastRow = acceptedExisting[acceptedExisting.length - 1];
      lastAccepted = {
        latitude: lastRow.latitude,
        longitude: lastRow.longitude,
        altitude: lastRow.altitude ?? undefined,
        accuracy: lastRow.accuracy ?? undefined,
        speed: lastRow.speed ?? undefined,
        heading: lastRow.heading ?? undefined,
        timestamp: lastRow.timestamp,
        isAccepted: true,
        stepDistanceMeters: 0,
      };
    }
  } else {
    // Starting or resuming from pause: anchor here without accumulating distance
    needsNewAnchor = false;
  }

  const storedLocations = tripRepo.getTripLocations(activeTrip.id);
  const acceptedExisting = storedLocations.filter((l) => l.is_rejected === 0);

  // Parse existing diagnostics or initialize fresh
  let currentDiagnostics: TripDiagnostics = {
    rejection_counts: {
      invalid_coordinates: 0,
      poor_accuracy: 0,
      unknown_accuracy: 0,
      stale_or_duplicate_timestamp: 0,
      stationary_drift: 0,
      implausible_speed: 0,
    },
    total_samples_received: 0,
    accepted_samples_count: acceptedExisting.length,
    rejected_samples_count: storedLocations.length - acceptedExisting.length,
    gap_count: 0,
    max_gap_seconds: 0,
    has_gap_warning: false,
  };

  if (activeTrip.diagnostics) {
    try {
      const parsed = JSON.parse(activeTrip.diagnostics);
      if (parsed && typeof parsed === 'object') {
        currentDiagnostics = {
          ...currentDiagnostics,
          ...parsed,
          rejection_counts: {
            ...currentDiagnostics.rejection_counts,
            ...(parsed.rejection_counts || {}),
          },
        };
      }
    } catch {
      // Use fallback initialized above
    }
  }

  const newSamplesToPersist: FilteredLocationSample[] = [];
  let incrementalDistanceMeters = 0;
  let latestSpeed: number | null = null;
  let latestAccuracy: number | null = null;
  let latestQuality: 'good' | 'fair' | 'poor' | 'none' = 'none';
  let latestAcceptedSample: FilteredLocationSample | null = lastAccepted;

  for (const loc of locations) {
    const raw: RawLocationSample = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      altitude: loc.coords.altitude,
      accuracy: loc.coords.accuracy,
      speed: loc.coords.speed,
      heading: loc.coords.heading,
      timestamp: loc.timestamp,
    };

    currentDiagnostics.total_samples_received++;
    latestAccuracy = typeof raw.accuracy === 'number' && isFinite(raw.accuracy) ? raw.accuracy : null;
    latestSpeed = raw.speed !== null && raw.speed !== undefined && raw.speed >= 0 ? raw.speed : null;
    latestQuality = determineGpsQuality(raw.accuracy);

    const result = processLocationSample(raw, lastAccepted);

    if (result.gapDetected) {
      currentDiagnostics.has_gap_warning = true;
      currentDiagnostics.gap_count++;
      if (result.gapDurationSeconds && result.gapDurationSeconds > currentDiagnostics.max_gap_seconds) {
        currentDiagnostics.max_gap_seconds = result.gapDurationSeconds;
      }
    }

    if (result.sample && !result.rejected) {
      currentDiagnostics.accepted_samples_count++;
      incrementalDistanceMeters += result.deltaKm * 1000;
      lastAccepted = result.sample;
      latestAcceptedSample = result.sample;
      newSamplesToPersist.push(result.sample);
    } else {
      currentDiagnostics.rejected_samples_count++;
      if (result.reason) {
        currentDiagnostics.rejection_counts[result.reason] =
          (currentDiagnostics.rejection_counts[result.reason] || 0) + 1;
      }
    }
  }

  // 3. Persist new accepted samples to SQLite
  if (newSamplesToPersist.length > 0) {
    try {
      tripRepo.addTripLocations(activeTrip.id, newSamplesToPersist);
    } catch (err) {
      console.warn('[BackgroundLocationTask] Failed to persist location samples:', err);
    }
  }

  // 4. Update trip totals in SQLite
  const newDistanceKm = Math.round(((activeTrip.distance_km || 0) + incrementalDistanceMeters / 1000) * 100) / 100;
  const qualityWarning = buildQualityWarning({
    hasGapWarning: currentDiagnostics.has_gap_warning,
    totalReceived: currentDiagnostics.total_samples_received,
    rejectedCount: currentDiagnostics.rejected_samples_count,
    rejectionCounts: currentDiagnostics.rejection_counts,
  });

  try {
    tripRepo.updateTrip(activeTrip.id, {
      distance_km: newDistanceKm,
      sample_count: currentDiagnostics.accepted_samples_count,
      quality_warning: qualityWarning,
      diagnostics: JSON.stringify(currentDiagnostics),
    });
  } catch (err) {
    console.warn('[BackgroundLocationTask] Failed to update trip record in SQLite:', err);
  }

  // 5. Notify in-memory listeners (UI store)
  const event: BackgroundLocationUpdateEvent = {
    tripId: activeTrip.id,
    totalDistanceKm: newDistanceKm,
    acceptedSamplesCount: currentDiagnostics.accepted_samples_count,
    rejectedSamplesCount: currentDiagnostics.rejected_samples_count,
    currentSpeed: latestSpeed,
    currentAccuracy: latestAccuracy,
    gpsQuality: latestQuality,
    hasGaps: currentDiagnostics.has_gap_warning,
    latestSample: latestAcceptedSample,
  };

  for (const listener of listeners) {
    try {
      listener(event);
    } catch (err) {
      console.warn('[BackgroundLocationTask] Listener error:', err);
    }
  }

  // 6. Periodically synchronize native Android GPS widget
  maybeSyncGpsWidgetFromBackground();
}

// Register TaskManager task at top-level module scope
try {
  TaskManager.defineTask(
    BACKGROUND_LOCATION_TASK,
    async ({ data, error }: TaskManager.TaskManagerTaskBody<LocationTaskData>) => {
      if (error) {
        console.warn(`[BackgroundLocationTask] TaskManager error: ${error.message}`);
        return;
      }
      if (data && data.locations) {
        await handleBackgroundLocations(data.locations);
      }
    }
  );
} catch (e) {
  console.warn('[BackgroundLocationTask] Error defining TaskManager task:', e);
}

/**
 * Starts background location tracking with Android Foreground Service notification.
 */
export async function startBackgroundLocationUpdates(): Promise<boolean> {
  needsNewAnchor = true;
  try {
    const isAvailable = await Location.isBackgroundLocationAvailableAsync();
    if (!isAvailable) {
      console.warn('[BackgroundLocationTask] Background location not available on device');
      return false;
    }

    const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (isRunning) {
      return true;
    }

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 2000,
      distanceInterval: 3,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'DriveLedger Trip Recording',
        notificationBody: 'Recording vehicle route in the background...',
        notificationColor: '#084CB4',
        killServiceOnDestroy: false,
      },
    });

    return true;
  } catch (err) {
    console.warn('[BackgroundLocationTask] Failed to start background location updates:', err);
    return false;
  }
}

/**
 * Stops background location updates.
 */
export async function stopBackgroundLocationUpdates(): Promise<void> {
  try {
    const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch (err) {
    console.warn('[BackgroundLocationTask] Failed to stop background location updates:', err);
  }
}

/**
 * Checks whether the background location task is currently running.
 */
export async function isBackgroundLocationUpdatesActive(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  } catch {
    return false;
  }
}
