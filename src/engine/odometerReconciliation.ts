/**
 * Odometer Reconciliation Engine (Pure Logic)
 *
 * Implements deterministic reconciliation rules separating GPS-derived distance estimates,
 * user-confirmed dashboard odometer readings, and canonical vehicle odometer state.
 *
 * KEY RULES:
 * 1. GPS distance is an estimate; dashboard odometer is a user-confirmable reading.
 * 2. Never silently update the canonical vehicle odometer (`vehicles.current_odometer`).
 * 3. Never overwrite a newer canonical reading with an older historical manual trip.
 * 4. Detect stale baselines and conflicts when the vehicle odometer changed during a trip.
 * 5. Editing the dashboard odometer reading never alters the recorded GPS distance.
 * 6. Deleting or editing a fuel or trip entry must not roll back a newer confirmed reading.
 */

export interface BaselineConflictCheckResult {
  hasConflict: boolean;
  reason?: string;
  expectedEstimatedEndOdo: number | null;
}

export interface CanonicalUpdateCheckResult {
  canUpdate: boolean;
  reason?: string;
}

/**
 * Derives the estimated end odometer from a documented start baseline and GPS distance.
 * If no baseline is known, returns null without inventing a start value.
 */
export function calculateEstimatedEndOdometer(
  startOdometer: number | null | undefined,
  distanceKm: number
): number | null {
  if (
    typeof startOdometer !== 'number' ||
    isNaN(startOdometer) ||
    !isFinite(startOdometer) ||
    startOdometer < 0 ||
    distanceKm < 0
  ) {
    return null;
  }
  return Math.round((startOdometer + distanceKm) * 10) / 10;
}

/**
 * Detects whether the vehicle's odometer baseline changed while a trip was in progress
 * (e.g. from an intermediate fuel fill-up or manual odometer edit).
 */
export function detectBaselineConflict(
  tripStartOdometer: number | null | undefined,
  currentVehicleOdometer: number | null | undefined,
  distanceKm: number
): BaselineConflictCheckResult {
  const estimated = calculateEstimatedEndOdometer(tripStartOdometer, distanceKm);

  if (
    typeof tripStartOdometer === 'number' &&
    typeof currentVehicleOdometer === 'number' &&
    tripStartOdometer !== currentVehicleOdometer
  ) {
    return {
      hasConflict: true,
      reason: `Vehicle odometer changed from ${tripStartOdometer} km to ${currentVehicleOdometer} km while this trip was in progress.`,
      expectedEstimatedEndOdo: estimated,
    };
  }

  return {
    hasConflict: false,
    expectedEstimatedEndOdo: estimated,
  };
}

/**
 * Validates whether a proposed odometer reading can update the canonical vehicle odometer.
 * Enforces explicit user confirmation and prevents historical entries from rolling back
 * a higher canonical reading.
 */
export function canUpdateCanonicalOdometer(params: {
  proposedOdometer: number | null | undefined;
  currentCanonicalOdometer: number | null | undefined;
  isExplicitlyConfirmed: boolean;
}): CanonicalUpdateCheckResult {
  const { proposedOdometer, currentCanonicalOdometer, isExplicitlyConfirmed } = params;

  if (!isExplicitlyConfirmed) {
    return {
      canUpdate: false,
      reason: 'Explicit confirmation to update vehicle odometer was not provided.',
    };
  }

  if (
    typeof proposedOdometer !== 'number' ||
    isNaN(proposedOdometer) ||
    !isFinite(proposedOdometer) ||
    proposedOdometer < 0
  ) {
    return {
      canUpdate: false,
      reason: 'Proposed odometer reading must be a valid non-negative number.',
    };
  }

  if (
    typeof currentCanonicalOdometer === 'number' &&
    proposedOdometer < currentCanonicalOdometer
  ) {
    return {
      canUpdate: false,
      reason: `Proposed reading (${proposedOdometer} km) is lower than the current canonical vehicle odometer (${currentCanonicalOdometer} km). Historical entries cannot roll back the odometer.`,
    };
  }

  return { canUpdate: true };
}

/**
 * Validates odometer readings for a manual trip.
 * Enforces start >= 0, end >= 0, and end >= start.
 */
export function validateManualTripOdometers(
  startOdometer: number,
  endOdometer: number
): { isValid: boolean; error?: string; distanceKm: number } {
  if (isNaN(startOdometer) || isNaN(endOdometer) || startOdometer < 0 || endOdometer < 0) {
    return {
      isValid: false,
      error: 'Odometer readings must be valid positive numbers.',
      distanceKm: 0,
    };
  }

  if (endOdometer < startOdometer) {
    return {
      isValid: false,
      error: 'Ending odometer cannot be lower than starting odometer.',
      distanceKm: 0,
    };
  }

  const distanceKm = Math.round((endOdometer - startOdometer) * 10) / 10;
  return {
    isValid: true,
    distanceKm,
  };
}
