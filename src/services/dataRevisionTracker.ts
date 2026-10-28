/**
 * Data Revision Tracker (P1.1 Optimization)
 *
 * Tracks granular dataset revisions per vehicle and globally.
 * Allows screens (Dashboard, Stats, History) to skip redundant,
 * synchronous SQLite reads during tab focus events when the underlying
 * data has not actually been mutated.
 */

export type DatasetType =
  | 'vehicles'
  | 'fuel'
  | 'services'
  | 'expenses'
  | 'trips'
  | 'documents'
  | 'maintenanceProfiles';

class DataRevisionTracker {
  private globalRevisions: Record<DatasetType, number> = {
    vehicles: 0,
    fuel: 0,
    services: 0,
    expenses: 0,
    trips: 0,
    documents: 0,
    maintenanceProfiles: 0,
  };

  private vehicleRevisions: Record<DatasetType, Record<string, number>> = {
    vehicles: {},
    fuel: {},
    services: {},
    expenses: {},
    trips: {},
    documents: {},
    maintenanceProfiles: {},
  };

  /**
   * Bumps the revision for a dataset, optionally scoped to a vehicle.
   */
  bumpRevision(dataset: DatasetType, vehicleId?: string): void {
    this.globalRevisions[dataset] = (this.globalRevisions[dataset] || 0) + 1;
    if (vehicleId) {
      const current = this.vehicleRevisions[dataset][vehicleId] || 0;
      this.vehicleRevisions[dataset][vehicleId] = current + 1;
    }
  }

  /**
   * Returns the current revision of a dataset (vehicle-specific if vehicleId is provided).
   */
  getRevision(dataset: DatasetType, vehicleId?: string): number {
    if (vehicleId && this.vehicleRevisions[dataset][vehicleId] !== undefined) {
      return this.vehicleRevisions[dataset][vehicleId];
    }
    return this.globalRevisions[dataset] || 0;
  }

  /**
   * Reset all counters (primarily for tests).
   */
  reset(): void {
    const datasets: DatasetType[] = [
      'vehicles',
      'fuel',
      'services',
      'expenses',
      'trips',
      'documents',
      'maintenanceProfiles',
    ];
    for (const d of datasets) {
      this.globalRevisions[d] = 0;
      this.vehicleRevisions[d] = {};
    }
  }
}

export const dataRevisionTracker = new DataRevisionTracker();
