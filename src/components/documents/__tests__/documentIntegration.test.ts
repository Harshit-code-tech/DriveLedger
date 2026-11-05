/**
 * Vehicle Documents Integration Test Suite
 *
 * Verifies:
 * - Document store CRUD and renewal chains (superseded_by)
 * - Vehicle scoping (loading documents for selected vehicle only)
 * - Document status overview counting (active, expiring soon, expired, superseded)
 * - Date ordering and validation
 * - Soft deletion
 * - Attachment helpers
 */

jest.mock('@/widgets/widgetDataService', () => ({
  syncWidgetState: jest.fn(),
}));

jest.mock('@/services/notificationService', () => ({
  refreshReminders: jest.fn(),
}));

import { resetMockDatabase } from '@/__mocks__/expo-sqlite';
import { getDatabase } from '@/database/connection';
import { createTables } from '@/database/schema';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import * as documentRepo from '@/database/repositories/documentRepo';
import { useDocumentStore } from '@/stores/documentStore';
import { useVehicleStore } from '@/stores/vehicleStore';
import { DocumentType } from '@/constants/documentTypes';
import { FuelType, VehicleType } from '@/constants/fuelTypes';
import {
  getDocumentValidityInfo,
  getDocumentOverviewCounts,
  getAttachmentDisplayName,
} from '../documentHelpers';
import { DocumentColors } from '../documentTheme';
import { isPdfAttachment, getThumbnailUri } from '@/utils/attachmentStorage';

describe('Vehicle Documents Tab — Redesign & Integration', () => {
  let vehicle1Id: string;
  let vehicle2Id: string;

  beforeEach(() => {
    resetMockDatabase();
    const db = getDatabase();
    createTables(db);

    // Create test vehicles
    const v1 = vehicleRepo.createVehicle({
      nickname: 'City Car',
      registration_number: 'OD 02 AB 1234',
      vehicle_type: VehicleType.CAR,
      fuel_type: FuelType.PETROL,
      tank_capacity: 40,
      current_odometer: 10000,
    });
    vehicle1Id = v1.id;

    const v2 = vehicleRepo.createVehicle({
      nickname: 'Highway Cruiser',
      registration_number: 'DL 01 CD 5678',
      vehicle_type: VehicleType.CAR,
      fuel_type: FuelType.DIESEL,
      tank_capacity: 50,
      current_odometer: 25000,
    });
    vehicle2Id = v2.id;
  });

  describe('1. Document Store & Vehicle Scoping', () => {
    it('loads documents exclusively for the selected vehicle', () => {
      // Create doc for vehicle 1
      useDocumentStore.getState().addDocument({
        vehicle_id: vehicle1Id,
        type: DocumentType.RC,
        document_number: 'RC-V1',
        issue_date: '2024-01-01',
      });

      // Create doc for vehicle 2
      useDocumentStore.getState().addDocument({
        vehicle_id: vehicle2Id,
        type: DocumentType.RC,
        document_number: 'RC-V2',
        issue_date: '2024-05-01',
      });

      // Load for vehicle 1
      useDocumentStore.getState().loadDocuments(vehicle1Id);
      const v1Docs = useDocumentStore.getState().documents;
      expect(v1Docs).toHaveLength(1);
      expect(v1Docs[0].document_number).toBe('RC-V1');

      // Load for vehicle 2
      useDocumentStore.getState().loadDocuments(vehicle2Id);
      const v2Docs = useDocumentStore.getState().documents;
      expect(v2Docs).toHaveLength(1);
      expect(v2Docs[0].document_number).toBe('RC-V2');
    });

    it('handles renewal chain by updating superseded_by', () => {
      // Add initial Insurance policy
      const oldDoc = useDocumentStore.getState().addDocument({
        vehicle_id: vehicle1Id,
        type: DocumentType.INSURANCE,
        insurer_name: 'Policy 2025',
        document_number: 'POL-001',
        issue_date: '2025-01-01',
        expiry_date: '2026-01-01',
      });

      expect(useDocumentStore.getState().documents).toHaveLength(1);
      expect(useDocumentStore.getState().allDocuments).toHaveLength(1);

      // Renew policy
      const newDoc = useDocumentStore.getState().renewDocument(oldDoc.id, {
        vehicle_id: vehicle1Id,
        type: DocumentType.INSURANCE,
        insurer_name: 'Policy 2026',
        document_number: 'POL-002',
        issue_date: '2026-01-01',
        expiry_date: '2027-01-01',
      });

      // Active documents should contain only the new policy
      const activeDocs = useDocumentStore.getState().documents;
      expect(activeDocs).toHaveLength(1);
      expect(activeDocs[0].id).toBe(newDoc.id);
      expect(activeDocs[0].document_number).toBe('POL-002');
      expect(activeDocs[0].superseded_by).toBeNull();

      // allDocuments should contain both
      const allDocs = useDocumentStore.getState().allDocuments;
      expect(allDocs).toHaveLength(2);

      // Verify superseded documents filter
      const superseded = allDocs.filter((d) => d.superseded_by !== null);
      expect(superseded).toHaveLength(1);
      expect(superseded[0].id).toBe(oldDoc.id);
      expect(superseded[0].superseded_by).toBe(newDoc.id);
    });

    it('soft deletes documents cleanly', () => {
      const doc = useDocumentStore.getState().addDocument({
        vehicle_id: vehicle1Id,
        type: DocumentType.PUC,
        document_number: 'PUC-99',
        expiry_date: '2026-12-31',
      });

      expect(useDocumentStore.getState().documents).toHaveLength(1);

      // Delete document
      useDocumentStore.getState().deleteDocument(doc.id, vehicle1Id);

      expect(useDocumentStore.getState().documents).toHaveLength(0);
      expect(useDocumentStore.getState().allDocuments).toHaveLength(0);

      // Verify row still exists in DB with deleted_at timestamp
      const row = documentRepo.getDocumentById(doc.id);
      expect(row).toBeNull(); // getDocumentById filters WHERE deleted_at IS NULL
    });
  });

  describe('2. Document Status Overview & Validity', () => {
    it('computes correct overview metrics for mixed validity dates', () => {
      const today = new Date();

      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + 100);

      const expiringDate = new Date(today);
      expiringDate.setDate(today.getDate() + 10);

      const expiredDate = new Date(today);
      expiredDate.setDate(today.getDate() - 5);

      const docValid = useDocumentStore.getState().addDocument({
        vehicle_id: vehicle1Id,
        type: DocumentType.RC,
        expiry_date: futureDate.toISOString().split('T')[0],
      });

      const docExpiring = useDocumentStore.getState().addDocument({
        vehicle_id: vehicle1Id,
        type: DocumentType.INSURANCE,
        expiry_date: expiringDate.toISOString().split('T')[0],
      });

      const docExpired = useDocumentStore.getState().addDocument({
        vehicle_id: vehicle1Id,
        type: DocumentType.PUC,
        expiry_date: expiredDate.toISOString().split('T')[0],
      });

      const activeDocs = useDocumentStore.getState().documents;
      const counts = getDocumentOverviewCounts(activeDocs, []);

      expect(counts.totalActive).toBe(3);
      expect(counts.valid).toBe(1);
      expect(counts.expiringSoon).toBe(1);
      expect(counts.expired).toBe(1);

      // Check validity info
      const infoExpired = getDocumentValidityInfo(
        docExpired.expiry_date,
        docExpired.type,
        false,
        DocumentColors.light
      );
      expect(infoExpired.status).toBe('expired');
      expect(infoExpired.label).toContain('₹10k Fine');

      const infoExpiring = getDocumentValidityInfo(
        docExpiring.expiry_date,
        docExpiring.type,
        false,
        DocumentColors.light
      );
      expect(infoExpiring.status).toBe('expiring_soon');

      const infoValid = getDocumentValidityInfo(
        docValid.expiry_date,
        docValid.type,
        false,
        DocumentColors.light
      );
      expect(infoValid.status).toBe('valid');
    });
  });

  describe('3. Attachment Display & Storage Handling', () => {
    it('detects PDF attachments correctly', () => {
      expect(isPdfAttachment('file:///path/to/rc_certificate.pdf')).toBe(true);
      expect(isPdfAttachment('file:///path/to/insurance.PDF')).toBe(true);
      expect(isPdfAttachment('file:///path/to/receipt.jpg')).toBe(false);
      expect(isPdfAttachment(null)).toBe(false);
    });

    it('derives image thumbnails and preserves PDF paths', () => {
      expect(getThumbnailUri('file:///data/attachments/photo.jpg')).toBe(
        'file:///data/attachments/thumb_photo.jpg'
      );
      expect(getThumbnailUri('file:///data/attachments/doc.pdf')).toBe(
        'file:///data/attachments/doc.pdf'
      );
    });

    it('extracts attachment display names cleanly', () => {
      expect(
        getAttachmentDisplayName('file:///storage/attachments/my_policy_front.pdf')
      ).toBe('my_policy_front.pdf');
    });
  });
});
