/**
 * Distance Calculation Engine (Pure Logic)
 *
 * Implements robust, deterministic GPS coordinate filtering and distance accumulation.
 * Does NOT simply sum raw coordinates, preventing errors from:
 * - Stationary drift (jitter while idling at traffic lights or parked)
 * - Poor horizontal accuracy (indoor or multipath bounce)
 * - Duplicate or non-increasing timestamps
 * - Teleportation jumps (instantaneous GPS glitches exceeding 200 km/h)
 * - Multi-minute signal loss / tunnel gaps
 */

import type {
  RawLocationSample,
  FilteredLocationSample,
  TripDistanceCalculationResult,
} from '@/types/trip';

// ─── Filter Constants ────────────────────────────────────────────────

/** Reject coordinates with reported horizontal accuracy worse than this. */
export const MAX_ACCEPTABLE_ACCURACY_METERS = 35;

/** Stationary drift threshold: movements smaller than this are treated as sensor noise. */
export const DRIFT_DISTANCE_THRESHOLD_METERS = 4;

/** Maximum plausible vehicle speed in meters per second (55.5 m/s = 200 km/h). */
export const MAX_PLAUSIBLE_SPEED_MPS = 55.5;

/** Time gap threshold (120 seconds): signal losses longer than this are flagged. */
export const SIGNAL_GAP_SECONDS = 120;

const EARTH_RADIUS_METERS = 6371000;

// ─── Coordinate Math ─────────────────────────────────────────────────

function degreesToRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Validates whether reported horizontal accuracy is a valid, positive, finite number.
 * Missing, null, undefined, non-finite, or <= 0 accuracy values are treated as unknown/invalid.
 */
export function isValidAccuracy(accuracy: number | null | undefined): accuracy is number {
  return (
    typeof accuracy === 'number' &&
    !isNaN(accuracy) &&
    isFinite(accuracy) &&
    accuracy > 0
  );
}

/**
 * Calculates the great-circle distance between two geographic coordinates
 * using the Haversine formula. Returns distance in meters.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const dLat = degreesToRadians(lat2 - lat1);
  const dLon = degreesToRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degreesToRadians(lat1)) *
      Math.cos(degreesToRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Validates coordinate numbers and timestamp sanity.
 */
export function isValidCoordinate(sample: RawLocationSample): boolean {
  if (sample == null) return false;
  const { latitude, longitude, timestamp } = sample;

  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    typeof timestamp !== 'number'
  ) {
    return false;
  }

  if (isNaN(latitude) || isNaN(longitude) || isNaN(timestamp)) return false;
  if (!isFinite(latitude) || !isFinite(longitude) || !isFinite(timestamp)) return false;

  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  if (timestamp <= 0) return false;

  return true;
}

// ─── Filter & Accumulation Engine ────────────────────────────────────

/**
 * Builds an explanatory data-quality warning based on observed live or filtered events.
 */
export function buildQualityWarning(diagnostics: {
  hasGapWarning: boolean;
  totalReceived: number;
  rejectedCount: number;
  rejectionCounts?: Partial<TripDistanceCalculationResult['rejectionCounts']>;
}): string | null {
  const { hasGapWarning, totalReceived, rejectedCount } = diagnostics;
  const rejectionRatio = totalReceived > 0 ? rejectedCount / totalReceived : 0;

  if (hasGapWarning && rejectionRatio > 0.25) {
    return 'Significant GPS signal loss and noisy samples were detected during this trip. Estimated straight-line route may differ from actual road distance.';
  } else if (hasGapWarning) {
    return 'A temporary GPS signal interruption occurred during this trip. The estimated route bridges the gap and may underestimate road distance.';
  } else if (rejectionRatio > 0.35 && totalReceived > 10) {
    return 'Many GPS samples were filtered due to weak satellite reception or stationary jitter.';
  }
  return null;
}

/**
 * Processes a sequence of raw GPS samples chronologically, applies validation
 * and noise filters, and calculates total distance traveled.
 *
 * @param samples - Array of raw GPS coordinates (sorted or unsorted)
 * @returns Filtered calculation result with distance, accepted samples, and quality metrics
 */
export function filterAndCalculateTripDistance(
  samples: RawLocationSample[]
): TripDistanceCalculationResult {
  const result: TripDistanceCalculationResult = {
    totalDistanceMeters: 0,
    totalDistanceKm: 0,
    acceptedSamplesCount: 0,
    rejectedSamplesCount: 0,
    rejectionCounts: {
      invalid_coordinates: 0,
      poor_accuracy: 0,
      unknown_accuracy: 0,
      stale_or_duplicate_timestamp: 0,
      stationary_drift: 0,
      implausible_speed: 0,
    },
    hasGapWarning: false,
    qualityWarning: null,
  };

  if (!samples || samples.length === 0) {
    return result;
  }

  let lastAccepted: RawLocationSample | null = null;
  let totalDistanceMeters = 0;
  let gapDetected = false;

  for (let i = 0; i < samples.length; i++) {
    const current = samples[i];

    // Check gap from lastAccepted if available (independent of current sample acceptance)
    if (lastAccepted && typeof current?.timestamp === 'number') {
      const deltaFromLast = (current.timestamp - lastAccepted.timestamp) / 1000;
      if (deltaFromLast > SIGNAL_GAP_SECONDS) {
        gapDetected = true;
      }
    }

    // 1. Coordinate validity check
    if (!isValidCoordinate(current)) {
      result.rejectedSamplesCount++;
      result.rejectionCounts.invalid_coordinates++;
      continue;
    }

    // 2. Horizontal accuracy check: unknown vs poor
    if (!isValidAccuracy(current.accuracy)) {
      result.rejectedSamplesCount++;
      result.rejectionCounts.unknown_accuracy++;
      continue;
    }

    if (current.accuracy > MAX_ACCEPTABLE_ACCURACY_METERS) {
      result.rejectedSamplesCount++;
      result.rejectionCounts.poor_accuracy++;
      continue;
    }

    // First valid sample anchors the trip
    if (!lastAccepted) {
      lastAccepted = current;
      result.acceptedSamplesCount++;
      continue;
    }

    // 3. Stale or duplicate timestamp check
    const timeDeltaSeconds = (current.timestamp - lastAccepted.timestamp) / 1000;
    if (timeDeltaSeconds <= 0) {
      result.rejectedSamplesCount++;
      result.rejectionCounts.stale_or_duplicate_timestamp++;
      continue;
    }

    // 4. Distance from last accepted fix
    const stepDistance = haversineDistance(
      lastAccepted.latitude,
      lastAccepted.longitude,
      current.latitude,
      current.longitude
    );

    // 5. Stationary drift filter
    if (stepDistance < DRIFT_DISTANCE_THRESHOLD_METERS) {
      result.rejectedSamplesCount++;
      result.rejectionCounts.stationary_drift++;
      continue;
    }

    // 6. Plausible vehicle speed check
    const speedMps = stepDistance / timeDeltaSeconds;
    if (speedMps > MAX_PLAUSIBLE_SPEED_MPS) {
      result.rejectedSamplesCount++;
      result.rejectionCounts.implausible_speed++;
      continue;
    }

    // Sample accepted!
    totalDistanceMeters += stepDistance;
    lastAccepted = current;
    result.acceptedSamplesCount++;
  }

  result.totalDistanceMeters = Math.round(totalDistanceMeters * 10) / 10;
  result.totalDistanceKm = Math.round((totalDistanceMeters / 1000) * 100) / 100;
  result.hasGapWarning = gapDetected;
  result.qualityWarning = buildQualityWarning({
    hasGapWarning: gapDetected,
    totalReceived: samples.length,
    rejectedCount: result.rejectedSamplesCount,
    rejectionCounts: result.rejectionCounts,
  });

  return result;
}

export interface ProcessSampleResult {
  sample: FilteredLocationSample | null;
  deltaKm: number;
  gapDetected: boolean;
  gapDurationSeconds?: number;
  rejected: boolean;
  reason?: FilteredLocationSample['rejectionReason'];
}

/**
 * Validates, filters, and processes a single incoming GPS location fix in real-time.
 * Signal gaps are evaluated independently of whether the incoming fix is accepted.
 */
export function processLocationSample(
  current: RawLocationSample,
  lastAccepted: RawLocationSample | null
): ProcessSampleResult {
  // Check if signal gap occurred since last accepted sample
  let gapDetected = false;
  let gapDurationSeconds: number | undefined;

  if (lastAccepted && typeof current?.timestamp === 'number' && typeof lastAccepted?.timestamp === 'number') {
    const timeDelta = (current.timestamp - lastAccepted.timestamp) / 1000;
    if (timeDelta > SIGNAL_GAP_SECONDS) {
      gapDetected = true;
      gapDurationSeconds = timeDelta;
    }
  }

  // 1. Coordinate validity check
  if (!isValidCoordinate(current)) {
    return {
      sample: null,
      deltaKm: 0,
      gapDetected,
      gapDurationSeconds,
      rejected: true,
      reason: 'invalid_coordinates',
    };
  }

  // 2. Unknown or missing accuracy check
  if (!isValidAccuracy(current.accuracy)) {
    return {
      sample: null,
      deltaKm: 0,
      gapDetected,
      gapDurationSeconds,
      rejected: true,
      reason: 'unknown_accuracy',
    };
  }

  // 3. Poor accuracy check (> 35m)
  if (current.accuracy > MAX_ACCEPTABLE_ACCURACY_METERS) {
    return {
      sample: null,
      deltaKm: 0,
      gapDetected,
      gapDurationSeconds,
      rejected: true,
      reason: 'poor_accuracy',
    };
  }

  // First valid sample anchors the trip
  if (!lastAccepted) {
    const filtered: FilteredLocationSample = {
      ...current,
      isAccepted: true,
      stepDistanceMeters: 0,
    };
    return {
      sample: filtered,
      deltaKm: 0,
      gapDetected: false,
      rejected: false,
    };
  }

  // 4. Stale or duplicate timestamp check
  const timeDeltaSeconds = (current.timestamp - lastAccepted.timestamp) / 1000;
  if (timeDeltaSeconds <= 0) {
    return {
      sample: null,
      deltaKm: 0,
      gapDetected: false,
      rejected: true,
      reason: 'stale_or_duplicate_timestamp',
    };
  }

  // 5. Stationary drift check (< 4m)
  const stepDistance = haversineDistance(
    lastAccepted.latitude,
    lastAccepted.longitude,
    current.latitude,
    current.longitude
  );

  if (stepDistance < DRIFT_DISTANCE_THRESHOLD_METERS) {
    return {
      sample: null,
      deltaKm: 0,
      gapDetected,
      gapDurationSeconds,
      rejected: true,
      reason: 'stationary_drift',
    };
  }

  // 6. Plausible vehicle speed check (> 55.5 m/s)
  const speedMps = stepDistance / timeDeltaSeconds;
  if (speedMps > MAX_PLAUSIBLE_SPEED_MPS) {
    return {
      sample: null,
      deltaKm: 0,
      gapDetected,
      gapDurationSeconds,
      rejected: true,
      reason: 'implausible_speed',
    };
  }

  // Sample accepted!
  const filtered: FilteredLocationSample = {
    ...current,
    isAccepted: true,
    stepDistanceMeters: stepDistance,
  };

  return {
    sample: filtered,
    deltaKm: stepDistance / 1000,
    gapDetected,
    gapDurationSeconds,
    rejected: false,
  };
}

export const calculateTripDistance = filterAndCalculateTripDistance;

