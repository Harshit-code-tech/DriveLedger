/**
 * Backup Engine — Schema Validation
 *
 * Row-level validators and the top-level validateSchema function.
 * Extracted from backupEngine.ts so the validation logic can be
 * tested independently without setting up crypto or file-system mocks.
 *
 * All functions are pure (no side-effects).
 */

import type { BackupData } from './types';
import type { VehicleDocument } from '@/types/document';
import type { Expense } from '@/types/expense';
import type { FuelEntry } from '@/types/fuel';
import type { ServiceRecord } from '@/types/service';
import type { Vehicle } from '@/types/vehicle';

// ─── Row-level field validators ──────────────────────────────────────

export function isValidVehicle(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === 'string' && r.id.length > 0 &&
    typeof r.nickname === 'string' && r.nickname.length > 0 &&
    typeof r.registration_number === 'string' &&
    typeof r.fuel_type === 'string' &&
    typeof r.vehicle_type === 'string' &&
    typeof r.created_at === 'string' &&
    typeof r.updated_at === 'string'
  );
}

export function isValidFuelEntry(f: unknown): boolean {
  if (!f || typeof f !== 'object') return false;
  const r = f as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.vehicle_id === 'string' &&
    typeof r.date === 'string' &&
    typeof r.odometer === 'number' && r.odometer >= 0 &&
    typeof r.fuel_amount === 'number' && (r.fuel_amount as number) > 0 &&
    typeof r.price_per_unit === 'number' && (r.price_per_unit as number) > 0 &&
    typeof r.total_cost === 'number' &&
    typeof r.fuel_unit === 'string' &&
    ['litres', 'kg', 'kWh'].includes(r.fuel_unit as string)
  );
}

export function isValidServiceRecord(s: unknown): boolean {
  if (!s || typeof s !== 'object') return false;
  const r = s as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.vehicle_id === 'string' &&
    typeof r.date === 'string' &&
    typeof r.service_type === 'string' && (r.service_type as string).length > 0
  );
}

export function isValidExpense(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const r = e as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.vehicle_id === 'string' &&
    typeof r.date === 'string' &&
    typeof r.category === 'string' &&
    typeof r.amount === 'number' && (r.amount as number) > 0
  );
}

export function isValidDocument(d: unknown): boolean {
  if (!d || typeof d !== 'object') return false;
  const r = d as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.vehicle_id === 'string' &&
    typeof r.type === 'string' &&
    ['RC', 'Insurance', 'PUC', 'FASTag', 'Warranty'].includes(r.type as string)
  );
}

// ─── Top-level schema validator ──────────────────────────────────────

/**
 * Validates and normalises a parsed JSON object to BackupData['data'].
 * Returns null if the object fails any structural check.
 *
 * Individual fuel_entries/service_records/expenses/documents rows that
 * fail validation are silently dropped (tolerant partial restore),
 * but if the vehicles array is missing or empty the whole backup is rejected.
 */
export function validateSchema(obj: Record<string, unknown>): {
  data: BackupData['data'];
  error?: string;
} | null {
  // Find the data wrapper — tolerates both the canonical {data:{...}} shape
  // and the legacy raw-table payload shape.
  let rawData: Record<string, unknown>;
  if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
    rawData = obj.data as Record<string, unknown>;
  } else if (Array.isArray(obj.vehicles)) {
    rawData = obj; // Tolerant: raw table payload
  } else {
    return null;
  }

  if (!Array.isArray(rawData.vehicles) || rawData.vehicles.length === 0) {
    return null; // Vehicles array is mandatory
  }

  // Vehicle rows must ALL be valid — one bad vehicle rejects the whole backup.
  const badVehicle = (rawData.vehicles as unknown[]).find((v) => !isValidVehicle(v));
  if (badVehicle) return null;

  // Other tables are filtered: invalid rows are dropped rather than failing.
  const fuelEntries: FuelEntry[] = Array.isArray(rawData.fuel_entries)
    ? (rawData.fuel_entries as unknown[]).filter(isValidFuelEntry) as FuelEntry[]
    : [];

  const serviceRecords: ServiceRecord[] = Array.isArray(rawData.service_records)
    ? (rawData.service_records as unknown[]).filter(isValidServiceRecord) as ServiceRecord[]
    : [];

  const expenses: Expense[] = Array.isArray(rawData.expenses)
    ? (rawData.expenses as unknown[]).filter(isValidExpense) as Expense[]
    : [];

  const documents: VehicleDocument[] = Array.isArray(rawData.documents)
    ? (rawData.documents as unknown[]).filter(isValidDocument) as VehicleDocument[]
    : [];

  return {
    data: {
      vehicles: rawData.vehicles as Vehicle[],
      fuel_entries: fuelEntries,
      service_records: serviceRecords,
      expenses,
      documents,
    },
  };
}
