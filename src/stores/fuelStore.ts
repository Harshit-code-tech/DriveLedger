/**
 * Fuel Entry Store (Zustand)
 *
 * Global state for fuel entry data.
 * Handles CRUD + mileage calculation orchestration.
 *
 * KEY FLOW:
 * 1. User fills the fuel entry form.
 * 2. UI calls addFuelEntry().
 * 3. Store creates the entry via fuelRepo.
 * 4. Store calls mileageEngine to calculate mileage.
 * 5. Store persists the calculated mileage back to the entry.
 * 6. Store updates the vehicle's current_odometer.
 * 7. State is refreshed.
 */

import { create } from 'zustand';
import { Platform } from 'react-native';
import type { FuelEntry, CreateFuelEntryInput, UpdateFuelEntryInput } from '@/types/fuel';
import type { Vehicle } from '@/types/vehicle';
import * as fuelRepo from '@/database/repositories/fuelRepo';
import { syncWidgetState } from '@/widgets/widgetDataService';
import { storeRegistry } from '@/stores/storeRegistry';
import { refreshReminders } from '@/services/notificationService';
import {
  calculateMileageForEntry,
  calculatePartialEstimate,
  recalculateAllMileage,
  computeMileageStats,
  checkMileageReasonableness,
  type MileageStats,
  type MileageWarning,
  type MileageResult,
} from '@/engine/mileageEngine';
import { FuelType, FUEL_UNIT_TO_MILEAGE_UNIT } from '@/constants/fuelTypes';
import type { FuelUnit, VehicleType } from '@/constants/fuelTypes';

interface FuelState {
  /** Fuel entries for the currently selected vehicle (date DESC for display) */
  entries: FuelEntry[];
  /**
   * Estimated mileage map for partial-fill entries.
   * Key = entry.id, value = MileageResult with isEstimate: true.
   * Computed on-the-fly (not persisted to DB) so no migration needed.
   */
  partialEstimates: Record<string, MileageResult>;
  /** Mileage statistics for the selected vehicle */
  stats: MileageStats;
  /** Loading state */
  isLoading: boolean;

  // ── Actions ──
  /**
   * Load fuel entries + stats for a vehicle.
   *
   * @param vehicleId  - ID of the vehicle to load entries for.
   * @param fuelType   - Optional: caller should pass `vehicle.fuel_type` to
   *                     avoid an internal store lookup. Falls back to
   *                     undefined (stats will still be computed without
   *                     fuel-type-specific logic) if omitted.
   */
  loadEntries: (vehicleId: string, fuelType?: FuelType) => void;
  /** Create a new fuel entry with mileage calculation (atomic transaction) */
  addFuelEntry: (input: CreateFuelEntryInput, vehicle: Vehicle) => {
    entry: FuelEntry;
    warning: MileageWarning | null;
  };
  /** Update an existing fuel entry and recalculate downstream mileage (atomic transaction) */
  updateFuelEntry: (
    entryId: string,
    input: UpdateFuelEntryInput,
    vehicle: Vehicle
  ) => FuelEntry | null;
  /** Delete a fuel entry and recalculate downstream mileage (atomic transaction) */
  deleteFuelEntry: (entryId: string, vehicle: Vehicle) => void;
}

const emptyStats: MileageStats = {
  lastFillMileage: null,
  runningAverage: null,
  monthlyAverage: null,
  best: null,
  worst: null,
};

/**
 * Computes partial-fill estimated mileage for all entries in a chronological list.
 * Returns a map of entryId → MileageResult (isEstimate: true).
 */
function computePartialEstimates(chronological: FuelEntry[], fuelType?: FuelType): Record<string, MileageResult> {
  const map: Record<string, MileageResult> = {};
  chronological.forEach((_, index) => {
    const result = calculatePartialEstimate(chronological, index, fuelType);
    if (result) {
      map[chronological[index].id] = result;
    }
  });
  return map;
}

export const useFuelStore = create<FuelState>((set) => ({
  entries: [],
  partialEstimates: {},
  stats: emptyStats,
  isLoading: true,

  loadEntries: (vehicleId: string, fuelType?: FuelType) => {
    const entries = fuelRepo.getFuelEntriesByVehicle(vehicleId);
    const chronological = fuelRepo.getFuelEntriesByVehicleChronological(vehicleId);
    // fuelType is provided by the caller (who always has the vehicle object).
    // No store lookup needed — eliminates the circular require.
    const stats = computeMileageStats(entries, fuelType);
    const partialEstimates = computePartialEstimates(chronological, fuelType);
    set({ entries, stats, partialEstimates, isLoading: false });
  },

  addFuelEntry: (input: CreateFuelEntryInput, vehicle: Vehicle) => {
    // Atomically create entry, compute mileage, and update vehicle odometer in one transaction
    const { entry, warning } = fuelRepo.createFuelEntryAtomic(
      input,
      vehicle.fuel_type as FuelType,
      vehicle.vehicle_type as VehicleType
    );

    // Refresh store state
    const entries = fuelRepo.getFuelEntriesByVehicle(vehicle.id);
    const chronological = fuelRepo.getFuelEntriesByVehicleChronological(vehicle.id);
    const stats = computeMileageStats(entries, vehicle.fuel_type as FuelType);
    const partialEstimates = computePartialEstimates(chronological, vehicle.fuel_type as FuelType);
    set({ entries, stats, partialEstimates });

    storeRegistry.refreshVehicles();
    if (Platform.OS === 'android') syncWidgetState();
    refreshReminders();

    return { entry, warning };
  },

  updateFuelEntry: (
    entryId: string,
    input: UpdateFuelEntryInput,
    vehicle: Vehicle
  ) => {
    // Atomically update entry, recalculate mileage chain, and update vehicle odometer
    const updated = fuelRepo.updateFuelEntryAtomic(
      entryId,
      input,
      vehicle.fuel_type as FuelType
    );

    // Refresh store state
    const entries = fuelRepo.getFuelEntriesByVehicle(vehicle.id);
    const chronological = fuelRepo.getFuelEntriesByVehicleChronological(vehicle.id);
    const stats = computeMileageStats(entries, vehicle.fuel_type as FuelType);
    const partialEstimates = computePartialEstimates(chronological, vehicle.fuel_type as FuelType);
    set({ entries, stats, partialEstimates });

    storeRegistry.refreshVehicles();
    if (Platform.OS === 'android') syncWidgetState();
    refreshReminders();

    return updated;
  },

  deleteFuelEntry: (entryId: string, vehicle: Vehicle) => {
    // Atomically soft delete, recalculate mileage chain, and update vehicle odometer
    fuelRepo.deleteFuelEntryAtomic(
      entryId,
      vehicle.id,
      vehicle.fuel_type as FuelType
    );

    // Refresh store state
    const entries = fuelRepo.getFuelEntriesByVehicle(vehicle.id);
    const chronological = fuelRepo.getFuelEntriesByVehicleChronological(vehicle.id);
    const stats = computeMileageStats(entries, vehicle.fuel_type as FuelType);
    const partialEstimates = computePartialEstimates(chronological, vehicle.fuel_type as FuelType);
    set({ entries, stats, partialEstimates });

    storeRegistry.refreshVehicles();
    if (Platform.OS === 'android') syncWidgetState();
    refreshReminders();
  },
}));
