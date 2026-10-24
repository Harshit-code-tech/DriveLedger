"use no memo";
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';

const isExpoGo = isRunningInExpoGo();
import * as fuelRepo from '@/database/repositories/fuelRepo';
import * as serviceRepo from '@/database/repositories/serviceRepo';
import * as expenseRepo from '@/database/repositories/expenseRepo';
import * as documentRepo from '@/database/repositories/documentRepo';
import { getServiceDueStatus } from '@/stores/serviceStore';
import { getPreferences } from '@/stores/preferencesStore';
import { daysUntil } from '@/utils/date';
import { MILEAGE_UNIT_LABELS } from '@/constants/fuelTypes';
import { DocumentType } from '@/constants/documentTypes';
import type { FuelType } from '@/constants/fuelTypes';
import {
  VehicleGlanceWidget,
  VehicleGlanceWidgetData,
  DEFAULT_WIDGET_DATA,
} from './VehicleGlanceWidget';
import {
  GpsTripWidget,
  GpsTripWidgetData,
  DEFAULT_GPS_WIDGET_DATA,
} from './GpsTripWidget';
import * as tripRepo from '@/database/repositories/tripRepo';
import { getDatabase } from '@/database/connection';

const WIDGET_STORAGE_KEY = 'driveledger_widget_data_v2';
export const WIDGET_NAME = 'VehicleGlanceWidget';
export const WIDGET_VEHICLE_KEY = 'driveledger_widget_vehicle_id';

export const GPS_WIDGET_NAME = 'GpsTripWidget';
export const GPS_WIDGET_STORAGE_KEY = 'driveledger_gps_widget_data_v1';

import { getNextVehicleId } from '@/services/tripCoordinatorService';
import type { Trip } from '@/types/trip';

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

// ─── Urgency helper ───────────────────────────────────────────────────────────

function docUrgency(days: number | null): 'ok' | 'due_soon' | 'expired' {
  if (days === null) return 'ok'; // Caller handles null (not_set) separately
  if (days < 0)  return 'expired';
  if (days <= 30) return 'due_soon';
  return 'ok';
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
    const fuelType = vehicle.fuel_type as FuelType;

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
export async function syncWidgetState(): Promise<void> {
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

// ─── GPS Trip Widget Helpers ──────────────────────────────────────────────────

function formatWidgetDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

/**
 * Builds a snapshot for GpsTripWidget reflecting the true shared trip lifecycle.
 * - Recording / Paused: live metrics from SQLite or active session
 * - Interrupted: clear notification to recover
 * - Idle: last completed trip summary or ready prompt
 */
export async function getGpsWidgetDataSnapshot(): Promise<GpsTripWidgetData> {
  try {
    const vehicles = vehicleRepo.getActiveVehicles();
    const vehicleCount = vehicles?.length ?? 0;

    let storedId: string | null = null;
    try {
      storedId = await AsyncStorage.getItem(WIDGET_VEHICLE_KEY);
    } catch {
      // Graceful fallback if storage is uninitialized in headless environments
    }

    if (!vehicles || vehicles.length === 0) {
      return {
        ...DEFAULT_GPS_WIDGET_DATA,
        vehicleId: '',
        vehicleName: 'No Vehicles',
        nextVehicleId: '',
        nextVehicleName: 'No Vehicles',
        status: 'no_vehicles',
        statusText: 'NO VEHICLES',
        vehicleCount: 0,
      };
    }

    const { defaultVehicleId } = getPreferences();
    const nextVehicle =
      (storedId ? vehicles.find((v) => String(v.id) === storedId) : null) ??
      vehicles.find((v) => v.id === defaultVehicleId) ??
      vehicles[0];

    // Single global active GPS session check (across ALL vehicles, not just selected)
    const activeTrip = tripRepo.getActiveTrip();
    if (activeTrip) {
      const activeVehicle =
        vehicles.find((v) => v.id === activeTrip.vehicle_id) ?? {
          id: activeTrip.vehicle_id,
          nickname: 'Vehicle',
          registration_number: '',
          manufacturer: '',
          model: '',
        };

      let elapsedSeconds = activeTrip.duration_seconds || 0;
      if (activeTrip.status === 'recording' && activeTrip.start_time) {
        const startMs = new Date(activeTrip.start_time).getTime();
        if (!isNaN(startMs)) {
          elapsedSeconds = Math.max(
            elapsedSeconds,
            Math.floor((Date.now() - startMs) / 1000)
          );
        }
      }

      let startTimeFormatted = '—';
      if (activeTrip.start_time) {
        try {
          const d = new Date(activeTrip.start_time);
          startTimeFormatted = d.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });
        } catch {}
      }

      const activeVehicleName =
        activeVehicle.nickname ||
        `${activeVehicle.manufacturer ?? ''} ${activeVehicle.model ?? ''}`.trim() ||
        'Vehicle';

      const nextVehicleName =
        nextVehicle.nickname ||
        `${nextVehicle.manufacturer ?? ''} ${nextVehicle.model ?? ''}`.trim() ||
        'Vehicle';

      return {
        vehicleId: activeVehicle.id,
        vehicleName: activeVehicleName,
        regNumber: activeVehicle.registration_number || '',
        nextVehicleId: nextVehicle.id,
        nextVehicleName,
        tripId: activeTrip.id,
        status: activeTrip.status as 'recording' | 'paused',
        statusText: activeTrip.status.toUpperCase(),
        currentDistanceKm: activeTrip.distance_km || 0,
        currentDurationFormatted: formatWidgetDuration(elapsedSeconds),
        startTimeFormatted,
        hasLastTrip: false,
        lastTripDate: '—',
        lastTripDistanceKm: 0,
        lastTripDurationFormatted: '—',
        gpsQuality: 'good',
        warningText: activeTrip.quality_warning,
        vehicleCount,
        interactionNonce: `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      };
    }

    // No active trip. Query latest overall non-discarded trip across the database
    const db = getDatabase();
    let latestTrip: Trip | null = null;
    try {
      latestTrip = db.getFirstSync<Trip>(
        "SELECT * FROM trips WHERE deleted_at IS NULL AND status != 'discarded' ORDER BY start_time DESC LIMIT 1"
      );
    } catch {}

    const nextVehicleName =
      nextVehicle.nickname ||
      `${nextVehicle.manufacturer ?? ''} ${nextVehicle.model ?? ''}`.trim() ||
      'Vehicle';

    // Only classify as interrupted if the latest overall trip was genuinely interrupted
    // (a newer completed trip overrides older interrupted trips)
    if (latestTrip && latestTrip.status === 'interrupted') {
      const interruptedVehicle = vehicles.find((v) => v.id === latestTrip?.vehicle_id);
      return {
        vehicleId: interruptedVehicle?.id ?? nextVehicle.id,
        vehicleName: interruptedVehicle?.nickname ?? nextVehicleName,
        regNumber: interruptedVehicle?.registration_number ?? nextVehicle.registration_number ?? '',
        nextVehicleId: nextVehicle.id,
        nextVehicleName,
        tripId: latestTrip.id,
        status: 'interrupted',
        statusText: 'INTERRUPTED',
        currentDistanceKm: latestTrip.distance_km || 0,
        currentDurationFormatted: formatWidgetDuration(latestTrip.duration_seconds || 0),
        startTimeFormatted: '—',
        hasLastTrip: false,
        lastTripDate: '—',
        lastTripDistanceKm: 0,
        lastTripDurationFormatted: '—',
        gpsQuality: 'none',
        warningText: latestTrip.quality_warning || 'Session interrupted unexpectedly',
        vehicleCount,
        interactionNonce: `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      };
    }

    // Idle state: Query latest completed trip (for nextVehicle or overall)
    let hasLastTrip = false;
    let lastTripDate = '—';
    let lastTripDistanceKm = 0;
    let lastTripDurationFormatted = '—';

    // Check latest completed trip strictly for the selected vehicle
    const vehicleTrips = tripRepo.getTripsByVehicle(nextVehicle.id);
    const vehicleCompleted = vehicleTrips.find((t) => t.status === 'completed');

    if (vehicleCompleted) {
      hasLastTrip = true;
      lastTripDate = shortDateLabel(vehicleCompleted.start_time);
      lastTripDistanceKm = vehicleCompleted.distance_km || 0;
      lastTripDurationFormatted = formatWidgetDuration(vehicleCompleted.duration_seconds || 0);
    }

    return {
      vehicleId: nextVehicle.id,
      vehicleName: nextVehicleName,
      regNumber: nextVehicle.registration_number || '',
      nextVehicleId: nextVehicle.id,
      nextVehicleName,
      status: 'idle',
      statusText: 'READY',
      currentDistanceKm: 0,
      currentDurationFormatted: '0m',
      startTimeFormatted: '—',
      hasLastTrip,
      lastTripDate,
      lastTripDistanceKm,
      lastTripDurationFormatted,
      gpsQuality: 'none',
      warningText: null,
      vehicleCount,
      interactionNonce: `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
    };
  } catch (err) {
    console.warn('[DriveLedger] Failed to build GPS widget snapshot:', err);
    return DEFAULT_GPS_WIDGET_DATA;
  }
}

export async function getCachedGpsWidgetData(): Promise<GpsTripWidgetData | null> {
  try {
    const raw = await AsyncStorage.getItem(GPS_WIDGET_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as GpsTripWidgetData;
  } catch {}
  return null;
}

/**
 * Pushes updated GPS trip state to the dedicated GpsTripWidget.
 */
export async function syncGpsWidgetState(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    const data = await getGpsWidgetDataSnapshot();
    await AsyncStorage.setItem(GPS_WIDGET_STORAGE_KEY, JSON.stringify(data));

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { requestWidgetUpdate } = require('react-native-android-widget');
      if (typeof requestWidgetUpdate === 'function') {
        await requestWidgetUpdate({
          widgetName: GPS_WIDGET_NAME,
          renderWidget: () => <GpsTripWidget {...data} />,
        });
      }
    } catch (widgetErr) {
      console.debug('[DriveLedger] Native GPS widget update skipped:', widgetErr);
    }
  } catch (e) {
    console.debug('[DriveLedger] GPS Widget sync skipped or not registered:', e);
  }
}

