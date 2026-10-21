/**
 * Mileage Engine Weighted Average & Interval Integrity Tests (Part E1 Audit)
 *
 * Verifies that overall mileage across completed intervals uses true weighted quantities
 * (totalDistance / totalFuel) rather than an unweighted arithmetic average of rates.
 */

import { computeMileageStats } from '../mileageEngine';
import { FuelType, FuelUnit } from '@/constants/fuelTypes';
import type { FuelEntry } from '@/types/fuel';

describe('MileageEngine — Weighted Average Verification (E1 Audit)', () => {
  const vehId = 'veh_weighted_test';

  test('computes true weighted average across intervals of unequal distance and volume', () => {
    // E1 explicit audit scenario:
    // Entry 0: Odometer 10000 (Anchor fill)
    // Entry 1: Odometer 10100 (100 km), 5 L filled -> 20.0 km/L
    // Entry 2: Odometer 10400 (300 km), 20 L filled -> 15.0 km/L
    //
    // Arithmetic average of rates = (20.0 + 15.0) / 2 = 17.5 km/L
    // Correct physical weighted result = 400 km / 25 L = 16.0 km/L
    const entries: FuelEntry[] = [
      {
        id: 'entry_2',
        vehicle_id: vehId,
        date: '2026-03-01',
        odometer: 10400,
        fuel_amount: 20,
        fuel_unit: FuelUnit.LITRES,
        price_per_unit: 100,
        fuel_station: null,
        receipt_photo_uri: null,
        total_cost: 2000,
        is_full_tank: 1,
        calculated_mileage: 15.0,
        mileage_unit: null,
        fuel_system: null,
        notes: null,
        created_at: '2026-03-01T00:00:00Z',
        updated_at: '2026-03-01T00:00:00Z',
        deleted_at: null,
      },
      {
        id: 'entry_1',
        vehicle_id: vehId,
        date: '2026-02-15',
        odometer: 10100,
        fuel_amount: 5,
        fuel_unit: FuelUnit.LITRES,
        price_per_unit: 100,
        fuel_station: null,
        receipt_photo_uri: null,
        total_cost: 500,
        is_full_tank: 1,
        calculated_mileage: 20.0,
        mileage_unit: null,
        fuel_system: null,
        notes: null,
        created_at: '2026-02-15T00:00:00Z',
        updated_at: '2026-02-15T00:00:00Z',
        deleted_at: null,
      },
      {
        id: 'entry_0',
        vehicle_id: vehId,
        date: '2026-02-01',
        odometer: 10000,
        fuel_amount: 25,
        fuel_unit: FuelUnit.LITRES,
        price_per_unit: 100,
        fuel_station: null,
        receipt_photo_uri: null,
        total_cost: 2500,
        is_full_tank: 1,
        calculated_mileage: null, // First fill anchor
        mileage_unit: null,
        fuel_system: null,
        notes: null,
        created_at: '2026-02-01T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z',
        deleted_at: null,
      },
    ];

    const stats = computeMileageStats(entries, FuelType.PETROL);

    // Running average must be exactly 16.0 km/L (weighted)
    expect(stats.runningAverage?.value).toBe(16.0);
    expect(stats.runningAverage?.value).not.toBe(17.5);

    // Best and worst reflect individual intervals accurately
    expect(stats.best?.value).toBe(20.0);
    expect(stats.worst?.value).toBe(15.0);
  });

  test('accumulates intermediate partial fills correctly into completed interval', () => {
    // Entry 0: 10,000 km | 30L | Full (Anchor)
    // Entry 1: 10,200 km | 10L | Partial
    // Entry 2: 10,600 km | 20L | Full
    // Total distance = 600 km. Total fuel consumed = 10 + 20 = 30 L.
    // Result = 600 / 30 = 20.0 km/L
    const entries: FuelEntry[] = [
      {
        id: 'e2',
        vehicle_id: vehId,
        date: '2026-03-01',
        odometer: 10600,
        fuel_amount: 20,
        fuel_unit: FuelUnit.LITRES,
        price_per_unit: 100,
        fuel_station: null,
        receipt_photo_uri: null,
        total_cost: 2000,
        is_full_tank: 1,
        calculated_mileage: 20.0,
        mileage_unit: null,
        fuel_system: null,
        notes: null,
        created_at: '',
        updated_at: '',
        deleted_at: null,
      },
      {
        id: 'e1',
        vehicle_id: vehId,
        date: '2026-02-15',
        odometer: 10200,
        fuel_amount: 10,
        fuel_unit: FuelUnit.LITRES,
        price_per_unit: 100,
        fuel_station: null,
        receipt_photo_uri: null,
        total_cost: 1000,
        is_full_tank: 0, // Partial fill
        calculated_mileage: null,
        mileage_unit: null,
        fuel_system: null,
        notes: null,
        created_at: '',
        updated_at: '',
        deleted_at: null,
      },
      {
        id: 'e0',
        vehicle_id: vehId,
        date: '2026-02-01',
        odometer: 10000,
        fuel_amount: 30,
        fuel_unit: FuelUnit.LITRES,
        price_per_unit: 100,
        fuel_station: null,
        receipt_photo_uri: null,
        total_cost: 3000,
        is_full_tank: 1, // Anchor
        calculated_mileage: null,
        mileage_unit: null,
        fuel_system: null,
        notes: null,
        created_at: '',
        updated_at: '',
        deleted_at: null,
      },
    ];

    const stats = computeMileageStats(entries, FuelType.PETROL);
    expect(stats.runningAverage?.value).toBe(20.0);
  });
});
