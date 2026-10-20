/**
 * Service Record Store (Zustand)
 *
 * Global state for service records.
 * Connects the UI layer to the serviceRepo.
 *
 * KEY FEATURES:
 * - CRUD operations for service records
 * - Computes "km until next service" from latest service's next_due_km
 *   and vehicle.current_odometer
 * - Provides latest service record for dashboard display
 */

import { create } from 'zustand';
import type {
  ServiceRecord,
  CreateServiceRecordInput,
  UpdateServiceRecordInput,
  MaintenanceComponent,
  CreateMaintenanceComponentInput,
} from '@/types/service';
import type { Vehicle } from '@/types/vehicle';
import * as serviceRepo from '@/database/repositories/serviceRepo';
import * as maintCompRepo from '@/database/repositories/maintenanceComponentRepo';
import { getDatabase } from '@/database/connection';
import { syncWidgetState } from '@/widgets/widgetDataService';
import { refreshReminders } from '@/services/notificationService';

export * from '@/database/repositories/maintenanceComponentRepo';

interface ServiceState {
  /** Service records for the currently selected vehicle */
  records: ServiceRecord[];
  /** Loading state */
  isLoading: boolean;

  // ── Actions ──
  /** Load service records for a vehicle */
  loadRecords: (vehicleId: string) => void;
  /** Create a new service record with optional parts-level components */
  addRecord: (
    input: CreateServiceRecordInput,
    components?: CreateMaintenanceComponentInput[]
  ) => ServiceRecord;
  /** Update an existing service record with optional components sync */
  editRecord: (
    id: string,
    input: UpdateServiceRecordInput,
    components?: CreateMaintenanceComponentInput[]
  ) => ServiceRecord | null;
  /** Delete a service record and associated components (soft delete) */
  deleteRecord: (id: string) => void;
  /** Get components for a service record */
  getServiceComponents: (serviceRecordId: string) => MaintenanceComponent[];
  /** Get component histories for a vehicle */
  getComponentHistories: (
    vehicleId: string
  ) => Record<string, maintCompRepo.ComponentHistoryEntry[]>;
}

export const useServiceStore = create<ServiceState>((set, get) => ({
  records: [],
  isLoading: true,

  loadRecords: (vehicleId: string) => {
    const records = serviceRepo.getServiceRecordsByVehicle(vehicleId);
    set({ records, isLoading: false });
  },

  addRecord: (
    input: CreateServiceRecordInput,
    components?: CreateMaintenanceComponentInput[]
  ) => {
    const db = getDatabase();
    let record: ServiceRecord;

    db.withTransactionSync(() => {
      record = serviceRepo.createServiceRecord(input);
      if (components && components.length > 0) {
        maintCompRepo.createMaintenanceComponents(
          components,
          record.id,
          input.vehicle_id
        );
      }
    });

    const records = serviceRepo.getServiceRecordsByVehicle(input.vehicle_id);
    set({ records });
    syncWidgetState();
    refreshReminders();
    return record!;
  },

  editRecord: (
    id: string,
    input: UpdateServiceRecordInput,
    components?: CreateMaintenanceComponentInput[]
  ) => {
    const db = getDatabase();

    db.withTransactionSync(() => {
      const record = serviceRepo.updateServiceRecord(id, input);
      if (record && components !== undefined) {
        // Sync components: delete previous for this service and recreate new
        maintCompRepo.deleteMaintenanceComponentsByService(id);
        if (components.length > 0) {
          maintCompRepo.createMaintenanceComponents(
            components,
            id,
            record.vehicle_id
          );
        }
      }
    });

    const updated = serviceRepo.getServiceRecordById(id);
    if (updated) {
      const records = serviceRepo.getServiceRecordsByVehicle(updated.vehicle_id);
      set({ records });
      syncWidgetState();
      refreshReminders();
    }
    return updated;
  },

  deleteRecord: (id: string) => {
    const record = serviceRepo.getServiceRecordById(id);
    const db = getDatabase();

    db.withTransactionSync(() => {
      serviceRepo.softDeleteServiceRecord(id);
      maintCompRepo.deleteMaintenanceComponentsByService(id);
    });

    if (record) {
      const records = serviceRepo.getServiceRecordsByVehicle(record.vehicle_id);
      set({ records });
      syncWidgetState();
      refreshReminders();
    }
  },

  getServiceComponents: (serviceRecordId: string) => {
    return maintCompRepo.getMaintenanceComponentsByService(serviceRecordId);
  },

  getComponentHistories: (vehicleId: string) => {
    return maintCompRepo.getAllComponentHistories(vehicleId);
  },
}));

// ─── Computed Helpers (pure functions, no state) ────────────────────

/**
 * Result of dual-dimension (Mileage vs. Time) service calculation:
 * In India, servicing guidelines strictly follow:
 * "10,000 km OR 1 Year, whichever comes first" or "5,000 km OR 6 Months".
 */
export interface ServiceDueStatus {
  urgency: 'ok' | 'due_soon' | 'overdue';
  reason: 'km' | 'time' | 'both' | null;
  kmRemaining: number | null;
  daysRemaining: number | null;
  targetKm: number | null;
  targetDate: string | null;
  headline: string;
  subtext: string;
}

/**
 * Computes km remaining until the next service is due.
 *
 * @param vehicle - The vehicle (needs current_odometer)
 * @param latestService - The most recent service record (needs next_due_km)
 * @returns km remaining, or null if not computable
 */
export function getKmUntilService(
  vehicle: Vehicle,
  latestService: ServiceRecord | null
): number | null {
  if (!vehicle.current_odometer) return null;
  if (latestService?.next_due_km) {
    return latestService.next_due_km - vehicle.current_odometer;
  }
  if (latestService?.odometer && vehicle.service_interval_km) {
    return (latestService.odometer + vehicle.service_interval_km) - vehicle.current_odometer;
  }
  if (vehicle.service_interval_km) {
    return vehicle.service_interval_km - vehicle.current_odometer;
  }
  return null;
}

/**
 * Computes dual-dimension service due status: Mileage (km) vs Time (Months/Days).
 * Triggers warning on whichever metric breaches threshold first!
 */
export function getServiceDueStatus(
  vehicle: Vehicle,
  latestService: ServiceRecord | null
): ServiceDueStatus {
  // 1. Distance Dimension
  const kmRemaining = getKmUntilService(vehicle, latestService);
  const targetKm = latestService?.next_due_km ?? (
    latestService?.odometer && vehicle.service_interval_km
      ? latestService.odometer + vehicle.service_interval_km
      : vehicle.service_interval_km ?? null
  );

  // 2. Time Dimension
  let targetDate: string | null = latestService?.next_due_date ?? null;
  if (!targetDate) {
    const baseDateStr = latestService?.date ?? vehicle.purchase_date ?? null;
    const intervalMonths = vehicle.service_interval_months ?? 12;
    if (baseDateStr) {
      const baseDate = new Date(baseDateStr);
      if (!isNaN(baseDate.getTime())) {
        baseDate.setMonth(baseDate.getMonth() + intervalMonths);
        targetDate = baseDate.toISOString().split('T')[0];
      }
    }
  }

  let daysRemaining: number | null = null;
  if (targetDate) {
    const targetTime = new Date(targetDate).getTime();
    if (!isNaN(targetTime)) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      daysRemaining = Math.ceil((targetTime - now.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  // Thresholds
  const KM_DUE_SOON = 1000;
  const DAYS_DUE_SOON = 30;

  const isKmOverdue = kmRemaining !== null && kmRemaining <= 0;
  const isTimeOverdue = daysRemaining !== null && daysRemaining <= 0;

  const isKmDueSoon = kmRemaining !== null && kmRemaining <= KM_DUE_SOON;
  const isTimeDueSoon = daysRemaining !== null && daysRemaining <= DAYS_DUE_SOON;

  // Determine Urgency & Reason
  if (isKmOverdue || isTimeOverdue) {
    const reason = isKmOverdue && isTimeOverdue ? 'both' : isKmOverdue ? 'km' : 'time';
    let headline = '🔧 Service Overdue!';
    let subtext = '';

    if (reason === 'both') {
      headline = '🔧 Service Overdue (Mileage & Time)';
      subtext = `${Math.abs(Math.round(kmRemaining!)).toLocaleString('en-IN')} km and ${Math.abs(daysRemaining!)} days past due service.`;
    } else if (reason === 'km') {
      headline = '🔧 Service Overdue (Mileage Exceeded)';
      subtext = `${Math.abs(Math.round(kmRemaining!)).toLocaleString('en-IN')} km past recommended service odometer (${Math.round(targetKm!).toLocaleString('en-IN')} km).`;
    } else {
      headline = '🔧 Service Overdue (Time Limit Reached)';
      subtext = `Due ${Math.abs(daysRemaining!)} days ago. Even with low mileage, oil degrades over time.`;
    }

    return {
      urgency: 'overdue',
      reason,
      kmRemaining,
      daysRemaining,
      targetKm,
      targetDate,
      headline,
      subtext,
    };
  }

  if (isKmDueSoon || isTimeDueSoon) {
    const reason = isKmDueSoon && isTimeDueSoon ? 'both' : isKmDueSoon ? 'km' : 'time';
    let headline = '🔧 Service Due Soon';
    let subtext = '';

    if (reason === 'both') {
      headline = `🔧 Service Due Soon (${kmRemaining} km / ${daysRemaining}d)`;
      subtext = `Due in ${Math.round(kmRemaining!).toLocaleString('en-IN')} km or ${daysRemaining} days.`;
    } else if (reason === 'km') {
      headline = `🔧 Service Due in ${Math.round(kmRemaining!).toLocaleString('en-IN')} km`;
      subtext = `Mileage limit approaching faster than time interval (${daysRemaining ? `${daysRemaining} days left` : ''}).`;
    } else {
      headline = `🔧 Service Due in ${daysRemaining} Days`;
      subtext = `Time limit approaching first (${Math.round(kmRemaining!).toLocaleString('en-IN')} km remaining before mileage cap).`;
    }

    return {
      urgency: 'due_soon',
      reason,
      kmRemaining,
      daysRemaining,
      targetKm,
      targetDate,
      headline,
      subtext,
    };
  }

  // Healthy
  let subtext = 'Vehicle maintenance is up to date.';
  if (kmRemaining !== null && daysRemaining !== null) {
    const monthsEst = Math.round(daysRemaining / 30.4);
    subtext = `Next service in ${Math.round(kmRemaining).toLocaleString('en-IN')} km or ~${monthsEst} months (whichever comes first).`;
  } else if (kmRemaining !== null) {
    subtext = `Next service due in ${Math.round(kmRemaining).toLocaleString('en-IN')} km.`;
  } else if (daysRemaining !== null) {
    subtext = `Next service due in ~${Math.round(daysRemaining / 30.4)} months.`;
  }

  return {
    urgency: 'ok',
    reason: null,
    kmRemaining,
    daysRemaining,
    targetKm,
    targetDate,
    headline: 'Service Status Normal',
    subtext,
  };
}
