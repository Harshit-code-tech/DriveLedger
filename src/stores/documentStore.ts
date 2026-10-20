/**
 * Document Store (Zustand)
 *
 * Global state for vehicle documents.
 * Connects the UI layer to the documentRepo.
 *
 * KEY FEATURES:
 * - CRUD operations for documents
 * - Renewal chain management (superseded_by linking)
 * - Expiring documents tracking for dashboard warnings
 * - All documents (including superseded) for renewal history auditing
 */

import { create } from 'zustand';
import type { VehicleDocument, CreateDocumentInput, UpdateDocumentInput } from '@/types/document';
import * as documentRepo from '@/database/repositories/documentRepo';
import { daysUntil } from '@/utils/date';
import { syncWidgetState } from '@/widgets/widgetDataService';
import { refreshReminders } from '@/services/notificationService';

interface DocumentState {
  /** Current (non-superseded) documents for the selected vehicle */
  documents: VehicleDocument[];
  /** All non-deleted documents for the vehicle, including superseded */
  allDocuments: VehicleDocument[];
  /** Documents expiring within 30 days (for dashboard warnings) */
  expiringDocs: VehicleDocument[];
  /** Loading state */
  isLoading: boolean;

  // ── Actions ──
  /** Load documents for a vehicle */
  loadDocuments: (vehicleId: string) => void;
  /** Create a new document */
  addDocument: (input: CreateDocumentInput) => VehicleDocument;
  /** Update an existing document */
  editDocument: (id: string, input: UpdateDocumentInput) => VehicleDocument | null;
  /** Delete a document (soft delete) */
  deleteDocument: (id: string, vehicleId: string) => void;
  /** Renew a document (creates new, links old via superseded_by) */
  renewDocument: (oldDocumentId: string, newInput: CreateDocumentInput) => VehicleDocument;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  documents: [],
  allDocuments: [],
  expiringDocs: [],
  isLoading: true,

  loadDocuments: (vehicleId: string) => {
    const documents = documentRepo.getCurrentDocumentsByVehicle(vehicleId);
    const allDocuments = documentRepo.getAllDocumentsByVehicle(vehicleId);
    const expiringDocs = documents.filter(
      (d) => d.expiry_date && daysUntil(d.expiry_date) <= 30
    );
    set({ documents, allDocuments, expiringDocs, isLoading: false });
  },

  addDocument: (input: CreateDocumentInput) => {
    const doc = documentRepo.createDocument(input);
    const documents = documentRepo.getCurrentDocumentsByVehicle(input.vehicle_id);
    const allDocuments = documentRepo.getAllDocumentsByVehicle(input.vehicle_id);
    const expiringDocs = documents.filter(
      (d) => d.expiry_date && daysUntil(d.expiry_date) <= 30
    );
    set({ documents, allDocuments, expiringDocs });
    syncWidgetState();
    refreshReminders();
    return doc;
  },

  editDocument: (id: string, input: UpdateDocumentInput) => {
    const updated = documentRepo.updateDocument(id, input);
    if (updated) {
      const documents = documentRepo.getCurrentDocumentsByVehicle(updated.vehicle_id);
      const allDocuments = documentRepo.getAllDocumentsByVehicle(updated.vehicle_id);
      const expiringDocs = documents.filter(
        (d) => d.expiry_date && daysUntil(d.expiry_date) <= 30
      );
      set({ documents, allDocuments, expiringDocs });
      syncWidgetState();
      refreshReminders();
    }
    return updated;
  },

  deleteDocument: (id: string, vehicleId: string) => {
    documentRepo.softDeleteDocument(id);
    const documents = documentRepo.getCurrentDocumentsByVehicle(vehicleId);
    const allDocuments = documentRepo.getAllDocumentsByVehicle(vehicleId);
    const expiringDocs = documents.filter(
      (d) => d.expiry_date && daysUntil(d.expiry_date) <= 30
    );
    set({ documents, allDocuments, expiringDocs });
    syncWidgetState();
    refreshReminders();
  },

  renewDocument: (oldDocumentId: string, newInput: CreateDocumentInput) => {
    const newDoc = documentRepo.renewDocument(oldDocumentId, newInput);
    const documents = documentRepo.getCurrentDocumentsByVehicle(newInput.vehicle_id);
    const allDocuments = documentRepo.getAllDocumentsByVehicle(newInput.vehicle_id);
    const expiringDocs = documents.filter(
      (d) => d.expiry_date && daysUntil(d.expiry_date) <= 30
    );
    set({ documents, allDocuments, expiringDocs });
    syncWidgetState();
    refreshReminders();
    return newDoc;
  },
}));
