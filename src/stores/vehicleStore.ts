/**
 * Vehicle Store (Zustand)
 *
 * Global state for vehicle data. Connects the UI layer to the
 * repository layer (database).
 *
 * WHY Zustand?
 * - Lightweight (~1KB), no boilerplate (unlike Redux).
 * - Components subscribe to specific slices → no unnecessary re-renders.
 * - Works perfectly with synchronous expo-sqlite calls.
 *
 * PATTERN:
 * - State lives here.
 * - Actions call repository functions then update state.
 * - UI components read state via hooks and call actions.
 */

import { create } from 'zustand';
import { Platform } from 'react-native';
import type { Vehicle, CreateVehicleInput, UpdateVehicleInput } from '@/types/vehicle';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import { getPreferences, usePreferencesStore } from '@/stores/preferencesStore';
import { syncWidgetState } from '@/widgets/widgetDataService';
import { storeRegistry } from '@/stores/storeRegistry';

interface VehicleState {
  /** All active (non-archived) vehicles */
  vehicles: Vehicle[];
  /** Currently selected vehicle (for dashboard, fuel entry, etc.) */
  selectedVehicle: Vehicle | null;
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Error message if something fails */
  error: string | null;

  // ── Actions ──
  /** Load all active vehicles from the database */
  loadVehicles: () => void;
  /** Select a vehicle (sets it as the active dashboard vehicle) */
  selectVehicle: (vehicleId: string) => void;
  /** Create a new vehicle */
  addVehicle: (input: CreateVehicleInput) => Vehicle;
  /** Update an existing vehicle */
  editVehicle: (id: string, input: UpdateVehicleInput) => Vehicle | null;
  /** Archive a vehicle (hide from active list) */
  archiveVehicle: (id: string) => void;
  /** Restore an archived vehicle */
  restoreVehicle: (id: string) => void;
}

export const useVehicleStore = create<VehicleState>((set, get) => ({
  vehicles: [],
  selectedVehicle: null,
  isLoading: true,
  error: null,

  loadVehicles: () => {
    // Register this action with the cross-store registry on every call.
    // Safe to call multiple times — the registry overwrites with the same fn.
    storeRegistry.registerRefreshVehicles(() => useVehicleStore.getState().loadVehicles());

    try {
      const vehicles = vehicleRepo.getActiveVehicles();
      const currentSelected = get().selectedVehicle;
      const { defaultVehicleId } = getPreferences();

      let selected: Vehicle | null = currentSelected;

      if (!selected && vehicles.length > 0) {
        // On first load: honour the user's preferred default vehicle, fall back to first
        selected = vehicles.find((v) => v.id === defaultVehicleId) ?? vehicles[0];
      } else if (selected) {
        // Refresh selected vehicle data in case it was edited; fallback to default if removed
        selected = vehicles.find((v) => v.id === selected!.id)
          ?? vehicles.find((v) => v.id === defaultVehicleId)
          ?? vehicles[0]
          ?? null;
      }

      set({ vehicles, selectedVehicle: selected, isLoading: false, error: null });
    } catch (e) {
      set({ isLoading: false, error: 'Failed to load vehicles.' });
    }
  },

  selectVehicle: (vehicleId: string) => {
    const vehicle = get().vehicles.find((v) => v.id === vehicleId) ?? null;
    set({ selectedVehicle: vehicle });
    if (Platform.OS === 'android') {
      syncWidgetState();
    }
  },

  addVehicle: (input: CreateVehicleInput) => {
    const newVehicle = vehicleRepo.createVehicle(input);
    const vehicles = vehicleRepo.getActiveVehicles();

    // If this is the first vehicle, auto-select it
    const selected = get().selectedVehicle ?? newVehicle;

    set({ vehicles, selectedVehicle: selected });
    if (Platform.OS === 'android') syncWidgetState();
    return newVehicle;
  },

  editVehicle: (id: string, input: UpdateVehicleInput) => {
    const updated = vehicleRepo.updateVehicle(id, input);
    if (updated) {
      const vehicles = vehicleRepo.getActiveVehicles();
      const currentSelected = get().selectedVehicle;
      const selected = currentSelected?.id === id ? updated : currentSelected;
      set({ vehicles, selectedVehicle: selected });
      if (Platform.OS === 'android') syncWidgetState();
    }
    return updated;
  },

  archiveVehicle: (id: string) => {
    vehicleRepo.archiveVehicle(id);
    const vehicles = vehicleRepo.getActiveVehicles();
    const currentSelected = get().selectedVehicle;
    const { defaultVehicleId, setDefaultVehicleId } = usePreferencesStore.getState();

    // If the archived vehicle was the default, reset default preference to null (auto first-added)
    if (defaultVehicleId === id) {
      void setDefaultVehicleId(null);
    }

    // If the archived vehicle was selected, switch to default or first available
    const selected = currentSelected?.id === id
      ? (vehicles.find((v) => v.id === defaultVehicleId) ?? vehicles[0] ?? null)
      : currentSelected;

    set({ vehicles, selectedVehicle: selected });
    if (Platform.OS === 'android') syncWidgetState();
  },

  restoreVehicle: (id: string) => {
    vehicleRepo.restoreVehicle(id);
    get().loadVehicles();
  },
}));
