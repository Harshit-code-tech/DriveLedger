/**
 * Document Types
 *
 * Vehicle document types for the documents table.
 * Matches the charter's document type list plus powertrain-specific requirements.
 *
 * NOTE: Driving License is intentionally excluded from v1.0.
 * A Driving License belongs to a person, not a vehicle.
 * If added in a future version, it belongs in a separate
 * `person_documents` table or a user profile.
 */

import { FuelType } from './fuelTypes';

export enum DocumentType {
  RC = 'RC',
  INSURANCE = 'Insurance',
  PUC = 'PUC',
  FASTAG = 'FASTag',
  WARRANTY = 'Warranty',
  CNG_CERTIFICATE = 'CNG_Certificate',
  BATTERY_WARRANTY = 'Battery_Warranty',
  FITNESS = 'Fitness',
  ROAD_TAX = 'Road_Tax',
}

/** Human-readable labels for UI display */
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  [DocumentType.RC]: 'Registration Certificate (RC)',
  [DocumentType.INSURANCE]: 'Insurance',
  [DocumentType.PUC]: 'Pollution Under Control (PUC)',
  [DocumentType.FASTAG]: 'FASTag',
  [DocumentType.WARRANTY]: 'Warranty',
  [DocumentType.CNG_CERTIFICATE]: 'CNG Cylinder Hydro-Test Certificate',
  [DocumentType.BATTERY_WARRANTY]: 'Traction Battery Warranty',
  [DocumentType.FITNESS]: 'Fitness Certificate',
  [DocumentType.ROAD_TAX]: 'Road Tax Receipt',
};

/** Emoji icons for each document type (used in UI chips and list items) */
export const DOCUMENT_TYPE_ICONS: Record<DocumentType, string> = {
  [DocumentType.RC]: '📋',
  [DocumentType.INSURANCE]: '🛡️',
  [DocumentType.PUC]: '💨',
  [DocumentType.FASTAG]: '🏷️',
  [DocumentType.WARRANTY]: '📄',
  [DocumentType.CNG_CERTIFICATE]: '⛽',
  [DocumentType.BATTERY_WARRANTY]: '🔋',
  [DocumentType.FITNESS]: '🩺',
  [DocumentType.ROAD_TAX]: '💰',
};

/** All possible document types (unfiltered list) */
export const DOCUMENT_TYPE_LIST = Object.values(DocumentType);

/**
 * Returns applicable document types tailored to a vehicle's powertrain/fuel type.
 *
 * Powertrain Rules:
 * - Electric: Excludes PUC (zero emissions, no RTO PUC required).
 *             Includes Traction Battery Warranty.
 * - CNG / Bi-Fuel CNG: Includes CNG Cylinder Hydro-Test Certificate (mandatory 3-year hydro testing under PESO).
 *                      Includes PUC.
 * - Hybrid: Includes Traction Battery Warranty and PUC.
 * - Petrol / Diesel / LPG / Other: Standard set (RC, Insurance, PUC, FASTag, Warranty, Road Tax, Fitness).
 */
export function getDocumentTypesForVehicle(fuelType?: FuelType | string | null): DocumentType[] {
  const ft = fuelType ? String(fuelType).toLowerCase() : '';

  if (ft === FuelType.ELECTRIC || ft === 'electric') {
    return [
      DocumentType.RC,
      DocumentType.INSURANCE,
      DocumentType.BATTERY_WARRANTY,
      DocumentType.FASTAG,
      DocumentType.WARRANTY,
      DocumentType.ROAD_TAX,
      DocumentType.FITNESS,
    ];
  }

  if (
    ft === FuelType.CNG ||
    ft === 'cng' ||
    ft === FuelType.HYBRID_CNG_PETROL ||
    ft === 'hybrid_cng_petrol'
  ) {
    return [
      DocumentType.RC,
      DocumentType.INSURANCE,
      DocumentType.PUC,
      DocumentType.CNG_CERTIFICATE,
      DocumentType.FASTAG,
      DocumentType.WARRANTY,
      DocumentType.ROAD_TAX,
      DocumentType.FITNESS,
    ];
  }

  if (ft === FuelType.HYBRID || ft === 'hybrid') {
    return [
      DocumentType.RC,
      DocumentType.INSURANCE,
      DocumentType.PUC,
      DocumentType.BATTERY_WARRANTY,
      DocumentType.FASTAG,
      DocumentType.WARRANTY,
      DocumentType.ROAD_TAX,
      DocumentType.FITNESS,
    ];
  }

  return [
    DocumentType.RC,
    DocumentType.INSURANCE,
    DocumentType.PUC,
    DocumentType.FASTAG,
    DocumentType.WARRANTY,
    DocumentType.ROAD_TAX,
    DocumentType.FITNESS,
  ];
}
