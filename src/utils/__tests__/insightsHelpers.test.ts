/**
 * Tests for insightsHelpers utilities
 *
 * Verifies monthly cost computation, current month totals,
 * fuel level estimation, time-range filtering, and the 6-month spending history chart data.
 */

import {
  getMonthlyTotalSpend,
  getCurrentMonthTotalSpend,
  getMonthlySpendHistory,
  estimateFuelLevel,
  filterRecordsByTimeRange,
  aggregateCostBreakdown,
} from '../insightsHelpers';

// Minimal mock types matching the interfaces used by the helpers
const makeFuelEntry = (date: string, total_cost: number) =>
  ({ date, total_cost } as any);

const makeServiceRecord = (date: string, cost: number | null) =>
  ({ date, cost } as any);

const makeExpense = (date: string, amount: number) =>
  ({ date, amount } as any);

describe('getMonthlyTotalSpend', () => {
  it('sums fuel, service, and expenses for a given month', () => {
    const entries = [
      makeFuelEntry('2026-07-10', 2000),
      makeFuelEntry('2026-07-20', 1500),
      makeFuelEntry('2026-08-05', 1000), // different month
    ];
    const services = [
      makeServiceRecord('2026-07-15', 5000),
    ];
    const expenses = [
      makeExpense('2026-07-01', 300),
      makeExpense('2026-06-28', 500), // different month
    ];

    const result = getMonthlyTotalSpend(entries, services, expenses, 6, 2026); // July = month 6

    expect(result.fuel).toBe(3500);
    expect(result.service).toBe(5000);
    expect(result.expense).toBe(300);
    expect(result.total).toBe(8800);
  });

  it('returns zeros for an empty month', () => {
    const result = getMonthlyTotalSpend([], [], [], 0, 2026);
    expect(result).toEqual({ fuel: 0, service: 0, expense: 0, total: 0 });
  });

  it('handles null service costs gracefully', () => {
    const services = [makeServiceRecord('2026-03-01', null)];
    const result = getMonthlyTotalSpend([], services, [], 2, 2026);
    expect(result.service).toBe(0);
    expect(result.total).toBe(0);
  });
});

describe('getCurrentMonthTotalSpend', () => {
  it('calls getMonthlyTotalSpend with current month and year', () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthStr = String(currentMonth + 1).padStart(2, '0');
    const entries = [makeFuelEntry(`${currentYear}-${monthStr}-10`, 1200)];

    const result = getCurrentMonthTotalSpend(entries, [], []);
    expect(result.fuel).toBe(1200);
    expect(result.total).toBe(1200);
  });
});

describe('getMonthlySpendHistory', () => {
  it('returns requested number of months (default 6)', () => {
    const result = getMonthlySpendHistory([], [], []);
    expect(result).toHaveLength(6);
  });

  it('returns N months when months parameter is provided', () => {
    const result = getMonthlySpendHistory([], [], [], 3);
    expect(result).toHaveLength(3);
  });

  it('places spend data in the correct month bucket', () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthStr = String(currentMonth + 1).padStart(2, '0');

    const entries = [makeFuelEntry(`${currentYear}-${monthStr}-05`, 2500)];
    const services = [makeServiceRecord(`${currentYear}-${monthStr}-15`, 1000)];
    const expenses = [makeExpense(`${currentYear}-${monthStr}-20`, 500)];

    const history = getMonthlySpendHistory(entries, services, expenses, 6);

    // Last element is the current month
    const latest = history[history.length - 1];
    expect(latest.fuel).toBe(2500);
    expect(latest.service).toBe(1000);
    expect(latest.expense).toBe(500);
    expect(latest.value).toBe(4000);
  });

  it('returns valid labels for each month', () => {
    const validMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const history = getMonthlySpendHistory([], [], [], 6);

    for (const point of history) {
      expect(validMonths).toContain(point.label);
      expect(typeof point.value).toBe('number');
      expect(typeof point.fuel).toBe('number');
      expect(typeof point.service).toBe('number');
      expect(typeof point.expense).toBe('number');
    }
  });
});

describe('estimateFuelLevel', () => {
  it('returns null if tankCapacity is null or <= 0', () => {
    expect(estimateFuelLevel([], null, 1000, 15)).toBeNull();
    expect(estimateFuelLevel([], 0, 1000, 15)).toBeNull();
  });

  it('returns null if entries array is empty', () => {
    expect(estimateFuelLevel([], 50, 1000, 15)).toBeNull();
  });

  it('returns null if currentOdometer or avgMileage is missing/invalid', () => {
    const entries = [{ is_full_tank: 1, odometer: 1000, fuel_amount: 50, date: '2026-01-01' } as any];
    expect(estimateFuelLevel(entries, 50, null, 15)).toBeNull();
    expect(estimateFuelLevel(entries, 50, 1000, null)).toBeNull();
    expect(estimateFuelLevel(entries, 50, 1000, 0)).toBeNull();
  });

  it('returns null if no full tank entry exists for ICE', () => {
    const entries = [{ is_full_tank: 0, odometer: 1000, fuel_amount: 20, date: '2026-01-01' } as any];
    expect(estimateFuelLevel(entries, 50, 1100, 15)).toBeNull();
  });

  it('calculates remaining fuel accurately after distance driven', () => {
    const entries = [
      { is_full_tank: 1, odometer: 1000, fuel_amount: 45, date: '2026-01-01' } as any,
    ];
    // Driven 150 km, mileage 15 km/L -> consumed 10L. Capacity 50L -> remaining 40L (80%)
    const result = estimateFuelLevel(entries, 50, 1150, 15);
    expect(result).not.toBeNull();
    expect(result?.remainingLitres).toBe(40);
    expect(result?.percent).toBe(80);
    expect(result?.bars).toBe(4);
    expect(result?.label).toBe('Good');
  });

  it('factors in partial fills added after the last full tank', () => {
    const entries = [
      { is_full_tank: 0, odometer: 1100, fuel_amount: 10, date: '2026-01-02' } as any, // partial fill
      { is_full_tank: 1, odometer: 1000, fuel_amount: 45, date: '2026-01-01' } as any, // full tank
    ];
    // Driven 150 km from 1000 -> 10L consumed. 50 + 10 partial - 10 consumed = 50L (100%)
    const result = estimateFuelLevel(entries, 50, 1150, 15);
    expect(result).not.toBeNull();
    expect(result?.remainingLitres).toBe(50);
    expect(result?.percent).toBe(100);
    expect(result?.bars).toBe(5);
    expect(result?.label).toBe('Full');
  });

  it('supports EV charging reference calculation', () => {
    const entries = [
      { is_full_tank: 1, battery_end_percent: 80, odometer: 5000, fuel_amount: 30, date: '2026-01-01' } as any,
    ];
    // EV capacity 60 kWh, charged to 80% = 48 kWh. Driven 60 km, efficiency 6 km/kWh -> consumed 10 kWh. Remaining = 38 kWh.
    const result = estimateFuelLevel(entries, 60, 5060, 6, 'kWh');
    expect(result).not.toBeNull();
    expect(result?.remainingLitres).toBeCloseTo(38, 0);
    expect(result?.unit).toBe('kWh');
  });
});

describe('filterRecordsByTimeRange', () => {
  const records = [
    { id: 1, date: '2026-07-15' },
    { id: 2, date: '2026-07-01' },
    { id: 3, date: '2026-05-10' },
    { id: 4, date: '2025-11-20' },
  ];
  const refDate = new Date(2026, 6, 20); // July 20, 2026

  it('returns all records when timeRange is all', () => {
    expect(filterRecordsByTimeRange(records, (r) => r.date, 'all', refDate)).toHaveLength(4);
  });

  it('filters to current month', () => {
    const filtered = filterRecordsByTimeRange(records, (r) => r.date, 'month', refDate);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((r) => r.id)).toEqual([1, 2]);
  });

  it('filters to last 6 months', () => {
    const filtered = filterRecordsByTimeRange(records, (r) => r.date, '6m', refDate);
    expect(filtered).toHaveLength(3);
    expect(filtered.map((r) => r.id)).toEqual([1, 2, 3]);
  });

  it('filters to last year', () => {
    const filtered = filterRecordsByTimeRange(records, (r) => r.date, 'year', refDate);
    expect(filtered).toHaveLength(4);
  });
});

describe('aggregateCostBreakdown', () => {
  it('correctly aggregates fuel, service, and categorized expenses', () => {
    const fuel = [makeFuelEntry('2026-01-01', 3000)];
    const services = [makeServiceRecord('2026-01-02', 2000)];
    const expenses = [
      { category: 'Insurance', amount: 5000, date: '2026-01-03' } as any,
      { category: 'Toll', amount: 200, date: '2026-01-04' } as any,
      { category: 'tyres', amount: 4000, date: '2026-01-05' } as any,
    ];

    const result = aggregateCostBreakdown(fuel, services, expenses, false);
    expect(result.totalCost).toBe(14200);
    expect(result.slices).toHaveLength(5);
    const keys = result.slices.map((s) => s.key);
    expect(keys).toContain('fuel');
    expect(keys).toContain('service');
    expect(keys).toContain('insurance');
    expect(keys).toContain('repairs');
    expect(keys).toContain('daily');
  });

  it('relabels fuel to Charging for EVs', () => {
    const fuel = [makeFuelEntry('2026-01-01', 500)];
    const result = aggregateCostBreakdown(fuel, [], [], true);
    expect(result.slices[0].label).toBe('Charging');
    expect(result.slices[0].icon).toBe('⚡');
  });
});
