/**
 * Preferences Store (Zustand + AsyncStorage)
 *
 * Persists user preferences across app restarts.
 *
 * Charter preferences:
 *   - currency:       INR default
 *   - distanceUnit:   km default
 *   - fuelVolumeUnit: litres default
 *   - pressureUnit:   PSI default
 *   - defaultVehicleId: first added vehicle
 *
 * PATTERN:
 *   loadPreferences() called once on app launch from _layout.tsx.
 *   All setters persist immediately via AsyncStorage.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- Types ---

export type CurrencyCode    = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'SGD';
export type DistanceUnit    = 'km' | 'miles';
export type FuelVolumeUnit  = 'litres' | 'gallons';
export type PressureUnit    = 'PSI' | 'bar' | 'kPa';
export type GpsTrackingProfile = 'high_accuracy' | 'balanced' | 'battery_saver';

export interface Preferences {
  currency: CurrencyCode;
  distanceUnit: DistanceUnit;
  fuelVolumeUnit: FuelVolumeUnit;
  pressureUnit: PressureUnit;
  gpsTrackingProfile: GpsTrackingProfile;
  defaultVehicleId: string | null;
  hasCompletedOnboarding: boolean;
  notificationsEnabled: boolean;
  notifyDocumentExpiry: boolean;
  notifyServiceDue: boolean;
  notifyMaintenanceTargets: boolean;
  docExpiryLeadDays: number;
}

// --- Options for UI pickers ---

export const CURRENCY_OPTIONS: { value: CurrencyCode; label: string; symbol: string }[] = [
  { value: 'INR', label: 'Indian Rupee', symbol: 'Rs.' },
  { value: 'USD', label: 'US Dollar',    symbol: '$'   },
  { value: 'EUR', label: 'Euro',          symbol: 'E'  },
  { value: 'GBP', label: 'British Pound', symbol: 'P'  },
  { value: 'AED', label: 'UAE Dirham',   symbol: 'AED' },
  { value: 'SGD', label: 'Singapore $',  symbol: 'S$'  },
];

export const DISTANCE_OPTIONS: { value: DistanceUnit; label: string }[] = [
  { value: 'km',    label: 'Kilometres (km)' },
  { value: 'miles', label: 'Miles (mi)'      },
];

export const FUEL_VOLUME_OPTIONS: { value: FuelVolumeUnit; label: string }[] = [
  { value: 'litres',  label: 'Litres (L)'     },
  { value: 'gallons', label: 'Gallons (gal)'  },
];

export const PRESSURE_OPTIONS: { value: PressureUnit; label: string }[] = [
  { value: 'PSI', label: 'PSI'        },
  { value: 'bar', label: 'Bar'        },
  { value: 'kPa', label: 'kPa'        },
];

export const GPS_TRACKING_PROFILE_OPTIONS: { value: GpsTrackingProfile; label: string }[] = [
  { value: 'high_accuracy', label: 'High accuracy (more battery)' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'battery_saver', label: 'Battery saver (less frequent updates)' },
];

export const DOC_LEAD_DAYS_OPTIONS: { value: string; label: string }[] = [
  { value: '7', label: '7 days before expiry' },
  { value: '15', label: '15 days before expiry' },
  { value: '30', label: '30 days before expiry (Recommended)' },
  { value: '45', label: '45 days before expiry' },
];

// --- Storage keys ---

const KEYS = {
  currency:                 'pref_currency',
  distanceUnit:             'pref_distance_unit',
  fuelVolumeUnit:           'pref_fuel_volume_unit',
  pressureUnit:             'pref_pressure_unit',
  gpsTrackingProfile:       'pref_gps_tracking_profile',
  defaultVehicleId:         'pref_default_vehicle_id',
  hasCompletedOnboarding:   'pref_has_completed_onboarding',
  notificationsEnabled:     'pref_notifications_enabled',
  notifyDocumentExpiry:     'pref_notify_doc_expiry',
  notifyServiceDue:         'pref_notify_service_due',
  notifyMaintenanceTargets: 'pref_notify_maint_targets',
  docExpiryLeadDays:        'pref_doc_expiry_lead_days',
} as const;

const DEFAULTS: Preferences = {
  currency: 'INR',
  distanceUnit: 'km',
  fuelVolumeUnit: 'litres',
  pressureUnit: 'PSI',
  gpsTrackingProfile: 'high_accuracy',
  defaultVehicleId: null,
  hasCompletedOnboarding: false,
  notificationsEnabled: true,
  notifyDocumentExpiry: true,
  notifyServiceDue: true,
  notifyMaintenanceTargets: true,
  docExpiryLeadDays: 30,
};

// --- Store ---

interface PreferencesState extends Preferences {
  isLoaded: boolean;
  loadPreferences:            () => Promise<void>;
  setCurrency:                (v: CurrencyCode)   => Promise<void>;
  setDistanceUnit:            (v: DistanceUnit)   => Promise<void>;
  setFuelVolumeUnit:          (v: FuelVolumeUnit) => Promise<void>;
  setPressureUnit:            (v: PressureUnit)   => Promise<void>;
  setGpsTrackingProfile:      (v: GpsTrackingProfile) => Promise<void>;
  setDefaultVehicleId:        (v: string | null)  => Promise<void>;
  setHasCompletedOnboarding:  (v: boolean)        => Promise<void>;
  setNotificationsEnabled:    (v: boolean)        => Promise<void>;
  setNotifyDocumentExpiry:    (v: boolean)        => Promise<void>;
  setNotifyServiceDue:        (v: boolean)        => Promise<void>;
  setNotifyMaintenanceTargets:(v: boolean)        => Promise<void>;
  setDocExpiryLeadDays:       (v: number)         => Promise<void>;
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  ...DEFAULTS,
  isLoaded: false,

  loadPreferences: async () => {
    try {
      const pairs = await AsyncStorage.multiGet([
        KEYS.currency,
        KEYS.distanceUnit,
        KEYS.fuelVolumeUnit,
        KEYS.pressureUnit,
        KEYS.gpsTrackingProfile,
        KEYS.defaultVehicleId,
        KEYS.hasCompletedOnboarding,
        KEYS.notificationsEnabled,
        KEYS.notifyDocumentExpiry,
        KEYS.notifyServiceDue,
        KEYS.notifyMaintenanceTargets,
        KEYS.docExpiryLeadDays,
      ]);
      const [
        currency,
        distanceUnit,
        fuelVolumeUnit,
        pressureUnit,
        gpsTrackingProfile,
        defaultVehicleId,
        onboarding,
        notifEnabled,
        notifDoc,
        notifService,
        notifMaint,
        docLeadDays,
      ] = pairs;
      set({
        currency:                 (currency[1]        as CurrencyCode)   ?? DEFAULTS.currency,
        distanceUnit:             (distanceUnit[1]     as DistanceUnit)   ?? DEFAULTS.distanceUnit,
        fuelVolumeUnit:           (fuelVolumeUnit[1]   as FuelVolumeUnit) ?? DEFAULTS.fuelVolumeUnit,
        pressureUnit:             (pressureUnit[1]     as PressureUnit)   ?? DEFAULTS.pressureUnit,
        gpsTrackingProfile:       (gpsTrackingProfile[1] as GpsTrackingProfile) ?? DEFAULTS.gpsTrackingProfile,
        defaultVehicleId:         defaultVehicleId[1] ?? null,
        hasCompletedOnboarding:   onboarding[1] === 'true',
        notificationsEnabled:     notifEnabled[1] !== 'false',
        notifyDocumentExpiry:     notifDoc[1] !== 'false',
        notifyServiceDue:         notifService[1] !== 'false',
        notifyMaintenanceTargets: notifMaint[1] !== 'false',
        docExpiryLeadDays:        docLeadDays[1] ? parseInt(docLeadDays[1], 10) : DEFAULTS.docExpiryLeadDays,
        isLoaded: true,
      });
    } catch {
      set({ ...DEFAULTS, isLoaded: true });
    }
  },

  setCurrency:        async (v) => { await AsyncStorage.setItem(KEYS.currency, v);       set({ currency: v });       },
  setDistanceUnit:    async (v) => { await AsyncStorage.setItem(KEYS.distanceUnit, v);   set({ distanceUnit: v });   },
  setFuelVolumeUnit:  async (v) => { await AsyncStorage.setItem(KEYS.fuelVolumeUnit, v); set({ fuelVolumeUnit: v }); },
  setPressureUnit:    async (v) => { await AsyncStorage.setItem(KEYS.pressureUnit, v);   set({ pressureUnit: v });   },
  setGpsTrackingProfile: async (v) => {
    await AsyncStorage.setItem(KEYS.gpsTrackingProfile, v);
    set({ gpsTrackingProfile: v });
  },
  setDefaultVehicleId: async (v) => {
    if (v === null) { await AsyncStorage.removeItem(KEYS.defaultVehicleId); }
    else            { await AsyncStorage.setItem(KEYS.defaultVehicleId, v); }
    set({ defaultVehicleId: v });
  },
  setHasCompletedOnboarding: async (v) => {
    await AsyncStorage.setItem(KEYS.hasCompletedOnboarding, String(v));
    set({ hasCompletedOnboarding: v });
  },
  setNotificationsEnabled: async (v) => {
    await AsyncStorage.setItem(KEYS.notificationsEnabled, String(v));
    set({ notificationsEnabled: v });
  },
  setNotifyDocumentExpiry: async (v) => {
    await AsyncStorage.setItem(KEYS.notifyDocumentExpiry, String(v));
    set({ notifyDocumentExpiry: v });
  },
  setNotifyServiceDue: async (v) => {
    await AsyncStorage.setItem(KEYS.notifyServiceDue, String(v));
    set({ notifyServiceDue: v });
  },
  setNotifyMaintenanceTargets: async (v) => {
    await AsyncStorage.setItem(KEYS.notifyMaintenanceTargets, String(v));
    set({ notifyMaintenanceTargets: v });
  },
  setDocExpiryLeadDays: async (v) => {
    await AsyncStorage.setItem(KEYS.docExpiryLeadDays, String(v));
    set({ docExpiryLeadDays: v });
  },
}));

// --- Convenience getters (for use outside React components) ---

export function getPreferences(): Preferences {
  return usePreferencesStore.getState();
}

export function getCurrencySymbol(): string {
  const { currency } = getPreferences();
  return CURRENCY_OPTIONS.find((o) => o.value === currency)?.symbol ?? 'Rs.';
}

export function getDistanceLabel(): string {
  return getPreferences().distanceUnit === 'km' ? 'km' : 'mi';
}

export function convertDistance(km: number): number {
  return getPreferences().distanceUnit === 'miles' ? km * 0.621371 : km;
}

export function convertPressure(psi: number): number {
  switch (getPreferences().pressureUnit) {
    case 'bar': return +(psi * 0.0689476).toFixed(2);
    case 'kPa': return +(psi * 6.89476).toFixed(1);
    default:    return psi;
  }
}

export function getPressureLabel(): string {
  return getPreferences().pressureUnit;
}
