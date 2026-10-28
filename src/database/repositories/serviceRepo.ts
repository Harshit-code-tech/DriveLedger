/**
 * Service Record Repository
 *
 * CRUD operations for the `service_records` table.
 *
 * KEY BEHAVIORS:
 * - Soft delete via deleted_at.
 * - next_due_km is used with vehicle.current_odometer to compute
 *   km-until-next-service dynamically (not stored, computed at read time).
 */

import { getDatabase } from '../connection';
import { buildSafeUpdate } from '../safeUpdate';
import { generateUUID } from '@/utils/uuid';
import { nowISO } from '@/utils/date';
import type {
  ServiceRecord,
  CreateServiceRecordInput,
  UpdateServiceRecordInput,
} from '@/types/service';

// ─── CREATE ──────────────────────────────────────────────────────────

export function createServiceRecord(input: CreateServiceRecordInput): ServiceRecord {
  const db = getDatabase();
  const now = nowISO();
  const id = generateUUID();

  const record: ServiceRecord = {
    id,
    vehicle_id: input.vehicle_id,
    date: input.date,
    odometer: input.odometer ?? null,
    service_type: input.service_type,
    cost: input.cost ?? null,
    work_done: input.work_done ?? null,
    garage_name: input.garage_name ?? null,
    next_due_km: input.next_due_km ?? null,
    next_due_date: input.next_due_date ?? null,
    notes: input.notes ?? null,
    receipt_photo_uri: input.receipt_photo_uri ?? null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  db.runSync(
    `INSERT INTO service_records (
      id, vehicle_id, date, odometer, service_type, cost, work_done,
      garage_name, next_due_km, next_due_date, notes, receipt_photo_uri,
      created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id, record.vehicle_id, record.date, record.odometer,
      record.service_type, record.cost, record.work_done,
      record.garage_name, record.next_due_km, record.next_due_date,
      record.notes, record.receipt_photo_uri ?? null, record.created_at, record.updated_at, record.deleted_at,
    ]
  );

  return record;
}

// ─── READ ────────────────────────────────────────────────────────────

/**
 * Returns all non-deleted service records for a vehicle, most recent first.
 */
export function getServiceRecordsByVehicle(vehicleId: string): ServiceRecord[] {
  const db = getDatabase();
  return db.getAllSync<ServiceRecord>(
    `SELECT * FROM service_records
     WHERE vehicle_id = ? AND deleted_at IS NULL
     ORDER BY date DESC`,
    [vehicleId]
  );
}

/**
 * Returns a single service record by ID.
 */
export function getServiceRecordById(id: string): ServiceRecord | null {
  const db = getDatabase();
  return db.getFirstSync<ServiceRecord>(
    'SELECT * FROM service_records WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
}

/**
 * Returns the most recent service record for a vehicle (for dashboard display).
 */
export function getLatestServiceRecord(vehicleId: string): ServiceRecord | null {
  const db = getDatabase();
  return db.getFirstSync<ServiceRecord>(
    `SELECT * FROM service_records
     WHERE vehicle_id = ? AND deleted_at IS NULL
     ORDER BY date DESC
     LIMIT 1`,
    [vehicleId]
  );
}

// ─── UPDATE ──────────────────────────────────────────────────────────

export function updateServiceRecord(
  id: string,
  input: UpdateServiceRecordInput
): ServiceRecord | null {
  const db = getDatabase();
  const now = nowISO();

  // Whitelist: only these columns can be updated
  const ALLOWED_COLUMNS = new Set([
    'date', 'odometer', 'service_type', 'cost', 'work_done',
    'garage_name', 'next_due_km', 'next_due_date', 'notes',
    'receipt_photo_uri',
  ]);

  const { fields, values } = buildSafeUpdate(input as Record<string, unknown>, ALLOWED_COLUMNS);

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  if (fields.length === 1) return getServiceRecordById(id);

  db.runSync(
    `UPDATE service_records SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  return getServiceRecordById(id);
}

// ─── DELETE (SOFT) ───────────────────────────────────────────────────

export function softDeleteServiceRecord(id: string): void {
  const db = getDatabase();
  const now = nowISO();
  db.runSync(
    'UPDATE service_records SET deleted_at = ?, updated_at = ? WHERE id = ?',
    [now, now, id]
  );
}

export function restoreServiceRecord(id: string): void {
  const db = getDatabase();
  const now = nowISO();
  db.runSync(
    'UPDATE service_records SET deleted_at = NULL, updated_at = ? WHERE id = ?',
    [now, id]
  );
}

// ─── TARGETED SQL AGGREGATES (P1.1) ──────────────────────────────────

export interface MonthlyServiceAggregate {
  monthKey: string;
  serviceCost: number;
  serviceCount: number;
}

export interface VehicleServiceAggregateSummary {
  totalCost: number;
  monthlyAggregates: Record<string, MonthlyServiceAggregate>;
}

/**
 * Returns aggregated service totals and monthly breakdown for a vehicle directly from SQLite.
 */
export function getVehicleServiceAggregates(
  vehicleId: string,
  sinceMonthKey?: string
): VehicleServiceAggregateSummary {
  const db = getDatabase();
  const totalRow = db.getFirstSync<{ total_cost: number | null }>(
    `SELECT COALESCE(SUM(cost), 0) AS total_cost
     FROM service_records
     WHERE vehicle_id = ? AND deleted_at IS NULL`,
    [vehicleId]
  );

  const monthlyQuery = sinceMonthKey
    ? `SELECT
         SUBSTR(date, 1, 7) AS month_key,
         COALESCE(SUM(cost), 0) AS service_cost,
         COUNT(*) AS service_count
       FROM service_records
       WHERE vehicle_id = ? AND deleted_at IS NULL AND SUBSTR(date, 1, 7) >= ?
       GROUP BY SUBSTR(date, 1, 7)`
    : `SELECT
         SUBSTR(date, 1, 7) AS month_key,
         COALESCE(SUM(cost), 0) AS service_cost,
         COUNT(*) AS service_count
       FROM service_records
       WHERE vehicle_id = ? AND deleted_at IS NULL
       GROUP BY SUBSTR(date, 1, 7)`;

  const params = sinceMonthKey ? [vehicleId, sinceMonthKey] : [vehicleId];
  const rows = db.getAllSync<{
    month_key: string;
    service_cost: number;
    service_count: number;
  }>(monthlyQuery, params);

  const monthlyAggregates: Record<string, MonthlyServiceAggregate> = {};
  for (const r of rows) {
    monthlyAggregates[r.month_key] = {
      monthKey: r.month_key,
      serviceCost: r.service_cost,
      serviceCount: r.service_count,
    };
  }

  return {
    totalCost: totalRow?.total_cost ?? 0,
    monthlyAggregates,
  };
}
