/**
 * Odometer Reconciliation Test Suite
 *
 * Verifies pure engine logic for:
 * - GPS-derived distance estimates vs user-confirmed dashboard readings
 * - Baseline tracking and conflict detection (intermediate refuels or manual edits)
 * - Safe canonical vehicle odometer updates with explicit user confirmation
 * - Historical entry protections (cannot roll canonical odometer backwards)
 * - Manual trip odometer validation
 */

import {
  calculateEstimatedEndOdometer,
  detectBaselineConflict,
  canUpdateCanonicalOdometer,
  validateManualTripOdometers,
} from '../odometerReconciliation';

describe('Odometer Reconciliation Engine', () => {
  describe('calculateEstimatedEndOdometer', () => {
    it('calculates estimated end odometer when baseline is known', () => {
      expect(calculateEstimatedEndOdometer(10000, 45.3)).toBe(10045.3);
      expect(calculateEstimatedEndOdometer(25420.5, 12.8)).toBe(25433.3);
      expect(calculateEstimatedEndOdometer(0, 15.2)).toBe(15.2);
    });

    it('returns null when baseline is unknown (never invents a start value)', () => {
      expect(calculateEstimatedEndOdometer(null, 45.3)).toBeNull();
      expect(calculateEstimatedEndOdometer(undefined, 45.3)).toBeNull();
      expect(calculateEstimatedEndOdometer(NaN, 45.3)).toBeNull();
    });

    it('returns null for negative baseline or negative distance', () => {
      expect(calculateEstimatedEndOdometer(-100, 50)).toBeNull();
      expect(calculateEstimatedEndOdometer(10000, -10)).toBeNull();
    });

    it('handles zero distance cleanly', () => {
      expect(calculateEstimatedEndOdometer(12345, 0)).toBe(12345);
    });
  });

  describe('detectBaselineConflict', () => {
    it('returns no conflict when trip baseline matches vehicle odometer', () => {
      const result = detectBaselineConflict(15000, 15000, 25.4);
      expect(result.hasConflict).toBe(false);
      expect(result.expectedEstimatedEndOdo).toBe(15025.4);
      expect(result.reason).toBeUndefined();
    });

    it('detects conflict when vehicle odometer was updated during active trip (e.g. refuel)', () => {
      // Trip started at 15000. While recording, a fuel entry was saved at 15050.
      const result = detectBaselineConflict(15000, 15050, 25.4);
      expect(result.hasConflict).toBe(true);
      expect(result.reason).toContain('Vehicle odometer changed from 15000 km to 15050 km');
      expect(result.expectedEstimatedEndOdo).toBe(15025.4);
    });

    it('handles null trip baseline without false conflict', () => {
      const result = detectBaselineConflict(null, 15000, 25.4);
      expect(result.hasConflict).toBe(false);
      expect(result.expectedEstimatedEndOdo).toBeNull();
    });

    it('handles null current vehicle odometer without false conflict', () => {
      const result = detectBaselineConflict(15000, null, 25.4);
      expect(result.hasConflict).toBe(false);
      expect(result.expectedEstimatedEndOdo).toBe(15025.4);
    });
  });

  describe('canUpdateCanonicalOdometer', () => {
    it('rejects update if explicit user confirmation is missing', () => {
      const result = canUpdateCanonicalOdometer({
        proposedOdometer: 15100,
        currentCanonicalOdometer: 15000,
        isExplicitlyConfirmed: false,
      });
      expect(result.canUpdate).toBe(false);
      expect(result.reason).toContain('Explicit confirmation');
    });

    it('rejects historical readings lower than current canonical odometer', () => {
      const result = canUpdateCanonicalOdometer({
        proposedOdometer: 14500,
        currentCanonicalOdometer: 15000,
        isExplicitlyConfirmed: true,
      });
      expect(result.canUpdate).toBe(false);
      expect(result.reason).toContain('Historical entries cannot roll back the odometer');
    });

    it('allows valid progressive reading with explicit confirmation', () => {
      const result = canUpdateCanonicalOdometer({
        proposedOdometer: 15050,
        currentCanonicalOdometer: 15000,
        isExplicitlyConfirmed: true,
      });
      expect(result.canUpdate).toBe(true);
    });

    it('allows update when vehicle has no prior odometer reading (null)', () => {
      const result = canUpdateCanonicalOdometer({
        proposedOdometer: 520,
        currentCanonicalOdometer: null,
        isExplicitlyConfirmed: true,
      });
      expect(result.canUpdate).toBe(true);
    });

    it('allows setting odometer equal to current canonical reading', () => {
      const result = canUpdateCanonicalOdometer({
        proposedOdometer: 15000,
        currentCanonicalOdometer: 15000,
        isExplicitlyConfirmed: true,
      });
      expect(result.canUpdate).toBe(true);
    });

    it('rejects invalid or non-numeric proposed readings', () => {
      expect(
        canUpdateCanonicalOdometer({
          proposedOdometer: null,
          currentCanonicalOdometer: 15000,
          isExplicitlyConfirmed: true,
        }).canUpdate
      ).toBe(false);

      expect(
        canUpdateCanonicalOdometer({
          proposedOdometer: -50,
          currentCanonicalOdometer: 15000,
          isExplicitlyConfirmed: true,
        }).canUpdate
      ).toBe(false);

      expect(
        canUpdateCanonicalOdometer({
          proposedOdometer: NaN,
          currentCanonicalOdometer: 15000,
          isExplicitlyConfirmed: true,
        }).canUpdate
      ).toBe(false);
    });
  });

  describe('validateManualTripOdometers', () => {
    it('validates correct manual readings and calculates distance', () => {
      const result = validateManualTripOdometers(12000, 12150.5);
      expect(result.isValid).toBe(true);
      expect(result.distanceKm).toBe(150.5);
      expect(result.error).toBeUndefined();
    });

    it('rejects when ending odometer is lower than starting odometer', () => {
      const result = validateManualTripOdometers(12150, 12000);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Ending odometer cannot be lower than starting odometer');
    });

    it('rejects negative or invalid odometer values', () => {
      expect(validateManualTripOdometers(-100, 50).isValid).toBe(false);
      expect(validateManualTripOdometers(100, -50).isValid).toBe(false);
      expect(validateManualTripOdometers(NaN, 100).isValid).toBe(false);
      expect(validateManualTripOdometers(100, NaN).isValid).toBe(false);
    });

    it('allows zero distance trip (end equals start)', () => {
      const result = validateManualTripOdometers(15000, 15000);
      expect(result.isValid).toBe(true);
      expect(result.distanceKm).toBe(0);
    });
  });
});
