/**
 * Document Repository
 *
 * CRUD operations for the `documents` table.
 *
 * KEY BEHAVIORS:
 * - `superseded_by` enables renewal chains: when a user renews
 *   their Insurance or PUC, the old document's superseded_by field
 *   points to the new document's ID, preserving the full history.
 * - `file_uri` stores the local path to a photo/scan of the document.
 *   This fulfils User Story 4 — carry a digital copy, not physical.
 */

import { getDatabase } from '../connection';
import { buildSafeUpdate } from '../safeUpdate';
import { generateUUID } from '@/utils/uuid';
import { nowISO } from '@/utils/date';
import type {
  VehicleDocument,
  CreateDocumentInput,
  UpdateDocumentInput,
} from '@/types/document';

// ─── CREATE ──────────────────────────────────────────────────────────

/**
 * Creates a new document record.
 *
 * @param input - Required + optional document fields
 * @returns The complete VehicleDocument record
 */
export function createDocument(input: CreateDocumentInput): VehicleDocument {
  const db = getDatabase();
  const now = nowISO();
  const id = generateUUID();

  const doc: VehicleDocument = {
    id,
    vehicle_id: input.vehicle_id,
    type: input.type,
    document_number: input.document_number ?? null,
    insurer_name: input.insurer_name ?? null,
    issue_date: input.issue_date ?? null,
    expiry_date: input.expiry_date ?? null,
    file_uri: input.file_uri ?? null,
    superseded_by: input.superseded_by ?? null,
    notes: input.notes ?? null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  db.runSync(
    `INSERT INTO documents (
      id, vehicle_id, type, document_number, insurer_name, issue_date,
      expiry_date, file_uri, superseded_by, notes, created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      doc.id, doc.vehicle_id, doc.type, doc.document_number,
      doc.insurer_name, doc.issue_date, doc.expiry_date,
      doc.file_uri, doc.superseded_by, doc.notes,
      doc.created_at, doc.updated_at, doc.deleted_at,
    ]
  );

  return doc;
}

// ─── READ ────────────────────────────────────────────────────────────

/**
 * Returns all non-deleted, current (not superseded) documents for a vehicle.
 * A document is "current" when no other document's superseded_by points to it
 * — practically, when superseded_by IS NULL on this document.
 */
export function getCurrentDocumentsByVehicle(vehicleId: string): VehicleDocument[] {
  const db = getDatabase();
  return db.getAllSync<VehicleDocument>(
    `SELECT * FROM documents
     WHERE vehicle_id = ? AND deleted_at IS NULL AND superseded_by IS NULL
     ORDER BY type ASC, created_at DESC`,
    [vehicleId]
  );
}

/**
 * Returns ALL non-deleted documents for a vehicle (including superseded ones).
 * Used for viewing the full renewal history chain.
 */
export function getAllDocumentsByVehicle(vehicleId: string): VehicleDocument[] {
  const db = getDatabase();
  return db.getAllSync<VehicleDocument>(
    `SELECT * FROM documents
     WHERE vehicle_id = ? AND deleted_at IS NULL
     ORDER BY type ASC, created_at DESC`,
    [vehicleId]
  );
}

/**
 * Returns a single document by ID.
 */
export function getDocumentById(id: string): VehicleDocument | null {
  const db = getDatabase();
  return db.getFirstSync<VehicleDocument>(
    'SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
}

/**
 * Returns documents that are expiring within the given number of days.
 * Used for expiry warnings on the dashboard and documents screen.
 *
 * @param vehicleId - The vehicle UUID
 * @param withinDays - Number of days from now to check
 * @returns Documents expiring within the specified window
 */
export function getExpiringDocuments(
  vehicleId: string,
  withinDays: number
): VehicleDocument[] {
  const db = getDatabase();
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + withinDays);

  return db.getAllSync<VehicleDocument>(
    `SELECT * FROM documents
     WHERE vehicle_id = ? AND deleted_at IS NULL
     AND superseded_by IS NULL
     AND expiry_date IS NOT NULL
     AND expiry_date <= ?
     ORDER BY expiry_date ASC`,
    [vehicleId, futureDate.toISOString().split('T')[0]]
  );
}

// ─── UPDATE ──────────────────────────────────────────────────────────

export function updateDocument(
  id: string,
  input: UpdateDocumentInput
): VehicleDocument | null {
  const db = getDatabase();
  const now = nowISO();

  // Whitelist: only these columns can be updated
  const ALLOWED_COLUMNS = new Set([
    'type', 'document_number', 'insurer_name', 'issue_date',
    'expiry_date', 'file_uri', 'superseded_by', 'notes',
  ]);

  const { fields, values } = buildSafeUpdate(input as Record<string, unknown>, ALLOWED_COLUMNS);

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  if (fields.length === 1) return getDocumentById(id);

  db.runSync(
    `UPDATE documents SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  return getDocumentById(id);
}

// ─── RENEWAL CHAIN ──────────────────────────────────────────────────

/**
 * Creates a renewal document and links it to the old document.
 *
 * This is the key differentiator from competitors:
 * old Insurance → superseded_by → new Insurance
 *
 * @param oldDocumentId - The UUID of the document being renewed
 * @param newInput - The new document's data
 * @returns The newly created VehicleDocument
 */
export function renewDocument(
  oldDocumentId: string,
  newInput: CreateDocumentInput
): VehicleDocument {
  const db = getDatabase();
  let newDoc: VehicleDocument | null = null;

  db.withTransactionSync(() => {
    // 1. Verify that the document being renewed exists and is not deleted
    const oldDoc = getDocumentById(oldDocumentId);
    if (!oldDoc) {
      throw new Error(`Cannot renew document: document "${oldDocumentId}" does not exist or has been deleted.`);
    }

    // 2. Create the new document
    newDoc = createDocument(newInput);

    // 3. Link the old document to the new one
    const now = nowISO();
    const result = db.runSync(
      'UPDATE documents SET superseded_by = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
      [newDoc.id, now, oldDocumentId]
    );

    if (result.changes === 0) {
      throw new Error(`Failed to update superseded_by link on document "${oldDocumentId}".`);
    }
  });

  return newDoc!;
}

// ─── DELETE (SOFT) ───────────────────────────────────────────────────

export function softDeleteDocument(id: string): void {
  const db = getDatabase();
  const now = nowISO();
  db.runSync(
    'UPDATE documents SET deleted_at = ?, updated_at = ? WHERE id = ?',
    [now, now, id]
  );
}

export function restoreDocument(id: string): void {
  const db = getDatabase();
  const now = nowISO();
  db.runSync(
    'UPDATE documents SET deleted_at = NULL, updated_at = ? WHERE id = ?',
    [now, id]
  );
}
