/**
 * Backup Export
 *
 * Builds an encrypted .dlbak payload from the current snapshot and writes it
 * to a user-chosen folder (SAF) or the native share sheet. Also handles the
 * plain CSV ledger export.
 *
 * Extracted from backupEngine.ts.
 */

import { nowISO } from '@/utils/date';
import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { buildLedgerCsv } from '@/utils/csvExport';
import { APP_ID, type BackupAttachment, type ExportFileResult } from './types';
import { encryptBackupV3 } from './crypto';
import { BACKUP_EXT, BACKUP_MIME_TYPE } from './constants';
import { createBackup, getAsyncStorageBackupState } from './snapshot';

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
    await tempFile.write(content);
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
    await destFile.write(content);

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
    await tempFile.write(csvContent);
  } catch (e) {
    return {
      success: false,
      message: `Could not write CSV file: ${e instanceof Error ? e.message : 'Unknown error'}`,
    };
  }

  try {
    const destDir = await Directory.pickDirectoryAsync();
    const destFile = destDir.createFile(filename, mimeType);
    await destFile.write(csvContent);

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
