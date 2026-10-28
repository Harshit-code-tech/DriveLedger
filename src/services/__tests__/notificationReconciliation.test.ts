import {
  reconcileNotifications,
  resetNotificationReconciliationCacheForTesting,
} from '../notificationService';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import * as documentRepo from '@/database/repositories/documentRepo';
import { FuelType, VehicleType } from '@/constants/fuelTypes';
import { DocumentType } from '@/constants/documentTypes';
import { getDatabase } from '@/database/connection';
import { createTables } from '@/database/schema';
import { resetMockDatabase } from '@/__mocks__/expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

let asyncStorageStore: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (key: string) => asyncStorageStore[key] ?? null),
  setItem: jest.fn(async (key: string, val: string) => {
    asyncStorageStore[key] = val;
  }),
  removeItem: jest.fn(async (key: string) => {
    delete asyncStorageStore[key];
  }),
  clear: jest.fn(async () => {
    asyncStorageStore = {};
  }),
}));

describe('P0.3 — Reminder & Notification Lifecycle Reconciliation', () => {
  let db: any;
  let testVehicle: any;
  let mockScheduledList: any[] = [];
  let nextNotificationId = 1;

  // Mock NotificationsModule to inspect and control OS notification triggers
  const mockNotificationsModule: any = {
    SchedulableTriggerInputTypes: {
      DAILY: 'daily',
      MONTHLY: 'monthly',
    },
    getAllScheduledNotificationsAsync: jest.fn(async () => [...mockScheduledList]),
    scheduleNotificationAsync: jest.fn(async (request: any) => {
      const identifier = `notif_${nextNotificationId++}`;
      const record = { identifier, ...request };
      mockScheduledList.push(record);
      return identifier;
    }),
    cancelScheduledNotificationAsync: jest.fn(async (id: string) => {
      mockScheduledList = mockScheduledList.filter((n) => n.identifier !== id);
    }),
    cancelAllScheduledNotificationsAsync: jest.fn(async () => {
      mockScheduledList = [];
    }),
    setNotificationHandler: jest.fn(),
    getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
  };

  beforeEach(() => {
    resetNotificationReconciliationCacheForTesting();
    resetMockDatabase();
    db = getDatabase();
    createTables(db);
    asyncStorageStore = {};
    mockScheduledList = [];
    nextNotificationId = 1;
    jest.clearAllMocks();

    testVehicle = vehicleRepo.createVehicle({
      nickname: 'Notification Test Car',
      vehicle_type: VehicleType.CAR,
      fuel_type: FuelType.PETROL,
      registration_number: 'MH01AB1111',
    });
  });

  // Helper to generate ISO date offset from today
  function getDateOffset(daysFromNow: number): string {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    return d.toISOString().split('T')[0];
  }

  it('schedules daily reminder for active document expiring in 5 days', async () => {
    const doc = documentRepo.createDocument({
      vehicle_id: testVehicle.id,
      type: DocumentType.INSURANCE,
      document_number: 'POL-12345',
      expiry_date: getDateOffset(5),
    });

    await reconcileNotifications(mockNotificationsModule);

    // Expect 1 expiry reminder and 1 monthly summary
    const expiryNotifs = mockScheduledList.filter(
      (n) => n.content.data?.type === 'expiry_reminder'
    );
    expect(expiryNotifs).toHaveLength(1);
    expect(expiryNotifs[0].content.data.documentId).toBe(doc.id);
    expect(expiryNotifs[0].content.title).toContain('Insurance Renewal Reminder');
    expect(expiryNotifs[0].trigger.type).toBe('daily');
    expect(expiryNotifs[0].trigger.hour).toBe(9);

    const monthlyNotifs = mockScheduledList.filter(
      (n) => n.content.data?.type === 'monthly_summary'
    );
    expect(monthlyNotifs).toHaveLength(1);
  });

  it('is idempotent: running reconciliation multiple times does not produce duplicates', async () => {
    documentRepo.createDocument({
      vehicle_id: testVehicle.id,
      type: DocumentType.PUC,
      expiry_date: getDateOffset(3),
    });

    await reconcileNotifications(mockNotificationsModule);
    const dailyBefore = mockScheduledList.filter((n) => n.content.data?.type === 'expiry_reminder');
    const monthlyBefore = mockScheduledList.filter((n) => n.content.data?.type === 'monthly_summary');
    expect(dailyBefore).toHaveLength(1);
    expect(monthlyBefore).toHaveLength(1);

    // Run reconciliation again
    await reconcileNotifications(mockNotificationsModule);
    const dailyAfter2 = mockScheduledList.filter((n) => n.content.data?.type === 'expiry_reminder');
    const monthlyAfter2 = mockScheduledList.filter((n) => n.content.data?.type === 'monthly_summary');
    expect(dailyAfter2).toHaveLength(1);
    expect(monthlyAfter2).toHaveLength(1);

    // Run a third time
    await reconcileNotifications(mockNotificationsModule);
    const dailyAfter3 = mockScheduledList.filter((n) => n.content.data?.type === 'expiry_reminder');
    const monthlyAfter3 = mockScheduledList.filter((n) => n.content.data?.type === 'monthly_summary');
    expect(dailyAfter3).toHaveLength(1);
    expect(monthlyAfter3).toHaveLength(1);
  });

  it('cancels scheduled notification when document is renewed (superseded_by linked)', async () => {
    const oldDoc = documentRepo.createDocument({
      vehicle_id: testVehicle.id,
      type: DocumentType.INSURANCE,
      expiry_date: getDateOffset(3),
    });

    await reconcileNotifications(mockNotificationsModule);
    expect(
      mockScheduledList.filter((n) => n.content.data?.type === 'expiry_reminder')
    ).toHaveLength(1);

    // Renew document with new expiry 1 year away (> 7 days)
    documentRepo.renewDocument(oldDoc.id, {
      vehicle_id: testVehicle.id,
      type: DocumentType.INSURANCE,
      expiry_date: getDateOffset(365),
    });

    // Reconcile
    await reconcileNotifications(mockNotificationsModule);

    // Old document reminder must be cancelled, new document is 365 days away so not scheduled
    const remainingExpiryNotifs = mockScheduledList.filter(
      (n) => n.content.data?.type === 'expiry_reminder'
    );
    expect(remainingExpiryNotifs).toHaveLength(0);
  });

  it('cancels scheduled notification when document is deleted', async () => {
    const doc = documentRepo.createDocument({
      vehicle_id: testVehicle.id,
      type: DocumentType.FASTAG,
      expiry_date: getDateOffset(4),
    });

    await reconcileNotifications(mockNotificationsModule);
    expect(
      mockScheduledList.filter((n) => n.content.data?.type === 'expiry_reminder')
    ).toHaveLength(1);

    // Soft delete document
    documentRepo.softDeleteDocument(doc.id);

    // Reconcile
    await reconcileNotifications(mockNotificationsModule);

    const remainingExpiryNotifs = mockScheduledList.filter(
      (n) => n.content.data?.type === 'expiry_reminder'
    );
    expect(remainingExpiryNotifs).toHaveLength(0);
  });

  it('updates schedule if document expiry date is changed', async () => {
    const doc = documentRepo.createDocument({
      vehicle_id: testVehicle.id,
      type: DocumentType.INSURANCE,
      expiry_date: getDateOffset(6),
    });

    await reconcileNotifications(mockNotificationsModule);
    const firstNotif = mockScheduledList.find(
      (n) => n.content.data?.type === 'expiry_reminder'
    );
    expect(firstNotif.content.data.daysRemaining).toBe(6);

    // Edit document to expire in 2 days
    documentRepo.updateDocument(doc.id, {
      expiry_date: getDateOffset(2),
    });

    await reconcileNotifications(mockNotificationsModule);

    const updatedNotif = mockScheduledList.find(
      (n) => n.content.data?.type === 'expiry_reminder'
    );
    expect(updatedNotif.content.data.daysRemaining).toBe(2);
    // Ensure no stale duplicate
    expect(
      mockScheduledList.filter((n) => n.content.data?.type === 'expiry_reminder')
    ).toHaveLength(1);
  });

  it('does not schedule reminders for documents expiring > 7 days or already expired', async () => {
    // 20 days in future
    documentRepo.createDocument({
      vehicle_id: testVehicle.id,
      type: DocumentType.WARRANTY,
      expiry_date: getDateOffset(20),
    });

    // 5 days in past
    documentRepo.createDocument({
      vehicle_id: testVehicle.id,
      type: DocumentType.RC,
      expiry_date: getDateOffset(-5),
    });

    await reconcileNotifications(mockNotificationsModule);

    const expiryNotifs = mockScheduledList.filter(
      (n) => n.content.data?.type === 'expiry_reminder'
    );
    expect(expiryNotifs).toHaveLength(0);
  });

  it('cancels duplicate scheduled notifications found in OS state', async () => {
    // Manually inject 2 identical monthly summary notifications and 2 identical doc reminders
    mockScheduledList = [
      {
        identifier: 'dup_monthly_1',
        content: { data: { type: 'monthly_summary' } },
      },
      {
        identifier: 'dup_monthly_2',
        content: { data: { type: 'monthly_summary' } },
      },
      {
        identifier: 'orphan_doc_1',
        content: { data: { type: 'expiry_reminder', documentId: 'orphan-id-123' } },
      },
    ];

    await reconcileNotifications(mockNotificationsModule);

    // Should cancel orphan_doc_1 and one of the duplicate monthlies, leaving exactly 1 monthly
    expect(mockScheduledList.filter((n) => n.content.data?.type === 'monthly_summary')).toHaveLength(1);
    expect(mockScheduledList.filter((n) => n.content.data?.documentId === 'orphan-id-123')).toHaveLength(0);
  });

  it('cancels all scheduled notifications when master notification toggle is disabled', async () => {
    const { usePreferencesStore } = require('@/stores/preferencesStore');
    await usePreferencesStore.getState().setNotificationsEnabled(false);

    mockScheduledList = [
      {
        identifier: 'existing_reminder_1',
        content: { data: { type: 'monthly_summary' } },
      },
    ];

    await reconcileNotifications(mockNotificationsModule);

    expect(mockScheduledList).toHaveLength(0);

    // Restore preference
    await usePreferencesStore.getState().setNotificationsEnabled(true);
  });

  it('skips scheduling document reminders when notifyDocumentExpiry is disabled', async () => {
    const { usePreferencesStore } = require('@/stores/preferencesStore');
    await usePreferencesStore.getState().setNotifyDocumentExpiry(false);

    documentRepo.createDocument({
      vehicle_id: testVehicle.id,
      type: DocumentType.INSURANCE,
      expiry_date: getDateOffset(3),
    });

    await reconcileNotifications(mockNotificationsModule);

    const expiryNotifs = mockScheduledList.filter(
      (n) => n.content.data?.type === 'expiry_reminder'
    );
    expect(expiryNotifs).toHaveLength(0);

    // Restore preference
    await usePreferencesStore.getState().setNotifyDocumentExpiry(true);
  });

  it('batches sent-log writes: calls AsyncStorage.setItem at most once per reconciliation cycle when multiple immediate alerts trigger', async () => {
    // Create 2 expired documents (which both trigger immediate notifications)
    documentRepo.createDocument({
      vehicle_id: testVehicle.id,
      type: DocumentType.PUC,
      expiry_date: getDateOffset(-2),
    });
    documentRepo.createDocument({
      vehicle_id: testVehicle.id,
      type: DocumentType.FASTAG,
      expiry_date: getDateOffset(-5),
    });

    (AsyncStorage.setItem as jest.Mock).mockClear();

    await reconcileNotifications(mockNotificationsModule);

    // Verify both immediate notifications were scheduled
    const immediateNotifs = mockScheduledList.filter(
      (n) => n.content.data?.type === 'expiry'
    );
    expect(immediateNotifs.length).toBeGreaterThanOrEqual(2);

    // AsyncStorage.setItem for sent log must be called at most ONCE (batched)
    const sentLogCalls = (AsyncStorage.setItem as jest.Mock).mock.calls.filter(
      (call) => call[0] === 'driveledger_notification_sent_log'
    );
    expect(sentLogCalls).toHaveLength(1);
  });
});
