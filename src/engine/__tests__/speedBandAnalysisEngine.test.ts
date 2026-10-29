/**
 * Unit Test Suite for Speed & Efficiency Analysis Engine
 *
 * Validates:
 * 1. Exact non-overlapping boundaries: 20, 30, 50, and 80 km/h
 * 2. Negative, non-finite, null, and missing speeds (never treated as 0 km/h)
 * 3. Duplicate, out-of-order, and invalid timestamps
 * 4. Long GPS gaps (>120s) and rejected points
 * 5. Pause boundaries and paused movement (never bridged)
 * 6. Sparse data and insufficient samples (<2 points)
 * 7. Correct distance and time aggregation and percentages
 * 8. Prevention of double-counting
 * 9. Bar proportions and percentages sharing exact same denominator
 * 10. Rounding and short distance precision
 * 11. Time percentages summing consistently against analysed time
 * 12. Reconciliation of analysed distance and gap exclusions
 */

import {
  SPEED_BANDS,
  parseSpeedKmh,
  getSpeedBandForSpeedKmh,
  isIntervalPaused,
  analyzeTripSpeedBands,
} from '@/engine/speedBandAnalysisEngine';

describe('speedBandAnalysisEngine', () => {
  describe('1. Speed Band Boundary Rules & Classification', () => {
    test('exact boundaries: 20, 30, 50, and 80 km/h belong to upper bands and are non-overlapping', () => {
      // 0–<20 km/h
      expect(getSpeedBandForSpeedKmh(0)?.id).toBe('band_0_20');
      expect(getSpeedBandForSpeedKmh(15.5)?.id).toBe('band_0_20');
      expect(getSpeedBandForSpeedKmh(19.999)?.id).toBe('band_0_20');

      // 20 belongs to 20–<30 km/h
      expect(getSpeedBandForSpeedKmh(20.0)?.id).toBe('band_20_30');
      expect(getSpeedBandForSpeedKmh(25.0)?.id).toBe('band_20_30');
      expect(getSpeedBandForSpeedKmh(29.999)?.id).toBe('band_20_30');

      // 30 belongs to 30–<50 km/h
      expect(getSpeedBandForSpeedKmh(30.0)?.id).toBe('band_30_50');
      expect(getSpeedBandForSpeedKmh(40.0)?.id).toBe('band_30_50');
      expect(getSpeedBandForSpeedKmh(49.999)?.id).toBe('band_30_50');

      // 50 belongs to 50–<80 km/h
      expect(getSpeedBandForSpeedKmh(50.0)?.id).toBe('band_50_80');
      expect(getSpeedBandForSpeedKmh(65.0)?.id).toBe('band_50_80');
      expect(getSpeedBandForSpeedKmh(79.999)?.id).toBe('band_50_80');

      // 80 belongs to 80+ km/h
      expect(getSpeedBandForSpeedKmh(80.0)?.id).toBe('band_80_plus');
      expect(getSpeedBandForSpeedKmh(120.0)?.id).toBe('band_80_plus');
    });

    test('invalid and negative speeds return null and are never assigned to 0–20 km/h', () => {
      expect(getSpeedBandForSpeedKmh(-1)).toBeNull();
      expect(getSpeedBandForSpeedKmh(-0.01)).toBeNull();
      expect(getSpeedBandForSpeedKmh(NaN)).toBeNull();
      expect(getSpeedBandForSpeedKmh(Infinity)).toBeNull();
      expect(getSpeedBandForSpeedKmh(-Infinity)).toBeNull();
      expect(getSpeedBandForSpeedKmh(null)).toBeNull();
      expect(getSpeedBandForSpeedKmh(undefined)).toBeNull();
    });

    test('parseSpeedKmh converts m/s to km/h correctly and rejects invalid values', () => {
      // 10 m/s = 36 km/h
      expect(parseSpeedKmh(10)).toBeCloseTo(36, 4);
      // 0 m/s = 0 km/h
      expect(parseSpeedKmh(0)).toBe(0);
      // 22.222 m/s ~ 80 km/h
      expect(parseSpeedKmh(80 / 3.6)).toBeCloseTo(80, 4);

      // Rejections
      expect(parseSpeedKmh(-1)).toBeNull();
      expect(parseSpeedKmh(null)).toBeNull();
      expect(parseSpeedKmh(undefined)).toBeNull();
      expect(parseSpeedKmh(NaN)).toBeNull();
      expect(parseSpeedKmh(Infinity)).toBeNull();
    });
  });

  describe('2. Pause Boundary Handling', () => {
    test('isIntervalPaused detects when interval intersects pause window', () => {
      const pauses = [{ paused_at: 10000, resumed_at: 20000 }];

      // Fully before pause
      expect(isIntervalPaused(1000, 5000, pauses)).toBe(false);

      // Spanning across pause window
      expect(isIntervalPaused(9000, 21000, pauses)).toBe(true);

      // Inside pause window
      expect(isIntervalPaused(12000, 15000, pauses)).toBe(true);

      // Starting at paused_at and ending at resumed_at
      expect(isIntervalPaused(10000, 20000, pauses)).toBe(true);

      // Fully after pause
      expect(isIntervalPaused(21000, 25000, pauses)).toBe(false);
    });

    test('paused movement is strictly excluded from active speed bands and active duration', () => {
      // Moving at ~36 km/h (10 m/s) between (12.9716, 77.5946) and (12.9720, 77.5950)
      const locations = [
        { latitude: 12.9716, longitude: 77.5946, timestamp: 1000, speed: 10, is_rejected: 0 },
        { latitude: 12.9720, longitude: 77.5950, timestamp: 6000, speed: 10, is_rejected: 0 },
        // Displaced movement while paused
        { latitude: 12.9750, longitude: 77.5980, timestamp: 15000, speed: 10, is_rejected: 0 },
        // Resumed movement
        { latitude: 12.9755, longitude: 77.5985, timestamp: 20000, speed: 10, is_rejected: 0 },
      ];

      const pauses = [{ paused_at: 6000, resumed_at: 15000 }];

      const result = analyzeTripSpeedBands(locations, { pauseIntervals: pauses });
      expect(result.hasSufficientData).toBe(true);

      // Only segments (1000->6000 = 5s) and (15000->20000 = 5s) should be analysed
      expect(result.analysedDurationSeconds).toBe(10);
      // Segment spanning pause (6000 -> 15000) was excluded
      const band30_50 = result.bands.find((b) => b.band.id === 'band_30_50');
      expect(band30_50?.durationSeconds).toBe(10);
      expect(band30_50?.timePercentage).toBe(100);
    });
  });

  describe('3. GPS Signal Gap & Rejection Handling', () => {
    test('excludes signal gaps (>120s) from speed bands and flags gap warning', () => {
      const locations = [
        { latitude: 12.9716, longitude: 77.5946, timestamp: 1000, speed: 15, is_rejected: 0 },
        { latitude: 12.9726, longitude: 77.5956, timestamp: 11000, speed: 15, is_rejected: 0 }, // 10s at ~54 km/h
        // Big signal gap: 200 seconds later
        { latitude: 12.9800, longitude: 77.6000, timestamp: 211000, speed: 15, is_rejected: 0 },
        // Next normal point: 10s later
        { latitude: 12.9810, longitude: 77.6010, timestamp: 221000, speed: 15, is_rejected: 0 },
      ];

      const result = analyzeTripSpeedBands(locations);
      expect(result.hasSufficientData).toBe(true);
      expect(result.hasGapWarning).toBe(true);
      expect(result.excludedGapDurationSeconds).toBe(200);
      expect(result.excludedGapDistanceKm).toBeGreaterThan(0);

      // Analysed duration must only be the two 10s segments = 20s
      expect(result.analysedDurationSeconds).toBe(20);
      expect(result.qualityWarning).toContain('Signal interruption');
    });

    test('ignores rejected GPS points completely', () => {
      const locations = [
        { latitude: 12.9716, longitude: 77.5946, timestamp: 1000, speed: 5, is_rejected: 0 },
        // Rejected points (jitter, poor accuracy)
        { latitude: 12.9717, longitude: 77.5947, timestamp: 2000, speed: 50, is_rejected: 1 },
        { latitude: 12.9999, longitude: 77.9999, timestamp: 3000, speed: 200, is_rejected: 1 },
        // Next accepted point 4s after first
        { latitude: 12.9720, longitude: 77.5950, timestamp: 5000, speed: 5, is_rejected: 0 },
      ];

      const result = analyzeTripSpeedBands(locations);
      expect(result.hasSufficientData).toBe(true);
      // Exactly 1 valid interval of 4s
      expect(result.analysedDurationSeconds).toBe(4);
      // Speed 5 m/s = 18 km/h -> band_0_20
      const band0_20 = result.bands.find((b) => b.band.id === 'band_0_20');
      expect(band0_20?.durationSeconds).toBe(4);
      expect(band0_20?.timePercentage).toBe(100);
    });
  });

  describe('4. Timestamps & Unknown Speed Handling', () => {
    test('safely handles duplicate and out-of-order timestamps without negative or zero duration', () => {
      const locations = [
        // Out of order timestamps
        { latitude: 12.9720, longitude: 77.5950, timestamp: 5000, speed: 10, is_rejected: 0 },
        { latitude: 12.9716, longitude: 77.5946, timestamp: 1000, speed: 10, is_rejected: 0 },
        // Duplicate timestamp
        { latitude: 12.9721, longitude: 77.5951, timestamp: 5000, speed: 10, is_rejected: 0 },
        // Normal progression
        { latitude: 12.9725, longitude: 77.5955, timestamp: 10000, speed: 10, is_rejected: 0 },
      ];

      const result = analyzeTripSpeedBands(locations);
      expect(result.hasSufficientData).toBe(true);
      // Points sorted: 1000 -> 5000 (4s), duplicate 5000 skipped, 5000 -> 10000 (5s) => total 9s
      expect(result.analysedDurationSeconds).toBe(9);
      expect(result.analysedDistanceKm).toBeGreaterThan(0);
    });

    test('missing or negative speeds are not treated as 0 km/h and are excluded from speed bands', () => {
      const locations = [
        { latitude: 12.9716, longitude: 77.5946, timestamp: 1000, speed: null, is_rejected: 0 },
        { latitude: 12.9720, longitude: 77.5950, timestamp: 5000, speed: -1, is_rejected: 0 },
        { latitude: 12.9725, longitude: 77.5955, timestamp: 9000, speed: undefined, is_rejected: 0 },
        { latitude: 12.9730, longitude: 77.5960, timestamp: 13000, speed: NaN, is_rejected: 0 },
      ];

      const result = analyzeTripSpeedBands(locations);
      // Since all speeds were unknown/missing, none could be assigned to 0–20 km/h!
      expect(result.hasSufficientData).toBe(false);
      expect(result.insufficientDataReason).toContain('Insufficient valid GPS speed samples');
      const band0_20 = result.bands.find((b) => b.band.id === 'band_0_20');
      expect(band0_20?.distanceKm).toBe(0);
      expect(band0_20?.durationSeconds).toBe(0);
    });
  });

  describe('5. Sparse Data & Insufficient Samples', () => {
    test('returns hasSufficientData: false for empty array', () => {
      const result = analyzeTripSpeedBands([]);
      expect(result.hasSufficientData).toBe(false);
      expect(result.insufficientDataReason).toContain('No GPS coordinates');
      expect(result.bands).toHaveLength(5);
    });

    test('returns hasSufficientData: false for 1 point (stationary baseline)', () => {
      const result = analyzeTripSpeedBands([
        { latitude: 12.9716, longitude: 77.5946, timestamp: 1000, speed: 0, is_rejected: 0 },
      ]);
      expect(result.hasSufficientData).toBe(false);
      expect(result.insufficientDataReason).toContain('Only 1 valid GPS coordinate point');
    });

    test('returns hasSufficientData: false if all points are rejected', () => {
      const result = analyzeTripSpeedBands([
        { latitude: 12.9716, longitude: 77.5946, timestamp: 1000, speed: 10, is_rejected: 1 },
        { latitude: 12.9720, longitude: 77.5950, timestamp: 2000, speed: 10, is_rejected: 1 },
      ]);
      expect(result.hasSufficientData).toBe(false);
      expect(result.insufficientDataReason).toContain('All GPS coordinates were filtered');
    });
  });

  describe('6. Distance & Time Aggregation, Proportions & Reconciliation', () => {
    test('proportional bar percentages and displayed values share identical denominators', () => {
      // Create a trip with segments in multiple speed bands:
      // Band 0_20: 10 km/h (2.78 m/s) for 10s
      // Band 20_30: 25 km/h (6.94 m/s) for 10s
      // Band 50_80: 60 km/h (16.67 m/s) for 20s
      const locations = [
        { latitude: 12.9700, longitude: 77.5900, timestamp: 1000, speed: 10 / 3.6, is_rejected: 0 },
        { latitude: 12.9702, longitude: 77.5902, timestamp: 11000, speed: 10 / 3.6, is_rejected: 0 }, // 10s in 0–20 (mean 10)
        { latitude: 12.9708, longitude: 77.5908, timestamp: 21000, speed: 25 / 3.6, is_rejected: 0 }, // 10s (mean 17.5 in 0–20)
        { latitude: 12.9715, longitude: 77.5915, timestamp: 31000, speed: 25 / 3.6, is_rejected: 0 }, // 10s in 20–30 (mean 25)
        { latitude: 12.9735, longitude: 77.5935, timestamp: 51000, speed: 65 / 3.6, is_rejected: 0 }, // 20s (mean 45 in 30–50)
      ];

      const result = analyzeTripSpeedBands(locations);
      expect(result.hasSufficientData).toBe(true);

      // 4 segments: 10s + 10s + 10s + 20s = 50s
      expect(result.analysedDurationSeconds).toBe(50);
      expect(result.analysedDistanceKm).toBeGreaterThan(0);

      // Check sum of distance across bands matches analysedDistanceKm
      const sumBandDist = result.bands.reduce((sum, b) => sum + b.distanceKm, 0);
      expect(sumBandDist).toBeCloseTo(result.analysedDistanceKm, 2);

      // Check time percentages
      const b0_20 = result.bands.find((b) => b.band.id === 'band_0_20')!;
      const b20_30 = result.bands.find((b) => b.band.id === 'band_20_30')!;
      const b30_50 = result.bands.find((b) => b.band.id === 'band_30_50')!;

      // 20s out of 50s = 40%
      expect(b0_20.durationSeconds).toBe(20);
      expect(b0_20.timePercentage).toBe(40);

      // 10s out of 50s = 20%
      expect(b20_30.durationSeconds).toBe(10);
      expect(b20_30.timePercentage).toBe(20);

      // 20s out of 50s = 40%
      expect(b30_50.durationSeconds).toBe(20);
      expect(b30_50.timePercentage).toBe(40);

      // Time % across all bands sums to 100%
      const sumTimePct = result.bands.reduce((sum, b) => sum + b.timePercentage, 0);
      expect(sumTimePct).toBeCloseTo(100, 1);

      // Distance % across all bands sums to 100%
      const sumDistPct = result.bands.reduce((sum, b) => sum + b.distancePercentage, 0);
      expect(sumDistPct).toBeCloseTo(100, 1);
    });

    test('reconciliation accounts for gaps and total trip distance', () => {
      const locations = [
        { latitude: 12.9700, longitude: 77.5900, timestamp: 1000, speed: 20 / 3.6, is_rejected: 0 },
        { latitude: 12.9705, longitude: 77.5905, timestamp: 11000, speed: 20 / 3.6, is_rejected: 0 },
        // Gap of 300s
        { latitude: 12.9750, longitude: 77.5950, timestamp: 311000, speed: 20 / 3.6, is_rejected: 0 },
        { latitude: 12.9755, longitude: 77.5955, timestamp: 321000, speed: 20 / 3.6, is_rejected: 0 },
      ];

      const result = analyzeTripSpeedBands(locations, { totalTripDistanceKm: 1.5 });
      expect(result.reconciliation.totalTripDistanceKm).toBe(1.5);
      expect(result.reconciliation.excludedGapDurationSeconds).toBe(300);
      expect(result.reconciliation.analysedDurationSeconds).toBe(20);
      expect(result.reconciliation.excludedGapDistanceKm).toBeGreaterThan(0);
    });

    test('calculates speed-range mileage and assigns efficiency multipliers and ratings', () => {
      const locations = [
        // 0–20 km/h: 15 km/h for 10s
        { latitude: 12.9700, longitude: 77.5900, timestamp: 1000, speed: 15 / 3.6, is_rejected: 0 },
        { latitude: 12.9704, longitude: 77.5904, timestamp: 11000, speed: 15 / 3.6, is_rejected: 0 },
        // 50–80 km/h: 60 km/h for 20s
        { latitude: 12.9710, longitude: 77.5910, timestamp: 12000, speed: 60 / 3.6, is_rejected: 0 },
        { latitude: 12.9730, longitude: 77.5930, timestamp: 32000, speed: 60 / 3.6, is_rejected: 0 },
      ];

      // Diesel vehicle with 20.0 km/L baseline
      const result = analyzeTripSpeedBands(locations, {
        baselineMileage: 20.0,
        fuelType: 'diesel',
      });

      const band0_20 = result.bands.find((b) => b.band.id === 'band_0_20')!;
      const band50_80 = result.bands.find((b) => b.band.id === 'band_50_80')!;

      // 0–20 crawling: 0.60x multiplier -> 20.0 * 0.60 = 12.0 km/L
      expect(band0_20.efficiencyMultiplier).toBe(0.60);
      expect(band0_20.estimatedMileage).toBe(12.0);
      expect(band0_20.efficiencyRating).toBe('Stop & Go');

      // 50–80 cruising: 1.25x multiplier (sweet spot) -> 20.0 * 1.25 = 25.0 km/L
      expect(band50_80.efficiencyMultiplier).toBe(1.25);
      expect(band50_80.estimatedMileage).toBe(25.0);
      expect(band50_80.efficiencyRating).toBe('Optimal (Sweet Spot)');
    });
  });
});
