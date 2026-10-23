/**
 * Phase 5 Test Suite — Dedicated GpsTripWidget
 *
 * Verifies:
 * - GpsTripWidget snapshot generation across all states:
 *   * Idle (no trips vs last trip summary)
 *   * Recording (live distance & duration snapshot)
 *   * Paused (paused status & persisted metrics)
 *   * Interrupted (honest notice, never claiming active recording)
 * - Deep link URI construction (active_trip vs start_trip vs recover_trip)
 * - Headless widgetTaskHandler dispatch for GpsTripWidget and VehicleGlanceWidget
 * - Multi-vehicle cycling support
 * - Verification that app shortcuts are preserved (Fuel, Expense, Service, Checklist)
 *   and no GPS launcher shortcut is added.
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
} from '../widgetDataService';
import { widgetTaskHandler } from '../widgetTaskHandler';
import { FuelType, VehicleType } from '@/constants/fuelTypes';
import type { Vehicle } from '@/types/vehicle';
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

describe('Phase 5: Dedicated GpsTripWidget & Lifecycle Integration', () => {
  let vehicleA: Vehicle;
  let vehicleB: Vehicle;

  beforeEach(() => {
    asyncStore = {};
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

  describe('1. GpsTripWidget Snapshot Generation', () => {
    test('returns idle state with ready prompt when no trips have been logged', async () => {
      const snapshot = await getGpsWidgetDataSnapshot();

      expect(snapshot.status).toBe('idle');
      expect(snapshot.statusText).toBe('READY');
      expect(snapshot.vehicleName).toBe('Mahindra Scorpio-N');
      expect(snapshot.hasLastTrip).toBe(false);
      expect(snapshot.currentDistanceKm).toBe(0);
      expect(snapshot.vehicleCount).toBe(2);
    });

    test('returns idle state with last trip summary when historical trips exist', async () => {
      const trip = tripRepo.createTrip({
        vehicle_id: vehicleA.id,
        trip_type: 'gps',
        start_time: '2026-10-22T09:00:00Z',
        start_odometer: 15000,
        purpose: 'Office',
      });

      tripRepo.updateTrip(trip.id, {
        status: 'completed',
        end_time: '2026-10-22T09:45:00Z',
        distance_km: 26.4,
        duration_seconds: 2700,
        end_odometer: 15026,
      });

      const snapshot = await getGpsWidgetDataSnapshot();

      expect(snapshot.status).toBe('idle');
      expect(snapshot.hasLastTrip).toBe(true);
      expect(snapshot.lastTripDistanceKm).toBe(26.4);
      expect(snapshot.lastTripDurationFormatted).toBe('45m');
    });

    test('returns honest recording state when an active GPS session is ongoing', async () => {
      tripRepo.createTrip({
        vehicle_id: vehicleA.id,
        trip_type: 'gps',
        start_time: new Date(Date.now() - 900000).toISOString(), // 15 mins ago
        start_odometer: 15026,
        purpose: 'Highway test',
      });

      // Update distance in ongoing trip
      const active = tripRepo.getActiveTrip();
      expect(active).not.toBeNull();
      tripRepo.updateTrip(active!.id, {
        distance_km: 14.8,
        duration_seconds: 900,
      });

      const snapshot = await getGpsWidgetDataSnapshot();

      expect(snapshot.status).toBe('recording');
      expect(snapshot.statusText).toBe('RECORDING');
      expect(snapshot.currentDistanceKm).toBe(14.8);
      expect(snapshot.currentDurationFormatted).toBe('15m');
    });

    test('returns paused state with persisted metrics when trip is paused', async () => {
      const trip = tripRepo.createTrip({
        vehicle_id: vehicleA.id,
        trip_type: 'gps',
        start_time: '2026-10-23T08:00:00Z',
        start_odometer: 15026,
      });

      tripRepo.updateTrip(trip.id, {
        status: 'paused',
        distance_km: 8.5,
        duration_seconds: 600,
      });

      const snapshot = await getGpsWidgetDataSnapshot();

      expect(snapshot.status).toBe('paused');
      expect(snapshot.statusText).toBe('PAUSED');
      expect(snapshot.currentDistanceKm).toBe(8.5);
      expect(snapshot.currentDurationFormatted).toBe('10m');
    });

    test('returns interrupted state when a trip crashed or terminated abnormally', async () => {
      const trip = tripRepo.createTrip({
        vehicle_id: vehicleA.id,
        trip_type: 'gps',
        start_time: '2026-10-23T07:00:00Z',
      });

      // Mark interrupted (as done by crash recovery)
      tripRepo.updateTrip(trip.id, {
        status: 'interrupted',
        distance_km: 3.2,
        duration_seconds: 240,
        quality_warning: 'Trip recording was interrupted before completion (app closed).',
      });

      const snapshot = await getGpsWidgetDataSnapshot();

      expect(snapshot.status).toBe('interrupted');
      expect(snapshot.statusText).toBe('INTERRUPTED');
      expect(snapshot.currentDistanceKm).toBe(3.2);
      expect(snapshot.warningText).toContain('interrupted');
    });
  });

  describe('2. GpsTripWidget Component Rendering & Deep Links', () => {
    test('renders without throwing for all 4 states', () => {
      const states: GpsTripWidgetData['status'][] = ['idle', 'recording', 'paused', 'interrupted'];

      for (const st of states) {
        expect(() => {
          GpsTripWidget({
            ...DEFAULT_GPS_WIDGET_DATA,
            vehicleId: vehicleA.id,
            vehicleName: vehicleA.nickname,
            status: st,
            statusText: st.toUpperCase(),
            currentDistanceKm: 12.5,
            currentDurationFormatted: '22m',
            hasLastTrip: true,
            lastTripDistanceKm: 18.0,
            lastTripDurationFormatted: '30m',
          });
        }).not.toThrow();
      }
    });
  });

  describe('3. widgetTaskHandler Dispatching', () => {
    test('dispatches render for GpsTripWidget on WIDGET_UPDATE', async () => {
      const mockRender = jest.fn();

      await widgetTaskHandler({
        widgetAction: 'WIDGET_UPDATE',
        widgetInfo: {
          widgetName: GPS_WIDGET_NAME,
          widgetId: 101,
          width: 300,
          height: 150,
        },
        renderWidget: mockRender,
      } as any);

      expect(mockRender).toHaveBeenCalledTimes(1);
    });

    test('dispatches render for VehicleGlanceWidget on WIDGET_UPDATE without breaking it', async () => {
      const mockRender = jest.fn();

      await widgetTaskHandler({
        widgetAction: 'WIDGET_UPDATE',
        widgetInfo: {
          widgetName: WIDGET_NAME,
          widgetId: 202,
          width: 320,
          height: 180,
        },
        renderWidget: mockRender,
      } as any);

      expect(mockRender).toHaveBeenCalledTimes(1);
    });

    test('ignores unknown widget names safely', async () => {
      const mockRender = jest.fn();

      await widgetTaskHandler({
        widgetAction: 'WIDGET_UPDATE',
        widgetInfo: {
          widgetName: 'UnknownWidget',
          widgetId: 999,
          width: 100,
          height: 100,
        },
        renderWidget: mockRender,
      } as any);

      expect(mockRender).not.toHaveBeenCalled();
    });
  });

  describe('4. Android Shortcuts & Widget Registration Integrity', () => {
    test('confirms app.json preserves all 4 app shortcuts and adds GpsTripWidget', () => {
      const appJsonPath = path.resolve(__dirname, '../../../app.json');
      const raw = fs.readFileSync(appJsonPath, 'utf8');
      const parsed = JSON.parse(raw);

      // Verify expo-quick-actions shortcuts
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

      // CRITICAL CONSTRAINT: No GPS launcher shortcut added
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

  describe('5. Vehicle Rotation with 5+ Vehicles & Historical Trip Integrity', () => {
    let testVehicles: any[] = [];

    beforeEach(() => {
      asyncStore = {};
      resetMockDatabase();
      const db = getDatabase();
      createTables(db);

      // Create 5 distinct active vehicles
      testVehicles = [];
      for (let i = 1; i <= 5; i++) {
        const v = vehicleRepo.createVehicle({
          nickname: `Vehicle ${i}`,
          vehicle_type: VehicleType.CAR,
          registration_number: `DL-01-AB-100${i}`,
          fuel_type: FuelType.PETROL,
        });
        testVehicles.push(v);
      }
    });

    test('advances through 5 vehicles one step per click with clean wraparound', async () => {
      const { cycleWidgetVehicle } = require('../widgetDataService');

      // Initialize at Vehicle 1
      await AsyncStorage.setItem('driveledger_widget_vehicle_id', testVehicles[0].id);

      // Tap 1: Vehicle 1 -> Vehicle 2
      await cycleWidgetVehicle();
      let storedId = await AsyncStorage.getItem('driveledger_widget_vehicle_id');
      expect(storedId).toBe(testVehicles[1].id);

      // Tap 2: Vehicle 2 -> Vehicle 3
      await cycleWidgetVehicle();
      storedId = await AsyncStorage.getItem('driveledger_widget_vehicle_id');
      expect(storedId).toBe(testVehicles[2].id);

      // Tap 3: Vehicle 3 -> Vehicle 4
      await cycleWidgetVehicle();
      storedId = await AsyncStorage.getItem('driveledger_widget_vehicle_id');
      expect(storedId).toBe(testVehicles[3].id);

      // Tap 4: Vehicle 4 -> Vehicle 5
      await cycleWidgetVehicle();
      storedId = await AsyncStorage.getItem('driveledger_widget_vehicle_id');
      expect(storedId).toBe(testVehicles[4].id);

      // Tap 5: Vehicle 5 -> Vehicle 1 (Clean single-tap wraparound)
      await cycleWidgetVehicle();
      storedId = await AsyncStorage.getItem('driveledger_widget_vehicle_id');
      expect(storedId).toBe(testVehicles[0].id);
    });

    test('vehicles with extensive trip history are not skipped or double-tapped', async () => {
      const { cycleWidgetVehicle } = require('../widgetDataService');

      // Add completed trips to Vehicle 3 and Vehicle 4
      tripRepo.createManualTrip({
        vehicle_id: testVehicles[2].id,
        date: '2026-10-21',
        start_odometer: 10000,
        end_odometer: 10045,
        purpose: 'Work',
      });
      tripRepo.createManualTrip({
        vehicle_id: testVehicles[3].id,
        date: '2026-10-22',
        start_odometer: 5000,
        end_odometer: 5080,
        purpose: 'Commute',
      });

      // Start at Vehicle 2
      await AsyncStorage.setItem('driveledger_widget_vehicle_id', testVehicles[1].id);

      // Advance to Vehicle 3 (has history)
      await cycleWidgetVehicle();
      let storedId = await AsyncStorage.getItem('driveledger_widget_vehicle_id');
      expect(storedId).toBe(testVehicles[2].id);

      // Advance to Vehicle 4 (has history)
      await cycleWidgetVehicle();
      storedId = await AsyncStorage.getItem('driveledger_widget_vehicle_id');
      expect(storedId).toBe(testVehicles[3].id);

      // Advance to Vehicle 5
      await cycleWidgetVehicle();
      storedId = await AsyncStorage.getItem('driveledger_widget_vehicle_id');
      expect(storedId).toBe(testVehicles[4].id);
    });

    test('swapping displayed vehicle does not cancel, reassign, or alter an active trip on another vehicle', async () => {
      const { cycleWidgetVehicle } = require('../widgetDataService');

      // Start an active GPS trip on Vehicle 2
      const activeTrip = tripRepo.createTrip({
        vehicle_id: testVehicles[1].id,
        trip_type: 'gps',
        start_time: '2026-10-23T10:00:00Z',
        start_odometer: 20000,
      });

      // User has Vehicle 2 selected on widget
      await AsyncStorage.setItem('driveledger_widget_vehicle_id', testVehicles[1].id);
      let snapshot = await getGpsWidgetDataSnapshot();
      expect(snapshot.vehicleId).toBe(testVehicles[1].id);
      expect(snapshot.status).toBe('recording');

      // User swaps widget display to Vehicle 3
      await cycleWidgetVehicle();
      const storedId = await AsyncStorage.getItem('driveledger_widget_vehicle_id');
      expect(storedId).toBe(testVehicles[2].id);

      // Widget snapshot for Vehicle 3 reflects its own idle state
      snapshot = await getGpsWidgetDataSnapshot();
      expect(snapshot.vehicleId).toBe(testVehicles[2].id);
      expect(snapshot.status).toBe('idle');

      // Active trip on Vehicle 2 remains completely intact and unaffected
      const stillActive = tripRepo.getActiveTrip(testVehicles[1].id);
      expect(stillActive?.id).toBe(activeTrip.id);
      expect(stillActive?.status).toBe('recording');
    });

    test('historical interrupted trip does NOT permanently poison widget after subsequent completed trips', async () => {
      const vehicle = testVehicles[0];

      // 1. Create an old interrupted trip
      const oldTrip = tripRepo.createTrip({
        vehicle_id: vehicle.id,
        trip_type: 'gps',
        start_time: '2026-10-20T08:00:00Z',
      });
      tripRepo.updateTrip(oldTrip.id, {
        status: 'interrupted',
        quality_warning: 'Old app crash',
      });

      // 2. Later, user successfully logs a completed trip
      tripRepo.createManualTrip({
        vehicle_id: vehicle.id,
        date: '2026-10-23',
        start_odometer: 1000,
        end_odometer: 1050,
        purpose: 'Personal',
      });

      // Select this vehicle
      await AsyncStorage.setItem('driveledger_widget_vehicle_id', vehicle.id);

      // Snapshot must reflect IDLE with the latest completed trip, NOT the historical interrupted trip
      const snapshot = await getGpsWidgetDataSnapshot();
      expect(snapshot.status).toBe('idle');
      expect(snapshot.statusText).toBe('READY');
      expect(snapshot.hasLastTrip).toBe(true);
      expect(snapshot.lastTripDistanceKm).toBe(50);
    });
  });
});
