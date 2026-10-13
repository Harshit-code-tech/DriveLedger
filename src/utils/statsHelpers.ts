/**
 * Stats Helpers
 *
 * Shared computation functions for monthly cost breakdowns
 * and fuel level estimation.
 * Extracted from dashboard (index.tsx) and stats screen (stats.tsx)
 * where the same filter-reduce pattern was duplicated.
 */

import type { FuelEntry } from '@/types/fuel';
import type { ServiceRecord } from '@/types/service';
import type { Expense } from '@/types/expense';

// ─── Fuel Level Estimation ───────────────────────────────────────────

export interface FuelLevelResult {
  /** Estimated fuel remaining as a percentage (0–100). */
  percent: number;
  /**
   * Number of filled bars to display out of 5.
   * 0 = empty (show all grey), 5 = full.
   */
  bars: number;
  /** Display label for the current level. */
  label: 'Empty' | 'Very Low' | 'Low' | 'Half' | 'Good' | 'Full';
  /** Hex color string for the bar and label. */
  color: string;
  /** Estimated fuel remaining in fuel units (litres, kg, or kWh) (>= 0). */
  remainingLitres: number;
  /** Estimated driving range left in km, based on running average mileage (>= 0). */
  kmRemaining: number;
  /** Unit of measurement (L, kg, or kWh). */
  unit: string;
}

/**
 * Estimates the vehicle's current fuel level as a percentage.
 *
 * ALGORITHM:
 *   1. Walk entries newest → oldest to find the last full-tank fill.
 *   2. Record the odometer at that full-tank fill.
 *   3. Sum any partial fills added AFTER the full tank (they increase remaining fuel).
 *   4. Use the current odometer to calculate km driven since the full fill.
 *   5. If running average mileage is known:
 *        estimated consumed = km_driven / avg_mileage
 *        remaining = tank_capacity + partials_added - consumed
 *   6. If no mileage available, we cannot estimate accurately → return null.
 *
 * NOTE: This is an approximation. Actual fuel consumption depends on
 * driving style, terrain, load, A/C usage, etc. Always display with
 * an "Est." label so users understand it's not a sensor reading.
 *
 * @param entries        Fuel entries for the vehicle, newest first (date DESC).
 * @param tankCapacity   Vehicle's full primary tank capacity.
 * @param currentOdometer Vehicle's current odometer reading in km.
 * @param avgMileage     Running average mileage (null if not yet calculated).
 * @param unitLabel      Unit string ('L', 'kg', 'kWh'). Defaults to 'L'.
 * @returns              FuelLevelResult or null if estimation is not possible.
 */
export function estimateFuelLevel(
  entries: FuelEntry[],
  tankCapacity: number | null,
  currentOdometer: number | null,
  avgMileage: number | null,
  unitLabel: string = 'L',
  targetSystem?: 'primary' | 'secondary'
): FuelLevelResult | null {
  // Cannot estimate without tank capacity or entries
  if (!tankCapacity || tankCapacity <= 0 || entries.length === 0) return null;
  // Cannot estimate consumption without odometer and mileage
  if (!currentOdometer || !avgMileage || avgMileage <= 0) return null;

  // Filter entries to the target system if specified (for Bi-Fuel vehicles)
  const systemEntries = targetSystem
    ? entries.filter(
        (e) => (e.fuel_system ?? (e.fuel_unit === 'kg' ? 'primary' : 'secondary')) === targetSystem
      )
    : entries;

  if (systemEntries.length === 0) return null;

  // Walk newest → oldest to find the last full-tank fill
  let lastFullTankOdometer: number | null = null;
  let partialsAddedAfterFull = 0;

  for (const entry of systemEntries) {
    if (entry.is_full_tank === 1) {
      lastFullTankOdometer = entry.odometer;
      break; // stop at first (newest) full tank
    }
    // Partial fill AFTER the last full tank — it added fuel to the tank
    partialsAddedAfterFull += entry.fuel_amount;
  }

  // If no full-tank entry exists, we have no reliable reference point
  if (lastFullTankOdometer === null) return null;

  // Distance driven since the last full tank
  const kmSinceFull = currentOdometer - lastFullTankOdometer;
  if (kmSinceFull < 0) return null; // odometer inconsistency

  // Fuel consumed since the last full tank (using running average)
  const estimatedConsumed = kmSinceFull / avgMileage;

  // Remaining = started full + topped up with partials - consumed
  const remaining = tankCapacity + partialsAddedAfterFull - estimatedConsumed;
  const percent = Math.min(100, Math.max(0, (remaining / tankCapacity) * 100));

  // Convert to 0–5 bars (0 = truly empty)
  const bars = Math.min(5, Math.round((percent / 100) * 5)) as 0 | 1 | 2 | 3 | 4 | 5;

  // Label and color per bar count
  const LEVEL_MAP: Record<number, { label: FuelLevelResult['label']; color: string }> = {
    0: { label: 'Empty',    color: '#EF4444' },
    1: { label: 'Very Low', color: '#EF4444' },
    2: { label: 'Low',      color: '#F97316' },
    3: { label: 'Half',     color: '#EAB308' },
    4: { label: 'Good',     color: '#84CC16' },
    5: { label: 'Full',     color: '#22C55E' },
  };

  const { label, color } = LEVEL_MAP[bars];
  const remainingLitres = Math.max(0, Math.min(tankCapacity, remaining));
  const kmRemaining = Math.round(remainingLitres * avgMileage);
  return { percent, bars, label, color, remainingLitres, kmRemaining, unit: unitLabel };
}

/**
 * Filters records to a specific month/year and sums a numeric field.
 */
function sumByMonth<T>(
  records: T[],
  month: number,
  year: number,
  getDate: (record: T) => string,
  getAmount: (record: T) => number
): number {
  return records
    .filter((r) => {
      const d = new Date(getDate(r));
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .reduce((sum, r) => sum + getAmount(r), 0);
}

/**
 * Computes the total spending for a given month across fuel, service, and expenses.
 */
export function getMonthlyTotalSpend(
  entries: FuelEntry[],
  serviceRecords: ServiceRecord[],
  expenses: Expense[],
  month: number,
  year: number
): { fuel: number; service: number; expense: number; total: number } {
  const fuel = sumByMonth(entries, month, year, (e) => e.date, (e) => e.total_cost);
  const service = sumByMonth(serviceRecords, month, year, (r) => r.date, (r) => r.cost || 0);
  const expense = sumByMonth(expenses, month, year, (e) => e.date, (e) => e.amount);
  return { fuel, service, expense, total: fuel + service + expense };
}

/**
 * Computes the current month's total spend.
 */
export function getCurrentMonthTotalSpend(
  entries: FuelEntry[],
  serviceRecords: ServiceRecord[],
  expenses: Expense[]
): { fuel: number; service: number; expense: number; total: number } {
  const now = new Date();
  return getMonthlyTotalSpend(entries, serviceRecords, expenses, now.getMonth(), now.getFullYear());
}

/**
 * Computes monthly spending data for the last N months (for charts).
 */
export function getMonthlySpendHistory(
  entries: FuelEntry[],
  serviceRecords: ServiceRecord[],
  expenses: Expense[],
  months: number = 6
): { label: string; value: number }[] {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const result: { label: string; value: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const { total } = getMonthlyTotalSpend(
      entries,
      serviceRecords,
      expenses,
      monthDate.getMonth(),
      monthDate.getFullYear()
    );
    result.push({ label: monthNames[monthDate.getMonth()], value: Math.round(total) });
  }

  return result;
}
