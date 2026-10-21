/**
 * Maintenance Profile Repository
 *
 * CRUD operations and due-status evaluation for vehicle-specific maintenance profiles
 * (`maintenance_profiles` table).
 *
 * Allows users to configure custom replacement intervals (km and/or months)
 * or explicit targets for individual components (e.g. Engine Oil, Brake Pads, Tyres),
 * integrating with past service records and reminder notifications.
 */

import { getDatabase } from '../connection';
import { buildSafeUpdate } from '../safeUpdate';
import { generateUUID } from '@/utils/uuid';
import { nowISO, daysUntil } from '@/utils/date';
import type {
  MaintenanceProfile,
  CreateMaintenanceProfileInput,
  UpdateMaintenanceProfileInput,
  ProfileDueStatus,
} from '@/types/service';
import type { Vehicle } from '@/types/vehicle';
import type { ComponentHistoryEntry } from './maintenanceComponentRepo';

// ─── CREATE ──────────────────────────────────────────────────────────

export function createMaintenanceProfile(
  input: CreateMaintenanceProfileInput
): MaintenanceProfile {
  const db = getDatabase();
  const now = nowISO();
  const id = generateUUID();

  const profile: MaintenanceProfile = {
    id,
    vehicle_id: input.vehicle_id,
    component_name: (input.component_name || 'Component').trim(),
    interval_km: typeof input.interval_km === 'number' && input.interval_km > 0 ? input.interval_km : null,
    interval_months: typeof input.interval_months === 'number' && input.interval_months > 0 ? input.interval_months : null,
    target_odometer: typeof input.target_odometer === 'number' && input.target_odometer > 0 ? input.target_odometer : null,
    target_date: input.target_date?.trim() || null,
    notes: input.notes?.trim() || null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  db.runSync(
    `INSERT INTO maintenance_profiles (
      id, vehicle_id, component_name, interval_km, interval_months,
      target_odometer, target_date, notes, created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      profile.id,
      profile.vehicle_id,
      profile.component_name,
      profile.interval_km,
      profile.interval_months,
      profile.target_odometer,
      profile.target_date,
      profile.notes,
      profile.created_at,
      profile.updated_at,
      profile.deleted_at,
    ]
  );

  return profile;
}

// ─── READ ────────────────────────────────────────────────────────────

export function getMaintenanceProfilesByVehicle(
  vehicleId: string
): MaintenanceProfile[] {
  const db = getDatabase();
  return db.getAllSync<MaintenanceProfile>(
    `SELECT * FROM maintenance_profiles
     WHERE vehicle_id = ? AND deleted_at IS NULL
     ORDER BY component_name ASC`,
    [vehicleId]
  );
}

export function getMaintenanceProfileById(id: string): MaintenanceProfile | null {
  const db = getDatabase();
  return db.getFirstSync<MaintenanceProfile>(
    'SELECT * FROM maintenance_profiles WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
}

// ─── UPDATE ──────────────────────────────────────────────────────────

export function updateMaintenanceProfile(
  id: string,
  input: UpdateMaintenanceProfileInput
): MaintenanceProfile | null {
  const db = getDatabase();
  const now = nowISO();

  const ALLOWED_COLUMNS = new Set([
    'component_name',
    'interval_km',
    'interval_months',
    'target_odometer',
    'target_date',
    'notes',
  ]);

  const { fields, values } = buildSafeUpdate(
    input as Record<string, unknown>,
    ALLOWED_COLUMNS
  );
  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  if (fields.length === 1) {
    return getMaintenanceProfileById(id);
  }

  db.runSync(
    `UPDATE maintenance_profiles SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  return getMaintenanceProfileById(id);
}

// ─── DELETE (SOFT) ───────────────────────────────────────────────────

export function softDeleteMaintenanceProfile(id: string): void {
  const db = getDatabase();
  const now = nowISO();
  db.runSync(
    'UPDATE maintenance_profiles SET deleted_at = ?, updated_at = ? WHERE id = ?',
    [now, now, id]
  );
}

// ─── DUE STATUS CALCULATION ──────────────────────────────────────────

/**
 * Evaluates due status for a vehicle maintenance profile.
 * Incorporates past service/component history if available.
 */
export function computeProfileDueStatus(
  profile: MaintenanceProfile,
  vehicle: Vehicle,
  lastHistory?: ComponentHistoryEntry | null
): ProfileDueStatus {
  const currentOdo = vehicle.current_odometer ?? null;
  const lastOdo = lastHistory?.serviceOdometer ?? null;
  const lastDate = lastHistory?.serviceDate ?? null;

  // Determine effective target odometer
  let effectiveTargetKm: number | null = null;
  if (profile.target_odometer) {
    effectiveTargetKm = profile.target_odometer;
  } else if (profile.interval_km && lastOdo !== null) {
    effectiveTargetKm = lastOdo + profile.interval_km;
  }

  // Determine effective target date
  let effectiveTargetDate: string | null = null;
  if (profile.target_date) {
    effectiveTargetDate = profile.target_date;
  } else if (profile.interval_months && lastDate) {
    try {
      const d = new Date(lastDate);
      d.setMonth(d.getMonth() + Math.round(profile.interval_months));
      effectiveTargetDate = d.toISOString().split('T')[0];
    } catch {
      effectiveTargetDate = null;
    }
  }

  let kmRemaining: number | null = null;
  if (effectiveTargetKm !== null && currentOdo !== null) {
    kmRemaining = effectiveTargetKm - currentOdo;
  }

  let daysRemaining: number | null = null;
  if (effectiveTargetDate) {
    daysRemaining = daysUntil(effectiveTargetDate);
  }

  if (effectiveTargetKm === null && effectiveTargetDate === null) {
    return {
      profile,
      status: 'none',
      kmRemaining: null,
      daysRemaining: null,
      effectiveTargetKm: null,
      effectiveTargetDate: null,
      lastServiceDate: lastDate,
      lastServiceOdometer: lastOdo,
      headline: `${profile.component_name} Configured`,
      subtext: 'No active interval or target has been reached yet.',
    };
  }

  const isKmOverdue = kmRemaining !== null && kmRemaining <= 0;
  const isTimeOverdue = daysRemaining !== null && daysRemaining <= 0;
  const isKmDueSoon = kmRemaining !== null && kmRemaining <= 1000;
  const isTimeDueSoon = daysRemaining !== null && daysRemaining <= 30;

  if (isKmOverdue || isTimeOverdue) {
    const kmText = kmRemaining !== null ? `${Math.abs(Math.round(kmRemaining))} km` : null;
    const timeText = daysRemaining !== null ? `${Math.abs(daysRemaining)} days` : null;
    const overdueDesc = [kmText, timeText].filter(Boolean).join(' and ');

    return {
      profile,
      status: 'overdue',
      kmRemaining,
      daysRemaining,
      effectiveTargetKm,
      effectiveTargetDate,
      lastServiceDate: lastDate,
      lastServiceOdometer: lastOdo,
      headline: `${profile.component_name} Overdue!`,
      subtext: `Target exceeded by ${overdueDesc}.`,
    };
  }

  if (isKmDueSoon || isTimeDueSoon) {
    const kmText = kmRemaining !== null ? `${Math.round(kmRemaining)} km` : null;
    const timeText = daysRemaining !== null ? `${daysRemaining} days` : null;
    const dueDesc = [kmText, timeText].filter(Boolean).join(' or ');

    return {
      profile,
      status: 'due_soon',
      kmRemaining,
      daysRemaining,
      effectiveTargetKm,
      effectiveTargetDate,
      lastServiceDate: lastDate,
      lastServiceOdometer: lastOdo,
      headline: `${profile.component_name} Due Soon`,
      subtext: `Service due in ${dueDesc}.`,
    };
  }

  const kmText = kmRemaining !== null ? `${Math.round(kmRemaining)} km` : null;
  const timeText = daysRemaining !== null ? `${daysRemaining} days` : null;
  const normalDesc = [kmText, timeText].filter(Boolean).join(' or ');

  return {
    profile,
    status: 'ok',
    kmRemaining,
    daysRemaining,
    effectiveTargetKm,
    effectiveTargetDate,
    lastServiceDate: lastDate,
    lastServiceOdometer: lastOdo,
    headline: `${profile.component_name} Normal`,
    subtext: `Due in ${normalDesc}.`,
  };
}

/**
 * Evaluates due statuses for all maintenance profiles of a vehicle.
 */
export function computeAllProfilesDueStatus(
  vehicleId: string,
  currentOdometer?: number | null
): ProfileDueStatus[] {
  const profiles = getMaintenanceProfilesByVehicle(vehicleId);
  if (profiles.length === 0) return [];

  const vehicleObj = {
    id: vehicleId,
    current_odometer: typeof currentOdometer === 'number' ? currentOdometer : null,
  } as Vehicle;

  return profiles.map((p) => computeProfileDueStatus(p, vehicleObj));
}
