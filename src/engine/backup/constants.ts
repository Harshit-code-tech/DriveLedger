/**
 * Backup File Constants
 *
 * File-level identifiers for DriveLedger backup files.
 * Extracted from backupEngine.ts so both export and import modules can share them.
 */

/** File extension used for backup files. */
export const BACKUP_EXT = '.dlbak';

/** Deliberately unassociated type: backups are opaque DriveLedger files. */
export const BACKUP_MIME_TYPE = 'application/vnd.driveledger.dlbak';
