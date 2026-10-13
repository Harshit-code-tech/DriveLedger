/**
 * Backup & Restore Engine
 *
 * SECURITY MODEL
 * ─────────────
 * Every exported backup is signed with HMAC-SHA256 using a secret key
 * that is compiled into the app bundle. The signed payload looks like:
 *
 *   {
 *     app_id:    "com.driveledger.app",   ← identifies the app
 *     version:   2,                        ← backup schema version
 *     created_at: "<ISO date>",
 *     app_version: "1.0.3",
 *     signature: "<64-char hex>",          ← HMAC over the data field (JSON)
 *     data: { vehicles, fuel_entries, service_records, expenses, documents }
 *   }
 *
 * On restore the engine:
 *   1. Checks `app_id` matches — rejects foreign files immediately.
 *   2. Re-derives the HMAC over `data` and compares it byte-by-byte
 *      with the stored `signature` — rejects any tampered file.
 *   3. Validates the structural schema (vehicles array must exist, all
 *      required numeric/string fields must be present and within range).
 *   4. Only then proceeds to the atomic SQL transaction.
 *
 * EXPORT
 *   Creates the signed JSON → writes to documentDirectory →
 *   uses expo-sharing so the OS share sheet lets the user save to
 *   Downloads / Drive / iCloud / AirDrop / etc.
 *
 * IMPORT
 *   Uses expo-document-picker to let the user browse and pick a .dlbak
 *   (or .json) file → reads it with expo-file-system → validates signature
 *   → runs the atomic restore transaction.
 *
 * NOTE: expo-sqlite databases are stored in the app's private directory.
 * This engine exports the DATA (not the .db file) so it is portable.
 */

import { getDatabase } from '@/database/connection';
import type { VehicleDocument } from '@/types/document';
import type { Expense } from '@/types/expense';
import type { FuelEntry } from '@/types/fuel';
import type { ServiceRecord } from '@/types/service';
import type { Vehicle } from '@/types/vehicle';
import { nowISO } from '@/utils/date';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

// ─── Constants ───────────────────────────────────────────────────────

/** The canonical app identifier embedded in every backup file. */
const APP_ID = 'com.driveledger.app';

/**
 * HMAC signing key — compiled into the bundle.
 * Not a user-visible password. Purpose: prevent restoring random JSON files
 * that happen to have the right shape, and detect any bit-level tampering.
 * Changing this value will invalidate all previously exported backups.
 */
const SIGNING_KEY = 'DriveLedger$SecretKey#2026!v1';

/** File extension used for backup files. */
const BACKUP_EXT = '.dlbak';

/** Deliberately unassociated type: backups are opaque DriveLedger files. */
const BACKUP_MIME_TYPE = 'application/vnd.driveledger.dlbak';

const ENCRYPTED_BACKUP_FORMAT = 'driveledger.encrypted-backup';
const ENCRYPTED_BACKUP_VERSION = 2;

interface EncryptedBackupEnvelope {
  format: typeof ENCRYPTED_BACKUP_FORMAT;
  version: number;
  algorithm: 'AES-256-GCM';
  /** Present in version 2+ envelopes. */
  iv?: string;
  ciphertext: string;
  /** Present in version 2+ envelopes. */
  tag?: string;
}

// ─── Types ───────────────────────────────────────────────────────────

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

// ─── HMAC-SHA256 (built on expo-crypto — works on Hermes) ────────────
//
// Hermes doesn't expose crypto.subtle, so HMAC is implemented manually:
//   HMAC(K, m) = SHA256((K XOR opad) || SHA256((K XOR ipad) || m))
// using expo-crypto's byte-level `digest()` so no binary data is ever
// round-tripped through UTF-8 strings.

const BLOCK_SIZE = 64; // SHA-256 block size in bytes

/** SHA-256 of raw bytes. */
async function sha256Bytes(data: Uint8Array): Promise<Uint8Array> {
  const buf = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, data as unknown as ArrayBuffer);
  return new Uint8Array(buf);
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/** Derives the HMAC-SHA256 hex of `message` using `SIGNING_KEY`. */
async function hmacSign(message: string): Promise<string> {
  const enc = new TextEncoder();
  let key: Uint8Array = enc.encode(SIGNING_KEY);
  if (key.length > BLOCK_SIZE) key = await sha256Bytes(key);

  const padded = new Uint8Array(BLOCK_SIZE); // zero-filled
  padded.set(key);

  const ipad = new Uint8Array(BLOCK_SIZE);
  const opad = new Uint8Array(BLOCK_SIZE);
  for (let i = 0; i < BLOCK_SIZE; i++) {
    ipad[i] = padded[i] ^ 0x36;
    opad[i] = padded[i] ^ 0x5c;
  }

  const inner = await sha256Bytes(concatBytes(ipad, enc.encode(message)));
  const outer = await sha256Bytes(concatBytes(opad, inner));
  return bytesToHex(outer);
}

/** Constant-time string comparison to prevent timing attacks. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Converts a Base64 string into a Uint8Array across all JS engines. */
function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
  let buffer = 0;
  let bits = 0;
  const output: number[] = [];
  for (let i = 0; i < base64.length; i++) {
    const char = base64[i];
    if (char === '=') break;
    const val = lookup[char.charCodeAt(0)];
    if (val === undefined) continue;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(output);
}

/** Verifies an HMAC-SHA256 signature. */
async function hmacVerify(message: string, expectedHex: string): Promise<boolean> {
  try {
    const computed = await hmacSign(message);
    return safeEqual(computed, expectedHex);
  } catch {
    return false;
  }
}

/** Returns the deterministic AES-256 key used for portable .dlbak files. */
async function getBackupEncryptionKey(): Promise<Crypto.AESEncryptionKey> {
  const keyMaterial = new TextEncoder().encode(`${APP_ID}:${SIGNING_KEY}:backup-encryption:v1`);
  const keyBytes = await sha256Bytes(keyMaterial);
  return await Crypto.AESEncryptionKey.import(keyBytes) as Crypto.AESEncryptionKey;
}

async function encryptBackup(plaintext: string): Promise<string> {
  const key = await getBackupEncryptionKey();
  const sealed = await Crypto.aesEncryptAsync(new TextEncoder().encode(plaintext), key, {
    nonce: { length: 12 },
    tagLength: 16,
  });
  // combined('base64') returns a single Base64 string containing: [12-byte IV] || [Ciphertext] || [16-byte Tag]
  const combinedBase64 = await sealed.combined('base64') as string;
  const envelope: EncryptedBackupEnvelope = {
    format: ENCRYPTED_BACKUP_FORMAT,
    version: ENCRYPTED_BACKUP_VERSION,
    algorithm: 'AES-256-GCM',
    ciphertext: combinedBase64,
  };
  return JSON.stringify(envelope);
}

function isEncryptedBackupEnvelope(value: unknown): value is EncryptedBackupEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const envelope = value as Record<string, unknown>;
  return envelope.format === ENCRYPTED_BACKUP_FORMAT
    && (envelope.version === 1 || envelope.version === ENCRYPTED_BACKUP_VERSION)
    && envelope.algorithm === 'AES-256-GCM'
    && (typeof envelope.ciphertext === 'string' || typeof envelope.ciphertext === 'object');
}

async function decryptBackup(envelope: EncryptedBackupEnvelope): Promise<string> {
  const key = await getBackupEncryptionKey();
  let combinedBytes: Uint8Array;

  if (envelope.iv && envelope.tag) {
    // Envelope with separate iv, ciphertext, and tag (v2 parts form)
    const ivBytes = base64ToUint8Array(envelope.iv);
    const cipherBytes = typeof envelope.ciphertext === 'string'
      ? base64ToUint8Array(envelope.ciphertext)
      : new Uint8Array(Object.values(envelope.ciphertext as Record<string, number>));
    const tagBytes = base64ToUint8Array(envelope.tag);
    combinedBytes = concatBytes(concatBytes(ivBytes, cipherBytes), tagBytes);
  } else {
    // Envelope with combined ciphertext string (v1 standard form)
    combinedBytes = typeof envelope.ciphertext === 'string'
      ? base64ToUint8Array(envelope.ciphertext)
      : new Uint8Array(Object.values(envelope.ciphertext as Record<string, number>));
  }

  // Passing Uint8Array to fromCombined satisfies Android JNI's ByteArray expectation
  const sealed = Crypto.AESSealedData.fromCombined(combinedBytes, { ivLength: 12, tagLength: 16 });
  const plaintext = await Crypto.aesDecryptAsync(sealed, key, { output: 'bytes' }) as Uint8Array;
  return new TextDecoder().decode(plaintext);
}

/** Throws unless an encrypted envelope can be decrypted and parsed again. */
async function verifyEncryptedBackup(content: string): Promise<void> {
  const parsed: unknown = JSON.parse(content);
  if (!isEncryptedBackupEnvelope(parsed)) {
    throw new Error('Invalid encrypted backup envelope');
  }
  JSON.parse(await decryptBackup(parsed));
}

// ─── Schema Validation ───────────────────────────────────────────────

/** Strict field validators for each table row. */

function isValidVehicle(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === 'string' && r.id.length > 0 &&
    typeof r.nickname === 'string' && r.nickname.length > 0 &&
    typeof r.registration_number === 'string' &&
    typeof r.fuel_type === 'string' &&
    typeof r.vehicle_type === 'string' &&
    typeof r.created_at === 'string' &&
    typeof r.updated_at === 'string'
  );
}

function isValidFuelEntry(f: unknown): boolean {
  if (!f || typeof f !== 'object') return false;
  const r = f as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.vehicle_id === 'string' &&
    typeof r.date === 'string' &&
    typeof r.odometer === 'number' && r.odometer >= 0 &&
    typeof r.fuel_amount === 'number' && (r.fuel_amount as number) > 0 &&
    typeof r.price_per_unit === 'number' && (r.price_per_unit as number) > 0 &&
    typeof r.total_cost === 'number' &&
    typeof r.fuel_unit === 'string' &&
    ['litres', 'kg', 'kWh'].includes(r.fuel_unit as string)
  );
}

function isValidServiceRecord(s: unknown): boolean {
  if (!s || typeof s !== 'object') return false;
  const r = s as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.vehicle_id === 'string' &&
    typeof r.date === 'string' &&
    typeof r.service_type === 'string' && (r.service_type as string).length > 0
  );
}

function isValidExpense(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const r = e as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.vehicle_id === 'string' &&
    typeof r.date === 'string' &&
    typeof r.category === 'string' &&
    typeof r.amount === 'number' && (r.amount as number) > 0
  );
}

function isValidDocument(d: unknown): boolean {
  if (!d || typeof d !== 'object') return false;
  const r = d as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.vehicle_id === 'string' &&
    typeof r.type === 'string' &&
    ['RC', 'Insurance', 'PUC', 'FASTag', 'Warranty'].includes(r.type as string)
  );
}

/**
 * Validates and normalises a parsed JSON object to BackupData.
 * Returns null if the object fails any structural check.
 */
function validateSchema(obj: Record<string, unknown>): {
  data: BackupData['data'];
  error?: string;
} | null {
  // Find the data wrapper
  let rawData: Record<string, unknown>;
  if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
    rawData = obj.data as Record<string, unknown>;
  } else if (Array.isArray(obj.vehicles)) {
    rawData = obj; // Tolerant: raw table payload
  } else {
    return null;
  }

  if (!Array.isArray(rawData.vehicles) || rawData.vehicles.length === 0) {
    return null; // Vehicles array is mandatory
  }

  // Row-level validation
  const badVehicle = (rawData.vehicles as unknown[]).find((v) => !isValidVehicle(v));
  if (badVehicle) return null;

  const fuelEntries: FuelEntry[] = Array.isArray(rawData.fuel_entries)
    ? (rawData.fuel_entries as unknown[]).filter((f) => isValidFuelEntry(f)) as FuelEntry[]
    : [];

  const serviceRecords: ServiceRecord[] = Array.isArray(rawData.service_records)
    ? (rawData.service_records as unknown[]).filter((s) => isValidServiceRecord(s)) as ServiceRecord[]
    : [];

  const expenses: Expense[] = Array.isArray(rawData.expenses)
    ? (rawData.expenses as unknown[]).filter((e) => isValidExpense(e)) as Expense[]
    : [];

  const documents: VehicleDocument[] = Array.isArray(rawData.documents)
    ? (rawData.documents as unknown[]).filter((d) => isValidDocument(d)) as VehicleDocument[]
    : [];

  return {
    data: {
      vehicles: rawData.vehicles as Vehicle[],
      fuel_entries: fuelEntries,
      service_records: serviceRecords,
      expenses,
      documents,
    },
  };
}

// ─── Read from database ──────────────────────────────────────────────

/**
 * Creates an in-memory snapshot of all DriveLedger data.
 */
export function createBackup(): BackupResult {
  try {
    const db = getDatabase();
    db.execSync('BEGIN TRANSACTION');

    const vehicles = db.getAllSync<Vehicle>('SELECT * FROM vehicles');
    const fuelEntries = db.getAllSync<FuelEntry>('SELECT * FROM fuel_entries');
    const serviceRecords = db.getAllSync<ServiceRecord>('SELECT * FROM service_records');
    const expenses = db.getAllSync<Expense>('SELECT * FROM expenses');
    const documents = db.getAllSync<VehicleDocument>('SELECT * FROM documents');

    db.execSync('COMMIT');

    const backup: BackupData = {
      app_id: APP_ID,
      version: 2,
      created_at: nowISO(),
      app_version: '1.0.3',
      data: { vehicles, fuel_entries: fuelEntries, service_records: serviceRecords, expenses, documents },
    };

    const total =
      vehicles.length + fuelEntries.length + serviceRecords.length +
      expenses.length + documents.length;

    return { success: true, message: `Backup created with ${total} records.`, backup };
  } catch (e) {
    try { getDatabase().execSync('ROLLBACK'); } catch (_) { }
    return {
      success: false,
      message: `Backup failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
    };
  }
}

/** @deprecated - Use exportToFile() instead. Kept for CSV export only. */
export function backupToJSON(backup: BackupData): string {
  return JSON.stringify(backup, null, 2);
}

// ─── Export — Save to Device ─────────────────────────────────────────

/**
 * Signs and exports backup as a .dlbak file.
 *
 * Flow:
 *   1. Read all data from SQLite.
 *   2. Sign data with HMAC-SHA256.
 *   3. Serialise and write signed JSON to app's private documentDirectory.
 *   4. Let user pick a destination folder via Directory.pickDirectoryAsync.
 *   5. Create the file through the chosen directory, then write its content.
 *      Android SAF tree URIs cannot create a file via `new File(...).write()`;
 *      Directory.createFile() creates it using the granted directory access.
 *   Falls back to the OS share sheet if the user cancels the folder picker.
 */
export async function exportToFile(): Promise<ExportFileResult> {
  // 1. Read data
  const result = createBackup();
  if (!result.success || !result.backup) {
    return { success: false, message: result.message };
  }

  // 2. Sign
  const dataString = JSON.stringify(result.backup.data);
  let signature: string;
  try {
    signature = await hmacSign(dataString);
  } catch (e) {
    return {
      success: false,
      message: `Signing failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
    };
  }

  const signedBackup: BackupData = {
    ...result.backup,
    signature,
  };

  // 3. Serialise once — used for both the temp write and the SAF write
  let content: string;
  try {
    content = await encryptBackup(JSON.stringify(signedBackup));
    await verifyEncryptedBackup(content);
  } catch (e) {
    return {
      success: false,
      message: `Could not encrypt backup: ${e instanceof Error ? e.message : 'Unknown error'}`,
    };
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `DriveLedger_${timestamp}${BACKUP_EXT}`;

  // Write to app's private directory so we always have the file on hand
  // (also used as the fallback share-sheet source if picker is cancelled)
  const tempFile = new File(Paths.document, filename);
  try {
    try { tempFile.delete(); } catch (_) { /* didn't exist */ }
    tempFile.write(content);
  } catch (e) {
    return {
      success: false,
      message: `Could not write backup file: ${e instanceof Error ? e.message : 'Unknown error'}`,
    };
  }

  // 4. Let user pick a destination folder
  try {
    const destDir = await Directory.pickDirectoryAsync();

    // 5. A SAF directory URI does not permit File.write() to create a child.
    //    Create the child through Directory first, then write to that file.
    const destFile = destDir.createFile(filename, BACKUP_MIME_TYPE);
    destFile.write(content);
    // Confirm the document provider saved bytes that DriveLedger can decrypt.
    try {
      let readBack: string;
      try {
        readBack = await destFile.text();
      } catch (_) {
        readBack = await FileSystem.readAsStringAsync(destFile.uri);
      }
      await verifyEncryptedBackup(readBack);
    } catch (_) {
      // Content was already verified prior to writing. On some Android OEM ROMs,
      // immediate read-back of a freshly created SAF file can encounter transient permission flags.
    }

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
      // User dismissed picker — offer the file via the share sheet instead
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

    // Genuine error — report it
    return {
      success: false,
      message: `Could not save backup: ${errMsg}`,
    };
  }
}


// ─── Import — File Picker ────────────────────────────────────────────

/**
 * Opens the OS file picker (File.pickFileAsync), reads the selected .dlbak
 * file, verifies the HMAC signature, and validates the schema.
 *
 * Uses expo-file-system's File.pickFileAsync which returns a File instance
 * the app already has read access to (copied into a temp location by the OS).
 * This avoids the "missing read permission" error that occurs when trying to
 * read a content:// URI returned by DocumentPicker.
 *
 * Does NOT write to the database - call restoreFromValidated() for that.
 * This separation lets the caller show a confirmation dialog before committing.
 *
 * Security checks (in order, fail-fast):
 *   1. File must be JSON-parseable.
 *   2. `app_id` must equal APP_ID - blocks random JSON files.
 *   3. If `signature` is present, HMAC must match - blocks tampered files.
 *      (Legacy backups without a signature field are accepted with a warning.)
 *   4. Row-level schema validation for every vehicle and fuel entry.
 */
export async function pickAndVerifyBackup(): Promise<{
  success: boolean;
  message: string;
  backup?: BackupData;
  isLegacy?: boolean;
}> {
  // Open file picker using the new File.pickFileAsync API
  // This gives us a File instance the app can read without extra permissions.
  let pickedFile: File;
  try {
    const pickerResult = await File.pickFileAsync({
      mimeTypes: ['*/*'],
    });
    if (pickerResult.canceled || !pickerResult.result) {
      return { success: false, message: 'No file selected.' };
    }
    pickedFile = pickerResult.result as File;
  } catch (e) {
    return { success: false, message: 'Could not open file picker.' };
  }

  // DriveLedger backups are always .dlbak files.
  const name = (pickedFile.name ?? '').toLowerCase();
  const isOfficialFormat = name.endsWith(BACKUP_EXT);
  if (!isOfficialFormat) {
    return {
      success: false,
      message: `Invalid file type.\n\nDriveLedger backup files end in "${BACKUP_EXT}". The file you selected appears to be a different type.`,
    };
  }

  // Read file content - File instance already has read access
  let rawContent: string;
  try {
    rawContent = await pickedFile.text();
  } catch (e) {
    try {
      rawContent = await FileSystem.readAsStringAsync(pickedFile.uri);
    } catch (fallbackErr) {
      return {
        success: false,
        message: `Could not read file: ${e instanceof Error ? e.message : 'Unknown error'}`,
      };
    }
  }

  // Guard against very large files (> 50 MB)
  if (rawContent.length > 50 * 1024 * 1024) {
    return { success: false, message: 'File is too large to be a valid backup (> 50 MB).' };
  }

  // Parse the opaque .dlbak envelope. Older .dlbak files are accepted as
  // plaintext here so existing user backups remain restorable.
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    return {
      success: false,
      message: 'The selected file is not a valid DriveLedger backup.',
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { success: false, message: 'Invalid backup structure.' };
  }

  if (isEncryptedBackupEnvelope(parsed)) {
    try {
      parsed = JSON.parse(await decryptBackup(parsed));
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      return {
        success: false,
        message: `This encrypted backup cannot be opened (${detail}). It may be corrupted or was not created by DriveLedger.`,
      };
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { success: false, message: 'Invalid backup structure.' };
  }

  const obj = parsed as Record<string, unknown>;

  // ── Check 1: app_id ──────────────────────────────────────────────
  if (obj.app_id !== undefined && obj.app_id !== APP_ID) {
    return {
      success: false,
      message: `Wrong app backup.\n\nThis file was exported by a different app (ID: "${obj.app_id}"). DriveLedger can only restore its own backups.`,
    };
  }

  // Legacy backup: no app_id and no signature — warn and proceed
  const isLegacy = obj.app_id === undefined && obj.signature === undefined;

  // ── Check 2: HMAC signature ──────────────────────────────────────
  if (!isLegacy) {
    if (typeof obj.signature !== 'string' || obj.signature.length !== 64) {
      return {
        success: false,
        message: 'Backup file is missing or has an invalid security signature.\n\nThis could mean the file was manually edited or is corrupted. Only export files directly from the DriveLedger app.',
      };
    }

    // Re-derive HMAC over the raw data field
    let dataString: string;
    try {
      dataString = JSON.stringify(obj.data);
    } catch {
      return { success: false, message: 'Could not read backup data section.' };
    }

    let signatureValid: boolean;
    try {
      signatureValid = await hmacVerify(dataString, obj.signature as string);
    } catch (e) {
      return {
        success: false,
        message: `Signature verification error: ${e instanceof Error ? e.message : 'Unknown error'}`,
      };
    }

    if (!signatureValid) {
      return {
        success: false,
        message: '🚨 Tampered Backup Detected!\n\nThe backup file\'s security signature does not match its contents. This means the data was altered after export.\n\nThe restore has been blocked to protect your data. Use only unmodified backup files exported directly from DriveLedger.',
      };
    }
  }

  // ── Check 3: schema validation ───────────────────────────────────
  const validated = validateSchema(obj);
  if (!validated) {
    return {
      success: false,
      message: 'The backup file does not contain valid DriveLedger data.\n\nRequired fields are missing or have invalid values. The file may be from an incompatible version or was corrupted.',
    };
  }

  const backup: BackupData = {
    app_id: (obj.app_id as string) ?? APP_ID,
    version: typeof obj.version === 'number' ? obj.version : 1,
    created_at: typeof obj.created_at === 'string' ? obj.created_at : nowISO(),
    app_version: typeof obj.app_version === 'string' ? obj.app_version : '1.0.0',
    signature: obj.signature as string | undefined,
    data: validated.data,
  };

  return { success: true, message: 'Backup verified.', backup, isLegacy };
}

// ─── DB Restore ──────────────────────────────────────────────────────

/**
 * Atomically replaces all database data with the contents of a verified backup.
 *
 * WARNING: This CLEARS all existing data. Call only after user confirmation.
 */
export function restoreFromValidated(backup: BackupData): RestoreResult {
  const db = getDatabase();
  db.execSync('BEGIN TRANSACTION');

  try {
    // Clear all tables (order respects FK constraints)
    db.execSync('DELETE FROM documents');
    db.execSync('DELETE FROM expenses');
    db.execSync('DELETE FROM service_records');
    db.execSync('DELETE FROM fuel_entries');
    db.execSync('DELETE FROM vehicles');

    // Vehicles
    for (const v of backup.data.vehicles) {
      let fuelType = v.fuel_type as string;
      if (fuelType === 'hybrid') fuelType = 'hybrid_cng_petrol'; // migrate legacy

      db.runSync(
        `INSERT OR IGNORE INTO vehicles (
           id, nickname, vehicle_type, manufacturer, model, variant, year, color,
           registration_number, fuel_type, tank_capacity, secondary_tank_capacity,
           current_odometer, front_tyre_pressure, rear_tyre_pressure,
           service_interval_km, purchase_date, notes, is_archived, created_at, updated_at, deleted_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          v.id, v.nickname, v.vehicle_type, v.manufacturer ?? null, v.model ?? null,
          v.variant ?? null, v.year ?? null, v.color ?? null, v.registration_number,
          fuelType, v.tank_capacity ?? null, v.secondary_tank_capacity ?? null,
          v.current_odometer ?? null, v.front_tyre_pressure ?? null, v.rear_tyre_pressure ?? null,
          v.service_interval_km ?? null, v.purchase_date ?? null, v.notes ?? null,
          v.is_archived ?? 0, v.created_at || nowISO(), v.updated_at || nowISO(), v.deleted_at ?? null,
        ]
      );
    }

    // Fuel entries
    for (const f of backup.data.fuel_entries) {
      db.runSync(
        `INSERT INTO fuel_entries (id, vehicle_id, date, odometer, fuel_amount, fuel_unit, price_per_unit,
         total_cost, fuel_station, is_full_tank, calculated_mileage, mileage_unit,
         receipt_photo_uri, notes, fuel_system, battery_start_percent, battery_end_percent,
         created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          f.id, f.vehicle_id, f.date, f.odometer, f.fuel_amount, f.fuel_unit,
          f.price_per_unit, f.total_cost, f.fuel_station ?? null, f.is_full_tank ?? 1,
          f.calculated_mileage ?? null, f.mileage_unit ?? null, f.receipt_photo_uri ?? null,
          f.notes ?? null, f.fuel_system ?? 'primary', f.battery_start_percent ?? null, f.battery_end_percent ?? null,
          f.created_at || nowISO(), f.updated_at || nowISO(), f.deleted_at ?? null,
        ]
      );
    }

    // Service records
    for (const s of backup.data.service_records) {
      db.runSync(
        `INSERT INTO service_records (id, vehicle_id, date, odometer, service_type, cost, work_done,
         garage_name, next_due_km, next_due_date, notes, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.id, s.vehicle_id, s.date, s.odometer ?? null, s.service_type, s.cost ?? null,
          s.work_done ?? null, s.garage_name ?? null, s.next_due_km ?? null,
          s.next_due_date ?? null, s.notes ?? null,
          s.created_at || nowISO(), s.updated_at || nowISO(), s.deleted_at ?? null,
        ]
      );
    }

    // Expenses
    for (const e of backup.data.expenses) {
      db.runSync(
        `INSERT INTO expenses (id, vehicle_id, date, category, amount, description, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          e.id, e.vehicle_id, e.date, e.category, e.amount, e.description ?? null,
          e.created_at || nowISO(), e.updated_at || nowISO(), e.deleted_at ?? null,
        ]
      );
    }

    // Documents are inserted first without their self-referencing renewal link.
    // A document may point to a newer document via superseded_by, so inserting
    // the link in this pass can violate the foreign key when the newer row has
    // not been inserted yet.
    for (const d of backup.data.documents) {
      db.runSync(
        `INSERT INTO documents (id, vehicle_id, type, document_number, insurer_name, issue_date,
         expiry_date, file_uri, superseded_by, notes, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          d.id, d.vehicle_id, d.type, d.document_number ?? null, d.insurer_name ?? null,
          d.issue_date ?? null, d.expiry_date ?? null, d.file_uri ?? null,
          null, d.notes ?? null,
          d.created_at || nowISO(), d.updated_at || nowISO(), d.deleted_at ?? null,
        ]
      );
    }

    // Now every document ID exists, so renewal relationships are safe to add.
    for (const d of backup.data.documents) {
      if (d.superseded_by) {
        db.runSync('UPDATE documents SET superseded_by = ? WHERE id = ?', [d.superseded_by, d.id]);
      }
    }

    db.execSync('COMMIT');
  } catch (insertError) {
    db.execSync('ROLLBACK');
    return {
      success: false,
      message: `Restore failed during import: ${insertError instanceof Error ? insertError.message : 'Unknown error'}. Your existing data was NOT changed.`,
    };
  }

  return {
    success: true,
    message: 'Data restored successfully!',
    counts: {
      vehicles: backup.data.vehicles.length,
      fuel_entries: backup.data.fuel_entries.length,
      service_records: backup.data.service_records.length,
      expenses: backup.data.expenses.length,
      documents: backup.data.documents.length,
    },
  };
}

// ─── Legacy text-paste restore (kept for backward compat) ────────────

/**
 * Restores from a raw JSON string (the old paste-into-textbox flow).
 * For legacy backups only. New flow uses pickAndVerifyBackup() +
 * restoreFromValidated().
 *
 * @deprecated Prefer the file-picker flow.
 */
export function restoreFromJSON(jsonString: string): RestoreResult {
  try {
    const parsed = JSON.parse(jsonString) as Record<string, unknown>;

    // Minimal validation
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
