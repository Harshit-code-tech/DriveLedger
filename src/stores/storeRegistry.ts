/**
 * Store Registry
 *
 * A lightweight callback registry used by Zustand stores that need to
 * trigger actions in sibling stores without creating circular module imports.
 *
 * PROBLEM it solves
 * ─────────────────
 * fuelStore needs to call vehicleStore.loadVehicles() after a fuel entry
 * is deleted (so the vehicle odometer refreshes on the Home screen).
 *
 * BUT importing vehicleStore directly into fuelStore creates a circular
 * dependency: vehicleStore → preferencesStore is fine, but if vehicleStore
 * later imports anything from fuelStore the whole module graph deadlocks.
 *
 * SOLUTION
 * ────────
 * vehicleStore registers its `loadVehicles` function here on boot.
 * fuelStore calls `storeRegistry.refreshVehicles()` — no import needed.
 *
 * USAGE
 * ─────
 * In vehicleStore.ts (once, at store-creation time):
 *   import { storeRegistry } from '@/stores/storeRegistry';
 *   storeRegistry.registerRefreshVehicles(() => useVehicleStore.getState().loadVehicles());
 *
 * In fuelStore.ts (instead of the dynamic require):
 *   import { storeRegistry } from '@/stores/storeRegistry';
 *   storeRegistry.refreshVehicles();
 */

type VoidFn = () => void;

class StoreRegistry {
  private _refreshVehicles: VoidFn | null = null;

  /**
   * Called once by vehicleStore to register its loadVehicles action.
   * Subsequent calls overwrite the previous registration (safe — there
   * is only ever one vehicleStore instance).
   */
  registerRefreshVehicles(fn: VoidFn): void {
    this._refreshVehicles = fn;
  }

  /**
   * Triggers a vehicle list refresh. If vehicleStore has not registered
   * yet (should not happen in practice), the call is silently ignored.
   */
  refreshVehicles(): void {
    this._refreshVehicles?.();
  }
}

/** Singleton registry — import this object, do not instantiate. */
export const storeRegistry = new StoreRegistry();
