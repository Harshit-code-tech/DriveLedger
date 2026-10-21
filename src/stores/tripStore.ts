/**
 * Trip Store (Zustand)
 *
 * Global state for offline GPS trip recording, manual trip logging, and trip history.
 * Connects the UI layer to tripRepo and distanceEngine.
 *
 * KEY FEATURES:
 * - Foreground GPS trip tracking via expo-location
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
  TripLocation,
  CreateManualTripInput,
  RawLocationSample,
  FilteredLocationSample,
} from '@/types/trip';
import * as tripRepo from '@/database/repositories/tripRepo';
import {
  processLocationSample,
  calculateTripDistance,
} from '@/engine/distanceEngine';

interface ActiveTripState {
  tripId: string;
  vehicleId: string;
  startTime: number;
  lastAcceptedSample: FilteredLocationSample | null;
  sampleBuffer: FilteredLocationSample[];
  allFilteredSamples: FilteredLocationSample[];
  distanceKm: number;
  elapsedSeconds: number;
  currentSpeed: number | null;
  currentAccuracy: number | null;
  gpsQuality: 'good' | 'fair' | 'poor' | 'none';
  hasGaps: boolean;
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
  finishGpsTrip: (options?: {
    notes?: string;
    purpose?: string;
    endOdometer?: number | null;
  }) => Promise<Trip | null>;
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
let timerInterval: ReturnType<typeof setInterval> | null = null;
let activeSession: ActiveTripState | null = null;

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
      const active = tripRepo.getActiveTrip(vehicleId);
      set({
        trips,
        activeTrip: active,
        recordingState: active ? (active.status === 'paused' ? 'paused' : 'recording') : 'idle',
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
      return count;
    } catch {
      return 0;
    }
  },

  startGpsTrip: async (vehicleId: string, startOdometer?: number | null, purpose?: string) => {
    try {
      set({ error: null });

      // Check if an active trip is already recorded
      const existing = tripRepo.getActiveTrip(vehicleId);
      if (existing) {
        return {
          success: false,
          error: 'An active trip is already in progress for this vehicle.',
        };
      }

      // Check foreground location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return {
          success: false,
          error: 'Location permission was denied. You can record manual trips instead.',
        };
      }

      // Check if location services are enabled
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        return {
          success: false,
          error: 'Device location / GPS services are disabled. Please enable them to record a trip.',
        };
      }

      // Create trip record in SQLite
      const trip = tripRepo.createActiveTrip({
        vehicle_id: vehicleId,
        recording_method: 'gps',
        start_odometer: startOdometer,
        purpose,
      });

      const now = Date.now();
      activeSession = {
        tripId: trip.id,
        vehicleId,
        startTime: now,
        lastAcceptedSample: null,
        sampleBuffer: [],
        allFilteredSamples: [],
        distanceKm: 0,
        elapsedSeconds: 0,
        currentSpeed: null,
        currentAccuracy: null,
        gpsQuality: 'none',
        hasGaps: false,
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

      // Start elapsed timer
      if (timerInterval) clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        if (!activeSession) return;
        activeSession.elapsedSeconds += 1;
        set((state) => ({
          liveMetrics: {
            ...state.liveMetrics,
            elapsedSeconds: activeSession?.elapsedSeconds ?? 0,
          },
        }));
      }, 1000);

      // Start watching foreground location
      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 3,
        },
        (loc) => {
          if (!activeSession) return;

          const raw: RawLocationSample = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            altitude: loc.coords.altitude,
            accuracy: loc.coords.accuracy,
            speed: loc.coords.speed,
            heading: loc.coords.heading,
            timestamp: loc.timestamp,
          };

          const result = processLocationSample(raw, activeSession.lastAcceptedSample);

          // Determine quality
          let quality: 'good' | 'fair' | 'poor' | 'none' = 'good';
          const acc = raw.accuracy ?? 100;
          if (acc > 35) quality = 'poor';
          else if (acc > 15) quality = 'fair';

          activeSession.currentSpeed = raw.speed !== null && raw.speed !== undefined && raw.speed >= 0 ? raw.speed : null;
          activeSession.currentAccuracy = raw.accuracy ?? null;
          activeSession.gpsQuality = quality;

          if (result.gapDetected) {
            activeSession.hasGaps = true;
          }

          if (result.sample) {
            activeSession.lastAcceptedSample = result.sample;
            activeSession.distanceKm += result.deltaKm;
            activeSession.allFilteredSamples.push(result.sample);
            activeSession.sampleBuffer.push(result.sample);

            // Periodically flush buffer to SQLite every 10 samples
            if (activeSession.sampleBuffer.length >= 10) {
              try {
                tripRepo.addTripLocations(activeSession.tripId, activeSession.sampleBuffer);
                activeSession.sampleBuffer = [];
              } catch {
                // Buffer will be retried on next flush or finish
              }
            }
          }

          set((state) => ({
            liveMetrics: {
              distanceKm: activeSession?.distanceKm ?? 0,
              elapsedSeconds: activeSession?.elapsedSeconds ?? 0,
              currentSpeed: activeSession?.currentSpeed ?? null,
              currentAccuracy: activeSession?.currentAccuracy ?? null,
              gpsQuality: activeSession?.gpsQuality ?? 'none',
              hasGaps: activeSession?.hasGaps ?? false,
              samplesCount: activeSession?.allFilteredSamples.length ?? 0,
            },
          }));
        }
      );

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start GPS trip';
      set({ error: msg });
      return { success: false, error: msg };
    }
  },

  pauseGpsTrip: async () => {
    const { activeTrip } = get();
    if (!activeTrip || !activeSession) return;

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
      } catch {
        // Ignored
      }
    }

    tripRepo.updateTripStatus(activeTrip.id, 'paused');
    set({ recordingState: 'paused' });
  },

  resumeGpsTrip: async () => {
    const { activeTrip } = get();
    if (!activeTrip || !activeSession) return;

    tripRepo.updateTripStatus(activeTrip.id, 'recording');
    set({ recordingState: 'recording' });

    // Restart timer
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!activeSession) return;
      activeSession.elapsedSeconds += 1;
      set((state) => ({
        liveMetrics: {
          ...state.liveMetrics,
          elapsedSeconds: activeSession?.elapsedSeconds ?? 0,
        },
      }));
    }, 1000);

    // Restart location watcher
    try {
      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 3,
        },
        (loc) => {
          if (!activeSession) return;

          const raw: RawLocationSample = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            altitude: loc.coords.altitude,
            accuracy: loc.coords.accuracy,
            speed: loc.coords.speed,
            heading: loc.coords.heading,
            timestamp: loc.timestamp,
          };

          const result = processLocationSample(raw, activeSession.lastAcceptedSample);

          let quality: 'good' | 'fair' | 'poor' | 'none' = 'good';
          const acc = raw.accuracy ?? 100;
          if (acc > 35) quality = 'poor';
          else if (acc > 15) quality = 'fair';

          activeSession.currentSpeed = raw.speed !== null && raw.speed !== undefined && raw.speed >= 0 ? raw.speed : null;
          activeSession.currentAccuracy = raw.accuracy ?? null;
          activeSession.gpsQuality = quality;

          if (result.gapDetected) {
            activeSession.hasGaps = true;
          }

          if (result.sample) {
            activeSession.lastAcceptedSample = result.sample;
            activeSession.distanceKm += result.deltaKm;
            activeSession.allFilteredSamples.push(result.sample);
            activeSession.sampleBuffer.push(result.sample);

            if (activeSession.sampleBuffer.length >= 10) {
              try {
                tripRepo.addTripLocations(activeSession.tripId, activeSession.sampleBuffer);
                activeSession.sampleBuffer = [];
              } catch {
                // Buffer retry
              }
            }
          }

          set((state) => ({
            liveMetrics: {
              distanceKm: activeSession?.distanceKm ?? 0,
              elapsedSeconds: activeSession?.elapsedSeconds ?? 0,
              currentSpeed: activeSession?.currentSpeed ?? null,
              currentAccuracy: activeSession?.currentAccuracy ?? null,
              gpsQuality: activeSession?.gpsQuality ?? 'none',
              hasGaps: activeSession?.hasGaps ?? false,
              samplesCount: activeSession?.allFilteredSamples.length ?? 0,
            },
          }));
        }
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to resume location tracking';
      set({ error: msg });
    }
  },

  finishGpsTrip: async (options) => {
    const { activeTrip } = get();
    if (!activeTrip || !activeSession) return null;

    if (locationSubscription) {
      locationSubscription.remove();
      locationSubscription = null;
    }
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    // Flush any remaining samples
    if (activeSession.sampleBuffer.length > 0) {
      try {
        tripRepo.addTripLocations(activeSession.tripId, activeSession.sampleBuffer);
        activeSession.sampleBuffer = [];
      } catch {
        // Ignore
      }
    }

    // Run final distance calculation across all stored / filtered samples
    const finalCalc = calculateTripDistance(activeSession.allFilteredSamples);
    const finalDistance = Math.round(finalCalc.totalDistanceKm * 100) / 100;
    const finalDuration = Math.round(activeSession.elapsedSeconds / 60);

    const finalizedTrip = tripRepo.finalizeTrip(activeTrip.id, {
      distance_km: finalDistance,
      duration_minutes: finalDuration,
      notes: options?.notes,
      purpose: options?.purpose ?? activeTrip.purpose,
      end_odometer: options?.endOdometer,
      has_quality_warnings: activeSession.hasGaps || finalCalc.rejectedSamplesCount > 0,
      quality_notes: activeSession.hasGaps ? 'GPS signal gaps detected during trip' : undefined,
    });

    const vehicleId = activeSession.vehicleId;
    activeSession = null;

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

    return finalizedTrip;
  },

  cancelGpsTrip: async () => {
    const { activeTrip } = get();
    if (locationSubscription) {
      locationSubscription.remove();
      locationSubscription = null;
    }
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    if (activeTrip) {
      tripRepo.softDeleteTrip(activeTrip.id);
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
  },

  addManualTrip: (input: CreateManualTripInput) => {
    const trip = tripRepo.createManualTrip(input);
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
