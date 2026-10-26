/**
 * Report Generation Service — Barrel Re-export
 *
 * This file was previously a 1,499-line monolith. It has been split into
 * focused domain modules under src/services/reports/:
 *
 *   reports/reportHtmlHelpers.ts  — escapeHtml, escapeCsv
 *   reports/serviceLedger.ts      — ServiceLedgerData, generateServiceLedgerHtml
 *   reports/vehicleDossier.ts     — VehicleDossierData, generateVehicleDossierHtml
 *   reports/vehicleHistoryReport.ts — VehicleHistoryReportData, generateVehicleHistoryReportHtml
 *   reports/fuelExpensesCsv.ts    — generateFuelExpensesCsv
 *   reports/reportActions.ts      — FileExportResult, save.../export... functions
 *
 * All public symbols are re-exported here so existing callers at
 * '@/services/reportService' continue to work without any changes.
 */

export type { ServiceLedgerData } from './reports/serviceLedger';
export { generateServiceLedgerHtml } from './reports/serviceLedger';

export type { VehicleDossierData } from './reports/vehicleDossier';
export { generateVehicleDossierHtml } from './reports/vehicleDossier';

export type { VehicleHistoryReportData } from './reports/vehicleHistoryReport';
export { generateVehicleHistoryReportHtml } from './reports/vehicleHistoryReport';

export { generateFuelExpensesCsv } from './reports/fuelExpensesCsv';

export type { FileExportResult } from './reports/reportActions';
export {
  saveServiceLedgerPdf,
  exportServiceLedgerPdf,
  saveVehicleDossierPdf,
  exportVehicleDossierPdf,
  saveVehicleHistoryReportPdf,
  exportVehicleHistoryReportPdf,
  saveFuelExpensesCsvFile,
  exportFuelExpensesCsvFile,
} from './reports/reportActions';
