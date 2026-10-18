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

// ─── Core Data Shape ─────────────────────────────────────────────────

export interface BackupData {
  app_id: string;
  version: number;
  created_at: string;
  app_version: string;
  /** HMAC-SHA256 hex of JSON.stringify(data). Absent on raw legacy backups. */
  signature?: string;
  data: {
    vehicles: Vehicle[];
    fuel_entries: FuelEntry[];
    service_records: ServiceRecord[];
    expenses: Expense[];
    documents: VehicleDocument[];
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
    expenses: number;
    documents: number;
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
