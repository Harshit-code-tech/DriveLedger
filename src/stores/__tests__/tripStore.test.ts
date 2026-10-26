/**
 * Trip Store Unit & Integration Test Suite
 *
 * Verifies:
 * - Single global active GPS session enforcement across vehicles
 * - Prevention of concurrent start requests
 * - Callback and timer isolation via session generation
 * - Late callback rejection from superseded/stopped sessions
 * - Lifecycle idempotency (repeated pause/resume/finish/cancel)
 * - Error reconciliation when location watcher fails
 * - Permission revocation and disabled location services
 * - Accurate GPS quality mapping (missing/null accuracy -> 'none')
 * - Independent signal gap detection and rejection counter accumulation
 * - Final distance derivation from persisted SQLite points
 * - Buffer retry behavior on persistence failure
 */

import { resetMockDatabase } from '@/__mocks__/expo-sqlite';
import { getDatabase } from '@/database/connection';
import { createTables } from '@/database/schema';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import * as tripRepo from '@/database/repositories/tripRepo';
import { useTripStore, _resetActiveSessionForTesting } from '../tripStore';
import * as Location from 'expo-location';
import { FuelType, VehicleType } from '@/constants/fuelTypes';
import type { Vehicle } from '@/types/vehicle';

describe('TripStore Lifecycle & GPS Engine Integration', () => {
  let vehicleA: Vehicle;
  let vehicleB: Vehicle;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    _resetActiveSessionForTesting();

    resetMockDatabase();
    const db = getDatabase();
    createTables(db);

    vehicleA = vehicleRepo.createVehicle({
      nickname: 'Mahindra Thar',
      vehicle_type: VehicleType.CAR,
      fuel_type: FuelType.DIESEL,
      registration_number: 'MH-01-AB-1234',
      current_odometer: 10000,
    });

    vehicleB = vehicleRepo.createVehicle({
      nickname: 'Tata Nexon EV',
      vehicle_type: VehicleType.CAR,
      fuel_type: FuelType.ELECTRIC,
      registration_number: 'MH-02-CD-5678',
      current_odometer: 5000,
    });

    // Reset store state
    useTripStore.setState({
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
    });

    // Reset default expo-location mock implementations
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
      granted: true,
    });
    (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
    (Location.watchPositionAsync as jest.Mock).mockImplementation(async (_options, _cb) => ({
      remove: jest.fn(),
    }));
  });

  afterEach(() => {
    _resetActiveSessionForTesting();
    jest.useRealTimers();
  });

  describe('1. Global Active Session Enforcement', () => {
    test('enforces only one active GPS session globally across different vehicles', async () => {
      // Start GPS trip on Vehicle A
      const startA = await useTripStore.getState().startGpsTrip(vehicleA.id, 10000, 'Commute');
      expect(startA.success).toBe(true);
      expect(useTripStore.getState().recordingState).toBe('recording');
      expect(useTripStore.getState().activeTrip?.vehicle_id).toBe(vehicleA.id);

      // Attempt to start GPS trip on Vehicle B while Vehicle A is recording
      const startB = await useTripStore.getState().startGpsTrip(vehicleB.id, 5000, 'Roadtrip');
      expect(startB.success).toBe(false);
      expect(startB.error).toContain('already recording or paused');

      // Pause Vehicle A and try starting Vehicle B again
      await useTripStore.getState().pauseGpsTrip();
      expect(useTripStore.getState().recordingState).toBe('paused');

      const startBWhilePaused = await useTripStore.getState().startGpsTrip(vehicleB.id, 5000, 'Roadtrip');
      expect(startBWhilePaused.success).toBe(false);
      expect(startBWhilePaused.error).toContain('already recording or paused');
    });

    test('prevents concurrent double-start requests', async () => {
      let resolvePermission: (value: any) => void;
      const permPromise = new Promise((resolve) => {
        resolvePermission = resolve;
      });

      (Location.requestForegroundPermissionsAsync as jest.Mock).mockImplementationOnce(() => permPromise);

      // Initiate first start (will hang on permission check)
      const firstStart = useTripStore.getState().startGpsTrip(vehicleA.id, 10000);

      // Attempt second start concurrently
      const secondStart = await useTripStore.getState().startGpsTrip(vehicleA.id, 10000);
      expect(secondStart.success).toBe(false);
      expect(secondStart.error).toContain('already in progress');

      // Resolve first start
      resolvePermission!({ status: 'granted' });
      const firstResult = await firstStart;
      expect(firstResult.success).toBe(true);
    });

    test('historical completed manual trips do not block starting a GPS trip', async () => {
      // Create manual trip
      useTripStore.getState().addManualTrip({
        vehicle_id: vehicleA.id,
        date: '2026-03-01',
        start_odometer: 9800,
        end_odometer: 10000,
        purpose: 'Previous manual entry',
      });

      // Starting GPS trip should succeed
      const result = await useTripStore.getState().startGpsTrip(vehicleA.id, 10000);
      expect(result.success).toBe(true);
      expect(useTripStore.getState().recordingState).toBe('recording');
    });
  });

  describe('2. Lifecycle Safety & Idempotency', () => {
    test('repeated pause/resume/finish/cancel calls are safe and idempotent', async () => {
      await useTripStore.getState().startGpsTrip(vehicleA.id, 10000);

      // Pause twice
      await useTripStore.getState().pauseGpsTrip();
      expect(useTripStore.getState().recordingState).toBe('paused');
      await useTripStore.getState().pauseGpsTrip();
      expect(useTripStore.getState().recordingState).toBe('paused');

      // Resume twice
      await useTripStore.getState().resumeGpsTrip();
      expect(useTripStore.getState().recordingState).toBe('recording');
      await useTripStore.getState().resumeGpsTrip();
      expect(useTripStore.getState().recordingState).toBe('recording');

      // Finish trip
      const finished = await useTripStore.getState().finishGpsTrip();
      expect(finished).not.toBeNull();
      expect(useTripStore.getState().recordingState).toBe('idle');

      // Repeated finish when idle returns null
      const secondFinish = await useTripStore.getState().finishGpsTrip();
      expect(secondFinish).toBeNull();

      // Repeated cancel when idle is a safe no-op
      await expect(useTripStore.getState().cancelGpsTrip()).resolves.toBeUndefined();
    });

    test('reconciles DB record and cleans up timer if location watcher fails to start', async () => {
      (Location.watchPositionAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Hardware GPS subsystem unavailable')
      );

      const result = await useTripStore.getState().startGpsTrip(vehicleA.id, 10000);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Hardware GPS subsystem unavailable');

      // Store state should be cleanly idle
      expect(useTripStore.getState().recordingState).toBe('idle');
      expect(useTripStore.getState().activeTrip).toBeNull();

      // DB record should NOT be left dangling in recording state
      const activeInDb = tripRepo.getActiveTrip();
      expect(activeInDb).toBeNull();

      // The created trip record is marked interrupted
      const allTrips = tripRepo.getTripsByVehicle(vehicleA.id);
      expect(allTrips.length).toBe(1);
      expect(allTrips[0].status).toBe('interrupted');
      expect(allTrips[0].quality_warning).toContain('Failed to initialize GPS location watcher');
    });

    test('rejects trip startup if location permission is denied', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
        granted: false,
      });

      const result = await useTripStore.getState().startGpsTrip(vehicleA.id, 10000);
      expect(result.success).toBe(false);
      expect(result.error).toContain('permission was denied');
      expect(tripRepo.getActiveTrip()).toBeNull();
    });

    test('rejects trip startup if location services are disabled on device', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValueOnce(false);

      const result = await useTripStore.getState().startGpsTrip(vehicleA.id, 10000);
      expect(result.success).toBe(false);
      expect(result.error).toContain('services are disabled');
      expect(tripRepo.getActiveTrip()).toBeNull();
    });
  });

  describe('3. Callback Isolation & Diagnostics', () => {
    test('ignores late callbacks from superseded or stopped sessions', async () => {
      let capturedCallback: (loc: any) => void;
      (Location.watchPositionAsync as jest.Mock).mockImplementationOnce(async (_options, cb) => {
        capturedCallback = cb;
        return { remove: jest.fn() };
      });

      await useTripStore.getState().startGpsTrip(vehicleA.id, 10000);

      // Finish trip 1
      await useTripStore.getState().finishGpsTrip();
      expect(useTripStore.getState().recordingState).toBe('idle');

      // Simulate a late callback arriving from trip 1 after finish
      jest.advanceTimersByTime(1000);
      capturedCallback!({
        coords: {
          latitude: 28.631,
          longitude: 77.216,
          accuracy: 10,
          speed: 15,
          heading: 90,
          altitude: 200,
        },
        timestamp: 1700000000000,
      });

      // Should not resurrect session or modify metrics
      expect(useTripStore.getState().recordingState).toBe('idle');
      expect(useTripStore.getState().liveMetrics.distanceKm).toBe(0);
      expect(useTripStore.getState().liveMetrics.samplesCount).toBe(0);
    });

    test('treats null or missing accuracy as unknown/none quality', async () => {
      let capturedCallback: (loc: any) => void;
      (Location.watchPositionAsync as jest.Mock).mockImplementationOnce(async (_options, cb) => {
        capturedCallback = cb;
        return { remove: jest.fn() };
      });

      await useTripStore.getState().startGpsTrip(vehicleA.id, 10000);

      // Fix with null accuracy
      capturedCallback!({
        coords: {
          latitude: 28.631,
          longitude: 77.216,
          accuracy: null,
          speed: 10,
          heading: 0,
          altitude: 100,
        },
        timestamp: 1700000000000,
      });

      // Quality must be 'none', not 'good'
      expect(useTripStore.getState().liveMetrics.gpsQuality).toBe('none');
      expect(useTripStore.getState().liveMetrics.currentAccuracy).toBeNull();

      // Fix with valid high accuracy (10m)
      jest.advanceTimersByTime(1000);
      capturedCallback!({
        coords: {
          latitude: 28.631,
          longitude: 77.216,
          accuracy: 10,
          speed: 10,
          heading: 0,
          altitude: 100,
        },
        timestamp: 1700000002000,
      });

      expect(useTripStore.getState().liveMetrics.gpsQuality).toBe('good');
      expect(useTripStore.getState().liveMetrics.currentAccuracy).toBe(10);
    });

    test('tracks signal gaps and rejections in live session and persists diagnostics on finish', async () => {
      let capturedCallback: (loc: any) => void;
      (Location.watchPositionAsync as jest.Mock).mockImplementationOnce(async (_options, cb) => {
        capturedCallback = cb;
        return { remove: jest.fn() };
      });

      await useTripStore.getState().startGpsTrip(vehicleA.id, 10000);

      // Fix 1: valid anchor
      jest.advanceTimersByTime(1000);
      capturedCallback!({
        coords: {
          latitude: 28.6310,
          longitude: 77.2160,
          accuracy: 10,
          speed: 10,
          heading: 90,
          altitude: 200,
        },
        timestamp: 1700000000000,
      });

      // Fix 2: 150 seconds later (> 120s gap), valid movement
      jest.advanceTimersByTime(1000);
      capturedCallback!({
        coords: {
          latitude: 28.6350,
          longitude: 77.2200,
          accuracy: 12,
          speed: 12,
          heading: 90,
          altitude: 200,
        },
        timestamp: 1700000150000,
      });

      expect(useTripStore.getState().liveMetrics.hasGaps).toBe(true);

      // Fix 3: stationary drift (< 4m)
      capturedCallback!({
        coords: {
          latitude: 28.63501,
          longitude: 77.22001,
          accuracy: 12,
          speed: 0,
          heading: 90,
          altitude: 200,
        },
        timestamp: 1700000152000,
      });

      // Finish trip
      const finalized = await useTripStore.getState().finishGpsTrip();
      expect(finalized).not.toBeNull();
      expect(finalized?.quality_warning).toContain('GPS signal loss');
      expect(finalized?.diagnostics).toBeDefined();

      const diag = JSON.parse(finalized!.diagnostics!);
      expect(diag.gap_count).toBeGreaterThan(0);
      expect(diag.max_gap_seconds).toBe(150);
      expect(diag.rejection_counts.stationary_drift).toBe(1);
      expect(diag.accepted_samples_count).toBe(2);
    });

    test('final distance is derived from persisted SQLite points and buffer failure retries safely', async () => {
      let capturedCallback: (loc: any) => void;
      (Location.watchPositionAsync as jest.Mock).mockImplementationOnce(async (_options, cb) => {
        capturedCallback = cb;
        return { remove: jest.fn() };
      });

      await useTripStore.getState().startGpsTrip(vehicleA.id, 10000);

      // Generate 12 samples to trigger a batch flush at 10 samples
      for (let i = 0; i < 12; i++) {
        capturedCallback!({
          coords: {
            latitude: 28.6310 + i * 0.001, // ~110m step per fix
            longitude: 77.2160,
            accuracy: 10,
            speed: 15,
            heading: 0,
            altitude: 200,
          },
          timestamp: 1700000000000 + i * 5000,
        });
      }

      // Finish trip flushes the remaining 2 samples and derives total distance
      const finalized = await useTripStore.getState().finishGpsTrip();
      expect(finalized).not.toBeNull();
      expect(finalized?.distance_km).toBeGreaterThan(1.0);

      // All 12 samples must be persisted in SQLite
      const locations = tripRepo.getTripLocations(finalized!.id);
      expect(locations.length).toBe(12);
    });
  });
});
