/**
 * useCrossVehicleStats Hook
 *
 * Computes a per-vehicle summary (avg mileage + total cost) for all active
 * vehicles. Used by the Fleet Comparison section in the Stats screen.
 *
 * WHY extracted from stats.tsx?
 * ─────────────────────────────
 * The original implementation called fuelRepo, serviceRepo, and expenseRepo
 * directly inside a useMemo in the Stats screen component. This:
 *   1. Made the Stats component responsible for multi-vehicle data loading
 *      (a concern that belongs at the data layer).
 *   2. Made the logic untestable in isolation.
 *   3. Called synchronous DB reads inside the render pipeline.
 *
 * This hook encapsulates the multi-vehicle query behind a stable interface,
 * making it easy to later swap for a Zustand store selector or a cached
 * background query.
 *
 * USAGE
 * ─────
 *   const crossVehicleStats = useCrossVehicleStats(vehicles);
 *   // Returns null if fewer than 2 vehicles, otherwise an array of summaries.
 */

import { useMemo } from 'react';
import type { Vehicle } from '@/types/vehicle';
import * as fuelRepo from '@/database/repositories/fuelRepo';
import * as serviceRepo from '@/database/repositories/serviceRepo';
import * as expenseRepo from '@/database/repositories/expenseRepo';
import { computeMileageStats } from '@/engine/mileageEngine';
import { MILEAGE_UNIT_LABELS } from '@/constants/fuelTypes';
import type { FuelType } from '@/constants/fuelTypes';

export interface VehicleSummary {
  id: string;
  name: string;
  /** Running average mileage, or null if not enough data. */
  avgMileage: number | null;
  /** Human-readable mileage unit label (e.g. 'km/L'), or null. */
  mileageUnit: string | null;
  /** Sum of all fuel + service + expense costs on record. */
  totalCost: number;
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

    const summaries = vehicles.map((v) => {
      // Direct synchronous DB reads — acceptable because expo-sqlite is
      // synchronous and these queries are small (bounded by number of entries).
      const vEntries = fuelRepo.getFuelEntriesByVehicleChronological(v.id);
      const svc      = serviceRepo.getServiceRecordsByVehicle(v.id);
      const exp      = expenseRepo.getExpensesByVehicle(v.id);

      const mStats   = computeMileageStats(vEntries, v.fuel_type as FuelType);
      const fuelCost = vEntries.reduce((s, e) => s + e.total_cost, 0);
      const svcCost  = svc.reduce((s, r) => s + (r.cost || 0), 0);
      const expCost  = exp.reduce((s, e) => s + e.amount, 0);

      return {
        id:          v.id,
        name:        v.nickname,
        avgMileage:  mStats.runningAverage?.value ?? null,
        mileageUnit: mStats.runningAverage ? MILEAGE_UNIT_LABELS[mStats.runningAverage.unit] : null,
        totalCost:   fuelCost + svcCost + expCost,
      };
    });

    // Only include vehicles that have at least some tracked data.
    const filtered = summaries.filter((d) => d.avgMileage !== null || d.totalCost > 0);
    return filtered.length >= 2 ? filtered : null;
  }, [vehicles]);
}
