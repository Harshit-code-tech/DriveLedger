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
import { computeMileageStats } from '@/engine/mileageEngine';
import { MILEAGE_UNIT_LABELS } from '@/constants/fuelTypes';
import type { FuelType } from '@/constants/fuelTypes';

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

    const summaries: VehicleSummary[] = vehicles.map((v) => {
      const vEntries = fuelRepo.getFuelEntriesByVehicleChronological(v.id);
      const svc      = serviceRepo.getServiceRecordsByVehicle(v.id);
      const exp      = expenseRepo.getExpensesByVehicle(v.id);

      const mStats   = computeMileageStats(vEntries, v.fuel_type as FuelType);
      const fuelCost = vEntries.reduce((s, e) => s + e.total_cost, 0);
      const svcCost  = svc.reduce((s, r) => s + (r.cost || 0), 0);
      const expCost  = exp.reduce((s, e) => s + e.amount, 0);

      // Compute monthly stats for each of the last 6 months
      const monthlyStats: Record<string, VehiclePeriodStats> = {};
      for (const mOpt of recentMonthOptions) {
        const mKey = mOpt.key;
        const mEntries = vEntries.filter((e) => e.date && e.date.startsWith(mKey));
        const mSvc = svc.filter((r) => r.date && r.date.startsWith(mKey));
        const mExp = exp.filter((e) => e.date && e.date.startsWith(mKey));

        const mFuelCost = mEntries.reduce((s, e) => s + e.total_cost, 0);
        const mSvcCost  = mSvc.reduce((s, r) => s + (r.cost || 0), 0);
        const mExpCost  = mExp.reduce((s, e) => s + e.amount, 0);

        // Mileage for this month: average calculated_mileage if available
        const entriesWithMileage = mEntries.filter((e) => e.calculated_mileage != null);
        const mAvgMileage = entriesWithMileage.length > 0
          ? entriesWithMileage.reduce((sum, e) => sum + e.calculated_mileage!, 0) / entriesWithMileage.length
          : null;

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
        avgMileage:      mStats.runningAverage?.value ?? null,
        mileageUnit:     mStats.runningAverage ? MILEAGE_UNIT_LABELS[mStats.runningAverage.unit] : null,
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
