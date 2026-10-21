/**
 * Trip Repository
 *
 * CRUD operations for the `trips` and `trip_locations` tables.
 *
 * Supports:
 * - GPS-tracked trips (foreground recording with quality tracking)
 * - Manual odometer-based trips
 * - Crash recovery / Interrupted trip state reconciliation
 * - Atomic persistence of GPS samples
 */

import { getDatabase } from '../connection';
import { buildSafeUpdate } from '../safeUpdate';
import { generateUUID } from '@/utils/uuid';
import { nowISO } from '@/utils/date';
import type {
  Trip,
  TripLocation,
  CreateTripInput,
  CreateManualTripInput,
  UpdateTripInput,
  FilteredLocationSample,
} from '@/types/trip';

// ─── CREATE ──────────────────────────────────────────────────────────

/**
 * Creates a new trip in 'recording' state.
 */
export function createTrip(input: CreateTripInput): Trip {
  const db = getDatabase();
  const now = nowISO();
  const id = generateUUID();

  const trip: Trip = {
    id,
    vehicle_id: input.vehicle_id,
    trip_type: input.trip_type,
    status: 'recording',
    start_time: input.start_time || now,
    end_time: null,
    start_odometer: typeof input.start_odometer === 'number' ? input.start_odometer : null,
    end_odometer: null,
    distance_km: 0,
    duration_seconds: 0,
    purpose: input.purpose?.trim() || null,
    notes: input.notes?.trim() || null,
    sample_count: 0,
    quality_warning: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  db.runSync(
    `INSERT INTO trips (
      id, vehicle_id, trip_type, status, start_time, end_time,
      start_odometer, end_odometer, distance_km, duration_seconds,
      purpose, notes, sample_count, quality_warning,
      created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      trip.id,
      trip.vehicle_id,
      trip.trip_type,
      trip.status,
      trip.start_time,
      trip.end_time,
      trip.start_odometer,
      trip.end_odometer,
      trip.distance_km,
      trip.duration_seconds,
      trip.purpose,
      trip.notes,
      trip.sample_count,
      trip.quality_warning,
      trip.created_at,
      trip.updated_at,
      trip.deleted_at,
    ]
  );

  return trip;
}

/**
 * Creates a completed manual trip using odometer readings.
 * Validates that end_odometer >= start_odometer.
 */
export function createManualTrip(input: CreateManualTripInput): Trip {
  const db = getDatabase();
  const now = nowISO();
  const id = generateUUID();

  const startOdo = Number(input.start_odometer);
  const endOdo = Number(input.end_odometer);

  if (isNaN(startOdo) || isNaN(endOdo) || startOdo < 0 || endOdo < 0) {
    throw new Error('Odometer readings must be valid positive numbers.');
  }

  if (endOdo < startOdo) {
    throw new Error('Ending odometer cannot be lower than starting odometer.');
  }

  const distanceKm = Math.round((endOdo - startOdo) * 10) / 10;
  const tripDate = input.date || now.split('T')[0];

  const trip: Trip = {
    id,
    vehicle_id: input.vehicle_id,
    trip_type: 'manual',
    status: 'completed',
    start_time: `${tripDate}T00:00:00Z`,
    end_time: `${tripDate}T23:59:59Z`,
    start_odometer: startOdo,
    end_odometer: endOdo,
    distance_km: distanceKm,
    duration_seconds:
      typeof input.duration_minutes === 'number' && input.duration_minutes > 0
        ? input.duration_minutes * 60
        : 0,
    purpose: input.purpose?.trim() || null,
    notes: input.notes?.trim() || null,
    sample_count: 0,
    quality_warning: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  db.runSync(
    `INSERT INTO trips (
      id, vehicle_id, trip_type, status, start_time, end_time,
      start_odometer, end_odometer, distance_km, duration_seconds,
      purpose, notes, sample_count, quality_warning,
      created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      trip.id,
      trip.vehicle_id,
      trip.trip_type,
      trip.status,
      trip.start_time,
      trip.end_time,
      trip.start_odometer,
      trip.end_odometer,
      trip.distance_km,
      trip.duration_seconds,
      trip.purpose,
      trip.notes,
      trip.sample_count,
      trip.quality_warning,
      trip.created_at,
      trip.updated_at,
      trip.deleted_at,
    ]
  );

  return trip;
}

// ─── READ ────────────────────────────────────────────────────────────

export function getTripsByVehicle(vehicleId: string): Trip[] {
  const db = getDatabase();
  return db.getAllSync<Trip>(
    `SELECT * FROM trips
     WHERE vehicle_id = ? AND deleted_at IS NULL AND status != 'discarded'
     ORDER BY start_time DESC`,
    [vehicleId]
  );
}

export function getTripById(id: string): Trip | null {
  const db = getDatabase();
  return db.getFirstSync<Trip>(
    'SELECT * FROM trips WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
}

/**
 * Returns any ongoing trip ('recording' or 'paused').
 */
export function getActiveTrip(vehicleId?: string): Trip | null {
  const db = getDatabase();
  if (vehicleId) {
    return db.getFirstSync<Trip>(
      `SELECT * FROM trips
       WHERE vehicle_id = ? AND status IN ('recording', 'paused') AND deleted_at IS NULL
       ORDER BY start_time DESC LIMIT 1`,
      [vehicleId]
    );
  }
  return db.getFirstSync<Trip>(
    `SELECT * FROM trips
     WHERE status IN ('recording', 'paused') AND deleted_at IS NULL
     ORDER BY start_time DESC LIMIT 1`
  );
}

// ─── UPDATE & FINALIZATION ───────────────────────────────────────────

export function updateTrip(id: string, input: UpdateTripInput): Trip | null {
  const db = getDatabase();
  const now = nowISO();

  const ALLOWED_COLUMNS = new Set([
    'status',
    'end_time',
    'start_odometer',
    'end_odometer',
    'distance_km',
    'duration_seconds',
    'purpose',
    'notes',
    'sample_count',
    'quality_warning',
  ]);

  const { fields, values } = buildSafeUpdate(
    input as Record<string, unknown>,
    ALLOWED_COLUMNS
  );
  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  if (fields.length === 1) {
    return getTripById(id);
  }

  db.runSync(`UPDATE trips SET ${fields.join(', ')} WHERE id = ?`, values);
  return getTripById(id);
}

export interface CreateActiveTripOptions {
  vehicle_id: string;
  recording_method?: 'gps' | 'manual';
  start_odometer?: number | null;
  purpose?: string | null;
  notes?: string | null;
}

export function createActiveTrip(options: CreateActiveTripOptions): Trip {
  return createTrip({
    vehicle_id: options.vehicle_id,
    trip_type: options.recording_method || 'gps',
    start_odometer: options.start_odometer,
    purpose: options.purpose,
    notes: options.notes,
  });
}

export function updateTripStatus(id: string, status: Trip['status']): void {
  const db = getDatabase();
  const now = nowISO();
  db.runSync(
    'UPDATE trips SET status = ?, updated_at = ? WHERE id = ?',
    [status, now, id]
  );
}

export interface FinalizeTripOptions {
  distance_km: number;
  duration_minutes?: number;
  duration_seconds?: number;
  notes?: string | null;
  purpose?: string | null;
  end_odometer?: number | null;
  has_quality_warnings?: boolean;
  quality_notes?: string | null;
}

/**
 * Finalizes and saves a completed GPS or manual trip.
 * Supports both options object and positional arguments.
 */
export function finalizeTrip(
  id: string,
  arg2: number | FinalizeTripOptions,
  arg3?: number,
  arg4?: string | null
): Trip | null {
  const db = getDatabase();
  const now = nowISO();

  let distanceKm = 0;
  let durationSeconds = 0;
  let qualityWarning: string | null = null;
  let notes: string | undefined;
  let purpose: string | undefined;
  let endOdo: number | null | undefined;

  if (typeof arg2 === 'object') {
    distanceKm = arg2.distance_km;
    durationSeconds = arg2.duration_seconds ?? (arg2.duration_minutes ? arg2.duration_minutes * 60 : 0);
    qualityWarning = arg2.quality_notes ?? (arg2.has_quality_warnings ? 'GPS signal gaps detected during trip' : null);
    notes = arg2.notes ?? undefined;
    purpose = arg2.purpose ?? undefined;
    endOdo = arg2.end_odometer;
  } else {
    distanceKm = arg2;
    durationSeconds = arg3 ?? 0;
    qualityWarning = arg4 ?? null;
  }

  const updates: string[] = [
    "status = 'completed'",
    'end_time = ?',
    'distance_km = ?',
    'duration_seconds = ?',
    'quality_warning = ?',
    'updated_at = ?',
  ];
  const params: (string | number | null)[] = [
    now,
    Math.max(0, distanceKm),
    Math.max(0, durationSeconds),
    qualityWarning,
    now,
  ];

  if (notes !== undefined) {
    updates.push('notes = ?');
    params.push(notes);
  }
  if (purpose !== undefined) {
    updates.push('purpose = ?');
    params.push(purpose);
  }
  if (endOdo !== undefined) {
    updates.push('end_odometer = ?');
    params.push(endOdo);
  }

  params.push(id);

  db.runSync(`UPDATE trips SET ${updates.join(', ')} WHERE id = ?`, params);
  return getTripById(id);
}

// ─── DELETE (SOFT) ───────────────────────────────────────────────────

export function softDeleteTrip(id: string): void {
  const db = getDatabase();
  const now = nowISO();
  db.runSync('UPDATE trips SET deleted_at = ?, updated_at = ? WHERE id = ?', [
    now,
    now,
    id,
  ]);
}

// ─── GPS SAMPLES PERSISTENCE ─────────────────────────────────────────

export function saveTripLocation(
  tripId: string,
  sample: FilteredLocationSample
): TripLocation {
  const db = getDatabase();
  const now = nowISO();
  const id = generateUUID();

  const loc: TripLocation = {
    id,
    trip_id: tripId,
    latitude: sample.latitude,
    longitude: sample.longitude,
    accuracy: sample.accuracy ?? null,
    altitude: sample.altitude ?? null,
    speed: sample.speed ?? null,
    heading: sample.heading ?? null,
    timestamp: sample.timestamp,
    is_rejected: sample.isAccepted ? 0 : 1,
    rejection_reason: sample.rejectionReason ?? null,
    created_at: now,
  };

  db.runSync(
    `INSERT INTO trip_locations (
      id, trip_id, latitude, longitude, accuracy, altitude,
      speed, heading, timestamp, is_rejected, rejection_reason, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      loc.id,
      loc.trip_id,
      loc.latitude,
      loc.longitude,
      loc.accuracy,
      loc.altitude,
      loc.speed,
      loc.heading,
      loc.timestamp,
      loc.is_rejected,
      loc.rejection_reason,
      loc.created_at,
    ]
  );

  // Update trip sample count
  db.runSync(
    'UPDATE trips SET sample_count = sample_count + 1, updated_at = ? WHERE id = ?',
    [now, tripId]
  );

  return loc;
}

export function saveTripLocationsBatch(
  tripId: string,
  samples: FilteredLocationSample[]
): void {
  if (samples.length === 0) return;
  const db = getDatabase();

  const runBatch = () => {
    for (const sample of samples) {
      saveTripLocation(tripId, sample);
    }
  };

  const isAlreadyInTransaction =
    typeof db.isInTransactionSync === 'function' && db.isInTransactionSync();

  if (isAlreadyInTransaction) {
    runBatch();
  } else {
    db.withTransactionSync(runBatch);
  }
}

export const addTripLocations = saveTripLocationsBatch;

export function getTripLocations(tripId: string): TripLocation[] {
  const db = getDatabase();
  return db.getAllSync<TripLocation>(
    'SELECT * FROM trip_locations WHERE trip_id = ? ORDER BY timestamp ASC',
    [tripId]
  );
}

// ─── CRASH & RESTART RECOVERY (Part C7) ──────────────────────────────

/**
 * Scans for any trip that was in 'recording' or 'paused' status when the app
 * was terminated or died, safely transitioning it to 'interrupted' and preserving
 * recorded samples without corrupting state.
 */
export function recoverInterruptedTrips(): number {
  const db = getDatabase();
  const now = nowISO();

  const dangling = db.getAllSync<{ id: string; start_time: string }>(
    "SELECT id, start_time FROM trips WHERE status IN ('recording', 'paused') AND deleted_at IS NULL"
  );

  for (const d of dangling) {
    // Check if there are any location points to calculate duration
    const lastLoc = db.getFirstSync<{ timestamp: number }>(
      'SELECT timestamp FROM trip_locations WHERE trip_id = ? ORDER BY timestamp DESC LIMIT 1',
      [d.id]
    );

    let approxDuration = 0;
    if (lastLoc?.timestamp) {
      const startMs = new Date(d.start_time).getTime();
      if (!isNaN(startMs) && lastLoc.timestamp > startMs) {
        approxDuration = Math.round((lastLoc.timestamp - startMs) / 1000);
      }
    }

    db.runSync(
      `UPDATE trips
       SET status = 'interrupted',
           end_time = ?,
           duration_seconds = MAX(duration_seconds, ?),
           quality_warning = 'Trip recording was interrupted before completion (app closed or restarted).',
           updated_at = ?
       WHERE id = ?`,
      [now, approxDuration, now, d.id]
    );
  }

  return dangling.length;
}
