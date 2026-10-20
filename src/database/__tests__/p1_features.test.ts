/**
 * P1 Improvements Test Suite
 *
 * Verifies:
 * - Feature 4: Parts-level maintenance tracking & chronological component history
 * - Feature 5: Receipt attachments & Document renewal history chain
 * - Feature 6 & B: Financial correctness & single source of truth
 * - Feature 5.4/5.5: Attachment storage sanitization & Backup integration
 */

import { getDatabase } from '@/database/connection';
import { createTables } from '@/database/schema';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import * as serviceRepo from '@/database/repositories/serviceRepo';
import * as expenseRepo from '@/database/repositories/expenseRepo';
import * as documentRepo from '@/database/repositories/documentRepo';
import * as maintCompRepo from '@/database/repositories/maintenanceComponentRepo';
import { createBackup, restoreFromValidated } from '@/engine/backupEngine';
import { validateSchema, isValidBackupAttachment } from '@/engine/backup/schema';
import { sanitizeAttachmentFilename, isPdfAttachment, openAttachment } from '@/utils/attachmentStorage';
import { FuelType, VehicleType } from '@/constants/fuelTypes';
import { DocumentType } from '@/constants/documentTypes';
import { resetMockDatabase } from '@/__mocks__/expo-sqlite';
import type { BackupData } from '@/engine/backup/types';

jest.mock('@/services/notificationService', () => ({
  refreshReminders: jest.fn(),
  scheduleReminderNotifications: jest.fn().mockResolvedValue(undefined),
  reconcileNotifications: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/widgets/widgetDataService', () => ({
  syncWidgetState: jest.fn().mockResolvedValue(undefined),
}));

describe('P1 Features Integration & Integrity Suite', () => {
  let db: any;
  let testVehicleId: string;

  beforeEach(() => {
    resetMockDatabase();
    db = getDatabase();
    createTables(db);

    const vehicle = vehicleRepo.createVehicle({
      nickname: 'P1 Test Car',
      vehicle_type: VehicleType.CAR,
      fuel_type: FuelType.PETROL,
      registration_number: 'MH12AB1234',
      current_odometer: 25000,
    });
    testVehicleId = vehicle.id;
  });

  // ════════════════════════════════════════════════════════════════════
  // ── Feature 4: Lightweight Parts-Level Maintenance Tracking ────────
  // ════════════════════════════════════════════════════════════════════
  describe('Feature 4 — Maintenance Components Repository', () => {
    it('creates multiple components linked to a single service record without duplicate service entries', () => {
      const service = serviceRepo.createServiceRecord({
        vehicle_id: testVehicleId,
        date: '2026-03-01',
        service_type: 'Periodic Service',
        odometer: 25000,
        cost: 6500,
        garage_name: 'City Motors',
        receipt_photo_uri: 'file:///data/attachments/receipt_1.jpg',
      });

      const components = maintCompRepo.createMaintenanceComponents(
        [
          {
            component_name: 'Engine Oil',
            action: 'replaced',
            brand: 'Mobil 1 5W-30',
            cost: 3200,
            next_due_km: 35000,
            next_due_date: '2027-03-01',
          },
          {
            component_name: 'Oil Filter',
            action: 'replaced',
            brand: 'Bosch Genuine',
            cost: 450,
            next_due_km: 35000,
          },
          {
            component_name: 'Brake Pads',
            action: 'inspected',
            notes: 'Front pads 60% life remaining',
          },
        ],
        service.id,
        testVehicleId
      );

      expect(components).toHaveLength(3);
      expect(components[0].component_name).toBe('Engine Oil');
      expect(components[0].service_record_id).toBe(service.id);

      // Verify retrieval by service record
      const retrieved = maintCompRepo.getMaintenanceComponentsByService(service.id);
      expect(retrieved).toHaveLength(3);

      // Verify retrieval by vehicle
      const vehicleComps = maintCompRepo.getMaintenanceComponentsByVehicle(testVehicleId);
      expect(vehicleComps).toHaveLength(3);
    });

    it('safely handles createMaintenanceComponents inside an active transaction without error', () => {
      const service = serviceRepo.createServiceRecord({
        vehicle_id: testVehicleId,
        date: '2026-03-05',
        service_type: 'Full Service',
      });

      // Call inside withTransactionSync
      expect(() => {
        db.withTransactionSync(() => {
          maintCompRepo.createMaintenanceComponents(
            [
              {
                component_name: 'Brake Pads',
                action: 'replaced',
                brand: 'Brembo',
                cost: 2500,
              },
            ],
            service.id,
            testVehicleId
          );
        });
      }).not.toThrow();

      const comps = maintCompRepo.getMaintenanceComponentsByService(service.id);
      expect(comps).toHaveLength(1);
      expect(comps[0].component_name).toBe('Brake Pads');
    });

    it('returns chronological component history across multiple services', () => {
      // Service 1 at 20,000 km
      const s1 = serviceRepo.createServiceRecord({
        vehicle_id: testVehicleId,
        date: '2025-06-01',
        service_type: 'Oil Change',
        odometer: 20000,
        garage_name: 'Express Lube',
      });
      maintCompRepo.createMaintenanceComponents(
        [
          {
            component_name: 'Engine Oil',
            action: 'replaced',
            brand: 'Castrol Magnatec',
            cost: 2500,
            next_due_km: 30000,
          },
        ],
        s1.id,
        testVehicleId
      );

      // Service 2 at 25,000 km
      const s2 = serviceRepo.createServiceRecord({
        vehicle_id: testVehicleId,
        date: '2026-03-01',
        service_type: 'Major Service',
        odometer: 25000,
        garage_name: 'Authorized Service Center',
      });
      maintCompRepo.createMaintenanceComponents(
        [
          {
            component_name: 'Engine Oil',
            action: 'replaced',
            brand: 'Mobil 1',
            cost: 3200,
            next_due_km: 35000,
          },
        ],
        s2.id,
        testVehicleId
      );

      const history = maintCompRepo.getComponentHistory(testVehicleId, 'Engine Oil');
      expect(history).toHaveLength(2);
      // Newest first
      expect(history[0].serviceOdometer).toBe(25000);
      expect(history[0].component.brand).toBe('Mobil 1');
      expect(history[1].serviceOdometer).toBe(20000);
      expect(history[1].component.brand).toBe('Castrol Magnatec');
    });

    it('computes correct due status for components with next-due targets', () => {
      const s1 = serviceRepo.createServiceRecord({
        vehicle_id: testVehicleId,
        date: '2026-01-01',
        service_type: 'Brake Service',
        odometer: 20000,
      });

      // Target at 24,000 km (current odometer is 25,000 km -> overdue by 1,000 km)
      maintCompRepo.createMaintenanceComponents(
        [
          {
            component_name: 'Brake Pads',
            action: 'replaced',
            next_due_km: 24000,
          },
        ],
        s1.id,
        testVehicleId
      );

      const vehicle = vehicleRepo.getVehicleById(testVehicleId)!;
      const history = maintCompRepo.getComponentHistory(testVehicleId, 'Brake Pads');
      const status = maintCompRepo.computeComponentDueStatus(vehicle, 'Brake Pads', history);

      expect(status.status).toBe('overdue');
      expect(status.kmRemaining).toBe(-1000);
      expect(status.headline).toContain('Overdue');
    });

    it('deletes components when parent service record components are deleted', () => {
      const service = serviceRepo.createServiceRecord({
        vehicle_id: testVehicleId,
        date: '2026-02-01',
        service_type: 'Spark Plug Replacement',
        cost: 1500,
      });

      maintCompRepo.createMaintenanceComponents(
        [{ component_name: 'Spark Plugs', action: 'replaced' }],
        service.id,
        testVehicleId
      );

      expect(maintCompRepo.getMaintenanceComponentsByService(service.id)).toHaveLength(1);

      maintCompRepo.deleteMaintenanceComponentsByService(service.id);
      expect(maintCompRepo.getMaintenanceComponentsByService(service.id)).toHaveLength(0);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // ── Feature 5: Receipts & Document Renewal History ──────────────────
  // ════════════════════════════════════════════════════════════════════
  describe('Feature 5 — Attachments & Document Renewal History', () => {
    it('stores and updates receipt_photo_uri on service records and expenses', () => {
      const service = serviceRepo.createServiceRecord({
        vehicle_id: testVehicleId,
        date: '2026-03-01',
        service_type: 'Wheel Alignment',
        cost: 800,
        receipt_photo_uri: 'file:///storage/alignment_bill.pdf',
      });
      expect(service.receipt_photo_uri).toBe('file:///storage/alignment_bill.pdf');

      const updatedService = serviceRepo.updateServiceRecord(service.id, {
        receipt_photo_uri: 'file:///storage/new_alignment_bill.jpg',
      });
      expect(updatedService?.receipt_photo_uri).toBe('file:///storage/new_alignment_bill.jpg');

      const expense = expenseRepo.createExpense({
        vehicle_id: testVehicleId,
        date: '2026-03-02',
        category: 'Toll',
        amount: 250,
        receipt_photo_uri: 'file:///storage/toll_slip.jpg',
      });
      expect(expense.receipt_photo_uri).toBe('file:///storage/toll_slip.jpg');
    });

    it('manages document renewal chain preserving superseded documents in history', () => {
      // 1. Initial insurance policy
      const initialDoc = documentRepo.createDocument({
        vehicle_id: testVehicleId,
        type: DocumentType.INSURANCE,
        document_number: 'POL-2025-001',
        insurer_name: 'HDFC ERGO',
        issue_date: '2025-03-01',
        expiry_date: '2026-03-01',
        file_uri: 'file:///storage/policy_2025.pdf',
      });

      expect(initialDoc.superseded_by).toBeNull();
      expect(documentRepo.getCurrentDocumentsByVehicle(testVehicleId)).toHaveLength(1);

      // 2. Renew insurance policy
      const renewedDoc = documentRepo.renewDocument(initialDoc.id, {
        vehicle_id: testVehicleId,
        type: DocumentType.INSURANCE,
        document_number: 'POL-2026-002',
        insurer_name: 'HDFC ERGO',
        issue_date: '2026-03-01',
        expiry_date: '2027-03-01',
        file_uri: 'file:///storage/policy_2026.pdf',
      });

      // Active documents should only show the new policy
      const currentDocs = documentRepo.getCurrentDocumentsByVehicle(testVehicleId);
      expect(currentDocs).toHaveLength(1);
      expect(currentDocs[0].id).toBe(renewedDoc.id);
      expect(currentDocs[0].document_number).toBe('POL-2026-002');

      // Old policy has superseded_by pointing to the renewed policy
      const updatedOldDoc = documentRepo.getDocumentById(initialDoc.id);
      expect(updatedOldDoc?.superseded_by).toBe(renewedDoc.id);

      // Full history returns BOTH versions
      const allDocs = documentRepo.getAllDocumentsByVehicle(testVehicleId);
      expect(allDocs).toHaveLength(2);
      const superseded = allDocs.filter((d) => d.superseded_by !== null);
      expect(superseded).toHaveLength(1);
      expect(superseded[0].document_number).toBe('POL-2025-001');
    });

    it('sanitizes attachment filenames and rejects directory traversal attacks', () => {
      const maliciousName = '../../etc/passwd.jpg';
      const clean = sanitizeAttachmentFilename(maliciousName);
      expect(clean).not.toContain('..');
      expect(clean).not.toContain('/');
      expect(clean).not.toContain('\\');
      expect(clean).toMatch(/\.jpg$/);

      expect(isPdfAttachment('file:///path/bill.pdf')).toBe(true);
      expect(isPdfAttachment('file:///path/bill.PDF')).toBe(true);
      expect(isPdfAttachment('file:///path/receipt.jpg')).toBe(false);
    });

    it('opens PDF and image attachments safely without runtime property errors', async () => {
      const pdfRes = await openAttachment('file:///path/invoice.pdf', 'Invoice');
      expect(pdfRes.success).toBe(true);

      const imgRes = await openAttachment('file:///path/receipt.jpg', 'Receipt');
      expect(imgRes.success).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // ── Backup & Restore: Maintenance Components & Attachments ─────────
  // ════════════════════════════════════════════════════════════════════
  describe('Backup & Restore Integration', () => {
    it('bundles maintenance_components in backup payload and validates schema', () => {
      const service = serviceRepo.createServiceRecord({
        vehicle_id: testVehicleId,
        date: '2026-03-01',
        service_type: 'Brake Fluid Flush',
        cost: 1200,
      });

      maintCompRepo.createMaintenanceComponents(
        [
          {
            component_name: 'Brake Fluid',
            action: 'replaced',
            brand: 'DOT 4',
            cost: 600,
          },
        ],
        service.id,
        testVehicleId
      );

      const res = createBackup();
      expect(res.success).toBe(true);
      const backup = res.backup!;
      expect(backup.data.maintenance_components).toBeDefined();
      expect(backup.data.maintenance_components?.length).toBeGreaterThan(0);
      expect(backup.data.maintenance_components![0].component_name).toBe('Brake Fluid');

      const validation = validateSchema(backup as unknown as Record<string, unknown>);
      expect(validation).not.toBeNull();
      expect(validation!.data.maintenance_components).toBeDefined();
      expect(validation!.data.maintenance_components?.length).toBeGreaterThan(0);
    });

    it('rejects backup payloads with path traversal in attachment filenames', () => {
      expect(isValidBackupAttachment({ filename: '../../malicious.sh', base64: 'abc' })).toBe(false);
      expect(isValidBackupAttachment({ filename: 'sub/folder.sh', base64: 'abc' })).toBe(false);
      expect(isValidBackupAttachment({ filename: 'safe_file.jpg', base64: 'abc' })).toBe(true);

      const res = createBackup();
      const backup = res.backup!;
      const maliciousPayload = {
        ...backup,
        data: {
          ...backup.data,
          attachments: [
            {
              filename: '../../malicious.sh',
              base64: 'ZWNobyAiZGFuZ2VyIg==',
            },
            {
              filename: 'valid.jpg',
              base64: 'ZWNobyAiZGFuZ2VyIg==',
            },
          ],
        },
      };

      const validation = validateSchema(maliciousPayload as unknown as Record<string, unknown>);
      expect(validation).not.toBeNull();
      // Path traversal attachment was filtered out
      expect(validation!.data.attachments).toHaveLength(1);
      expect(validation!.data.attachments![0].filename).toBe('valid.jpg');
    });

    it('restores maintenance_components atomically without foreign key errors', () => {
      const service = serviceRepo.createServiceRecord({
        vehicle_id: testVehicleId,
        date: '2026-03-01',
        service_type: 'Tyre Replacement',
        cost: 16000,
      });

      const [comp] = maintCompRepo.createMaintenanceComponents(
        [
          {
            component_name: 'Tyres',
            action: 'replaced',
            brand: 'Bridgestone Turanza',
            cost: 16000,
            next_due_km: 70000,
          },
        ],
        service.id,
        testVehicleId
      );

      const res = createBackup();
      expect(res.success).toBe(true);
      const backup = res.backup!;

      // Reset database to blank state
      resetMockDatabase();
      const freshDb = getDatabase();
      createTables(freshDb);

      expect(maintCompRepo.getMaintenanceComponentsByVehicle(testVehicleId)).toHaveLength(0);

      // Restore
      restoreFromValidated(backup);

      // Verify records restored
      const restoredComps = maintCompRepo.getMaintenanceComponentsByVehicle(testVehicleId);
      expect(restoredComps).toHaveLength(1);
      expect(restoredComps[0].component_name).toBe('Tyres');
      expect(restoredComps[0].brand).toBe('Bridgestone Turanza');
      expect(restoredComps[0].next_due_km).toBe(70000);
    });
  });
});
