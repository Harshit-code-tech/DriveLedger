/**
 * Fuel Entry Repository
 *
 * CRUD operations for the `fuel_entries` table.
 *
 * KEY BEHAVIORS:
 * - Create: Generates UUID, computes total_cost, sets timestamps.
 * - Read: Filters out soft-deleted entries (deleted_at IS NULL) by default.
 * - Update: Recomputes total_cost if fuel_amount or price_per_unit changes.
 * - Delete: Soft delete (sets deleted_at). Entry is recoverable.
 *
 * NOTE: Mileage calculation (calculated_mileage, mileage_unit) is NOT
 * handled here. That's the job of the mileageEngine. The repo stores
 * whatever the engine computes.
 */

import { getDatabase } from '../connection';
import { buildSafeUpdate } from '../safeUpdate';
import { generateUUID } from '@/utils/uuid';
import { nowISO } from '@/utils/date';
import type { FuelEntry, CreateFuelEntryInput, UpdateFuelEntryInput } from '@/types/fuel';

// ─── CREATE ──────────────────────────────────────────────────────────

/**
 * Creates a new fuel entry.
 * Automatically computes total_cost = fuel_amount × price_per_unit.
 *
 * @param input - Required fuel entry fields
 * @returns The complete FuelEntry record as stored in the database
 */
export function createFuelEntry(input: CreateFuelEntryInput): FuelEntry {
  const db = getDatabase();
  const now = nowISO();
  const id = generateUUID();
  const totalCost = input.fuel_amount * input.price_per_unit;

  const entry: FuelEntry = {
    id,
    vehicle_id: input.vehicle_id,
    date: input.date,
    odometer: input.odometer,
    fuel_amount: input.fuel_amount,
    fuel_unit: input.fuel_unit,
    price_per_unit: input.price_per_unit,
    total_cost: totalCost,
    fuel_station: input.fuel_station ?? null,
    is_full_tank: input.is_full_tank,
    calculated_mileage: null,   // Set by mileageEngine after creation
    mileage_unit: null,         // Set by mileageEngine after creation
    receipt_photo_uri: input.receipt_photo_uri ?? null,
    notes: input.notes ?? null,
    fuel_system: input.fuel_system ?? 'primary',
    battery_start_percent: input.battery_start_percent ?? null,
    battery_end_percent: input.battery_end_percent ?? null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  db.runSync(
    `INSERT INTO fuel_entries (
      id, vehicle_id, date, odometer, fuel_amount, fuel_unit, price_per_unit,
      total_cost, fuel_station, is_full_tank, calculated_mileage, mileage_unit,
      receipt_photo_uri, notes, fuel_system, battery_start_percent, battery_end_percent,
      created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id, entry.vehicle_id, entry.date, entry.odometer,
      entry.fuel_amount, entry.fuel_unit, entry.price_per_unit,
      entry.total_cost, entry.fuel_station, entry.is_full_tank,
      entry.calculated_mileage, entry.mileage_unit,
      entry.receipt_photo_uri, entry.notes,
      entry.fuel_system ?? null, entry.battery_start_percent ?? null, entry.battery_end_percent ?? null,
      entry.created_at, entry.updated_at, entry.deleted_at,
    ]
  );

  return entry;
}

// ─── READ ────────────────────────────────────────────────────────────

/**
 * Returns all non-deleted fuel entries for a vehicle, ordered by date descending.
 * This is the default query for the fuel history list.
 */
export function getFuelEntriesByVehicle(vehicleId: string): FuelEntry[] {
  const db = getDatabase();
  return db.getAllSync<FuelEntry>(
    `SELECT * FROM fuel_entries
     WHERE vehicle_id = ? AND deleted_at IS NULL
     ORDER BY date DESC, odometer DESC`,
    [vehicleId]
  );
}

/**
 * Returns all non-deleted fuel entries for a vehicle, ordered by odometer ascending.
 * Used by the mileage engine for sequential calculation.
 */
export function getFuelEntriesByVehicleChronological(vehicleId: string): FuelEntry[] {
  const db = getDatabase();
  return db.getAllSync<FuelEntry>(
    `SELECT * FROM fuel_entries
     WHERE vehicle_id = ? AND deleted_at IS NULL
     ORDER BY odometer ASC`,
    [vehicleId]
  );
}

/**
 * Returns a single fuel entry by ID.
 */
export function getFuelEntryById(id: string): FuelEntry | null {
  const db = getDatabase();
  return db.getFirstSync<FuelEntry>(
    'SELECT * FROM fuel_entries WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
}

/**
 * Returns the most recent fuel entry (by odometer) for a vehicle.
 * Used for odometer smart-defaulting on the fuel entry form.
 */
export function getLatestFuelEntry(vehicleId: string): FuelEntry | null {
  const db = getDatabase();
  return db.getFirstSync<FuelEntry>(
    `SELECT * FROM fuel_entries
     WHERE vehicle_id = ? AND deleted_at IS NULL
     ORDER BY odometer DESC
     LIMIT 1`,
    [vehicleId]
  );
}

/**
 * Returns the latest fuel entry whose date is strictly before the given ISO date.
 * Used for date-aware odometer validation: when logging a past-dated entry,
 * we compare against the chronological predecessor, not the absolute latest entry.
 *
 * @param vehicleId - The vehicle UUID
 * @param isoDate - ISO date string (YYYY-MM-DD) to search before
 * @returns The preceding entry, or null if none exists before this date
 */
export function getFuelEntryBeforeDate(vehicleId: string, isoDate: string): FuelEntry | null {
  const db = getDatabase();
  return db.getFirstSync<FuelEntry>(
    `SELECT * FROM fuel_entries
     WHERE vehicle_id = ? AND deleted_at IS NULL AND date < ?
     ORDER BY date DESC, odometer DESC
     LIMIT 1`,
    [vehicleId, isoDate]
  );
}

/**
 * Returns distinct fuel station names the user has previously entered,
 * across all vehicles, most-used first (ties broken by most recent use).
 * Powers the station autocomplete chips on the fuel entry form.
 *
 * @param limit - Max number of stations to return (default 20)
 */
export function getFrequentFuelStations(limit: number = 20): string[] {
  const db = getDatabase();
  const rows = db.getAllSync<{ fuel_station: string }>(
    `SELECT TRIM(fuel_station) AS fuel_station
     FROM fuel_entries
     WHERE deleted_at IS NULL AND fuel_station IS NOT NULL AND TRIM(fuel_station) != ''
     GROUP BY LOWER(TRIM(fuel_station))
     ORDER BY COUNT(*) DESC, MAX(date) DESC
     LIMIT ?`,
    [limit]
  );
  return rows.map((r) => r.fuel_station);
}

// ─── UPDATE ──────────────────────────────────────────────────────────

/**
 * Updates an existing fuel entry's fields.
 * Recomputes total_cost if fuel_amount or price_per_unit changes.
 *
 * @param id - The fuel entry UUID to update
 * @param input - Partial fuel entry fields to update
 * @returns The updated FuelEntry record or null if not found
 */
export function updateFuelEntry(id: string, input: UpdateFuelEntryInput): FuelEntry | null {
  const db = getDatabase();
  const now = nowISO();

  // If fuel_amount or price_per_unit changed, we need to recompute total_cost
  const existing = getFuelEntryById(id);
  if (!existing) return null;

  const newFuelAmount = input.fuel_amount ?? existing.fuel_amount;
  const newPricePerUnit = input.price_per_unit ?? existing.price_per_unit;
  const needsRecalc = input.fuel_amount !== undefined || input.price_per_unit !== undefined;

  // Whitelist: only these columns can be updated
  const ALLOWED_COLUMNS = new Set([
    'date', 'odometer', 'fuel_amount', 'fuel_unit', 'price_per_unit',
    'fuel_station', 'is_full_tank', 'receipt_photo_uri', 'notes',
    'fuel_system', 'battery_start_percent', 'battery_end_percent',
  ]);

  const { fields, values } = buildSafeUpdate(input as Record<string, unknown>, ALLOWED_COLUMNS);

  if (needsRecalc) {
    fields.push('total_cost = ?');
    values.push(newFuelAmount * newPricePerUnit);
  }

  fields.push('updated_at = ?');
  values.push(now);

  values.push(id);

  db.runSync(
    `UPDATE fuel_entries SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  return getFuelEntryById(id);
}

/**
 * Updates the calculated_mileage and mileage_unit on a fuel entry.
 * Called by the mileage engine after computation.
 *
 * @param id - The fuel entry UUID
 * @param mileage - The calculated mileage value (or null to clear)
 * @param unit - The mileage unit string (or null to clear)
 */
export function updateFuelEntryMileage(
  id: string,
  mileage: number | null,
  unit: string | null
): void {
  const db = getDatabase();
  const now = nowISO();
  db.runSync(
    `UPDATE fuel_entries
     SET calculated_mileage = ?, mileage_unit = ?, updated_at = ?
     WHERE id = ?`,
    [mileage, unit, now, id]
  );
}

// ─── DELETE (SOFT) ───────────────────────────────────────────────────

/**
 * Soft-deletes a fuel entry by setting deleted_at.
 * The record remains in the database but is filtered from all reads.
 */
export function softDeleteFuelEntry(id: string): void {
  const db = getDatabase();
  const now = nowISO();
  db.runSync(
    'UPDATE fuel_entries SET deleted_at = ?, updated_at = ? WHERE id = ?',
    [now, now, id]
  );
}

/**
 * Restores a soft-deleted fuel entry by clearing deleted_at.
 */
export function restoreFuelEntry(id: string): void {
  const db = getDatabase();
  const now = nowISO();
  db.runSync(
    'UPDATE fuel_entries SET deleted_at = NULL, updated_at = ? WHERE id = ?',
    [now, id]
  );
}
