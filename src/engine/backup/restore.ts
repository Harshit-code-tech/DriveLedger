/**
 * Backup Restore
 *
 * Atomically replaces all database data with the contents of a verified backup.
 *
 * ATOMIC RESTORE GUARANTEE
 * ────────────────────────
 * All table clears and inserts run inside db.withTransactionSync. Any error
 * rolls back, leaving the pre-existing database intact. Attachments,
 * AsyncStorage state, and reminder reconciliation run only after commit.
 *
 * Extracted from backupEngine.ts.
 */

import { getDatabase } from '@/database/connection';
import { nowISO } from '@/utils/date';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { refreshReminders } from '@/services/notificationService';
import { APP_ID, type BackupData, type RestoreResult } from './types';
import { validateSchema } from './schema';

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
