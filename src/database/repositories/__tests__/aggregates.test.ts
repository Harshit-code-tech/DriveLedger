/**
 * Repository Aggregates & Fleet Summary Test Suite (P1.1)
 *
 * Verifies targeted SQL aggregates for fuel, service, and expense records,
 * ensuring fleet-wide comparisons and monthly spend cards query summary data
 * without materializing entire historical entity sets in JavaScript memory.
 */

import { getDatabase } from '@/database/connection';
import { createTables } from '@/database/schema';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import * as fuelRepo from '@/database/repositories/fuelRepo';
import * as serviceRepo from '@/database/repositories/serviceRepo';
import * as expenseRepo from '@/database/repositories/expenseRepo';
import { FuelType, FuelUnit, VehicleType } from '@/constants/fuelTypes';
import { resetMockDatabase } from '@/__mocks__/expo-sqlite';
import type { Vehicle } from '@/types/vehicle';

describe('Targeted Repository Aggregates', () => {
  let db: any;
  let vehicle1: Vehicle;
  let vehicle2: Vehicle;

  beforeEach(() => {
    resetMockDatabase();
    db = getDatabase();
    createTables(db);

    vehicle1 = vehicleRepo.createVehicle({
      nickname: 'Car Alpha',
      registration_number: 'KA-01-AA-1111',
      vehicle_type: VehicleType.CAR,
      fuel_type: FuelType.PETROL,
      current_odometer: 10000,
    });

    vehicle2 = vehicleRepo.createVehicle({
      nickname: 'Bike Beta',
      registration_number: 'KA-01-BB-2222',
      vehicle_type: VehicleType.TWO_WHEELER,
      fuel_type: FuelType.PETROL,
      current_odometer: 5000,
    });
  });

  describe('fuelRepo.getVehicleFuelAggregates', () => {
    it('returns empty aggregates when vehicle has no fuel entries', () => {
      const result = fuelRepo.getVehicleFuelAggregates(vehicle1.id);
      expect(result.totalCost).toBe(0);
      expect(Object.keys(result.monthlyAggregates).length).toBe(0);
    });

    it('aggregates total fuel cost and monthly breakdown across months', () => {
      fuelRepo.createFuelEntryAtomic(
        {
          vehicle_id: vehicle1.id,
          date: '2026-09-10',
          odometer: 10200,
          fuel_amount: 20,
          fuel_unit: FuelUnit.LITRES,
          price_per_unit: 100, // 2000
          is_full_tank: 1,
        },
        FuelType.PETROL,
        VehicleType.CAR
      );

      fuelRepo.createFuelEntryAtomic(
        {
          vehicle_id: vehicle1.id,
          date: '2026-10-05',
          odometer: 10500,
          fuel_amount: 15,
          fuel_unit: FuelUnit.LITRES,
          price_per_unit: 100, // 1500
          is_full_tank: 1,
        },
        FuelType.PETROL,
        VehicleType.CAR
      );

      fuelRepo.createFuelEntryAtomic(
        {
          vehicle_id: vehicle1.id,
          date: '2026-10-20',
          odometer: 10800,
          fuel_amount: 15,
          fuel_unit: FuelUnit.LITRES,
          price_per_unit: 100, // 1500
          is_full_tank: 1,
        },
        FuelType.PETROL,
        VehicleType.CAR
      );

      const allResult = fuelRepo.getVehicleFuelAggregates(vehicle1.id);
      expect(allResult.totalCost).toBe(5000);
      expect(allResult.monthlyAggregates['2026-09']?.fuelCost).toBe(2000);
      expect(allResult.monthlyAggregates['2026-10']?.fuelCost).toBe(3000);
      expect(allResult.monthlyAggregates['2026-10']?.entryCount).toBe(2);

      // Filtering with sinceMonthKey
      const filtered = fuelRepo.getVehicleFuelAggregates(vehicle1.id, '2026-10');
      expect(filtered.totalCost).toBe(5000);
      expect(filtered.monthlyAggregates['2026-09']).toBeUndefined();
      expect(filtered.monthlyAggregates['2026-10']?.fuelCost).toBe(3000);
    });

    it('computes running average mileage directly from SQLite', () => {
      fuelRepo.createFuelEntryAtomic(
        {
          vehicle_id: vehicle1.id,
          date: '2026-10-01',
          odometer: 10000,
          fuel_amount: 20,
          fuel_unit: FuelUnit.LITRES,
          price_per_unit: 100,
          is_full_tank: 1,
        },
        FuelType.PETROL,
        VehicleType.CAR
      );

      fuelRepo.createFuelEntryAtomic(
        {
          vehicle_id: vehicle1.id,
          date: '2026-10-10',
          odometer: 10300,
          fuel_amount: 20,
          fuel_unit: FuelUnit.LITRES,
          price_per_unit: 100,
          is_full_tank: 1,
        },
        FuelType.PETROL,
        VehicleType.CAR
      );

      const runningMileage = fuelRepo.getVehicleRunningMileage(vehicle1.id);
      expect(runningMileage).not.toBeNull();
      expect(runningMileage?.value).toBe(15); // 300km / 20L = 15 km/L
    });
  });

  describe('serviceRepo.getVehicleServiceAggregates', () => {
    it('returns service totals and monthly breakdown', () => {
      serviceRepo.createServiceRecord({
        vehicle_id: vehicle1.id,
        date: '2026-09-15',
        service_type: 'periodic',
        cost: 3500,
      });

      serviceRepo.createServiceRecord({
        vehicle_id: vehicle1.id,
        date: '2026-10-01',
        service_type: 'repair',
        cost: 1200,
      });

      const res = serviceRepo.getVehicleServiceAggregates(vehicle1.id);
      expect(res.totalCost).toBe(4700);
      expect(res.monthlyAggregates['2026-09']?.serviceCost).toBe(3500);
      expect(res.monthlyAggregates['2026-10']?.serviceCost).toBe(1200);

      const sinceOct = serviceRepo.getVehicleServiceAggregates(vehicle1.id, '2026-10');
      expect(sinceOct.totalCost).toBe(4700);
      expect(sinceOct.monthlyAggregates['2026-09']).toBeUndefined();
      expect(sinceOct.monthlyAggregates['2026-10']?.serviceCost).toBe(1200);
    });
  });

  describe('expenseRepo.getVehicleExpenseAggregates', () => {
    it('returns expense totals and monthly breakdown', () => {
      expenseRepo.createExpense({
        vehicle_id: vehicle1.id,
        date: '2026-08-20',
        category: 'toll',
        amount: 250,
      });

      expenseRepo.createExpense({
        vehicle_id: vehicle1.id,
        date: '2026-10-05',
        category: 'parking',
        amount: 100,
      });

      const res = expenseRepo.getVehicleExpenseAggregates(vehicle1.id);
      expect(res.totalCost).toBe(350);
      expect(res.monthlyAggregates['2026-08']?.expenseCost).toBe(250);
      expect(res.monthlyAggregates['2026-10']?.expenseCost).toBe(100);

      const sinceOct = expenseRepo.getVehicleExpenseAggregates(vehicle1.id, '2026-10');
      expect(sinceOct.totalCost).toBe(350);
      expect(sinceOct.monthlyAggregates['2026-08']).toBeUndefined();
      expect(sinceOct.monthlyAggregates['2026-10']?.expenseCost).toBe(100);
    });
  });
});
