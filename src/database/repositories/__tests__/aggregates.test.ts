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
import * as tripRepo from '@/database/repositories/tripRepo';
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

  describe('Lightweight Single-Row and Monthly Widget Queries', () => {
    it('fuelRepo.getMonthlyFuelTotal computes exact month total', () => {
      fuelRepo.createFuelEntryAtomic(
        {
          vehicle_id: vehicle1.id,
          date: '2026-11-02',
          odometer: 11000,
          fuel_amount: 10,
          fuel_unit: FuelUnit.LITRES,
          price_per_unit: 100, // 1000
          is_full_tank: 1,
        },
        FuelType.PETROL,
        VehicleType.CAR
      );
      fuelRepo.createFuelEntryAtomic(
        {
          vehicle_id: vehicle1.id,
          date: '2026-11-15',
          odometer: 11200,
          fuel_amount: 15,
          fuel_unit: FuelUnit.LITRES,
          price_per_unit: 100, // 1500
          is_full_tank: 1,
        },
        FuelType.PETROL,
        VehicleType.CAR
      );

      expect(fuelRepo.getMonthlyFuelTotal(vehicle1.id, '2026-11')).toBe(2500);
      expect(fuelRepo.getMonthlyFuelTotal(vehicle1.id, '2026-12')).toBe(0);
    });

    it('fuelRepo.getLatestFuelEntryWithMileage returns most recent entry with calculated mileage', () => {
      // First fill: full tank (no mileage yet)
      const f1 = fuelRepo.createFuelEntryAtomic(
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

      // Second fill: full tank (calculates mileage)
      const f2 = fuelRepo.createFuelEntryAtomic(
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

      // Third fill: partial fill (no mileage calculated)
      const f3 = fuelRepo.createFuelEntryAtomic(
        {
          vehicle_id: vehicle1.id,
          date: '2026-10-20',
          odometer: 10450,
          fuel_amount: 10,
          fuel_unit: FuelUnit.LITRES,
          price_per_unit: 100,
          is_full_tank: 0,
        },
        FuelType.PETROL,
        VehicleType.CAR
      );

      const latest = fuelRepo.getLatestFuelEntry(vehicle1.id);
      expect(latest?.id).toBe(f3.entry.id);
      expect(latest?.calculated_mileage).toBeNull();

      const latestWithMileage = fuelRepo.getLatestFuelEntryWithMileage(vehicle1.id);
      expect(latestWithMileage?.id).toBe(f2.entry.id);
      expect(latestWithMileage?.calculated_mileage).toBe(15);
    });

    it('serviceRepo.getMonthlyServiceTotal computes exact month total', () => {
      serviceRepo.createServiceRecord({
        vehicle_id: vehicle1.id,
        date: '2026-09-05',
        service_type: 'General Checkup',
        cost: 1500,
      });
      serviceRepo.createServiceRecord({
        vehicle_id: vehicle1.id,
        date: '2026-09-22',
        service_type: 'Wheel Balancing',
        cost: 800,
      });

      expect(serviceRepo.getMonthlyServiceTotal(vehicle1.id, '2026-09')).toBe(2300);
      expect(serviceRepo.getMonthlyServiceTotal(vehicle1.id, '2026-10')).toBe(0);
    });

    it('tripRepo.getLatestTripByVehicle returns latest non-discarded trip', () => {
      const t1 = tripRepo.createManualTrip({
        vehicle_id: vehicle1.id,
        start_odometer: 10000,
        end_odometer: 10050,
        date: '2026-10-01',
      });
      const t2 = tripRepo.createManualTrip({
        vehicle_id: vehicle1.id,
        start_odometer: 10050,
        end_odometer: 10120,
        date: '2026-10-05',
      });

      const latest = tripRepo.getLatestTripByVehicle(vehicle1.id);
      expect(latest?.id).toBe(t2.id);
      expect(latest?.distance_km).toBe(70);
    });
  });
});

