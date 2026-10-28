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

import { DOCUMENT_TYPE_LABELS } from '@/constants/documentTypes';
import * as documentRepo from '@/database/repositories/documentRepo';
import * as fuelRepo from '@/database/repositories/fuelRepo';
import * as maintCompRepo from '@/database/repositories/maintenanceComponentRepo';
import * as maintProfileRepo from '@/database/repositories/maintenanceProfileRepo';
import * as serviceRepo from '@/database/repositories/serviceRepo';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import {
  DEFAULT_COOLDOWN_DAYS,
  FUEL_NUDGE_COOLDOWN_DAYS,
  isInCooldown,
  shouldSendFuelNudge,
} from '@/services/reminderRules';
import { getPreferences } from '@/stores/preferencesStore';
import { getServiceDueStatus } from '@/stores/serviceStore';
import { daysUntil } from '@/utils/date';
import { dataRevisionTracker } from '@/services/dataRevisionTracker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

const SENT_LOG_KEY = 'driveledger_notification_sent_log';
const CHANNEL_GENERAL = 'general-reminders';

// ─── Constants ──────────────────────────────────────────────────────

const CHANNEL_DOCUMENT_EXPIRY = 'document-expiry';
const CHANNEL_SERVICE_DUE = 'service-due';



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
      const existing = await N.getPermissionsAsync();
      if (existing.granted || (existing as any).status === 'granted') return true;

      const requested = await N.requestPermissionsAsync();
      return Boolean(requested.granted || (requested as any).status === 'granted');
    }
  } catch {
    console.warn('[DriveLedger] Notification permission request failed.');
  }
  return false;
}

// ─── Helpers ────────────────────────────────────────────────────────

type NotificationsModule = typeof import('expo-notifications');

interface ReconciliationContext {
  sentLog: Record<string, number>;
  sentLogChanged: boolean;
}

/**
 * Fires a notification immediately, at most once per cooldown window for the
 * same message (prevents spam when data changes trigger a re-check).
 */
async function notifyNow(
  N: NotificationsModule,
  channelId: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
  cooldownDays: number = DEFAULT_COOLDOWN_DAYS,
  context?: ReconciliationContext
): Promise<string | null> {
  const key = `${channelId}|${title}|${body}`;
  const now = Date.now();
  let log: Record<string, number> = context ? context.sentLog : {};
  if (!context) {
    try {
      const raw = await AsyncStorage.getItem(SENT_LOG_KEY);
      if (raw) log = JSON.parse(raw);
    } catch {
      // ignore — treat as empty log
    }
  }
  if (isInCooldown(log[key], now, cooldownDays)) return null;

  const id = await N.scheduleNotificationAsync({
    content: { title, body, data },
    trigger: { channelId },
  });

  if (context) {
    context.sentLog[key] = now;
    context.sentLogChanged = true;
  } else {
    // Standalone fallback: persist, pruning entries older than 60 days
    const pruned: Record<string, number> = {};
    const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;
    for (const [k, t] of Object.entries(log)) {
      if (t >= sixtyDaysAgo) pruned[k] = t;
    }
    pruned[key] = now;
    try {
      await AsyncStorage.setItem(SENT_LOG_KEY, JSON.stringify(pruned));
    } catch {
      // non-fatal
    }
  }
  return id;
}

/** "1 day" / "3 days" */
function pluralDays(n: number): string {
  return `${n} day${n !== 1 ? 's' : ''}`;
}

// ─── Document Expiry ────────────────────────────────────────────────

async function scheduleDocumentNotifications(
  N: NotificationsModule,
  vehicleId: string,
  context?: ReconciliationContext
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
          data,
          DEFAULT_COOLDOWN_DAYS,
          context
        );
      } else if (days === 1) {
        await notifyNow(
          N, CHANNEL_DOCUMENT_EXPIRY,
          '🚨 PUC Expires Tomorrow! (Avoid ₹10,000 Fine)',
          `Your Pollution Under Control certificate for ${vName} expires tomorrow. Most testing centers take only 5 minutes.`,
          data,
          DEFAULT_COOLDOWN_DAYS,
          context
        );
      } else if (days <= 7) {
        await notifyNow(
          N, CHANNEL_DOCUMENT_EXPIRY,
          `⚠️ PUC Expiring in ${pluralDays(days)}`,
          `PUC for ${vName} expires in ${pluralDays(days)}. Avoid heavy fines under the Motor Vehicles Act by renewing soon.`,
          data,
          DEFAULT_COOLDOWN_DAYS,
          context
        );
      } else if (days <= 15) {
        await notifyNow(
          N, CHANNEL_DOCUMENT_EXPIRY,
          '📋 PUC Renewal Window Open (15 Days Left)',
          `PUC for ${vName} expires in ${days} days. Plan a quick test at your next fuel refill.`,
          data,
          DEFAULT_COOLDOWN_DAYS,
          context
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
          data,
          DEFAULT_COOLDOWN_DAYS,
          context
        );
      } else if (days <= 15) {
        await notifyNow(
          N, CHANNEL_DOCUMENT_EXPIRY,
          '⚠️ FASTag KYC / Validity Notice',
          `FASTag validity or KYC renewal for ${vName} is due in ${pluralDays(days)}. Check your issuing bank portal.`,
          data,
          DEFAULT_COOLDOWN_DAYS,
          context
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
        data,
        DEFAULT_COOLDOWN_DAYS,
        context
      );
    } else if (days <= 7) {
      await notifyNow(
        N, CHANNEL_DOCUMENT_EXPIRY,
        `⚠️ ${label} Expiring in ${pluralDays(days)}!`,
        `Your ${label} for ${vName} expires in ${pluralDays(days)}. Renew before it lapses!`,
        data,
        DEFAULT_COOLDOWN_DAYS,
        context
      );
    } else if (days <= 30) {
      await notifyNow(
        N, CHANNEL_DOCUMENT_EXPIRY,
        `📋 ${label} Expiry Notice`,
        `Your ${label} for ${vName} expires in ${days} days. Plan to renew it soon.`,
        data,
        DEFAULT_COOLDOWN_DAYS,
        context
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
  vehicleId: string,
  includeTargets: boolean = true,
  context?: ReconciliationContext
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
      data,
      DEFAULT_COOLDOWN_DAYS,
      context
    );
  } else if (dueStatus.urgency === 'due_soon') {
    await notifyNow(
      N,
      CHANNEL_SERVICE_DUE,
      dueStatus.headline,
      dueStatus.subtext,
      data,
      DEFAULT_COOLDOWN_DAYS,
      context
    );
  }

  // Check individual component maintenance targets
  try {
    const compHistories = maintCompRepo.getAllComponentHistories(vehicleId);
    for (const [compName, history] of Object.entries(compHistories)) {
      const compDue = maintCompRepo.computeComponentDueStatus(vehicle, compName, history);
      if (compDue.status === 'overdue' || compDue.status === 'due_soon') {
        await notifyNow(
          N,
          CHANNEL_SERVICE_DUE,
          `🔧 ${compDue.headline}`,
          compDue.subtext,
          { vehicleId, componentName: compName, type: 'component_due' },
          DEFAULT_COOLDOWN_DAYS,
          context
        );
      }
    }

    if (includeTargets) {
      // Check custom vehicle maintenance profiles
      const profiles = maintProfileRepo.getMaintenanceProfilesByVehicle(vehicleId);
      for (const profile of profiles) {
        const historyList = compHistories[profile.component_name.trim()];
        const lastHistory = historyList && historyList.length > 0 ? historyList[0] : null;
        const profileDue = maintProfileRepo.computeProfileDueStatus(profile, vehicle, lastHistory);
        if (profileDue.status === 'overdue' || profileDue.status === 'due_soon') {
          await notifyNow(
            N,
            CHANNEL_SERVICE_DUE,
            `🎯 ${profileDue.headline}`,
            profileDue.subtext,
            { vehicleId, profileId: profile.id, type: 'profile_due' },
            DEFAULT_COOLDOWN_DAYS,
            context
          );
        }
      }
    }
  } catch (err) {
    console.warn('[NotificationService] Error checking component due status:', err);
  }
}

// ─── Fuel Logging Nudge ─────────────────────────────────────────────

async function scheduleFuelNudge(
  N: NotificationsModule,
  vehicleId: string,
  context?: ReconciliationContext
): Promise<void> {
  const vehicle = vehicleRepo.getVehicleById(vehicleId);
  if (!vehicle) return;
  const latest = fuelRepo.getLatestFuelEntry(vehicleId);
  const daysSince = latest ? -daysUntil(latest.date) : null;
  if (!shouldSendFuelNudge(daysSince)) return;

  await notifyNow(
    N,
    CHANNEL_GENERAL,
    '⛽ Time to log your fuel?',
    `No fuel logged for ${vehicle.nickname} in ${daysSince} days. Keep your mileage stats accurate.`,
    { vehicleId, type: 'fuel_nudge' },
    FUEL_NUDGE_COOLDOWN_DAYS,
    context
  );
}

// ─── Monthly Summary (repeating, static content) ────────────────────

async function scheduleMonthlySummary(N: NotificationsModule): Promise<void> {
  await N.scheduleNotificationAsync({
    content: {
      title: '📊 Your monthly driving summary is ready',
      body: 'See how much you spent on fuel, service and expenses last month.',
      data: { type: 'monthly_summary' },
    },
    trigger: {
      type: N.SchedulableTriggerInputTypes.MONTHLY,
      day: 1,
      hour: 10,
      minute: 0,
      channelId: CHANNEL_GENERAL,
    },
  });
}

// ─── Reconciliation & Scheduling ──────────────────────────────────────

interface DesiredDocReminder {
  documentId: string;
  vehicleId: string;
  daysRemaining: number;
  title: string;
  body: string;
}

export interface ReconcileNotificationsOptions {
  force?: boolean;
}

let lastReconciledSignature: string | null = null;

export function resetNotificationReconciliationCacheForTesting(): void {
  lastReconciledSignature = null;
}

/**
 * Idempotently reconciles scheduled notifications with current database records.
 *
 * 1. Checks permissions safely without throwing.
 * 2. Fingerprints reminder inputs (date, data revisions, preferences) to skip redundant cycles.
 * 3. Fetches currently scheduled notifications from expo-notifications.
 * 4. Identifies desired daily reminders for active, non-superseded, non-deleted documents expiring in 1..7 days.
 * 5. Identifies desired monthly driving summary.
 * 6. Cancels obsolete, renewed, deleted, or duplicate scheduled notifications.
 * 7. Schedules any missing desired notifications.
 * 8. Dispatches any immediate (cooldown-guarded) alerts with a single-batch sent-log read/write.
 */
export async function reconcileNotifications(
  injectedN?: NotificationsModule | null,
  options?: ReconcileNotificationsOptions
): Promise<void> {
  const N = injectedN ?? getNotifications();
  if (!N) return;

  if (!injectedN) {
    ensureHandlerConfigured();
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) return;
  }

  try {
    const prefs = getPreferences();
    if (!prefs.notificationsEnabled) {
      lastReconciledSignature = null;
      await N.cancelAllScheduledNotificationsAsync();
      return;
    }

    // Fingerprint reconciliation inputs to skip redundant passes
    const todayKey = new Date().toISOString().split('T')[0];
    const revisionsKey = dataRevisionTracker.getRevisionsKey([
      'vehicles',
      'documents',
      'services',
      'maintenanceProfiles',
      'fuel',
    ]);
    const prefsKey = `${prefs.notifyDocumentExpiry}|${prefs.notifyServiceDue}|${prefs.notifyMaintenanceTargets}|${prefs.docExpiryLeadDays}`;
    const currentSignature = `${todayKey}_${revisionsKey}_${prefsKey}`;

    if (!injectedN && !options?.force && currentSignature === lastReconciledSignature) {
      return;
    }

    const activeVehicles = vehicleRepo.getActiveVehicles();

    // 1. Determine desired scheduled notifications for documents
    const desiredReminders = new Map<string, DesiredDocReminder>();

    if (prefs.notifyDocumentExpiry) {
      for (const vehicle of activeVehicles) {
        const docs = documentRepo.getCurrentDocumentsByVehicle(vehicle.id);
        for (const doc of docs) {
          if (!doc.expiry_date) continue;
          const days = daysUntil(doc.expiry_date);
          // Daily 9 AM renewal reminder for documents expiring in 1..7 days
          if (days >= 1 && days <= Math.min(prefs.docExpiryLeadDays, 7)) {
            const label = DOCUMENT_TYPE_LABELS[doc.type as keyof typeof DOCUMENT_TYPE_LABELS] || doc.type;
            desiredReminders.set(doc.id, {
              documentId: doc.id,
              vehicleId: vehicle.id,
              daysRemaining: days,
              title: `📋 ${label} Renewal Reminder`,
              body: `Your ${label} for ${vehicle.nickname} expires in ${pluralDays(days)}. Don't forget to renew!`,
            });
          }
        }
      }
    }

    // 2. Fetch existing scheduled notifications from OS
    const scheduledList = (await N.getAllScheduledNotificationsAsync()) || [];
    let monthlySummaryScheduled = false;
    const satisfiedDocReminders = new Set<string>();

    for (const req of scheduledList) {
      const data = (req.content?.data || {}) as Record<string, unknown>;
      const notifType = data.type as string | undefined;

      if (notifType === 'monthly_summary') {
        if (monthlySummaryScheduled) {
          try {
            await N.cancelScheduledNotificationAsync(req.identifier);
          } catch (e) {
            console.warn('[DriveLedger] Error cancelling duplicate monthly summary:', e);
          }
        } else {
          monthlySummaryScheduled = true;
        }
      } else if (notifType === 'expiry_reminder') {
        const docId = data.documentId as string | undefined;
        const desired = docId ? desiredReminders.get(docId) : undefined;

        if (!desired || satisfiedDocReminders.has(docId!)) {
          // Document was deleted, renewed, moved out of window, or duplicate -> cancel
          try {
            await N.cancelScheduledNotificationAsync(req.identifier);
          } catch (e) {
            console.warn('[DriveLedger] Error cancelling obsolete reminder:', e);
          }
        } else {
          // Check if daysRemaining matches and title matches
          if (data.daysRemaining === desired.daysRemaining && req.content?.title === desired.title) {
            satisfiedDocReminders.add(docId!);
          } else {
            // Content or days changed -> cancel old so fresh one gets scheduled below
            try {
              await N.cancelScheduledNotificationAsync(req.identifier);
            } catch (e) {
              console.warn('[DriveLedger] Error cancelling outdated reminder:', e);
            }
          }
        }
      }
    }

    // 3. Schedule missing desired document reminders
    for (const [docId, desired] of desiredReminders.entries()) {
      if (satisfiedDocReminders.has(docId)) continue;

      try {
        await N.scheduleNotificationAsync({
          content: {
            title: desired.title,
            body: desired.body,
            data: {
              documentId: desired.documentId,
              vehicleId: desired.vehicleId,
              daysRemaining: desired.daysRemaining,
              type: 'expiry_reminder',
            },
          },
          trigger: {
            type: N.SchedulableTriggerInputTypes.DAILY,
            hour: 9,
            minute: 0,
            channelId: CHANNEL_DOCUMENT_EXPIRY,
          },
        });
      } catch (err) {
        console.warn(`[DriveLedger] Failed to schedule reminder for doc ${docId}:`, err);
      }
    }

    // 4. Ensure monthly summary is scheduled exactly once
    if (!monthlySummaryScheduled) {
      try {
        await scheduleMonthlySummary(N);
      } catch (err) {
        console.warn('[DriveLedger] Failed to schedule monthly summary:', err);
      }
    }

    // 5. Fire any immediate notifications (cooldown-guarded) for documents, services, and fuel
    // Sent-log read once per cycle
    let sentLog: Record<string, number> = {};
    try {
      const raw = await AsyncStorage.getItem(SENT_LOG_KEY);
      if (raw) sentLog = JSON.parse(raw);
    } catch {
      // ignore
    }
    const context: ReconciliationContext = { sentLog, sentLogChanged: false };

    for (const vehicle of activeVehicles) {
      if (prefs.notifyDocumentExpiry) {
        await scheduleDocumentNotifications(N, vehicle.id, context);
      }
      if (prefs.notifyServiceDue) {
        await scheduleServiceNotifications(N, vehicle.id, prefs.notifyMaintenanceTargets, context);
      }
      await scheduleFuelNudge(N, vehicle.id, context);
    }

    // Sent-log written once only when notifications were dispatched
    if (context.sentLogChanged) {
      const now = Date.now();
      const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;
      const pruned: Record<string, number> = {};
      for (const [k, t] of Object.entries(context.sentLog)) {
        if (t >= sixtyDaysAgo) pruned[k] = t;
      }
      try {
        await AsyncStorage.setItem(SENT_LOG_KEY, JSON.stringify(pruned));
      } catch {
        // non-fatal
      }
    }

    lastReconciledSignature = currentSignature;
  } catch (error) {
    console.warn('[DriveLedger] reconcileNotifications encountered an error:', error);
  }
}

/**
 * Checks all vehicles' documents and service records, and reconciles
 * notifications for anything expired, overdue, or coming due.
 *
 * Backwards compatible with existing call sites.
 *
 * @param _vehicleIds - Optional array of active vehicle IDs (ignored; queries active vehicles from repo)
 * @param options - Optional reconciliation options (e.g. force: true)
 */
export async function scheduleReminderNotifications(
  _vehicleIds?: string[],
  options?: ReconcileNotificationsOptions
): Promise<void> {
  await reconcileNotifications(undefined, options);
}

// ─── Refresh (called after data changes) ────────────────────────────

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Re-evaluates reminders for all active vehicles. Debounced so rapid
 * store mutations result in a single re-check. Safe to call anywhere.
 */
export function refreshReminders(options?: ReconcileNotificationsOptions): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void reconcileNotifications(undefined, options);
  }, 1000);
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
      await N.setNotificationChannelAsync(CHANNEL_GENERAL, {
        name: 'General Reminders',
        importance: N.AndroidImportance.DEFAULT,
        description: 'Fuel logging nudges and monthly summaries',
      });
    }
  } catch {
    console.warn('[DriveLedger] Failed to set up notification channel.');
  }
}

