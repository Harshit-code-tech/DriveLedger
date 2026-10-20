import { getDatabase } from '@/database/connection';
import { createTables } from '@/database/schema';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import * as fuelRepo from '@/database/repositories/fuelRepo';
import * as documentRepo from '@/database/repositories/documentRepo';
import { restoreFromValidated } from '@/engine/backupEngine';
import { FuelType, FuelUnit, VehicleType } from '@/constants/fuelTypes';
import { DocumentType } from '@/constants/documentTypes';
import { resetMockDatabase } from '@/__mocks__/expo-sqlite';
import type { BackupData } from '@/engine/backup/types';

// Mock notificationService and widgetDataService so tests focus on database integrity
jest.mock('@/services/notificationService', () => ({
  refreshReminders: jest.fn(),
  scheduleReminderNotifications: jest.fn().mockResolvedValue(undefined),
  reconcileNotifications: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/widgets/widgetDataService', () => ({
  syncWidgetState: jest.fn().mockResolvedValue(undefined),
}));

describe('P0.2 — Atomic SQLite Mutations & Transaction Safety', () => {
  let db: any;
  let testVehicleId: string;

  beforeEach(() => {
    resetMockDatabase();
    db = getDatabase();
    createTables(db);

    const vehicle = vehicleRepo.createVehicle({
      nickname: 'Transactional Honda City',
      vehicle_type: VehicleType.CAR,
      fuel_type: FuelType.PETROL,
      registration_number: 'KA01AB1234',
      current_odometer: 1000,
    });
    testVehicleId = vehicle.id;
  });

  describe('Fuel Entry Creation Atomicity', () => {
    it('commits entry, mileage, and vehicle odometer on success', () => {
      const { entry } = fuelRepo.createFuelEntryAtomic(
        {
          vehicle_id: testVehicleId,
          date: '2026-03-01',
          odometer: 1500,
          fuel_amount: 35,
          fuel_unit: FuelUnit.LITRES,
          price_per_unit: 100,
          is_full_tank: 1,
        },
        FuelType.PETROL,
        VehicleType.CAR
      );

      expect(entry.id).toBeDefined();

      // Verify fuel entry persisted
      const savedEntry = fuelRepo.getFuelEntryById(entry.id);
      expect(savedEntry).not.toBeNull();
      expect(savedEntry?.odometer).toBe(1500);

      // Verify vehicle odometer was atomically updated
      const updatedVehicle = vehicleRepo.getVehicleById(testVehicleId);
      expect(updatedVehicle?.current_odometer).toBe(1500);
    });

    it('rolls back fuel entry insertion if dependent update fails', () => {
      const originalVehicle = vehicleRepo.getVehicleById(testVehicleId);
      expect(originalVehicle?.current_odometer).toBe(1000);

      // Spy on vehicleRepo.updateVehicleOdometer and force failure
      const odoSpy = jest.spyOn(vehicleRepo, 'updateVehicleOdometer').mockImplementationOnce(() => {
        throw new Error('Simulated disk/connection crash during odometer update');
      });

      expect(() => {
        fuelRepo.createFuelEntryAtomic(
          {
            vehicle_id: testVehicleId,
            date: '2026-03-02',
            odometer: 1600,
            fuel_amount: 40,
            fuel_unit: FuelUnit.LITRES,
            price_per_unit: 100,
            is_full_tank: 1,
          },
          FuelType.PETROL,
          VehicleType.CAR
        );
      }).toThrow('Simulated disk/connection crash during odometer update');

      odoSpy.mockRestore();

      // Verify NO fuel entries were committed (rollback verified)
      const entries = fuelRepo.getFuelEntriesByVehicle(testVehicleId);
      expect(entries).toHaveLength(0);

      // Verify vehicle odometer remains unchanged
      const currentVehicle = vehicleRepo.getVehicleById(testVehicleId);
      expect(currentVehicle?.current_odometer).toBe(1000);
    });
  });

  describe('Fuel Entry Edit Atomicity', () => {
    it('rolls back edit changes if mileage recalculation or dependent update fails', () => {
      // First, create two chronological entries
      const { entry: entry1 } = fuelRepo.createFuelEntryAtomic(
        {
          vehicle_id: testVehicleId,
          date: '2026-03-01',
          odometer: 1200,
          fuel_amount: 30,
          fuel_unit: FuelUnit.LITRES,
          price_per_unit: 100,
          is_full_tank: 1,
        },
        FuelType.PETROL,
        VehicleType.CAR
      );

      const { entry: entry2 } = fuelRepo.createFuelEntryAtomic(
        {
          vehicle_id: testVehicleId,
          date: '2026-03-10',
          odometer: 1700,
          fuel_amount: 25,
          fuel_unit: FuelUnit.LITRES,
          price_per_unit: 100,
          is_full_tank: 1,
        },
        FuelType.PETROL,
        VehicleType.CAR
      );

      const preEditEntry1 = fuelRepo.getFuelEntryById(entry1.id);
      expect(preEditEntry1?.odometer).toBe(1200);

      // Spy on vehicleRepo.updateVehicleOdometer and force failure during dependent update
      const odoSpy = jest.spyOn(vehicleRepo, 'updateVehicleOdometer').mockImplementationOnce(() => {
        throw new Error('Simulated failure during odometer recalculation in edit');
      });

      expect(() => {
        fuelRepo.updateFuelEntryAtomic(
          entry1.id,
          { odometer: 1300, fuel_amount: 35 },
          FuelType.PETROL
        );
      }).toThrow('Simulated failure during odometer recalculation in edit');

      odoSpy.mockRestore();

      // Verify entry1 rolled back to original state
      const postFailedEdit = fuelRepo.getFuelEntryById(entry1.id);
      expect(postFailedEdit?.odometer).toBe(1200);
      expect(postFailedEdit?.fuel_amount).toBe(30);

      // Vehicle max odometer remains consistent
      const vehicle = vehicleRepo.getVehicleById(testVehicleId);
      expect(vehicle?.current_odometer).toBe(1700);
    });
  });

  describe('Fuel Entry Deletion Atomicity', () => {
    it('rolls back soft-delete if dependent recalculation fails', () => {
      const { entry: entry1 } = fuelRepo.createFuelEntryAtomic(
        {
          vehicle_id: testVehicleId,
          date: '2026-03-01',
          odometer: 1200,
          fuel_amount: 30,
          fuel_unit: FuelUnit.LITRES,
          price_per_unit: 100,
          is_full_tank: 1,
        },
        FuelType.PETROL,
        VehicleType.CAR
      );

      const odoSpy = jest.spyOn(vehicleRepo, 'updateVehicleOdometer').mockImplementationOnce(() => {
        throw new Error('Simulated failure during odometer recalculation after delete');
      });

      expect(() => {
        fuelRepo.deleteFuelEntryAtomic(entry1.id, testVehicleId, FuelType.PETROL);
      }).toThrow('Simulated failure during odometer recalculation after delete');

      odoSpy.mockRestore();

      // Verify entry1 was NOT soft-deleted
      const retrieved = fuelRepo.getFuelEntryById(entry1.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.deleted_at).toBeNull();
    });
  });

  describe('Document Renewal Atomicity', () => {
    it('atomically creates replacement document and links old document superseded_by', () => {
      const oldDoc = documentRepo.createDocument({
        vehicle_id: testVehicleId,
        type: DocumentType.INSURANCE,
        document_number: 'INS-001',
        expiry_date: '2026-04-01',
      });

      const newDoc = documentRepo.renewDocument(oldDoc.id, {
        vehicle_id: testVehicleId,
        type: DocumentType.INSURANCE,
        document_number: 'INS-002',
        expiry_date: '2027-04-01',
      });

      expect(newDoc.id).toBeDefined();

      // Verify old document has superseded_by pointer
      const updatedOldDoc = documentRepo.getDocumentById(oldDoc.id);
      expect(updatedOldDoc?.superseded_by).toBe(newDoc.id);

      // Verify getCurrentDocumentsByVehicle only returns the new document
      const currentDocs = documentRepo.getCurrentDocumentsByVehicle(testVehicleId);
      expect(currentDocs).toHaveLength(1);
      expect(currentDocs[0].id).toBe(newDoc.id);
    });

    it('rolls back if old document ID is non-existent', () => {
      expect(() => {
        documentRepo.renewDocument('non-existent-doc-id', {
          vehicle_id: testVehicleId,
          type: DocumentType.INSURANCE,
          document_number: 'INS-999',
          expiry_date: '2027-04-01',
        });
      }).toThrow('does not exist');

      // Verify no orphan document was created
      const allDocs = documentRepo.getCurrentDocumentsByVehicle(testVehicleId);
      expect(allDocs).toHaveLength(0);
    });
  });

  describe('Backup Restore Atomicity & Rollback', () => {
    it('restores all data atomically on success', () => {
      const backup: any = {
        app_id: 'com.driveledger.app',
        backup_version: 1,
        created_at: new Date().toISOString(),
        data: {
          vehicles: [
            {
              id: 'restored_veh_1',
              nickname: 'Restored Scorpio',
              vehicle_type: VehicleType.CAR,
              fuel_type: FuelType.DIESEL,
              registration_number: 'DL01XY9999',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            } as any,
          ],
          fuel_entries: [
            {
              id: 'restored_fuel_1',
              vehicle_id: 'restored_veh_1',
              date: '2026-01-10',
              odometer: 5000,
              fuel_amount: 50,
              fuel_unit: FuelUnit.LITRES,
              price_per_unit: 90,
              total_cost: 4500,
              is_full_tank: 1,
              created_at: '2026-01-10T00:00:00Z',
              updated_at: '2026-01-10T00:00:00Z',
            },
          ],
          service_records: [],
          expenses: [],
          documents: [
            {
              id: 'restored_doc_old',
              vehicle_id: 'restored_veh_1',
              type: DocumentType.INSURANCE,
              expiry_date: '2026-01-01',
              superseded_by: 'restored_doc_new',
              created_at: '2025-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
            {
              id: 'restored_doc_new',
              vehicle_id: 'restored_veh_1',
              type: DocumentType.INSURANCE,
              expiry_date: '2027-01-01',
              superseded_by: null,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
          ],
        },
      };

      const result = restoreFromValidated(backup);
      expect(result.success).toBe(true);

      const restoredVeh = vehicleRepo.getVehicleById('restored_veh_1');
      expect(restoredVeh?.nickname).toBe('Restored Scorpio');

      const restoredDocs = documentRepo.getCurrentDocumentsByVehicle('restored_veh_1');
      expect(restoredDocs).toHaveLength(1);
      expect(restoredDocs[0].id).toBe('restored_doc_new');

      const oldDoc = documentRepo.getDocumentById('restored_doc_old');
      expect(oldDoc?.superseded_by).toBe('restored_doc_new');
    });

    it('rolls back and preserves previous database state if restore fails midway', () => {
      // Existing data before restore attempt
      const preRestoreVehicles = vehicleRepo.getActiveVehicles();
      expect(preRestoreVehicles).toHaveLength(1);
      expect(preRestoreVehicles[0].nickname).toBe('Transactional Honda City');

      // Corrupt backup with invalid fuel_entries foreign key that will fail insertion
      const corruptBackup: any = {
        app_id: 'com.driveledger.app',
        backup_version: 1,
        created_at: new Date().toISOString(),
        data: {
          vehicles: [
            {
              id: 'v_partial',
              nickname: 'Partial Vehicle',
              vehicle_type: VehicleType.CAR,
              fuel_type: FuelType.PETROL,
              registration_number: 'DL01XY1111',
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            } as any,
          ],
          fuel_entries: [
            {
              id: 'f_corrupt',
              vehicle_id: 'v_partial',
              date: '2026-01-10',
              odometer: 100,
              fuel_amount: -5, // CHECK constraint (fuel_amount > 0) violation!
              fuel_unit: FuelUnit.LITRES,
              price_per_unit: 100,
              total_cost: 500,
              is_full_tank: 1,
              created_at: '2026-01-10T00:00:00Z',
              updated_at: '2026-01-10T00:00:00Z',
            },
          ],
          service_records: [],
          expenses: [],
          documents: [],
        },
      };

      const result = restoreFromValidated(corruptBackup);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Your existing data was NOT changed');

      // Verify original vehicle was NOT deleted and no partial restore remained
      const postFailedRestoreVehicles = vehicleRepo.getActiveVehicles();
      expect(postFailedRestoreVehicles).toHaveLength(1);
      expect(postFailedRestoreVehicles[0].nickname).toBe('Transactional Honda City');
    });
  });
});
