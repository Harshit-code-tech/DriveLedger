import {
  getEfficiencyUnit,
  getFuelVolumeUnit,
  computeFuelConsumption,
  computeSixMonthStatistics,
  getEfficiencyPerformanceTier,
  getVehicleEfficiencyGroup,
} from '../insightsHelpers';
import { FuelType } from '@/constants/fuelTypes';
import type { FuelEntry } from '@/types/fuel';
import type { ServiceRecord } from '@/types/service';
import type { Expense } from '@/types/expense';
import type { Vehicle } from '@/types/vehicle';

describe('insightsHelpers', () => {
  describe('getEfficiencyUnit', () => {
    it('returns km/kWh for electric vehicles', () => {
      expect(getEfficiencyUnit(FuelType.ELECTRIC)).toBe('km/kWh');
    });

    it('returns km/kg for CNG vehicles', () => {
      expect(getEfficiencyUnit(FuelType.CNG)).toBe('km/kg');
    });

    it('returns km/L for Petrol and Diesel vehicles', () => {
      expect(getEfficiencyUnit(FuelType.PETROL)).toBe('km/L');
      expect(getEfficiencyUnit(FuelType.DIESEL)).toBe('km/L');
    });
  });

  describe('getFuelVolumeUnit', () => {
    it('returns correct volume units per fuel type', () => {
      expect(getFuelVolumeUnit(FuelType.ELECTRIC)).toBe('kWh');
      expect(getFuelVolumeUnit(FuelType.CNG)).toBe('kg');
      expect(getFuelVolumeUnit(FuelType.PETROL)).toBe('L');
    });
  });

  describe('getEfficiencyPerformanceTier', () => {
    it('maps 0-5% to Tier 1 Green (Optimal)', () => {
      const tier0 = getEfficiencyPerformanceTier(0);
      expect(tier0.tier).toBe('tier1_green');
      expect(tier0.colorKey).toBe('tierGreen');

      const tier5 = getEfficiencyPerformanceTier(5);
      expect(tier5.tier).toBe('tier1_green');
    });

    it('maps >5-15% to Tier 2 Orange (Moderate)', () => {
      const tier10 = getEfficiencyPerformanceTier(10);
      expect(tier10.tier).toBe('tier2_orange');
      expect(tier10.colorKey).toBe('tierOrange');
    });

    it('maps >15-30% to Tier 3 Yellow (Significant)', () => {
      const tier25 = getEfficiencyPerformanceTier(25);
      expect(tier25.tier).toBe('tier3_yellow');
      expect(tier25.colorKey).toBe('tierYellow');
    });

    it('maps >30% to Tier 4 Red (Substantial)', () => {
      const tier35 = getEfficiencyPerformanceTier(35);
      expect(tier35.tier).toBe('tier4_red');
      expect(tier35.colorKey).toBe('tierRed');
    });
  });

  describe('getVehicleEfficiencyGroup', () => {
    it('groups electric vehicles separately from liquid fuel', () => {
      const ev = getVehicleEfficiencyGroup('electric');
      expect(ev.group).toBe('electric');
      expect(ev.unit).toBe('km/kWh');

      const petrol = getVehicleEfficiencyGroup('petrol');
      expect(petrol.group).toBe('liquid');
      expect(petrol.unit).toBe('km/L');

      const cng = getVehicleEfficiencyGroup('cng');
      expect(cng.group).toBe('cng_lpg');
      expect(cng.unit).toBe('km/kg');
    });
  });

  describe('computeFuelConsumption', () => {
    it('sums single fuel correctly', () => {
      const entries = [
        { fuel_amount: 30, fuel_unit: 'L' } as unknown as FuelEntry,
        { fuel_amount: 25, fuel_unit: 'L' } as unknown as FuelEntry,
      ];
      const res = computeFuelConsumption(entries, { fuel_type: FuelType.PETROL } as Vehicle);
      expect(res.isDualFuel).toBe(false);
      expect(res.totalQuantity).toBe(55);
      expect(res.defaultUnit).toBe('L');
    });

    it('separates dual-fuel primary and secondary streams', () => {
      const entries = [
        { fuel_amount: 8, fuel_system: 'primary', fuel_unit: 'kg' } as unknown as FuelEntry,
        { fuel_amount: 15, fuel_system: 'secondary', fuel_unit: 'L' } as unknown as FuelEntry,
      ];
      const res = computeFuelConsumption(entries, { fuel_type: FuelType.HYBRID_CNG_PETROL } as Vehicle);
      expect(res.isDualFuel).toBe(true);
      expect(res.primaryAmount).toBe(8);
      expect(res.secondaryAmount).toBe(15);
      expect(res.primaryUnit).toBe('kg');
      expect(res.secondaryUnit).toBe('L');
    });
  });

  describe('computeSixMonthStatistics', () => {
    it('scopes statistics strictly to the last 6 months', () => {
      const now = new Date();
      const recentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-05`;
      const oldDate = '2020-01-01';

      const entries: FuelEntry[] = [
        { id: '1', date: recentDate, total_cost: 2000, fuel_amount: 20, odometer: 10200 } as FuelEntry,
        { id: '2', date: recentDate, total_cost: 2500, fuel_amount: 25, odometer: 10600 } as FuelEntry,
        { id: '3', date: oldDate, total_cost: 1000, fuel_amount: 10, odometer: 5000 } as FuelEntry,
      ];

      const services: ServiceRecord[] = [
        { id: 's1', date: recentDate, cost: 3000 } as ServiceRecord,
        { id: 's2', date: oldDate, cost: 7000 } as ServiceRecord,
      ];

      const expenses: Expense[] = [
        { id: 'e1', date: recentDate, amount: 500 } as Expense,
      ];

      const stats = computeSixMonthStatistics(entries, services, expenses, { fuel_type: FuelType.PETROL } as Vehicle);

      expect(stats.totalFuelCost).toBe(4500);
      expect(stats.totalServiceCost).toBe(3000);
      expect(stats.totalExpenseCost).toBe(500);
      expect(stats.totalRecordedSpend).toBe(8000);
      expect(stats.fillCount).toBe(2);
      expect(stats.avgCostPerFill).toBe(2250);
      expect(stats.servicesLogged).toBe(1);
      expect(stats.kmTracked).toBe(400); // 10600 - 10200
      expect(stats.costPerKm).toBe(20); // 8000 / 400 = 20
    });
  });
});
