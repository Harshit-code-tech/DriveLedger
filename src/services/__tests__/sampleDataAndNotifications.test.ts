import { NOTIFICATION_RULES } from '../notificationRules';
import { pushAllTestNotifications } from '../notificationService';
import { seedRealLifeData } from '../sampleDataService';

jest.mock('react-native', () => ({
  Platform: { OS: 'android', select: (dict: any) => dict.android ?? dict.default },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo', () => ({
  isRunningInExpoGo: jest.fn().mockReturnValue(true),
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn().mockReturnValue('test-uuid-1234'),
}));

jest.mock('@/utils/uuid', () => ({
  generateUUID: jest.fn().mockReturnValue('test-uuid-1234'),
}));

jest.mock('@/database/connection', () => ({
  getDatabase: jest.fn().mockReturnValue({
    runSync: jest.fn(),
    getAllSync: jest.fn().mockReturnValue([]),
    getFirstSync: jest.fn().mockReturnValue(null),
  }),
}));

jest.mock('@/widgets/widgetDataService', () => ({
  syncWidgetState: jest.fn().mockResolvedValue(undefined),
}));

describe('NOTIFICATION_RULES Specification', () => {
  it('defines 13 comprehensive notification rules covering all app features', () => {
    expect(NOTIFICATION_RULES.length).toBe(13);
  });

  it('ensures each rule has all required metadata, timing, and conditions', () => {
    const validChannels = ['document-expiry', 'service-due', 'general-reminders'];
    const validPriorities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    const validCategories = ['Document', 'Service', 'Fuel', 'Summary'];

    for (const rule of NOTIFICATION_RULES) {
      expect(rule.id).toBeTruthy();
      expect(rule.name).toBeTruthy();
      expect(validCategories).toContain(rule.category);
      expect(validChannels).toContain(rule.channelId);
      expect(validPriorities).toContain(rule.priority);
      expect(rule.timing).toBeTruthy();
      expect(rule.conditionDescription).toBeTruthy();
      expect(rule.exampleTitle).toBeTruthy();
      expect(rule.exampleBody).toBeTruthy();
    }
  });

  it('includes critical legal fine rules for PUC and FASTag', () => {
    const pucExpired = NOTIFICATION_RULES.find((r) => r.id === 'puc_expired');
    expect(pucExpired).toBeDefined();
    expect(pucExpired?.priority).toBe('CRITICAL');
    expect(pucExpired?.exampleTitle).toContain('₹10,000');

    const fastagExpired = NOTIFICATION_RULES.find((r) => r.id === 'fastag_expired');
    expect(fastagExpired).toBeDefined();
    expect(fastagExpired?.priority).toBe('CRITICAL');
  });

  it('includes dual-dimension service reminders', () => {
    const serviceOverdue = NOTIFICATION_RULES.find((r) => r.id === 'service_overdue');
    expect(serviceOverdue).toBeDefined();
    expect(serviceOverdue?.conditionDescription).toContain('milestone in km');
    expect(serviceOverdue?.conditionDescription).toContain('elapsed months');
  });
});

describe('pushAllTestNotifications', () => {
  it('returns simulated result with all rules when in Expo Go runtime', async () => {
    const result = await pushAllTestNotifications();
    expect(result.isExpoGo).toBe(true);
    expect(result.rules.length).toBe(13);
  });
});

describe('seedRealLifeData', () => {
  it('executes and returns rich real-life dataset statistics', () => {
    const result = seedRealLifeData();
    expect(result.vehiclesCount).toBe(4);
    expect(result.fuelEntriesCount).toBeGreaterThanOrEqual(30);
    expect(result.serviceRecordsCount).toBeGreaterThanOrEqual(5);
    expect(result.expensesCount).toBeGreaterThanOrEqual(8);
    expect(result.documentsCount).toBeGreaterThanOrEqual(10);
  });
});
