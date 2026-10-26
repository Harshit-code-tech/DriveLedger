"use no memo";
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import * as fuelRepo from '@/database/repositories/fuelRepo';
import * as serviceRepo from '@/database/repositories/serviceRepo';
import * as expenseRepo from '@/database/repositories/expenseRepo';
import * as documentRepo from '@/database/repositories/documentRepo';
import { getServiceDueStatus } from '@/stores/serviceStore';
import { getPreferences } from '@/stores/preferencesStore';
import { daysUntil } from '@/utils/date';
import { MILEAGE_UNIT_LABELS } from '@/constants/fuelTypes';
import { DocumentType } from '@/constants/documentTypes';
import {
  VehicleGlanceWidget,
  VehicleGlanceWidgetData,
  DEFAULT_WIDGET_DATA,
} from './VehicleGlanceWidget';
import {
  GpsCockpitWidget,
  GpsCockpitCompactWidget,
  GpsCockpitWidgetData,
  DEFAULT_GPS_WIDGET_DATA,
} from './GpsCockpitWidget';
export { GpsCockpitWidget, GpsCockpitCompactWidget, GpsCockpitWidgetData, DEFAULT_GPS_WIDGET_DATA };
import { buildPreTripChecklist, getChecklistStats } from '@/stores/checklistStore';
import * as tripRepo from '@/database/repositories/tripRepo';

const WIDGET_STORAGE_KEY = 'driveledger_widget_data_v2';
export const WIDGET_NAME = 'VehicleGlanceWidget';
export const WIDGET_VEHICLE_KEY = 'driveledger_widget_vehicle_id';

export const GPS_WIDGET_STORAGE_KEY = 'driveledger_gps_widget_data_v1';
export const GPS_WIDGET_NAME = 'GpsCockpitWidget';
export const GPS_COMPACT_WIDGET_NAME = 'GpsCockpitCompactWidget';

const WIDGET_SYNC_DEBOUNCE_MS = 1000;
let widgetSyncPromise: Promise<void> | null = null;
let gpsWidgetSyncPromise: Promise<void> | null = null;

import { getNextVehicleId } from '@/services/tripCoordinatorService';

export { getNextVehicleId };

/** Cycles the widget to the next active vehicle and persists the choice. */
export async function cycleWidgetVehicle(): Promise<void> {
  try {
    const vehicles = vehicleRepo.getActiveVehicles();
    if (!vehicles || vehicles.length < 2) return;
    const storedId = await AsyncStorage.getItem(WIDGET_VEHICLE_KEY);
    const { defaultVehicleId } = getPreferences();
    const currentId = storedId ?? defaultVehicleId ?? vehicles[0].id;
    const nextId = getNextVehicleId(vehicles, currentId);
    if (nextId) {
      await AsyncStorage.setItem(WIDGET_VEHICLE_KEY, String(nextId));
    }
  } catch (e) {
    console.warn('[DriveLedger] Failed to cycle widget vehicle:', e);
  }
}

// ─── Currency formatting (no i18n deps) ──────────────────────────────────────

const INR_SYMBOL = '\u20B9'; // ₹

function formatAmount(amount: number): string {
  if (amount >= 100_000) return `${INR_SYMBOL}${(amount / 100_000).toFixed(1)}L`;
  if (amount >= 1_000)   return `${INR_SYMBOL}${(amount / 1_000).toFixed(1)}K`;
  return `${INR_SYMBOL}${Math.round(amount)}`;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function shortDateLabel(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return '—';
  }
}

function currentYearMonth(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${m}`;
}

// ─── Snapshot builder ─────────────────────────────────────────────────────────

/**
 * Builds a complete widget data snapshot from the active vehicle's SQLite records.
 *
 * Improvements over v1:
 *   - Correctly uses last fill mileage + running average (not a plain mean)
 *   - Uses MILEAGE_UNIT_LABELS for the correct unit per fuel type
 *   - Adds tyre pressure (front/rear PSI)
 *   - Adds monthly spend (fuel + service + expenses in current calendar month)
 *   - Adds insurance document urgency (separate from PUC)
 *   - Correct status dot: worst urgency across all alerts
 *   - Last fill-up date shown in header
 */
export async function getWidgetDataSnapshot(): Promise<VehicleGlanceWidgetData> {
  try {
    const vehicles = vehicleRepo.getActiveVehicles();
    if (!vehicles || vehicles.length === 0) {
      return DEFAULT_WIDGET_DATA;
    }

    const storedId = await AsyncStorage.getItem(WIDGET_VEHICLE_KEY);
    const { defaultVehicleId } = getPreferences();
    const vehicle = (storedId ? vehicles.find((v) => String(v.id) === storedId) : null)
      ?? vehicles.find((v) => v.id === defaultVehicleId)
      ?? vehicles[0];
    const vehicleCount = vehicles.length;

    // ── Fuel entries ──────────────────────────────────────────────────────────
    const allEntries = fuelRepo.getFuelEntriesByVehicle(vehicle.id);
    const validMileageEntries = allEntries.filter((e) => e.calculated_mileage != null);

    // Last fill mileage: most recent entry with a calculated mileage
    let lastFillMileage = '—';
    let runningAvgMileage = 'No data';
    let lastFillDate = '—';

    if (allEntries.length > 0) {
      const latest = allEntries[0]; // getFuelEntriesByVehicle returns DESC
      lastFillDate = shortDateLabel(latest.date);

      if (latest.calculated_mileage && latest.mileage_unit) {
        const label = MILEAGE_UNIT_LABELS[latest.mileage_unit] ?? latest.mileage_unit;
        lastFillMileage = `${latest.calculated_mileage.toFixed(1)} ${label}`;
      } else if (validMileageEntries.length > 0) {
        // Latest has no mileage (e.g. partial fill) — find the most recent that does
        const lastWithMileage = validMileageEntries[0];
        const label = MILEAGE_UNIT_LABELS[lastWithMileage.mileage_unit!] ?? lastWithMileage.mileage_unit!;
        lastFillMileage = `~${lastWithMileage.calculated_mileage!.toFixed(1)} ${label}`;
      }
    }

    if (validMileageEntries.length > 0) {
      const avg = validMileageEntries.reduce((s, e) => s + (e.calculated_mileage ?? 0), 0) / validMileageEntries.length;
      // Determine unit from most recent valid entry
      const unit = validMileageEntries[0].mileage_unit
        ? (MILEAGE_UNIT_LABELS[validMileageEntries[0].mileage_unit] ?? validMileageEntries[0].mileage_unit)
        : 'km/L';
      runningAvgMileage = `Avg ${avg.toFixed(1)} ${unit}`;
    }

    // ── Monthly Spend ─────────────────────────────────────────────────────────
    const yearMonth = currentYearMonth();

    // Fuel cost this month
    const monthlyFuel = allEntries
      .filter((e) => e.date.startsWith(yearMonth))
      .reduce((s, e) => s + (e.total_cost ?? 0), 0);

    // Expense cost this month (getMonthlyExpenseTotal is available in expenseRepo)
    const monthlyExpense = expenseRepo.getMonthlyExpenseTotal(vehicle.id, yearMonth);

    // Service cost this month
    const svcRecords = serviceRepo.getServiceRecordsByVehicle(vehicle.id);
    const monthlySvc = svcRecords
      .filter((r) => r.date.startsWith(yearMonth))
      .reduce((s, r) => s + (r.cost ?? 0), 0);

    const totalMonthlySpend = monthlyFuel + monthlyExpense + monthlySvc;
    const monthlySpend = `${formatAmount(totalMonthlySpend)} this month`;

    // ── Tyre Pressure ─────────────────────────────────────────────────────────
    const tyrePressFront = vehicle.front_tyre_pressure ?? null;
    const tyrePressRear  = vehicle.rear_tyre_pressure ?? null;

    // ── Service Due ───────────────────────────────────────────────────────────
    const latestService = serviceRepo.getLatestServiceRecord(vehicle.id);
    const dueStatus = getServiceDueStatus(vehicle, latestService);
    let serviceText = 'Service OK';
    let serviceUrgency: 'ok' | 'due_soon' | 'overdue' = 'ok';

    if (dueStatus.urgency === 'overdue') {
      serviceUrgency = 'overdue';
      serviceText = dueStatus.headline
        .replace('⚠️ ', '').replace('🚨 ', '').replace('🔴 ', '');
    } else if (dueStatus.urgency === 'due_soon') {
      serviceUrgency = 'due_soon';
      serviceText = dueStatus.headline
        .replace('⚠️ ', '').replace('🔔 ', '').replace('🟡 ', '');
    }

    // ── Documents: PUC & Insurance ────────────────────────────────────────────
    const documents = documentRepo.getAllDocumentsByVehicle(vehicle.id);
    const activeDocOf = (type: DocumentType) =>
      documents.find((d) => d.type === type && !d.superseded_by);

    // PUC
    const pucDoc = activeDocOf(DocumentType.PUC);
    const pucDays = pucDoc?.expiry_date ? daysUntil(pucDoc.expiry_date) : null;
    let pucText: string;
    let pucUrgency: 'ok' | 'due_soon' | 'expired' | 'not_set';
    if (!pucDoc) {
      pucText = 'PUC: Not Set';
      pucUrgency = 'not_set';
    } else if (pucDays === null) {
      pucText = 'PUC: No Expiry';
      pucUrgency = 'ok';
    } else if (pucDays < 0) {
      pucText = `PUC: Expired ${Math.abs(pucDays)}d ago`;
      pucUrgency = 'expired';
    } else if (pucDays === 0) {
      pucText = 'PUC: Expires today!';
      pucUrgency = 'expired';
    } else if (pucDays <= 7) {
      pucText = `PUC: ${pucDays}d left ⚠️`;
      pucUrgency = 'due_soon';
    } else if (pucDays <= 30) {
      pucText = `PUC: ${pucDays}d left`;
      pucUrgency = 'due_soon';
    } else {
      pucText = `PUC: ${pucDays}d`;
      pucUrgency = 'ok';
    }

    // Insurance
    const insDoc = activeDocOf(DocumentType.INSURANCE);
    const insDays = insDoc?.expiry_date ? daysUntil(insDoc.expiry_date) : null;
    let insuranceText: string;
    let insuranceUrgency: 'ok' | 'due_soon' | 'expired' | 'not_set';
    if (!insDoc) {
      insuranceText = 'Ins: Not Set';
      insuranceUrgency = 'not_set';
    } else if (insDays === null) {
      insuranceText = 'Ins: No Expiry';
      insuranceUrgency = 'ok';
    } else if (insDays < 0) {
      insuranceText = 'Ins: Expired!';
      insuranceUrgency = 'expired';
    } else if (insDays === 0) {
      insuranceText = 'Ins: Expires today!';
      insuranceUrgency = 'expired';
    } else if (insDays <= 7) {
      insuranceText = `Ins: ${insDays}d left ⚠️`;
      insuranceUrgency = 'due_soon';
    } else if (insDays <= 30) {
      insuranceText = `Ins: ${insDays}d left`;
      insuranceUrgency = 'due_soon';
    } else {
      insuranceText = `Ins: ${insDays}d`;
      insuranceUrgency = 'ok';
    }

    // ── Status Dot ────────────────────────────────────────────────────────────
    // Red if anything is expired/overdue; amber if anything is due_soon; green otherwise.
    // 'not_set' does NOT trigger amber/red — it's informational only.
    const allUrgencies = [serviceUrgency, pucUrgency, insuranceUrgency];
    const statusColor =
      allUrgencies.some((u) => u === 'overdue' || u === 'expired')
        ? '#EF4444'
        : allUrgencies.some((u) => u === 'due_soon')
          ? '#F59E0B'
          : '#10B981';

    return {
      vehicleId:        vehicle.id,
      vehicleName:      vehicle.nickname,
      regNumber:        vehicle.registration_number,
      fuelType:         vehicle.fuel_type,
      odometer:         vehicle.current_odometer ?? 0,
      lastFillMileage,
      runningAvgMileage,
      lastFillDate,
      monthlySpend,
      tyrePressFront,
      tyrePressRear,
      serviceText,
      serviceUrgency,
      pucText,
      pucUrgency,
      insuranceText,
      insuranceUrgency,
      statusColor,
      vehicleCount,
    };
  } catch (error) {
    console.warn('[DriveLedger] Failed to build widget snapshot:', error);
    return DEFAULT_WIDGET_DATA;
  }
}

// ─── AsyncStorage cache ───────────────────────────────────────────────────────

/**
 * Retrieve saved widget data from AsyncStorage.
 * Used by the background headless task handler when SQLite may not be ready.
 */
export async function getCachedWidgetData(): Promise<VehicleGlanceWidgetData> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as VehicleGlanceWidgetData;
  } catch {
    // Ignore read errors — fall through to default
  }
  return DEFAULT_WIDGET_DATA;
}

// ─── Main sync function ───────────────────────────────────────────────────────

/**
 * Builds a fresh snapshot and pushes it to the Android home screen widget.
 *
 * Call this from any store action that modifies vehicle data, fuel entries,
 * service records, expenses, or documents.
 *
 * Android-only guard: returns immediately on other platforms.
 * Non-blocking: never throws — errors are logged at debug level.
 */
async function performWidgetSync(): Promise<void> {
  if (Platform.OS !== 'android') return;

  // Re-evaluate reminders whenever vehicle/fuel/service/document data changes.
  // Lazy require: notificationService imports serviceStore, which imports this file.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/services/notificationService').refreshReminders();
  } catch (e) {
    console.debug('[DriveLedger] Reminder refresh skipped:', e);
  }

  try {
    const data = await getWidgetDataSnapshot();

    // Persist for background task handler
    await AsyncStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(data));

    // Request native Android widget bitmap render & update
    try {
      // Dynamic import prevents crashes in web / iOS / environments without native module
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { requestWidgetUpdate } = require('react-native-android-widget');
      if (typeof requestWidgetUpdate === 'function') {
        await requestWidgetUpdate({
          widgetName: WIDGET_NAME,
          renderWidget: () => <VehicleGlanceWidget {...data} />,
        });
      }
    } catch (widgetErr) {
      console.debug('[DriveLedger] Native widget update skipped:', widgetErr);
    }
  } catch (e) {
    // Non-blocking if widget is not pinned to home screen or snapshot building failed
    console.debug('[DriveLedger] Widget sync skipped or not registered:', e);
  }
}

export function syncWidgetState(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  if (widgetSyncPromise) return widgetSyncPromise;

  widgetSyncPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      void performWidgetSync().finally(() => {
        widgetSyncPromise = null;
        resolve();
      });
    }, WIDGET_SYNC_DEBOUNCE_MS);
  });

  return widgetSyncPromise;
}

// ─── GPS Cockpit Widget Snapshot & Sync ───────────────────────────────────────

/**
 * Builds a real-time GPS telemetry snapshot from SQLite.
 * Reflects whether a trip is actively recording, paused, or idle.
 */
export async function getGpsWidgetDataSnapshot(): Promise<GpsCockpitWidgetData> {
  try {
    const vehicles = vehicleRepo.getActiveVehicles();
    if (!vehicles || vehicles.length === 0) {
      return DEFAULT_GPS_WIDGET_DATA;
    }

    const activeTrip = tripRepo.getActiveTrip();
    const vehicleCount = vehicles.length;

    // ── 1. ACTIVE OR PAUSED TRIP MODE ──
    if (activeTrip && (activeTrip.status === 'recording' || activeTrip.status === 'paused')) {
      const activeVehicle =
        vehicles.find((v) => String(v.id) === String(activeTrip.vehicle_id)) ?? vehicles[0];

      // Calculate elapsed time
      let elapsedSeconds = activeTrip.duration_seconds || 0;
      if (activeTrip.start_time) {
        const startMs = new Date(activeTrip.start_time).getTime();
        if (!isNaN(startMs)) {
          elapsedSeconds = Math.max(elapsedSeconds, Math.floor((Date.now() - startMs) / 1000));
        }
      }

      const hrs = Math.floor(elapsedSeconds / 3600);
      const mins = Math.floor((elapsedSeconds % 3600) / 60);
      const secs = elapsedSeconds % 60;
      const pad = (n: number) => n.toString().padStart(2, '0');
      const formattedElapsed =
        hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;

      // Derive telemetry from recorded locations
      let speedKmh = 0;
      let accuracyMeters: number | null = null;
      let gpsQuality: 'good' | 'fair' | 'poor' | 'none' = 'none';

      try {
        const latest = tripRepo.getLatestAcceptedTripLocation(activeTrip.id);
        if (latest) {
          if (typeof latest.speed === 'number' && latest.speed >= 0) {
            speedKmh = Math.round(latest.speed * 3.6);
          }
          if (typeof latest.accuracy === 'number' && latest.accuracy > 0) {
            accuracyMeters = latest.accuracy;
            gpsQuality = latest.accuracy <= 15 ? 'good' : latest.accuracy <= 35 ? 'fair' : 'poor';
          }
        }
      } catch (locErr) {
        console.debug('[DriveLedger] Error reading locations for GPS widget telemetry:', locErr);
      }

      // If trip is paused, zero out speed
      if (activeTrip.status === 'paused') {
        speedKmh = 0;
      }

      let hasGapWarning = false;
      if (activeTrip.diagnostics) {
        try {
          const parsed = JSON.parse(activeTrip.diagnostics);
          if (parsed?.has_gap_warning) {
            hasGapWarning = true;
          }
        } catch {}
      }

      // Format trip start time as HH:MM for the REC badge
      let tripStartTime: string | null = null;
      if (activeTrip.start_time) {
        try {
          const d = new Date(activeTrip.start_time);
          if (!isNaN(d.getTime())) {
            tripStartTime = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
          }
        } catch {}
      }

      return {
        recordingState: activeTrip.status as 'recording' | 'paused',
        tripId: activeTrip.id,
        vehicleId: activeVehicle.id,
        vehicleName: activeVehicle.nickname,
        regNumber: activeVehicle.registration_number,
        fuelType: activeVehicle.fuel_type,
        vehicleType: activeVehicle.vehicle_type,
        vehicleCount,
        speedKmh,
        distanceKm: activeTrip.distance_km || 0,
        elapsedSeconds,
        formattedElapsed,
        sampleCount: activeTrip.sample_count || 0,
        gpsQuality,
        accuracyMeters,
        hasGapWarning,
        tripStartTime,
        currentOdometer: activeVehicle.current_odometer ?? 0,
        lastTripDistanceKm: null,
        lastTripDuration: null,
      };
    }

    // ── 2. IDLE / PRE-FLIGHT LAUNCHER MODE ──
    const storedId = await AsyncStorage.getItem(WIDGET_VEHICLE_KEY);
    const { defaultVehicleId } = getPreferences();
    const vehicle =
      (storedId ? vehicles.find((v) => String(v.id) === storedId) : null) ??
      vehicles.find((v) => v.id === defaultVehicleId) ??
      vehicles[0];

    // Last trip summary
    let lastTripDistanceKm: number | null = null;
    let lastTripDuration: string | null = null;
    try {
      const trips = tripRepo.getTripsByVehicle(vehicle.id);
      if (trips && trips.length > 0) {
        const last = trips[0];
        lastTripDistanceKm = last.distance_km;
        const mins = Math.round((last.duration_seconds || 0) / 60);
        lastTripDuration = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
      }
    } catch (tripErr) {
      console.debug('[DriveLedger] Error reading trips for GPS widget idle recap:', tripErr);
    }

    // Highway Checklist Readiness
    let checklistSummary = 'Ready ✅';
    let highwayChecklistReady = true;
    try {
      const docs = documentRepo.getAllDocumentsByVehicle(vehicle.id);
      const rawChecked = await AsyncStorage.getItem(`@driveledger_checklist_${vehicle.id}`);
      const checkedIds = rawChecked ? JSON.parse(rawChecked) : [];
      const items = buildPreTripChecklist(vehicle, docs, checkedIds);
      const stats = getChecklistStats(items);
      checklistSummary = stats.isComplete ? 'Ready ✅' : `${stats.completed}/${stats.total} Checked`;
      highwayChecklistReady = stats.isComplete;
    } catch (checkErr) {
      console.debug('[DriveLedger] Error reading checklist for GPS widget idle recap:', checkErr);
    }

    return {
      recordingState: 'idle',
      vehicleId: vehicle.id,
      vehicleName: vehicle.nickname,
      regNumber: vehicle.registration_number,
      fuelType: vehicle.fuel_type,
      vehicleType: vehicle.vehicle_type,
      vehicleCount,
      speedKmh: 0,
      distanceKm: 0,
      elapsedSeconds: 0,
      formattedElapsed: '00:00',
      sampleCount: 0,
      gpsQuality: 'none',
      accuracyMeters: null,
      hasGapWarning: false,
      tripStartTime: null,
      currentOdometer: vehicle.current_odometer ?? 0,
      lastTripDistanceKm,
      lastTripDuration,
      highwayChecklistReady,
      checklistSummary,
    };
  } catch (error) {
    console.warn('[DriveLedger] Failed to build GPS widget snapshot:', error);
    return DEFAULT_GPS_WIDGET_DATA;
  }
}

/**
 * Retrieve saved GPS widget data from AsyncStorage.
 * Used by background headless task handler if SQLite is not available.
 */
export async function getCachedGpsWidgetData(): Promise<GpsCockpitWidgetData> {
  try {
    const raw = await AsyncStorage.getItem(GPS_WIDGET_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as GpsCockpitWidgetData;
  } catch {}
  return DEFAULT_GPS_WIDGET_DATA;
}

/**
 * Builds a fresh GPS snapshot and pushes it to the Android GpsCockpitWidget.
 *
 * Android-only guard: returns immediately on other platforms.
 * Non-blocking: never throws.
 */
async function performGpsWidgetSync(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    const data = await getGpsWidgetDataSnapshot();
    await AsyncStorage.setItem(GPS_WIDGET_STORAGE_KEY, JSON.stringify(data));

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { requestWidgetUpdate } = require('react-native-android-widget');
      if (typeof requestWidgetUpdate === 'function') {
        // Push to both 4×2 hero and 4×1 compact widget simultaneously
        await Promise.allSettled([
          requestWidgetUpdate({
            widgetName: GPS_WIDGET_NAME,
            renderWidget: () => <GpsCockpitWidget {...data} />,
          }),
          requestWidgetUpdate({
            widgetName: GPS_COMPACT_WIDGET_NAME,
            renderWidget: () => <GpsCockpitCompactWidget {...data} />,
          }),
        ]);
      }
    } catch (widgetErr) {
      console.debug('[DriveLedger] Native GPS widget update skipped:', widgetErr);
    }
  } catch (e) {
    console.debug('[DriveLedger] GPS Widget sync skipped or not registered:', e);
  }
}

export function syncGpsWidgetState(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  if (gpsWidgetSyncPromise) return gpsWidgetSyncPromise;

  gpsWidgetSyncPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      void performGpsWidgetSync().finally(() => {
        gpsWidgetSyncPromise = null;
        resolve();
      });
    }, WIDGET_SYNC_DEBOUNCE_MS);
  });

  return gpsWidgetSyncPromise;
}

/**
 * Pushes updates to all registered Android widgets (VehicleGlance + GPSCockpit).
 */
export async function syncAllWidgets(): Promise<void> {
  await Promise.allSettled([syncWidgetState(), syncGpsWidgetState()]);
}
