/**
 * Backup Snapshot
 *
 * Reads the full DriveLedger dataset (SQLite tables + AsyncStorage state)
 * into an in-memory BackupData object. No encryption or file I/O happens here.
 *
 * Extracted from backupEngine.ts.
 */

import { getDatabase } from '@/database/connection';
import type { VehicleDocument } from '@/types/document';
import type { Expense } from '@/types/expense';
import type { FuelEntry } from '@/types/fuel';
import type { ServiceRecord, MaintenanceComponent, MaintenanceProfile } from '@/types/service';
import type { Trip, TripLocation } from '@/types/trip';
import type { Vehicle } from '@/types/vehicle';
import { nowISO } from '@/utils/date';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  APP_ID,
  CURRENT_BACKUP_VERSION,
  type BackupData,
  type BackupResult,
} from './types';

/**
 * Creates an in-memory snapshot of all DriveLedger data.
 * Includes all SQLite tables, user preferences, and checklist state.
 */
export function createBackup(): BackupResult {
  try {
    const db = getDatabase();
    let vehicles: Vehicle[] = [];
    let fuelEntries: FuelEntry[] = [];
    let serviceRecords: ServiceRecord[] = [];
    let expenses: Expense[] = [];
    let documents: VehicleDocument[] = [];
    let maintenanceComponents: MaintenanceComponent[] = [];
    let maintenanceProfiles: MaintenanceProfile[] = [];
    let trips: Trip[] = [];
    let tripLocations: TripLocation[] = [];

    db.withTransactionSync(() => {
      vehicles = db.getAllSync<Vehicle>('SELECT * FROM vehicles');
      fuelEntries = db.getAllSync<FuelEntry>('SELECT * FROM fuel_entries');
      serviceRecords = db.getAllSync<ServiceRecord>('SELECT * FROM service_records');
      expenses = db.getAllSync<Expense>('SELECT * FROM expenses');
      documents = db.getAllSync<VehicleDocument>('SELECT * FROM documents');
      try {
        maintenanceComponents = db.getAllSync<MaintenanceComponent>('SELECT * FROM maintenance_components');
      } catch {
        maintenanceComponents = [];
      }
      try {
        maintenanceProfiles = db.getAllSync<MaintenanceProfile>('SELECT * FROM maintenance_profiles');
      } catch {
        maintenanceProfiles = [];
      }
      try {
        trips = db.getAllSync<Trip>('SELECT * FROM trips');
      } catch {
        trips = [];
      }
      try {
        tripLocations = db.getAllSync<TripLocation>(
          'SELECT tl.* FROM trip_locations tl INNER JOIN trips t ON tl.trip_id = t.id ORDER BY tl.trip_id, tl.timestamp ASC'
        );
      } catch {
        tripLocations = [];
      }
    });

    const backup: BackupData = {
      app_id: APP_ID,
      version: CURRENT_BACKUP_VERSION,
      created_at: nowISO(),
      app_version: Constants.expoConfig?.version ?? '1.0.0',
      data: {
        vehicles,
        fuel_entries: fuelEntries,
        service_records: serviceRecords,
        expenses,
        documents,
        maintenance_components: maintenanceComponents,
        maintenance_profiles: maintenanceProfiles,
        trips,
        trip_locations: tripLocations,
      },
    };

    const total =
      vehicles.length +
      fuelEntries.length +
      serviceRecords.length +
      expenses.length +
      documents.length +
      maintenanceComponents.length +
      maintenanceProfiles.length +
      trips.length +
      tripLocations.length;

    return { success: true, message: `Backup created with ${total} records.`, backup };
  } catch (e) {
    return {
      success: false,
      message: `Backup failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
    };
  }
}

/**
 * Reads preferences and checklist state from AsyncStorage to attach to backup.
 */
export async function getAsyncStorageBackupState(): Promise<{
  preferences?: BackupData['data']['preferences'];
  checklists?: Record<string, string[]>;
}> {
  try {
    const prefRaw = await AsyncStorage.getItem('@driveledger_preferences');
    const preferences = prefRaw ? JSON.parse(prefRaw) : undefined;

    const allKeys = await AsyncStorage.getAllKeys();
    const checklistKeys = allKeys.filter((k) => k.startsWith('@driveledger_checklist_'));
    const checklists: Record<string, string[]> = {};

    for (const key of checklistKeys) {
      const vehicleId = key.replace('@driveledger_checklist_', '');
      const raw = await AsyncStorage.getItem(key);
      if (raw) {
        checklists[vehicleId] = JSON.parse(raw);
      }
    }

    return { preferences, checklists };
  } catch {
    return {};
  }
}

/** @deprecated Use exportToFile() instead. Kept for CSV export only. */
export function backupToJSON(backup: BackupData): string {
  return JSON.stringify(backup, null, 2);
}
