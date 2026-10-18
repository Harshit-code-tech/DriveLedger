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
import { daysUntil } from '@/utils/date';
import { MILEAGE_UNIT_LABELS } from '@/constants/fuelTypes';
import { DocumentType } from '@/constants/documentTypes';
import type { FuelType } from '@/constants/fuelTypes';
import {
  VehicleGlanceWidget,
  VehicleGlanceWidgetData,
  DEFAULT_WIDGET_DATA,
} from './VehicleGlanceWidget';

const WIDGET_STORAGE_KEY = 'driveledger_widget_data_v2';
export const WIDGET_NAME = 'VehicleGlanceWidget';

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
  if (days === null) return 'ok';
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

    const vehicle = vehicles[0]; // Active (first) vehicle
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
    let pucText = 'PUC: Valid';
    if (pucDays !== null) {
      if (pucDays < 0)    pucText = `PUC: Expired ${Math.abs(pucDays)}d ago`;
      else if (pucDays === 0) pucText = 'PUC: Expires today!';
      else if (pucDays <= 30) pucText = `PUC: ${pucDays}d left`;
      else                pucText = `PUC: ${pucDays}d`;
    }
    const pucUrgency = docUrgency(pucDays);

    // Insurance
    const insDoc = activeDocOf(DocumentType.INSURANCE);
    const insDays = insDoc?.expiry_date ? daysUntil(insDoc.expiry_date) : null;
    let insuranceText = 'Insurance: OK';
    if (insDays !== null) {
      if (insDays < 0)     insuranceText = `Ins: Expired!`;
      else if (insDays === 0) insuranceText = 'Ins: Expires today!';
      else if (insDays <= 30) insuranceText = `Ins: ${insDays}d left`;
      else                 insuranceText = `Ins: ${insDays}d`;
    }
    const insuranceUrgency = docUrgency(insDays);

    // ── Status Dot ────────────────────────────────────────────────────────────
    // Red if anything is expired/overdue; amber if anything is due_soon; green otherwise
    const allUrgencies = [serviceUrgency, pucUrgency, insuranceUrgency];
    const statusColor =
      allUrgencies.some((u) => u === 'overdue' || u === 'expired')
        ? '#EF4444'
        : allUrgencies.some((u) => u === 'due_soon')
          ? '#F59E0B'
          : '#10B981';

    return {
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

  try {
    const data = await getWidgetDataSnapshot();

    // Persist for background task handler
    await AsyncStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(data));

    // Dynamic import prevents crashes in Expo Go / web / iOS
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requestWidgetUpdate } = require('react-native-android-widget');
    await requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: () => <VehicleGlanceWidget {...data} />,
    });
  } catch (e) {
    // Non-blocking in Expo Go or if widget is not pinned to home screen
    console.debug('[DriveLedger] Widget update skipped or not registered:', e);
  }
}
