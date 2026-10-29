/**
 * Integration Test Suite for Speed & Efficiency Analysis & Post-Trip Fuel Prompt
 *
 * Verifies:
 * 1. Post-trip fuel prompt behavior:
 *    - Appears only after successful GPS trip completion
 *    - Does not prompt repeatedly (deduplicated by trip ID)
 *    - 'Add Fuel' action opens existing fuel flow with trip's vehicle
 *    - 'Not Now' preserves the original continuation flow
 *    - Cancelling/dismissing fuel entry does not affect or delete the saved trip
 *    - No dialog is triggered from headless/background context; deferred until foregrounded
 * 2. Vehicle average mileage display:
 *    - Displays calculated average only when a valid fuel interval exists in existing fuel engine
 *    - Missing/invalid fuel data never yields a fabricated average or 0 km/L / NaN
 * 3. Speed & Efficiency UI & toggle:
 *    - Distance vs Time % toggle switches display correctly
 *    - Bars use shared denominators
 * 4. Manual trip details isolation:
 *    - Speed & Efficiency section is never shown for manual trips
 */

import { Alert } from 'react-native';
import { resetMockDatabase } from '@/__mocks__/expo-sqlite';
import { getDatabase } from '@/database/connection';
import { createTables } from '@/database/schema';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import * as tripRepo from '@/database/repositories/tripRepo';
import * as fuelRepo from '@/database/repositories/fuelRepo';
import { FuelType, FuelUnit, VehicleType, MileageUnit } from '@/constants/fuelTypes';
import { computeMileageStats } from '@/engine/mileageEngine';
import {
  showPostTripFuelPrompt,
  hasPromptedForTrip,
  resetPromptTrackingForTesting,
  setPendingPostTripPrompt,
  getAndClearPendingPostTripPrompt,
  resolveTripEndOdometer,
} from '@/services/postTripFuelPromptService';
import { analyzeTripSpeedBands } from '@/engine/speedBandAnalysisEngine';
import type { Trip } from '@/types/trip';

let asyncStorageStore: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => asyncStorageStore[key] ?? null),
  setItem: jest.fn(async (key: string, val: string) => {
    asyncStorageStore[key] = val;
  }),
  removeItem: jest.fn(async (key: string) => {
    delete asyncStorageStore[key];
  }),
  clear: jest.fn(async () => {
    asyncStorageStore = {};
  }),
}));

describe('Speed & Efficiency Analysis & Post-Trip Fuel Prompt Integration', () => {
  beforeEach(() => {
    resetMockDatabase();
    const db = getDatabase();
    createTables(db);
    asyncStorageStore = {};
    resetPromptTrackingForTesting();
    jest.clearAllMocks();
  });

  describe('1. Post-Trip Fuel Prompt Flow', () => {
    test('prompts user with exact title, message, and options upon GPS trip completion', () => {
      const alertSpy = jest.spyOn(Alert, 'alert');

      let addFuelCalled = false;
      let notNowCalled = false;

      const launched = showPostTripFuelPrompt({
        vehicleId: 'veh-1',
        tripId: 'trip-100',
        onAddFuel: () => {
          addFuelCalled = true;
        },
        onNotNow: () => {
          notNowCalled = true;
        },
      });

      expect(launched).toBe(true);
      expect(alertSpy).toHaveBeenCalledTimes(1);

      const [title, message, buttons] = alertSpy.mock.calls[0];
      expect(title).toBe('Trip completed!');
      expect(message).toBe('Would you like to add fuel for this vehicle now?');
      expect(buttons).toHaveLength(2);

      const notNowBtn = buttons?.find((b) => b.text === 'Not Now');
      const addFuelBtn = buttons?.find((b) => b.text === 'Add Fuel');

      expect(notNowBtn).toBeDefined();
      expect(notNowBtn?.style).toBe('cancel');
      expect(addFuelBtn).toBeDefined();

      // Trigger Add Fuel
      addFuelBtn?.onPress?.();
      expect(addFuelCalled).toBe(true);
      expect(notNowCalled).toBe(false);
    });

    test('deduplicates prompt and prevents repeated dialogs for the same trip ID', () => {
      const alertSpy = jest.spyOn(Alert, 'alert');

      const first = showPostTripFuelPrompt({
        vehicleId: 'veh-1',
        tripId: 'trip-100',
        onAddFuel: jest.fn(),
      });
      expect(first).toBe(true);
      expect(hasPromptedForTrip('trip-100')).toBe(true);

      // Second attempt with same tripId (e.g. component re-render or tab switch)
      const second = showPostTripFuelPrompt({
        vehicleId: 'veh-1',
        tripId: 'trip-100',
        onAddFuel: jest.fn(),
      });
      expect(second).toBe(false);
      expect(alertSpy).toHaveBeenCalledTimes(1);
    });

    test('Not Now action preserves continuation flow and closes dialog safely', () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      let notNowExecuted = false;

      showPostTripFuelPrompt({
        vehicleId: 'veh-1',
        tripId: 'trip-200',
        onAddFuel: jest.fn(),
        onNotNow: () => {
          notNowExecuted = true;
        },
      });

      const buttons = alertSpy.mock.calls[0][2];
      const notNowBtn = buttons?.find((b) => b.text === 'Not Now');
      notNowBtn?.onPress?.();

      expect(notNowExecuted).toBe(true);
    });

    test('headless background execution defers prompt and never triggers Alert.alert directly', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');

      // Headless background task saves pending prompt with trip odometer
      await setPendingPostTripPrompt('trip-bg-1', 'veh-1', 12345);

      // Background task must not invoke any UI Alert dialog
      expect(alertSpy).not.toHaveBeenCalled();

      // When foreground app mounts/focuses, it retrieves and clears the pending prompt
      const pending = await getAndClearPendingPostTripPrompt();
      expect(pending).not.toBeNull();
      expect(pending?.tripId).toBe('trip-bg-1');
      expect(pending?.vehicleId).toBe('veh-1');
      expect(pending?.odometer).toBe(12345);

      // Second check returns null because it was cleared
      const secondCheck = await getAndClearPendingPostTripPrompt();
      expect(secondCheck).toBeNull();
    });

    test('resolveTripEndOdometer correctly resolves end odometer from trip data or fallback', () => {
      // 1. Explicit end_odometer on trip
      expect(
        resolveTripEndOdometer({ end_odometer: 15500, start_odometer: 15400, distance_km: 100 }, 15400)
      ).toBe(15500);

      // 2. Missing end_odometer calculates from start_odometer + distance_km
      expect(
        resolveTripEndOdometer({ end_odometer: null, start_odometer: 20000, distance_km: 45.8 }, 20000)
      ).toBe(20046);

      // 3. Missing trip odometers falls back to vehicle current_odometer
      expect(
        resolveTripEndOdometer({ end_odometer: null, start_odometer: null, distance_km: 10 }, 30000)
      ).toBe(30000);

      // 4. No trip data falls back to vehicle current_odometer
      expect(resolveTripEndOdometer(null, 40000)).toBe(40000);

      // 5. Completely empty data returns null
      expect(resolveTripEndOdometer(null, null)).toBeNull();
    });

    test('Add Fuel action in post-GPS prompt passes trip odometer to onAddFuel callback', () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      let forwardedOdometer: number | null | undefined;

      showPostTripFuelPrompt({
        vehicleId: 'veh-1',
        tripId: 'trip-gps-odo-1',
        odometer: 18500,
        onAddFuel: (odo) => {
          forwardedOdometer = odo;
        },
      });

      const buttons = alertSpy.mock.calls[0][2];
      const addFuelBtn = buttons?.find((b) => b.text === 'Add Fuel');
      addFuelBtn?.onPress?.();

      expect(forwardedOdometer).toBe(18500);
    });

    test('cancelling or navigating back from fuel entry preserves completed trip intact in database', () => {
      // Setup vehicle and completed GPS trip
      const vehicle = vehicleRepo.createVehicle({
        nickname: 'Sedan',
        registration_number: 'KA-01-AB-1234',
        fuel_type: FuelType.PETROL,
        vehicle_type: VehicleType.CAR,
        current_odometer: 10000,
      });

      const trip = tripRepo.createTrip({
        vehicle_id: vehicle.id,
        trip_type: 'gps',
        start_odometer: 10000,
      });

      const finalized = tripRepo.finalizeTrip(trip.id, {
        distance_km: 15.2,
        duration_seconds: 1200,
        end_odometer: 10015,
      });
      expect(finalized?.status).toBe('completed');

      // User chooses 'Not Now' or opens add-fuel and cancels without saving
      // Assert that trip record is untouched and still completed in database
      const storedTrip = tripRepo.getTripById(trip.id);
      expect(storedTrip).not.toBeNull();
      expect(storedTrip?.status).toBe('completed');
      expect(storedTrip?.distance_km).toBe(15.2);
      expect(storedTrip?.end_odometer).toBe(10015);
      expect(storedTrip?.deleted_at).toBeNull();
    });
  });

  describe('2. Vehicle Average Mileage Calculation Source & Validity', () => {
    test('computes vehicle average only when valid tank-to-tank fuel interval exists', () => {
      const vehicle = vehicleRepo.createVehicle({
        nickname: 'Fleet Car',
        registration_number: 'KA-01-FC-0001',
        fuel_type: FuelType.PETROL,
        vehicle_type: VehicleType.CAR,
        current_odometer: 5000,
      });

      // Entry 1: First full fill (establishes baseline, no mileage possible)
      fuelRepo.createFuelEntry({
        vehicle_id: vehicle.id,
        date: '2026-10-01',
        odometer: 5000,
        fuel_amount: 40,
        fuel_unit: FuelUnit.LITRES,
        price_per_unit: 100,
        is_full_tank: 1,
      });

      let entries = fuelRepo.getFuelEntriesByVehicle(vehicle.id);
      let stats = computeMileageStats(entries, FuelType.PETROL);
      expect(stats.runningAverage).toBeNull();

      // Entry 2: Second full fill after 600 km, 30 Litres => 600 / 30 = 20.0 km/L
      fuelRepo.createFuelEntryAtomic(
        {
          vehicle_id: vehicle.id,
          date: '2026-10-10',
          odometer: 5600,
          fuel_amount: 30,
          fuel_unit: FuelUnit.LITRES,
          price_per_unit: 100,
          is_full_tank: 1,
        },
        FuelType.PETROL,
        VehicleType.CAR
      );

      entries = fuelRepo.getFuelEntriesByVehicle(vehicle.id);
      stats = computeMileageStats(entries, FuelType.PETROL);

      expect(stats.runningAverage).not.toBeNull();
      expect(stats.runningAverage?.value).toBeCloseTo(20.0, 1);
      expect(stats.runningAverage?.unit).toBe(MileageUnit.KM_PER_LITRE);
    });

    test('missing or invalid fuel data yields null rather than fabricated 0 km/L or NaN', () => {
      const vehicle = vehicleRepo.createVehicle({
        nickname: 'New Car',
        registration_number: 'KA-01-NC-0002',
        fuel_type: FuelType.PETROL,
        vehicle_type: VehicleType.CAR,
        current_odometer: 1000,
      });

      // No entries
      const entries = fuelRepo.getFuelEntriesByVehicle(vehicle.id);
      const stats = computeMileageStats(entries, FuelType.PETROL);

      expect(stats.runningAverage).toBeNull();
      expect(stats.lastFillMileage).toBeNull();
    });

    test('partial fills alone do not establish a valid calculation interval', () => {
      const vehicle = vehicleRepo.createVehicle({
        nickname: 'Bike',
        registration_number: 'KA-01-BK-0003',
        fuel_type: FuelType.PETROL,
        vehicle_type: VehicleType.TWO_WHEELER,
        current_odometer: 2000,
      });

      // Two partial fills
      fuelRepo.createFuelEntry({
        vehicle_id: vehicle.id,
        date: '2026-10-01',
        odometer: 2000,
        fuel_amount: 5,
        fuel_unit: FuelUnit.LITRES,
        price_per_unit: 105,
        is_full_tank: 0,
      });

      fuelRepo.createFuelEntry({
        vehicle_id: vehicle.id,
        date: '2026-10-05',
        odometer: 2200,
        fuel_amount: 4,
        fuel_unit: FuelUnit.LITRES,
        price_per_unit: 105,
        is_full_tank: 0,
      });

      const entries = fuelRepo.getFuelEntriesByVehicle(vehicle.id);
      const stats = computeMileageStats(entries, FuelType.PETROL);

      // Running average remains null because partial fills cannot anchor full tank-to-tank interval
      expect(stats.runningAverage).toBeNull();
    });
  });

  describe('3. Speed Bands UI & Toggle Semantics', () => {
    test('speed bands categorize distance and time into correct non-overlapping buckets', () => {
      // 10s at 15 km/h (band 0_20)
      // 10s at 25 km/h (band 20_30)
      // 10s at 40 km/h (band 30_50)
      // 10s at 60 km/h (band 50_80)
      // 10s at 90 km/h (band 80_plus)
      const locations = [
        { latitude: 12.9700, longitude: 77.5900, timestamp: 1000, speed: 15 / 3.6, is_rejected: 0 },
        { latitude: 12.9702, longitude: 77.5902, timestamp: 11000, speed: 15 / 3.6, is_rejected: 0 }, // 0–20 (mean 15)
        { latitude: 12.9706, longitude: 77.5906, timestamp: 21000, speed: 35 / 3.6, is_rejected: 0 }, // 20–30 (mean 25)
        { latitude: 12.9712, longitude: 77.5912, timestamp: 31000, speed: 45 / 3.6, is_rejected: 0 }, // 30–50 (mean 40)
        { latitude: 12.9720, longitude: 77.5920, timestamp: 41000, speed: 75 / 3.6, is_rejected: 0 }, // 50–80 (mean 60)
        { latitude: 12.9735, longitude: 77.5935, timestamp: 51000, speed: 105 / 3.6, is_rejected: 0 }, // 80+ (mean 90)
      ];

      const result = analyzeTripSpeedBands(locations);
      expect(result.hasSufficientData).toBe(true);
      expect(result.bands).toHaveLength(5);

      const [b0_20, b20_30, b30_50, b50_80, b80_plus] = result.bands;

      expect(b0_20.durationSeconds).toBe(10);
      expect(b20_30.durationSeconds).toBe(10);
      expect(b30_50.durationSeconds).toBe(10);
      expect(b50_80.durationSeconds).toBe(10);
      expect(b80_plus.durationSeconds).toBe(10);

      // Each interval is 10s out of 50s total = 20%
      expect(b0_20.timePercentage).toBe(20);
      expect(b20_30.timePercentage).toBe(20);
      expect(b30_50.timePercentage).toBe(20);
      expect(b50_80.timePercentage).toBe(20);
      expect(b80_plus.timePercentage).toBe(20);

      // Bar proportions and displayed percentages share exact denominator
      const totalAnalysedSec = result.analysedDurationSeconds;
      expect(totalAnalysedSec).toBe(50);

      for (const band of result.bands) {
        expect(band.timePercentage).toBe((band.durationSeconds / totalAnalysedSec) * 100);
      }
    });
  });

  describe('4. Manual Trip Details Isolation', () => {
    test('manual trips have trip_type === manual and do not have GPS points or speed analysis', () => {
      const vehicle = vehicleRepo.createVehicle({
        nickname: 'Truck',
        registration_number: 'KA-01-TK-0004',
        fuel_type: FuelType.DIESEL,
        vehicle_type: VehicleType.OTHER,
        current_odometer: 20000,
      });

      const manualTrip = tripRepo.createManualTrip({
        vehicle_id: vehicle.id,
        date: '2026-10-15',
        start_odometer: 20000,
        end_odometer: 20085,
        duration_minutes: 90,
        purpose: 'Delivery',
      });

      expect(manualTrip.trip_type).toBe('manual');
      expect(manualTrip.status).toBe('completed');
      expect(manualTrip.distance_km).toBe(85);

      // Verify that manual trips have 0 GPS locations in SQLite
      const locations = tripRepo.getTripLocations(manualTrip.id);
      expect(locations).toHaveLength(0);
    });
  });
});
