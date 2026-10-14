/**
 * Notification Service
 *
 * Handles local push notifications for document expiry warnings
 * and service-due reminders.
 *
 * HOW IT WORKS:
 * 1. On app launch, checks all documents for upcoming expiry.
 * 2. Schedules local notifications for documents expiring within 30 days.
 * 3. Uses expo-notifications for Android local notifications.
 *
 * NOTIFICATION SCHEDULE:
 * - Expired documents → immediate notification
 * - Expiring in ≤7 days → notification now + daily reminder
 * - Expiring in ≤30 days → notification now
 * - Service overdue / due within 500 km or 7 days → notification now
 *
 * NOTE: All notifications are LOCAL. No server, no internet, no account.
 *
 * EXPO GO COMPATIBILITY:
 * Since SDK 53, expo-notifications is NOT available in Expo Go.
 * All calls are wrapped in try/catch and the module is lazily imported
 * so the app runs fine without notifications in Expo Go.
 * In a production dev build, notifications work normally.
 */

import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import * as documentRepo from '@/database/repositories/documentRepo';
import * as serviceRepo from '@/database/repositories/serviceRepo';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import { getKmUntilService, getServiceDueStatus } from '@/stores/serviceStore';
import { DOCUMENT_TYPE_LABELS } from '@/constants/documentTypes';
import { daysUntil } from '@/utils/date';

// ─── Constants ──────────────────────────────────────────────────────

const CHANNEL_DOCUMENT_EXPIRY = 'document-expiry';
const CHANNEL_SERVICE_DUE = 'service-due';

/** Remind when the next service is within this many km. */
const SERVICE_DUE_KM_THRESHOLD = 500;
/** Remind when the next service date is within this many days. */
const SERVICE_DUE_DAYS_THRESHOLD = 7;

// ─── Expo Go detection ──────────────────────────────────────────────
// Since SDK 53, expo-notifications is NOT available in Expo Go.
// Even a try/catch around require() still triggers the dev error overlay,
// so we detect Expo Go upfront and never call require() at all.
// We use the same isRunningInExpoGo() that expo-notifications uses internally.

const isExpoGo = isRunningInExpoGo();

// ─── Lazy module reference ──────────────────────────────────────────

let Notifications: typeof import('expo-notifications') | null = null;
/** Set to true after a failed require — never retry. */
let notificationsUnavailable = false;

function getNotifications(): typeof import('expo-notifications') | null {
  if (Notifications) return Notifications;
  if (notificationsUnavailable || isExpoGo) return null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Notifications = require('expo-notifications') as typeof import('expo-notifications');
    return Notifications;
  } catch {
    // expo-notifications not available in this runtime
    notificationsUnavailable = true;
    console.warn('[DriveLedger] expo-notifications not available — notifications disabled.');
    return null;
  }
}

// ─── Configuration ──────────────────────────────────────────────────

/**
 * Configure how notifications appear when app is in foreground.
 * Called lazily on first use, not at module load time.
 */
let handlerConfigured = false;

function ensureHandlerConfigured(): void {
  if (handlerConfigured) return;
  const N = getNotifications();
  if (!N) return;

  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    handlerConfigured = true;
  } catch {
    console.warn('[DriveLedger] Failed to configure notification handler.');
  }
}

// ─── Permission ─────────────────────────────────────────────────────

/**
 * Requests notification permissions from the user.
 * @returns true if permission granted
 */
export async function requestNotificationPermission(): Promise<boolean> {
  const N = getNotifications();
  if (!N) return false;

  try {
    if (Platform.OS === 'android') {
      const { status: existingStatus } = await N.getPermissionsAsync();
      if (existingStatus === 'granted') return true;

      const { status } = await N.requestPermissionsAsync();
      return status === 'granted';
    }
  } catch {
    console.warn('[DriveLedger] Notification permission request failed.');
  }
  return false;
}

// ─── Helpers ────────────────────────────────────────────────────────

type NotificationsModule = typeof import('expo-notifications');

/** Fires a notification immediately on the given Android channel. */
function notifyNow(
  N: NotificationsModule,
  channelId: string,
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<string> {
  return N.scheduleNotificationAsync({
    content: { title, body, data },
    trigger: { channelId },
  });
}

/** "1 day" / "3 days" */
function pluralDays(n: number): string {
  return `${n} day${n !== 1 ? 's' : ''}`;
}

// ─── Document Expiry ────────────────────────────────────────────────

async function scheduleDocumentNotifications(
  N: NotificationsModule,
  vehicleId: string
): Promise<void> {
  const docs = documentRepo.getCurrentDocumentsByVehicle(vehicleId);
  const vehicle = vehicleRepo.getVehicleById(vehicleId);
  const vName = vehicle?.nickname ?? 'Vehicle';

  for (const doc of docs) {
    if (!doc.expiry_date) continue;

    const days = daysUntil(doc.expiry_date);
    const label = DOCUMENT_TYPE_LABELS[doc.type as keyof typeof DOCUMENT_TYPE_LABELS] || doc.type;
    const data = { documentId: doc.id, type: 'expiry' };

    // ── PUC Specific High-Priority Workflow (₹10,000 fine warning) ──
    if (doc.type === 'PUC') {
      if (days < 0) {
        await notifyNow(
          N, CHANNEL_DOCUMENT_EXPIRY,
          '🚨 PUC Expired! Immediate ₹10,000 Fine Risk',
          `PUC certificate for ${vName} expired ${pluralDays(Math.abs(days))} ago. Renew immediately at any petrol pump to avoid heavy fines under Sec 190(2).`,
          data
        );
      } else if (days === 1) {
        await notifyNow(
          N, CHANNEL_DOCUMENT_EXPIRY,
          '🚨 PUC Expires Tomorrow! (Avoid ₹10,000 Fine)',
          `Your Pollution Under Control certificate for ${vName} expires tomorrow. Most testing centers take only 5 minutes.`,
          data
        );
      } else if (days <= 7) {
        await notifyNow(
          N, CHANNEL_DOCUMENT_EXPIRY,
          `⚠️ PUC Expiring in ${pluralDays(days)}`,
          `PUC for ${vName} expires in ${pluralDays(days)}. Avoid heavy fines under the Motor Vehicles Act by renewing soon.`,
          data
        );
      } else if (days <= 15) {
        await notifyNow(
          N, CHANNEL_DOCUMENT_EXPIRY,
          '📋 PUC Renewal Window Open (15 Days Left)',
          `PUC for ${vName} expires in ${days} days. Plan a quick test at your next fuel refill.`,
          data
        );
      }
      continue;
    }

    // ── FASTag Specific Workflow ──
    if (doc.type === 'FASTag') {
      if (days < 0) {
        await notifyNow(
          N, CHANNEL_DOCUMENT_EXPIRY,
          '🚨 FASTag Expired / KYC Lapsed',
          `FASTag for ${vName} has expired or needs KYC update. Toll booths charge double cash toll for inactive tags.`,
          data
        );
      } else if (days <= 15) {
        await notifyNow(
          N, CHANNEL_DOCUMENT_EXPIRY,
          '⚠️ FASTag KYC / Validity Notice',
          `FASTag validity or KYC renewal for ${vName} is due in ${pluralDays(days)}. Check your issuing bank portal.`,
          data
        );
      }
      continue;
    }

    // ── Generic Documents (Insurance, RC, Warranty) ──
    if (days < 0) {
      await notifyNow(
        N, CHANNEL_DOCUMENT_EXPIRY,
        `🚨 ${label} Expired!`,
        `Your ${label} for ${vName} expired ${pluralDays(Math.abs(days))} ago. Please renew it immediately.`,
        data
      );
    } else if (days <= 7) {
      await notifyNow(
        N, CHANNEL_DOCUMENT_EXPIRY,
        `⚠️ ${label} Expiring in ${pluralDays(days)}!`,
        `Your ${label} for ${vName} expires in ${pluralDays(days)}. Renew before it lapses!`,
        data
      );

      // Daily 9 AM reminder for the remaining days
      if (days > 0) {
        await N.scheduleNotificationAsync({
          content: {
            title: `📋 ${label} Renewal Reminder`,
            body: `Your ${label} expires in ${pluralDays(days)}. Don't forget to renew!`,
            data: { documentId: doc.id, type: 'expiry_reminder' },
          },
          trigger: {
            type: N.SchedulableTriggerInputTypes.DAILY,
            hour: 9,
            minute: 0,
            channelId: CHANNEL_DOCUMENT_EXPIRY,
          },
        });
      }
    } else if (days <= 30) {
      await notifyNow(
        N, CHANNEL_DOCUMENT_EXPIRY,
        `📋 ${label} Expiry Notice`,
        `Your ${label} for ${vName} expires in ${days} days. Plan to renew it soon.`,
        data
      );
    }
  }
}

// ─── Service Due (Dual-Dimension: Mileage vs. Time) ─────────────────

/**
 * Notifies when service is overdue or approaching based on whichever
 * dimension (Kilometers or Time/Months) breaches threshold first!
 */
async function scheduleServiceNotifications(
  N: NotificationsModule,
  vehicleId: string
): Promise<void> {
  const vehicle = vehicleRepo.getVehicleById(vehicleId);
  const latest = serviceRepo.getLatestServiceRecord(vehicleId);
  if (!vehicle) return;

  const dueStatus = getServiceDueStatus(vehicle, latest);
  const data = { vehicleId, serviceId: latest?.id ?? null, type: 'service_due' };

  if (dueStatus.urgency === 'overdue') {
    await notifyNow(
      N,
      CHANNEL_SERVICE_DUE,
      dueStatus.headline,
      dueStatus.subtext,
      data
    );
  } else if (dueStatus.urgency === 'due_soon') {
    await notifyNow(
      N,
      CHANNEL_SERVICE_DUE,
      dueStatus.headline,
      dueStatus.subtext,
      data
    );
  }
}

// ─── Schedule All Reminders ─────────────────────────────────────────

/**
 * Checks all vehicles' documents and service records, and schedules
 * notifications for anything expired, overdue, or coming due.
 *
 * Call on app launch and whenever vehicles change (from _layout.tsx).
 *
 * @param vehicleIds - Array of active vehicle IDs to check
 */
export async function scheduleReminderNotifications(vehicleIds: string[]): Promise<void> {
  const N = getNotifications();
  if (!N) return;

  ensureHandlerConfigured();

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  try {
    // Cancel previously scheduled notifications to avoid duplicates
    await cancelAllExpiryNotifications();

    for (const vehicleId of vehicleIds) {
      await scheduleDocumentNotifications(N, vehicleId);
      await scheduleServiceNotifications(N, vehicleId);
    }
  } catch (error) {
    console.warn('[DriveLedger] Failed to schedule notifications:', error);
  }
}

// ─── Cancel ─────────────────────────────────────────────────────────

/**
 * Cancels all previously scheduled expiry notifications.
 * Called before re-scheduling to avoid duplicates.
 */
export async function cancelAllExpiryNotifications(): Promise<void> {
  const N = getNotifications();
  if (!N) return;

  try {
    await N.cancelAllScheduledNotificationsAsync();
  } catch {
    console.warn('[DriveLedger] Failed to cancel notifications.');
  }
}

// ─── Setup Android Channel ──────────────────────────────────────────

/**
 * Sets up the Android notification channel.
 * Must be called once before any notifications are scheduled.
 */
export async function setupNotificationChannel(): Promise<void> {
  const N = getNotifications();
  if (!N) return;

  ensureHandlerConfigured();

  try {
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync(CHANNEL_DOCUMENT_EXPIRY, {
        name: 'Document Expiry',
        importance: N.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF9500',
        description: 'Notifications for vehicle document expiry reminders',
      });
      await N.setNotificationChannelAsync(CHANNEL_SERVICE_DUE, {
        name: 'Service Reminders',
        importance: N.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0A84FF',
        description: 'Notifications for upcoming and overdue vehicle services',
      });
    }
  } catch {
    console.warn('[DriveLedger] Failed to set up notification channel.');
  }
}
