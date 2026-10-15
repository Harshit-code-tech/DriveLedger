"use no memo";
import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import * as fuelRepo from '@/database/repositories/fuelRepo';
import * as serviceRepo from '@/database/repositories/serviceRepo';
import * as documentRepo from '@/database/repositories/documentRepo';
import { getServiceDueStatus } from '@/stores/serviceStore';
import { daysUntil } from '@/utils/date';
import {
  VehicleGlanceWidget,
  VehicleGlanceWidgetData,
  DEFAULT_WIDGET_DATA,
} from './VehicleGlanceWidget';

const WIDGET_STORAGE_KEY = 'driveledger_widget_data';
export const WIDGET_NAME = 'VehicleGlanceWidget';

/**
 * Build snapshot data for the active vehicle to render on the widget.
 */
export async function getWidgetDataSnapshot(): Promise<VehicleGlanceWidgetData> {
  try {
    const vehicles = vehicleRepo.getActiveVehicles();
    if (!vehicles || vehicles.length === 0) {
      return DEFAULT_WIDGET_DATA;
    }

    const vehicle = vehicles[0]; // Active vehicle
    const latestFuelEntries = fuelRepo.getFuelEntriesByVehicle(vehicle.id);
    const latestService = serviceRepo.getLatestServiceRecord(vehicle.id);
    const documents = documentRepo.getDocumentsByVehicle(vehicle.id);

    // 1. Calculate Fuel Efficiency
    let fuelEfficiency = 'No fill-ups yet';
    const validEntries = latestFuelEntries.filter((e) => e.calculated_mileage != null);
    if (validEntries.length > 0) {
      const avgMileage =
        validEntries.reduce((sum, e) => sum + (e.calculated_mileage ?? 0), 0) / validEntries.length;
      const unit =
        vehicle.fuel_type === 'cng'
          ? 'km/kg'
          : vehicle.fuel_type === 'ev'
            ? 'km/kWh'
            : 'km/L';
      fuelEfficiency = `Avg: ${avgMileage.toFixed(1)} ${unit}`;
    }

    // 2. Service Due Status
    const dueStatus = getServiceDueStatus(vehicle, latestService);
    let serviceText = 'Service OK';
    let serviceUrgency: 'ok' | 'due_soon' | 'overdue' = 'ok';

    if (dueStatus.urgency === 'overdue') {
      serviceUrgency = 'overdue';
      serviceText = dueStatus.headline.replace('⚠️ ', '').replace('🚨 ', '');
    } else if (dueStatus.urgency === 'due_soon') {
      serviceUrgency = 'due_soon';
      serviceText = dueStatus.headline.replace('⚠️ ', '').replace('🔔 ', '');
    }

    // 3. PUC Expiry Status
    let pucText = 'PUC: Valid';
    const pucDoc = documents.find((d) => d.document_type === 'puc' && !d.superseded_by);
    if (pucDoc?.expiry_date) {
      const days = daysUntil(pucDoc.expiry_date);
      if (days < 0) {
        pucText = `PUC: Expired (${Math.abs(days)}d)`;
      } else if (days <= 30) {
        pucText = `PUC: ${days}d Left`;
      } else {
        pucText = `PUC: Valid (${days}d)`;
      }
    }

    // 4. Status Dot Color
    const statusColor =
      serviceUrgency === 'overdue' || (pucDoc?.expiry_date && daysUntil(pucDoc.expiry_date) < 0)
        ? '#EF4444'
        : serviceUrgency === 'due_soon'
          ? '#F59E0B'
          : '#10B981';

    return {
      vehicleName: vehicle.nickname ?? vehicle.name,
      regNumber: vehicle.registration_number,
      odometer: vehicle.current_odometer,
      fuelEfficiency,
      serviceText,
      serviceUrgency,
      pucText,
      statusColor,
    };
  } catch (error) {
    console.warn('[DriveLedger] Failed to build widget snapshot:', error);
    return DEFAULT_WIDGET_DATA;
  }
}

/**
 * Retrieve saved widget data from storage (useful for headless background tasks)
 */
export async function getCachedWidgetData(): Promise<VehicleGlanceWidgetData> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore read errors
  }
  return DEFAULT_WIDGET_DATA;
}

/**
 * Triggers an immediate refresh of the Android home screen widget.
 * Call this whenever a vehicle, fuel entry, service record, or document is modified.
 */
export async function syncWidgetState(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    const data = await getWidgetDataSnapshot();
    await AsyncStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(data));

    // Dynamic import to prevent crash in non-android or unbuilt environments
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requestWidgetUpdate } = require('react-native-android-widget');
    await requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: () => <VehicleGlanceWidget {...data} />,
    });
  } catch (e) {
    // Non-blocking in Expo Go or if widget is not added to home screen
    console.debug('[DriveLedger] Widget update skipped or not registered:', e);
  }
}
