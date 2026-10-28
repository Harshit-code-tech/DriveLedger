/**
 * useCrossVehicleStats Hook
 *
 * Computes a per-vehicle summary (avg mileage, total cost, and monthly spend breakdown)
 * for all active vehicles. Used by the Fleet Comparison section in the Stats screen.
 */

import { useMemo } from 'react';
import type { Vehicle } from '@/types/vehicle';
import * as fuelRepo from '@/database/repositories/fuelRepo';
import * as serviceRepo from '@/database/repositories/serviceRepo';
import * as expenseRepo from '@/database/repositories/expenseRepo';
import { MILEAGE_UNIT_LABELS, MileageUnit } from '@/constants/fuelTypes';

export interface VehiclePeriodStats {
  monthKey: string;     // e.g. "2026-10"
  monthLabel: string;   // e.g. "Oct 2026"
  totalCost: number;
  fuelCost: number;
  serviceCost: number;
  expenseCost: number;
  avgMileage: number | null;
}

export interface MonthOption {
  key: string;          // "all" | "2026-10" | etc.
  label: string;        // "All Time" | "Oct 2026" | etc.
}

export interface VehicleSummary {
  id: string;
  name: string;
  /** Running average mileage, or null if not enough data. */
  avgMileage: number | null;
  /** Human-readable mileage unit label (e.g. 'km/L'), or null. */
  mileageUnit: string | null;
  /** Sum of all fuel + service + expense costs on record. */
  totalCost: number;
  fuelCost: number;
  serviceCost: number;
  expenseCost: number;
  /** Per-month breakdown keyed by "YYYY-MM" */
  monthlyStats: Record<string, VehiclePeriodStats>;
  /** Available months with labels */
  availableMonths: MonthOption[];
}

/**
 * Returns per-vehicle stats for the fleet comparison card.
 *
 * @param vehicles - All active vehicles from vehicleStore.
 * @returns null if fewer than 2 vehicles, otherwise an array of VehicleSummary
 *          objects filtered to vehicles that have at least some data.
 */
export function useCrossVehicleStats(vehicles: Vehicle[]): VehicleSummary[] | null {
  return useMemo(() => {
    if (vehicles.length < 2) return null;

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();

    // Generate recent 6 months list: [Current Month, -1M, -2M, -3M, -4M, -5M]
    const recentMonthOptions: MonthOption[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      recentMonthOptions.push({
        key,
        label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
      });
    }

    const oldestMonthKey = recentMonthOptions[recentMonthOptions.length - 1]?.key;

    const summaries: VehicleSummary[] = vehicles.map((v) => {
      // 1. Fetch targeted summaries and 6-month aggregates directly from SQLite
      const fuelAgg = fuelRepo.getVehicleFuelAggregates(v.id, oldestMonthKey);
      const svcAgg = serviceRepo.getVehicleServiceAggregates(v.id, oldestMonthKey);
      const expAgg = expenseRepo.getVehicleExpenseAggregates(v.id, oldestMonthKey);
      const runningMileage = fuelRepo.getVehicleRunningMileage(v.id);

      const fuelCost = fuelAgg.totalCost;
      const svcCost = svcAgg.totalCost;
      const expCost = expAgg.totalCost;

      // 2. Assemble monthly stats for the 6 target months from aggregate maps
      const monthlyStats: Record<string, VehiclePeriodStats> = {};
      for (const mOpt of recentMonthOptions) {
        const mKey = mOpt.key;
        const mFuelCost = fuelAgg.monthlyAggregates[mKey]?.fuelCost ?? 0;
        const mSvcCost = svcAgg.monthlyAggregates[mKey]?.serviceCost ?? 0;
        const mExpCost = expAgg.monthlyAggregates[mKey]?.expenseCost ?? 0;
        const mAvgMileage = fuelAgg.monthlyAggregates[mKey]?.avgMileage ?? null;

        monthlyStats[mKey] = {
          monthKey: mKey,
          monthLabel: mOpt.label,
          totalCost: mFuelCost + mSvcCost + mExpCost,
          fuelCost: mFuelCost,
          serviceCost: mSvcCost,
          expenseCost: mExpCost,
          avgMileage: mAvgMileage,
        };
      }

      return {
        id:              v.id,
        name:            v.nickname,
        avgMileage:      runningMileage?.value ?? null,
        mileageUnit:     runningMileage?.unit ? MILEAGE_UNIT_LABELS[runningMileage.unit as MileageUnit] : null,
        totalCost:       fuelCost + svcCost + expCost,
        fuelCost,
        serviceCost:     svcCost,
        expenseCost:     expCost,
        monthlyStats,
        availableMonths: recentMonthOptions,
      };
    });

    // Only include vehicles that have at least some tracked data
    const filtered = summaries.filter((d) => d.avgMileage !== null || d.totalCost > 0);
    return filtered.length >= 2 ? filtered : null;
  }, [vehicles]);
}

