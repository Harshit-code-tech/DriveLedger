/**
 * Trip Store (Zustand)
 *
 * Global state for offline GPS trip recording, manual trip logging, and trip history.
 * Connects the UI layer to tripRepo and distanceEngine.
 *
 * KEY FEATURES:
 * - Single global active GPS recording session across the entire app
 * - Session-generation tokens ensuring callback and timer isolation
 * - Noise filtering, stationary drift detection, and jump rejection via distanceEngine
 * - Local SQLite persistence for trips and route samples
 * - Safe crash/kill recovery for interrupted trips
 * - Manual trip logging without GPS permissions
 * - 100% offline; zero map APIs or external network calls
 */

import { create } from 'zustand';
import * as Location from 'expo-location';
import type {
  Trip,
  CreateManualTripInput,
  FinishTripOptions,
  RawLocationSample,
  FilteredLocationSample,
  TripDiagnostics,
  RejectionCounts,
} from '@/types/trip';
import * as tripRepo from '@/database/repositories/tripRepo';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import { storeRegistry } from '@/stores/storeRegistry';
import { canUpdateCanonicalOdometer } from '@/engine/odometerReconciliation';
import {
  processLocationSample,
  haversineDistance,
  buildQualityWarning,
} from '@/engine/distanceEngine';
import { nowISO } from '@/utils/date';
import { requestTripTrackingPermissions } from '@/services/locationPermissionService';
import {
  startBackgroundLocationUpdates,
  stopBackgroundLocationUpdates,
  isBackgroundLocationUpdatesActive,
  addBackgroundLocationListener,
} from '@/tasks/backgroundLocationTask';
import { syncGpsWidgetState } from '@/widgets/widgetDataService';

interface ActiveTripSession {
  sessionGeneration: number;
  tripId: string;
  vehicleId: string;
  startTime: number;
  lastAcceptedSample: FilteredLocationSample | null;
  sampleBuffer: FilteredLocationSample[];
  distanceKm: number;
  elapsedSeconds: number;
  currentSpeed: number | null;
  currentAccuracy: number | null;
  gpsQuality: 'good' | 'fair' | 'poor' | 'none';
  hasGaps: boolean;
  gapCount: number;
  maxGapSeconds: number;
  totalSamplesReceived: number;
  acceptedSamplesCount: number;
  rejectedSamplesCount: number;
  rejectionCounts: RejectionCounts;
}

interface TripState {
  /** Completed / persisted trips for the selected vehicle */
  trips: Trip[];
  /** Currently active in-progress trip, if any */
  activeTrip: Trip | null;
  /** Recording state */
  recordingState: 'idle' | 'recording' | 'paused';
  /** Live metrics for the active trip */
  liveMetrics: {
    distanceKm: number;
    elapsedSeconds: number;
    currentSpeed: number | null;
    currentAccuracy: number | null;
    gpsQuality: 'good' | 'fair' | 'poor' | 'none';
    hasGaps: boolean;
    samplesCount: number;
  };
  isLoading: boolean;
  error: string | null;

  // ── Actions ──
  /** Load trips for a vehicle */
  loadTrips: (vehicleId: string) => void;
  /** Recover any interrupted active trips from previous crash */
  recoverInterruptedTrips: () => number;
  /** Start a new GPS trip */
  startGpsTrip: (
    vehicleId: string,
    startOdometer?: number | null,
    purpose?: string
  ) => Promise<{ success: boolean; error?: string }>;
  /** Pause the current GPS trip */
  pauseGpsTrip: () => Promise<void>;
  /** Resume the paused GPS trip */
  resumeGpsTrip: () => Promise<void>;
  /** Finish and save the active GPS trip */
  finishGpsTrip: (options?: FinishTripOptions) => Promise<Trip | null>;
  /** Cancel/discard the active GPS trip without saving */
  cancelGpsTrip: () => Promise<void>;
  /** Add a manual odometer-based trip entry */
  addManualTrip: (input: CreateManualTripInput) => Trip;
  /** Delete a trip */
  deleteTrip: (id: string, vehicleId: string) => void;
  /** Clear error message */
  clearError: () => void;
}

// Module-level tracking references
let locationSubscription: Location.LocationSubscription | null = null;
let backgroundListenerCleanup: (() => void) | null = null;
let isBackgroundTracking = false;
let timerInterval: ReturnType<typeof setInterval> | null = null;
let activeSession: ActiveTripSession | null = null;
let currentSessionGeneration = 0;
let isStartingSession = false;

function determineGpsQuality(accuracy: number | null | undefined): 'good' | 'fair' | 'poor' | 'none' {
  if (typeof accuracy !== 'number' || isNaN(accuracy) || !isFinite(accuracy) || accuracy <= 0) {
    return 'none';
  }
  if (accuracy > 35) return 'poor';
  if (accuracy > 15) return 'fair';
  return 'good';
}

let lastWidgetSyncTimestamp = 0;
function maybeSyncGpsWidget(): void {
  const now = Date.now();
  if (now - lastWidgetSyncTimestamp >= 30000) {
    lastWidgetSyncTimestamp = now;
    void syncGpsWidgetState();
  }
}

function handleLocationCallback(
  loc: Location.LocationObject,
  session: ActiveTripSession,
  set: (fn: (state: TripState) => Partial<TripState>) => void
): void {
  const raw: RawLocationSample = {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    altitude: loc.coords.altitude,
    accuracy: loc.coords.accuracy,
    speed: loc.coords.speed,
    heading: loc.coords.heading,
    timestamp: loc.timestamp,
  };

  session.totalSamplesReceived++;

  const quality = determineGpsQuality(raw.accuracy);
  session.currentSpeed =
    raw.speed !== null && raw.speed !== undefined && raw.speed >= 0 ? raw.speed : null;
  session.currentAccuracy =
    typeof raw.accuracy === 'number' && isFinite(raw.accuracy) ? raw.accuracy : null;
  session.gpsQuality = quality;

  const result = processLocationSample(raw, session.lastAcceptedSample);

  if (result.gapDetected) {
    session.hasGaps = true;
    session.gapCount++;
    if (result.gapDurationSeconds && result.gapDurationSeconds > session.maxGapSeconds) {
      session.maxGapSeconds = result.gapDurationSeconds;
    }
  }

  if (result.rejected) {
    session.rejectedSamplesCount++;
    if (result.reason) {
      session.rejectionCounts[result.reason]++;
    }
  } else if (result.sample) {
    session.acceptedSamplesCount++;
    session.lastAcceptedSample = result.sample;
    session.distanceKm += result.deltaKm;
    session.sampleBuffer.push(result.sample);

    // Periodically flush buffer to SQLite every 10 samples
    if (session.sampleBuffer.length >= 10) {
      try {
        tripRepo.addTripLocations(session.tripId, session.sampleBuffer);
        session.sampleBuffer = [];
      } catch (err) {
        // Do not clear sampleBuffer! Keep it so next flush or finish will retry
        console.warn('[tripStore] Failed to flush sample buffer to SQLite:', err);
      }
    }
  }

  set((state) => ({
    liveMetrics: {
      ...state.liveMetrics,
      distanceKm: Math.round(session.distanceKm * 100) / 100,
      elapsedSeconds: session.elapsedSeconds,
      currentSpeed: session.currentSpeed,
      currentAccuracy: session.currentAccuracy,
      gpsQuality: session.gpsQuality,
      hasGaps: session.hasGaps,
      samplesCount: session.acceptedSamplesCount,
    },
  }));

  maybeSyncGpsWidget();
}

export const useTripStore = create<TripState>((set, get) => ({
  trips: [],
  activeTrip: null,
  recordingState: 'idle',
  liveMetrics: {
    distanceKm: 0,
    elapsedSeconds: 0,
    currentSpeed: null,
    currentAccuracy: null,
    gpsQuality: 'none',
    hasGaps: false,
    samplesCount: 0,
  },
  isLoading: false,
  error: null,

  loadTrips: (vehicleId: string) => {
    try {
      set({ isLoading: true, error: null });
      const trips = tripRepo.getTripsByVehicle(vehicleId);

      // Resolve active trip: prioritize active in-memory session
      let active: Trip | null = null;
      let recState: TripState['recordingState'] = 'idle';

      if (activeSession) {
        if (activeSession.vehicleId === vehicleId) {
          active = tripRepo.getTripById(activeSession.tripId);
          recState = get().recordingState;
        } else {
          // An active session exists on another vehicle; retain global recording state
          active = get().activeTrip;
          recState = get().recordingState;
        }
      } else {
        const persistedActive = tripRepo.getActiveTrip();
        if (persistedActive) {
          active = persistedActive;
          recState = persistedActive.status === 'paused' ? 'paused' : 'recording';
        }
      }

      set({
        trips,
        activeTrip: active,
        recordingState: recState,
        isLoading: false,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load trips';
      set({ isLoading: false, error: msg });
    }
  },

  recoverInterruptedTrips: () => {
    try {
      const count = tripRepo.recoverInterruptedTrips();
      if (count > 0) {
        void syncGpsWidgetState();
      }
      return count;
    } catch {
      return 0;
    }
  },

  startGpsTrip: async (vehicleId: string, startOdometer?: number | null, purpose?: string) => {
    // 1. In-flight guard: prevent concurrent double-starts
    if (isStartingSession) {
      return {
        success: false,
        error: 'A GPS trip startup is already in progress.',
      };
    }

    // 2. In-memory check: reject if another session is already active
    if (activeSession !== null || get().recordingState !== 'idle') {
      return {
        success: false,
        error: 'A GPS trip is already recording or paused. Only one active GPS session can exist globally.',
      };
    }

    // 3. Database check: reject if ANY vehicle has an active GPS trip
    const globalActive = tripRepo.getActiveTrip();
    if (globalActive) {
      return {
        success: false,
        error: `A GPS trip is already active (${globalActive.status}) for vehicle ${globalActive.vehicle_id}. Only one active GPS session can exist globally.`,
      };
    }

    isStartingSession = true;
    try {
      set({ error: null });

      // Check and request Android 8+ compliant location permissions
      const permResult = await requestTripTrackingPermissions();
      if (!permResult.success) {
        return {
          success: false,
          error: permResult.error || 'Location permission was denied. You can record manual trips instead.',
        };
      }

      if (permResult.warning) {
        set({ error: permResult.warning });
      }

      // Determine baseline odometer: explicit startOdometer or current vehicle odometer
      let baselineOdo: number | null = null;
      if (typeof startOdometer === 'number') {
        baselineOdo = startOdometer;
      } else if (startOdometer === undefined) {
        const vehicle = vehicleRepo.getVehicleById(vehicleId);
        baselineOdo = vehicle?.current_odometer ?? null;
      }

      // Create trip record in SQLite
      const trip = tripRepo.createActiveTrip({
        vehicle_id: vehicleId,
        recording_method: 'gps',
        start_odometer: baselineOdo,
        purpose,
      });

      const thisGeneration = ++currentSessionGeneration;
      const thisTripId = trip.id;
      const now = Date.now();

      activeSession = {
        sessionGeneration: thisGeneration,
        tripId: thisTripId,
        vehicleId,
        startTime: now,
        lastAcceptedSample: null,
        sampleBuffer: [],
        distanceKm: 0,
        elapsedSeconds: 0,
        currentSpeed: null,
        currentAccuracy: null,
        gpsQuality: 'none',
        hasGaps: false,
        gapCount: 0,
        maxGapSeconds: 0,
        totalSamplesReceived: 0,
        acceptedSamplesCount: 0,
        rejectedSamplesCount: 0,
        rejectionCounts: {
          invalid_coordinates: 0,
          poor_accuracy: 0,
          unknown_accuracy: 0,
          stale_or_duplicate_timestamp: 0,
          stationary_drift: 0,
          implausible_speed: 0,
        },
      };

      // Set initial store state
      set({
        activeTrip: trip,
        recordingState: 'recording',
        liveMetrics: {
          distanceKm: 0,
          elapsedSeconds: 0,
          currentSpeed: null,
          currentAccuracy: null,
          gpsQuality: 'none',
          hasGaps: false,
          samplesCount: 0,
        },
      });

      // Start elapsed timer (tied strictly to thisGeneration & thisTripId)
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        if (
          !activeSession ||
          activeSession.sessionGeneration !== thisGeneration ||
          activeSession.tripId !== thisTripId
        ) {
          return;
        }
        activeSession.elapsedSeconds += 1;
        set((state) => ({
          liveMetrics: {
            ...state.liveMetrics,
            elapsedSeconds: activeSession?.elapsedSeconds ?? 0,
          },
        }));
      }, 1000);

      // Start watching foreground location with error recovery
      try {
        if (locationSubscription) {
          locationSubscription.remove();
          locationSubscription = null;
        }

        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 3,
          },
          (loc) => {
            // Guard against callbacks from superseded sessions
            if (
              !activeSession ||
              activeSession.sessionGeneration !== thisGeneration ||
              activeSession.tripId !== thisTripId
            ) {
              return;
            }
            handleLocationCallback(loc, activeSession, set);
          }
        );
      } catch (watcherErr) {
        // Watcher failed! Clean up timers, subscriptions, and reconcile the DB record
        if (timerInterval) {
          clearInterval(timerInterval);
          timerInterval = null;
        }
        if (locationSubscription) {
          locationSubscription.remove();
          locationSubscription = null;
        }
        activeSession = null;
        currentSessionGeneration++;

        const errMsg =
          watcherErr instanceof Error ? watcherErr.message : 'Location watcher failed to start';

        try {
          tripRepo.updateTrip(trip.id, {
            status: 'interrupted',
            end_time: nowISO(),
            quality_warning: `Failed to initialize GPS location watcher: ${errMsg}`,
          });
        } catch {
          // DB error fallback
        }

        set({
          activeTrip: null,
          recordingState: 'idle',
          error: errMsg,
        });

        return {
          success: false,
          error: errMsg,
        };
      }

      // Also register background location updates for Android Foreground Service & screen lock
      try {
        const bgSuccess = await startBackgroundLocationUpdates();
        if (bgSuccess) {
          isBackgroundTracking = true;
          if (backgroundListenerCleanup) {
            backgroundListenerCleanup();
            backgroundListenerCleanup = null;
          }
          backgroundListenerCleanup = addBackgroundLocationListener((event) => {
            if (
              !activeSession ||
              activeSession.sessionGeneration !== thisGeneration ||
              activeSession.tripId !== thisTripId ||
              event.tripId !== thisTripId
            ) {
              return;
            }
            activeSession.distanceKm = event.totalDistanceKm;
            activeSession.acceptedSamplesCount = event.acceptedSamplesCount;
            activeSession.rejectedSamplesCount = event.rejectedSamplesCount;
            activeSession.currentSpeed = event.currentSpeed;
            activeSession.currentAccuracy = event.currentAccuracy;
            activeSession.gpsQuality = event.gpsQuality;
            activeSession.hasGaps = event.hasGaps;
            if (event.latestSample) {
              activeSession.lastAcceptedSample = event.latestSample;
            }
            set((state) => ({
              liveMetrics: {
                ...state.liveMetrics,
                distanceKm: event.totalDistanceKm,
                currentSpeed: event.currentSpeed,
                currentAccuracy: event.currentAccuracy,
                gpsQuality: event.gpsQuality,
                hasGaps: event.hasGaps,
                samplesCount: event.acceptedSamplesCount,
              },
            }));
          });
        }
      } catch (bgErr) {
        console.warn('[tripStore] Background tracking start non-fatal error:', bgErr);
      }

      void syncGpsWidgetState();
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start GPS trip';
      set({ error: msg });
      return { success: false, error: msg };
    } finally {
      isStartingSession = false;
    }
  },

  pauseGpsTrip: async () => {
    const { activeTrip, recordingState } = get();
    // Idempotent guard
    if (recordingState !== 'recording' || !activeTrip || !activeSession) return;

    // Invalidate callbacks
    currentSessionGeneration++;

    if (isBackgroundTracking) {
      await stopBackgroundLocationUpdates();
      isBackgroundTracking = false;
    }
    if (backgroundListenerCleanup) {
      backgroundListenerCleanup();
      backgroundListenerCleanup = null;
    }
    if (locationSubscription) {
      locationSubscription.remove();
      locationSubscription = null;
    }
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    // Flush any pending samples
    if (activeSession.sampleBuffer.length > 0) {
      try {
        tripRepo.addTripLocations(activeSession.tripId, activeSession.sampleBuffer);
        activeSession.sampleBuffer = [];
      } catch (err) {
        console.warn('[tripStore] Failed to flush sample buffer on pause:', err);
      }
    }

    let updatedDiagnostics = activeTrip.diagnostics;
    try {
      const diagObj: TripDiagnostics = activeTrip.diagnostics
        ? JSON.parse(activeTrip.diagnostics)
        : {
            rejection_counts: {
              invalid_coordinates: 0,
              poor_accuracy: 0,
              unknown_accuracy: 0,
              stale_or_duplicate_timestamp: 0,
              stationary_drift: 0,
              implausible_speed: 0,
            },
            total_samples_received: activeSession.totalSamplesReceived,
            accepted_samples_count: activeSession.acceptedSamplesCount,
            rejected_samples_count: activeSession.rejectedSamplesCount,
            gap_count: activeSession.gapCount,
            max_gap_seconds: activeSession.maxGapSeconds,
            has_gap_warning: activeSession.hasGaps,
          };
      diagObj.anchor_needed = true;
      diagObj.paused_at = Date.now();
      updatedDiagnostics = JSON.stringify(diagObj);
    } catch {}

    tripRepo.updateTrip(activeTrip.id, {
      status: 'paused',
      diagnostics: updatedDiagnostics,
    });
    set({ recordingState: 'paused' });
    void syncGpsWidgetState();
  },

  resumeGpsTrip: async () => {
    const { activeTrip, recordingState } = get();
    // Idempotent guard
    if (recordingState !== 'paused' || !activeTrip || !activeSession) return;

    const nowMs = Date.now();
    let updatedDiagnostics = activeTrip.diagnostics;
    try {
      const diagObj: TripDiagnostics = activeTrip.diagnostics
        ? JSON.parse(activeTrip.diagnostics)
        : {
            rejection_counts: {
              invalid_coordinates: 0,
              poor_accuracy: 0,
              unknown_accuracy: 0,
              stale_or_duplicate_timestamp: 0,
              stationary_drift: 0,
              implausible_speed: 0,
            },
            total_samples_received: activeSession.totalSamplesReceived,
            accepted_samples_count: activeSession.acceptedSamplesCount,
            rejected_samples_count: activeSession.rejectedSamplesCount,
            gap_count: activeSession.gapCount,
            max_gap_seconds: activeSession.maxGapSeconds,
            has_gap_warning: activeSession.hasGaps,
          };
      diagObj.anchor_needed = true;
      diagObj.resumed_at = nowMs;
      if (!Array.isArray(diagObj.pause_intervals)) {
        diagObj.pause_intervals = [];
      }
      if (diagObj.paused_at) {
        diagObj.pause_intervals.push({
          paused_at: diagObj.paused_at,
          resumed_at: nowMs,
        });
      }
      updatedDiagnostics = JSON.stringify(diagObj);
    } catch {}

    tripRepo.updateTrip(activeTrip.id, {
      status: 'recording',
      diagnostics: updatedDiagnostics,
    });
    set({ recordingState: 'recording' });

    const thisGeneration = ++currentSessionGeneration;
    const thisTripId = activeTrip.id;
    activeSession.sessionGeneration = thisGeneration;
    // Clear last accepted sample so the next fix establishes a new anchor point
    // without accumulating distance traveled while the trip was paused.
    activeSession.lastAcceptedSample = null;

    // Restart timer
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (
        !activeSession ||
        activeSession.sessionGeneration !== thisGeneration ||
        activeSession.tripId !== thisTripId
      ) {
        return;
      }
      activeSession.elapsedSeconds += 1;
      set((state) => ({
        liveMetrics: {
          ...state.liveMetrics,
          elapsedSeconds: activeSession?.elapsedSeconds ?? 0,
        },
      }));
    }, 1000);

    // Restart location tracking: background or foreground
    let trackingResumed = false;
    try {
      const bgSuccess = await startBackgroundLocationUpdates();
      if (bgSuccess) {
        isBackgroundTracking = true;
        if (backgroundListenerCleanup) {
          backgroundListenerCleanup();
          backgroundListenerCleanup = null;
        }
        backgroundListenerCleanup = addBackgroundLocationListener((event) => {
          if (
            !activeSession ||
            activeSession.sessionGeneration !== thisGeneration ||
            activeSession.tripId !== thisTripId ||
            event.tripId !== thisTripId
          ) {
            return;
          }
          activeSession.distanceKm = event.totalDistanceKm;
          activeSession.acceptedSamplesCount = event.acceptedSamplesCount;
          activeSession.rejectedSamplesCount = event.rejectedSamplesCount;
          activeSession.currentSpeed = event.currentSpeed;
          activeSession.currentAccuracy = event.currentAccuracy;
          activeSession.gpsQuality = event.gpsQuality;
          activeSession.hasGaps = event.hasGaps;
          if (event.latestSample) {
            activeSession.lastAcceptedSample = event.latestSample;
          }
          set((state) => ({
            liveMetrics: {
              ...state.liveMetrics,
              distanceKm: event.totalDistanceKm,
              currentSpeed: event.currentSpeed,
              currentAccuracy: event.currentAccuracy,
              gpsQuality: event.gpsQuality,
              hasGaps: event.hasGaps,
              samplesCount: event.acceptedSamplesCount,
            },
          }));
          maybeSyncGpsWidget();
        });
        trackingResumed = true;
      }
    } catch (bgErr) {
      console.warn('[tripStore] Resume background tracking failed, trying foreground watcher:', bgErr);
    }

    if (!trackingResumed) {
      try {
        if (locationSubscription) {
          locationSubscription.remove();
          locationSubscription = null;
        }

        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 3,
          },
          (loc) => {
            if (
              !activeSession ||
              activeSession.sessionGeneration !== thisGeneration ||
              activeSession.tripId !== thisTripId
            ) {
              return;
            }
            handleLocationCallback(loc, activeSession, set);
          }
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to resume location tracking';
        set({ error: msg });
      }
    }
    void syncGpsWidgetState();
  },

  finishGpsTrip: async (options?: FinishTripOptions) => {
    const { activeTrip } = get();
    if (!activeTrip || !activeSession) return null;

    const currentSession = activeSession;
    const thisTrip = activeTrip;

    // Invalidate callbacks immediately
    currentSessionGeneration++;

    if (isBackgroundTracking) {
      await stopBackgroundLocationUpdates();
      isBackgroundTracking = false;
    }
    if (backgroundListenerCleanup) {
      backgroundListenerCleanup();
      backgroundListenerCleanup = null;
    }
    if (locationSubscription) {
      locationSubscription.remove();
      locationSubscription = null;
    }
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    // Flush any remaining buffered samples
    if (currentSession.sampleBuffer.length > 0) {
      try {
        tripRepo.addTripLocations(currentSession.tripId, currentSession.sampleBuffer);
        currentSession.sampleBuffer = [];
      } catch (err) {
        console.warn('[tripStore] Failed to flush final sample buffer on finish:', err);
      }
    }

    // Derive final distance from persisted accepted points in SQLite
    const storedLocations = tripRepo.getTripLocations(thisTrip.id);
    const acceptedPoints = storedLocations.filter((l) => l.is_rejected === 0);

    let finalDistanceKm = 0;
    if (currentSession.distanceKm > 0) {
      finalDistanceKm = Math.round(currentSession.distanceKm * 100) / 100;
    } else if (acceptedPoints.length >= 2) {
      let totalMeters = 0;
      for (let i = 1; i < acceptedPoints.length; i++) {
        totalMeters += haversineDistance(
          acceptedPoints[i - 1].latitude,
          acceptedPoints[i - 1].longitude,
          acceptedPoints[i].latitude,
          acceptedPoints[i].longitude
        );
      }
      finalDistanceKm = Math.round((totalMeters / 1000) * 100) / 100;
    } else if (typeof thisTrip.distance_km === 'number' && thisTrip.distance_km > 0) {
      finalDistanceKm = thisTrip.distance_km;
    }

    const finalDurationSeconds = currentSession.elapsedSeconds;
    const finalDurationMinutes = Math.round(finalDurationSeconds / 60);

    // Build aggregate diagnostics and quality warning from observed live events
    const diagnostics: TripDiagnostics = {
      rejection_counts: { ...currentSession.rejectionCounts },
      total_samples_received: currentSession.totalSamplesReceived,
      accepted_samples_count: currentSession.acceptedSamplesCount,
      rejected_samples_count: currentSession.rejectedSamplesCount,
      gap_count: currentSession.gapCount,
      max_gap_seconds: currentSession.maxGapSeconds,
      has_gap_warning: currentSession.hasGaps,
    };

    const qualityNotes = buildQualityWarning({
      hasGapWarning: currentSession.hasGaps,
      totalReceived: currentSession.totalSamplesReceived,
      rejectedCount: currentSession.rejectedSamplesCount,
      rejectionCounts: currentSession.rejectionCounts,
    });

    const finalizedTrip = tripRepo.finalizeTrip(thisTrip.id, {
      distance_km: finalDistanceKm,
      duration_seconds: finalDurationSeconds,
      duration_minutes: finalDurationMinutes,
      notes: options?.notes,
      purpose: options?.purpose ?? thisTrip.purpose,
      end_odometer: options?.endOdometer,
      has_quality_warnings: currentSession.hasGaps || currentSession.rejectedSamplesCount > 0,
      quality_notes: qualityNotes,
      diagnostics,
    });

    const vehicleId = currentSession.vehicleId;
    activeSession = null;

    // Explicit canonical odometer reconciliation
    if (options?.updateVehicleOdometer && typeof options?.endOdometer === 'number') {
      const vehicle = vehicleRepo.getVehicleById(vehicleId);
      const updateCheck = canUpdateCanonicalOdometer({
        proposedOdometer: options.endOdometer,
        currentCanonicalOdometer: vehicle?.current_odometer,
        isExplicitlyConfirmed: true,
      });
      if (updateCheck.canUpdate) {
        vehicleRepo.updateVehicleOdometer(vehicleId, options.endOdometer);
        storeRegistry.refreshVehicles();
      }
    }

    const trips = tripRepo.getTripsByVehicle(vehicleId);
    set({
      trips,
      activeTrip: null,
      recordingState: 'idle',
      liveMetrics: {
        distanceKm: 0,
        elapsedSeconds: 0,
        currentSpeed: null,
        currentAccuracy: null,
        gpsQuality: 'none',
        hasGaps: false,
        samplesCount: 0,
      },
    });

    void syncGpsWidgetState();
    return finalizedTrip;
  },

  cancelGpsTrip: async () => {
    const { activeTrip, recordingState } = get();
    // Idempotent guard
    if (recordingState === 'idle' && !activeTrip && !activeSession) return;

    currentSessionGeneration++;

    if (isBackgroundTracking) {
      await stopBackgroundLocationUpdates();
      isBackgroundTracking = false;
    }
    if (backgroundListenerCleanup) {
      backgroundListenerCleanup();
      backgroundListenerCleanup = null;
    }
    if (locationSubscription) {
      locationSubscription.remove();
      locationSubscription = null;
    }
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    const tripId = activeTrip?.id ?? activeSession?.tripId;
    if (tripId) {
      tripRepo.softDeleteTrip(tripId);
    }

    const vehicleId = activeSession?.vehicleId ?? activeTrip?.vehicle_id;
    activeSession = null;

    const trips = vehicleId ? tripRepo.getTripsByVehicle(vehicleId) : [];
    set({
      trips,
      activeTrip: null,
      recordingState: 'idle',
      liveMetrics: {
        distanceKm: 0,
        elapsedSeconds: 0,
        currentSpeed: null,
        currentAccuracy: null,
        gpsQuality: 'none',
        hasGaps: false,
        samplesCount: 0,
      },
    });
    void syncGpsWidgetState();
  },

  addManualTrip: (input: CreateManualTripInput) => {
    const trip = tripRepo.createManualTrip(input);

    // Explicit canonical odometer reconciliation
    if (input.updateVehicleOdometer && typeof input.end_odometer === 'number') {
      const vehicle = vehicleRepo.getVehicleById(input.vehicle_id);
      const updateCheck = canUpdateCanonicalOdometer({
        proposedOdometer: input.end_odometer,
        currentCanonicalOdometer: vehicle?.current_odometer,
        isExplicitlyConfirmed: true,
      });
      if (updateCheck.canUpdate) {
        vehicleRepo.updateVehicleOdometer(input.vehicle_id, input.end_odometer);
        storeRegistry.refreshVehicles();
      }
    }

    const trips = tripRepo.getTripsByVehicle(input.vehicle_id);
    set({ trips });
    return trip;
  },

  deleteTrip: (id: string, vehicleId: string) => {
    tripRepo.softDeleteTrip(id);
    const trips = tripRepo.getTripsByVehicle(vehicleId);
    set({ trips });
  },

  clearError: () => set({ error: null }),
}));

/**
 * Testing-only helper to cleanly reset module-level tracking references
 */
export function _resetActiveSessionForTesting(): void {
  if (isBackgroundTracking) {
    void stopBackgroundLocationUpdates();
    isBackgroundTracking = false;
  }
  if (backgroundListenerCleanup) {
    try {
      backgroundListenerCleanup();
    } catch {}
    backgroundListenerCleanup = null;
  }
  if (locationSubscription) {
    try {
      locationSubscription.remove();
    } catch {}
    locationSubscription = null;
  }
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  activeSession = null;
  currentSessionGeneration++;
  isStartingSession = false;
}
