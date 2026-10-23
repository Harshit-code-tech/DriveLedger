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
import { updateVehicleOdometer, getVehicleById } from './vehicleRepo';
import {
  calculateMileageForEntry,
  recalculateAllMileage,
  checkMileageReasonableness,
  type MileageWarning,
} from '@/engine/mileageEngine';
import type { FuelType, VehicleType, FuelUnit } from '@/constants/fuelTypes';

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

// ─── ATOMIC TRANSACTION MUTATIONS (P0.2) ─────────────────────────────

/**
 * Atomically creates a fuel entry, computes mileage, recalculates affected entries,
 * and updates the vehicle's current odometer in a single SQLite transaction.
 *
 * If any step fails, the entire transaction rolls back.
 */
export function createFuelEntryAtomic(
  input: CreateFuelEntryInput,
  fuelType: FuelType,
  vehicleType: VehicleType
): { entry: FuelEntry; warning: MileageWarning | null } {
  const db = getDatabase();
  let createdEntry: FuelEntry | null = null;
  let warning: MileageWarning | null = null;

  db.withTransactionSync(() => {
    // 1. Create entry in DB
    createdEntry = createFuelEntry(input);

    // 2. Fetch chronological entries to calculate mileage
    const chronological = getFuelEntriesByVehicleChronological(input.vehicle_id);
    const entryIndex = chronological.findIndex((e) => e.id === createdEntry!.id);

    if (entryIndex >= 0) {
      const mileageResult = calculateMileageForEntry(chronological, entryIndex, fuelType);
      if (mileageResult) {
        updateFuelEntryMileage(createdEntry!.id, mileageResult.value, mileageResult.unit);
        createdEntry!.calculated_mileage = mileageResult.value;
        createdEntry!.mileage_unit = mileageResult.unit;

        warning = checkMileageReasonableness(
          mileageResult.value,
          vehicleType,
          input.fuel_unit as FuelUnit
        );
      }
    }

    // 3. Recalculate any downstream entry if backdated
    if (entryIndex >= 0 && entryIndex < chronological.length - 1) {
      const recalculated = recalculateAllMileage(chronological, fuelType);
      for (const { entryId: id, mileage } of recalculated) {
        if (id !== createdEntry!.id) {
          updateFuelEntryMileage(id, mileage?.value ?? null, mileage?.unit ?? null);
        }
      }
    }

    // 4. Update vehicle's current_odometer safely
    // Never roll back a higher canonical odometer if the vehicle already has one
    // (e.g., from a newer confirmed trip reading)
    const vehicle = getVehicleById(input.vehicle_id);
    const existingVehicleOdo = vehicle?.current_odometer ?? null;
    const highestFuelOdometer = chronological.reduce(
      (max, e) => Math.max(max, e.odometer),
      0
    );
    const targetOdo = existingVehicleOdo !== null
      ? Math.max(existingVehicleOdo, highestFuelOdometer)
      : highestFuelOdometer;
    updateVehicleOdometer(input.vehicle_id, targetOdo);
  });

  return { entry: createdEntry!, warning };
}

/**
 * Atomically updates a fuel entry, recomputes total_cost, recalculates all
 * affected mileage in the vehicle chain, and updates vehicle odometer.
 *
 * If any step fails, the entire transaction rolls back.
 */
export function updateFuelEntryAtomic(
  id: string,
  input: UpdateFuelEntryInput,
  fuelType: FuelType
): FuelEntry | null {
  const db = getDatabase();
  let updatedEntry: FuelEntry | null = null;

  db.withTransactionSync(() => {
    // 1. Update the entry
    updatedEntry = updateFuelEntry(id, input);
    if (!updatedEntry) return;

    // 2. Recalculate ALL mileage in the chain
    const chronological = getFuelEntriesByVehicleChronological(updatedEntry.vehicle_id);
    const recalculated = recalculateAllMileage(chronological, fuelType);

    for (const { entryId, mileage } of recalculated) {
      updateFuelEntryMileage(
        entryId,
        mileage?.value ?? null,
        mileage?.unit ?? null
      );
    }

    // 3. Update vehicle odometer safely to the highest confirmed reading
    if (chronological.length > 0) {
      const highestFuelOdometer = Math.max(...chronological.map((e) => e.odometer));
      const row = db.getFirstSync<{ max_odometer: number | null }>(
        `SELECT MAX(end_odometer) AS max_odometer FROM trips
         WHERE vehicle_id = ? AND deleted_at IS NULL AND status = 'completed' AND end_odometer IS NOT NULL`,
        [updatedEntry.vehicle_id]
      );
      const maxTripOdo = row?.max_odometer ?? null;
      const vehicle = getVehicleById(updatedEntry.vehicle_id);
      const existingVehicleOdo = vehicle?.current_odometer ?? null;

      let targetOdo = highestFuelOdometer;
      if (maxTripOdo !== null) {
        targetOdo = Math.max(targetOdo, maxTripOdo);
      }
      if (existingVehicleOdo !== null && existingVehicleOdo > targetOdo) {
        targetOdo = existingVehicleOdo;
      }
      updateVehicleOdometer(updatedEntry.vehicle_id, targetOdo);
    }
  });

  return updatedEntry;
}

/**
 * Atomically soft-deletes a fuel entry, recalculates all downstream mileage,
 * and updates the vehicle's odometer to the latest remaining reading.
 * Preserves newer confirmed trip readings so deletion does not erase trip mileage.
 *
 * If any step fails, the entire transaction rolls back.
 */
export function deleteFuelEntryAtomic(
  id: string,
  vehicleId: string,
  fuelType: FuelType
): void {
  const db = getDatabase();

  db.withTransactionSync(() => {
    const entryToDelete = getFuelEntryById(id);
    const vehicle = getVehicleById(vehicleId);
    const existingVehicleOdo = vehicle?.current_odometer ?? null;

    // 1. Soft delete the entry
    softDeleteFuelEntry(id);

    // 2. Recalculate all remaining mileage
    const chronological = getFuelEntriesByVehicleChronological(vehicleId);
    const recalculated = recalculateAllMileage(chronological, fuelType);

    for (const { entryId, mileage } of recalculated) {
      updateFuelEntryMileage(
        entryId,
        mileage?.value ?? null,
        mileage?.unit ?? null
      );
    }

    // 3. Safely determine remaining highest odometer across fuel entries and completed trips
    const row = db.getFirstSync<{ max_odometer: number | null }>(
      `SELECT MAX(odo) AS max_odometer FROM (
         SELECT odometer AS odo FROM fuel_entries WHERE vehicle_id = ? AND deleted_at IS NULL
         UNION ALL
         SELECT end_odometer AS odo FROM trips WHERE vehicle_id = ? AND deleted_at IS NULL AND status = 'completed' AND end_odometer IS NOT NULL
       )`,
      [vehicleId, vehicleId]
    );
    const highestRemaining = row?.max_odometer ?? null;

    let targetOdo: number;
    if (
      entryToDelete &&
      existingVehicleOdo !== null &&
      entryToDelete.odometer < existingVehicleOdo
    ) {
      targetOdo = existingVehicleOdo;
    } else {
      targetOdo = highestRemaining ?? 0;
    }

    updateVehicleOdometer(vehicleId, targetOdo);
  });
}
