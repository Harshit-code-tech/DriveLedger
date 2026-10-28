/**
 * Maintenance Component Repository
 *
 * CRUD and query operations for parts-level maintenance tracking (`maintenance_components` table).
 * Allows service records to cover one or more components (e.g. Engine Oil, Brake Pads, Tyres, etc.)
 * and provides chronological component history and due-target status.
 */

import { getDatabase } from '../connection';
import { buildSafeUpdate } from '../safeUpdate';
import { generateUUID } from '@/utils/uuid';
import { nowISO, daysUntil } from '@/utils/date';
import type {
  MaintenanceComponent,
  CreateMaintenanceComponentInput,
  UpdateMaintenanceComponentInput,
} from '@/types/service';
import type { Vehicle } from '@/types/vehicle';

// ─── Standard Component Templates ──────────────────────────────────
export const STANDARD_COMPONENTS = [
  'Engine Oil',
  'Oil Filter',
  'Air Filter',
  'Cabin / AC Filter',
  'Spark Plugs',
  'Brake Pads',
  'Brake Fluid',
  'Battery',
  'Tyres',
  'Coolant',
  'Timing Belt',
  'Wiper Blades',
  'Transmission Fluid',
] as const;

export interface ComponentHistoryEntry {
  component: MaintenanceComponent;
  serviceDate: string;
  serviceOdometer: number | null;
  garageName: string | null;
}

export interface ComponentDueStatus {
  componentName: string;
  status: 'ok' | 'due_soon' | 'overdue' | 'none';
  lastServiceDate: string | null;
  lastOdometer: number | null;
  nextDueKm: number | null;
  nextDueDate: string | null;
  kmRemaining: number | null;
  daysRemaining: number | null;
  headline: string;
  subtext: string;
}

// ─── CREATE ──────────────────────────────────────────────────────────

export function createMaintenanceComponent(
  input: CreateMaintenanceComponentInput
): MaintenanceComponent {
  const db = getDatabase();
  const now = nowISO();
  const id = generateUUID();

  const rawCost = typeof input.cost === 'number' && !isNaN(input.cost) && input.cost >= 0 ? input.cost : null;
  const rawNextKm = typeof input.next_due_km === 'number' && !isNaN(input.next_due_km) && input.next_due_km > 0 ? input.next_due_km : null;

  const comp: MaintenanceComponent = {
    id,
    service_record_id: input.service_record_id!,
    vehicle_id: input.vehicle_id!,
    component_name: (input.component_name || 'Component').trim(),
    action: input.action || 'replaced',
    brand: input.brand?.trim() || null,
    cost: rawCost,
    next_due_km: rawNextKm,
    next_due_date: input.next_due_date?.trim() || null,
    notes: input.notes?.trim() || null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  db.runSync(
    `INSERT INTO maintenance_components (
      id, service_record_id, vehicle_id, component_name, action,
      brand, cost, next_due_km, next_due_date, notes,
      created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      comp.id,
      comp.service_record_id,
      comp.vehicle_id,
      comp.component_name,
      comp.action,
      comp.brand,
      comp.cost,
      comp.next_due_km,
      comp.next_due_date,
      comp.notes,
      comp.created_at,
      comp.updated_at,
      comp.deleted_at,
    ]
  );

  return comp;
}

export function createMaintenanceComponents(
  inputs: CreateMaintenanceComponentInput[],
  serviceRecordId: string,
  vehicleId: string
): MaintenanceComponent[] {
  const db = getDatabase();
  const results: MaintenanceComponent[] = [];

  const runInserts = () => {
    for (const inp of inputs) {
      const comp = createMaintenanceComponent({
        ...inp,
        service_record_id: serviceRecordId,
        vehicle_id: vehicleId,
      });
      results.push(comp);
    }
  };

  // If already inside an active transaction, execute directly. Do NOT nest withTransactionSync!
  const isAlreadyInTransaction =
    typeof db.isInTransactionSync === 'function' && db.isInTransactionSync();

  if (isAlreadyInTransaction) {
    runInserts();
  } else {
    db.withTransactionSync(runInserts);
  }

  return results;
}

// ─── READ ────────────────────────────────────────────────────────────

export function getMaintenanceComponentsByService(
  serviceRecordId: string
): MaintenanceComponent[] {
  const db = getDatabase();
  return db.getAllSync<MaintenanceComponent>(
    `SELECT * FROM maintenance_components
     WHERE service_record_id = ? AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [serviceRecordId]
  );
}

export function getMaintenanceComponentsByVehicle(
  vehicleId: string
): MaintenanceComponent[] {
  const db = getDatabase();
  return db.getAllSync<MaintenanceComponent>(
    `SELECT * FROM maintenance_components
     WHERE vehicle_id = ? AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [vehicleId]
  );
}

/**
 * Batched lookup of maintenance components for an explicit array of service IDs.
 * Eliminates N+1 queries and avoids loading all vehicle components.
 */
export function getMaintenanceComponentsByServiceIds(
  serviceRecordIds: string[]
): Record<string, MaintenanceComponent[]> {
  if (serviceRecordIds.length === 0) return {};
  const db = getDatabase();
  const placeholders = serviceRecordIds.map(() => '?').join(', ');
  const rows = db.getAllSync<MaintenanceComponent>(
    `SELECT * FROM maintenance_components
     WHERE service_record_id IN (${placeholders}) AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    serviceRecordIds
  );

  const map: Record<string, MaintenanceComponent[]> = {};
  for (const row of rows) {
    if (!map[row.service_record_id]) {
      map[row.service_record_id] = [];
    }
    map[row.service_record_id].push(row);
  }
  return map;
}


/**
 * Returns full chronological history for a component name (case-insensitive)
 * joined with the parent service record's date, odometer, and garage.
 */
export function getComponentHistory(
  vehicleId: string,
  componentName: string
): ComponentHistoryEntry[] {
  const db = getDatabase();
  const rows = db.getAllSync<{
    // Component fields
    c_id: string;
    c_service_record_id: string;
    c_vehicle_id: string;
    c_component_name: string;
    c_action: string;
    c_brand: string | null;
    c_cost: number | null;
    c_next_due_km: number | null;
    c_next_due_date: string | null;
    c_notes: string | null;
    c_created_at: string;
    c_updated_at: string;
    c_deleted_at: string | null;
    // Service record fields
    s_date: string;
    s_odometer: number | null;
    s_garage_name: string | null;
  }>(
    `SELECT
       c.id AS c_id,
       c.service_record_id AS c_service_record_id,
       c.vehicle_id AS c_vehicle_id,
       c.component_name AS c_component_name,
       c.action AS c_action,
       c.brand AS c_brand,
       c.cost AS c_cost,
       c.next_due_km AS c_next_due_km,
       c.next_due_date AS c_next_due_date,
       c.notes AS c_notes,
       c.created_at AS c_created_at,
       c.updated_at AS c_updated_at,
       c.deleted_at AS c_deleted_at,
       s.date AS s_date,
       s.odometer AS s_odometer,
       s.garage_name AS s_garage_name
     FROM maintenance_components c
     JOIN service_records s ON c.service_record_id = s.id
     WHERE c.vehicle_id = ?
       AND c.deleted_at IS NULL
       AND s.deleted_at IS NULL
       AND LOWER(TRIM(c.component_name)) = LOWER(TRIM(?))
     ORDER BY s.date DESC, s.odometer DESC`,
    [vehicleId, componentName]
  );

  return rows.map((r) => ({
    component: {
      id: r.c_id,
      service_record_id: r.c_service_record_id,
      vehicle_id: r.c_vehicle_id,
      component_name: r.c_component_name,
      action: r.c_action,
      brand: r.c_brand,
      cost: r.c_cost,
      next_due_km: r.c_next_due_km,
      next_due_date: r.c_next_due_date,
      notes: r.c_notes,
      created_at: r.c_created_at,
      updated_at: r.c_updated_at,
      deleted_at: r.c_deleted_at,
    },
    serviceDate: r.s_date,
    serviceOdometer: r.s_odometer,
    garageName: r.s_garage_name,
  }));
}

/**
 * Returns all distinct component histories for a vehicle grouped by normalized component name.
 */
export function getAllComponentHistories(
  vehicleId: string
): Record<string, ComponentHistoryEntry[]> {
  const db = getDatabase();
  const rows = db.getAllSync<{
    c_id: string;
    c_service_record_id: string;
    c_vehicle_id: string;
    c_component_name: string;
    c_action: string;
    c_brand: string | null;
    c_cost: number | null;
    c_next_due_km: number | null;
    c_next_due_date: string | null;
    c_notes: string | null;
    c_created_at: string;
    c_updated_at: string;
    c_deleted_at: string | null;
    s_date: string;
    s_odometer: number | null;
    s_garage_name: string | null;
  }>(
    `SELECT
       c.id AS c_id,
       c.service_record_id AS c_service_record_id,
       c.vehicle_id AS c_vehicle_id,
       c.component_name AS c_component_name,
       c.action AS c_action,
       c.brand AS c_brand,
       c.cost AS c_cost,
       c.next_due_km AS c_next_due_km,
       c.next_due_date AS c_next_due_date,
       c.notes AS c_notes,
       c.created_at AS c_created_at,
       c.updated_at AS c_updated_at,
       c.deleted_at AS c_deleted_at,
       s.date AS s_date,
       s.odometer AS s_odometer,
       s.garage_name AS s_garage_name
     FROM maintenance_components c
     JOIN service_records s ON c.service_record_id = s.id
     WHERE c.vehicle_id = ?
       AND c.deleted_at IS NULL
       AND s.deleted_at IS NULL
     ORDER BY s.date DESC, s.odometer DESC`,
    [vehicleId]
  );

  const map: Record<string, ComponentHistoryEntry[]> = {};
  for (const r of rows) {
    const key = r.c_component_name.trim();
    if (!map[key]) map[key] = [];
    map[key].push({
      component: {
        id: r.c_id,
        service_record_id: r.c_service_record_id,
        vehicle_id: r.c_vehicle_id,
        component_name: r.c_component_name,
        action: r.c_action,
        brand: r.c_brand,
        cost: r.c_cost,
        next_due_km: r.c_next_due_km,
        next_due_date: r.c_next_due_date,
        notes: r.c_notes,
        created_at: r.c_created_at,
        updated_at: r.c_updated_at,
        deleted_at: r.c_deleted_at,
      },
      serviceDate: r.s_date,
      serviceOdometer: r.s_odometer,
      garageName: r.s_garage_name,
    });
  }

  return map;
}

// ─── DUE STATUS EVALUATION ───────────────────────────────────────────

/**
 * Computes due status for a vehicle component based on user-entered next-due targets
 * and vehicle current odometer and current date.
 */
export function computeComponentDueStatus(
  vehicle: Vehicle,
  componentName: string,
  history: ComponentHistoryEntry[]
): ComponentDueStatus {
  if (history.length === 0) {
    return {
      componentName,
      status: 'none',
      lastServiceDate: null,
      lastOdometer: null,
      nextDueKm: null,
      nextDueDate: null,
      kmRemaining: null,
      daysRemaining: null,
      headline: 'No recorded history',
      subtext: 'No maintenance records logged for this component yet.',
    };
  }

  const latest = history[0]; // sorted newest first
  const nextDueKm = latest.component.next_due_km;
  const nextDueDate = latest.component.next_due_date;

  let kmRemaining: number | null = null;
  if (nextDueKm && vehicle.current_odometer) {
    kmRemaining = nextDueKm - vehicle.current_odometer;
  }

  let daysRemaining: number | null = null;
  if (nextDueDate) {
    daysRemaining = daysUntil(nextDueDate);
  }

  // Thresholds
  const KM_DUE_SOON = 1000;
  const DAYS_DUE_SOON = 30;

  const isKmOverdue = kmRemaining !== null && kmRemaining <= 0;
  const isTimeOverdue = daysRemaining !== null && daysRemaining <= 0;
  const isKmDueSoon = kmRemaining !== null && kmRemaining <= KM_DUE_SOON;
  const isTimeDueSoon = daysRemaining !== null && daysRemaining <= DAYS_DUE_SOON;

  if (isKmOverdue || isTimeOverdue) {
    const kmText = kmRemaining !== null ? `${Math.abs(Math.round(kmRemaining))} km` : null;
    const timeText = daysRemaining !== null ? `${Math.abs(daysRemaining)} days` : null;
    const overdueDesc = [kmText, timeText].filter(Boolean).join(' and ');

    return {
      componentName,
      status: 'overdue',
      lastServiceDate: latest.serviceDate,
      lastOdometer: latest.serviceOdometer,
      nextDueKm,
      nextDueDate,
      kmRemaining,
      daysRemaining,
      headline: `${componentName} Overdue!`,
      subtext: `Target exceeded by ${overdueDesc}.`,
    };
  }

  if (isKmDueSoon || isTimeDueSoon) {
    const kmText = kmRemaining !== null ? `${Math.round(kmRemaining)} km` : null;
    const timeText = daysRemaining !== null ? `${daysRemaining} days` : null;
    const dueDesc = [kmText, timeText].filter(Boolean).join(' or ');

    return {
      componentName,
      status: 'due_soon',
      lastServiceDate: latest.serviceDate,
      lastOdometer: latest.serviceOdometer,
      nextDueKm,
      nextDueDate,
      kmRemaining,
      daysRemaining,
      headline: `${componentName} Due Soon`,
      subtext: `Next replacement due in ${dueDesc}.`,
    };
  }

  if (nextDueKm || nextDueDate) {
    return {
      componentName,
      status: 'ok',
      lastServiceDate: latest.serviceDate,
      lastOdometer: latest.serviceOdometer,
      nextDueKm,
      nextDueDate,
      kmRemaining,
      daysRemaining,
      headline: `${componentName} Normal`,
      subtext: kmRemaining
        ? `Due in ${Math.round(kmRemaining)} km${daysRemaining ? ` or ${daysRemaining} days` : ''}.`
        : `Due in ${daysRemaining} days.`,
    };
  }

  return {
    componentName,
    status: 'ok',
    lastServiceDate: latest.serviceDate,
    lastOdometer: latest.serviceOdometer,
    nextDueKm: null,
    nextDueDate: null,
    kmRemaining: null,
    daysRemaining: null,
    headline: `${componentName} Serviced`,
    subtext: latest.serviceOdometer
      ? `Last changed at ${latest.serviceOdometer.toLocaleString('en-IN')} km on ${latest.serviceDate}.`
      : `Last changed on ${latest.serviceDate}.`,
  };
}

// ─── UPDATE ──────────────────────────────────────────────────────────

export function updateMaintenanceComponent(
  id: string,
  input: UpdateMaintenanceComponentInput
): MaintenanceComponent | null {
  const db = getDatabase();
  const now = nowISO();

  const ALLOWED_COLUMNS = new Set([
    'component_name', 'action', 'brand', 'cost',
    'next_due_km', 'next_due_date', 'notes',
  ]);

  const { fields, values } = buildSafeUpdate(input as Record<string, unknown>, ALLOWED_COLUMNS);
  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  if (fields.length === 1) {
    return db.getFirstSync<MaintenanceComponent>(
      'SELECT * FROM maintenance_components WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
  }

  db.runSync(
    `UPDATE maintenance_components SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  return db.getFirstSync<MaintenanceComponent>(
    'SELECT * FROM maintenance_components WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
}

// ─── DELETE (SOFT) ───────────────────────────────────────────────────

export function softDeleteMaintenanceComponent(id: string): void {
  const db = getDatabase();
  const now = nowISO();
  db.runSync(
    'UPDATE maintenance_components SET deleted_at = ?, updated_at = ? WHERE id = ?',
    [now, now, id]
  );
}

export function deleteMaintenanceComponentsByService(serviceRecordId: string): void {
  const db = getDatabase();
  const now = nowISO();
  db.runSync(
    'UPDATE maintenance_components SET deleted_at = ?, updated_at = ? WHERE service_record_id = ?',
    [now, now, serviceRecordId]
  );
}
