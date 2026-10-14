/**
 * Vehicle Types
 *
 * TypeScript interface for the `vehicles` table.
 * Matches the charter's database schema.
 *
 * WHY this exists:
 * - Provides compile-time type safety for all vehicle-related operations.
 * - Serves as the single source of truth for the shape of a vehicle record.
 * - Used by vehicleRepo, hooks, and UI components.
 */

import { FuelType } from '@/constants/fuelTypes';
import { VehicleType } from '@/constants/fuelTypes';

// ─── Full Database Row ───────────────────────────────────────────────
/**
 * Represents a complete row from the `vehicles` table.
 * Every field maps 1:1 to a SQLite column.
 */
export interface Vehicle {
  /** Primary key — UUID v4, generated via expo-crypto */
  id: string;

  /** User-facing name, e.g. "Alto", "Baba's Activa" */
  nickname: string;

  /**
   * Drives mileage-reasonableness thresholds.
   * car | two_wheeler | three_wheeler | other
   */
  vehicle_type: VehicleType;

  /** Manufacturer name (optional) */
  manufacturer: string | null;

  /** Model name (optional) */
  model: string | null;

  /** Variant / trim level (optional) */
  variant: string | null;

  /** Manufacturing year (optional) */
  year: number | null;

  /** Body color — useful when multiple vehicles of same model exist (optional) */
  color: string | null;

  /** Government registration number (required) */
  registration_number: string;

  /**
   * Determines which mileage formula the engine uses.
   * petrol | diesel | cng | lpg | electric | hybrid
   */
  fuel_type: FuelType;

  /**
   * Primary tank/battery capacity.
   * - Petrol/Diesel: litres
   * - CNG/LPG: kg
   * - Electric: kWh
   * - Hybrid: kg (CNG or LPG primary tank)
   */
  tank_capacity: number | null;

  /**
   * Secondary tank capacity for dual-fuel hybrid vehicles only (litres).
   * Petrol or Diesel liquid tank alongside a CNG/LPG gas tank.
   * null for all non-hybrid vehicle types.
   */
  secondary_tank_capacity: number | null;

  /**
   * Denormalized for performance — updated atomically with each fuel entry save.
   * Represents the latest known odometer reading.
   */
  current_odometer: number | null;

  /** Recommended front tyre pressure in PSI */
  front_tyre_pressure: number | null;

  /** Recommended rear tyre pressure in PSI */
  rear_tyre_pressure: number | null;

  /**
   * Recommended service interval in km.
   * Used at runtime to compute km-until-next-service with current_odometer.
   */
  service_interval_km: number | null;

  /**
   * Recommended service interval in months (e.g. 12 months for 1 year, 6 months).
   * Enables dual-dimension service reminders: "10,000 km OR 1 Year, whichever comes first".
   */
  service_interval_months: number | null;

  /** Date the vehicle was purchased. ISO 8601 string. (optional) */
  purchase_date: string | null;

  /** Free-text notes (optional) */
  notes: string | null;

  /**
   * 0 = active, 1 = archived.
   * Primary deletion mechanism for vehicles — archiving hides the vehicle
   * from the active list without orphaning its fuel/service/expense history.
   */
  is_archived: number;

  /** ISO 8601 timestamp — when this record was created */
  created_at: string;

  /** ISO 8601 timestamp — when this record was last modified */
  updated_at: string;

  /**
   * ISO 8601 timestamp — soft delete marker.
   * Reserved for v2.0 cloud sync tombstoning.
   * In v1.0, archiving uses is_archived instead.
   */
  deleted_at: string | null;
}

// ─── Create Input ────────────────────────────────────────────────────
/**
 * Fields required to create a new vehicle.
 * UI shows: nickname, vehicle_type, fuel_type, registration_number.
 * Everything else is under "Advanced Details" — hidden by default.
 */
export interface CreateVehicleInput {
  nickname: string;
  vehicle_type: VehicleType;
  fuel_type: FuelType;
  registration_number: string;

  // Optional advanced fields
  manufacturer?: string;
  model?: string;
  variant?: string;
  year?: number;
  color?: string;
  tank_capacity?: number;
  secondary_tank_capacity?: number;
  current_odometer?: number;
  front_tyre_pressure?: number;
  rear_tyre_pressure?: number;
  service_interval_km?: number;
  service_interval_months?: number;
  purchase_date?: string;
  notes?: string;
}

// ─── Update Input ────────────────────────────────────────────────────
/**
 * Fields that can be updated on an existing vehicle.
 * All fields are optional — only changed fields need to be provided.
 */
export type UpdateVehicleInput = Partial<Omit<Vehicle, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>>;
