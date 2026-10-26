/**
 * Vehicle History Report
 *
 * Generates the "Credible Vehicle History Report" PDF HTML template (Feature 7).
 * Full resale-grade provenance document covering fuel/mileage, maintenance,
 * component history, ownership costs, and document compliance status.
 *
 * Extracted from reportService.ts for single-responsibility organisation.
 */

import type { Vehicle } from '@/types/vehicle';
import type { ServiceRecord, MaintenanceComponent } from '@/types/service';
import type { FuelEntry } from '@/types/fuel';
import type { Expense } from '@/types/expense';
import type { VehicleDocument } from '@/types/document';
import { formatCurrency, formatOdometer, formatMileage } from '@/utils/format';
import { MILEAGE_UNIT_LABELS } from '@/constants/fuelTypes';
import { computeMileageStats } from '@/engine/mileageEngine';
import { computeCostPerKm } from '@/utils/shareSummary';
import { aggregateCostBreakdown } from '@/utils/statsHelpers';
import { escapeHtml } from './reportHtmlHelpers';

export interface VehicleHistoryReportData {
  vehicle: Vehicle;
  fuelEntries: FuelEntry[];
  serviceRecords: ServiceRecord[];
  maintenanceComponents?: MaintenanceComponent[];
  expenses: Expense[];
  documents: VehicleDocument[];
  allDocuments?: VehicleDocument[];
  dateRangeLabel?: string;
  startDate?: string;
  endDate?: string;
  includeSensitiveDetails?: boolean;
}

export function generateVehicleHistoryReportHtml(data: VehicleHistoryReportData): string {
  const {
    vehicle,
    fuelEntries,
    serviceRecords,
    maintenanceComponents = [],
    expenses,
    documents,
    allDocuments = [],
    dateRangeLabel = 'All Recorded History',
    includeSensitiveDetails = true,
  } = data;

  const totalFuelCost = fuelEntries.reduce((s, e) => s + e.total_cost, 0);
  const totalServiceCost = serviceRecords.reduce((s, r) => s + (r.cost || 0), 0);
  const totalExpenseCost = expenses.reduce((s, e) => s + e.amount, 0);
  const totalRecordedCost = totalFuelCost + totalServiceCost + totalExpenseCost;

  // Efficiency stats
  const mileageStats = computeMileageStats(fuelEntries);
  const avgMileage = mileageStats.runningAverage?.value ?? null;
  const mileageUnit = mileageStats.runningAverage?.unit
    ? MILEAGE_UNIT_LABELS[mileageStats.runningAverage.unit]
    : 'km/L';

  // Cost per km over tracked odometer interval
  const { kmTracked, costPerKm } = computeCostPerKm(
    fuelEntries.map((e) => e.odometer),
    totalRecordedCost
  );

  // Category breakdown
  const { slices: costSlices } = aggregateCostBreakdown(
    fuelEntries,
    serviceRecords,
    expenses,
    vehicle.fuel_type === 'electric'
  );

  // Chronological sorting (newest first for tables)
  const sortedFuel = [...fuelEntries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const sortedServices = [...serviceRecords].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const supersededDocs = allDocuments.filter((d) => d.superseded_by !== null);

  const generatedDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Vehicle History Report — ${escapeHtml(vehicle.nickname)}</title>
  <style>
    @page {
      margin: 14mm 12mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 24px;
      color: #1e293b;
      background: #ffffff;
      -webkit-font-smoothing: antialiased;
      line-height: 1.4;
    }
    .header {
      border-bottom: 2px solid #0284c7;
      padding-bottom: 14px;
      margin-bottom: 16px;
    }
    .brand-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #64748b;
      margin-bottom: 6px;
    }
    .brand-name {
      font-weight: 800;
      color: #0284c7;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .report-title {
      font-size: 24px;
      font-weight: 800;
      color: #0f172a;
      margin: 2px 0 6px 0;
    }
    .vehicle-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .badge-reg {
      background: #0f172a;
      color: #ffffff;
      font-weight: 700;
      font-size: 13px;
      padding: 4px 8px;
      border-radius: 4px;
      letter-spacing: 0.5px;
    }
    .vehicle-specs {
      font-size: 14px;
      font-weight: 600;
      color: #334155;
    }
    .disclosure-box {
      background: #fffbeb;
      border: 1px solid #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 10px 14px;
      border-radius: 4px;
      font-size: 11px;
      color: #92400e;
      margin: 12px 0 20px 0;
      line-height: 1.5;
    }
    .section-title {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1.5px solid #cbd5e1;
      padding-bottom: 4px;
      margin: 22px 0 10px 0;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 14px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px;
    }
    .kpi-label {
      font-size: 10px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 700;
    }
    .kpi-val {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 11px;
      page-break-inside: auto;
    }
    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    thead {
      display: table-header-group;
    }
    th {
      background: #f1f5f9;
      padding: 7px 8px;
      text-align: left;
      font-weight: 700;
      border-bottom: 2px solid #cbd5e1;
      font-size: 10px;
      color: #475569;
      text-transform: uppercase;
    }
    td {
      padding: 7px 8px;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
    }
    tr:nth-child(even) td {
      background: #fafafa;
    }
    .cost-col {
      text-align: right;
      font-weight: 700;
    }
    .status-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 700;
    }
    .status-valid { background: #dcfce7; color: #15803d; }
    .status-expired { background: #fee2e2; color: #b91c1c; }
    .status-superseded { background: #f1f5f9; color: #64748b; }
    .footnote {
      font-size: 10px;
      color: #64748b;
      margin-top: -4px;
      margin-bottom: 12px;
      font-style: italic;
    }
    .footer {
      margin-top: 28px;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <!-- ══════════════════════════════════════════════════════════ -->
  <!-- ── Section 1: Vehicle Summary ─────────────────────────── -->
  <!-- ══════════════════════════════════════════════════════════ -->
  <div class="header">
    <div class="brand-row">
      <span class="brand-name">DriveLedger · Verified Ownership Provenance</span>
      <span>Report Generated: <b>${generatedDate}</b></span>
    </div>
    <div class="report-title">${escapeHtml(vehicle.nickname)} — Vehicle History Report</div>
    <div class="vehicle-row">
      ${includeSensitiveDetails ? `<span class="badge-reg">${escapeHtml(vehicle.registration_number)}</span>` : ''}
      <span class="vehicle-specs">
        ${escapeHtml([vehicle.manufacturer, vehicle.model, vehicle.variant].filter(Boolean).join(' '))}
        ${vehicle.year ? `(${vehicle.year})` : ''} · Fuel: ${(vehicle.fuel_type || 'Petrol').toUpperCase()}
      </span>
    </div>
  </div>

  <!-- Mandatory Truth Disclosure (Feature 7.3) -->
  <div class="disclosure-box">
    <b>ℹ️ Notice of Record Authenticity:</b> Generated from records stored in DriveLedger. Entries have not been independently verified.
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Current Odometer</div>
      <div class="kpi-val">${vehicle.current_odometer ? formatOdometer(vehicle.current_odometer) : '—'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Reporting Period</div>
      <div class="kpi-val" style="font-size: 13px;">${escapeHtml(dateRangeLabel)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Recorded Spend</div>
      <div class="kpi-val">${formatCurrency(totalRecordedCost)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Average Mileage</div>
      <div class="kpi-val">${avgMileage ? formatMileage(avgMileage, mileageUnit) : '—'}</div>
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════ -->
  <!-- ── Section 2: Fuel &amp; Mileage History ──────────────────── -->
  <!-- ══════════════════════════════════════════════════════════ -->
  <div class="section-title">Section 2 — Fuel &amp; Efficiency Ledger</div>
  <table>
    <thead>
      <tr>
        <th style="width: 14%;">Date</th>
        <th style="width: 15%;">Odometer</th>
        <th style="width: 25%;">Station / Pump</th>
        <th style="width: 14%;">Quantity</th>
        <th style="width: 14%;">Rate (₹)</th>
        <th style="width: 18%; text-align: right;">Mileage (${mileageUnit})</th>
      </tr>
    </thead>
    <tbody>
      ${
        sortedFuel.length > 0
          ? sortedFuel.map((f, i) => {
              // Suspicious odometer detection (Feature 7.3)
              const nextOlder = sortedFuel[i + 1];
              const isAnomaly = nextOlder && f.odometer < nextOlder.odometer;
              return `<tr>
                <td><b>${f.date}</b></td>
                <td>
                  ${formatOdometer(f.odometer)}
                  ${isAnomaly ? '<br><span style="color: #dc2626; font-size: 9px; font-weight: 700;">⚠️ Reading decrease</span>' : ''}
                </td>
                <td>${escapeHtml(f.fuel_station || '—')}</td>
                <td>${f.fuel_amount} ${f.fuel_unit}</td>
                <td>₹${f.price_per_unit}</td>
                <td style="text-align: right; font-weight: 700;">
                  ${f.calculated_mileage != null ? f.calculated_mileage.toFixed(2) : '<span style="color: #94a3b8; font-weight: 400;">— (partial/baseline)</span>'}
                </td>
              </tr>`;
            }).join('')
          : '<tr><td colspan="6" style="text-align: center; color: #94a3b8;">No fuel entries recorded.</td></tr>'
      }
    </tbody>
  </table>

  <!-- ══════════════════════════════════════════════════════════ -->
  <!-- ── Section 3: Maintenance &amp; Component History ─────────── -->
  <!-- ══════════════════════════════════════════════════════════ -->
  <div class="section-title">Section 3 — Maintenance &amp; Replaced Components</div>
  <table>
    <thead>
      <tr>
        <th style="width: 14%;">Date</th>
        <th style="width: 15%;">Odometer</th>
        <th style="width: 22%;">Service Performed</th>
        <th style="width: 25%;">Workshop / Garage</th>
        <th style="width: 12%;">Next Due</th>
        <th style="width: 12%; text-align: right;">Cost (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${
        sortedServices.length > 0
          ? sortedServices.map((s) => `<tr>
              <td><b>${s.date}</b></td>
              <td>${s.odometer ? formatOdometer(s.odometer) : '—'}</td>
              <td>
                <b>${escapeHtml(s.service_type)}</b>
                ${s.work_done ? `<br><span style="color: #64748b; font-size: 10px;">${escapeHtml(s.work_done)}</span>` : ''}
              </td>
              <td>${escapeHtml(s.garage_name || '—')}</td>
              <td>${s.next_due_km ? formatOdometer(s.next_due_km) : s.next_due_date || '—'}</td>
              <td class="cost-col">${s.cost != null ? formatCurrency(s.cost) : '—'}</td>
            </tr>`).join('')
          : '<tr><td colspan="6" style="text-align: center; color: #94a3b8;">No service records recorded.</td></tr>'
      }
    </tbody>
  </table>

  ${
    maintenanceComponents.length > 0
      ? `
    <div style="font-size: 11px; font-weight: 700; color: #475569; margin: 8px 0 4px 0; text-transform: uppercase;">
      Individual Component Replacement &amp; Wear Tracking (Feature 4):
    </div>
    <table>
      <thead>
        <tr>
          <th>Component Part</th>
          <th>Action</th>
          <th>Brand / Spec</th>
          <th>Component Cost</th>
          <th>Next Due Odometer</th>
          <th>Next Due Date</th>
        </tr>
      </thead>
      <tbody>
        ${maintenanceComponents.map((c) => `<tr>
          <td><b>${escapeHtml(c.component_name)}</b></td>
          <td style="text-transform: capitalize;">${c.action.replace('_', ' ')}</td>
          <td>${escapeHtml(c.brand || '—')}</td>
          <td>${c.cost != null ? formatCurrency(c.cost) : '—'}</td>
          <td>${c.next_due_km ? formatOdometer(c.next_due_km) : '—'}</td>
          <td>${c.next_due_date || '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>`
      : ''
  }

  <!-- ══════════════════════════════════════════════════════════ -->
  <!-- ── Section 4: Ownership Costs &amp; Cost Per Kilometre ────── -->
  <!-- ══════════════════════════════════════════════════════════ -->
  <div class="section-title">Section 4 — Ownership Costs &amp; Operating Metrics</div>
  <table>
    <thead>
      <tr>
        <th style="width: 40%;">Category</th>
        <th style="width: 30%;">Records Count</th>
        <th style="width: 30%; text-align: right;">Total Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${costSlices.map((s) => `<tr>
        <td><b>${s.icon} ${escapeHtml(s.label)}</b></td>
        <td>Recorded in period</td>
        <td class="cost-col">${formatCurrency(s.amount)}</td>
      </tr>`).join('')}
      <tr style="background: #f1f5f9; font-weight: 800;">
        <td>TOTAL RECORDED COST</td>
        <td>—</td>
        <td class="cost-col">${formatCurrency(totalRecordedCost)}</td>
      </tr>
    </tbody>
  </table>

  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 14px;">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-size: 11px; font-weight: 700; color: #475569; text-transform: uppercase;">Recorded Operating Cost per km</div>
        <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
          Compatible distance tracked: <b>${kmTracked.toLocaleString('en-IN')} km</b> over ${fuelEntries.length} fill-ups
        </div>
      </div>
      <div style="font-size: 18px; font-weight: 800; color: #0284c7;">
        ${costPerKm != null ? `${formatCurrency(costPerKm)} / km` : '—'}
      </div>
    </div>
    <div class="footnote" style="margin-top: 8px; margin-bottom: 0;">
      * Recorded operating cost per km covers recorded fuel, routine maintenance, and running expense entries divided by tracked odometer interval. Excludes initial purchase price, vehicle financing, and depreciation unless explicitly entered.
    </div>
  </div>

  <!-- ══════════════════════════════════════════════════════════ -->
  <!-- ── Section 5: Documents &amp; Compliance Renewal History ──── -->
  <!-- ══════════════════════════════════════════════════════════ -->
  <div class="section-title">Section 5 — Documents &amp; Compliance History</div>
  <table>
    <thead>
      <tr>
        <th style="width: 20%;">Document</th>
        <th style="width: 25%;">Number / Authority</th>
        <th style="width: 15%;">Issue Date</th>
        <th style="width: 15%;">Expiry Date</th>
        <th style="width: 15%;">Status</th>
        <th style="width: 10%; text-align: right;">Digital Scan</th>
      </tr>
    </thead>
    <tbody>
      ${
        documents.length > 0
          ? documents.map((d) => {
              const isExpired = d.expiry_date && new Date(d.expiry_date) < new Date();
              return `<tr>
                <td><b>${escapeHtml(d.type.toUpperCase())}</b></td>
                <td>${escapeHtml(d.document_number || d.insurer_name || '—')}</td>
                <td>${d.issue_date || '—'}</td>
                <td>${d.expiry_date || 'No expiry'}</td>
                <td>
                  <span class="status-badge ${isExpired ? 'status-expired' : 'status-valid'}">
                    ${isExpired ? 'EXPIRED' : 'ACTIVE / VALID'}
                  </span>
                </td>
                <td style="text-align: right;">${d.file_uri ? '📎 Attached' : '—'}</td>
              </tr>`;
            }).join('')
          : '<tr><td colspan="6" style="text-align: center; color: #94a3b8;">No active documents recorded.</td></tr>'
      }
    </tbody>
  </table>

  ${
    supersededDocs.length > 0
      ? `
    <div style="font-size: 11px; font-weight: 700; color: #475569; margin: 8px 0 4px 0; text-transform: uppercase;">
      Document Renewal &amp; Predecessor History (Feature 5):
    </div>
    <table>
      <thead>
        <tr>
          <th>Document Type</th>
          <th>Document / Policy #</th>
          <th>Insurer / Provider</th>
          <th>Original Expiry</th>
          <th>Status</th>
          <th style="text-align: right;">Archived Scan</th>
        </tr>
      </thead>
      <tbody>
        ${supersededDocs.map((sd) => `<tr>
          <td><b>${escapeHtml(sd.type.toUpperCase())}</b></td>
          <td>${escapeHtml(sd.document_number || '—')}</td>
          <td>${escapeHtml(sd.insurer_name || '—')}</td>
          <td>${sd.expiry_date || '—'}</td>
          <td><span class="status-badge status-superseded">SUPERSEDED 🔄</span></td>
          <td style="text-align: right;">${sd.file_uri ? '📎 Archived' : '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>`
      : ''
  }

  <!-- Footer -->
  <div class="footer">
    <span>DriveLedger — 100% Offline, Private Vehicle Expense Ledger</span>
    <span>Vehicle ID: ${vehicle.id.slice(0, 8)} · Generated ${generatedDate}</span>
  </div>
</body>
</html>`;
}
