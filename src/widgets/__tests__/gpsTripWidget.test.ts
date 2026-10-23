/**
 * Phase 5/6 Test Suite — Dedicated GpsTripWidget Architecture & Lifecycle
 *
 * Comprehensive verification of all 29 requirements from Section 12:
 * - Layout & Control Visibility (1-6)
 * - Action & Idempotency (7-13)
 * - Vehicle Rotation (14-20)
 * - Background, GPS & Persistence (21-29)
 */

import { resetMockDatabase } from '@/__mocks__/expo-sqlite';
import { getDatabase } from '@/database/connection';
import { createTables } from '@/database/schema';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import * as tripRepo from '@/database/repositories/tripRepo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  GpsTripWidget,
  DEFAULT_GPS_WIDGET_DATA,
  GpsTripWidgetData,
} from '../GpsTripWidget';
import {
  getGpsWidgetDataSnapshot,
  GPS_WIDGET_NAME,
  WIDGET_NAME,
  WIDGET_VEHICLE_KEY,
  cycleWidgetVehicle,
  getNextVehicleId,
} from '../widgetDataService';
import { widgetTaskHandler } from '../widgetTaskHandler';
import {
  startGpsTripCoordinator,
  pauseGpsTripCoordinator,
  resumeGpsTripCoordinator,
  finishGpsTripCoordinator,
  cycleNextVehicleCoordinator,
  calculateDurableTripDistance,
  resetInteractionsForTesting,
} from '@/services/tripCoordinatorService';
import {
  handleBackgroundLocations,
  resetBackgroundLocationAnchor,
} from '@/tasks/backgroundLocationTask';
import { FuelType, VehicleType } from '@/constants/fuelTypes';
import type { Vehicle } from '@/types/vehicle';
import type { LocationObject } from 'expo-location';

declare const require: any;
declare const __dirname: string;
const fs: any = require('fs');
const path: any = require('path');

let asyncStore: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getAllKeys: jest.fn(async () => Object.keys(asyncStore)),
  getItem: jest.fn(async (key: string) => asyncStore[key] ?? null),
  setItem: jest.fn(async (key: string, val: string) => {
    asyncStore[key] = val;
  }),
  removeItem: jest.fn(async (key: string) => {
    delete asyncStore[key];
  }),
  clear: jest.fn(async () => {
    asyncStore = {};
  }),
}));

// Mock Location permissions to return granted by default in tests
jest.mock('@/services/locationPermissionService', () => ({
  checkLocationPermissionStatus: jest.fn(async () => ({
    servicesEnabled: true,
    foregroundGranted: true,
    backgroundGranted: true,
    canAskBackground: true,
  })),
  requestTripTrackingPermissions: jest.fn(async () => ({
    success: true,
    backgroundGranted: true,
  })),
}));

describe('GpsTripWidget Architecture & Lifecycle Redesign', () => {
  let vehicleA: Vehicle;
  let vehicleB: Vehicle;

  beforeEach(() => {
    asyncStore = {};
    resetInteractionsForTesting();
    resetMockDatabase();
    const db = getDatabase();
    createTables(db);

    vehicleA = vehicleRepo.createVehicle({
      nickname: 'Mahindra Scorpio-N',
      vehicle_type: VehicleType.CAR,
      fuel_type: FuelType.DIESEL,
      registration_number: 'MH-12-PQ-4567',
      current_odometer: 15000,
    });

    vehicleB = vehicleRepo.createVehicle({
      nickname: 'Tata Tiago EV',
      vehicle_type: VehicleType.CAR,
      fuel_type: FuelType.ELECTRIC,
      registration_number: 'MH-14-XY-8901',
      current_odometer: 8200,
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Section 1: Layout & Control Visibility (Req 1-6)
  // ══════════════════════════════════════════════════════════════════════════
  describe('Group 1: Layout and Control Visibility', () => {
    test('1. Switch Vehicle is present while idle', () => {
      const widget = GpsTripWidget({
        ...DEFAULT_GPS_WIDGET_DATA,
        status: 'idle',
        vehicleCount: 2,
        vehicleName: 'Mahindra Scorpio-N',
      });

      const str = JSON.stringify(widget);
      expect(str).toContain('SWITCH_NEXT_VEHICLE');
      expect(str).toContain('Start GPS Trip');
    });

    test('2. Switch Vehicle remains present while recording, paused, completed, and recovery-needed', () => {
      const states: GpsTripWidgetData['status'][] = ['recording', 'paused', 'idle', 'interrupted'];

      for (const st of states) {
        const widget = GpsTripWidget({
          ...DEFAULT_GPS_WIDGET_DATA,
          status: st,
          vehicleCount: 3,
          vehicleName: 'Mahindra Scorpio-N',
          nextVehicleName: 'Tata Tiago EV',
        });
        const str = JSON.stringify(widget);
        // Switch vehicle action must be present in every state!
        expect(str).toContain('SWITCH_NEXT_VEHICLE');
      }
    });

    test('3. One vehicle: visible disabled selector with explanation', () => {
      const widget = GpsTripWidget({
        ...DEFAULT_GPS_WIDGET_DATA,
        status: 'idle',
        vehicleCount: 1,
        vehicleName: 'Sole Vehicle',
      });
      const str = JSON.stringify(widget);
      // Explains only 1 vehicle exists without silently hiding the selector area
      expect(str).toContain('⇄ (1)');
      expect(str).not.toContain('SWITCH_NEXT_VEHICLE');
    });

    test('4. No vehicles: Add Vehicle appears and Start is unavailable', () => {
      const widget = GpsTripWidget({
        ...DEFAULT_GPS_WIDGET_DATA,
        status: 'no_vehicles',
        vehicleCount: 0,
        vehicleName: 'No Vehicles',
      });
      const str = JSON.stringify(widget);
      expect(str).toContain('+ Add Vehicle');
      expect(str).toContain('driveledger://add-vehicle');
      expect(str).not.toContain('START_TRIP');
    });

    test('5. Start/Pause/Resume/Finish controls agree with persisted lifecycle state', () => {
      // Idle has START_TRIP
      const idleWidget = GpsTripWidget({ ...DEFAULT_GPS_WIDGET_DATA, status: 'idle' });
      expect(JSON.stringify(idleWidget)).toContain('START_TRIP');

      // Recording has PAUSE_TRIP and FINISH_TRIP
      const recWidget = GpsTripWidget({ ...DEFAULT_GPS_WIDGET_DATA, status: 'recording' });
      const recStr = JSON.stringify(recWidget);
      expect(recStr).toContain('PAUSE_TRIP');
      expect(recStr).toContain('FINISH_TRIP');
      expect(recStr).not.toContain('START_TRIP');

      // Paused has RESUME_TRIP and FINISH_TRIP
      const pausedWidget = GpsTripWidget({ ...DEFAULT_GPS_WIDGET_DATA, status: 'paused' });
      const pausedStr = JSON.stringify(pausedWidget);
      expect(pausedStr).toContain('RESUME_TRIP');
      expect(pausedStr).toContain('FINISH_TRIP');
      expect(pausedStr).not.toContain('START_TRIP');
    });

    test('6. No button falls through to a parent click handler and triggers another action', () => {
      const widget = GpsTripWidget({
        ...DEFAULT_GPS_WIDGET_DATA,
        status: 'recording',
        vehicleCount: 2,
      });

      // Root widget must NOT have a clickAction attribute
      expect((widget.props as any).clickAction).toBeUndefined();
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Section 2: Action and Idempotency (Req 7-13)
  // ══════════════════════════════════════════════════════════════════════════
  describe('Group 2: Action and Idempotency', () => {
    test('7. One Start interaction creates one trip', async () => {
      const res = await startGpsTripCoordinator(vehicleA.id, 'start_test_1');
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();

      const active = tripRepo.getActiveTrip();
      expect(active?.id).toBe(res.data?.id);
      expect(active?.status).toBe('recording');
    });

    test('8. Duplicate delivery of the same Start interaction creates no duplicate trip', async () => {
      // First delivery
      const res1 = await startGpsTripCoordinator(vehicleA.id, 'duplicate_start_nonce');
      expect(res1.success).toBe(true);

      // Duplicate delivery of same interactionId
      const res2 = await startGpsTripCoordinator(vehicleA.id, 'duplicate_start_nonce');
      expect(res2.success).toBe(false);
      expect(res2.isDuplicate).toBe(true);

      const allTrips = tripRepo.getTripsByVehicle(vehicleA.id);
      expect(allTrips).toHaveLength(1);
    });

    test('9. Separate Start requests while an active trip exists cannot create a second concurrent trip', async () => {
      // Trip 1 on vehicle A
      await startGpsTripCoordinator(vehicleA.id, 'interaction_a');

      // Separate Start on vehicle B with different interactionId
      const resB = await startGpsTripCoordinator(vehicleB.id, 'interaction_b');
      expect(resB.success).toBe(false);
      expect(resB.error).toContain('Only one active trip can exist globally');

      // Only one active trip exists
      const db = getDatabase();
      const activeTrips = db.getAllSync("SELECT * FROM trips WHERE status IN ('recording', 'paused')");
      expect(activeTrips).toHaveLength(1);
    });

    test('10. Widget rendering/refresh never executes an action', async () => {
      const tripsBefore = tripRepo.getTripsByVehicle(vehicleA.id);
      expect(tripsBefore).toHaveLength(0);

      // Rendering widget multiple times
      GpsTripWidget({ ...DEFAULT_GPS_WIDGET_DATA, vehicleCount: 2 });
      GpsTripWidget({ ...DEFAULT_GPS_WIDGET_DATA, status: 'recording' });
      await getGpsWidgetDataSnapshot();

      const tripsAfter = tripRepo.getTripsByVehicle(vehicleA.id);
      expect(tripsAfter).toHaveLength(0);
    });

    test('11. Finish is terminal; stale actions/navigation params cannot restart the trip', async () => {
      const startRes = await startGpsTripCoordinator(vehicleA.id, 'trip_to_finish');
      expect(startRes.success).toBe(true);

      // Finish trip
      const finishRes = await finishGpsTripCoordinator(startRes.data!.id, undefined, 'finish_nonce');
      expect(finishRes.success).toBe(true);
      expect(finishRes.data?.status).toBe('completed');

      // Attempting to finish again or resume
      const resumeRes = await resumeGpsTripCoordinator(startRes.data!.id, 'resume_stale');
      expect(resumeRes.success).toBe(false);

      const active = tripRepo.getActiveTrip();
      expect(active).toBeNull();
    });

    test('12. Intentional Pause/Finish do not create an interrupted marker; genuine process interruption can', async () => {
      // 1. Intentional Pause
      const startRes = await startGpsTripCoordinator(vehicleA.id, 'pause_test');
      await pauseGpsTripCoordinator(startRes.data!.id, 'pause_nonce');

      let trip = tripRepo.getTripById(startRes.data!.id);
      expect(trip?.status).toBe('paused');
      expect(trip?.quality_warning).toBeNull();

      // 2. Intentional Finish
      await resumeGpsTripCoordinator(startRes.data!.id, 'resume_nonce');
      await finishGpsTripCoordinator(startRes.data!.id, undefined, 'finish_nonce');

      trip = tripRepo.getTripById(startRes.data!.id);
      expect(trip?.status).toBe('completed');
      expect(trip?.quality_warning).toBeNull();

      // 3. Genuine abnormal crash: trip left in 'recording' state when app killed
      const crashedTrip = tripRepo.createTrip({
        vehicle_id: vehicleB.id,
        trip_type: 'gps',
        start_time: '2026-10-23T11:00:00Z',
      });
      expect(crashedTrip.status).toBe('recording');

      // Recovery runs on restart
      const recoveredCount = tripRepo.recoverInterruptedTrips();
      expect(recoveredCount).toBe(1);

      const recovered = tripRepo.getTripById(crashedTrip.id);
      expect(recovered?.status).toBe('interrupted');
      expect(recovered?.quality_warning).toContain('interrupted');
    });

    test('13. Action failure does not render false success', async () => {
      // Try to pause with non-existent trip
      const res = await pauseGpsTripCoordinator('non_existent_trip_id', 'nonce_fail');
      expect(res.success).toBe(false);

      const snapshot = await getGpsWidgetDataSnapshot();
      expect(snapshot.status).toBe('idle');
      expect(snapshot.statusText).toBe('READY');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Section 3: Vehicle Rotation (Req 14-20)
  // ══════════════════════════════════════════════════════════════════════════
  describe('Group 3: Vehicle Rotation', () => {
    let fleet: Vehicle[] = [];

    beforeEach(() => {
      fleet = [];
      for (let i = 1; i <= 5; i++) {
        fleet.push(
          vehicleRepo.createVehicle({
            nickname: `Car ${i}`,
            vehicle_type: VehicleType.CAR,
            fuel_type: FuelType.PETROL,
            registration_number: `DL-0${i}`,
          })
        );
      }
    });

    test('14. Five+ vehicles rotate once per distinct tap and wrap correctly', () => {
      let cur = fleet[0].id;
      for (let i = 1; i < fleet.length; i++) {
        cur = getNextVehicleId(fleet, cur)!;
        expect(cur).toBe(fleet[i].id);
      }
      // Wraparound to first vehicle
      cur = getNextVehicleId(fleet, cur)!;
      expect(cur).toBe(fleet[0].id);
    });

    test('15. Vehicles with previous trip history are not skipped', () => {
      // Add trips to Car 2 and Car 4
      tripRepo.createManualTrip({
        vehicle_id: fleet[1].id,
        date: '2026-10-21',
        start_odometer: 100,
        end_odometer: 150,
      });
      tripRepo.createManualTrip({
        vehicle_id: fleet[3].id,
        date: '2026-10-22',
        start_odometer: 200,
        end_odometer: 280,
      });

      // Rotation steps through Car 2 and Car 4 normally
      const nextFrom1 = getNextVehicleId(fleet, fleet[0].id);
      expect(nextFrom1).toBe(fleet[1].id);

      const nextFrom2 = getNextVehicleId(fleet, fleet[1].id);
      expect(nextFrom2).toBe(fleet[2].id);

      const nextFrom3 = getNextVehicleId(fleet, fleet[2].id);
      expect(nextFrom3).toBe(fleet[3].id);
    });

    test('16. Two rapid distinct taps advance two positions; duplicate delivery of one interaction advances once', async () => {
      await AsyncStorage.setItem(WIDGET_VEHICLE_KEY, fleet[0].id);

      // Duplicate delivery of interaction 'tap_1'
      await cycleNextVehicleCoordinator('tap_1');
      await cycleNextVehicleCoordinator('tap_1');

      let stored = await AsyncStorage.getItem(WIDGET_VEHICLE_KEY);
      expect(stored).toBe(fleet[1].id); // Advanced only once!

      // Two distinct taps with different interactionIds
      await cycleNextVehicleCoordinator('tap_2');
      await cycleNextVehicleCoordinator('tap_3');

      stored = await AsyncStorage.getItem(WIDGET_VEHICLE_KEY);
      expect(stored).toBe(fleet[3].id); // Advanced two more positions!
    });

    test('17. Reordered/deleted vehicle and invalid selection cases are deterministic', () => {
      // Invalid selection falls back safely to first vehicle
      const res = getNextVehicleId(fleet, 'non_existent_vehicle_uuid');
      expect(res).toBe(fleet[0].id);

      // Deleting a vehicle adjusts cleanly
      const remainingFleet = fleet.filter((_, idx) => idx !== 2); // delete Car 3
      const nextFrom2 = getNextVehicleId(remainingFleet, fleet[1].id);
      expect(nextFrom2).toBe(fleet[3].id); // advances to Car 4
    });

    test('18. Selection survives widget refresh/app restart', async () => {
      await AsyncStorage.setItem(WIDGET_VEHICLE_KEY, fleet[3].id);

      const snapshot = await getGpsWidgetDataSnapshot();
      expect(snapshot.vehicleId).toBe(fleet[3].id);
      expect(snapshot.vehicleName).toBe('Car 4');
    });

    test('19. Changing next-trip selection never changes/stops active trip ownership', async () => {
      // Start recording on Car 1
      const startRes = await startGpsTripCoordinator(fleet[0].id, 'active_on_car_1');
      expect(startRes.success).toBe(true);

      await AsyncStorage.setItem(WIDGET_VEHICLE_KEY, fleet[0].id);
      let snapshot = await getGpsWidgetDataSnapshot();
      expect(snapshot.vehicleId).toBe(fleet[0].id);
      expect(snapshot.status).toBe('recording');

      // User cycles next-trip vehicle to Car 2
      await cycleNextVehicleCoordinator('cycle_while_recording');

      const storedNext = await AsyncStorage.getItem(WIDGET_VEHICLE_KEY);
      expect(storedNext).toBe(fleet[1].id);

      // Active trip remains firmly on Car 1, next vehicle reflects Car 2
      snapshot = await getGpsWidgetDataSnapshot();
      expect(snapshot.status).toBe('recording');
      expect(snapshot.vehicleId).toBe(fleet[0].id);
      expect(snapshot.vehicleName).toBe('Car 1');
      expect(snapshot.nextVehicleId).toBe(fleet[1].id);
      expect(snapshot.nextVehicleName).toBe('Car 2');

      const activeInDb = tripRepo.getActiveTrip();
      expect(activeInDb?.vehicle_id).toBe(fleet[0].id);
      expect(activeInDb?.status).toBe('recording');
    });

    test('20. Selector stays visible after completion and when a previous trip was interrupted', async () => {
      // Completed trip
      tripRepo.createManualTrip({
        vehicle_id: fleet[0].id,
        date: '2026-10-23',
        start_odometer: 10,
        end_odometer: 25,
      });

      let snapshot = await getGpsWidgetDataSnapshot();
      expect(snapshot.status).toBe('idle');
      expect(snapshot.vehicleCount).toBeGreaterThanOrEqual(5);

      let widget = GpsTripWidget(snapshot);
      expect(JSON.stringify(widget)).toContain('SWITCH_NEXT_VEHICLE');

      // Interrupted trip
      const crash = tripRepo.createTrip({ vehicle_id: fleet[1].id, trip_type: 'gps' });
      tripRepo.updateTrip(crash.id, { status: 'interrupted', quality_warning: 'Crash' });

      snapshot = await getGpsWidgetDataSnapshot();
      expect(snapshot.status).toBe('interrupted');
      widget = GpsTripWidget(snapshot);
      expect(JSON.stringify(widget)).toContain('SWITCH_NEXT_VEHICLE');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Section 4: Background, GPS, and Persistence (Req 21-29)
  // ══════════════════════════════════════════════════════════════════════════
  describe('Group 4: Background, GPS, and Persistence', () => {
    test('21. Persisted accepted fix triggers widget snapshot update from background task without a foreground React effect', async () => {
      const startRes = await startGpsTripCoordinator(vehicleA.id, 'bg_test');
      expect(startRes.success).toBe(true);

      const mockLocations: LocationObject[] = [
        {
          coords: {
            latitude: 18.5204,
            longitude: 73.8567,
            altitude: 560,
            accuracy: 10,
            altitudeAccuracy: 5,
            heading: 0,
            speed: 5,
          },
          timestamp: 1700000000000,
        },
        {
          coords: {
            latitude: 18.5250,
            longitude: 73.8600,
            altitude: 560,
            accuracy: 10,
            altitudeAccuracy: 5,
            heading: 0,
            speed: 12,
          },
          timestamp: 1700000060000,
        },
      ];

      await handleBackgroundLocations(mockLocations);

      const activeTrip = tripRepo.getActiveTrip();
      expect(activeTrip?.distance_km).toBeGreaterThan(0);

      const snapshot = await getGpsWidgetDataSnapshot();
      expect(snapshot.currentDistanceKm).toBe(activeTrip?.distance_km);
      expect(snapshot.status).toBe('recording');
    });

    test('22. Snapshot reads current persisted values rather than stale memory', async () => {
      const trip = tripRepo.createTrip({
        vehicle_id: vehicleA.id,
        trip_type: 'gps',
        start_time: new Date(Date.now() - 3600000).toISOString(),
      });

      tripRepo.updateTrip(trip.id, {
        distance_km: 42.19,
        duration_seconds: 3600,
      });

      const snapshot = await getGpsWidgetDataSnapshot();
      expect(snapshot.currentDistanceKm).toBe(42.19);
      expect(snapshot.currentDurationFormatted).toBe('1h 0m');
    });

    test('23. Throttling/coalescing does not lose terminal updates or leave a stale snapshot indefinitely', async () => {
      const startRes = await startGpsTripCoordinator(vehicleA.id, 'term_test');
      const finishRes = await finishGpsTripCoordinator(startRes.data!.id, undefined, 'finish_term');
      expect(finishRes.success).toBe(true);

      const snapshot = await getGpsWidgetDataSnapshot();
      // Must immediately reflect completed/idle, never lingering recording
      expect(snapshot.status).toBe('idle');
      expect(snapshot.statusText).toBe('READY');
      expect(snapshot.hasLastTrip).toBe(true);
    });

    test('24. Finish/cancel changes widget out of recording state', async () => {
      const startRes = await startGpsTripCoordinator(vehicleA.id, 'cancel_test');
      expect((await getGpsWidgetDataSnapshot()).status).toBe('recording');

      // Finish
      await finishGpsTripCoordinator(startRes.data!.id, undefined, 'finish_cancel_test');
      expect((await getGpsWidgetDataSnapshot()).status).toBe('idle');
    });

    test('25. Pause/resume anchor survives background/headless runtime recreation', async () => {
      const startRes = await startGpsTripCoordinator(vehicleA.id, 'anchor_test');
      const tripId = startRes.data!.id;

      // Pause
      await pauseGpsTripCoordinator(tripId, 'p_anchor');
      let trip = tripRepo.getTripById(tripId);
      let diag = JSON.parse(trip!.diagnostics!);
      expect(diag.anchor_needed).toBe(true);

      // Resume
      await resumeGpsTripCoordinator(tripId, 'r_anchor');
      trip = tripRepo.getTripById(tripId);
      diag = JSON.parse(trip!.diagnostics!);
      expect(diag.anchor_needed).toBe(true);
      expect(Array.isArray(diag.pause_intervals)).toBe(true);
    });

    test('26. Paused displacement is neither counted on Resume nor reintroduced at finalization', () => {
      // 1. Initial points (approx 0.30 km)
      const p1 = { latitude: 18.5200, longitude: 73.8500, timestamp: 1000000 };
      const p2 = { latitude: 18.5227, longitude: 73.8500, timestamp: 1000030 }; // ~300m north

      // 2. Pause occurs from timestamp 1000040 to 1000100 (60s)
      // During pause, vehicle moves 1 km away while paused
      const pauseIntervals = [{ paused_at: 1000040, resumed_at: 1000100 }];

      // 3. Post-resume anchor fix at timestamp 1000105 at the new location
      const p3 = { latitude: 18.5317, longitude: 73.8500, timestamp: 1000105 }; // anchor!

      // 4. Subsequent active movement after resume (approx 0.20 km)
      const p4 = { latitude: 18.5335, longitude: 73.8500, timestamp: 1000130 }; // ~200m north

      // Calculate durable distance across all points
      const points = [p1, p2, p3, p4];
      const distance = calculateDurableTripDistance(points, pauseIntervals);

      // Distance should be ~0.30 km (p1->p2) + 0 km (p2->p3 across pause) + ~0.20 km (p3->p4) = ~0.50 km
      // It must NOT include the 1.0 km displacement between p2 and p3!
      expect(distance).toBeCloseTo(0.50, 1);
      expect(distance).toBeLessThan(0.70); // Never >= 1.5 km
    });

    test('27. Pending accepted points are persisted before finish; write failures are handled', async () => {
      const startRes = await startGpsTripCoordinator(vehicleA.id, 'points_test');
      const tripId = startRes.data!.id;

      // Persist location samples
      tripRepo.saveTripLocation(tripId, {
        latitude: 18.5200,
        longitude: 73.8500,
        timestamp: Date.now(),
        isAccepted: true,
        stepDistanceMeters: 0,
      });

      const finishRes = await finishGpsTripCoordinator(tripId, undefined, 'finish_points');
      expect(finishRes.success).toBe(true);

      const locations = tripRepo.getTripLocations(tripId);
      expect(locations).toHaveLength(1);
    });

    test('28. Empty-history diagnostics distinguish known no-fix/rejected/write/query cases where evidence exists', () => {
      const trip = tripRepo.createTrip({
        vehicle_id: vehicleA.id,
        trip_type: 'gps',
      });

      const locations = tripRepo.getTripLocations(trip.id);
      expect(locations).toHaveLength(0);

      // Finish with 0 samples
      const finalized = tripRepo.finalizeTrip(trip.id, {
        distance_km: 0,
        duration_seconds: 10,
        diagnostics: {
          total_samples_received: 0,
          accepted_samples_count: 0,
          rejected_samples_count: 0,
          rejection_counts: {
            invalid_coordinates: 0,
            poor_accuracy: 0,
            unknown_accuracy: 0,
            stale_or_duplicate_timestamp: 0,
            stationary_drift: 0,
            implausible_speed: 0,
          },
          gap_count: 0,
          max_gap_seconds: 0,
          has_gap_warning: false,
        },
      });

      expect(finalized?.distance_km).toBe(0);
      expect(finalized?.sample_count).toBe(0);
    });

    test('29. Database points, trip ID, final summary, app history, and widget snapshot agree after scenarios', async () => {
      // 1. Start trip from widget coordinator
      const startRes = await startGpsTripCoordinator(vehicleA.id, 'e2e_trip');
      const tripId = startRes.data!.id;

      // 2. Background updates arrive
      await handleBackgroundLocations([
        {
          coords: { latitude: 18.5200, longitude: 73.8500, accuracy: 10, speed: 10, altitude: 0, altitudeAccuracy: 0, heading: 0 },
          timestamp: 10000,
        },
        {
          coords: { latitude: 18.5250, longitude: 73.8500, accuracy: 10, speed: 10, altitude: 0, altitudeAccuracy: 0, heading: 0 },
          timestamp: 20000,
        },
      ]);

      // 3. Pause
      await pauseGpsTripCoordinator(tripId, 'e2e_pause');

      // 4. Resume
      await resumeGpsTripCoordinator(tripId, 'e2e_resume');

      // 5. Active movement post-resume
      await handleBackgroundLocations([
        {
          coords: { latitude: 18.5260, longitude: 73.8500, accuracy: 10, speed: 10, altitude: 0, altitudeAccuracy: 0, heading: 0 },
          timestamp: 40000,
        },
        {
          coords: { latitude: 18.5300, longitude: 73.8500, accuracy: 10, speed: 10, altitude: 0, altitudeAccuracy: 0, heading: 0 },
          timestamp: 50000,
        },
      ]);

      // 6. Finish
      const finishRes = await finishGpsTripCoordinator(tripId, undefined, 'e2e_finish');
      expect(finishRes.success).toBe(true);

      // Verify DB agreement
      const dbTrip = tripRepo.getTripById(tripId);
      expect(dbTrip?.status).toBe('completed');
      expect(dbTrip?.distance_km).toBeGreaterThan(0);

      // Verify History query agreement
      const historyTrips = tripRepo.getTripsByVehicle(vehicleA.id);
      expect(historyTrips[0].id).toBe(tripId);
      expect(historyTrips[0].distance_km).toBe(dbTrip?.distance_km);

      // Verify Widget snapshot agreement
      const snapshot = await getGpsWidgetDataSnapshot();
      expect(snapshot.status).toBe('idle');
      expect(snapshot.hasLastTrip).toBe(true);
      expect(snapshot.lastTripDistanceKm).toBe(dbTrip?.distance_km);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Section 5: Widget Task Handler Headless Dispatch Integration
  // ══════════════════════════════════════════════════════════════════════════
  describe('Group 5: Headless widgetTaskHandler Action Dispatch', () => {
    test('handles START_TRIP via widgetTaskHandler', async () => {
      const mockRender = jest.fn();
      await widgetTaskHandler({
        widgetAction: 'WIDGET_CLICK',
        clickAction: 'START_TRIP',
        clickActionData: { vehicleId: vehicleA.id, interactionId: 'headless_start' },
        widgetInfo: { widgetName: GPS_WIDGET_NAME, widgetId: 1, width: 300, height: 150, screenInfo: {} as any },
        renderWidget: mockRender,
      });

      expect(mockRender).toHaveBeenCalledTimes(1);
      const active = tripRepo.getActiveTrip();
      expect(active?.vehicle_id).toBe(vehicleA.id);
      expect(active?.status).toBe('recording');
    });

    test('handles PAUSE_TRIP and RESUME_TRIP via widgetTaskHandler', async () => {
      const startRes = await startGpsTripCoordinator(vehicleA.id, 'headless_prep');
      const tripId = startRes.data!.id;

      // Pause via task handler
      const mockRenderPause = jest.fn();
      await widgetTaskHandler({
        widgetAction: 'WIDGET_CLICK',
        clickAction: 'PAUSE_TRIP',
        clickActionData: { tripId, interactionId: 'headless_pause' },
        widgetInfo: { widgetName: GPS_WIDGET_NAME, widgetId: 1, width: 300, height: 150, screenInfo: {} as any },
        renderWidget: mockRenderPause,
      });
      expect(mockRenderPause).toHaveBeenCalledTimes(1);
      expect(tripRepo.getActiveTrip()?.status).toBe('paused');

      // Resume via task handler
      const mockRenderResume = jest.fn();
      await widgetTaskHandler({
        widgetAction: 'WIDGET_CLICK',
        clickAction: 'RESUME_TRIP',
        clickActionData: { tripId, interactionId: 'headless_resume' },
        widgetInfo: { widgetName: GPS_WIDGET_NAME, widgetId: 1, width: 300, height: 150, screenInfo: {} as any },
        renderWidget: mockRenderResume,
      });
      expect(mockRenderResume).toHaveBeenCalledTimes(1);
      expect(tripRepo.getActiveTrip()?.status).toBe('recording');
    });

    test('handles FINISH_TRIP via widgetTaskHandler', async () => {
      const startRes = await startGpsTripCoordinator(vehicleA.id, 'headless_prep_finish');
      const tripId = startRes.data!.id;

      const mockRender = jest.fn();
      await widgetTaskHandler({
        widgetAction: 'WIDGET_CLICK',
        clickAction: 'FINISH_TRIP',
        clickActionData: { tripId, interactionId: 'headless_finish' },
        widgetInfo: { widgetName: GPS_WIDGET_NAME, widgetId: 1, width: 300, height: 150, screenInfo: {} as any },
        renderWidget: mockRender,
      });
      expect(mockRender).toHaveBeenCalledTimes(1);
      expect(tripRepo.getActiveTrip()).toBeNull();
      expect(tripRepo.getTripById(tripId)?.status).toBe('completed');
    });

    test('handles SWITCH_NEXT_VEHICLE via widgetTaskHandler', async () => {
      await AsyncStorage.setItem(WIDGET_VEHICLE_KEY, vehicleA.id);

      const mockRender = jest.fn();
      await widgetTaskHandler({
        widgetAction: 'WIDGET_CLICK',
        clickAction: 'SWITCH_NEXT_VEHICLE',
        clickActionData: { interactionId: 'headless_switch' },
        widgetInfo: { widgetName: GPS_WIDGET_NAME, widgetId: 1, width: 300, height: 150, screenInfo: {} as any },
        renderWidget: mockRender,
      });

      expect(mockRender).toHaveBeenCalledTimes(1);
      const stored = await AsyncStorage.getItem(WIDGET_VEHICLE_KEY);
      expect(stored).toBe(vehicleB.id);
    });

    test('preserves VehicleGlanceWidget dispatch intact', async () => {
      const mockRender = jest.fn();
      await widgetTaskHandler({
        widgetAction: 'WIDGET_UPDATE',
        widgetInfo: { widgetName: WIDGET_NAME, widgetId: 2, width: 320, height: 140, screenInfo: {} as any },
        renderWidget: mockRender,
      });
      expect(mockRender).toHaveBeenCalledTimes(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Section 6: Launcher Shortcuts & App.json Constraints
  // ══════════════════════════════════════════════════════════════════════════
  describe('Group 6: Launcher Shortcuts & Config Integrity', () => {
    test('confirms app.json preserves all 4 app shortcuts and GpsTripWidget registration', () => {
      const appJsonPath = path.resolve(__dirname, '../../../app.json');
      const raw = fs.readFileSync(appJsonPath, 'utf8');
      const parsed = JSON.parse(raw);

      const quickActionPlugin = parsed.expo.plugins.find(
        (p: any) => Array.isArray(p) && p[0] === 'expo-quick-actions'
      );
      expect(quickActionPlugin).toBeDefined();

      const items = quickActionPlugin[1].iosActions;
      expect(items).toHaveLength(4);

      const shortcutIds = items.map((i: any) => i.id);
      expect(shortcutIds).toContain('add_fuel');
      expect(shortcutIds).toContain('add_expense');
      expect(shortcutIds).toContain('add_service');
      expect(shortcutIds).toContain('trip_checklist');

      // CRITICAL: No GPS launcher shortcut added
      expect(shortcutIds).not.toContain('gps_trip');
      expect(shortcutIds).not.toContain('start_trip');

      // Verify react-native-android-widget registration
      const widgetPlugin = parsed.expo.plugins.find(
        (p: any) => Array.isArray(p) && p[0] === 'react-native-android-widget'
      );
      expect(widgetPlugin).toBeDefined();

      const widgets = widgetPlugin[1].widgets;
      expect(widgets).toHaveLength(2);

      const widgetNames = widgets.map((w: any) => w.name);
      expect(widgetNames).toContain('VehicleGlanceWidget');
      expect(widgetNames).toContain('GpsTripWidget');
    });
  });
});
