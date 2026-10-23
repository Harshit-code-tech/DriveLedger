/**
 * Backup Engine — Shared Types
 *
 * All exported interfaces and result types used across the backup
 * sub-modules and by external callers (settings screen, CSV export, etc.).
 *
 * Import from here rather than from the top-level backupEngine.ts so that
 * type-only imports don't drag in crypto/file-system side-effect code.
 */

import type { VehicleDocument } from '@/types/document';
import type { Expense } from '@/types/expense';
import type { FuelEntry } from '@/types/fuel';
import type { ServiceRecord } from '@/types/service';
import type { Vehicle } from '@/types/vehicle';
import type { Preferences } from '@/stores/preferencesStore';

export const ENCRYPTED_BACKUP_FORMAT = 'driveledger.encrypted-backup';
export const CURRENT_BACKUP_VERSION = 3;
export const APP_ID = 'com.driveledger.app';

// ─── Envelopes ───────────────────────────────────────────────────────

/** Modern v3 envelope using PBKDF2-HMAC-SHA256 password derivation + AES-256-GCM */
export interface PasswordEncryptedBackupEnvelope {
  format: typeof ENCRYPTED_BACKUP_FORMAT;
  version: 3;
  kdf: {
    algorithm: 'PBKDF2-HMAC-SHA256';
    iterations: number;
    salt: string; // Base64 (16 bytes)
    keyLength: number; // 32
  };
  encryption: {
    algorithm: 'AES-256-GCM';
    iv: string; // Base64 (12 bytes)
    tagLength: number; // 16
  };
  ciphertext: string; // Base64
  tag: string; // Base64 (16 bytes)
  metadata: {
    app_id: string;
    app_version: string;
    created_at: string;
  };
}

export type BackupEnvelope = PasswordEncryptedBackupEnvelope;
export type AnyEncryptedBackupEnvelope = PasswordEncryptedBackupEnvelope;

// ─── Core Data Shape ─────────────────────────────────────────────────

import type { MaintenanceComponent, MaintenanceProfile } from '@/types/service';
import type { Trip, TripLocation } from '@/types/trip';

export interface BackupAttachment {
  filename: string;
  mime_type?: string;
  base64: string;
}

export interface BackupData {
  app_id: string;
  version: number;
  created_at: string;
  app_version: string;
  data: {
    vehicles: Vehicle[];
    fuel_entries: FuelEntry[];
    service_records: ServiceRecord[];
    expenses: Expense[];
    documents: VehicleDocument[];
    maintenance_components?: MaintenanceComponent[];
    maintenance_profiles?: MaintenanceProfile[];
    trips?: Trip[];
    trip_locations?: TripLocation[];
    attachments?: BackupAttachment[];
    preferences?: Preferences;
    checklists?: Record<string, string[]>;
  };
}

// ─── Operation Results ───────────────────────────────────────────────

export interface BackupResult {
  success: boolean;
  message: string;
  backup?: BackupData;
}

export interface RestoreResult {
  success: boolean;
  message: string;
  counts?: {
    vehicles: number;
    fuel_entries: number;
    service_records: number;
    maintenance_components?: number;
    maintenance_profiles?: number;
    trips?: number;
    trip_locations?: number;
    expenses: number;
    documents: number;
    attachments?: number;
  };
}

export interface ExportFileResult {
  success: boolean;
  message: string;
  /** Full path of the written .dlbak file (temp, before sharing). */
  filePath?: string;
}

export interface ImportFileResult {
  success: boolean;
  message: string;
  /** The validated & parsed backup, before the DB transaction. */
  backup?: BackupData;
  /** Human-readable record count summary. */
  counts?: RestoreResult['counts'];
}

export interface VerifyBackupResult {
  success: boolean;
  message: string;
  backup?: BackupData;
  requiresPassword?: boolean;
}
