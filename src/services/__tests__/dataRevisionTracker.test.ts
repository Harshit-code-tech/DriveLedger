import { dataRevisionTracker } from '../dataRevisionTracker';

describe('dataRevisionTracker', () => {
  beforeEach(() => {
    dataRevisionTracker.reset();
  });

  it('initializes dataset revisions to 0', () => {
    expect(dataRevisionTracker.getRevision('vehicles')).toBe(0);
    expect(dataRevisionTracker.getRevision('fuel')).toBe(0);
    expect(dataRevisionTracker.getRevision('services')).toBe(0);
    expect(dataRevisionTracker.getRevision('expenses')).toBe(0);
    expect(dataRevisionTracker.getRevision('trips')).toBe(0);
    expect(dataRevisionTracker.getRevision('documents')).toBe(0);
    expect(dataRevisionTracker.getRevision('maintenanceProfiles')).toBe(0);
  });

  it('increments global revision when bumped without vehicleId', () => {
    dataRevisionTracker.bumpRevision('vehicles');
    expect(dataRevisionTracker.getRevision('vehicles')).toBe(1);

    dataRevisionTracker.bumpRevision('vehicles');
    expect(dataRevisionTracker.getRevision('vehicles')).toBe(2);
  });

  it('tracks vehicle-specific revisions independently', () => {
    dataRevisionTracker.bumpRevision('fuel', 'v-1');
    dataRevisionTracker.bumpRevision('fuel', 'v-1');
    dataRevisionTracker.bumpRevision('fuel', 'v-2');

    expect(dataRevisionTracker.getRevision('fuel', 'v-1')).toBe(2);
    expect(dataRevisionTracker.getRevision('fuel', 'v-2')).toBe(1);
    expect(dataRevisionTracker.getRevision('fuel')).toBe(3); // Global is 3
  });

  it('resets all revisions cleanly', () => {
    dataRevisionTracker.bumpRevision('fuel', 'v-1');
    dataRevisionTracker.bumpRevision('services', 'v-2');
    dataRevisionTracker.reset();

    expect(dataRevisionTracker.getRevision('fuel', 'v-1')).toBe(0);
    expect(dataRevisionTracker.getRevision('services', 'v-2')).toBe(0);
    expect(dataRevisionTracker.getRevision('fuel')).toBe(0);
  });
});
