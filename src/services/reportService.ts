/**
 * Report Generation Service
 *
 * Produces executive-grade printable PDF documents and RFC 4180 CSV spreadsheets
 * for vehicle resale, tax deductions, and business reimbursements:
 *
 * 1. Verified Vehicle Service Ledger (PDF):
 *    - Complete dated maintenance history with garage names, parts replaced, and costs.
 *    - Increases resale value (Spinny, Cars24, private buyer) with offline verified provenance.
 *
 * 2. Complete Vehicle Dossier (PDF):
 *    - Full executive report containing efficiency metrics, service history,
 *      and active document validity (Insurance, PUC, RC).
 *
 * 3. Business & Tax Reimbursement Ledger (CSV):
 *    - RFC 4180 compliant CSV with UTF-8 BOM (\uFEFF) for Microsoft Excel / Google Sheets.
 *    - Date, odometer, fuel volume, price, total cost, fuel station, and mileage.
 */

import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import type { Vehicle } from '@/types/vehicle';
import type { ServiceRecord } from '@/types/service';
import type { FuelEntry } from '@/types/fuel';
import type { Expense } from '@/types/expense';
import type { VehicleDocument } from '@/types/document';
import { formatCurrency, formatOdometer, formatMileage } from '@/utils/format';
import { MILEAGE_UNIT_LABELS } from '@/constants/fuelTypes';

// ─── HTML Template 1: Verified Vehicle Service Ledger ─────────────────

export interface ServiceLedgerData {
  vehicle: Vehicle;
  serviceRecords: ServiceRecord[];
  repairExpenses?: Expense[];
}

export function generateServiceLedgerHtml(data: ServiceLedgerData): string {
  const { vehicle, serviceRecords, repairExpenses = [] } = data;

  const totalServiceCost = serviceRecords.reduce((sum, r) => sum + (r.cost || 0), 0);
  const totalRepairCost = repairExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalMaintenanceCost = totalServiceCost + totalRepairCost;

  const sortedServices = [...serviceRecords].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const sortedRepairs = [...repairExpenses].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const generatedDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const vehicleSubtitle = [
    vehicle.manufacturer,
    vehicle.model,
    vehicle.variant,
    vehicle.year ? `(${vehicle.year})` : '',
    vehicle.fuel_type ? `· ${vehicle.fuel_type.toUpperCase()}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Service Ledger — ${vehicle.registration_number}</title>
  <style>
    @page { margin: 14mm 12mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 24px;
      color: #1e293b;
      background: #ffffff;
      -webkit-font-smoothing: antialiased;
    }
    .header {
      border-bottom: 2px solid #0284c7;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .brand-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .brand {
      font-size: 13px;
      font-weight: 700;
      color: #0284c7;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .report-date {
      font-size: 11px;
      color: #64748b;
    }
    .title {
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      margin: 4px 0 8px 0;
    }
    .vehicle-badge-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .reg-badge {
      display: inline-block;
      background: #0f172a;
      color: #f8fafc;
      padding: 4px 10px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 1px;
    }
    .vehicle-desc {
      font-size: 14px;
      font-weight: 600;
      color: #334155;
    }
    .verified-seal {
      display: inline-block;
      background: #ecfdf5;
      color: #059669;
      border: 1px solid #a7f3d0;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
    }
    .stat-label {
      font-size: 10px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .stat-val {
      font-size: 17px;
      font-weight: 700;
      color: #0f172a;
    }
    h2 {
      font-size: 15px;
      font-weight: 700;
      color: #0f172a;
      margin: 20px 0 10px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 11px;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      text-align: left;
      padding: 8px 10px;
      border-bottom: 2px solid #cbd5e1;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.5px;
    }
    td {
      padding: 8px 10px;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
      vertical-align: top;
    }
    tr:nth-child(even) td {
      background: #fafafa;
    }
    .cost-col {
      text-align: right;
      font-weight: 700;
      color: #0f172a;
    }
    .empty-row td {
      text-align: center;
      color: #94a3b8;
      padding: 18px;
      font-style: italic;
    }
    .footer {
      margin-top: 32px;
      border-top: 1px solid #e2e8f0;
      padding-top: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand-row">
      <span class="brand">DriveLedger · Verified Dossier</span>
      <span class="report-date">Generated on ${generatedDate}</span>
    </div>
    <div class="title">Vehicle Service & Maintenance Ledger</div>
    <div class="vehicle-badge-row">
      <span class="reg-badge">${escapeHtml(vehicle.registration_number)}</span>
      <span class="vehicle-desc">${escapeHtml(vehicle.nickname)} — ${escapeHtml(vehicleSubtitle)}</span>
      <span class="verified-seal">✓ Offline Verified Record</span>
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">Total Services</div>
      <div class="stat-val">${serviceRecords.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Service Spend</div>
      <div class="stat-val">${formatCurrency(totalServiceCost)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Repairs & Parts</div>
      <div class="stat-val">${formatCurrency(totalRepairCost)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Maintenance</div>
      <div class="stat-val">${formatCurrency(totalMaintenanceCost)}</div>
    </div>
  </div>

  <h2>Scheduled Services & Routine Maintenance</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 12%;">Date</th>
        <th style="width: 14%;">Odometer</th>
        <th style="width: 20%;">Service Type</th>
        <th style="width: 20%;">Workshop / Garage</th>
        <th style="width: 22%;">Work Done & Parts</th>
        <th style="width: 12%; text-align: right;">Cost (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${
        sortedServices.length > 0
          ? sortedServices
              .map(
                (s) => `<tr>
                  <td><b>${s.date}</b></td>
                  <td>${s.odometer ? formatOdometer(s.odometer) : '—'}</td>
                  <td><b>${escapeHtml(s.service_type)}</b></td>
                  <td>${escapeHtml(s.garage_name || '—')}</td>
                  <td>${escapeHtml(s.work_done || s.notes || '—')}</td>
                  <td class="cost-col">${s.cost ? formatCurrency(s.cost) : '—'}</td>
                </tr>`
              )
              .join('')
          : '<tr class="empty-row"><td colspan="6">No scheduled service records logged.</td></tr>'
      }
    </tbody>
  </table>

  ${
    sortedRepairs.length > 0
      ? `<h2>Unscheduled Repairs & Parts Replaced</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 15%;">Date</th>
        <th style="width: 20%;">Category</th>
        <th style="width: 50%;">Description / Parts Replaced</th>
        <th style="width: 15%; text-align: right;">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${sortedRepairs
        .map(
          (e) => `<tr>
            <td><b>${e.date}</b></td>
            <td>${escapeHtml(e.category)}</td>
            <td>${escapeHtml(e.description || '—')}</td>
            <td class="cost-col">${formatCurrency(e.amount)}</td>
          </tr>`
        )
        .join('')}
    </tbody>
  </table>`
      : ''
  }

  <div class="footer">
    <span>DriveLedger — 100% Offline, Private Vehicle Expense Ledger</span>
    <span>Document ID: ${vehicle.id.slice(0, 8)} · ${vehicle.registration_number}</span>
  </div>
</body>
</html>`;
}

// ─── HTML Template 2: Complete Vehicle Dossier ───────────────────────

export interface VehicleDossierData {
  vehicle: Vehicle;
  fuelEntries: FuelEntry[];
  serviceRecords: ServiceRecord[];
  expenses: Expense[];
  documents: VehicleDocument[];
  avgMileage?: number | null;
  mileageUnit?: string;
  totalOwnershipCost?: number;
}

export function generateVehicleDossierHtml(data: VehicleDossierData): string {
  const {
    vehicle,
    fuelEntries,
    serviceRecords,
    expenses,
    documents,
    avgMileage,
    mileageUnit = 'km/L',
    totalOwnershipCost = 0,
  } = data;

  const totalFuelCost = fuelEntries.reduce((s, e) => s + e.total_cost, 0);
  const totalServiceCost = serviceRecords.reduce((s, r) => s + (r.cost || 0), 0);
  const totalExpenseCost = expenses.reduce((s, e) => s + e.amount, 0);
  const grandTotal = totalOwnershipCost || totalFuelCost + totalServiceCost + totalExpenseCost;

  const generatedDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Vehicle Dossier — ${vehicle.registration_number}</title>
  <style>
    @page { margin: 14mm 12mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 24px;
      color: #1e293b;
      background: #ffffff;
    }
    .header {
      border-bottom: 2px solid #0284c7;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .title { font-size: 24px; font-weight: 800; color: #0f172a; margin: 4px 0 8px 0; }
    .badge {
      display: inline-block;
      background: #0f172a;
      color: #fff;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 700;
      font-size: 13px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 20px;
    }
    .card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px;
    }
    .card-label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 600; }
    .card-val { font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 2px; }
    h2 {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin: 18px 0 8px 0;
    }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
    th { background: #f1f5f9; padding: 7px 8px; text-align: left; font-weight: 700; border-bottom: 2px solid #cbd5e1; font-size: 10px; }
    td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; color: #334155; }
    tr:nth-child(even) td { background: #fafafa; }
    .cost-col { text-align: right; font-weight: 700; }
  </style>
</head>
<body>
  <div class="header">
    <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-bottom: 4px;">
      <b>DriveLedger Complete Dossier</b>
      <span>Generated ${generatedDate}</span>
    </div>
    <div class="title">${escapeHtml(vehicle.nickname)} — Complete Dossier</div>
    <div>
      <span class="badge">${escapeHtml(vehicle.registration_number)}</span>
      <span style="font-size: 13px; font-weight: 600; margin-left: 8px;">
        ${escapeHtml([vehicle.manufacturer, vehicle.model, vehicle.variant].filter(Boolean).join(' '))} ${vehicle.year ? `(${vehicle.year})` : ''}
      </span>
    </div>
  </div>

  <div class="stats-grid">
    <div class="card">
      <div class="card-label">Total Spend</div>
      <div class="card-val">${formatCurrency(grandTotal)}</div>
    </div>
    <div class="card">
      <div class="card-label">Avg Mileage</div>
      <div class="card-val">${avgMileage ? formatMileage(avgMileage, mileageUnit) : '—'}</div>
    </div>
    <div class="card">
      <div class="card-label">Fuel Spend</div>
      <div class="card-val">${formatCurrency(totalFuelCost)}</div>
    </div>
    <div class="card">
      <div class="card-label">Services Logged</div>
      <div class="card-val">${serviceRecords.length}</div>
    </div>
  </div>

  <h2>Active Documents & Validity</h2>
  <table>
    <thead>
      <tr>
        <th>Document Type</th>
        <th>Number / Policy ID</th>
        <th>Provider / Insurer</th>
        <th>Expiry Date</th>
      </tr>
    </thead>
    <tbody>
      ${
        documents.length > 0
          ? documents
              .map(
                (d) => `<tr>
                  <td><b>${escapeHtml(d.type)}</b></td>
                  <td>${escapeHtml(d.document_number || '—')}</td>
                  <td>${escapeHtml(d.insurer_name || '—')}</td>
                  <td><b>${escapeHtml(d.expiry_date || 'No Expiry')}</b></td>
                </tr>`
              )
              .join('')
          : '<tr><td colspan="4" style="text-align: center; color: #94a3b8;">No documents recorded.</td></tr>'
      }
    </tbody>
  </table>

  <h2>Recent Maintenance History</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Odometer</th>
        <th>Service</th>
        <th>Garage</th>
        <th style="text-align: right;">Cost (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${
        serviceRecords.length > 0
          ? serviceRecords
              .slice(0, 8)
              .map(
                (s) => `<tr>
                  <td>${s.date}</td>
                  <td>${s.odometer ? formatOdometer(s.odometer) : '—'}</td>
                  <td><b>${escapeHtml(s.service_type)}</b></td>
                  <td>${escapeHtml(s.garage_name || '—')}</td>
                  <td class="cost-col">${s.cost ? formatCurrency(s.cost) : '—'}</td>
                </tr>`
              )
              .join('')
          : '<tr><td colspan="5" style="text-align: center; color: #94a3b8;">No service records.</td></tr>'
      }
    </tbody>
  </table>

  <h2>Recent Fuel Refills</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Odometer</th>
        <th>Station / Pump</th>
        <th>Amount</th>
        <th>Rate (₹)</th>
        <th>Mileage</th>
        <th style="text-align: right;">Cost (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${
        fuelEntries.length > 0
          ? fuelEntries
              .slice(0, 8)
              .map(
                (f) => `<tr>
                  <td>${f.date}</td>
                  <td>${formatOdometer(f.odometer)}</td>
                  <td>${escapeHtml(f.fuel_station || '—')}</td>
                  <td>${f.fuel_amount} ${f.fuel_unit}</td>
                  <td>₹${f.price_per_unit}</td>
                  <td>${f.calculated_mileage ? f.calculated_mileage.toFixed(1) : '—'}</td>
                  <td class="cost-col">${formatCurrency(f.total_cost)}</td>
                </tr>`
              )
              .join('')
          : '<tr><td colspan="7" style="text-align: center; color: #94a3b8;">No fuel entries.</td></tr>'
      }
    </tbody>
  </table>
</body>
</html>`;
}

// ─── CSV Generator: Fuel & Expense Tax Reimbursement ──────────────────

export function generateFuelExpensesCsv(
  vehicle: Vehicle,
  fuelEntries: FuelEntry[],
  expenses: Expense[] = [],
  serviceRecords: ServiceRecord[] = []
): string {
  const headers = [
    'Date',
    'Vehicle',
    'Registration',
    'Category',
    'Odometer (km)',
    'Quantity',
    'Unit',
    'Rate (INR)',
    'Total Cost (INR)',
    'Station / Garage / Vendor',
    'Full Tank',
    'Calculated Mileage',
    'Notes / Description',
  ];

  interface CsvRowItem {
    date: string;
    cells: (string | number)[];
  }

  const items: CsvRowItem[] = [];

  // Fuel entries
  for (const f of fuelEntries) {
    items.push({
      date: f.date,
      cells: [
        f.date,
        `"${escapeCsv(vehicle.nickname)}"`,
        `"${escapeCsv(vehicle.registration_number)}"`,
        'Fuel',
        f.odometer,
        f.fuel_amount,
        f.fuel_unit,
        f.price_per_unit,
        f.total_cost,
        `"${escapeCsv(f.fuel_station || '')}"`,
        f.is_full_tank ? 'Yes' : 'No',
        f.calculated_mileage ? f.calculated_mileage.toFixed(2) : '',
        `"${escapeCsv(f.notes || '')}"`,
      ],
    });
  }

  // Routine & Unscheduled Services
  for (const s of serviceRecords) {
    const desc = [s.service_type, s.work_done].filter(Boolean).join(' - ');
    items.push({
      date: s.date,
      cells: [
        s.date,
        `"${escapeCsv(vehicle.nickname)}"`,
        `"${escapeCsv(vehicle.registration_number)}"`,
        'Service',
        s.odometer ?? '',
        '',
        '',
        '',
        s.cost ?? 0,
        `"${escapeCsv(s.garage_name || '')}"`,
        '',
        '',
        `"${escapeCsv(desc)}"`,
      ],
    });
  }

  // Non-fuel Expenses (Tolls, Parking, Repairs, Challans, etc.)
  for (const e of expenses) {
    items.push({
      date: e.date,
      cells: [
        e.date,
        `"${escapeCsv(vehicle.nickname)}"`,
        `"${escapeCsv(vehicle.registration_number)}"`,
        `"${escapeCsv(e.category)}"`,
        '',
        '',
        '',
        '',
        e.amount,
        '',
        '',
        '',
        `"${escapeCsv(e.description || '')}"`,
      ],
    });
  }

  // Sort chronological (oldest to newest)
  items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Prepend UTF-8 BOM (\uFEFF) for Excel & Sheets compatibility
  return '\uFEFF' + [headers.join(','), ...items.map((it) => it.cells.join(','))].join('\r\n');
}

// ─── Action Functions: Save to Device & Share ────────────────────────

export interface FileExportResult {
  success: boolean;
  message: string;
  cancelled?: boolean;
  uri?: string;
}

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

// ─── Helpers ─────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeCsv(str: string): string {
  let val = str;
  if (/^[=+\-@]/.test(val)) {
    val = `'${val}`;
  }
  return val.replace(/"/g, '""');
}
