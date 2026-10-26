/**
 * Backup Import & Verification
 *
 * Parses, decrypts, and schema-validates a .dlbak file before anything touches
 * the database. Nothing in this module writes to SQLite.
 *
 * Extracted from backupEngine.ts.
 */

import { nowISO } from '@/utils/date';
import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import {
  APP_ID,
  CURRENT_BACKUP_VERSION,
  ENCRYPTED_BACKUP_FORMAT,
  type BackupData,
  type VerifyBackupResult,
  type PasswordEncryptedBackupEnvelope,
} from './types';
import { validateSchema } from './schema';
import { decryptBackupV3, validateEnvelopeV3 } from './crypto';
import { BACKUP_EXT } from './constants';

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
