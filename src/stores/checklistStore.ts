/**
 * Pre-Trip Highway Checklist Store (Zustand + AsyncStorage)
 *
 * Feature 4.3: Pre-Trip Road Trip Inspection Checklist.
 * Allows Indian highway drivers to run a pilot-style pre-flight checklist
 * covering tyre pressures, fluids, stepney, PUC compliance, and FASTag.
 *
 * KEY ATTRIBUTES:
 * - 100% Offline & Private
 * - Vehicle-adaptive: Customizes items for Cars, Bikes, Scooters, and EVs
 * - Auto-verifies PUC status from DriveLedger's saved documents
 * - Persists checkmark state per vehicle via AsyncStorage
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Vehicle } from '@/types/vehicle';
import type { VehicleDocument } from '@/types/document';
import { DocumentType } from '@/constants/documentTypes';
import { FuelType, VehicleType } from '@/constants/fuelTypes';

export type ChecklistCategory = 'tyres' | 'fluids' | 'compliance' | 'safety';

export interface ChecklistItem {
  id: string;
  category: ChecklistCategory;
  title: string;
  subtitle: string;
  tip?: string;
  badge?: string;
  badgeType?: 'success' | 'warning' | 'danger' | 'info';
  checked: boolean;
}

interface ChecklistState {
  /** Map of vehicleId -> Set of checked item IDs */
  checkedItemsByVehicle: Record<string, string[]>;
  isLoaded: boolean;

  /** Load saved checkmarks from AsyncStorage */
  loadChecklist: (vehicleId: string) => Promise<void>;
  /** Toggle an item's checked state */
  toggleItem: (vehicleId: string, itemId: string) => Promise<void>;
  /** Reset all checkmarks for a fresh trip */
  resetChecklist: (vehicleId: string) => Promise<void>;
}

const STORAGE_PREFIX = '@driveledger_checklist_';

export const useChecklistStore = create<ChecklistState>((set, get) => ({
  checkedItemsByVehicle: {},
  isLoaded: false,

  loadChecklist: async (vehicleId: string) => {
    try {
      const raw = await AsyncStorage.getItem(`${STORAGE_PREFIX}${vehicleId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          set((state) => ({
            checkedItemsByVehicle: {
              ...state.checkedItemsByVehicle,
              [vehicleId]: parsed,
            },
            isLoaded: true,
          }));
          return;
        }
      }
      set((state) => ({
        checkedItemsByVehicle: {
          ...state.checkedItemsByVehicle,
          [vehicleId]: state.checkedItemsByVehicle[vehicleId] ?? [],
        },
        isLoaded: true,
      }));
    } catch {
      set({ isLoaded: true });
    }
  },

  toggleItem: async (vehicleId: string, itemId: string) => {
    const current = get().checkedItemsByVehicle[vehicleId] ?? [];
    const updated = current.includes(itemId)
      ? current.filter((id) => id !== itemId)
      : [...current, itemId];

    set((state) => ({
      checkedItemsByVehicle: {
        ...state.checkedItemsByVehicle,
        [vehicleId]: updated,
      },
    }));

    try {
      await AsyncStorage.setItem(`${STORAGE_PREFIX}${vehicleId}`, JSON.stringify(updated));
    } catch {
      // Ignore storage failure
    }
  },

  resetChecklist: async (vehicleId: string) => {
    set((state) => ({
      checkedItemsByVehicle: {
        ...state.checkedItemsByVehicle,
        [vehicleId]: [],
      },
    }));

    try {
      await AsyncStorage.removeItem(`${STORAGE_PREFIX}${vehicleId}`);
    } catch {
      // Ignore storage failure
    }
  },
}));

// ── Pure Helper Functions ──────────────────────────────────────────

/**
 * Builds the customized list of pre-trip inspection items for a given vehicle,
 * factoring in vehicle type (Car vs. Bike), powertrain (ICE vs. EV),
 * recommended tyre pressures, and DriveLedger's documents.
 */
export function buildPreTripChecklist(
  vehicle: Vehicle,
  documents: VehicleDocument[],
  checkedItemIds: string[] = []
): ChecklistItem[] {
  const isChecked = (id: string) => checkedItemIds.includes(id);
  const isBike = vehicle.vehicle_type === VehicleType.TWO_WHEELER;
  const isEV = vehicle.fuel_type === FuelType.ELECTRIC;

  const items: ChecklistItem[] = [];

  // ── 1. Tyres & Wheels ──
  const frontPsi = vehicle.front_tyre_pressure ?? (isBike ? 28 : 32);
  const rearPsi = vehicle.rear_tyre_pressure ?? (isBike ? 32 : 35);

  items.push({
    id: 'front_tyre',
    category: 'tyres',
    title: `Front Tyre Pressure: ${frontPsi} PSI`,
    subtitle: 'Check cold tyre pressure before starting the highway drive.',
    tip: 'High-speed highway friction heats up tyres, raising pressure by ~3 PSI naturally. Never bleed hot tyres!',
    checked: isChecked('front_tyre'),
  });

  items.push({
    id: 'rear_tyre',
    category: 'tyres',
    title: `Rear Tyre Pressure: ${rearPsi} PSI`,
    subtitle: isBike ? 'Pillion rider? Bump rear pressure +2 PSI.' : 'Car full with luggage? Check door jamb sticker.',
    tip: 'Under-inflated tyres account for >70% of high-speed tyre blowouts on Indian expressways.',
    checked: isChecked('rear_tyre'),
  });

  if (!isBike) {
    items.push({
      id: 'spare_wheel',
      category: 'tyres',
      title: 'Spare Wheel (Stepney) Pressure',
      subtitle: `Inflate Stepney to ${rearPsi + 2} PSI (+2 PSI over normal).`,
      tip: 'Spare tyres slowly bleed pressure over months in the boot. Check before leaving!',
      checked: isChecked('spare_wheel'),
    });

    items.push({
      id: 'jack_tools',
      category: 'tyres',
      title: 'Jack, Wheel Spanner & Warning Triangle',
      subtitle: 'Ensure jack handle & wheel spanner fit your lug nuts.',
      tip: 'If your car has anti-theft wheel locks, ensure the special key adapter is inside.',
      checked: isChecked('jack_tools'),
    });
  } else {
    items.push({
      id: 'chain_brakes',
      category: 'tyres',
      title: 'Drive Chain Slack & Brake Lever Play',
      subtitle: 'Chain slack should be 20-30mm; lubricate with gear oil/spray.',
      tip: 'Clean chain with cleaner or kerosene before applying lube for highway endurance.',
      checked: isChecked('chain_brakes'),
    });
  }

  // ── 2. Under the Bonnet / Powertrain ──
  if (!isEV) {
    items.push({
      id: 'engine_oil',
      category: 'fluids',
      title: 'Engine Oil Dipstick Level',
      subtitle: 'Park on level ground, pull dipstick, wipe, re-dip. Oil must be between MIN & MAX.',
      tip: 'Low engine oil at 100-120 km/h expressway cruising speeds can cause catastrophic engine seizure.',
      checked: isChecked('engine_oil'),
    });

    items.push({
      id: 'coolant',
      category: 'fluids',
      title: 'Coolant Reservoir Level',
      subtitle: 'Check translucent tank. Coolant should be near the MAX line.',
      tip: '⚠️ CAUTION: Never open the pressurized radiator cap when the engine is hot!',
      checked: isChecked('coolant'),
    });

    if (!isBike) {
      items.push({
        id: 'washer_fluid',
        category: 'fluids',
        title: 'Windshield Washer Fluid & Wiper Condition',
        subtitle: 'Fill washer bottle with water + windshield shampoo concentrate.',
        tip: 'Essential for instantly clearing highway bug splatters and sudden monsoon downpours.',
        checked: isChecked('washer_fluid'),
      });
    }
  } else {
    // EV Specific Checks
    items.push({
      id: 'charging_cable',
      category: 'fluids',
      title: '15A Portable Charging Cable & Extension',
      subtitle: 'Pack OEM trickle charger & 16A 3-pin heavy duty extension cord.',
      tip: 'Lifesaver for emergency overnight top-ups at highway dhabas, hotels, or homestays.',
      checked: isChecked('charging_cable'),
    });

    items.push({
      id: 'battery_charge',
      category: 'fluids',
      title: 'Battery Charged to 95%+ & Tyre Rolling Drag',
      subtitle: 'Start with full charge and pre-cool cabin while plugged into AC charger.',
      tip: 'Cabin pre-cooling while plugged in saves ~4-5% battery range for the first 30 km.',
      checked: isChecked('battery_charge'),
    });
  }

  // ── 3. Compliance & Highway Tolls ──
  // Check DriveLedger's saved PUC document
  const pucDoc = documents.find(
    (d) => d.type === DocumentType.PUC && !d.deleted_at
  );

  if (pucDoc?.expiry_date) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expDate = new Date(pucDoc.expiry_date);
    const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) {
      items.push({
        id: 'puc_validity',
        category: 'compliance',
        title: 'PUC Certificate: EXPIRED!',
        subtitle: `Expired ${Math.abs(daysLeft)} days ago (${pucDoc.expiry_date}).`,
        tip: '🚨 ₹10,000 fine under Sec 190(2) MV Act! Renew at any petrol pump PUC center before highway toll booths.',
        badge: 'Expired (₹10k Fine)',
        badgeType: 'danger',
        checked: isChecked('puc_validity'),
      });
    } else if (daysLeft <= 15) {
      items.push({
        id: 'puc_validity',
        category: 'compliance',
        title: `PUC Certificate: Expires in ${daysLeft} days`,
        subtitle: `Valid until ${pucDoc.expiry_date}.`,
        tip: 'Renew before leaving if your trip will last past the expiry date.',
        badge: `${daysLeft}d left`,
        badgeType: 'warning',
        checked: isChecked('puc_validity'),
      });
    } else {
      items.push({
        id: 'puc_validity',
        category: 'compliance',
        title: 'PUC Certificate: Valid ✅',
        subtitle: `Valid until ${pucDoc.expiry_date} (Auto-verified from documents).`,
        tip: 'Digital copy in DriveLedger / mParivahan is legally valid under IT Act 2000.',
        badge: 'Valid',
        badgeType: 'success',
        checked: isChecked('puc_validity'),
      });
    }
  } else {
    items.push({
      id: 'puc_validity',
      category: 'compliance',
      title: 'PUC Certificate Validity Checked',
      subtitle: 'Ensure you have an active Pollution Certificate in the glovebox or mParivahan.',
      tip: 'Mandatory on all national highways. Expired PUC carries ₹10,000 fine in Delhi/NCR and major states.',
      badge: 'Verify',
      badgeType: 'warning',
      checked: isChecked('puc_validity'),
    });
  }

  // FASTag
  items.push({
    id: 'fastag_recharge',
    category: 'compliance',
    title: 'FASTag Balance Recharged (Min ₹300-500)',
    subtitle: 'Check issuing bank wallet balance (Paytm, ICICI, IDFC, SBI, etc.).',
    tip: 'Low balance or blacklisted tag results in double (2x) cash toll penalty at NHAI toll lanes.',
    checked: isChecked('fastag_recharge'),
  });

  // Safety / Kit
  items.push({
    id: 'safety_first_aid',
    category: 'safety',
    title: isBike ? 'Helmet Visor Cleaned & Rain Gear Stowed' : 'First Aid Kit & Torch / Power Bank',
    subtitle: isBike ? 'Clear scratches/bugs; ensure chin strap locking mechanism works.' : 'Ensure basic bandages, antiseptic, pain relievers, and USB charging cables.',
    tip: 'Indian highway night driving requires spotless glass/visor to prevent blinding oncoming high-beam glare.',
    checked: isChecked('safety_first_aid'),
  });

  return items;
}

/**
 * Calculates completion stats for the checklist
 */
export function getChecklistStats(items: ChecklistItem[]) {
  const total = items.length;
  const completed = items.filter((i) => i.checked).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isComplete = total > 0 && completed === total;

  return { total, completed, percent, isComplete };
}
