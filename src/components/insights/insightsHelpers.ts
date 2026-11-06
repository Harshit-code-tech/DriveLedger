/**
 * DriveLedger — Insights Calculation & Helper Utilities
 *
 * Implements architectural requirements from docs/refurnish/insights.md:
 * - Section 3: Insights Information Architecture & Terminology
 * - Section 5A: Fuel Configuration & Unit Mapping
 * - Section 6: Statistics Scope & 6-Month Quick Numbers
 * - Section 7C & 7D: Fleet Comparison Fuel Grouping & 4-Tier Performance Thresholds
 */

import { FuelType } from '@/constants/fuelTypes';
import type { FuelEntry } from '@/types/fuel';
import type { ServiceRecord } from '@/types/service';
import type { Expense } from '@/types/expense';
import type { Vehicle } from '@/types/vehicle';
import { filterRecordsByTimeRange } from '@/utils/statsHelpers';
import { computeCostPerKm } from '@/utils/shareSummary';

export type InsightsSection = 'overview' | 'spending' | 'efficiency' | 'statistics' | 'fleet';

/**
 * Section 5A: Fuel Configuration Unit Mapping
 */
export function getEfficiencyUnit(fuelType?: FuelType | string): string {
  if (!fuelType) return 'km/L';
  const ft = fuelType as FuelType;
  switch (ft) {
    case FuelType.ELECTRIC:
      return 'km/kWh';
    case FuelType.CNG:
      return 'km/kg';
    case FuelType.HYBRID_LPG_PETROL:
      return 'km/kg'; // Primary stream unit
    default:
      return 'km/L';
  }
}

/**
 * Fuel Volume/Quantity Unit Mapping (Section 6)
 */
export function getFuelVolumeUnit(fuelType?: FuelType | string): string {
  if (!fuelType) return 'L';
  const ft = fuelType as FuelType;
  switch (ft) {
    case FuelType.ELECTRIC:
      return 'kWh';
    case FuelType.CNG:
      return 'kg';
    default:
      return 'L';
  }
}

/**
 * Dual-fuel stream consumption separation (Section 6)
 */
export interface DualFuelConsumption {
  isDualFuel: boolean;
  primaryAmount: number;
  primaryUnit: string;
  secondaryAmount: number;
  secondaryUnit: string;
  totalQuantity: number;
  defaultUnit: string;
}

export function computeFuelConsumption(entries: FuelEntry[], vehicle?: Vehicle | null): DualFuelConsumption {
  const isHybrid = vehicle?.fuel_type === FuelType.HYBRID_CNG_PETROL || vehicle?.fuel_type === FuelType.HYBRID_LPG_PETROL;

  if (isHybrid) {
    let primary = 0;
    let secondary = 0;
    const isLPG = vehicle?.fuel_type === FuelType.HYBRID_LPG_PETROL;
    const primaryUnit = isLPG ? 'kg' : 'kg';
    const secondaryUnit = 'L';

    for (const e of entries) {
      const isPrimary = e.fuel_system === 'primary' || e.fuel_unit === 'kg';
      if (isPrimary) {
        primary += e.fuel_amount;
      } else {
        secondary += e.fuel_amount;
      }
    }

    return {
      isDualFuel: true,
      primaryAmount: primary,
      primaryUnit,
      secondaryAmount: secondary,
      secondaryUnit,
      totalQuantity: primary + secondary,
      defaultUnit: 'units',
    };
  }

  const totalQuantity = entries.reduce((s, e) => s + e.fuel_amount, 0);
  const defaultUnit = entries[0]?.fuel_unit || getFuelVolumeUnit(vehicle?.fuel_type);

  return {
    isDualFuel: false,
    primaryAmount: totalQuantity,
    primaryUnit: defaultUnit,
    secondaryAmount: 0,
    secondaryUnit: '',
    totalQuantity,
    defaultUnit,
  };
}

/**
 * Section 6: Quick Numbers — Last 6 Months Scoped Metrics
 */
export interface SixMonthStatistics {
  totalFuelCost: number;
  totalServiceCost: number;
  totalExpenseCost: number;
  totalRecordedSpend: number;
  consumption: DualFuelConsumption;
  fillCount: number;
  avgCostPerFill: number | null;
  servicesLogged: number;
  kmTracked: number;
  costPerKm: number | null;
  dateRangeLabel: string;
}

export function computeSixMonthStatistics(
  entries: FuelEntry[],
  serviceRecords: ServiceRecord[],
  expenses: Expense[],
  vehicle?: Vehicle | null
): SixMonthStatistics {
  // Strict 6-month filtering as mandated by Section 6
  const filteredEntries = filterRecordsByTimeRange(entries, (e) => e.date, '6m');
  const filteredServices = filterRecordsByTimeRange(serviceRecords, (r) => r.date, '6m');
  const filteredExpenses = filterRecordsByTimeRange(expenses, (e) => e.date, '6m');

  const totalFuelCost = filteredEntries.reduce((s, e) => s + e.total_cost, 0);
  const totalServiceCost = filteredServices.reduce((s, r) => s + (r.cost || 0), 0);
  const totalExpenseCost = filteredExpenses.reduce((s, e) => s + e.amount, 0);
  const totalRecordedSpend = totalFuelCost + totalServiceCost + totalExpenseCost;

  const fillCount = filteredEntries.length;
  const avgCostPerFill = fillCount > 0 ? Math.round(totalFuelCost / fillCount) : null;
  const servicesLogged = filteredServices.length;

  const consumption = computeFuelConsumption(filteredEntries, vehicle);

  // Distance tracked via odometer delta (odometer-based, strictly separated from GPS trips)
  const { kmTracked, costPerKm } = computeCostPerKm(
    filteredEntries.map((e) => e.odometer),
    totalRecordedSpend
  );

  return {
    totalFuelCost,
    totalServiceCost,
    totalExpenseCost,
    totalRecordedSpend,
    consumption,
    fillCount,
    avgCostPerFill,
    servicesLogged,
    kmTracked,
    costPerKm,
    dateRangeLabel: 'Last 6 Months (180 Days)',
  };
}

/**
 * Section 7D: Four Visual Performance Tiers
 * - 0–5% below leader: Green (Tier 1)
 * - More than 5–15%: Orange (Tier 2)
 * - More than 15–30%: Yellow (Tier 3)
 * - More than 30%: Red (Tier 4)
 */
export type EfficiencyPerformanceTier = 'tier1_green' | 'tier2_orange' | 'tier3_yellow' | 'tier4_red';

export interface PerformanceTierInfo {
  tier: EfficiencyPerformanceTier;
  colorKey: 'tierGreen' | 'tierOrange' | 'tierYellow' | 'tierRed';
  bgKey: 'tierGreenBg' | 'tierOrangeBg' | 'tierYellowBg' | 'tierRedBg';
  label: string;
}

export function getEfficiencyPerformanceTier(percentBelowLeader: number): PerformanceTierInfo {
  if (percentBelowLeader <= 5) {
    return {
      tier: 'tier1_green',
      colorKey: 'tierGreen',
      bgKey: 'tierGreenBg',
      label: 'Optimal',
    };
  }
  if (percentBelowLeader <= 15) {
    return {
      tier: 'tier2_orange',
      colorKey: 'tierOrange',
      bgKey: 'tierOrangeBg',
      label: 'Moderate',
    };
  }
  if (percentBelowLeader <= 30) {
    return {
      tier: 'tier3_yellow',
      colorKey: 'tierYellow',
      bgKey: 'tierYellowBg',
      label: 'Significant',
    };
  }
  return {
    tier: 'tier4_red',
    colorKey: 'tierRed',
    bgKey: 'tierRedBg',
    label: 'Substantial',
  };
}

/**
 * Section 7C: Compatible Fuel Grouping for Fleet Comparison
 * Group compatible fuel types so km/L is not compared directly with km/kWh!
 */
export type EfficiencyFuelGroup = 'liquid' | 'cng_lpg' | 'electric' | 'hybrid';

export function getVehicleEfficiencyGroup(fuelType?: string | null): {
  group: EfficiencyFuelGroup;
  groupLabel: string;
  unit: string;
} {
  const lower = (fuelType || '').toLowerCase();
  if (lower.includes('electric') || lower === 'ev') {
    return { group: 'electric', groupLabel: '⚡ Electric Powertrains', unit: 'km/kWh' };
  }
  if (lower.includes('cng') || lower.includes('lpg')) {
    if (lower.includes('petrol') || lower.includes('hybrid')) {
      return { group: 'hybrid', groupLabel: '🟢 Dual-Fuel / Hybrids', unit: 'km/kg & km/L' };
    }
    return { group: 'cng_lpg', groupLabel: '🟢 Gas Powertrains (CNG/LPG)', unit: 'km/kg' };
  }
  return { group: 'liquid', groupLabel: '⛽ Liquid Fuel (Petrol & Diesel)', unit: 'km/L' };
}
