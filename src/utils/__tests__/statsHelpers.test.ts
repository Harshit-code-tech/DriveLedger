/**
 * Tests for statsHelpers utilities
 *
 * Verifies monthly cost computation, current month totals,
 * and the 6-month spending history chart data.
 */

import {
  getMonthlyTotalSpend,
  getCurrentMonthTotalSpend,
  getMonthlySpendHistory,
  estimateFuelLevel,
} from '../statsHelpers';

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
    const result = getMonthlyTotalSpend([], [], [], 6, 2026);
    expect(result.fuel).toBe(0);
    expect(result.service).toBe(0);
    expect(result.expense).toBe(0);
    expect(result.total).toBe(0);
  });

  it('handles null service costs gracefully', () => {
    const services = [
      makeServiceRecord('2026-07-15', null),
      makeServiceRecord('2026-07-20', 1000),
    ];
    const result = getMonthlyTotalSpend([], services, [], 6, 2026);
    expect(result.service).toBe(1000);
  });
});

describe('getCurrentMonthTotalSpend', () => {
  it('computes the current month total', () => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;

    const entries = [makeFuelEntry(thisMonth, 1500)];
    const services = [makeServiceRecord(thisMonth, 2000)];
    const expenses = [makeExpense(thisMonth, 500)];

    const result = getCurrentMonthTotalSpend(entries, services, expenses);
    expect(result.total).toBe(4000);
  });

  it('ignores records from other months', () => {
    const entries = [makeFuelEntry('2020-01-15', 1500)];
    const result = getCurrentMonthTotalSpend(entries, [], []);
    expect(result.total).toBe(0);
  });
});

describe('getMonthlySpendHistory', () => {
  it('returns the requested number of months', () => {
    const result = getMonthlySpendHistory([], [], [], 6);
    expect(result).toHaveLength(6);
  });

  it('returns month labels', () => {
    const result = getMonthlySpendHistory([], [], [], 3);
    expect(result).toHaveLength(3);
    // All values should be 0 with no data
    result.forEach((item) => {
      expect(item.value).toBe(0);
      expect(typeof item.label).toBe('string');
      expect(item.label.length).toBeGreaterThan(0);
    });
  });

  it('correctly sums entries into their respective months', () => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;

    const entries = [makeFuelEntry(thisMonth, 2000)];
    const result = getMonthlySpendHistory(entries, [], [], 1);

    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(2000);
  });

  it('defaults to 6 months', () => {
    const result = getMonthlySpendHistory([], [], []);
    expect(result).toHaveLength(6);
  });
});

describe('estimateFuelLevel', () => {
  it('estimates remaining fuel and range accurately for single fuel', () => {
    const entries = [
      { odometer: 10000, fuel_amount: 35, is_full_tank: 1 } as any,
    ];
    // Driven 100 km since 10000 (odo 10100) with avg 20 km/L in 35 L tank
    // Consumed: 100 / 20 = 5 L -> remaining = 30 L (85.7% -> 4 bars Good)
    const level = estimateFuelLevel(entries, 35, 10100, 20, 'L');
    expect(level).not.toBeNull();
    expect(level?.remainingLitres).toBe(30);
    expect(level?.kmRemaining).toBe(600);
    expect(level?.bars).toBe(4);
    expect(level?.label).toBe('Good');
  });

  it('correctly filters entries by targetSystem for bi-fuel vehicles', () => {
    const entries = [
      // Newest Petrol fill
      { odometer: 20250, fuel_amount: 15, is_full_tank: 1, fuel_system: 'secondary', fuel_unit: 'litres' } as any,
      // Older CNG fill
      { odometer: 20200, fuel_amount: 8, is_full_tank: 1, fuel_system: 'primary', fuel_unit: 'kg' } as any,
    ];

    // Current odo: 20300
    // Primary (CNG): last full at 20200 -> 100 km driven. Avg: 25 km/kg. Consumed = 4 kg.
    // Tank capacity = 10 kg -> remaining = 6 kg (60% -> 3 bars Half)
    const cngLevel = estimateFuelLevel(entries, 10, 20300, 25, 'kg', 'primary');
    expect(cngLevel).not.toBeNull();
    expect(cngLevel?.remainingLitres).toBe(6);
    expect(cngLevel?.kmRemaining).toBe(150);
    expect(cngLevel?.unit).toBe('kg');

    // Secondary (Petrol): last full at 20250 -> 50 km driven. Avg: 16 km/L. Consumed = 3.125 L.
    // Tank capacity = 35 L -> remaining = 31.875 L (91% -> 5 bars Full)
    const petrolLevel = estimateFuelLevel(entries, 35, 20300, 16, 'L', 'secondary');
    expect(petrolLevel).not.toBeNull();
    expect(petrolLevel?.remainingLitres).toBeCloseTo(31.88, 1);
    expect(petrolLevel?.unit).toBe('L');
    expect(petrolLevel?.bars).toBe(5);
  });

  it('returns null when no full tank exists or mileage is missing', () => {
    expect(estimateFuelLevel([], 35, 10000, 15)).toBeNull();
    expect(estimateFuelLevel([{ odometer: 1000, is_full_tank: 0, fuel_amount: 10 } as any], 35, 1050, 15)).toBeNull();
    expect(estimateFuelLevel([{ odometer: 1000, is_full_tank: 1, fuel_amount: 30 } as any], 35, 1050, 0)).toBeNull();
  });
});
