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

    // 1. Coordinate validity check
    if (!isValidCoordinate(current)) {
      result.rejectedSamplesCount++;
      result.rejectionCounts.invalid_coordinates++;
      continue;
    }

    // 2. Horizontal accuracy check
    const accuracy = current.accuracy ?? 0;
    if (accuracy > MAX_ACCEPTABLE_ACCURACY_METERS) {
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
    // If movement is below threshold, treat as jitter while vehicle is stopped
    if (stepDistance < DRIFT_DISTANCE_THRESHOLD_METERS) {
      result.rejectedSamplesCount++;
      result.rejectionCounts.stationary_drift++;
      // Still update timestamp anchor if we remained stopped for a while
      continue;
    }

    // 6. Plausible vehicle speed check
    const speedMps = stepDistance / timeDeltaSeconds;
    if (speedMps > MAX_PLAUSIBLE_SPEED_MPS) {
      result.rejectedSamplesCount++;
      result.rejectionCounts.implausible_speed++;
      continue;
    }

    // 7. Gap detection (e.g. signal loss during tunnel)
    if (timeDeltaSeconds > SIGNAL_GAP_SECONDS) {
      gapDetected = true;
    }

    // Sample accepted!
    totalDistanceMeters += stepDistance;
    lastAccepted = current;
    result.acceptedSamplesCount++;
  }

  result.totalDistanceMeters = Math.round(totalDistanceMeters * 10) / 10;
  result.totalDistanceKm = Math.round((totalDistanceMeters / 1000) * 100) / 100;
  result.hasGapWarning = gapDetected;

  // Build transparent data-quality warning if necessary
  const totalReceived = samples.length;
  const rejectionRatio = totalReceived > 0 ? result.rejectedSamplesCount / totalReceived : 0;

  if (gapDetected && rejectionRatio > 0.25) {
    result.qualityWarning =
      'Significant GPS signal loss and noisy samples were detected during this trip. Estimated distance may differ from actual route.';
  } else if (gapDetected) {
    result.qualityWarning =
      'A temporary GPS signal interruption occurred during this trip. The estimated route bridges the gap.';
  } else if (rejectionRatio > 0.35 && totalReceived > 10) {
    result.qualityWarning =
      'Many GPS samples were filtered due to weak satellite reception or stationary jitter.';
  }

  return result;
}

export interface ProcessSampleResult {
  sample: FilteredLocationSample | null;
  deltaKm: number;
  gapDetected: boolean;
  rejected: boolean;
  reason?: FilteredLocationSample['rejectionReason'];
}

/**
 * Validates, filters, and processes a single incoming GPS location fix in real-time.
 */
export function processLocationSample(
  current: RawLocationSample,
  lastAccepted: RawLocationSample | null
): ProcessSampleResult {
  if (!isValidCoordinate(current)) {
    return {
      sample: null,
      deltaKm: 0,
      gapDetected: false,
      rejected: true,
      reason: 'invalid_coordinates',
    };
  }

  const accuracy = current.accuracy ?? 0;
  if (accuracy > MAX_ACCEPTABLE_ACCURACY_METERS) {
    return {
      sample: null,
      deltaKm: 0,
      gapDetected: false,
      rejected: true,
      reason: 'poor_accuracy',
    };
  }

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
      gapDetected: false,
      rejected: true,
      reason: 'stationary_drift',
    };
  }

  const speedMps = stepDistance / timeDeltaSeconds;
  if (speedMps > MAX_PLAUSIBLE_SPEED_MPS) {
    return {
      sample: null,
      deltaKm: 0,
      gapDetected: false,
      rejected: true,
      reason: 'implausible_speed',
    };
  }

  const gapDetected = timeDeltaSeconds > SIGNAL_GAP_SECONDS;
  const filtered: FilteredLocationSample = {
    ...current,
    isAccepted: true,
    stepDistanceMeters: stepDistance,
  };

  return {
    sample: filtered,
    deltaKm: stepDistance / 1000,
    gapDetected,
    rejected: false,
  };
}

export const calculateTripDistance = filterAndCalculateTripDistance;

