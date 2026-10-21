/**
 * Service Record Types
 *
 * TypeScript interface for the `service_records` table.
 * Matches the charter's database schema.
 */

// ─── Full Database Row ───────────────────────────────────────────────
export interface ServiceRecord {
  /** Primary key — UUID v4 */
  id: string;

  /** FK → vehicles.id */
  vehicle_id: string;

  /** Date the service was performed. ISO 8601 string. */
  date: string;

  /** Odometer reading at time of service (optional) */
  odometer: number | null;

  /**
   * Type of service performed.
   * Either from the predefined templates list or a custom free-text value.
   */
  service_type: string;

  /** Cost of the service (optional) */
  cost: number | null;

  /** Free-text description of what work was done (optional) */
  work_done: string | null;

  /** Name of the garage or service center (optional) */
  garage_name: string | null;

  /**
   * Next service due at this odometer reading.
   * Used with vehicle.current_odometer to compute km-until-next-service.
   */
  next_due_km: number | null;

  /** Next service due date. ISO 8601 string. (optional) */
  next_due_date: string | null;

  /** Free-text notes (optional) */
  notes: string | null;

  /** URI to receipt photo or invoice document (optional) */
  receipt_photo_uri?: string | null;

  /** ISO 8601 timestamp */
  created_at: string;

  /** ISO 8601 timestamp */
  updated_at: string;

  /** ISO 8601 timestamp — soft delete marker. NULL = not deleted. */
  deleted_at: string | null;
}

// ─── Create Input ────────────────────────────────────────────────────
export interface CreateServiceRecordInput {
  vehicle_id: string;
  date: string;
  service_type: string;

  // Optional
  odometer?: number;
  cost?: number;
  work_done?: string;
  garage_name?: string;
  next_due_km?: number;
  next_due_date?: string;
  notes?: string;
  receipt_photo_uri?: string;
}

// ─── Update Input ────────────────────────────────────────────────────
export type UpdateServiceRecordInput = Partial<
  Omit<ServiceRecord, 'id' | 'vehicle_id' | 'created_at' | 'updated_at' | 'deleted_at'>
>;

// ─── Maintenance Component Types ─────────────────────────────────────
export type MaintenanceAction =
  | 'replaced'
  | 'inspected'
  | 'serviced'
  | 'topped_up'
  | 'cleaned';

export interface MaintenanceComponent {
  /** Primary key — UUID v4 */
  id: string;

  /** FK → service_records.id */
  service_record_id: string;

  /** FK → vehicles.id */
  vehicle_id: string;

  /** Name of the component (e.g. Engine Oil, Brake Pads, Tyres) */
  component_name: string;

  /** Action taken: 'replaced' | 'inspected' | 'serviced' | 'topped_up' | 'cleaned' */
  action: string;

  /** Brand / manufacturer of the part installed (optional) */
  brand: string | null;

  /** Itemized cost if entered (optional — service_record.cost remains financial total) */
  cost: number | null;

  /** Next due odometer reading for this specific component (optional) */
  next_due_km: number | null;

  /** Next due date for this specific component (optional) */
  next_due_date: string | null;

  /** Component-specific notes (optional) */
  notes: string | null;

  /** ISO 8601 timestamp */
  created_at: string;

  /** ISO 8601 timestamp */
  updated_at: string;

  /** ISO 8601 timestamp — soft delete marker. NULL = not deleted. */
  deleted_at: string | null;
}

export interface CreateMaintenanceComponentInput {
  service_record_id?: string;
  vehicle_id?: string;
  component_name: string;
  action?: string | MaintenanceAction;
  brand?: string;
  cost?: number;
  next_due_km?: number;
  next_due_date?: string;
  notes?: string;
  maintenance_date?: string;
  odometer?: number;
}

export type UpdateMaintenanceComponentInput = Partial<
  Omit<MaintenanceComponent, 'id' | 'service_record_id' | 'vehicle_id' | 'created_at' | 'updated_at' | 'deleted_at'>
>;

// ─── Maintenance Profile Types ───────────────────────────────────────
export interface MaintenanceProfile {
  id: string;
  vehicle_id: string;
  component_name: string;
  interval_km: number | null;
  interval_months: number | null;
  target_odometer: number | null;
  target_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreateMaintenanceProfileInput {
  vehicle_id: string;
  component_name: string;
  interval_km?: number | null;
  interval_months?: number | null;
  target_odometer?: number | null;
  target_date?: string | null;
  notes?: string | null;
}

export type UpdateMaintenanceProfileInput = Partial<
  Omit<MaintenanceProfile, 'id' | 'vehicle_id' | 'created_at' | 'updated_at' | 'deleted_at'>
>;

export interface ProfileDueStatus {
  profile: MaintenanceProfile;
  status: 'ok' | 'due_soon' | 'overdue' | 'none';
  kmRemaining: number | null;
  daysRemaining: number | null;
  effectiveTargetKm: number | null;
  effectiveTargetDate: string | null;
  lastServiceDate: string | null;
  lastServiceOdometer: number | null;
  headline: string;
  subtext: string;
}
