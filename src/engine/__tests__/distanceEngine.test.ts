/**
 * Distance Engine Unit Tests
 *
 * Verifies GPS coordinate validation, filtering of noise/drift/jumps,
 * Haversine geodetic calculation with explicit tolerances, and gap detection.
 */

import {
  haversineDistance,
  isValidCoordinate,
  filterAndCalculateTripDistance,
  processLocationSample,
  MAX_ACCEPTABLE_ACCURACY_METERS,
  DRIFT_DISTANCE_THRESHOLD_METERS,
  MAX_PLAUSIBLE_SPEED_MPS,
} from '../distanceEngine';
import type { RawLocationSample } from '@/types/trip';

describe('DistanceEngine — Geodesy & Validation', () => {
  test('haversineDistance calculates known coordinate distance accurately', () => {
    // Connaught Place, New Delhi (28.6315, 77.2167) to Cyber City, Gurugram (28.4950, 77.0895)
    // Geodesic distance is approximately 19.5 km (19,500m ± 100m)
    const dist = haversineDistance(28.6315, 77.2167, 28.495, 77.0895);
    expect(dist).toBeGreaterThan(19300);
    expect(dist).toBeLessThan(19700);

    // Identical coordinates return 0
    expect(haversineDistance(28.6315, 77.2167, 28.6315, 77.2167)).toBe(0);
  });

  test('isValidCoordinate validates coordinates and timestamps strictly', () => {
    expect(isValidCoordinate({ latitude: 28.6, longitude: 77.2, timestamp: 1700000000000 })).toBe(true);
    // Out of range latitude
    expect(isValidCoordinate({ latitude: 91.0, longitude: 77.2, timestamp: 1700000000000 })).toBe(false);
    expect(isValidCoordinate({ latitude: -91.0, longitude: 77.2, timestamp: 1700000000000 })).toBe(false);
    // Out of range longitude
    expect(isValidCoordinate({ latitude: 28.6, longitude: 181.0, timestamp: 1700000000000 })).toBe(false);
    expect(isValidCoordinate({ latitude: 28.6, longitude: -185.0, timestamp: 1700000000000 })).toBe(false);
    // Invalid / NaN / negative timestamp
    expect(isValidCoordinate({ latitude: 28.6, longitude: 77.2, timestamp: 0 })).toBe(false);
    expect(isValidCoordinate({ latitude: 28.6, longitude: 77.2, timestamp: -500 })).toBe(false);
    expect(isValidCoordinate({ latitude: NaN, longitude: 77.2, timestamp: 1700000000000 })).toBe(false);
    expect(isValidCoordinate({ latitude: 28.6, longitude: Infinity, timestamp: 1700000000000 })).toBe(false);
  });
});

describe('DistanceEngine — Noise & Drift Filtering', () => {
  const baseTime = 1700000000000;

  test('rejects samples with poor horizontal accuracy (> 35m)', () => {
    const samples: RawLocationSample[] = [
      { latitude: 28.631, longitude: 77.216, accuracy: 10, timestamp: baseTime },
      { latitude: 28.632, longitude: 77.217, accuracy: 50, timestamp: baseTime + 5000 }, // Rejected (>35m)
      { latitude: 28.633, longitude: 77.218, accuracy: 8, timestamp: baseTime + 10000 },
    ];

    const result = filterAndCalculateTripDistance(samples);
    expect(result.acceptedSamplesCount).toBe(2);
    expect(result.rejectedSamplesCount).toBe(1);
    expect(result.rejectionCounts.poor_accuracy).toBe(1);
  });

  test('filters stationary drift when vehicle is stationary (< 4m movements)', () => {
    // 0.00001 degrees latitude is roughly 1.1 meters
    const samples: RawLocationSample[] = [
      { latitude: 28.63100, longitude: 77.21600, accuracy: 10, timestamp: baseTime },
      { latitude: 28.63101, longitude: 77.21601, accuracy: 10, timestamp: baseTime + 3000 }, // ~1.5m jitter
      { latitude: 28.63100, longitude: 77.21602, accuracy: 10, timestamp: baseTime + 6000 }, // ~2m jitter
      { latitude: 28.63200, longitude: 77.21700, accuracy: 10, timestamp: baseTime + 15000 }, // Real movement (>100m)
    ];

    const result = filterAndCalculateTripDistance(samples);
    expect(result.rejectionCounts.stationary_drift).toBe(2);
    expect(result.acceptedSamplesCount).toBe(2);
  });

  test('rejects implausible speed teleportation jumps (> 55.5 m/s / 200 km/h)', () => {
    const samples: RawLocationSample[] = [
      { latitude: 28.6310, longitude: 77.2160, accuracy: 10, timestamp: baseTime },
      // 1 second later, 1km away = 1000 m/s (glitch)
      { latitude: 28.6400, longitude: 77.2160, accuracy: 10, timestamp: baseTime + 1000 },
      // Valid follow-up movement: 50 meters in 5 seconds = 10 m/s (36 km/h)
      { latitude: 28.6315, longitude: 77.2160, accuracy: 10, timestamp: baseTime + 5000 },
    ];

    const result = filterAndCalculateTripDistance(samples);
    expect(result.rejectionCounts.implausible_speed).toBe(1);
    expect(result.acceptedSamplesCount).toBe(2);
  });

  test('rejects stale or duplicate timestamps', () => {
    const samples: RawLocationSample[] = [
      { latitude: 28.6310, longitude: 77.2160, accuracy: 10, timestamp: baseTime },
      { latitude: 28.6320, longitude: 77.2170, accuracy: 10, timestamp: baseTime }, // duplicate timestamp
      { latitude: 28.6315, longitude: 77.2165, accuracy: 10, timestamp: baseTime - 1000 }, // past timestamp
      { latitude: 28.6325, longitude: 77.2175, accuracy: 10, timestamp: baseTime + 5000 }, // valid
    ];

    const result = filterAndCalculateTripDistance(samples);
    expect(result.rejectionCounts.stale_or_duplicate_timestamp).toBe(2);
  });

  test('flags gap warning when signal interruption exceeds 120 seconds', () => {
    const samples: RawLocationSample[] = [
      { latitude: 28.6310, longitude: 77.2160, accuracy: 10, timestamp: baseTime },
      // 180s later (tunnel / reception blackout)
      { latitude: 28.6350, longitude: 77.2200, accuracy: 10, timestamp: baseTime + 180000 },
    ];

    const result = filterAndCalculateTripDistance(samples);
    expect(result.hasGapWarning).toBe(true);
    expect(result.qualityWarning).toContain('GPS signal interruption');
  });

  test('processLocationSample handles real-time single fix evaluation correctly', () => {
    const fix1: RawLocationSample = {
      latitude: 28.6310,
      longitude: 77.2160,
      accuracy: 10,
      timestamp: baseTime,
    };
    const res1 = processLocationSample(fix1, null);
    expect(res1.rejected).toBe(false);
    expect(res1.sample?.isAccepted).toBe(true);
    expect(res1.deltaKm).toBe(0);

    // Fix 2: 2m jitter -> rejected
    const fix2: RawLocationSample = {
      latitude: 28.63101,
      longitude: 77.21601,
      accuracy: 10,
      timestamp: baseTime + 2000,
    };
    const res2 = processLocationSample(fix2, fix1);
    expect(res2.rejected).toBe(true);
    expect(res2.reason).toBe('stationary_drift');

    // Fix 3: valid driving movement (100m in 10s)
    const fix3: RawLocationSample = {
      latitude: 28.6320,
      longitude: 77.2160,
      accuracy: 12,
      timestamp: baseTime + 10000,
    };
    const res3 = processLocationSample(fix3, fix1);
    expect(res3.rejected).toBe(false);
    expect(res3.deltaKm).toBeGreaterThan(0.08);
  });
});
