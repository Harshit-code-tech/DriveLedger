/**
 * Mileage Calculation Engine
 *
 * THE HEART OF THE APP. This is the core value proposition.
 *
 * Calculates mileage/efficiency for vehicles based on their fuel type.
 * Uses different formulas depending on the fuel type:
 *   - Petrol / Diesel / Hybrid → km/L (tank-to-tank method)
 *   - CNG / LPG               → km/kg (tank-to-tank method)
 *   - Electric                 → km/kWh (charge-to-charge method)
 *
 * ═══════════════════════════════════════════════════════════════════
 * TANK-TO-TANK RULES (Petrol / Diesel / CNG / LPG / Hybrid)
 * ═══════════════════════════════════════════════════════════════════
 *
 * R1: Current entry MUST be a full tank fill.
 * R2: A previous full-tank entry MUST exist for the same vehicle.
 * R3: Partial fills are RECORDED but SKIPPED in mileage calculation.
 * R4: Fuel filled across partial fills between two full tanks is
 *     ACCUMULATED and included in the next full-tank calculation.
 * R5: Calculated mileage is STORED on each qualifying fuel entry.
 * R6: Running average = arithmetic mean of all stored calculated_mileage.
 * R7: If fewer than two full-tank entries exist, display "Not enough data."
 * R8: Monthly average = mean of calculated_mileage in the current month.
 * R9: Best / Worst = highest / lowest single calculated_mileage value.
 *
 * ═══════════════════════════════════════════════════════════════════
 * EV RULES
 * ═══════════════════════════════════════════════════════════════════
 *
 * EV-R1: Every charge session is logged. No full/partial distinction.
 * EV-R2: Efficiency is calculated between every two consecutive charges.
 * EV-R3: Running average = mean of all stored efficiency values.
 *
 * ═══════════════════════════════════════════════════════════════════
 * EXAMPLE (Petrol/Diesel)
 * ═══════════════════════════════════════════════════════════════════
 *
 * Entry 1: Odometer 10,000 | 30L | Full Tank → no mileage (first fill)
 * Entry 2: Odometer 10,200 |  8L | Partial   → skipped (partial)
 * Entry 3: Odometer 10,500 | 22L | Full Tank → 500 / (8+22) = 16.67 km/L
 *
 * Entry 3 accumulates the partial (8L) + current (22L) and divides
 * by distance from entry 1 (10,500 - 10,000 = 500 km).
 */

import { FuelType, FuelUnit, FUEL_UNIT_TO_MILEAGE_UNIT, MileageUnit, isHybridFuel } from '@/constants/fuelTypes';
import { VehicleType } from '@/constants/fuelTypes';
import type { FuelEntry } from '@/types/fuel';

// ─── Types ───────────────────────────────────────────────────────────

export interface MileageResult {
  /** The calculated mileage value (km/L, km/kg, or km/kWh) */
  value: number;
  /** The unit of the mileage value */
  unit: MileageUnit;
  /**
   * If true, this is an ESTIMATED mileage from a partial fill.
   * It's calculated as (distance since last entry) / (fuel added last fill).
   * It is mathematically imprecise because we don't know the exact starting
   * fuel level in the tank. Show with a ~ prefix and 'est.' label.
   */
  isEstimate?: boolean;
}

export interface MileageStats {
  /** Last fill's mileage (most recent calculation) */
  lastFillMileage: MileageResult | null;
  /** Running average across all calculated entries */
  runningAverage: MileageResult | null;
  /** Average for the current calendar month */
  monthlyAverage: MileageResult | null;
  /** Highest single mileage value ever recorded */
  best: MileageResult | null;
  /** Lowest single mileage value ever recorded */
  worst: MileageResult | null;
  /** For Bi-Fuel (Hybrid) vehicles: separate statistics for primary system (e.g. CNG) */
  primarySystemStats?: {
    runningAverage: MileageResult | null;
    best: MileageResult | null;
    worst: MileageResult | null;
  } | null;
  /** For Bi-Fuel (Hybrid) vehicles: separate statistics for secondary system (e.g. Petrol) */
  secondarySystemStats?: {
    runningAverage: MileageResult | null;
    best: MileageResult | null;
    worst: MileageResult | null;
  } | null;
  /** Blended total running cost per km across all fuel systems (₹/km) */
  costPerKm?: number | null;
}

export interface MileageWarning {
  type: 'suspiciously_high' | 'suspiciously_low';
  message: string;
  value: number;
  threshold: number;
}

// ─── Reasonableness Thresholds ──────────────────────────────────────
/**
 * Vehicle-type-aware thresholds for mileage sanity checks.
 *
 * WHY different thresholds per vehicle type?
 * A two-wheeler in India routinely achieves 60-80 km/L. A global
 * car-centric threshold (e.g., > 30 km/L is suspicious) would
 * incorrectly flag every two-wheeler fill-up as suspicious.
 */

interface MileageThreshold {
  high: number;
  low: number;
  unit: string;
}

const MILEAGE_THRESHOLDS: Record<string, MileageThreshold> = {
  // VehicleType + FuelUnit combinations
  'car_litres':          { high: 30, low: 4,  unit: 'km/L' },
  'car_kg':              { high: 60, low: 5,  unit: 'km/kg' },
  'car_kWh':             { high: 15, low: 2,  unit: 'km/kWh' },
  'two_wheeler_litres':  { high: 100, low: 20, unit: 'km/L' },
  'two_wheeler_kg':      { high: 60, low: 5,  unit: 'km/kg' },
  'three_wheeler_litres':{ high: 60, low: 10, unit: 'km/L' },
  'three_wheeler_kg':    { high: 60, low: 5,  unit: 'km/kg' },
  'other_litres':        { high: 30, low: 4,  unit: 'km/L' },
  'other_kg':            { high: 60, low: 5,  unit: 'km/kg' },
  'other_kWh':           { high: 15, low: 2,  unit: 'km/kWh' },
};

// ─── Core Calculation ───────────────────────────────────────────────

/**
 * Calculates mileage for a single fuel entry using the tank-to-tank method.
 *
 * This function walks backwards through the entry chain to find the
 * previous full-tank entry and accumulates all partial fills in between.
 *
 * @param entries - ALL fuel entries for the vehicle, sorted by odometer ASC
 * @param currentIndex - Index of the entry to calculate mileage for
 * @param fuelType - The vehicle's fuel type (determines the formula)
 * @returns The calculated mileage result, or null if not calculable
 */
export function calculateMileageForEntry(
  entries: FuelEntry[],
  currentIndex: number,
  fuelType: FuelType
): MileageResult | null {
  const current = entries[currentIndex];

  // ── EV: charge-to-charge (no full/partial concept) ──
  if (fuelType === FuelType.ELECTRIC) {
    return calculateEVEfficiency(entries, currentIndex);
  }

  // ── Petrol / Diesel / CNG / LPG / Hybrid: tank-to-tank ──

  // R1: Current entry must be a valid full tank fill with positive odometer and fuel
  if (
    current.is_full_tank !== 1 ||
    current.odometer == null ||
    current.odometer <= 0 ||
    current.fuel_amount == null ||
    current.fuel_amount <= 0
  ) {
    return null;
  }

  const isHybrid = isHybridFuel(fuelType);
  const currentSystem = current.fuel_system ?? (current.fuel_unit === FuelUnit.KG ? 'primary' : (isHybrid ? 'secondary' : 'primary'));

  // R2: Walk backwards to find the previous full-tank entry of the SAME fuel system
  let previousFullTankIndex = -1;
  let accumulatedFuel = 0;

  for (let i = currentIndex - 1; i >= 0; i--) {
    const entrySystem = entries[i].fuel_system ?? (entries[i].fuel_unit === FuelUnit.KG ? 'primary' : (isHybrid ? 'secondary' : 'primary'));
    if (isHybrid && entrySystem !== currentSystem) {
      // In dual-fuel vehicles, do not accumulate fuel from the other tank
      continue;
    }

    const entryAmount = entries[i].fuel_amount;
    const entryOdo = entries[i].odometer;
    if (entryAmount == null || entryAmount <= 0 || entryOdo == null || entryOdo <= 0) {
      // Incomplete or invalid data in the measurement interval
      return null;
    }

    // R4: Accumulate fuel from partial fills
    accumulatedFuel += entryAmount;

    if (entries[i].is_full_tank === 1) {
      previousFullTankIndex = i;
      break;
    }
  }

  // R7: No previous full-tank entry exists
  if (previousFullTankIndex === -1) {
    return null;
  }

  const previousFullTank = entries[previousFullTankIndex];

  // Distance between the two full-tank entries
  const distance = current.odometer - previousFullTank.odometer;

  if (distance <= 0) {
    return null;
  }

  // Total fuel consumed between the two full-tank fills:
  // All fuel from entries AFTER the previous full tank through current entry,
  // excluding the previous full tank's own fuel (consumed before its odometer).
  const totalFuel = accumulatedFuel + current.fuel_amount - previousFullTank.fuel_amount;

  if (totalFuel <= 0) {
    return null;
  }

  const mileage = distance / totalFuel;
  const unit = FUEL_UNIT_TO_MILEAGE_UNIT[current.fuel_unit];

  return { value: mileage, unit };
}

/**
 * Calculates an ESTIMATED mileage for a partial fill entry.
 *
 * This is an approximation: distance since the previous entry divided by
 * fuel added in the current fill (representing the fuel added to replenish the interval).
 * Always flag with isEstimate: true.
 *
 * @param entries - ALL fuel entries for the vehicle, sorted by odometer ASC
 * @param currentIndex - Index of the entry to estimate mileage for
 * @returns Estimated MileageResult with isEstimate=true, or null if not calculable
 */
export function calculatePartialEstimate(
  entries: FuelEntry[],
  currentIndex: number,
  fuelType?: FuelType
): MileageResult | null {
  if (currentIndex === 0) return null; // No previous entry to measure distance from

  const current = entries[currentIndex];

  // Don't estimate for EV (every EV entry is already accurate charge-to-charge)
  // Don't estimate for full-tank entries (they get accurate calculation)
  if (current.is_full_tank === 1) return null;

  const isHybrid = fuelType ? isHybridFuel(fuelType) : false;
  const currentSystem = current.fuel_system ?? (current.fuel_unit === FuelUnit.KG ? 'primary' : (isHybrid ? 'secondary' : 'primary'));

  let previousIndex = -1;
  if (isHybrid) {
    for (let i = currentIndex - 1; i >= 0; i--) {
      const entrySystem = entries[i].fuel_system ?? (entries[i].fuel_unit === FuelUnit.KG ? 'primary' : 'secondary');
      if (entrySystem === currentSystem) {
        previousIndex = i;
        break;
      }
    }
  } else {
    previousIndex = currentIndex - 1;
  }

  if (previousIndex === -1) return null;

  const previous = entries[previousIndex];

  const distance = current.odometer - previous.odometer;
  if (distance <= 0) return null;

  const fuel = current.fuel_amount;
  if (fuel <= 0) return null;

  const mileage = distance / fuel;
  const unit = FUEL_UNIT_TO_MILEAGE_UNIT[current.fuel_unit];

  return { value: mileage, unit, isEstimate: true };
}

/**
 * Calculates EV efficiency between two consecutive charge sessions.
 *
 * EV-R1: Every charge session is logged (no full/partial distinction).
 * EV-R2: Efficiency = distance / kWh charged between consecutive sessions.
 */
function calculateEVEfficiency(
  entries: FuelEntry[],
  currentIndex: number
): MileageResult | null {
  if (currentIndex === 0) {
    return null; // First charge — no previous reference point
  }

  const current = entries[currentIndex];
  const previous = entries[currentIndex - 1];

  if (
    current.odometer == null ||
    previous.odometer == null ||
    current.odometer <= 0 ||
    previous.odometer <= 0
  ) {
    return null;
  }

  const distance = current.odometer - previous.odometer;
  if (distance <= 0) return null;

  const kWh = current.fuel_amount;
  if (kWh == null || kWh <= 0) return null;

  const efficiency = distance / kWh;

  return {
    value: efficiency,
    unit: MileageUnit.KM_PER_KWH,
  };
}

// ─── Batch Recalculation ────────────────────────────────────────────

/**
 * Recalculates mileage for entries from startIndex to the end of the chronological chain.
 * Entries before startIndex are guaranteed to be unaffected because tank-to-tank
 * calculation only walks backwards.
 *
 * @param entries - ALL non-deleted fuel entries for the vehicle, sorted by odometer ASC
 * @param startIndex - The earliest index affected by a creation, edit, or deletion
 * @param fuelType - The vehicle's fuel type
 * @returns Array of { entryId, mileage, index } pairs for indices >= startIndex
 */
export function recalculateDownstreamMileage(
  entries: FuelEntry[],
  startIndex: number,
  fuelType: FuelType
): Array<{ entryId: string; mileage: MileageResult | null; index: number }> {
  const safeStart = Math.max(0, startIndex);
  const results: Array<{ entryId: string; mileage: MileageResult | null; index: number }> = [];

  for (let i = safeStart; i < entries.length; i++) {
    results.push({
      entryId: entries[i].id,
      mileage: calculateMileageForEntry(entries, i, fuelType),
      index: i,
    });
  }

  return results;
}

/**
 * Recalculates mileage for ALL entries of a vehicle.
 * Called when a fuel entry is edited or deleted, which may affect
 * downstream calculations in the chain.
 *
 * @param entries - ALL non-deleted fuel entries for the vehicle, sorted by odometer ASC
 * @param fuelType - The vehicle's fuel type
 * @returns Array of { entryId, mileage } pairs to be persisted
 */
export function recalculateAllMileage(
  entries: FuelEntry[],
  fuelType: FuelType
): Array<{ entryId: string; mileage: MileageResult | null }> {
  return recalculateDownstreamMileage(entries, 0, fuelType).map(({ entryId, mileage }) => ({
    entryId,
    mileage,
  }));
}

// ─── Statistics ─────────────────────────────────────────────────────

/**
 * Computes total distance and total fuel consumed across all valid completed full-tank intervals.
 * Used for mathematically sound, weighted running average mileage (km / L or km / kg).
 */
export function computeCompletedIntervalTotals(
  entries: FuelEntry[],
  targetSystem?: 'primary' | 'secondary'
): { distance: number; fuel: number } {
  const sorted = [...entries].sort((a, b) => a.odometer - b.odometer);
  let totalDistance = 0;
  let totalFuel = 0;

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    if (
      current.is_full_tank !== 1 ||
      current.calculated_mileage == null ||
      current.calculated_mileage <= 0
    ) {
      continue;
    }

    const currentSys =
      current.fuel_system ?? (current.fuel_unit === FuelUnit.KG ? 'primary' : 'secondary');
    if (targetSystem && currentSys !== targetSystem) {
      continue;
    }

    let prevFullIndex = -1;
    let accumulatedFuel = 0;

    for (let j = i - 1; j >= 0; j--) {
      const prev = sorted[j];
      const prevSys =
        prev.fuel_system ?? (prev.fuel_unit === FuelUnit.KG ? 'primary' : 'secondary');
      if (targetSystem && prevSys !== currentSys) {
        continue;
      }

      accumulatedFuel += prev.fuel_amount;
      if (prev.is_full_tank === 1) {
        prevFullIndex = j;
        break;
      }
    }

    if (prevFullIndex !== -1) {
      const prevFull = sorted[prevFullIndex];
      const d = current.odometer - prevFull.odometer;
      const f = accumulatedFuel + current.fuel_amount - prevFull.fuel_amount;
      if (d > 0 && f > 0) {
        totalDistance += d;
        totalFuel += f;
      }
    }
  }

  return { distance: totalDistance, fuel: totalFuel };
}

/**
 * Computes all mileage statistics for a vehicle.
 *
 * @param entries - ALL non-deleted fuel entries for the vehicle (any order)
 * @returns MileageStats object with running average, monthly average, best/worst
 */
export function computeMileageStats(entries: FuelEntry[], fuelType?: FuelType): MileageStats {
  const isHybrid = fuelType ? isHybridFuel(fuelType) : false;

  // Filter to entries that have a calculated_mileage value
  const withMileage = entries.filter(
    (e) => e.calculated_mileage !== null
  );

  // Compute blended cost-per-km across all fuel fills
  let costPerKm: number | null = null;
  if (entries.length >= 2) {
    const sortedAll = [...entries].sort((a, b) => a.odometer - b.odometer);
    const totalDistance = sortedAll[sortedAll.length - 1].odometer - sortedAll[0].odometer;
    const totalCost = entries.reduce((sum, e) => sum + e.total_cost, 0);
    if (totalDistance > 0 && totalCost > 0) {
      costPerKm = totalCost / totalDistance;
    }
  }

  if (withMileage.length === 0) {
    return {
      lastFillMileage: null,
      runningAverage: null,
      monthlyAverage: null,
      best: null,
      worst: null,
      primarySystemStats: null,
      secondarySystemStats: null,
      costPerKm,
    };
  }

  // Sort by date descending for "last fill"
  const sorted = [...withMileage].sort(
    (a, b) => b.odometer - a.odometer
  );

  const lastEntry = sorted[0];
  const unit = (lastEntry.mileage_unit ??
    FUEL_UNIT_TO_MILEAGE_UNIT[lastEntry.fuel_unit] ??
    MileageUnit.KM_PER_LITRE) as MileageUnit;

  // R6: Weighted running average across completed intervals if reconstructible, else arithmetic mean
  const allValues = withMileage.map((e) => e.calculated_mileage!);
  const completedTotals = computeCompletedIntervalTotals(entries);
  const runningAvg =
    completedTotals.distance > 0 && completedTotals.fuel > 0
      ? completedTotals.distance / completedTotals.fuel
      : allValues.reduce((sum, v) => sum + v, 0) / allValues.length;

  // R8: Monthly average = mean of values in the current calendar month
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthlyValues = withMileage
    .filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .map((e) => e.calculated_mileage!);
  const monthlyAvg =
    monthlyValues.length > 0
      ? monthlyValues.reduce((sum, v) => sum + v, 0) / monthlyValues.length
      : null;

  // R9: Best / Worst
  const best = Math.max(...allValues);
  const worst = Math.min(...allValues);

  // Hybrid separate streams
  let primarySystemStats = null;
  let secondarySystemStats = null;

  if (isHybrid) {
    const primaryEntries = withMileage.filter((e) => (e.fuel_system ?? (e.fuel_unit === FuelUnit.KG ? 'primary' : 'secondary')) === 'primary');
    if (primaryEntries.length > 0) {
      const pVals = primaryEntries.map((e) => e.calculated_mileage!);
      const pUnit = primaryEntries[0].mileage_unit as MileageUnit;
      const pTotals = computeCompletedIntervalTotals(entries, 'primary');
      const pAvg =
        pTotals.distance > 0 && pTotals.fuel > 0
          ? pTotals.distance / pTotals.fuel
          : pVals.reduce((a, b) => a + b, 0) / pVals.length;
      primarySystemStats = {
        runningAverage: { value: pAvg, unit: pUnit },
        best: { value: Math.max(...pVals), unit: pUnit },
        worst: { value: Math.min(...pVals), unit: pUnit },
      };
    }

    const secondaryEntries = withMileage.filter((e) => (e.fuel_system ?? (e.fuel_unit === FuelUnit.KG ? 'primary' : 'secondary')) === 'secondary');
    if (secondaryEntries.length > 0) {
      const sVals = secondaryEntries.map((e) => e.calculated_mileage!);
      const sUnit = secondaryEntries[0].mileage_unit as MileageUnit;
      const sTotals = computeCompletedIntervalTotals(entries, 'secondary');
      const sAvg =
        sTotals.distance > 0 && sTotals.fuel > 0
          ? sTotals.distance / sTotals.fuel
          : sVals.reduce((a, b) => a + b, 0) / sVals.length;
      secondarySystemStats = {
        runningAverage: { value: sAvg, unit: sUnit },
        best: { value: Math.max(...sVals), unit: sUnit },
        worst: { value: Math.min(...sVals), unit: sUnit },
      };
    }
  }

  return {
    lastFillMileage: {
      value: lastEntry.calculated_mileage!,
      unit,
    },
    runningAverage: {
      value: runningAvg,
      unit,
    },
    monthlyAverage: monthlyAvg !== null ? { value: monthlyAvg, unit } : null,
    best: { value: best, unit },
    worst: { value: worst, unit },
    primarySystemStats,
    secondarySystemStats,
    costPerKm,
  };
}

// ─── Reasonableness Check ───────────────────────────────────────────

/**
 * Checks if a calculated mileage value is within reasonable bounds.
 * Returns a warning if suspicious — but NEVER blocks saving.
 *
 * @param mileage - The calculated mileage value
 * @param vehicleType - The vehicle type (car, two_wheeler, etc.)
 * @param fuelUnit - The fuel unit (litres, kg, kWh)
 * @returns A warning object if suspicious, null if reasonable
 */
export function checkMileageReasonableness(
  mileage: number,
  vehicleType: VehicleType,
  fuelUnit: FuelUnit
): MileageWarning | null {
  const key = `${vehicleType}_${fuelUnit}`;
  const threshold = MILEAGE_THRESHOLDS[key];

  if (!threshold) return null; // No threshold defined for this combination

  if (mileage > threshold.high) {
    return {
      type: 'suspiciously_high',
      message: `${mileage.toFixed(1)} ${threshold.unit} seems unusually high. Please verify your entries.`,
      value: mileage,
      threshold: threshold.high,
    };
  }

  if (mileage < threshold.low) {
    return {
      type: 'suspiciously_low',
      message: `${mileage.toFixed(1)} ${threshold.unit} seems unusually low. Your vehicle may need attention.`,
      value: mileage,
      threshold: threshold.low,
    };
  }

  return null;
}
