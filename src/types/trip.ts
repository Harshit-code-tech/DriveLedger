/**
 * Trip Types
 *
 * TypeScript interfaces for the `trips` and `trip_locations` tables.
 * Supports foreground GPS trip recording, manual odometer-based trips,
 * and data quality tracking.
 */

export type TripType = 'gps' | 'manual';
export type TripStatus = 'recording' | 'paused' | 'completed' | 'interrupted' | 'discarded';

// ─── Full Database Rows ──────────────────────────────────────────────

export interface Trip {
  /** Primary key — UUID v4 */
  id: string;

  /** FK → vehicles.id */
  vehicle_id: string;

  /** Recording method: 'gps' or 'manual' */
  trip_type: TripType;

  /** Lifecycle status: 'recording' | 'paused' | 'completed' | 'interrupted' | 'discarded' */
  status: TripStatus;

  /** ISO 8601 start timestamp */
  start_time: string;

  /** ISO 8601 end timestamp (optional while in progress) */
  end_time: string | null;

  /** Starting odometer reading (optional for GPS trips, mandatory for manual) */
  start_odometer: number | null;

  /** Ending odometer reading (optional for GPS trips, mandatory for manual) */
  end_odometer: number | null;

  /** Recorded or calculated distance in kilometers */
  distance_km: number;

  /** Duration of the trip in seconds */
  duration_seconds: number;

  /** Trip purpose or category (e.g. 'Commute', 'Highway road trip', 'Business') */
  purpose: string | null;

  /** Free-text notes */
  notes: string | null;

  /** Number of GPS location samples accepted */
  sample_count: number;

  /** Data-quality or sensor anomaly warning if GPS was filtered or interrupted */
  quality_warning: string | null;

  /** Serialized JSON string of aggregate GPS diagnostics */
  diagnostics?: string | null;

  /** ISO 8601 timestamp */
  created_at: string;

  /** ISO 8601 timestamp */
  updated_at: string;

  /** ISO 8601 timestamp — soft delete marker */
  deleted_at: string | null;
}

export type RejectionReason =
  | 'invalid_coordinates'
  | 'poor_accuracy'
  | 'unknown_accuracy'
  | 'stale_or_duplicate_timestamp'
  | 'stationary_drift'
  | 'implausible_speed';

export interface RejectionCounts {
  invalid_coordinates: number;
  poor_accuracy: number;
  unknown_accuracy: number;
  stale_or_duplicate_timestamp: number;
  stationary_drift: number;
  implausible_speed: number;
}

export interface TripDiagnostics {
  rejection_counts: RejectionCounts;
  total_samples_received: number;
  accepted_samples_count: number;
  rejected_samples_count: number;
  gap_count: number;
  max_gap_seconds: number;
  has_gap_warning: boolean;
  anchor_needed?: boolean;
  paused_at?: number;
  resumed_at?: number;
  pause_intervals?: { paused_at: number; resumed_at: number }[];
}

export interface TripLocation {
  /** Primary key — UUID v4 */
  id: string;

  /** FK → trips.id */
  trip_id: string;

  /** Latitude in decimal degrees [-90, 90] */
  latitude: number;

  /** Longitude in decimal degrees [-180, 180] */
  longitude: number;

  /** Horizontal accuracy in meters */
  accuracy: number | null;

  /** Altitude in meters */
  altitude: number | null;

  /** Speed in meters per second */
  speed: number | null;

  /** Heading in degrees [0, 360] */
  heading: number | null;

  /** Epoch timestamp in milliseconds */
  timestamp: number;

  /** 1 if sample was rejected by distance filter, 0 if accepted */
  is_rejected: number;

  /** Reason for rejection (e.g., 'poor_accuracy', 'unknown_accuracy', 'stationary_drift') */
  rejection_reason: string | null;

  /** ISO 8601 timestamp */
  created_at: string;
}

// ─── Input Types ─────────────────────────────────────────────────────

export interface CreateTripInput {
  vehicle_id: string;
  trip_type: TripType;
  start_time?: string;
  start_odometer?: number | null;
  purpose?: string | null;
  notes?: string | null;
  diagnostics?: string | null;
}

export interface CreateManualTripInput {
  vehicle_id: string;
  date: string;
  start_odometer: number;
  end_odometer: number;
  duration_minutes?: number;
  purpose?: string | null;
  notes?: string | null;
  updateVehicleOdometer?: boolean;
}

export interface FinishTripOptions {
  notes?: string;
  purpose?: string;
  endOdometer?: number | null;
  updateVehicleOdometer?: boolean;
}

export type UpdateTripInput = Partial<
  Omit<Trip, 'id' | 'vehicle_id' | 'created_at' | 'updated_at' | 'deleted_at'>
>;

// ─── GPS Engine Filter Types ─────────────────────────────────────────

export interface RawLocationSample {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  altitude?: number | null;
  speed?: number | null;
  heading?: number | null;
  timestamp: number;
}

export interface FilteredLocationSample extends RawLocationSample {
  isAccepted: boolean;
  rejectionReason?: RejectionReason;
  stepDistanceMeters: number;
}

export interface TripDistanceCalculationResult {
  totalDistanceMeters: number;
  totalDistanceKm: number;
  acceptedSamplesCount: number;
  rejectedSamplesCount: number;
  rejectionCounts: RejectionCounts;
  hasGapWarning: boolean;
  qualityWarning: string | null;
}
