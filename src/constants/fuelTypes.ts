/**
 * Fuel Types, Vehicle Types, Fuel Units & Mileage Units
 *
 * These are stored as string constants in the database (not free text)
 * to prevent spelling inconsistencies and enable type-safe comparisons.
 *
 * WHY enums instead of union types?
 * - Enums are iterable (Object.values(FuelType)) — useful for dropdowns.
 * - Enum values are the actual strings stored in SQLite.
 * - Union types are compile-time only; enums exist at runtime too.
 *
 * HYBRID VARIANTS:
 * - A hybrid vehicle has two fuel systems. We track them as distinct
 *   fuel types so the mileage engine knows which unit to use by default
 *   and the UI can show two tank capacity fields.
 */

// ─── Fuel Types ──────────────────────────────────────────────────────
export enum FuelType {
  PETROL = 'petrol',
  DIESEL = 'diesel',
  CNG = 'cng',
  LPG = 'lpg',
  ELECTRIC = 'electric',
  // ── Strong Hybrid (Self-Charging HEV: Petrol + Electric, single petrol tank) ──
  HYBRID = 'hybrid',
  // ── Bi-Fuel Variants (dual-fuel, two physical tanks: gas + liquid) ──
  HYBRID_CNG_PETROL = 'hybrid_cng_petrol',
  HYBRID_CNG_DIESEL = 'hybrid_cng_diesel',
  HYBRID_LPG_PETROL = 'hybrid_lpg_petrol',
  HYBRID_LPG_DIESEL = 'hybrid_lpg_diesel',
}

/**
 * Returns true when a fuel type represents a dual-fuel (Bi-Fuel) vehicle with two separate tanks.
 * Used to show secondary tank fields in the UI and isolate mileage streams.
 */
export function isBiFuel(ft: FuelType): boolean {
  return [
    FuelType.HYBRID_CNG_PETROL,
    FuelType.HYBRID_CNG_DIESEL,
    FuelType.HYBRID_LPG_PETROL,
    FuelType.HYBRID_LPG_DIESEL,
  ].includes(ft);
}

/**
 * Dual-tank vehicle helper (alias for isBiFuel).
 */
export const isHybridFuel = isBiFuel;

/**
 * Returns true when the fuel type is a Strong Hybrid (HEV, single petrol tank with electric assist).
 */
export function isStrongHybrid(ft: FuelType): boolean {
  return ft === FuelType.HYBRID;
}

/**
 * Returns true when the fuel type is fully electric.
 * Used to rename "Tank Capacity" → "Battery Capacity (kWh)".
 */
export function isElectricFuel(ft: FuelType): boolean {
  return ft === FuelType.ELECTRIC;
}

// ─── Vehicle Types ───────────────────────────────────────────────────
export enum VehicleType {
  CAR = 'car',
  TWO_WHEELER = 'two_wheeler',
  THREE_WHEELER = 'three_wheeler',
  OTHER = 'other',
}

// ─── Fuel Units ──────────────────────────────────────────────────────
export enum FuelUnit {
  LITRES = 'litres',
  KG = 'kg',
  KWH = 'kWh',
}

// ─── Mileage Units ──────────────────────────────────────────────────
export enum MileageUnit {
  KM_PER_LITRE = 'km_per_litre',
  KM_PER_KG = 'km_per_kg',
  KM_PER_KWH = 'km_per_kwh',
}

// ─── Mapping Helpers ─────────────────────────────────────────────────

/**
 * Maps a vehicle's fuel_type to the default fuel_unit for fuel entries.
 * For hybrids, we default to the gas component (first fill is usually CNG/LPG).
 */
export const FUEL_TYPE_TO_DEFAULT_UNIT: Record<FuelType, FuelUnit> = {
  [FuelType.PETROL]: FuelUnit.LITRES,
  [FuelType.DIESEL]: FuelUnit.LITRES,
  [FuelType.CNG]: FuelUnit.KG,
  [FuelType.LPG]: FuelUnit.KG,
  [FuelType.ELECTRIC]: FuelUnit.KWH,
  [FuelType.HYBRID]: FuelUnit.LITRES,
  [FuelType.HYBRID_CNG_PETROL]: FuelUnit.KG,
  [FuelType.HYBRID_CNG_DIESEL]: FuelUnit.KG,
  [FuelType.HYBRID_LPG_PETROL]: FuelUnit.KG,
  [FuelType.HYBRID_LPG_DIESEL]: FuelUnit.KG,
};

/**
 * Maps a fuel_unit to its corresponding mileage_unit.
 */
export const FUEL_UNIT_TO_MILEAGE_UNIT: Record<FuelUnit, MileageUnit> = {
  [FuelUnit.LITRES]: MileageUnit.KM_PER_LITRE,
  [FuelUnit.KG]: MileageUnit.KM_PER_KG,
  [FuelUnit.KWH]: MileageUnit.KM_PER_KWH,
};

// ─── Display Labels ─────────────────────────────────────────────────

/** Human-readable labels for fuel types (used in UI chips) */
export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  [FuelType.PETROL]: 'Petrol',
  [FuelType.DIESEL]: 'Diesel',
  [FuelType.CNG]: 'CNG',
  [FuelType.LPG]: 'LPG',
  [FuelType.ELECTRIC]: 'Electric ⚡',
  [FuelType.HYBRID]: 'Strong Hybrid (HEV)',
  [FuelType.HYBRID_CNG_PETROL]: 'CNG + Petrol',
  [FuelType.HYBRID_CNG_DIESEL]: 'CNG + Diesel',
  [FuelType.HYBRID_LPG_PETROL]: 'LPG + Petrol',
  [FuelType.HYBRID_LPG_DIESEL]: 'LPG + Diesel',
};

/** Short UI labels (e.g. for display in list cards) */
export const FUEL_TYPE_SHORT_LABELS: Record<FuelType, string> = {
  [FuelType.PETROL]: 'Petrol',
  [FuelType.DIESEL]: 'Diesel',
  [FuelType.CNG]: 'CNG',
  [FuelType.LPG]: 'LPG',
  [FuelType.ELECTRIC]: 'EV',
  [FuelType.HYBRID]: 'Strong Hybrid',
  [FuelType.HYBRID_CNG_PETROL]: 'CNG+Petrol',
  [FuelType.HYBRID_CNG_DIESEL]: 'CNG+Diesel',
  [FuelType.HYBRID_LPG_PETROL]: 'LPG+Petrol',
  [FuelType.HYBRID_LPG_DIESEL]: 'LPG+Diesel',
};

/** Human-readable labels for vehicle types (used in UI dropdowns) */
export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  [VehicleType.CAR]: 'Car',
  [VehicleType.TWO_WHEELER]: 'Two Wheeler',
  [VehicleType.THREE_WHEELER]: 'Three Wheeler',
  [VehicleType.OTHER]: 'Other',
};

/** Human-readable labels for mileage units (used in stat displays) */
export const MILEAGE_UNIT_LABELS: Record<MileageUnit, string> = {
  [MileageUnit.KM_PER_LITRE]: 'km/L',
  [MileageUnit.KM_PER_KG]: 'km/kg',
  [MileageUnit.KM_PER_KWH]: 'km/kWh',
};

/**
 * For a Bi-Fuel type, returns a label for the primary (gas) tank.
 * Returns null for non-bi-fuel types.
 */
export function getPrimaryTankLabel(ft: FuelType): string | null {
  switch (ft) {
    case FuelType.HYBRID_CNG_PETROL:
    case FuelType.HYBRID_CNG_DIESEL:
      return 'CNG Cylinder Capacity (kg)';
    case FuelType.HYBRID_LPG_PETROL:
    case FuelType.HYBRID_LPG_DIESEL:
      return 'LPG Cylinder Capacity (kg)';
    default:
      return null;
  }
}

/**
 * For a Bi-Fuel type, returns a label for the secondary (liquid) tank.
 * Returns null for non-bi-fuel types.
 */
export function getSecondaryTankLabel(ft: FuelType): string | null {
  switch (ft) {
    case FuelType.HYBRID_CNG_PETROL:
    case FuelType.HYBRID_LPG_PETROL:
      return 'Petrol Fallback Tank Capacity (litres)';
    case FuelType.HYBRID_CNG_DIESEL:
    case FuelType.HYBRID_LPG_DIESEL:
      return 'Diesel Fallback Tank Capacity (litres)';
    default:
      return null;
  }
}

/**
 * Returns the primary tank label for a vehicle.
 */
export function getTankCapacityLabel(ft: FuelType): string {
  if (ft === FuelType.ELECTRIC) return 'Battery Capacity (kWh)';
  if (ft === FuelType.CNG) return 'CNG Tank Capacity (kg)';
  if (ft === FuelType.LPG) return 'LPG Tank Capacity (kg)';
  if (ft === FuelType.HYBRID) return 'Petrol Tank Capacity (litres)';
  if (isBiFuel(ft)) return getPrimaryTankLabel(ft) ?? 'Primary Tank Capacity';
  return 'Tank Capacity (litres)';
}

/**
 * Returns a user-friendly label for the specified fuel system in a hybrid vehicle.
 */
export function getFuelSystemLabel(ft: FuelType, system: 'primary' | 'secondary'): string {
  if (ft === FuelType.HYBRID || ft === FuelType.HYBRID_CNG_PETROL || ft === FuelType.HYBRID_CNG_DIESEL) {
    return system === 'primary' ? 'CNG (Gas)' : (ft === FuelType.HYBRID_CNG_DIESEL ? 'Diesel' : 'Petrol');
  }
  if (ft === FuelType.HYBRID_LPG_PETROL || ft === FuelType.HYBRID_LPG_DIESEL) {
    return system === 'primary' ? 'LPG (Gas)' : (ft === FuelType.HYBRID_LPG_PETROL ? 'Petrol' : 'Diesel');
  }
  return system === 'primary' ? 'Primary Tank' : 'Secondary Tank';
}

/**
 * Returns the expected fuel unit for a given fuel system in a vehicle.
 */
export function getFuelUnitForSystem(ft: FuelType, system: 'primary' | 'secondary'): FuelUnit {
  if (isHybridFuel(ft) && system === 'secondary') {
    return FuelUnit.LITRES;
  }
  return FUEL_TYPE_TO_DEFAULT_UNIT[ft] ?? FuelUnit.LITRES;
}
