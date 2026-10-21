/**
 * Maintenance Profile Repository Test Suite
 *
 * Verifies SQLite CRUD operations and due-status evaluation for vehicle-specific
 * maintenance targets (`maintenance_profiles` table).
 */

import { getDatabase } from '@/database/connection';
import { createTables } from '@/database/schema';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import * as profileRepo from '../maintenanceProfileRepo';
import { FuelType, VehicleType } from '@/constants/fuelTypes';
import { resetMockDatabase } from '@/__mocks__/expo-sqlite';
import type { Vehicle } from '@/types/vehicle';

describe('MaintenanceProfile Repository', () => {
  let db: any;
  let testVehicle: Vehicle;

  beforeEach(() => {
    resetMockDatabase();
    db = getDatabase();
    createTables(db);

    testVehicle = vehicleRepo.createVehicle({
      nickname: 'Highway Cruiser',
      vehicle_type: VehicleType.CAR,
      fuel_type: FuelType.DIESEL,
      registration_number: 'KA-01-AB-9999',
      current_odometer: 40000,
    });
  });

  test('creates and retrieves maintenance profiles for a vehicle', () => {
    const p1 = profileRepo.createMaintenanceProfile({
      vehicle_id: testVehicle.id,
      component_name: 'Engine Oil & Filter',
      interval_km: 10000,
      interval_months: 6,
      notes: 'Fully synthetic 5W-40',
    });

    const p2 = profileRepo.createMaintenanceProfile({
      vehicle_id: testVehicle.id,
      component_name: 'Brake Pads',
      interval_km: 30000,
    });

    const list = profileRepo.getMaintenanceProfilesByVehicle(testVehicle.id);
    expect(list.length).toBe(2);
    expect(list.map((p) => p.component_name)).toContain('Engine Oil & Filter');
    expect(list.map((p) => p.component_name)).toContain('Brake Pads');

    const fetched = profileRepo.getMaintenanceProfileById(p1.id);
    expect(fetched?.notes).toBe('Fully synthetic 5W-40');
  });

  test('updates an existing maintenance profile', () => {
    const profile = profileRepo.createMaintenanceProfile({
      vehicle_id: testVehicle.id,
      component_name: 'Tyre Rotation',
      interval_km: 10000,
    });

    const updated = profileRepo.updateMaintenanceProfile(profile.id, {
      interval_km: 8000,
      notes: 'Every 8,000 km for front-wheel drive',
    });

    expect(updated?.interval_km).toBe(8000);
    expect(updated?.notes).toContain('front-wheel drive');
  });

  test('soft deletes a maintenance profile', () => {
    const profile = profileRepo.createMaintenanceProfile({
      vehicle_id: testVehicle.id,
      component_name: 'Spark Plugs',
      interval_km: 40000,
    });

    profileRepo.softDeleteMaintenanceProfile(profile.id);

    const list = profileRepo.getMaintenanceProfilesByVehicle(testVehicle.id);
    expect(list.find((p) => p.id === profile.id)).toBeUndefined();

    const byId = profileRepo.getMaintenanceProfileById(profile.id);
    expect(byId).toBeNull();
  });

  test('computeProfileDueStatus computes overdue status correctly when odometer target exceeded', () => {
    const profile = profileRepo.createMaintenanceProfile({
      vehicle_id: testVehicle.id,
      component_name: 'Engine Oil',
      target_odometer: 38000, // Current vehicle odo is 40000 -> 2,000 km overdue
    });

    const status = profileRepo.computeProfileDueStatus(profile, testVehicle);
    expect(status.status).toBe('overdue');
    expect(status.kmRemaining).toBe(-2000);
    expect(status.headline).toContain('Overdue');
  });

  test('computeProfileDueStatus computes due_soon status when target is within 1,000 km', () => {
    const profile = profileRepo.createMaintenanceProfile({
      vehicle_id: testVehicle.id,
      component_name: 'Brake Inspection',
      target_odometer: 40500, // 500 km remaining -> due soon
    });

    const status = profileRepo.computeProfileDueStatus(profile, testVehicle);
    expect(status.status).toBe('due_soon');
    expect(status.kmRemaining).toBe(500);
    expect(status.headline).toContain('Due Soon');
  });

  test('computeAllProfilesDueStatus calculates statuses across all vehicle profiles', () => {
    profileRepo.createMaintenanceProfile({
      vehicle_id: testVehicle.id,
      component_name: 'Coolant Flush',
      target_odometer: 50000, // 10,000 km remaining -> ok
    });
    profileRepo.createMaintenanceProfile({
      vehicle_id: testVehicle.id,
      component_name: 'Air Filter',
      target_odometer: 39500, // 500 km overdue -> overdue
    });

    const allStatuses = profileRepo.computeAllProfilesDueStatus(testVehicle.id, testVehicle.current_odometer);
    expect(allStatuses.length).toBe(2);

    const airFilterStatus = allStatuses.find((s) => s.profile.component_name === 'Air Filter');
    expect(airFilterStatus?.status).toBe('overdue');

    const coolantStatus = allStatuses.find((s) => s.profile.component_name === 'Coolant Flush');
    expect(coolantStatus?.status).toBe('ok');
  });
});
