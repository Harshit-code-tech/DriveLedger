/**
 * Validation Engine Tests
 *
 * Tests for all validation functions in validationEngine.ts.
 * These are pure functions with no side-effects, so no mocking is required.
 *
 * Coverage targets:
 *   - validateFuelEntry: odometer, fuel amount, price, date, EV fields, hybrid fuel unit
 *   - validateVehicle: nickname, registration number
 *   - validateExpense: amount, date
 *   - hasWarningsOnly: correctly distinguishes warnings-only from errors
 *   - validateDateField (internal): exercises through the above validators
 */

import {
  validateFuelEntry,
  validateVehicle,
  validateExpense,
  hasWarningsOnly,
} from '../validationEngine';
import { FuelType, FuelUnit } from '../../constants/fuelTypes';

// ─── Helpers ──────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
const YESTERDAY = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
})();
const TOMORROW = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
})();

const BASE_FUEL_INPUT = {
  odometer: 10000,
  fuel_amount: 30,
  fuel_unit: FuelUnit.LITRES,
  price_per_unit: 100,
  date: TODAY,
};

// ─── validateFuelEntry ────────────────────────────────────────────────

describe('validateFuelEntry', () => {
  describe('odometer', () => {
    it('rejects odometer <= 0', () => {
      const result = validateFuelEntry(
        { ...BASE_FUEL_INPUT, odometer: 0 },
        null, null, FuelType.PETROL
      );
      expect(result.isValid).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'odometer', severity: 'error' }),
        ])
      );
    });

    it('rejects odometer below previous reading', () => {
      const result = validateFuelEntry(
        { ...BASE_FUEL_INPUT, odometer: 9000 },
        10000, null, FuelType.PETROL
      );
      expect(result.isValid).toBe(false);
      expect(result.issues[0]).toMatchObject({ field: 'odometer', severity: 'error' });
    });

    it('warns when odometer equals previous reading', () => {
      const result = validateFuelEntry(
        { ...BASE_FUEL_INPUT, odometer: 10000 },
        10000, null, FuelType.PETROL
      );
      expect(result.isValid).toBe(true); // warnings do not fail validation
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'odometer', severity: 'warning' }),
        ])
      );
    });

    it('passes valid odometer with no previous', () => {
      const result = validateFuelEntry(BASE_FUEL_INPUT, null, null, FuelType.PETROL);
      const odoIssues = result.issues.filter((i) => i.field === 'odometer');
      expect(odoIssues).toHaveLength(0);
    });

    it('passes odometer above previous reading', () => {
      const result = validateFuelEntry(
        { ...BASE_FUEL_INPUT, odometer: 10500 },
        10000, null, FuelType.PETROL
      );
      const odoIssues = result.issues.filter((i) => i.field === 'odometer');
      expect(odoIssues).toHaveLength(0);
    });
  });

  describe('fuel amount', () => {
    it('rejects fuel_amount <= 0', () => {
      const result = validateFuelEntry(
        { ...BASE_FUEL_INPUT, fuel_amount: 0 },
        null, null, FuelType.PETROL
      );
      expect(result.isValid).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'fuel_amount', severity: 'error' }),
        ])
      );
    });

    it('warns when fuel_amount exceeds tank capacity', () => {
      const result = validateFuelEntry(
        { ...BASE_FUEL_INPUT, fuel_amount: 60 },
        null, 45, FuelType.PETROL
      );
      expect(result.isValid).toBe(true);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'fuel_amount', severity: 'warning' }),
        ])
      );
    });

    it('passes fuel_amount within tank capacity', () => {
      const result = validateFuelEntry(
        { ...BASE_FUEL_INPUT, fuel_amount: 40 },
        null, 45, FuelType.PETROL
      );
      const amountIssues = result.issues.filter((i) => i.field === 'fuel_amount');
      expect(amountIssues).toHaveLength(0);
    });
  });

  describe('price per unit', () => {
    it('rejects price_per_unit <= 0', () => {
      const result = validateFuelEntry(
        { ...BASE_FUEL_INPUT, price_per_unit: 0 },
        null, null, FuelType.PETROL
      );
      expect(result.isValid).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'price_per_unit', severity: 'error' }),
        ])
      );
    });
  });

  describe('date validation (shared validateDateField logic)', () => {
    it('rejects empty date', () => {
      const result = validateFuelEntry(
        { ...BASE_FUEL_INPUT, date: '' },
        null, null, FuelType.PETROL
      );
      expect(result.isValid).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'date', severity: 'error' }),
        ])
      );
    });

    it('rejects invalid date string', () => {
      const result = validateFuelEntry(
        { ...BASE_FUEL_INPUT, date: 'not-a-date' },
        null, null, FuelType.PETROL
      );
      expect(result.isValid).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'date', severity: 'error', message: 'Invalid date format.' }),
        ])
      );
    });

    it('warns for future date but does not fail validation', () => {
      const result = validateFuelEntry(
        { ...BASE_FUEL_INPUT, date: TOMORROW },
        null, null, FuelType.PETROL
      );
      expect(result.isValid).toBe(true);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'date', severity: 'warning' }),
        ])
      );
    });

    it('passes for today and past dates', () => {
      for (const date of [TODAY, YESTERDAY]) {
        const result = validateFuelEntry(
          { ...BASE_FUEL_INPUT, date },
          null, null, FuelType.PETROL
        );
        const dateIssues = result.issues.filter((i) => i.field === 'date');
        expect(dateIssues).toHaveLength(0);
      }
    });
  });

  describe('EV-specific validation', () => {
    const EV_BASE = {
      ...BASE_FUEL_INPUT,
      fuel_unit: FuelUnit.KWH,
    };

    it('rejects non-kWh fuel unit for electric vehicles', () => {
      const result = validateFuelEntry(
        { ...BASE_FUEL_INPUT, fuel_unit: FuelUnit.LITRES },
        null, null, FuelType.ELECTRIC
      );
      expect(result.isValid).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'fuel_unit', severity: 'error' }),
        ])
      );
    });

    it('rejects battery_start_percent out of range', () => {
      const result = validateFuelEntry(
        { ...EV_BASE, battery_start_percent: -5 },
        null, null, FuelType.ELECTRIC
      );
      expect(result.isValid).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'battery_start_percent', severity: 'error' }),
        ])
      );
    });

    it('rejects battery_end_percent out of range', () => {
      const result = validateFuelEntry(
        { ...EV_BASE, battery_end_percent: 105 },
        null, null, FuelType.ELECTRIC
      );
      expect(result.isValid).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'battery_end_percent', severity: 'error' }),
        ])
      );
    });

    it('rejects end percent not greater than start percent', () => {
      const result = validateFuelEntry(
        { ...EV_BASE, battery_start_percent: 80, battery_end_percent: 60 },
        null, null, FuelType.ELECTRIC
      );
      expect(result.isValid).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'battery_end_percent', severity: 'error' }),
        ])
      );
    });

    it('passes valid EV entry with battery percentages', () => {
      const result = validateFuelEntry(
        { ...EV_BASE, battery_start_percent: 20, battery_end_percent: 90 },
        null, null, FuelType.ELECTRIC
      );
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('warns when energy charged exceeds battery capacity', () => {
      const result = validateFuelEntry(
        { ...EV_BASE, fuel_amount: 50 },
        null, 40.5, FuelType.ELECTRIC
      );
      expect(result.isValid).toBe(true);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'fuel_amount',
            severity: 'warning',
            message: 'Energy charged (50 kWh) exceeds the battery capacity (40.5 kWh). Are you sure?',
          }),
        ])
      );
    });

    it('rejects energy charged <= 0 for electric vehicle', () => {
      const result = validateFuelEntry(
        { ...EV_BASE, fuel_amount: 0 },
        null, 40.5, FuelType.ELECTRIC
      );
      expect(result.isValid).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'fuel_amount',
            severity: 'error',
            message: 'Energy charged must be greater than 0.',
          }),
        ])
      );
    });

    it('rejects electricity rate <= 0 for electric vehicle', () => {
      const result = validateFuelEntry(
        { ...EV_BASE, price_per_unit: 0 },
        null, 40.5, FuelType.ELECTRIC
      );
      expect(result.isValid).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'price_per_unit',
            severity: 'error',
            message: 'Electricity rate per kWh must be greater than 0.',
          }),
        ])
      );
    });
  });

  describe('fuel type / fuel unit cross-validation', () => {
    it('rejects litres for CNG vehicles', () => {
      const result = validateFuelEntry(
        { ...BASE_FUEL_INPUT, fuel_unit: FuelUnit.LITRES },
        null, null, FuelType.CNG
      );
      expect(result.isValid).toBe(false);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'fuel_unit', severity: 'error' }),
        ])
      );
    });

    it('rejects litres for LPG vehicles', () => {
      const result = validateFuelEntry(
        { ...BASE_FUEL_INPUT, fuel_unit: FuelUnit.LITRES },
        null, null, FuelType.LPG
      );
      expect(result.isValid).toBe(false);
    });

    it('warns for primary hybrid tank not using kg', () => {
      const result = validateFuelEntry(
        { ...BASE_FUEL_INPUT, fuel_unit: FuelUnit.LITRES, fuel_system: 'primary' },
        null, null, FuelType.HYBRID_CNG_PETROL
      );
      expect(result.isValid).toBe(true); // warning, not error
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'fuel_unit', severity: 'warning' }),
        ])
      );
    });

    it('warns for secondary hybrid tank not using litres', () => {
      const result = validateFuelEntry(
        { ...BASE_FUEL_INPUT, fuel_unit: FuelUnit.KG, fuel_system: 'secondary' },
        null, null, FuelType.HYBRID_CNG_PETROL
      );
      expect(result.isValid).toBe(true);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'fuel_unit', severity: 'warning' }),
        ])
      );
    });
  });

  describe('valid complete entry', () => {
    it('passes a clean valid entry with no issues', () => {
      const result = validateFuelEntry(
        { ...BASE_FUEL_INPUT, odometer: 10500 },
        10000, 45, FuelType.PETROL
      );
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });
});

// ─── validateVehicle ─────────────────────────────────────────────────

describe('validateVehicle', () => {
  it('rejects empty nickname', () => {
    const result = validateVehicle({ nickname: '', registration_number: 'MH01AB1234' });
    expect(result.isValid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'nickname', severity: 'error' }),
      ])
    );
  });

  it('rejects whitespace-only nickname', () => {
    const result = validateVehicle({ nickname: '   ', registration_number: 'MH01AB1234' });
    expect(result.isValid).toBe(false);
  });

  it('rejects empty registration number', () => {
    const result = validateVehicle({ nickname: 'My Car', registration_number: '' });
    expect(result.isValid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'registration_number', severity: 'error' }),
      ])
    );
  });

  it('passes valid vehicle data', () => {
    const result = validateVehicle({ nickname: 'My Car', registration_number: 'MH01AB1234' });
    expect(result.isValid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('reports multiple errors when both fields are empty', () => {
    const result = validateVehicle({ nickname: '', registration_number: '' });
    expect(result.isValid).toBe(false);
    expect(result.issues).toHaveLength(2);
  });
});

// ─── validateExpense ─────────────────────────────────────────────────

describe('validateExpense', () => {
  it('rejects amount <= 0', () => {
    const result = validateExpense({ amount: 0, date: TODAY });
    expect(result.isValid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'amount', severity: 'error' }),
      ])
    );
  });

  it('rejects negative amount', () => {
    const result = validateExpense({ amount: -100, date: TODAY });
    expect(result.isValid).toBe(false);
  });

  it('rejects empty date', () => {
    const result = validateExpense({ amount: 500, date: '' });
    expect(result.isValid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'date', severity: 'error' }),
      ])
    );
  });

  it('rejects invalid date string', () => {
    const result = validateExpense({ amount: 500, date: 'bad-date' });
    expect(result.isValid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'date', severity: 'error', message: 'Invalid date format.' }),
      ])
    );
  });

  it('warns for future date but allows saving', () => {
    const result = validateExpense({ amount: 500, date: TOMORROW });
    expect(result.isValid).toBe(true);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'date', severity: 'warning' }),
      ])
    );
  });

  it('passes a valid expense entry', () => {
    const result = validateExpense({ amount: 1500, date: TODAY });
    expect(result.isValid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});

// ─── hasWarningsOnly ─────────────────────────────────────────────────

describe('hasWarningsOnly', () => {
  it('returns true when there are only warnings', () => {
    // A future date produces a warning-only result
    const result = validateExpense({ amount: 100, date: TOMORROW });
    expect(hasWarningsOnly(result)).toBe(true);
  });

  it('returns false when there are errors', () => {
    const result = validateExpense({ amount: 0, date: TODAY });
    expect(hasWarningsOnly(result)).toBe(false);
  });

  it('returns false when there are no issues at all', () => {
    const result = validateExpense({ amount: 100, date: TODAY });
    expect(hasWarningsOnly(result)).toBe(false);
  });

  it('returns false when there are both errors and warnings', () => {
    // Amount error + future date warning
    const result = validateExpense({ amount: -1, date: TOMORROW });
    expect(hasWarningsOnly(result)).toBe(false);
  });
});
