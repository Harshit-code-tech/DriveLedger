/**
 * Backup Schema Validation Tests
 *
 * Tests for the pure validator functions extracted into schema.ts.
 * No crypto, no DB, no mocking needed.
 *
 * Coverage:
 *   isValidVehicle, isValidFuelEntry, isValidServiceRecord,
 *   isValidExpense, isValidDocument, validateSchema
 */

import {
  isValidVehicle,
  isValidFuelEntry,
  isValidServiceRecord,
  isValidExpense,
  isValidDocument,
  validateSchema,
} from '../schema';

// ─── Fixtures ─────────────────────────────────────────────────────────

const VEHICLE = {
  id: 'v1', nickname: 'My Car', registration_number: 'MH01AB1234',
  fuel_type: 'petrol', vehicle_type: 'car',
  created_at: '2025-01-01T00:00:00.000Z', updated_at: '2025-01-01T00:00:00.000Z',
};

const FUEL_ENTRY = {
  id: 'f1', vehicle_id: 'v1', date: '2025-06-01',
  odometer: 10000, fuel_amount: 40, fuel_unit: 'litres',
  price_per_unit: 100, total_cost: 4000,
};

const SERVICE_RECORD = {
  id: 's1', vehicle_id: 'v1', date: '2025-06-01', service_type: 'Oil Change',
};

const EXPENSE = {
  id: 'e1', vehicle_id: 'v1', date: '2025-06-01', category: 'insurance', amount: 5000,
};

const DOCUMENT = {
  id: 'd1', vehicle_id: 'v1', type: 'Insurance',
};

// ─── isValidVehicle ───────────────────────────────────────────────────

describe('isValidVehicle', () => {
  it('accepts a complete valid vehicle', () => {
    expect(isValidVehicle(VEHICLE)).toBe(true);
  });

  it('rejects null', () => expect(isValidVehicle(null)).toBe(false));
  it('rejects non-object', () => expect(isValidVehicle('string')).toBe(false));
  it('rejects empty id', () => expect(isValidVehicle({ ...VEHICLE, id: '' })).toBe(false));
  it('rejects missing nickname', () => expect(isValidVehicle({ ...VEHICLE, nickname: '' })).toBe(false));
  it('rejects missing fuel_type', () => expect(isValidVehicle({ ...VEHICLE, fuel_type: undefined })).toBe(false));
  it('rejects missing created_at', () => expect(isValidVehicle({ ...VEHICLE, created_at: undefined })).toBe(false));
});

// ─── isValidFuelEntry ─────────────────────────────────────────────────

describe('isValidFuelEntry', () => {
  it('accepts a complete valid fuel entry', () => {
    expect(isValidFuelEntry(FUEL_ENTRY)).toBe(true);
  });

  it('rejects null', () => expect(isValidFuelEntry(null)).toBe(false));
  it('rejects negative odometer', () => expect(isValidFuelEntry({ ...FUEL_ENTRY, odometer: -1 })).toBe(false));
  it('rejects zero fuel_amount', () => expect(isValidFuelEntry({ ...FUEL_ENTRY, fuel_amount: 0 })).toBe(false));
  it('rejects zero price_per_unit', () => expect(isValidFuelEntry({ ...FUEL_ENTRY, price_per_unit: 0 })).toBe(false));
  it('rejects unknown fuel_unit', () => expect(isValidFuelEntry({ ...FUEL_ENTRY, fuel_unit: 'gallons' })).toBe(false));

  it('accepts all valid fuel units', () => {
    for (const unit of ['litres', 'kg', 'kWh']) {
      expect(isValidFuelEntry({ ...FUEL_ENTRY, fuel_unit: unit })).toBe(true);
    }
  });
});

// ─── isValidServiceRecord ─────────────────────────────────────────────

describe('isValidServiceRecord', () => {
  it('accepts a valid service record', () => {
    expect(isValidServiceRecord(SERVICE_RECORD)).toBe(true);
  });

  it('rejects empty service_type', () => {
    expect(isValidServiceRecord({ ...SERVICE_RECORD, service_type: '' })).toBe(false);
  });

  it('rejects missing vehicle_id', () => {
    expect(isValidServiceRecord({ ...SERVICE_RECORD, vehicle_id: undefined })).toBe(false);
  });
});

// ─── isValidExpense ───────────────────────────────────────────────────

describe('isValidExpense', () => {
  it('accepts a valid expense', () => {
    expect(isValidExpense(EXPENSE)).toBe(true);
  });

  it('rejects zero amount', () => expect(isValidExpense({ ...EXPENSE, amount: 0 })).toBe(false));
  it('rejects negative amount', () => expect(isValidExpense({ ...EXPENSE, amount: -1 })).toBe(false));
  it('rejects missing category', () => expect(isValidExpense({ ...EXPENSE, category: undefined })).toBe(false));
});

// ─── isValidDocument ──────────────────────────────────────────────────

describe('isValidDocument', () => {
  it('accepts all valid document types', () => {
    for (const type of ['RC', 'Insurance', 'PUC', 'FASTag', 'Warranty']) {
      expect(isValidDocument({ ...DOCUMENT, type })).toBe(true);
    }
  });

  it('rejects unknown document type', () => {
    expect(isValidDocument({ ...DOCUMENT, type: 'Driving License' })).toBe(false);
  });

  it('rejects missing vehicle_id', () => {
    expect(isValidDocument({ ...DOCUMENT, vehicle_id: undefined })).toBe(false);
  });
});

// ─── validateSchema ───────────────────────────────────────────────────

describe('validateSchema', () => {
  const CANONICAL = {
    app_id: 'com.driveledger.app',
    version: 2,
    created_at: '2025-06-01T00:00:00.000Z',
    data: {
      vehicles: [VEHICLE],
      fuel_entries: [FUEL_ENTRY],
      service_records: [SERVICE_RECORD],
      expenses: [EXPENSE],
      documents: [DOCUMENT],
    },
  };

  it('accepts a canonical backup object', () => {
    const result = validateSchema(CANONICAL as any);
    expect(result).not.toBeNull();
    expect(result!.data.vehicles).toHaveLength(1);
    expect(result!.data.fuel_entries).toHaveLength(1);
    expect(result!.data.expenses).toHaveLength(1);
  });

  it('accepts legacy raw-table format', () => {
    const legacy = { vehicles: [VEHICLE], fuel_entries: [FUEL_ENTRY] };
    const result = validateSchema(legacy as any);
    expect(result).not.toBeNull();
    expect(result!.data.vehicles).toHaveLength(1);
  });

  it('rejects when vehicles array is empty', () => {
    const result = validateSchema({ ...CANONICAL, data: { ...CANONICAL.data, vehicles: [] } } as any);
    expect(result).toBeNull();
  });

  it('rejects when vehicles array is missing', () => {
    const result = validateSchema({ data: { fuel_entries: [FUEL_ENTRY] } } as any);
    expect(result).toBeNull();
  });

  it('rejects when any vehicle row is invalid', () => {
    const result = validateSchema({
      ...CANONICAL,
      data: { ...CANONICAL.data, vehicles: [{ ...VEHICLE, id: '' }] },
    } as any);
    expect(result).toBeNull();
  });

  it('silently drops invalid fuel entries but keeps valid ones', () => {
    const result = validateSchema({
      ...CANONICAL,
      data: { ...CANONICAL.data, fuel_entries: [FUEL_ENTRY, { ...FUEL_ENTRY, fuel_amount: -1 }] },
    } as any);
    expect(result).not.toBeNull();
    expect(result!.data.fuel_entries).toHaveLength(1);
  });

  it('returns empty arrays for absent tables', () => {
    const result = validateSchema({ data: { vehicles: [VEHICLE] } } as any);
    expect(result).not.toBeNull();
    expect(result!.data.fuel_entries).toEqual([]);
    expect(result!.data.service_records).toEqual([]);
    expect(result!.data.expenses).toEqual([]);
    expect(result!.data.documents).toEqual([]);
  });
});
