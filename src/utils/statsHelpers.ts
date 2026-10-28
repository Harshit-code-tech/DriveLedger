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
import { EXPENSE_CHART_BUCKET } from '@/constants/expenseCategories';

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
 * Filters records to a specific month/year and sums a numeric field using fast prefix check.
 */
function sumByMonth<T>(
  records: T[],
  month: number,
  year: number,
  getDate: (record: T) => string,
  getAmount: (record: T) => number
): number {
  const targetPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  let sum = 0;
  for (let i = 0; i < records.length; i++) {
    const raw = getDate(records[i]);
    if (!raw) continue;
    if (raw.startsWith(targetPrefix)) {
      sum += getAmount(records[i]);
    } else if (raw.length > 7 && !raw.startsWith(String(year))) {
      const d = new Date(raw);
      if (d.getMonth() === month && d.getFullYear() === year) {
        sum += getAmount(records[i]);
      }
    }
  }
  return sum;
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

export interface MonthlySpendDataPoint {
  label: string;
  value: number;
  fuel: number;
  service: number;
  expense: number;
  fullLabel?: string;
}

/**
 * Computes monthly spending data for the last N months (for charts).
 * Uses a single-pass accumulator grouping by YYYY-MM to avoid repeated array scanning.
 */
export function getMonthlySpendHistory(
  entries: FuelEntry[],
  serviceRecords: ServiceRecord[],
  expenses: Expense[],
  months: number = 6
): MonthlySpendDataPoint[] {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fullMonthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const now = new Date();
  const keyToIndex = new Map<string, number>();
  const result: MonthlySpendDataPoint[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = monthDate.getMonth();
    const y = monthDate.getFullYear();
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    keyToIndex.set(key, result.length);
    result.push({
      label: monthNames[m],
      fullLabel: `${fullMonthNames[m]} ${y}`,
      value: 0,
      fuel: 0,
      service: 0,
      expense: 0,
    });
  }

  for (let i = 0; i < entries.length; i++) {
    const d = entries[i].date;
    if (!d) continue;
    const key = d.length >= 7 ? d.substring(0, 7) : '';
    const idx = keyToIndex.get(key);
    if (idx !== undefined) {
      result[idx].fuel += entries[i].total_cost;
    }
  }

  for (let i = 0; i < serviceRecords.length; i++) {
    const d = serviceRecords[i].date;
    if (!d) continue;
    const key = d.length >= 7 ? d.substring(0, 7) : '';
    const idx = keyToIndex.get(key);
    if (idx !== undefined) {
      result[idx].service += (serviceRecords[i].cost || 0);
    }
  }

  for (let i = 0; i < expenses.length; i++) {
    const d = expenses[i].date;
    if (!d) continue;
    const key = d.length >= 7 ? d.substring(0, 7) : '';
    const idx = keyToIndex.get(key);
    if (idx !== undefined) {
      result[idx].expense += expenses[i].amount;
    }
  }

  for (let i = 0; i < result.length; i++) {
    const total = result[i].fuel + result[i].service + result[i].expense;
    result[i].value = Math.round(total);
    result[i].fuel = Math.round(result[i].fuel);
    result[i].service = Math.round(result[i].service);
    result[i].expense = Math.round(result[i].expense);
  }

  return result;
}

// ─── Time Range Filtering ──────────────────────────────────────────

export type StatsTimeRange = 'month' | '6m' | 'year' | 'all';

/**
 * Filters records by the selected time range.
 *
 * @param records   Array of items to filter.
 * @param getDate   Accessor function returning the record's date string.
 * @param timeRange 'month' (current calendar month), '6m' (last 6 months), 'year' (last 12 months), or 'all'.
 * @param refDate   Optional reference date (defaults to new Date()).
 */
export function filterRecordsByTimeRange<T>(
  records: T[],
  getDate: (record: T) => string,
  timeRange: StatsTimeRange,
  refDate: Date = new Date()
): T[] {
  if (timeRange === 'all') return records;

  let cutoff: Date;
  if (timeRange === 'month') {
    cutoff = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
  } else if (timeRange === '6m') {
    cutoff = new Date(refDate.getFullYear(), refDate.getMonth() - 5, 1);
  } else if (timeRange === 'year') {
    cutoff = new Date(refDate.getFullYear() - 1, refDate.getMonth(), 1);
  } else {
    return records;
  }

  return records.filter((r) => {
    const d = new Date(getDate(r));
    return !isNaN(d.getTime()) && d >= cutoff;
  });
}

// ─── Cost Breakdown Aggregation ────────────────────────────────────

export interface CostCategorySlice {
  key: string;
  label: string;
  icon: string;
  amount: number;
  color: string;
}

/**
 * Aggregates fuel, service, and categorized expenses into 6 clean buckets
 * suitable for the Donut Chart and legend display.
 *
 * Category-to-bucket mapping is driven by EXPENSE_CHART_BUCKET in
 * expenseCategories.ts. To add a new category, update that file only.
 */
export function aggregateCostBreakdown(
  fuelEntries: FuelEntry[],
  serviceRecords: ServiceRecord[],
  expenses: Expense[],
  /** When true, relabels the fuel slice as "Charging" with ⚡ icon for electric vehicles. */
  isEV: boolean = false,
): { slices: CostCategorySlice[]; totalCost: number } {
  const fuelCost = fuelEntries.reduce((s, e) => s + (e.total_cost || 0), 0);
  const serviceCost = serviceRecords.reduce((s, r) => s + (r.cost || 0), 0);

  // Accumulate expenses into chart buckets using the typed constant map.
  // Unknown category ids fall through to 'other'.
  let insuranceCost = 0;
  let repairTyresCost = 0;
  let tollsDailyCost = 0;
  let otherCost = 0;

  for (const exp of expenses) {
    const catId = (exp.category || '').toLowerCase().trim();
    const bucket = EXPENSE_CHART_BUCKET[catId] ?? 'other';
    const amount = exp.amount || 0;

    switch (bucket) {
      case 'insurance': insuranceCost += amount; break;
      case 'repairs':   repairTyresCost += amount; break;
      case 'daily':     tollsDailyCost += amount; break;
      default:          otherCost += amount; break;
    }
  }

  const rawSlices: CostCategorySlice[] = [
    { key: 'fuel',      label: isEV ? 'Charging' : 'Fuel', icon: isEV ? '⚡' : '⛽', amount: fuelCost, color: '#3B82F6' },
    { key: 'service',   label: 'Service & Maintenance',icon: '🔧', amount: serviceCost,     color: '#10B981' },
    { key: 'insurance', label: 'Insurance & Taxes',    icon: '🛡️', amount: insuranceCost,   color: '#8B5CF6' },
    { key: 'repairs',   label: 'Repairs & Tyres',      icon: '🛠️', amount: repairTyresCost, color: '#F59E0B' },
    { key: 'daily',     label: 'Tolls & Daily Care',   icon: '🛣️', amount: tollsDailyCost,  color: '#EC4899' },
    { key: 'other',     label: 'Other Expenses',        icon: '📝', amount: otherCost,       color: '#64748B' },
  ];

  const slices = rawSlices.filter((s) => s.amount > 0);
  const totalCost = fuelCost + serviceCost + insuranceCost + repairTyresCost + tollsDailyCost + otherCost;

  return { slices, totalCost };
}

