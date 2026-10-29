/**
 * Speed & Efficiency Analysis Engine (Pure Logic)
 *
 * Implements deterministic speed-band classification and efficiency analysis for GPS trips.
 *
 * SPEED BANDS:
 * - 0–<20 km/h  (band_0_20)
 * - 20–<30 km/h (band_20_30)
 * - 30–<50 km/h (band_30_50)
 * - 50–<80 km/h (band_50_80)
 * - 80+ km/h    (band_80_plus)
 *
 * CRITICAL CORRECTNESS RULES:
 * 1. Non-overlapping boundaries: exact 20, 30, 50, and 80 km/h are never double-counted or omitted.
 * 2. Unknown/missing/null/negative speeds are NEVER treated as 0 km/h.
 * 3. Rejected GPS points are excluded.
 * 4. Pauses and pause boundaries are never bridged; paused movement contributes 0 active time/distance.
 * 5. Signal gaps exceeding SIGNAL_GAP_SECONDS (120s) are excluded from analysed speed bands.
 * 6. Distance mode proportions and Time % mode proportions strictly share the same denominators
 *    (analysed distance and analysed time respectively).
 */

import { haversineDistance, SIGNAL_GAP_SECONDS, isValidCoordinate } from '@/engine/distanceEngine';
import type { TripLocation } from '@/types/trip';

// ─── Band Definitions ────────────────────────────────────────────────

export type SpeedBandId =
  | 'band_0_20'
  | 'band_20_30'
  | 'band_30_50'
  | 'band_50_80'
  | 'band_80_plus';

export interface SpeedBandDefinition {
  id: SpeedBandId;
  label: string;
  fullLabel: string;
  minSpeedKmh: number; // inclusive
  maxSpeedKmh: number | null; // exclusive, or null for open-ended top band
}

export const SPEED_BANDS: readonly SpeedBandDefinition[] = [
  {
    id: 'band_0_20',
    label: '0–20',
    fullLabel: '0–<20 km/h',
    minSpeedKmh: 0,
    maxSpeedKmh: 20,
  },
  {
    id: 'band_20_30',
    label: '20–30',
    fullLabel: '20–<30 km/h',
    minSpeedKmh: 20,
    maxSpeedKmh: 30,
  },
  {
    id: 'band_30_50',
    label: '30–50',
    fullLabel: '30–<50 km/h',
    minSpeedKmh: 30,
    maxSpeedKmh: 50,
  },
  {
    id: 'band_50_80',
    label: '50–80',
    fullLabel: '50–<80 km/h',
    minSpeedKmh: 50,
    maxSpeedKmh: 80,
  },
  {
    id: 'band_80_plus',
    label: '80+',
    fullLabel: '80+ km/h',
    minSpeedKmh: 80,
    maxSpeedKmh: null,
  },
] as const;

// ─── Efficiency & Mileage Modeling ──────────────────────────────────

export const SPEED_BAND_EFFICIENCY_FACTORS: Record<
  SpeedBandId,
  {
    iceMultiplier: number; // Internal combustion engines (Petrol / Diesel / CNG)
    evMultiplier: number;  // Electric vehicles
    rating: string;
  }
> = {
  band_0_20: {
    iceMultiplier: 0.60, // Stop-and-go crawling, idling, low transmission gears
    evMultiplier: 1.20,  // EVs excel at lower speeds (effective regenerative braking, 0 idling)
    rating: 'Stop & Go',
  },
  band_20_30: {
    iceMultiplier: 0.80, // City traffic
    evMultiplier: 1.15,
    rating: 'City Traffic',
  },
  band_30_50: {
    iceMultiplier: 1.05, // Moderate pace, steady suburban driving
    evMultiplier: 1.10,
    rating: 'Moderate',
  },
  band_50_80: {
    iceMultiplier: 1.25, // Sweet spot: top gear cruising, minimal aero drag, optimal engine load
    evMultiplier: 0.95,  // Aero drag starts rising
    rating: 'Optimal (Sweet Spot)',
  },
  band_80_plus: {
    iceMultiplier: 0.85, // Highway high speed: aerodynamic drag dominant (proportional to v^2 / v^3)
    evMultiplier: 0.75,  // High aero resistance, single-speed reduction gearing
    rating: 'High Speed Drag',
  },
};

export const DEFAULT_BASELINE_MILEAGE: Record<string, number> = {
  petrol: 15.0,
  diesel: 20.0,
  cng: 22.0,
  lpg: 14.0,
  hybrid: 24.0,
  electric: 6.0,
};

/**
 * Calculates estimated average mileage for a specific speed band based on baseline mileage and vehicle fuel type.
 */
export function calculateSpeedBandMileage(
  bandId: SpeedBandId,
  baselineMileage: number,
  fuelType?: string
): number {
  const isEv = fuelType === 'electric' || fuelType === 'ELECTRIC';
  const factor = isEv
    ? SPEED_BAND_EFFICIENCY_FACTORS[bandId].evMultiplier
    : SPEED_BAND_EFFICIENCY_FACTORS[bandId].iceMultiplier;
  return Math.round(baselineMileage * factor * 10) / 10;
}

// ─── Types ───────────────────────────────────────────────────────────

export interface SpeedBandMetric {
  band: SpeedBandDefinition;
  distanceKm: number;
  durationSeconds: number;
  distancePercentage: number; // 0 to 100, proportion of analysed distance
  timePercentage: number;     // 0 to 100, proportion of analysed time
  estimatedMileage: number | null;
  efficiencyMultiplier: number;
  efficiencyRating: string;
}

export interface SpeedBandAnalysisOptions {
  pauseIntervals?: Array<{ paused_at: number; resumed_at: number }>;
  signalGapSeconds?: number;
  totalTripDistanceKm?: number;
  totalTripDurationSeconds?: number;
  baselineMileage?: number | null;
  fuelType?: string;
}

export interface SpeedBandReconciliation {
  totalTripDistanceKm: number;
  analysedDistanceKm: number;
  excludedGapDistanceKm: number;
  unanalysedDistanceKm: number;
  totalTripDurationSeconds: number;
  analysedDurationSeconds: number;
  excludedGapDurationSeconds: number;
  unanalysedDurationSeconds: number;
}

export interface SpeedBandAnalysisResult {
  hasSufficientData: boolean;
  insufficientDataReason?: string;
  bands: SpeedBandMetric[];
  analysedDistanceKm: number;
  analysedDurationSeconds: number;
  totalTripDistanceKm: number;
  totalTripDurationSeconds: number;
  excludedGapDistanceKm: number;
  excludedGapDurationSeconds: number;
  hasGapWarning: boolean;
  qualityWarning: string | null;
  reconciliation: SpeedBandReconciliation;
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Validates whether reported speed (in m/s) is a valid, non-negative, finite number.
 * Returns speed in km/h, or null if invalid or unknown.
 * Missing/null/negative speed is NEVER treated as 0 km/h.
 */
export function parseSpeedKmh(speedMps: number | null | undefined): number | null {
  if (
    typeof speedMps === 'number' &&
    !isNaN(speedMps) &&
    isFinite(speedMps) &&
    speedMps >= 0
  ) {
    return speedMps * 3.6;
  }
  return null;
}

/**
 * Assigns a non-negative km/h speed to its non-overlapping band definition.
 * Exact boundaries:
 * - 0 to <20  -> band_0_20
 * - 20 to <30 -> band_20_30
 * - 30 to <50 -> band_30_50
 * - 50 to <80 -> band_50_80
 * - 80+       -> band_80_plus
 *
 * Returns null if speed is invalid, negative, or non-finite.
 */
export function getSpeedBandForSpeedKmh(speedKmh: number | null | undefined): SpeedBandDefinition | null {
  if (typeof speedKmh !== 'number' || isNaN(speedKmh) || !isFinite(speedKmh) || speedKmh < 0) {
    return null;
  }

  // O(1) direct range dispatch for high-frequency GPS coordinate stream processing
  if (speedKmh < 20) return SPEED_BANDS[0];
  if (speedKmh < 30) return SPEED_BANDS[1];
  if (speedKmh < 50) return SPEED_BANDS[2];
  if (speedKmh < 80) return SPEED_BANDS[3];
  return SPEED_BANDS[4];
}

/**
 * Checks whether an interval between two timestamps intersects any pause interval.
 */
export function isIntervalPaused(
  prevTimestamp: number,
  currTimestamp: number,
  pauseIntervals?: Array<{ paused_at: number; resumed_at: number }>
): boolean {
  if (!pauseIntervals || pauseIntervals.length === 0) return false;

  return pauseIntervals.some((p) => {
    // True overlap between [prevTimestamp, currTimestamp] and (paused_at, resumed_at)
    return prevTimestamp < p.resumed_at && currTimestamp > p.paused_at;
  });
}

// ─── Core Analysis Function ──────────────────────────────────────────

/**
 * Analyzes recorded GPS points into non-overlapping speed bands.
 *
 * @param locations - Array of recorded trip locations
 * @param options - Analysis configuration (pauses, gap threshold, trip totals)
 * @returns Comprehensive SpeedBandAnalysisResult
 */
export function analyzeTripSpeedBands(
  locations: TripLocation[] | Array<{
    latitude: number;
    longitude: number;
    timestamp: number;
    speed?: number | null;
    is_rejected?: number;
    accuracy?: number | null;
  }>,
  options?: SpeedBandAnalysisOptions
): SpeedBandAnalysisResult {
  const signalGapLimitSec = options?.signalGapSeconds ?? SIGNAL_GAP_SECONDS;
  const pauseIntervals = options?.pauseIntervals;

  // Initialize band buckets
  const bandData: Record<SpeedBandId, { band: SpeedBandDefinition; distanceMeters: number; durationSeconds: number }> = {
    band_0_20: { band: SPEED_BANDS[0], distanceMeters: 0, durationSeconds: 0 },
    band_20_30: { band: SPEED_BANDS[1], distanceMeters: 0, durationSeconds: 0 },
    band_30_50: { band: SPEED_BANDS[2], distanceMeters: 0, durationSeconds: 0 },
    band_50_80: { band: SPEED_BANDS[3], distanceMeters: 0, durationSeconds: 0 },
    band_80_plus: { band: SPEED_BANDS[4], distanceMeters: 0, durationSeconds: 0 },
  };

  const createEmptyResult = (reason: string): SpeedBandAnalysisResult => {
    const totalDistKm = options?.totalTripDistanceKm ?? 0;
    const totalDurSec = options?.totalTripDurationSeconds ?? 0;
    return {
      hasSufficientData: false,
      insufficientDataReason: reason,
      bands: SPEED_BANDS.map((band) => ({
        band,
        distanceKm: 0,
        durationSeconds: 0,
        distancePercentage: 0,
        timePercentage: 0,
        estimatedMileage: null,
        efficiencyMultiplier: SPEED_BAND_EFFICIENCY_FACTORS[band.id].iceMultiplier,
        efficiencyRating: SPEED_BAND_EFFICIENCY_FACTORS[band.id].rating,
      })),
      analysedDistanceKm: 0,
      analysedDurationSeconds: 0,
      totalTripDistanceKm: totalDistKm,
      totalTripDurationSeconds: totalDurSec,
      excludedGapDistanceKm: 0,
      excludedGapDurationSeconds: 0,
      hasGapWarning: false,
      qualityWarning: null,
      reconciliation: {
        totalTripDistanceKm: totalDistKm,
        analysedDistanceKm: 0,
        excludedGapDistanceKm: 0,
        unanalysedDistanceKm: totalDistKm,
        totalTripDurationSeconds: totalDurSec,
        analysedDurationSeconds: 0,
        excludedGapDurationSeconds: 0,
        unanalysedDurationSeconds: totalDurSec,
      },
    };
  };

  if (!locations || locations.length === 0) {
    return createEmptyResult('No GPS coordinates recorded for this trip.');
  }

  // 1. Filter to valid accepted points only
  const eligiblePoints = locations.filter((loc) => {
    if (loc.is_rejected === 1) return false;
    if (!isValidCoordinate({
      latitude: loc.latitude,
      longitude: loc.longitude,
      timestamp: loc.timestamp,
    })) {
      return false;
    }
    return true;
  });

  if (eligiblePoints.length < 2) {
    return createEmptyResult(
      eligiblePoints.length === 1
        ? 'Only 1 valid GPS coordinate point recorded (stationary baseline).'
        : 'All GPS coordinates were filtered due to poor signal accuracy or noise.'
    );
  }

  // 2. Sort chronologically only if out-of-order points exist (preserves O(N) when already in order)
  let isSorted = true;
  for (let i = 1; i < eligiblePoints.length; i++) {
    if (eligiblePoints[i].timestamp < eligiblePoints[i - 1].timestamp) {
      isSorted = false;
      break;
    }
  }
  const sorted = isSorted ? eligiblePoints : [...eligiblePoints].sort((a, b) => a.timestamp - b.timestamp);

  let excludedGapMeters = 0;
  let excludedGapSeconds = 0;
  let unanalysedMeters = 0;
  let unanalysedSeconds = 0;
  let hasGapWarning = false;
  let validIntervalCount = 0;

  // 3. Process intervals between consecutive accepted points
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];

    const timeDeltaSeconds = (curr.timestamp - prev.timestamp) / 1000;

    // Handle invalid, duplicate, or backwards timestamps
    if (timeDeltaSeconds <= 0) {
      continue;
    }

    // Check pause boundary
    if (isIntervalPaused(prev.timestamp, curr.timestamp, pauseIntervals)) {
      continue;
    }

    const stepMeters = haversineDistance(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude
    );

    // Check GPS signal gap (> 120s)
    if (timeDeltaSeconds > signalGapLimitSec) {
      hasGapWarning = true;
      excludedGapSeconds += timeDeltaSeconds;
      excludedGapMeters += stepMeters;
      continue;
    }

    // Determine interval speed
    // Prefer hardware Doppler speeds from both endpoints if available
    const prevSpeedKmh = parseSpeedKmh(prev.speed);
    const currSpeedKmh = parseSpeedKmh(curr.speed);

    let intervalSpeedKmh: number | null = null;

    if (prevSpeedKmh !== null && currSpeedKmh !== null) {
      // Mean Doppler speed across interval
      intervalSpeedKmh = (prevSpeedKmh + currSpeedKmh) / 2;
    } else if (currSpeedKmh !== null) {
      intervalSpeedKmh = currSpeedKmh;
    } else if (prevSpeedKmh !== null) {
      intervalSpeedKmh = prevSpeedKmh;
    }

    // If speed is missing/null/unknown, DO NOT treat as 0 km/h!
    if (intervalSpeedKmh === null) {
      unanalysedSeconds += timeDeltaSeconds;
      unanalysedMeters += stepMeters;
      continue;
    }

    const targetBand = getSpeedBandForSpeedKmh(intervalSpeedKmh);
    if (!targetBand) {
      unanalysedSeconds += timeDeltaSeconds;
      unanalysedMeters += stepMeters;
      continue;
    }

    bandData[targetBand.id].distanceMeters += stepMeters;
    bandData[targetBand.id].durationSeconds += timeDeltaSeconds;
    validIntervalCount++;
  }

  // 4. Aggregate analysed totals
  let totalAnalysedMeters = 0;
  let totalAnalysedDurationSeconds = 0;

  for (const def of SPEED_BANDS) {
    totalAnalysedMeters += bandData[def.id].distanceMeters;
    totalAnalysedDurationSeconds += bandData[def.id].durationSeconds;
  }

  if (validIntervalCount === 0 || (totalAnalysedMeters === 0 && totalAnalysedDurationSeconds === 0)) {
    return createEmptyResult('Insufficient valid GPS speed samples available to analyse speed bands.');
  }

  const totalAnalysedDistanceKm = Math.round((totalAnalysedMeters / 1000) * 1000) / 1000;
  const excludedGapDistanceKm = Math.round((excludedGapMeters / 1000) * 1000) / 1000;
  const unanalysedDistanceKm = Math.round((unanalysedMeters / 1000) * 1000) / 1000;

  // Authoritative total trip distance/duration fallback
  const totalTripDistKm =
    typeof options?.totalTripDistanceKm === 'number' && options.totalTripDistanceKm > 0
      ? options.totalTripDistanceKm
      : Math.round(((totalAnalysedMeters + excludedGapMeters + unanalysedMeters) / 1000) * 100) / 100;

  const totalTripDurSec =
    typeof options?.totalTripDurationSeconds === 'number' && options.totalTripDurationSeconds > 0
      ? options.totalTripDurationSeconds
      : Math.round(totalAnalysedDurationSeconds + excludedGapSeconds + unanalysedSeconds);

  // 5. Compute metrics and exact proportional percentages
  // Critical rule: Proportional bar length and displayed percentage MUST strictly share the identical denominator
  const bands: SpeedBandMetric[] = SPEED_BANDS.map((band) => {
    const data = bandData[band.id];
    const distKm = Math.round((data.distanceMeters / 1000) * 1000) / 1000;
    const durSec = Math.round(data.durationSeconds);

    const distPct =
      totalAnalysedMeters > 0
        ? (data.distanceMeters / totalAnalysedMeters) * 100
        : 0;

    const timePct =
      totalAnalysedDurationSeconds > 0
        ? (data.durationSeconds / totalAnalysedDurationSeconds) * 100
        : 0;

    const efficiencyInfo = SPEED_BAND_EFFICIENCY_FACTORS[band.id];
    const isEv = options?.fuelType === 'electric' || options?.fuelType === 'ELECTRIC';
    const multiplier = isEv ? efficiencyInfo.evMultiplier : efficiencyInfo.iceMultiplier;

    const effectiveBaseline =
      typeof options?.baselineMileage === 'number' && options.baselineMileage > 0
        ? options.baselineMileage
        : (options?.fuelType ? DEFAULT_BASELINE_MILEAGE[options.fuelType.toLowerCase()] ?? 16.0 : 16.0);

    const estimatedMileage =
      typeof effectiveBaseline === 'number' && effectiveBaseline > 0
        ? Math.round(effectiveBaseline * multiplier * 10) / 10
        : null;

    return {
      band,
      distanceKm: distKm,
      durationSeconds: durSec,
      distancePercentage: Math.round(distPct * 10) / 10,
      timePercentage: Math.round(timePct * 10) / 10,
      estimatedMileage,
      efficiencyMultiplier: multiplier,
      efficiencyRating: efficiencyInfo.rating,
    };
  });

  // 6. Quality and warning messaging
  let qualityWarning: string | null = null;
  if (hasGapWarning && excludedGapSeconds > 0) {
    const gapMin = Math.round(excludedGapSeconds / 60);
    qualityWarning = gapMin > 0
      ? `Signal interruption (${gapMin}m) excluded from speed-band analysis.`
      : `Signal gap (${Math.round(excludedGapSeconds)}s) excluded from speed-band analysis.`;
  } else if (unanalysedSeconds > 0 && totalAnalysedDurationSeconds > 0 && (unanalysedSeconds / (unanalysedSeconds + totalAnalysedDurationSeconds)) > 0.3) {
    qualityWarning = 'Some intervals omitted due to missing or unverified GPS hardware speed.';
  }

  return {
    hasSufficientData: true,
    bands,
    analysedDistanceKm: totalAnalysedDistanceKm,
    analysedDurationSeconds: Math.round(totalAnalysedDurationSeconds),
    totalTripDistanceKm: totalTripDistKm,
    totalTripDurationSeconds: totalTripDurSec,
    excludedGapDistanceKm,
    excludedGapDurationSeconds: Math.round(excludedGapSeconds),
    hasGapWarning,
    qualityWarning,
    reconciliation: {
      totalTripDistanceKm: totalTripDistKm,
      analysedDistanceKm: totalAnalysedDistanceKm,
      excludedGapDistanceKm,
      unanalysedDistanceKm,
      totalTripDurationSeconds: totalTripDurSec,
      analysedDurationSeconds: Math.round(totalAnalysedDurationSeconds),
      excludedGapDurationSeconds: Math.round(excludedGapSeconds),
      unanalysedDurationSeconds: Math.round(unanalysedSeconds),
    },
  };
}
