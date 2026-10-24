import AsyncStorage from '@react-native-async-storage/async-storage';
import { resetMockDatabase } from '@/__mocks__/expo-sqlite';
import { getDatabase } from '@/database/connection';
import { createTables } from '@/database/schema';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import * as tripRepo from '@/database/repositories/tripRepo';
import { FuelType, VehicleType } from '@/constants/fuelTypes';
import {
  getGpsWidgetDataSnapshot,
  getCachedGpsWidgetData,
  syncGpsWidgetState,
  GPS_WIDGET_NAME,
  GPS_WIDGET_STORAGE_KEY,
  DEFAULT_GPS_WIDGET_DATA,
} from '../widgetDataService';
import { requestWidgetUpdate } from 'react-native-android-widget';

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

describe('WidgetDataService GPS Widget Snapshot & Sync Suite', () => {
  beforeEach(() => {
    resetMockDatabase();
    const db = getDatabase();
    createTables(db);
    asyncStore = {};
    jest.clearAllMocks();
  });

  it('returns default data when no vehicles are configured in database', async () => {
    const snapshot = await getGpsWidgetDataSnapshot();
    expect(snapshot).toEqual(DEFAULT_GPS_WIDGET_DATA);
  });

  it('builds idle snapshot with vehicle odometer and last trip when no active trip', async () => {
    const vehicle = vehicleRepo.createVehicle({
      nickname: 'Hyundai Verna',
      vehicle_type: VehicleType.CAR,
      fuel_type: FuelType.PETROL,
      registration_number: 'DL01XY1234',
      current_odometer: 15400,
    });

    // Create a past trip
    const pastTrip = tripRepo.createTrip({
      vehicle_id: vehicle.id,
      trip_type: 'gps',
      start_odometer: 15300,
    });
    tripRepo.finalizeTrip(pastTrip.id, {
      distance_km: 24.5,
      duration_seconds: 1800,
    });

    const snapshot = await getGpsWidgetDataSnapshot();

    expect(snapshot.recordingState).toBe('idle');
    expect(snapshot.vehicleId).toBe(vehicle.id);
    expect(snapshot.vehicleName).toBe('Hyundai Verna');
    expect(snapshot.regNumber).toBe('DL01XY1234');
    expect(snapshot.currentOdometer).toBe(15400);
    expect(snapshot.lastTripDistanceKm).toBe(24.5);
    expect(snapshot.lastTripDuration).toBe('30m');
  });

  it('builds active recording snapshot when a GPS trip is in progress', async () => {
    const vehicle = vehicleRepo.createVehicle({
      nickname: 'Honda City VTEC',
      vehicle_type: VehicleType.CAR,
      fuel_type: FuelType.PETROL,
      registration_number: 'KA03MN4567',
      current_odometer: 48000,
    });

    const activeTrip = tripRepo.createTrip({
      vehicle_id: vehicle.id,
      trip_type: 'gps',
      start_odometer: 48000,
      start_time: new Date(Date.now() - 600000).toISOString(), // 10 mins ago
    });

    tripRepo.updateTrip(activeTrip.id, {
      distance_km: 8.75,
      sample_count: 142,
    });

    // Add accepted location samples
    tripRepo.addTripLocations(activeTrip.id, [
      {
        latitude: 12.9716,
        longitude: 77.5946,
        speed: 15.0, // 15 m/s = 54 km/h
        accuracy: 10,
        timestamp: Date.now(),
        isAccepted: true,
        stepDistanceMeters: 50,
      },
    ]);

    const snapshot = await getGpsWidgetDataSnapshot();

    expect(snapshot.recordingState).toBe('recording');
    expect(snapshot.vehicleId).toBe(vehicle.id);
    expect(snapshot.distanceKm).toBe(8.75);
    expect(snapshot.speedKmh).toBe(54);
    expect(snapshot.gpsQuality).toBe('good');
    expect(snapshot.sampleCount).toBe(143);
    expect(snapshot.elapsedSeconds).toBeGreaterThanOrEqual(600);
  });

  it('builds paused snapshot with 0 km/h speed when trip is paused', async () => {
    const vehicle = vehicleRepo.createVehicle({
      nickname: 'Tata Safari',
      vehicle_type: VehicleType.CAR,
      fuel_type: FuelType.DIESEL,
      registration_number: 'MH12AB5555',
      current_odometer: 62000,
    });

    const activeTrip = tripRepo.createTrip({
      vehicle_id: vehicle.id,
      trip_type: 'gps',
      start_odometer: 62000,
    });

    tripRepo.updateTrip(activeTrip.id, {
      status: 'paused',
      distance_km: 19.3,
      sample_count: 310,
    });

    const snapshot = await getGpsWidgetDataSnapshot();

    expect(snapshot.recordingState).toBe('paused');
    expect(snapshot.speedKmh).toBe(0);
    expect(snapshot.distanceKm).toBe(19.3);
  });

  it('getCachedGpsWidgetData falls back to default if cache is empty', async () => {
    const cached = await getCachedGpsWidgetData();
    expect(cached).toEqual(DEFAULT_GPS_WIDGET_DATA);
  });

  it('syncGpsWidgetState persists snapshot to AsyncStorage and requests widget update on Android', async () => {
    vehicleRepo.createVehicle({
      nickname: 'Suzuki Swift',
      vehicle_type: VehicleType.CAR,
      fuel_type: FuelType.PETROL,
      registration_number: 'DL08PQ1111',
      current_odometer: 32000,
    });

    await syncGpsWidgetState();

    const cachedRaw = await AsyncStorage.getItem(GPS_WIDGET_STORAGE_KEY);
    expect(cachedRaw).toBeTruthy();
    const parsed = JSON.parse(cachedRaw!);
    expect(parsed.vehicleName).toBe('Suzuki Swift');

    expect(requestWidgetUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        widgetName: GPS_WIDGET_NAME,
      })
    );
  });
});
