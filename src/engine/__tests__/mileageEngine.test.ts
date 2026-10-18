import { FuelType, FuelUnit, MileageUnit } from '@/constants/fuelTypes';
import { VehicleType } from '@/constants/fuelTypes';
import {
  calculateMileageForEntry,
  calculatePartialEstimate,
  computeMileageStats,
  checkMileageReasonableness,
} from '../mileageEngine';
import { validateFuelEntry } from '../validationEngine';
import type { FuelEntry } from '@/types/fuel';

function createMockEntry(overrides: Partial<FuelEntry>): FuelEntry {
  return {
    id: 'test-' + Math.random().toString(36).substring(7),
    vehicle_id: 'veh-1',
    date: '2026-10-10',
    odometer: 1000,
    fuel_amount: 30,
    fuel_unit: FuelUnit.LITRES,
    price_per_unit: 100,
    total_cost: 3000,
    fuel_station: 'HP Pump',
    is_full_tank: 1,
    calculated_mileage: null,
    mileage_unit: null,
    receipt_photo_uri: null,
    notes: null,
    fuel_system: 'primary',
    battery_start_percent: null,
    battery_end_percent: null,
    created_at: '2026-10-10T10:00:00Z',
    updated_at: '2026-10-10T10:00:00Z',
    deleted_at: null,
    ...overrides,
  };
}

describe('Mileage Engine — Multi-Fuel & Non-Liquid Calculations', () => {
  describe('1. Standard Liquid Fuel (Petrol / Diesel)', () => {
    it('calculates tank-to-tank mileage with intermediate partial fill', () => {
      const entries: FuelEntry[] = [
        createMockEntry({ odometer: 10000, fuel_amount: 35, is_full_tank: 1 }),
        createMockEntry({ odometer: 10200, fuel_amount: 10, is_full_tank: 0 }),
        createMockEntry({ odometer: 10600, fuel_amount: 25, is_full_tank: 1 }),
      ];

      // Entry 0 (first fill): no previous full tank -> null
      expect(calculateMileageForEntry(entries, 0, FuelType.PETROL)).toBeNull();

      // Entry 1 (partial fill): skipped for exact calculation
      expect(calculateMileageForEntry(entries, 1, FuelType.PETROL)).toBeNull();

      // Entry 2 (full tank): distance = 600 km, fuel consumed = 10 + 25 = 35 L
      // 600 / 35 = 17.1428... km/L
      const res = calculateMileageForEntry(entries, 2, FuelType.PETROL);
      expect(res).not.toBeNull();
      expect(res?.unit).toBe(MileageUnit.KM_PER_LITRE);
      expect(res?.value).toBeCloseTo(17.14, 1);
    });

    it('calculates partial fill estimate using distance / fuel added in previous fill', () => {
      const entries: FuelEntry[] = [
        createMockEntry({ odometer: 10000, fuel_amount: 35, is_full_tank: 1 }),
        createMockEntry({ odometer: 10200, fuel_amount: 10, is_full_tank: 0 }),
      ];

      // Distance = 200 km, previous fuel = 35 L -> 200 / 35 = 5.71 km/L
      const estimate = calculatePartialEstimate(entries, 1, FuelType.PETROL);
      expect(estimate).not.toBeNull();
      expect(estimate?.isEstimate).toBe(true);
      expect(estimate?.value).toBeCloseTo(5.71, 2);
      expect(estimate?.unit).toBe(MileageUnit.KM_PER_LITRE);
    });
  });

  describe('2. CNG / LPG Calculations (km/kg)', () => {
    it('calculates CNG efficiency in km_per_kg', () => {
      const entries: FuelEntry[] = [
        createMockEntry({
          odometer: 20000,
          fuel_amount: 8.5,
          fuel_unit: FuelUnit.KG,
          is_full_tank: 1,
        }),
        createMockEntry({
          odometer: 20210,
          fuel_amount: 8.2,
          fuel_unit: FuelUnit.KG,
          is_full_tank: 1,
        }),
      ];

      // Distance: 210 km / 8.2 kg = 25.609 km/kg
      const res = calculateMileageForEntry(entries, 1, FuelType.CNG);
      expect(res).not.toBeNull();
      expect(res?.unit).toBe(MileageUnit.KM_PER_KG);
      expect(res?.value).toBeCloseTo(25.61, 1);
    });
  });

  describe('3. Electric Vehicle (EV) Calculations (km/kWh)', () => {
    it('calculates EV efficiency charge-to-charge in km_per_kwh', () => {
      const entries: FuelEntry[] = [
        createMockEntry({
          odometer: 5000,
          fuel_amount: 28,
          fuel_unit: FuelUnit.KWH,
          is_full_tank: 1,
        }),
        createMockEntry({
          odometer: 5210,
          fuel_amount: 30,
          fuel_unit: FuelUnit.KWH,
          is_full_tank: 1,
        }),
      ];

      // Distance = 210 km / 30 kWh = 7.0 km/kWh
      const res = calculateMileageForEntry(entries, 1, FuelType.ELECTRIC);
      expect(res).not.toBeNull();
      expect(res?.unit).toBe(MileageUnit.KM_PER_KWH);
      expect(res?.value).toBe(7.0);
    });
  });

  describe('4. Bi-Fuel (Hybrid CNG + Petrol) Dual-Stream Isolation', () => {
    it('isolates CNG entries from Petrol fills so petrol fills do not corrupt CNG mileage', () => {
      const entries: FuelEntry[] = [
        // 1. Initial CNG full tank
        createMockEntry({
          odometer: 30000,
          fuel_amount: 8,
          fuel_unit: FuelUnit.KG,
          fuel_system: 'primary',
          is_full_tank: 1,
        }),
        // 2. Petrol top-up in between
        createMockEntry({
          odometer: 30080,
          fuel_amount: 15,
          fuel_unit: FuelUnit.LITRES,
          fuel_system: 'secondary',
          is_full_tank: 1,
        }),
        // 3. Second CNG full tank
        createMockEntry({
          odometer: 30200,
          fuel_amount: 7.5,
          fuel_unit: FuelUnit.KG,
          fuel_system: 'primary',
          is_full_tank: 1,
        }),
      ];

      // When calculating Entry 2 (CNG), it must link backwards to Entry 0 (CNG),
      // completely ignoring the intermediate Petrol fill (Entry 1)
      const cngRes = calculateMileageForEntry(entries, 2, FuelType.HYBRID_CNG_PETROL);
      expect(cngRes).not.toBeNull();
      expect(cngRes?.unit).toBe(MileageUnit.KM_PER_KG);
      // Distance = 30200 - 30000 = 200 km. Consumed = 7.5 kg -> 200 / 7.5 = 26.666 km/kg
      expect(cngRes?.value).toBeCloseTo(26.67, 1);
    });

    it('computes distinct primary and secondary stats in computeMileageStats', () => {
      const entries: FuelEntry[] = [
        createMockEntry({
          odometer: 1000,
          fuel_amount: 8,
          fuel_unit: FuelUnit.KG,
          fuel_system: 'primary',
          calculated_mileage: 26.0,
          mileage_unit: MileageUnit.KM_PER_KG,
          total_cost: 680,
        }),
        createMockEntry({
          odometer: 1300,
          fuel_amount: 15,
          fuel_unit: FuelUnit.LITRES,
          fuel_system: 'secondary',
          calculated_mileage: 16.5,
          mileage_unit: MileageUnit.KM_PER_LITRE,
          total_cost: 1575,
        }),
      ];

      const stats = computeMileageStats(entries, FuelType.HYBRID_CNG_PETROL);
      expect(stats.primarySystemStats).toBeDefined();
      expect(stats.primarySystemStats?.runningAverage?.value).toBe(26.0);
      expect(stats.primarySystemStats?.runningAverage?.unit).toBe(MileageUnit.KM_PER_KG);

      expect(stats.secondarySystemStats).toBeDefined();
      expect(stats.secondarySystemStats?.runningAverage?.value).toBe(16.5);
      expect(stats.secondarySystemStats?.runningAverage?.unit).toBe(MileageUnit.KM_PER_LITRE);

      // Blended cost per km: total cost = 2255, distance = 300 km -> 7.516 ₹/km
      expect(stats.costPerKm).toBeCloseTo(7.52, 1);
    });
  });

  describe('5. Validation Engine — Multi-Fuel & EV Rules', () => {
    it('validates EV battery percentage bounds and start < end', () => {
      const invalidPercent = validateFuelEntry(
        {
          odometer: 12000,
          fuel_amount: 20,
          fuel_unit: FuelUnit.KWH,
          price_per_unit: 10,
          date: '2026-10-10',
          battery_start_percent: 85,
          battery_end_percent: 40, // end < start is invalid
        },
        11800,
        30,
        FuelType.ELECTRIC
      );
      expect(invalidPercent.isValid).toBe(false);
      expect(invalidPercent.issues.some((i) => i.field === 'battery_end_percent')).toBe(true);

      const validEV = validateFuelEntry(
        {
          odometer: 12000,
          fuel_amount: 20,
          fuel_unit: FuelUnit.KWH,
          price_per_unit: 10,
          date: '2026-10-10',
          battery_start_percent: 20,
          battery_end_percent: 85,
        },
        11800,
        30,
        FuelType.ELECTRIC
      );
      expect(validEV.isValid).toBe(true);
    });

    it('checks against secondary tank capacity for hybrid secondary fills', () => {
      const hybridSecondaryExceed = validateFuelEntry(
        {
          odometer: 15000,
          fuel_amount: 45, // Exceeds secondary petrol tank of 35L
          fuel_unit: FuelUnit.LITRES,
          price_per_unit: 105,
          date: '2026-10-10',
          fuel_system: 'secondary',
        },
        14800,
        10, // Primary CNG tank (10 kg)
        FuelType.HYBRID_CNG_PETROL,
        35  // Secondary Petrol tank (35 L)
      );

      const warning = hybridSecondaryExceed.issues.find((i) => i.field === 'fuel_amount');
      expect(warning).toBeDefined();
      expect(warning?.severity).toBe('warning');
      expect(warning?.message).toContain('35');
    });
  });
});
