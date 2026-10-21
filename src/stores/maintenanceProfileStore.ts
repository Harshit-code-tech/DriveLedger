/**
 * Maintenance Profile Store (Zustand)
 *
 * Global state for vehicle-specific maintenance profiles and target tracking.
 * Connects the UI layer to maintenanceProfileRepo and integrates with notificationService.
 *
 * Offline-first: All data persisted in local SQLite database.
 */

import { create } from 'zustand';
import type {
  MaintenanceProfile,
  CreateMaintenanceProfileInput,
  UpdateMaintenanceProfileInput,
  ProfileDueStatus,
} from '@/types/service';
import * as profileRepo from '@/database/repositories/maintenanceProfileRepo';
import { refreshReminders } from '@/services/notificationService';

interface MaintenanceProfileState {
  /** Profiles for the currently active vehicle */
  profiles: MaintenanceProfile[];
  /** Calculated due statuses for current odometer */
  dueStatuses: ProfileDueStatus[];
  /** Loading indicator */
  isLoading: boolean;

  // ── Actions ──
  /** Load profiles and due statuses for vehicle */
  loadProfiles: (vehicleId: string, currentOdometer?: number | null) => void;
  /** Add a new profile */
  addProfile: (
    input: CreateMaintenanceProfileInput,
    currentOdometer?: number | null
  ) => MaintenanceProfile;
  /** Update an existing profile */
  editProfile: (
    id: string,
    input: UpdateMaintenanceProfileInput,
    currentOdometer?: number | null
  ) => MaintenanceProfile | null;
  /** Delete a profile */
  deleteProfile: (
    id: string,
    vehicleId: string,
    currentOdometer?: number | null
  ) => void;
  /** Recalculate due statuses after odometer changes */
  recalculateStatuses: (vehicleId: string, currentOdometer: number | null) => void;
}

export const useMaintenanceProfileStore = create<MaintenanceProfileState>((set, get) => ({
  profiles: [],
  dueStatuses: [],
  isLoading: true,

  loadProfiles: (vehicleId: string, currentOdometer?: number | null) => {
    try {
      const profiles = profileRepo.getMaintenanceProfilesByVehicle(vehicleId);
      const dueStatuses = profileRepo.computeAllProfilesDueStatus(vehicleId, currentOdometer ?? null);
      set({ profiles, dueStatuses, isLoading: false });
    } catch {
      set({ profiles: [], dueStatuses: [], isLoading: false });
    }
  },

  addProfile: (input: CreateMaintenanceProfileInput, currentOdometer?: number | null) => {
    const profile = profileRepo.createMaintenanceProfile(input);
    const profiles = profileRepo.getMaintenanceProfilesByVehicle(input.vehicle_id);
    const dueStatuses = profileRepo.computeAllProfilesDueStatus(input.vehicle_id, currentOdometer ?? null);
    set({ profiles, dueStatuses });
    refreshReminders();
    return profile;
  },

  editProfile: (id: string, input: UpdateMaintenanceProfileInput, currentOdometer?: number | null) => {
    const updated = profileRepo.updateMaintenanceProfile(id, input);
    if (updated) {
      const profiles = profileRepo.getMaintenanceProfilesByVehicle(updated.vehicle_id);
      const dueStatuses = profileRepo.computeAllProfilesDueStatus(updated.vehicle_id, currentOdometer ?? null);
      set({ profiles, dueStatuses });
      refreshReminders();
    }
    return updated;
  },

  deleteProfile: (id: string, vehicleId: string, currentOdometer?: number | null) => {
    profileRepo.softDeleteMaintenanceProfile(id);
    const profiles = profileRepo.getMaintenanceProfilesByVehicle(vehicleId);
    const dueStatuses = profileRepo.computeAllProfilesDueStatus(vehicleId, currentOdometer ?? null);
    set({ profiles, dueStatuses });
    refreshReminders();
  },

  recalculateStatuses: (vehicleId: string, currentOdometer?: number | null) => {
    const dueStatuses = profileRepo.computeAllProfilesDueStatus(vehicleId, currentOdometer ?? null);
    set({ dueStatuses });
  },
}));
