/**
 * Fuel Entry Types
 *
 * TypeScript interface for the `fuel_entries` table.
 * Matches the charter's database schema.
 *
 * WHY this exists:
 * - Type safety for all fuel-related CRUD operations.
 * - Documents the fuel_unit and mileage_unit concepts clearly.
 */

import { FuelUnit, MileageUnit } from '@/constants/fuelTypes';

// ─── Full Database Row ───────────────────────────────────────────────
/**
 * Represents a complete row from the `fuel_entries` table.
 */
export interface FuelEntry {
  /** Primary key — UUID v4 */
  id: string;

  /** FK → vehicles.id */
  vehicle_id: string;

  /** Date of the fuel entry. ISO 8601 string. */
  date: string;

  /** Odometer reading at time of fill. Must be > previous entry's odometer. */
  odometer: number;

  /**
   * Quantity filled, in the unit specified by `fuel_unit`.
   * Must be > 0.
   */
  fuel_amount: number;

  /**
   * Unit of the fuel_amount field.
   * Defaults from the vehicle's fuel_type. Editable for dual-fuel vehicles.
   * 'litres' | 'kg' | 'kWh'
   */
  fuel_unit: FuelUnit;

  /**
   * Price per unit of fuel (per litre, per kg, or per kWh).
   * Must be > 0.
   */
  price_per_unit: number;

  /**
   * fuel_amount × price_per_unit.
   * Stored for query speed. Must be updated if either parent field is edited.
   */
  total_cost: number;

  /** Name of the fuel station (optional) */
  fuel_station: string | null;

  /**
   * 0 = partial fill, 1 = full tank.
   * For EV: always 1 (every charge is treated as a "full tank").
   */
  is_full_tank: number;

  /**
   * Calculated mileage in the appropriate unit (km/L, km/kg, or km/kWh).
   * NULL if this is a partial fill or the first fill for the vehicle.
   * Recalculated if a prior entry in the chain is edited or deleted.
   */
  calculated_mileage: number | null;

  /**
   * Unit of the calculated_mileage value.
   * Stored alongside the value so the unit is always explicit.
   * 'km_per_litre' | 'km_per_kg' | 'km_per_kwh' | null
   */
  mileage_unit: MileageUnit | null;

  /**
   * Local file path to a receipt photo (v1.0 — basic photo attach).
   * Becomes Supabase Storage URL in v2.0.
   */
  receipt_photo_uri: string | null;

  /** Free-text notes (optional) */
  notes: string | null;

  /**
   * For Bi-Fuel (hybrid) vehicles: which fuel system was filled.
   * 'primary' = Gas (CNG/LPG), 'secondary' = Liquid (Petrol/Diesel).
   * For single-fuel vehicles: defaults to 'primary'.
   */
  fuel_system?: 'primary' | 'secondary' | null;

  /**
   * For EV charge sessions: battery % when plugged in (0 - 100).
   */
  battery_start_percent?: number | null;

  /**
   * For EV charge sessions: battery % when unplugged (0 - 100).
   */
  battery_end_percent?: number | null;

  /** ISO 8601 timestamp — when this record was created */
  created_at: string;

  /** ISO 8601 timestamp — when this record was last modified */
  updated_at: string;

  /** ISO 8601 timestamp — soft delete marker. NULL = not deleted. */
  deleted_at: string | null;
}

// ─── Create Input ────────────────────────────────────────────────────
/**
 * Fields required to create a new fuel entry.
 * total_cost is computed automatically from fuel_amount × price_per_unit.
 * calculated_mileage and mileage_unit are computed by the mileage engine.
 */
export interface CreateFuelEntryInput {
  vehicle_id: string;
  date: string;
  odometer: number;
  fuel_amount: number;
  fuel_unit: FuelUnit;
  price_per_unit: number;
  is_full_tank: number;

  // Optional fields
  fuel_station?: string;
  receipt_photo_uri?: string;
  notes?: string;
  fuel_system?: 'primary' | 'secondary';
  battery_start_percent?: number;
  battery_end_percent?: number;
}

// ─── Update Input ────────────────────────────────────────────────────
/**
 * Fields that can be updated on an existing fuel entry.
 */
export type UpdateFuelEntryInput = Partial<
  Omit<FuelEntry, 'id' | 'vehicle_id' | 'created_at' | 'updated_at' | 'deleted_at' | 'calculated_mileage' | 'mileage_unit' | 'total_cost'>
>;
