/**
 * Phase 3 Odometer Reconciliation & Fuel-History Integrity Integration Test Suite
 *
 * Scenarios tested:
 * 1. GPS trip with no refuel: Explicit odometer update sets vehicle odometer, zero fake fuel records.
 * 2. Multiple trips between fuel purchases: Fuel efficiency engine runs full-to-full independently.
 * 3. Odometer baseline unknown: Vehicle with null odometer starts GPS trip without invented baseline.
 * 4. Newer fuel odometer entered while GPS trip is active: Baseline conflict detected.
 * 5. Vehicle odometer manually edited during a trip: Baseline conflict detected.
 * 6. GPS estimate differs from dashboard reading: Editing dashboard reading does not modify GPS distance.
 * 7. Historical manual trip added after a newer reading: Cannot roll canonical odometer backwards.
 * 8. Fuel record edited or deleted after a confirmed trip update: Newer trip odometer reading preserved.
 * 9. Trip deletion does not roll back canonical vehicle odometer.
 */

import { resetMockDatabase } from '@/__mocks__/expo-sqlite';
import { getDatabase } from '@/database/connection';
import { createTables } from '@/database/schema';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import * as fuelRepo from '@/database/repositories/fuelRepo';
import * as tripRepo from '@/database/repositories/tripRepo';
import { useTripStore, _resetActiveSessionForTesting } from '../tripStore';
import { storeRegistry } from '@/stores/storeRegistry';
import { detectBaselineConflict } from '@/engine/odometerReconciliation';
import * as Location from 'expo-location';
import { FuelType, VehicleType, FuelUnit } from '@/constants/fuelTypes';
import type { Vehicle } from '@/types/vehicle';

describe('Phase 3: Odometer Reconciliation & Fuel-History Integrity', () => {
  let vehicle: Vehicle;
  let locationCallback: (location: any) => void;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    _resetActiveSessionForTesting();

    resetMockDatabase();
    const db = getDatabase();
    createTables(db);

    vehicle = vehicleRepo.createVehicle({
      nickname: 'Highway Cruiser',
      vehicle_type: VehicleType.CAR,
      fuel_type: FuelType.PETROL,
      registration_number: 'KA-01-MJ-9999',
      current_odometer: 10000,
    });

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

    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
      granted: true,
    });
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
      granted: true,
    });
    (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
      granted: true,
    });
    (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);

    (Location.watchPositionAsync as jest.Mock).mockImplementation(
      async (_options, callback) => {
        locationCallback = callback;
        return { remove: jest.fn() };
      }
    );
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  test('1. GPS trip with no refuel updates vehicle odometer only on explicit confirmation without creating fuel records', async () => {
    const startResult = await useTripStore.getState().startGpsTrip(vehicle.id);
    expect(startResult.success).toBe(true);

    const activeTrip = useTripStore.getState().activeTrip;
    expect(activeTrip?.start_odometer).toBe(10000);

    // Feed GPS locations (approx 1.11 km)
    locationCallback({
      coords: { latitude: 12.9716, longitude: 77.5946, accuracy: 5, speed: 10, heading: 0, altitude: 900 },
      timestamp: 1000000,
    });
    locationCallback({
      coords: { latitude: 12.9816, longitude: 77.5946, accuracy: 5, speed: 10, heading: 0, altitude: 900 },
      timestamp: 1000000 + 60000,
    });

    // Finish GPS trip WITH explicit vehicle odometer confirmation
    const finished = await useTripStore.getState().finishGpsTrip({
      endOdometer: 10025,
      updateVehicleOdometer: true,
    });

    expect(finished?.status).toBe('completed');
    expect(finished?.end_odometer).toBe(10025);

    // Verify canonical vehicle odometer updated to 10025
    const updatedVehicle = vehicleRepo.getVehicleById(vehicle.id);
    expect(updatedVehicle?.current_odometer).toBe(10025);

    // Zero fuel entries fabricated
    const fuelEntries = fuelRepo.getFuelEntriesByVehicle(vehicle.id);
    expect(fuelEntries).toHaveLength(0);
  });

  test('2. Multiple trips between fuel purchases do not alter full-to-full fuel efficiency engine logic', async () => {
    // Initial fuel entry (Full tank 1 at 10000 km)
    fuelRepo.createFuelEntryAtomic(
      {
        vehicle_id: vehicle.id,
        date: '2026-03-01',
        odometer: 10000,
        fuel_amount: 40,
        fuel_unit: FuelUnit.LITRES,
        price_per_unit: 100,
        is_full_tank: 1,
      },
      FuelType.PETROL,
      VehicleType.CAR
    );

    // Trip 1 (manual: 10000 -> 10150, 150 km)
    useTripStore.getState().addManualTrip({
      vehicle_id: vehicle.id,
      date: '2026-03-05',
      start_odometer: 10000,
      end_odometer: 10150,
      updateVehicleOdometer: true,
    });

    // Trip 2 (manual: 10150 -> 10350, 200 km)
    useTripStore.getState().addManualTrip({
      vehicle_id: vehicle.id,
      date: '2026-03-08',
      start_odometer: 10150,
      end_odometer: 10350,
      updateVehicleOdometer: true,
    });

    expect(vehicleRepo.getVehicleById(vehicle.id)?.current_odometer).toBe(10350);

    // Refuel 2 (Full tank 2 at 10500 km, 25 Litres)
    const { entry: refuel2 } = fuelRepo.createFuelEntryAtomic(
      {
        vehicle_id: vehicle.id,
        date: '2026-03-10',
        odometer: 10500,
        fuel_amount: 25,
        fuel_unit: FuelUnit.LITRES,
        price_per_unit: 100,
        is_full_tank: 1,
      },
      FuelType.PETROL,
      VehicleType.CAR
    );

    // Delta km = 10500 - 10000 = 500 km.
    // Mileage = 500 km / 25 L = 20.0 km/L.
    expect(refuel2.calculated_mileage).toBe(20);
    expect(vehicleRepo.getVehicleById(vehicle.id)?.current_odometer).toBe(10500);
  });

  test('3. Unknown odometer baseline allows GPS trip without inventing a start value', async () => {
    // Create vehicle with unknown odometer (null)
    const vehicleNullOdo = vehicleRepo.createVehicle({
      nickname: 'Vintage Scooter',
      vehicle_type: VehicleType.TWO_WHEELER,
      fuel_type: FuelType.PETROL,
      registration_number: 'DL-01-AA-0001',
    });

    await useTripStore.getState().startGpsTrip(vehicleNullOdo.id);

    const activeTrip = useTripStore.getState().activeTrip;
    expect(activeTrip?.start_odometer).toBeNull(); // No invented value!

    // Finish without end odometer
    const finished = await useTripStore.getState().finishGpsTrip({
      notes: 'No dashboard odometer available',
    });

    expect(finished?.start_odometer).toBeNull();
    expect(finished?.end_odometer).toBeNull();

    // Vehicle odometer remains null
    expect(vehicleRepo.getVehicleById(vehicleNullOdo.id)?.current_odometer).toBeNull();
  });

  test('4. Detects baseline conflict when fuel entry is recorded while GPS trip is active', async () => {
    // Trip starts at baseline 10000 km
    await useTripStore.getState().startGpsTrip(vehicle.id);
    const active = useTripStore.getState().activeTrip;
    expect(active?.start_odometer).toBe(10000);

    // While GPS is recording, user adds an intermediate fuel entry at 10080 km
    fuelRepo.createFuelEntryAtomic(
      {
        vehicle_id: vehicle.id,
        date: '2026-03-15',
        odometer: 10080,
        fuel_amount: 15,
        fuel_unit: FuelUnit.LITRES,
        price_per_unit: 100,
        is_full_tank: 0,
      },
      FuelType.PETROL,
      VehicleType.CAR
    );

    const refreshedVehicle = vehicleRepo.getVehicleById(vehicle.id);
    expect(refreshedVehicle?.current_odometer).toBe(10080);

    // Baseline conflict check
    const conflict = detectBaselineConflict(
      active?.start_odometer,
      refreshedVehicle?.current_odometer,
      25 // 25 km trip
    );

    expect(conflict.hasConflict).toBe(true);
    expect(conflict.reason).toContain('Vehicle odometer changed from 10000 km to 10080 km');

    await useTripStore.getState().cancelGpsTrip();
  });

  test('5. Detects baseline conflict when vehicle odometer is manually edited during trip', async () => {
    await useTripStore.getState().startGpsTrip(vehicle.id);
    const active = useTripStore.getState().activeTrip;

    // User edits vehicle in settings
    vehicleRepo.updateVehicle(vehicle.id, { current_odometer: 10200 });
    const currentVehicle = vehicleRepo.getVehicleById(vehicle.id);

    const conflict = detectBaselineConflict(
      active?.start_odometer,
      currentVehicle?.current_odometer,
      15
    );

    expect(conflict.hasConflict).toBe(true);
    expect(conflict.reason).toContain('Vehicle odometer changed from 10000 km to 10200 km');

    await useTripStore.getState().cancelGpsTrip();
  });

  test('6. Editing dashboard odometer reading does not alter recorded GPS distance', async () => {
    await useTripStore.getState().startGpsTrip(vehicle.id);

    // Add 2 locations ~1.11 km apart
    locationCallback({
      coords: { latitude: 12.9716, longitude: 77.5946, accuracy: 5, speed: 10, heading: 0, altitude: 900 },
      timestamp: 1000000,
    });
    locationCallback({
      coords: { latitude: 12.9816, longitude: 77.5946, accuracy: 5, speed: 10, heading: 0, altitude: 900 },
      timestamp: 1000000 + 60000,
    });

    // Proposed end reading from user is 10050 (e.g. user took a detour before GPS started)
    const finalized = await useTripStore.getState().finishGpsTrip({
      endOdometer: 10050,
      updateVehicleOdometer: true,
    });

    // The recorded GPS distance is still 1.11 km, NOT (10050 - 10000 = 50 km)!
    expect(finalized?.distance_km).toBe(1.11);
    expect(finalized?.end_odometer).toBe(10050);

    // Canonical vehicle odometer is updated to 10050
    expect(vehicleRepo.getVehicleById(vehicle.id)?.current_odometer).toBe(10050);
  });

  test('7. Historical manual trip added after a newer reading cannot move canonical odometer backwards', () => {
    // Current vehicle odometer is 20000 km
    vehicleRepo.updateVehicle(vehicle.id, { current_odometer: 20000 });

    // User logs an older trip from last week: 18000 -> 18150 km
    const trip = useTripStore.getState().addManualTrip({
      vehicle_id: vehicle.id,
      date: '2026-03-01',
      start_odometer: 18000,
      end_odometer: 18150,
      updateVehicleOdometer: true, // User requested update, but rule must protect canonical
    });

    expect(trip.distance_km).toBe(150);
    expect(trip.end_odometer).toBe(18150);

    // Canonical vehicle odometer must REMAIN 20000 km (no rollback!)
    expect(vehicleRepo.getVehicleById(vehicle.id)?.current_odometer).toBe(20000);
  });

  test('8. Fuel entry edited or deleted after a confirmed trip update preserves the newer trip reading', () => {
    // 1. Initial fuel entry at 10000 km
    const { entry: fuel1 } = fuelRepo.createFuelEntryAtomic(
      {
        vehicle_id: vehicle.id,
        date: '2026-03-01',
        odometer: 10000,
        fuel_amount: 30,
        fuel_unit: FuelUnit.LITRES,
        price_per_unit: 100,
        is_full_tank: 1,
      },
      FuelType.PETROL,
      VehicleType.CAR
    );

    // 2. Confirmed manual trip to 10500 km
    useTripStore.getState().addManualTrip({
      vehicle_id: vehicle.id,
      date: '2026-03-05',
      start_odometer: 10000,
      end_odometer: 10500,
      updateVehicleOdometer: true,
    });
    expect(vehicleRepo.getVehicleById(vehicle.id)?.current_odometer).toBe(10500);

    // 3. Delete fuel1: vehicle odometer must NOT be wiped or rolled back to 0!
    fuelRepo.deleteFuelEntryAtomic(fuel1.id, vehicle.id, FuelType.PETROL);

    const vehicleAfterFuelDelete = vehicleRepo.getVehicleById(vehicle.id);
    expect(vehicleAfterFuelDelete?.current_odometer).toBe(10500);

    // 4. Add another fuel entry at 10800, then delete it: odometer should fall back to trip reading (10500)
    const { entry: fuel2 } = fuelRepo.createFuelEntryAtomic(
      {
        vehicle_id: vehicle.id,
        date: '2026-03-10',
        odometer: 10800,
        fuel_amount: 35,
        fuel_unit: FuelUnit.LITRES,
        price_per_unit: 100,
        is_full_tank: 1,
      },
      FuelType.PETROL,
      VehicleType.CAR
    );
    expect(vehicleRepo.getVehicleById(vehicle.id)?.current_odometer).toBe(10800);

    fuelRepo.deleteFuelEntryAtomic(fuel2.id, vehicle.id, FuelType.PETROL);
    const vehicleAfterFuel2Delete = vehicleRepo.getVehicleById(vehicle.id);
    expect(vehicleAfterFuel2Delete?.current_odometer).toBe(10500); // Preserved trip reading!
  });

  test('9. Deleting a historical trip does not roll back the canonical vehicle odometer', () => {
    const trip = useTripStore.getState().addManualTrip({
      vehicle_id: vehicle.id,
      date: '2026-03-05',
      start_odometer: 10000,
      end_odometer: 10400,
      updateVehicleOdometer: true,
    });

    expect(vehicleRepo.getVehicleById(vehicle.id)?.current_odometer).toBe(10400);

    // Delete the trip
    useTripStore.getState().deleteTrip(trip.id, vehicle.id);

    // Vehicle canonical odometer is not automatically rolled back
    expect(vehicleRepo.getVehicleById(vehicle.id)?.current_odometer).toBe(10400);
  });
});
