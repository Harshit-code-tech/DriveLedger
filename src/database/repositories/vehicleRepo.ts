/**
 * Vehicle Repository
 *
 * CRUD operations for the `vehicles` table.
 * All functions use the shared database singleton from connection.ts.
 *
 * KEY BEHAVIORS:
 * - Create: Generates a UUID, sets created_at/updated_at to now.
 * - Read: Filters out archived vehicles by default (is_archived = 0).
 * - Update: Sets updated_at to now. Only updates provided fields.
 * - Delete: Archives the vehicle (is_archived = 1), does NOT set deleted_at.
 *           deleted_at is reserved for v2.0 cloud sync tombstoning.
 * - Restore: Sets is_archived back to 0.
 *
 * WHY archive instead of soft delete for vehicles?
 * The vehicle still owns historical records (fuel, service, expenses).
 * Archiving hides it from the active list without orphaning that history.
 */

import { getDatabase } from '../connection';
import { buildSafeUpdate } from '../safeUpdate';
import { migrateVehiclesTableIfNeeded } from '../schema';
import { generateUUID } from '@/utils/uuid';
import { nowISO } from '@/utils/date';
import type { Vehicle, CreateVehicleInput, UpdateVehicleInput } from '@/types/vehicle';

// ─── CREATE ──────────────────────────────────────────────────────────

/**
 * Creates a new vehicle record.
 *
 * @param input - Required + optional vehicle fields
 * @returns The complete Vehicle record as stored in the database
 */
export function createVehicle(input: CreateVehicleInput): Vehicle {
  const db = getDatabase();
  migrateVehiclesTableIfNeeded(db);
  const now = nowISO();
  const id = generateUUID();

  const vehicle: Vehicle = {
    id,
    nickname: input.nickname,
    vehicle_type: input.vehicle_type,
    manufacturer: input.manufacturer ?? null,
    model: input.model ?? null,
    variant: input.variant ?? null,
    year: input.year ?? null,
    color: input.color ?? null,
    registration_number: input.registration_number ?? null,
    fuel_type: input.fuel_type,
    tank_capacity: input.tank_capacity ?? null,
    secondary_tank_capacity: input.secondary_tank_capacity ?? null,
    current_odometer: input.current_odometer ?? null,
    front_tyre_pressure: input.front_tyre_pressure ?? null,
    rear_tyre_pressure: input.rear_tyre_pressure ?? null,
    service_interval_km: input.service_interval_km ?? null,
    service_interval_months: input.service_interval_months ?? 12,
    purchase_date: input.purchase_date ?? null,
    notes: input.notes ?? null,
    is_archived: 0,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  const insertSql = `INSERT INTO vehicles (
    id, nickname, vehicle_type, manufacturer, model, variant, year, color,
    registration_number, fuel_type, tank_capacity, secondary_tank_capacity,
    current_odometer, front_tyre_pressure, rear_tyre_pressure,
    service_interval_km, service_interval_months, purchase_date, notes, is_archived, created_at, updated_at, deleted_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  const insertParams = [
    vehicle.id, vehicle.nickname, vehicle.vehicle_type, vehicle.manufacturer,
    vehicle.model, vehicle.variant, vehicle.year, vehicle.color,
    vehicle.registration_number, vehicle.fuel_type, vehicle.tank_capacity,
    vehicle.secondary_tank_capacity, vehicle.current_odometer,
    vehicle.front_tyre_pressure, vehicle.rear_tyre_pressure,
    vehicle.service_interval_km, vehicle.service_interval_months, vehicle.purchase_date,
    vehicle.notes, vehicle.is_archived, vehicle.created_at, vehicle.updated_at,
    vehicle.deleted_at,
  ];

  try {
    db.runSync(insertSql, insertParams);
  } catch (err: any) {
    if (err?.message?.includes('CHECK constraint failed: fuel_type')) {
      migrateVehiclesTableIfNeeded(db);
      db.runSync(insertSql, insertParams);
    } else {
      throw err;
    }
  }

  return vehicle;
}

// ─── READ ────────────────────────────────────────────────────────────

/**
 * Returns all active (non-archived) vehicles.
 * This is the default query for the vehicle list and switcher.
 */
export function getActiveVehicles(): Vehicle[] {
  const db = getDatabase();
  return db.getAllSync<Vehicle>(
    'SELECT * FROM vehicles WHERE is_archived = 0 ORDER BY created_at ASC'
  );
}

/**
 * Returns all vehicles including archived ones.
 * Used in settings to allow un-archiving.
 */
export function getAllVehicles(): Vehicle[] {
  const db = getDatabase();
  return db.getAllSync<Vehicle>(
    'SELECT * FROM vehicles ORDER BY is_archived ASC, created_at ASC'
  );
}

/**
 * Returns a single vehicle by ID.
 *
 * @param id - The vehicle UUID
 * @returns The Vehicle record or null if not found
 */
export function getVehicleById(id: string): Vehicle | null {
  const db = getDatabase();
  return db.getFirstSync<Vehicle>(
    'SELECT * FROM vehicles WHERE id = ?',
    [id]
  );
}

// ─── UPDATE ──────────────────────────────────────────────────────────

/**
 * Updates an existing vehicle's fields.
 * Only the fields present in the input object are updated.
 *
 * @param id - The vehicle UUID to update
 * @param input - Partial vehicle fields to update
 * @returns The updated Vehicle record or null if not found
 */
export function updateVehicle(id: string, input: UpdateVehicleInput): Vehicle | null {
  const db = getDatabase();
  const now = nowISO();

  // Whitelist: only these columns can be updated
  const ALLOWED_COLUMNS = new Set([
    'nickname', 'vehicle_type', 'manufacturer', 'model', 'variant',
    'year', 'color', 'registration_number', 'fuel_type', 'tank_capacity',
    'secondary_tank_capacity',
    'current_odometer', 'front_tyre_pressure', 'rear_tyre_pressure',
    'service_interval_km', 'service_interval_months', 'purchase_date', 'notes', 'is_archived',
  ]);

  const { fields, values } = buildSafeUpdate(input as Record<string, unknown>, ALLOWED_COLUMNS);

  // Always update the timestamp
  fields.push('updated_at = ?');
  values.push(now);

  // Add the WHERE clause value
  values.push(id);

  if (fields.length === 1) return getVehicleById(id); // only updated_at, nothing meaningful

  const updateSql = `UPDATE vehicles SET ${fields.join(', ')} WHERE id = ?`;

  try {
    db.runSync(updateSql, values);
  } catch (err: any) {
    if (err?.message?.includes('CHECK constraint failed: fuel_type')) {
      migrateVehiclesTableIfNeeded(db);
      db.runSync(updateSql, values);
    } else {
      throw err;
    }
  }

  return getVehicleById(id);
}

// ─── ARCHIVE / RESTORE ──────────────────────────────────────────────

/**
 * Archives a vehicle (hides from active list, preserves history).
 * This is the primary "delete" mechanism for vehicles.
 *
 * @param id - The vehicle UUID to archive
 */
export function archiveVehicle(id: string): void {
  const db = getDatabase();
  const now = nowISO();
  db.runSync(
    'UPDATE vehicles SET is_archived = 1, updated_at = ? WHERE id = ?',
    [now, id]
  );
}

/**
 * Restores an archived vehicle back to the active list.
 *
 * @param id - The vehicle UUID to restore
 */
export function restoreVehicle(id: string): void {
  const db = getDatabase();
  const now = nowISO();
  db.runSync(
    'UPDATE vehicles SET is_archived = 0, updated_at = ? WHERE id = ?',
    [now, id]
  );
}

// ─── ODOMETER ────────────────────────────────────────────────────────

/**
 * Updates the vehicle's denormalized current_odometer field.
 * Called atomically whenever a fuel entry is saved.
 *
 * @param vehicleId - The vehicle UUID
 * @param odometer - The new odometer reading
 */
export function updateVehicleOdometer(vehicleId: string, odometer: number): void {
  const db = getDatabase();
  const now = nowISO();
  db.runSync(
    'UPDATE vehicles SET current_odometer = ?, updated_at = ? WHERE id = ?',
    [odometer, now, vehicleId]
  );
}
