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
 *
 * MODULE LAYOUT
 * ─────────────
 * This file is a public barrel. Implementation lives in ./backup/:
 *   types.ts         — envelope/data/result types + format constants
 *   schema.ts        — row-level validation (validateSchema, isValid*)
 *   crypto.ts        — PBKDF2 + AES-256-GCM (encryptBackupV3, decryptBackupV3)
 *   constants.ts     — BACKUP_EXT, BACKUP_MIME_TYPE
 *   snapshot.ts      — createBackup, getAsyncStorageBackupState, backupToJSON
 *   exportBackup.ts  — exportBackupString, exportToFile, exportCsvFile
 *   importBackup.ts  — verifyBackupContent, pickAndVerifyBackup
 *   restore.ts       — restoreFromValidated, restoreFromJSON
 *
 * Callers should keep importing from '@/engine/backupEngine'.
 */

export * from './backup/types';
export * from './backup/schema';
export * from './backup/crypto';
export * from './backup/constants';
export * from './backup/snapshot';
export * from './backup/exportBackup';
export * from './backup/importBackup';
export * from './backup/restore';
