/**
 * Report Action Functions
 *
 * Save-to-device and share-via-native-sheet functions for all report types.
 * Uses expo-print for PDF generation, expo-file-system for file I/O, and
 * expo-sharing for the native share sheet.
 *
 * Extracted from reportService.ts for single-responsibility organisation.
 */

import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import type { Vehicle } from '@/types/vehicle';
import type { ServiceRecord } from '@/types/service';
import type { FuelEntry } from '@/types/fuel';
import type { Expense } from '@/types/expense';
import { generateServiceLedgerHtml, type ServiceLedgerData } from './serviceLedger';
import { generateVehicleDossierHtml, type VehicleDossierData } from './vehicleDossier';
import { generateVehicleHistoryReportHtml, type VehicleHistoryReportData } from './vehicleHistoryReport';
import { generateFuelExpensesCsv } from './fuelExpensesCsv';

// ─── Shared Result Type ───────────────────────────────────────────────

export interface FileExportResult {
  success: boolean;
  message: string;
  cancelled?: boolean;
  uri?: string;
}

// ─── Private Helpers ─────────────────────────────────────────────────

/**
 * Saves a file directly to the user's chosen folder (Downloads, Documents, etc.)
 * using Android's Storage Access Framework or iOS Document picker.
 */
async function saveFileToUserDevice(
  content: string,
  filename: string,
  mimeType: string,
  isBase64 = false
): Promise<FileExportResult> {
  try {
    if (Platform.OS === 'android') {
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permissions.granted) {
        return { success: false, cancelled: true, message: 'Folder selection was cancelled.' };
      }

      const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
        permissions.directoryUri,
        filename,
        mimeType
      );

      await FileSystem.writeAsStringAsync(fileUri, content, {
        encoding: isBase64 ? FileSystem.EncodingType.Base64 : FileSystem.EncodingType.UTF8,
      });

      return {
        success: true,
        message: `Saved "${filename}" to your selected folder.`,
        uri: fileUri,
      };
    } else {
      // iOS / other: save to documentDirectory and open share sheet (which includes "Save to Files")
      const docDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
      const targetUri = `${docDir}${filename}`;

      try {
        await FileSystem.deleteAsync(targetUri, { idempotent: true });
      } catch (_) {}

      await FileSystem.writeAsStringAsync(targetUri, content, {
        encoding: isBase64 ? FileSystem.EncodingType.Base64 : FileSystem.EncodingType.UTF8,
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(targetUri, {
          UTI: mimeType === 'application/pdf' ? '.pdf' : 'public.comma-separated-values-text',
          mimeType,
          dialogTitle: `Save ${filename}`,
        });
      }

      return {
        success: true,
        message: `Saved "${filename}".`,
        uri: targetUri,
      };
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes('cancelled') || errMsg.includes('canceled') || errMsg.includes('user canceled')) {
      return { success: false, cancelled: true, message: 'Folder selection was cancelled.' };
    }
    return {
      success: false,
      message: `Failed to save file: ${errMsg}`,
    };
  }
}

function getSafeReportFilename(vehicle: Vehicle, suffix: string, ext: 'pdf' | 'csv'): string {
  const base = (vehicle.nickname || vehicle.registration_number || 'Vehicle').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${base}_${suffix}.${ext}`;
}

/**
 * Safely shares a PDF file by copying it from the print temp folder
 * into FileSystem.documentDirectory root, preventing Android "Not allowed to read file under given URL" errors.
 */
async function sharePdfFile(
  html: string,
  filename: string,
  dialogTitle: string
): Promise<{ success: boolean; cancelled?: boolean; uri?: string; message?: string }> {
  try {
    const { uri: rawUri, base64: genBase64 } = await Print.printToFileAsync({ html, base64: true });

    const targetDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
    const cleanUri = `${targetDir}${filename}`;

    try {
      await FileSystem.deleteAsync(cleanUri, { idempotent: true });
    } catch (_) {}

    if (genBase64) {
      await FileSystem.writeAsStringAsync(cleanUri, genBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } else {
      // Fallback if base64 flag wasn't supported
      const base64Data = await FileSystem.readAsStringAsync(rawUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await FileSystem.writeAsStringAsync(cleanUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(cleanUri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle,
      });
    }

    return { success: true, uri: cleanUri };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg.includes('dismiss') || msg.includes('cancel') || msg.includes('cancelled')) {
      return { success: true, cancelled: true };
    }
    return {
      success: false,
      message: `Failed to share PDF: ${msg}`,
    };
  }
}

// ─── Public Export Actions ────────────────────────────────────────────

/**
 * Saves Verified Service Ledger PDF directly to local storage (Downloads/chosen folder).
 */
export async function saveServiceLedgerPdf(data: ServiceLedgerData): Promise<FileExportResult> {
  try {
    const html = generateServiceLedgerHtml(data);
    const { uri: rawUri, base64: genBase64 } = await Print.printToFileAsync({ html, base64: true });
    const base64Data = genBase64 || (await FileSystem.readAsStringAsync(rawUri, {
      encoding: FileSystem.EncodingType.Base64,
    }));
    const filename = getSafeReportFilename(data.vehicle, 'Service_Ledger', 'pdf');
    return await saveFileToUserDevice(base64Data, filename, 'application/pdf', true);
  } catch (error) {
    return {
      success: false,
      message: `Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Compiles and shares the Verified Service Ledger via native share sheet (WhatsApp, Email, etc.).
 */
export async function exportServiceLedgerPdf(
  data: ServiceLedgerData
): Promise<{ success: boolean; cancelled?: boolean; uri?: string; message?: string }> {
  const html = generateServiceLedgerHtml(data);
  const filename = getSafeReportFilename(data.vehicle, 'Service_Ledger', 'pdf');
  return sharePdfFile(html, filename, `${data.vehicle.nickname} — Service Ledger`);
}

/**
 * Saves Complete Vehicle Dossier PDF directly to local storage (Downloads/chosen folder).
 */
export async function saveVehicleDossierPdf(data: VehicleDossierData): Promise<FileExportResult> {
  try {
    const html = generateVehicleDossierHtml(data);
    const { uri: rawUri, base64: genBase64 } = await Print.printToFileAsync({ html, base64: true });
    const base64Data = genBase64 || (await FileSystem.readAsStringAsync(rawUri, {
      encoding: FileSystem.EncodingType.Base64,
    }));
    const filename = getSafeReportFilename(data.vehicle, 'Vehicle_Dossier', 'pdf');
    return await saveFileToUserDevice(base64Data, filename, 'application/pdf', true);
  } catch (error) {
    return {
      success: false,
      message: `Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Compiles and shares the Complete Vehicle Dossier via native share sheet.
 */
export async function exportVehicleDossierPdf(
  data: VehicleDossierData
): Promise<{ success: boolean; cancelled?: boolean; uri?: string; message?: string }> {
  const html = generateVehicleDossierHtml(data);
  const filename = getSafeReportFilename(data.vehicle, 'Vehicle_Dossier', 'pdf');
  return sharePdfFile(html, filename, `${data.vehicle.nickname} — Vehicle Dossier`);
}

/**
 * Saves Credible Vehicle History Report PDF directly to local storage (Downloads/chosen folder).
 */
export async function saveVehicleHistoryReportPdf(
  data: VehicleHistoryReportData
): Promise<FileExportResult> {
  try {
    const html = generateVehicleHistoryReportHtml(data);
    const { uri: rawUri, base64: genBase64 } = await Print.printToFileAsync({ html, base64: true });
    const base64Data = genBase64 || (await FileSystem.readAsStringAsync(rawUri, {
      encoding: FileSystem.EncodingType.Base64,
    }));
    const filename = getSafeReportFilename(data.vehicle, 'History_Report', 'pdf');
    return await saveFileToUserDevice(base64Data, filename, 'application/pdf', true);
  } catch (error) {
    return {
      success: false,
      message: `Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Compiles and shares the Credible Vehicle History Report PDF via native share sheet.
 */
export async function exportVehicleHistoryReportPdf(
  data: VehicleHistoryReportData
): Promise<{ success: boolean; cancelled?: boolean; uri?: string; message?: string }> {
  const html = generateVehicleHistoryReportHtml(data);
  const filename = getSafeReportFilename(data.vehicle, 'History_Report', 'pdf');
  return sharePdfFile(html, filename, `${data.vehicle.nickname} — Vehicle History Report`);
}

/**
 * Saves Reimbursement Ledger CSV directly to local storage (Downloads/chosen folder).
 */
export async function saveFuelExpensesCsvFile(
  vehicle: Vehicle,
  fuelEntries: FuelEntry[],
  expenses: Expense[] = [],
  serviceRecords: ServiceRecord[] = []
): Promise<FileExportResult> {
  try {
    const csvContent = generateFuelExpensesCsv(vehicle, fuelEntries, expenses, serviceRecords);
    const filename = getSafeReportFilename(vehicle, 'Reimbursement_Ledger', 'csv');
    return await saveFileToUserDevice(csvContent, filename, 'text/csv', false);
  } catch (error) {
    return {
      success: false,
      message: `Failed to generate CSV: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Generates and shares RFC 4180 CSV for fuel, service, and tax reimbursements.
 */
export async function exportFuelExpensesCsvFile(
  vehicle: Vehicle,
  fuelEntries: FuelEntry[],
  expenses: Expense[] = [],
  serviceRecords: ServiceRecord[] = []
): Promise<{ success: boolean; cancelled?: boolean; uri?: string; message?: string }> {
  try {
    const csvContent = generateFuelExpensesCsv(vehicle, fuelEntries, expenses, serviceRecords);
    const filename = getSafeReportFilename(vehicle, 'Reimbursement_Ledger', 'csv');
    const targetDir = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;
    const targetUri = `${targetDir}${filename}`;

    try {
      await FileSystem.deleteAsync(targetUri, { idempotent: true });
    } catch (_) {}

    await FileSystem.writeAsStringAsync(targetUri, csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(targetUri, {
        UTI: 'public.comma-separated-values-text',
        mimeType: 'text/csv',
        dialogTitle: `Export ${vehicle.nickname} CSV Ledger`,
      });
    }

    return { success: true, uri: targetUri };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (msg.includes('dismiss') || msg.includes('cancel') || msg.includes('cancelled')) {
      return { success: true, cancelled: true };
    }
    return {
      success: false,
      message: `Failed to export CSV: ${msg}`,
    };
  }
}
