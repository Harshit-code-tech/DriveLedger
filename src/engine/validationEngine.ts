/**
 * Validation Engine
 *
 * Data validation rules for all user inputs in DriveLedger.
 * These functions return validation results — they do NOT throw errors.
 * The UI layer decides whether to reject, warn, or accept.
 *
 * ═══════════════════════════════════════════════════════════════════
 * VALIDATION PHILOSOPHY
 * ═══════════════════════════════════════════════════════════════════
 *
 * There are two types of validation results:
 *   1. ERROR   → The input is invalid. The UI must block save.
 *   2. WARNING → The input is unusual. The UI shows a warning
 *                but allows save with confirmation.
 *
 * This matches the charter's validation rules exactly:
 *   - Odometer < previous → ❌ Reject
 *   - Odometer = previous → ⚠️ Warning
 *   - Litres > tank capacity → ⚠️ Warning
 *   - Date is in the future → ⚠️ Warning
 *   - Litres = 0 or negative → ❌ Reject
 *   etc.
 */

import { FuelType, FuelUnit, isHybridFuel } from '@/constants/fuelTypes';

// ─── Types ───────────────────────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationResult {
  /** Whether the validation passed */
  isValid: boolean;
  /** List of issues found (empty if valid) */
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  /** The field that has the issue */
  field: string;
  /** Whether this blocks saving (error) or just warns (warning) */
  severity: ValidationSeverity;
  /** Human-readable message for the user */
  message: string;
}

// ─── Fuel Entry Validation ──────────────────────────────────────────

/**
 * Validates a fuel entry before saving.
 *
 * @param input - The fuel entry data to validate
 * @param previousOdometer - The most recent odometer reading for this vehicle (null if first entry)
 * @param tankCapacity - The vehicle's primary tank capacity (null if not set)
 * @param vehicleFuelType - The vehicle's fuel type
 * @param secondaryTankCapacity - The vehicle's secondary tank capacity for hybrids (null if not set)
 * @returns ValidationResult with any errors and warnings
 */
export function validateFuelEntry(
  input: {
    odometer: number;
    fuel_amount: number;
    fuel_unit: FuelUnit;
    price_per_unit: number;
    date: string;
    fuel_system?: 'primary' | 'secondary';
    battery_start_percent?: number | null;
    battery_end_percent?: number | null;
  },
  previousOdometer: number | null,
  tankCapacity: number | null,
  vehicleFuelType: FuelType,
  secondaryTankCapacity?: number | null
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const isHybrid = isHybridFuel(vehicleFuelType);

  // ── Odometer validation ──

  if (input.odometer <= 0) {
    issues.push({
      field: 'odometer',
      severity: 'error',
      message: 'Odometer reading must be greater than 0.',
    });
  } else if (previousOdometer !== null) {
    if (input.odometer < previousOdometer) {
      issues.push({
        field: 'odometer',
        severity: 'error',
        message: `Odometer can't be lower than the previous reading (${previousOdometer}).`,
      });
    } else if (input.odometer === previousOdometer) {
      issues.push({
        field: 'odometer',
        severity: 'warning',
        message: 'Odometer is the same as the previous reading. Are you sure?',
      });
    }
  }

  // ── Fuel amount validation ──

  if (input.fuel_amount <= 0) {
    issues.push({
      field: 'fuel_amount',
      severity: 'error',
      message: 'Fuel amount must be greater than 0.',
    });
  }

  const effectiveTankCapacity =
    isHybrid && input.fuel_system === 'secondary'
      ? (secondaryTankCapacity ?? null)
      : tankCapacity;

  if (effectiveTankCapacity !== null && input.fuel_amount > effectiveTankCapacity) {
    issues.push({
      field: 'fuel_amount',
      severity: 'warning',
      message: `Fuel amount (${input.fuel_amount}) exceeds the tank capacity (${effectiveTankCapacity}). Are you sure?`,
    });
  }

  // ── Price validation ──

  if (input.price_per_unit <= 0) {
    issues.push({
      field: 'price_per_unit',
      severity: 'error',
      message: 'Price per unit must be greater than 0.',
    });
  }

  // ── Date validation ──

  if (!input.date || !input.date.trim()) {
    issues.push({
      field: 'date',
      severity: 'error',
      message: 'Date is required.',
    });
  } else {
    const entryDate = new Date(input.date);
    if (isNaN(entryDate.getTime())) {
      issues.push({
        field: 'date',
        severity: 'error',
        message: 'Invalid date format.',
      });
    } else {
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today
      if (entryDate > today) {
        issues.push({
          field: 'date',
          severity: 'warning',
          message: 'This date is in the future. Are you sure?',
        });
      }
    }
  }

  // ── EV specific validation ──
  if (vehicleFuelType === FuelType.ELECTRIC) {
    if (input.fuel_unit !== FuelUnit.KWH) {
      issues.push({
        field: 'fuel_unit',
        severity: 'error',
        message: 'Electric vehicles must log energy in kWh.',
      });
    }

    if (input.battery_start_percent != null) {
      if (input.battery_start_percent < 0 || input.battery_start_percent > 100) {
        issues.push({
          field: 'battery_start_percent',
          severity: 'error',
          message: 'Starting battery % must be between 0 and 100.',
        });
      }
    }

    if (input.battery_end_percent != null) {
      if (input.battery_end_percent < 0 || input.battery_end_percent > 100) {
        issues.push({
          field: 'battery_end_percent',
          severity: 'error',
          message: 'Ending battery % must be between 0 and 100.',
        });
      }
    }

    if (
      input.battery_start_percent != null &&
      input.battery_end_percent != null &&
      input.battery_end_percent <= input.battery_start_percent
    ) {
      issues.push({
        field: 'battery_end_percent',
        severity: 'error',
        message: 'Ending battery % must be higher than starting battery %.',
      });
    }
  }

  // ── Fuel unit / fuel type cross-validation ──
  // Pure CNG/LPG should use kg, not litres
  if (
    (vehicleFuelType === FuelType.CNG || vehicleFuelType === FuelType.LPG) &&
    input.fuel_unit === FuelUnit.LITRES
  ) {
    issues.push({
      field: 'fuel_unit',
      severity: 'error',
      message: `${vehicleFuelType.toUpperCase()} vehicles should use kg, not litres. Please correct the fuel unit.`,
    });
  }

  // Hybrid checks
  if (isHybrid) {
    if (input.fuel_system === 'primary' && input.fuel_unit !== FuelUnit.KG) {
      issues.push({
        field: 'fuel_unit',
        severity: 'warning',
        message: 'Primary tank (CNG/LPG) is normally filled in kg.',
      });
    } else if (input.fuel_system === 'secondary' && input.fuel_unit !== FuelUnit.LITRES) {
      issues.push({
        field: 'fuel_unit',
        severity: 'warning',
        message: 'Secondary tank (Petrol/Diesel) is normally filled in litres.',
      });
    }
  }

  // Determine overall validity (errors block, warnings don't)
  const hasErrors = issues.some((i) => i.severity === 'error');

  return {
    isValid: !hasErrors,
    issues,
  };
}

// ─── Vehicle Validation ─────────────────────────────────────────────

/**
 * Validates vehicle creation/update input.
 */
export function validateVehicle(input: {
  nickname: string;
  registration_number: string;
}): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!input.nickname || input.nickname.trim().length === 0) {
    issues.push({
      field: 'nickname',
      severity: 'error',
      message: 'Vehicle name is required.',
    });
  }

  if (!input.registration_number || input.registration_number.trim().length === 0) {
    issues.push({
      field: 'registration_number',
      severity: 'error',
      message: 'Registration number is required.',
    });
  }

  const hasErrors = issues.some((i) => i.severity === 'error');
  return { isValid: !hasErrors, issues };
}

// ─── Expense Validation ─────────────────────────────────────────────

/**
 * Validates expense creation/update input.
 */
export function validateExpense(input: {
  amount: number;
  date: string;
}): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (input.amount <= 0) {
    issues.push({
      field: 'amount',
      severity: 'error',
      message: 'Amount must be greater than 0.',
    });
  }

  if (!input.date || !input.date.trim()) {
    issues.push({
      field: 'date',
      severity: 'error',
      message: 'Date is required.',
    });
  } else {
    const entryDate = new Date(input.date);
    if (isNaN(entryDate.getTime())) {
      issues.push({
        field: 'date',
        severity: 'error',
        message: 'Invalid date format.',
      });
    } else {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (entryDate > today) {
        issues.push({
          field: 'date',
          severity: 'warning',
          message: 'This date is in the future. Are you sure?',
        });
      }
    }
  }

  const hasErrors = issues.some((i) => i.severity === 'error');
  return { isValid: !hasErrors, issues };
}

// ─── Helper ─────────────────────────────────────────────────────────

/**
 * Convenience function to check if a validation result has warnings only
 * (no errors). Used by the UI to decide whether to show a confirmation dialog.
 */
export function hasWarningsOnly(result: ValidationResult): boolean {
  return result.isValid && result.issues.length > 0;
}
