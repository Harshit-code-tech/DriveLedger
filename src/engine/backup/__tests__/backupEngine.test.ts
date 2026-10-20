declare const Buffer: any;

import {
  createBackup,
  exportBackupString,
  exportCsvFile,
  verifyBackupContent,
  restoreFromValidated,
} from '../../backupEngine';
import { getDatabase } from '@/database/connection';
import { createTables } from '@/database/schema';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import * as fuelRepo from '@/database/repositories/fuelRepo';
import * as documentRepo from '@/database/repositories/documentRepo';
import { FuelType, FuelUnit, VehicleType } from '@/constants/fuelTypes';
import { DocumentType } from '@/constants/documentTypes';
import { resetMockDatabase } from '@/__mocks__/expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

let asyncStore: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getAllKeys: jest.fn(async () => Object.keys(asyncStore)),
  getItem: jest.fn(async (key: string) => asyncStore[key] ?? null),
  setItem: jest.fn(async (key: string, val: string) => {
    asyncStore[key] = val;
  }),
  removeItem: jest.fn(async (key: string) => {
    delete asyncStore[key];
  }),
  clear: jest.fn(async () => {
    asyncStore = {};
  }),
}));

jest.mock('@/services/notificationService', () => ({
  refreshReminders: jest.fn(),
  scheduleReminderNotifications: jest.fn().mockResolvedValue(undefined),
  reconcileNotifications: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/widgets/widgetDataService', () => ({
  syncWidgetState: jest.fn().mockResolvedValue(undefined),
}));

describe('P0.1 & P0.2 — Backup Engine End-to-End Integration', () => {
  let db: any;
  let testVehicle: any;

  beforeEach(() => {
    resetMockDatabase();
    db = getDatabase();
    createTables(db);
    asyncStore = {};
    jest.clearAllMocks();

    testVehicle = vehicleRepo.createVehicle({
      nickname: 'Backup Test Thar',
      vehicle_type: VehicleType.CAR,
      fuel_type: FuelType.DIESEL,
      registration_number: 'KA05CD5678',
      current_odometer: 10000,
    });

    fuelRepo.createFuelEntryAtomic(
      {
        vehicle_id: testVehicle.id,
        date: '2026-03-01',
        odometer: 10500,
        fuel_amount: 45,
        fuel_unit: FuelUnit.LITRES,
        price_per_unit: 90,
        is_full_tank: 1,
      },
      FuelType.DIESEL,
      VehicleType.CAR
    );

    documentRepo.createDocument({
      vehicle_id: testVehicle.id,
      type: DocumentType.INSURANCE,
      document_number: 'POL-999',
      expiry_date: '2027-03-01',
    });

    // Populate some AsyncStorage state
    asyncStore['@driveledger_preferences'] = JSON.stringify({
      currency: 'INR',
      distanceUnit: 'km',
      fuelUnit: 'litres',
    });
    asyncStore[`@driveledger_checklist_${testVehicle.id}`] = JSON.stringify([
      { id: 'c1', text: 'Check tyre pressure', completed: true },
    ]);
  });

  it('exports password-encrypted v3 backup with non-SQLite state and restores correctly', async () => {
    const password = 'StrongTestPassword#2026';

    // 1. Export
    const exportResult = await exportBackupString(password);
    expect(exportResult.success).toBe(true);
    expect(exportResult.content).toBeDefined();

    const rawContent = exportResult.content!;
    const parsedEnvelope = JSON.parse(rawContent);
    expect(parsedEnvelope.version).toBe(3);
    expect(parsedEnvelope.kdf.algorithm).toBe('PBKDF2-HMAC-SHA256');
    expect(parsedEnvelope.encryption.algorithm).toBe('AES-256-GCM');
    expect(parsedEnvelope.ciphertext).toBeDefined();

    // 2. Verify without password -> returns requiresPassword
    const noPassVerify = await verifyBackupContent(rawContent);
    expect(noPassVerify.success).toBe(true);
    expect(noPassVerify.requiresPassword).toBe(true);

    // 3. Verify with wrong password -> fails authentication
    const wrongPassVerify = await verifyBackupContent(rawContent, 'WrongPassword123');
    expect(wrongPassVerify.success).toBe(false);
    expect(wrongPassVerify.message).toContain('Incorrect password');

    // 4. Verify with correct password -> succeeds and includes data
    const correctPassVerify = await verifyBackupContent(rawContent, password);
    expect(correctPassVerify.success).toBe(true);
    expect(correctPassVerify.backup).toBeDefined();
    expect(correctPassVerify.backup?.data.vehicles).toHaveLength(1);
    expect(correctPassVerify.backup?.data.fuel_entries).toHaveLength(1);
    expect(correctPassVerify.backup?.data.preferences?.currency).toBe('INR');
    expect(correctPassVerify.backup?.data.checklists?.[testVehicle.id]).toHaveLength(1);

    // 5. Clear current database and restore
    resetMockDatabase();
    db = getDatabase();
    createTables(db);
    expect(vehicleRepo.getActiveVehicles()).toHaveLength(0);

    const restoreResult = restoreFromValidated(correctPassVerify.backup!);
    expect(restoreResult.success).toBe(true);

    const restoredVehicles = vehicleRepo.getActiveVehicles();
    expect(restoredVehicles).toHaveLength(1);
    expect(restoredVehicles[0].nickname).toBe('Backup Test Thar');

    const restoredFuel = fuelRepo.getFuelEntriesByVehicle(testVehicle.id);
    expect(restoredFuel).toHaveLength(1);
    expect(restoredFuel[0].odometer).toBe(10500);

    const restoredDocs = documentRepo.getCurrentDocumentsByVehicle(testVehicle.id);
    expect(restoredDocs).toHaveLength(1);
    expect(restoredDocs[0].document_number).toBe('POL-999');
  }, 25000);

  it('rejects tampered v3 backup ciphertext without altering database', async () => {
    const password = 'TamperTestPassword!123';
    const exportResult = await exportBackupString(password);
    const envelope = JSON.parse(exportResult.content!);

    // Corrupt ciphertext
    const originalCipher = Buffer.from(envelope.ciphertext, 'base64');
    originalCipher[10] ^= 0xff; // flip byte
    envelope.ciphertext = originalCipher.toString('base64');

    const tamperedContent = JSON.stringify(envelope);
    const verifyResult = await verifyBackupContent(tamperedContent, password);
    expect(verifyResult.success).toBe(false);
    expect(verifyResult.message).toContain('corrupted');

    // Verify existing database untouched
    const vehicles = vehicleRepo.getActiveVehicles();
    expect(vehicles).toHaveLength(1);
    expect(vehicles[0].nickname).toBe('Backup Test Thar');
  }, 25000);

  it('rejects legacy v1 and v2 backups as unsupported', async () => {
    // Legacy v2 envelope
    const v2Envelope = {
      format: 'driveledger.encrypted-backup',
      version: 2,
      algorithm: 'AES-256-GCM',
      ciphertext: 'dummy-ciphertext',
    };
    const v2Result = await verifyBackupContent(JSON.stringify(v2Envelope));
    expect(v2Result.success).toBe(false);
    expect(v2Result.message).toContain('Unsupported backup format or version');

    // Legacy v1 plaintext JSON
    const v1BackupData = createBackup().backup!;
    const v1Result = await verifyBackupContent(JSON.stringify(v1BackupData));
    expect(v1Result.success).toBe(false);
    expect(v1Result.message).toContain('Unsupported backup format or version');
  });

  it('exports ledger records to a real CSV file', async () => {
    const csvResult = await exportCsvFile();
    expect(csvResult.success).toBe(true);
    expect(csvResult.filePath).toBeDefined();
    expect(csvResult.filePath).toContain('.csv');
  });
});
