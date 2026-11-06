import React from 'react';
import {
  computeSixMonthStatistics,
  getEfficiencyUnit,
  getEfficiencyPerformanceTier,
  getVehicleEfficiencyGroup,
} from '../insightsHelpers';
import { InsightsColors } from '../insightsTheme';
import { FuelType } from '@/constants/fuelTypes';
import type { FuelEntry } from '@/types/fuel';
import type { ServiceRecord } from '@/types/service';
import type { Expense } from '@/types/expense';
import type { Vehicle } from '@/types/vehicle';

describe('Insights Integration & Preservation', () => {
  const mockVehicle: Vehicle = {
    id: 'veh_1',
    nickname: 'Silver Arrow',
    manufacturer: 'Volkswagen',
    model: 'Polo GT',
    year: 2022,
    fuel_type: FuelType.PETROL,
    tank_capacity: 45,
    current_odometer: 24500,
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
  } as unknown as Vehicle;

  const colors = InsightsColors.light;

  it('verifies theme tokens conform to the approved design specification', () => {
    expect(colors.background).toBe('#F5F8FC');
    expect(colors.surface).toBe('#FFFFFF');
    expect(colors.text).toBe('#183B63');
    expect(colors.accent).toBe('#3983C7');
    expect(colors.divider).toBe('#DCE6F1');
    expect(colors.border).toBe('#DCE6F1');
    expect(colors.tierGreen).toBe('#10B981');
    expect(colors.tierOrange).toBe('#F59E0B');
    expect(colors.tierYellow).toBe('#EAB308');
    expect(colors.tierRed).toBe('#EF4444');
  });

  it('verifies fuel configuration unit matches specification across all types', () => {
    expect(getEfficiencyUnit(FuelType.PETROL)).toBe('km/L');
    expect(getEfficiencyUnit(FuelType.DIESEL)).toBe('km/L');
    expect(getEfficiencyUnit(FuelType.CNG)).toBe('km/kg');
    expect(getEfficiencyUnit(FuelType.HYBRID_LPG_PETROL)).toBe('km/kg');
    expect(getEfficiencyUnit(FuelType.ELECTRIC)).toBe('km/kWh');
  });

  it('correctly categorizes efficiency groups for fleet comparison', () => {
    const evGroup = getVehicleEfficiencyGroup('electric');
    const cngGroup = getVehicleEfficiencyGroup('cng');
    const petrolGroup = getVehicleEfficiencyGroup('petrol');
    const hybridGroup = getVehicleEfficiencyGroup('hybrid_cng_petrol');

    expect(evGroup.group).toBe('electric');
    expect(evGroup.unit).toBe('km/kWh');

    expect(cngGroup.group).toBe('cng_lpg');
    expect(cngGroup.unit).toBe('km/kg');

    expect(petrolGroup.group).toBe('liquid');
    expect(petrolGroup.unit).toBe('km/L');

    expect(hybridGroup.group).toBe('hybrid');
  });

  it('correctly calculates 4 visual performance tiers', () => {
    // 0-5% -> Green Tier 1
    expect(getEfficiencyPerformanceTier(0).tier).toBe('tier1_green');
    expect(getEfficiencyPerformanceTier(4.9).tier).toBe('tier1_green');

    // >5-15% -> Orange Tier 2
    expect(getEfficiencyPerformanceTier(5.1).tier).toBe('tier2_orange');
    expect(getEfficiencyPerformanceTier(15.0).tier).toBe('tier2_orange');

    // >15-30% -> Yellow Tier 3
    expect(getEfficiencyPerformanceTier(15.1).tier).toBe('tier3_yellow');
    expect(getEfficiencyPerformanceTier(30.0).tier).toBe('tier3_yellow');

    // >30% -> Red Tier 4
    expect(getEfficiencyPerformanceTier(30.1).tier).toBe('tier4_red');
    expect(getEfficiencyPerformanceTier(50.0).tier).toBe('tier4_red');
  });

  it('computes 6-month statistics properly with odometer separation', () => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-10`;

    const entries: FuelEntry[] = [
      {
        id: 'f1',
        vehicle_id: 'veh_1',
        date: dateStr,
        odometer: 20000,
        fuel_amount: 30,
        total_cost: 3000,
        price_per_unit: 100,
        fuel_unit: 'L',
        is_full_tank: 1,
        created_at: dateStr,
      } as unknown as FuelEntry,
      {
        id: 'f2',
        vehicle_id: 'veh_1',
        date: dateStr,
        odometer: 20500,
        fuel_amount: 25,
        total_cost: 2500,
        price_per_unit: 100,
        fuel_unit: 'L',
        is_full_tank: 1,
        created_at: dateStr,
      } as unknown as FuelEntry,
    ];

    const services: ServiceRecord[] = [
      {
        id: 's1',
        vehicle_id: 'veh_1',
        date: dateStr,
        cost: 2000,
        odometer: 20250,
        created_at: dateStr,
      } as ServiceRecord,
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        vehicle_id: 'veh_1',
        date: dateStr,
        amount: 500,
        created_at: dateStr,
      } as Expense,
    ];

    const sixMonth = computeSixMonthStatistics(entries, services, expenses, mockVehicle);

    // Fuel: 3000 + 2500 = 5500
    // Service: 2000
    // Expense: 500
    // Total spend: 8000
    expect(sixMonth.totalFuelCost).toBe(5500);
    expect(sixMonth.totalServiceCost).toBe(2000);
    expect(sixMonth.totalExpenseCost).toBe(500);
    expect(sixMonth.totalRecordedSpend).toBe(8000);
    expect(sixMonth.fillCount).toBe(2);
    expect(sixMonth.avgCostPerFill).toBe(2750);
    expect(sixMonth.servicesLogged).toBe(1);
    expect(sixMonth.kmTracked).toBe(500); // 20500 - 20000
    expect(sixMonth.costPerKm).toBe(16); // 8000 / 500 = 16
  });
});
