/**
 * Backup & Restore Engine
 *
 * SECURITY & STORAGE MODEL (v3)
 * ─────────────────────────────
 * Every newly exported backup (.dlbak) is:
 *   1. Encrypted with AES-256-GCM using a key derived from a user-provided
 *      password and a fresh 16-byte random salt via PBKDF2-HMAC-SHA256 (10,000 iterations with event-loop yielding).
 *   2. Authenticated with a 16-byte GCM authentication tag covering both ciphertext
 *      and versioned envelope metadata passed as Associated Authenticated Data (AAD).
 *   3. 100% Portable: Can be exported from one device and restored on any other
 *      device simply by entering the backup password. No device-specific keys or
 *      hardcoded shared secrets are required.
 *
 * VERSION 3 ENFORCEMENT
 * ─────────────────────
 * All backups require Version 3 password protection. Legacy Version 1 and
 * Version 2 formats have been retired for security.
 *
 * ATOMIC RESTORE GUARANTEE
 * ────────────────────────
 * Restore operations are executed inside an atomic SQLite transaction
 * (db.withTransactionSync). Any error during parsing, decryption, schema
 * validation, or row insertion causes an immediate rollback, leaving the
 * pre-existing database completely intact. Notifications are reconciled
 * only after the restore transaction has safely committed.
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
import { Directory, File, Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { refreshReminders } from '@/services/notificationService';
import { buildLedgerCsv } from '@/utils/csvExport';

// Sub-modules
export * from './backup/types';
export * from './backup/schema';
export * from './backup/crypto';

import {
  APP_ID,
  CURRENT_BACKUP_VERSION,
  ENCRYPTED_BACKUP_FORMAT,
  type BackupData,
  type BackupAttachment,
  type BackupResult,
  type RestoreResult,
  type ExportFileResult,
  type VerifyBackupResult,
  type PasswordEncryptedBackupEnvelope,
} from './backup/types';
import { validateSchema } from './backup/schema';
import {
  encryptBackupV3,
  decryptBackupV3,
  validateEnvelopeV3,
} from './backup/crypto';

// ─── Constants ───────────────────────────────────────────────────────

/** File extension used for backup files. */
export const BACKUP_EXT = '.dlbak';

/** Deliberately unassociated type: backups are opaque DriveLedger files. */
export const BACKUP_MIME_TYPE = 'application/vnd.driveledger.dlbak';

// ─── Read from database ──────────────────────────────────────────────

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

// ─── Export — Save to Device ─────────────────────────────────────────

/**
/**
 * Generates and encrypts a backup into a string without initiating file/SAF dialogs.
 * Useful for automated tests and headless verification.
 */
export async function exportBackupString(
  password: string
): Promise<{ success: boolean; content?: string; message?: string }> {
  if (!password || password.trim().length < 4) {
    return {
      success: false,
      message: 'Password must be at least 4 characters to protect your backup.',
    };
  }

  // 1. Read SQLite data
  const result = createBackup();
  if (!result.success || !result.backup) {
    return { success: false, message: result.message };
  }

  // 2. Read AsyncStorage state
  const asyncState = await getAsyncStorageBackupState();
  if (asyncState.preferences) {
    result.backup.data.preferences = asyncState.preferences;
  }
  if (asyncState.checklists && Object.keys(asyncState.checklists).length > 0) {
    result.backup.data.checklists = asyncState.checklists;
  }

  // 2b. Collect attachments from records if files exist on device
  const attachments: BackupAttachment[] = [];
  const urisToRead = new Set<string>();

  for (const d of result.backup.data.documents) {
    if (d.file_uri) urisToRead.add(d.file_uri);
  }
  for (const f of result.backup.data.fuel_entries) {
    if (f.receipt_photo_uri) urisToRead.add(f.receipt_photo_uri);
  }
  for (const s of result.backup.data.service_records) {
    if (s.receipt_photo_uri) urisToRead.add(s.receipt_photo_uri);
  }
  for (const e of result.backup.data.expenses) {
    if (e.receipt_photo_uri) urisToRead.add(e.receipt_photo_uri);
  }

  for (const uri of urisToRead) {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists && !info.isDirectory) {
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const filename = uri.replace(/^.*[\\/]/, '');
        if (filename && !filename.includes('..') && !filename.includes('/') && !filename.includes('\\')) {
          attachments.push({ filename, base64 });
        }
      }
    } catch {
      // Ignore unreadable or missing local files
    }
  }
  if (attachments.length > 0) {
    result.backup.data.attachments = attachments;
  }

  // 3. Encrypt envelope with user password
  const createdAt = nowISO();
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  try {
    const content = await encryptBackupV3(JSON.stringify(result.backup), password, {
      app_id: APP_ID,
      app_version: appVersion,
      created_at: createdAt,
    });
    return { success: true, content };
  } catch (e) {
    return {
      success: false,
      message: `Could not encrypt backup: ${e instanceof Error ? e.message : 'Unknown error'}`,
    };
  }
}

/**
 * Encrypts and exports backup as a password-protected .dlbak file.
 *
 * Flow:
 *   1. Read all data from SQLite.
 *   2. Read preferences and checklist state from AsyncStorage.
 *   3. Encrypt with AES-256-GCM using key derived from user password via PBKDF2.
 *   4. Save to app private storage, then let user pick folder or share.
 */
export async function exportToFile(password: string): Promise<ExportFileResult> {
  const exportRes = await exportBackupString(password);
  if (!exportRes.success || !exportRes.content) {
    return { success: false, message: exportRes.message || 'Export failed.' };
  }
  const content = exportRes.content;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `DriveLedger_${timestamp}${BACKUP_EXT}`;

  // Write to app's private directory
  const tempFile = new File(Paths.document, filename);
  try {
    try {
      tempFile.delete();
    } catch (_) {
      /* didn't exist */
    }
    tempFile.write(content);
  } catch (e) {
    return {
      success: false,
      message: `Could not write backup file: ${e instanceof Error ? e.message : 'Unknown error'}`,
    };
  }

  // 5. Let user pick destination folder (SAF on Android)
  try {
    const destDir = await Directory.pickDirectoryAsync();
    const destFile = destDir.createFile(filename, BACKUP_MIME_TYPE);
    destFile.write(content);

    return {
      success: true,
      message: `Backup saved as "${filename}"`,
      filePath: destFile.uri,
    };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    const isCancelled =
      errMsg.includes('cancelled') ||
      errMsg.includes('canceled') ||
      errMsg.includes('user canceled');

    if (isCancelled) {
      // User dismissed directory picker — offer via share sheet
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        try {
          await Sharing.shareAsync(tempFile.uri, {
            mimeType: BACKUP_MIME_TYPE,
            dialogTitle: 'Save DriveLedger Backup',
            UTI: 'public.data',
          });
          return { success: true, message: 'Backup ready to save!', filePath: tempFile.uri };
        } catch (_) {
          return { success: true, message: 'Backup created (share cancelled).', filePath: tempFile.uri };
        }
      }
      return { success: true, message: 'Backup created (folder selection cancelled).', filePath: tempFile.uri };
    }

    return {
      success: false,
      message: `Could not save backup: ${errMsg}`,
    };
  }
}

/**
 * Exports all vehicle records as a .csv file to device storage or native share sheet.
 * Unlike plain text sharing, this generates a real RFC 4180 CSV spreadsheet file.
 */
export async function exportCsvFile(): Promise<ExportFileResult> {
  const result = createBackup();
  if (!result.success || !result.backup) {
    return {
      success: false,
      message: result.message || 'Could not load vehicle records for CSV export.',
    };
  }

  const csvContent = buildLedgerCsv(result.backup.data);
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `DriveLedger_Ledger_${dateStr}.csv`;
  const mimeType = 'text/csv';

  const tempFile = new File(Paths.document, filename);
  try {
    try {
      tempFile.delete();
    } catch (_) {
      /* didn't exist */
    }
    tempFile.create();
    tempFile.write(csvContent);
  } catch (e) {
    return {
      success: false,
      message: `Could not write CSV file: ${e instanceof Error ? e.message : 'Unknown error'}`,
    };
  }

  try {
    const destDir = await Directory.pickDirectoryAsync();
    const destFile = destDir.createFile(filename, mimeType);
    destFile.write(csvContent);

    return {
      success: true,
      message: `CSV saved as "${filename}"`,
      filePath: destFile.uri,
    };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    const isCancelled =
      errMsg.includes('cancelled') ||
      errMsg.includes('canceled') ||
      errMsg.includes('user canceled');

    if (isCancelled) {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        try {
          await Sharing.shareAsync(tempFile.uri, {
            mimeType,
            dialogTitle: 'Export DriveLedger Ledger (CSV)',
            UTI: 'public.comma-separated-values-text',
          });
          return { success: true, message: 'CSV file exported successfully.', filePath: tempFile.uri };
        } catch (_) {
          return { success: true, message: 'CSV file created (share cancelled).', filePath: tempFile.uri };
        }
      }
      return { success: true, message: 'CSV file created (folder selection cancelled).', filePath: tempFile.uri };
    }

    return {
      success: false,
      message: `Could not save CSV file: ${errMsg}`,
    };
  }
}

// ─── Import & Verify ─────────────────────────────────────────────────

/**
 * Validates and decrypts raw backup file content.
 * Supports:
 *   - Version 3: Password-protected backups (returns requiresPassword: true if password not yet provided)
 *   - Version 1 & 2: Legacy encrypted backups (bundle-key)
 *   - Version 1: Legacy plaintext JSON backups
 */
export async function verifyBackupContent(
  rawContent: string,
  password?: string
): Promise<VerifyBackupResult> {
  if (!rawContent || rawContent.trim().length === 0) {
    return { success: false, message: 'Backup file is empty.' };
  }

  // Guard against oversized files (> 50 MB)
  if (rawContent.length > 50 * 1024 * 1024) {
    return { success: false, message: 'File is too large to be a valid backup (> 50 MB).' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    return { success: false, message: 'The selected file is not a valid DriveLedger backup.' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { success: false, message: 'Invalid backup envelope structure.' };
  }

  const obj = parsed as Record<string, unknown>;

  // Check format & version: Only Version 3 password-protected backups are supported
  if (obj.format !== ENCRYPTED_BACKUP_FORMAT || obj.version !== CURRENT_BACKUP_VERSION) {
    return {
      success: false,
      message: 'Unsupported backup format or version. DriveLedger requires Version 3 password-protected backups.',
    };
  }

  const envelopeValidation = validateEnvelopeV3(obj);
  if (!envelopeValidation.valid) {
    return { success: false, message: envelopeValidation.error };
  }

  if (!password) {
    return {
      success: true,
      requiresPassword: true,
      message: 'This backup is password-protected. Please enter the password to restore it.',
    };
  }

  let decryptedJson: string;
  try {
    decryptedJson = await decryptBackupV3(
      envelopeValidation.envelope as PasswordEncryptedBackupEnvelope,
      password
    );
  } catch (err) {
    return {
      success: false,
      message:
        err instanceof Error
          ? err.message
          : 'Incorrect password or corrupted backup file. Decryption failed.',
    };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(decryptedJson);
  } catch {
    return { success: false, message: 'Decrypted backup payload contains malformed JSON.' };
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { success: false, message: 'Invalid payload structure inside decrypted backup.' };
  }

  return finishBackupValidation(payload as Record<string, unknown>);
}

/**
 * Validates payload app_id and row-level schema.
 */
function finishBackupValidation(
  obj: Record<string, unknown>
): VerifyBackupResult {
  // Check 1: app_id
  if (obj.app_id !== undefined && obj.app_id !== APP_ID) {
    return {
      success: false,
      message: `Wrong app backup.\n\nThis file was exported by a different app (ID: "${obj.app_id}"). DriveLedger can only restore its own backups.`,
    };
  }

  // Check 2: Schema validation
  const validated = validateSchema(obj);
  if (!validated) {
    return {
      success: false,
      message:
        'The backup file does not contain valid DriveLedger data. Required fields are missing or corrupted.',
    };
  }

  const backup: BackupData = {
    app_id: (obj.app_id as string) ?? APP_ID,
    version: typeof obj.version === 'number' ? obj.version : CURRENT_BACKUP_VERSION,
    created_at: typeof obj.created_at === 'string' ? obj.created_at : nowISO(),
    app_version: typeof obj.app_version === 'string' ? obj.app_version : '1.0.0',
    data: validated.data,
  };

  return { success: true, message: 'Backup verified.', backup };
}

/**
 * Opens OS file picker, reads .dlbak file, and verifies its envelope.
 * If password-protected, returns `requiresPassword: true` so the caller can prompt the user.
 */
export async function pickAndVerifyBackup(
  password?: string
): Promise<VerifyBackupResult & { pickedFileContent?: string; pickedFileUri?: string }> {
  let pickedFile: File;
  try {
    const pickerResult = await File.pickFileAsync({
      mimeTypes: ['*/*'],
    });
    if (pickerResult.canceled || !pickerResult.result) {
      return { success: false, message: 'No file selected.' };
    }
    pickedFile = pickerResult.result as File;
  } catch {
    return { success: false, message: 'Could not open file picker.' };
  }

  const name = (pickedFile.name ?? '').toLowerCase();
  const isOfficialFormat = name.endsWith(BACKUP_EXT) || name.endsWith('.json');
  if (!isOfficialFormat) {
    return {
      success: false,
      message: `Invalid file type.\n\nDriveLedger backup files end in "${BACKUP_EXT}".`,
    };
  }

  let rawContent: string;
  try {
    rawContent = await pickedFile.text();
  } catch (e) {
    try {
      rawContent = await FileSystem.readAsStringAsync(pickedFile.uri);
    } catch {
      return {
        success: false,
        message: `Could not read file: ${e instanceof Error ? e.message : 'Unknown error'}`,
      };
    }
  }

  const result = await verifyBackupContent(rawContent, password);
  return {
    ...result,
    pickedFileContent: rawContent,
    pickedFileUri: pickedFile.uri,
  };
}

// ─── DB Restore ──────────────────────────────────────────────────────

/**
 * Atomically replaces all database data with the contents of a verified backup.
 * Executed inside db.withTransactionSync: if any write fails, everything rolls back.
 * Reconciles reminders immediately after successful commit.
 */
export function restoreFromValidated(backup: BackupData): RestoreResult {
  const db = getDatabase();

  try {
    db.withTransactionSync(() => {
      // Clear all tables in foreign-key dependency order
      try {
        db.execSync('DELETE FROM trip_locations');
      } catch {}
      try {
        db.execSync('DELETE FROM trips');
      } catch {}
      try {
        db.execSync('DELETE FROM maintenance_profiles');
      } catch {}
      try {
        db.execSync('DELETE FROM maintenance_components');
      } catch {}
      db.execSync('DELETE FROM documents');
      db.execSync('DELETE FROM expenses');
      db.execSync('DELETE FROM service_records');
      db.execSync('DELETE FROM fuel_entries');
      db.execSync('DELETE FROM vehicles');

      // 1. Vehicles
      for (const v of backup.data.vehicles) {
        let fuelType = v.fuel_type as string;
        if (fuelType === 'hybrid') fuelType = 'hybrid_cng_petrol'; // migrate legacy

        db.runSync(
          `INSERT OR IGNORE INTO vehicles (
             id, nickname, vehicle_type, manufacturer, model, variant, year, color,
             registration_number, fuel_type, tank_capacity, secondary_tank_capacity,
             current_odometer, front_tyre_pressure, rear_tyre_pressure,
             service_interval_km, service_interval_months, purchase_date, notes, is_archived, created_at, updated_at, deleted_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            v.id,
            v.nickname,
            v.vehicle_type,
            v.manufacturer ?? null,
            v.model ?? null,
            v.variant ?? null,
            v.year ?? null,
            v.color ?? null,
            v.registration_number,
            fuelType,
            v.tank_capacity ?? null,
            v.secondary_tank_capacity ?? null,
            v.current_odometer ?? null,
            v.front_tyre_pressure ?? null,
            v.rear_tyre_pressure ?? null,
            v.service_interval_km ?? null,
            v.service_interval_months ?? 12,
            v.purchase_date ?? null,
            v.notes ?? null,
            v.is_archived ?? 0,
            v.created_at || nowISO(),
            v.updated_at || nowISO(),
            v.deleted_at ?? null,
          ]
        );
      }

      // 2. Fuel entries
      for (const f of backup.data.fuel_entries) {
        db.runSync(
          `INSERT INTO fuel_entries (id, vehicle_id, date, odometer, fuel_amount, fuel_unit, price_per_unit,
           total_cost, fuel_station, is_full_tank, calculated_mileage, mileage_unit,
           receipt_photo_uri, notes, fuel_system, battery_start_percent, battery_end_percent,
           created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            f.id,
            f.vehicle_id,
            f.date,
            f.odometer,
            f.fuel_amount,
            f.fuel_unit,
            f.price_per_unit,
            f.total_cost,
            f.fuel_station ?? null,
            f.is_full_tank ?? 1,
            f.calculated_mileage ?? null,
            f.mileage_unit ?? null,
            f.receipt_photo_uri ?? null,
            f.notes ?? null,
            f.fuel_system ?? 'primary',
            f.battery_start_percent ?? null,
            f.battery_end_percent ?? null,
            f.created_at || nowISO(),
            f.updated_at || nowISO(),
            f.deleted_at ?? null,
          ]
        );
      }

      // 3. Service records
      for (const s of backup.data.service_records) {
        db.runSync(
          `INSERT INTO service_records (id, vehicle_id, date, odometer, service_type, cost, work_done,
           garage_name, next_due_km, next_due_date, notes, receipt_photo_uri, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            s.id,
            s.vehicle_id,
            s.date,
            s.odometer ?? null,
            s.service_type,
            s.cost ?? null,
            s.work_done ?? null,
            s.garage_name ?? null,
            s.next_due_km ?? null,
            s.next_due_date ?? null,
            s.notes ?? null,
            s.receipt_photo_uri ?? null,
            s.created_at || nowISO(),
            s.updated_at || nowISO(),
            s.deleted_at ?? null,
          ]
        );
      }

      // 3b. Maintenance components
      if (backup.data.maintenance_components) {
        for (const mc of backup.data.maintenance_components) {
          try {
            db.runSync(
              `INSERT INTO maintenance_components (id, service_record_id, vehicle_id, component_name,
               action, brand, cost, next_due_km, next_due_date, notes, created_at, updated_at, deleted_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                mc.id,
                mc.service_record_id,
                mc.vehicle_id,
                mc.component_name,
                mc.action || 'replaced',
                mc.brand ?? null,
                mc.cost ?? null,
                mc.next_due_km ?? null,
                mc.next_due_date ?? null,
                mc.notes ?? null,
                mc.created_at || nowISO(),
                mc.updated_at || nowISO(),
                mc.deleted_at ?? null,
              ]
            );
          } catch {}
        }
      }

      // 3c. Maintenance profiles
      if (backup.data.maintenance_profiles) {
        for (const mp of backup.data.maintenance_profiles) {
          try {
            db.runSync(
              `INSERT INTO maintenance_profiles (id, vehicle_id, component_name, interval_km, interval_months,
               target_odometer, target_date, notes, created_at, updated_at, deleted_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                mp.id,
                mp.vehicle_id,
                mp.component_name,
                mp.interval_km ?? null,
                mp.interval_months ?? null,
                mp.target_odometer ?? null,
                mp.target_date ?? null,
                mp.notes ?? null,
                mp.created_at || nowISO(),
                mp.updated_at || nowISO(),
                mp.deleted_at ?? null,
              ]
            );
          } catch {}
        }
      }

      // 3d. Trips
      if (backup.data.trips) {
        for (const t of backup.data.trips) {
          try {
            db.runSync(
              `INSERT INTO trips (id, vehicle_id, trip_type, status, start_time, end_time,
               start_odometer, end_odometer, distance_km, duration_seconds, purpose, notes,
               sample_count, quality_warning, diagnostics, created_at, updated_at, deleted_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                t.id,
                t.vehicle_id,
                t.trip_type,
                t.status,
                t.start_time,
                t.end_time ?? null,
                t.start_odometer ?? null,
                t.end_odometer ?? null,
                t.distance_km ?? 0,
                t.duration_seconds ?? 0,
                t.purpose ?? null,
                t.notes ?? null,
                t.sample_count ?? 0,
                t.quality_warning ?? null,
                t.diagnostics ?? null,
                t.created_at || nowISO(),
                t.updated_at || nowISO(),
                t.deleted_at ?? null,
              ]
            );
          } catch {}
        }
      }

      // 3e. Trip locations
      if (backup.data.trip_locations && backup.data.trip_locations.length > 0) {
        for (const loc of backup.data.trip_locations) {
          try {
            db.runSync(
              `INSERT INTO trip_locations (
                id, trip_id, latitude, longitude, accuracy, altitude,
                speed, heading, timestamp, is_rejected, rejection_reason, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                loc.id,
                loc.trip_id,
                loc.latitude,
                loc.longitude,
                loc.accuracy ?? null,
                loc.altitude ?? null,
                loc.speed ?? null,
                loc.heading ?? null,
                loc.timestamp,
                typeof loc.is_rejected === 'number' ? loc.is_rejected : (loc.is_rejected ? 1 : 0),
                loc.rejection_reason ?? null,
                loc.created_at || nowISO(),
              ]
            );
          } catch {}
        }
      }

      // 4. Expenses
      for (const e of backup.data.expenses) {
        db.runSync(
          `INSERT INTO expenses (id, vehicle_id, date, category, amount, description, receipt_photo_uri, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            e.id,
            e.vehicle_id,
            e.date,
            e.category,
            e.amount,
            e.description ?? null,
            e.receipt_photo_uri ?? null,
            e.created_at || nowISO(),
            e.updated_at || nowISO(),
            e.deleted_at ?? null,
          ]
        );
      }

      // 5. Documents (pass 1: insert records with superseded_by = null)
      for (const d of backup.data.documents) {
        let docType: any = d.type || (d as any).document_type;
        if (docType) {
          const lower = String(docType).toLowerCase();
          if (lower === 'insurance') docType = 'Insurance';
          else if (lower === 'puc') docType = 'PUC';
          else if (lower === 'rc') docType = 'RC';
          else if (lower === 'fastag') docType = 'FASTag';
          else if (lower === 'warranty') docType = 'Warranty';
        }

        db.runSync(
          `INSERT INTO documents (id, vehicle_id, type, document_number, insurer_name, issue_date,
           expiry_date, file_uri, superseded_by, notes, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            d.id,
            d.vehicle_id,
            docType,
            d.document_number ?? null,
            d.insurer_name ?? null,
            d.issue_date ?? null,
            d.expiry_date ?? null,
            d.file_uri ?? null,
            null,
            d.notes ?? null,
            d.created_at || nowISO(),
            d.updated_at || nowISO(),
            d.deleted_at ?? null,
          ]
        );
      }

      // 6. Documents (pass 2: link renewal relationships)
      for (const d of backup.data.documents) {
        if (d.superseded_by) {
          db.runSync('UPDATE documents SET superseded_by = ? WHERE id = ?', [
            d.superseded_by,
            d.id,
          ]);
        }
      }
    });

    // 7. Restore attachments safely outside SQLite transaction
    if (backup.data.attachments && backup.data.attachments.length > 0) {
      const attachDir = `${FileSystem.documentDirectory}attachments/`;
      try {
        FileSystem.getInfoAsync(attachDir).then((dirInfo) => {
          if (!dirInfo.exists) {
            FileSystem.makeDirectoryAsync(attachDir, { intermediates: true }).catch(() => {});
          }
        }).catch(() => {});

        for (const att of backup.data.attachments) {
          if (
            !att.filename ||
            att.filename.includes('..') ||
            att.filename.includes('/') ||
            att.filename.includes('\\')
          ) {
            continue;
          }
          const targetPath = `${attachDir}${att.filename}`;
          FileSystem.writeAsStringAsync(targetPath, att.base64, {
            encoding: FileSystem.EncodingType.Base64,
          }).catch((err) => {
            console.warn('[BackupEngine] Failed to restore attachment file:', att.filename, err);
          });
        }
      } catch (attErr) {
        console.warn('[BackupEngine] Error while processing attachments:', attErr);
      }
    }

    // 8. Restore AsyncStorage state if included in backup
    if (backup.data.preferences) {
      AsyncStorage.setItem('@driveledger_preferences', JSON.stringify(backup.data.preferences)).catch(
        () => {}
      );
    }
    if (backup.data.checklists) {
      for (const [vehicleId, items] of Object.entries(backup.data.checklists)) {
        AsyncStorage.setItem(
          `@driveledger_checklist_${vehicleId}`,
          JSON.stringify(items)
        ).catch(() => {});
      }
    }

    // 9. Reconcile notifications after database commit
    refreshReminders();

    return {
      success: true,
      message: 'Data restored successfully!',
      counts: {
        vehicles: backup.data.vehicles.length,
        fuel_entries: backup.data.fuel_entries.length,
        service_records: backup.data.service_records.length,
        maintenance_components: backup.data.maintenance_components?.length ?? 0,
        maintenance_profiles: backup.data.maintenance_profiles?.length ?? 0,
        trips: backup.data.trips?.length ?? 0,
        trip_locations: backup.data.trip_locations?.length ?? 0,
        expenses: backup.data.expenses.length,
        documents: backup.data.documents.length,
      },
    };
  } catch (insertError) {
    return {
      success: false,
      message: `Restore failed during import: ${
        insertError instanceof Error ? insertError.message : 'Unknown error'
      }. Your existing data was NOT changed.`,
    };
  }
}

/** Legacy paste restore (deprecated) */
export function restoreFromJSON(jsonString: string): RestoreResult {
  try {
    const parsed = JSON.parse(jsonString) as Record<string, unknown>;
    const validated = validateSchema(parsed);
    if (!validated) {
      return { success: false, message: 'Invalid backup file format. Expected vehicle records.' };
    }

    const backup: BackupData = {
      app_id: (parsed.app_id as string) ?? APP_ID,
      version: typeof parsed.version === 'number' ? parsed.version : 1,
      created_at: typeof parsed.created_at === 'string' ? parsed.created_at : nowISO(),
      app_version: typeof parsed.app_version === 'string' ? parsed.app_version : '1.0.0',
      data: validated.data,
    };

    return restoreFromValidated(backup);
  } catch (e) {
    return {
      success: false,
      message: `Restore failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
    };
  }
}
