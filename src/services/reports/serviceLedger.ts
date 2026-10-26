/**
 * Service Ledger Report
 *
 * Generates the "Verified Vehicle Service Ledger" PDF HTML template.
 * This report lists complete dated maintenance history (garage names, parts replaced,
 * costs) and is intended for resale value documentation (Spinny, Cars24, private buyers).
 *
 * Extracted from reportService.ts for single-responsibility organisation.
 */

import type { Vehicle } from '@/types/vehicle';
import type { ServiceRecord } from '@/types/service';
import type { Expense } from '@/types/expense';
import { formatCurrency, formatOdometer } from '@/utils/format';
import { escapeHtml } from './reportHtmlHelpers';

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
    <div class="title">Vehicle Service &amp; Maintenance Ledger</div>
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
      <div class="stat-label">Repairs &amp; Parts</div>
      <div class="stat-val">${formatCurrency(totalRepairCost)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Maintenance</div>
      <div class="stat-val">${formatCurrency(totalMaintenanceCost)}</div>
    </div>
  </div>

  <h2>Scheduled Services &amp; Routine Maintenance</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 12%;">Date</th>
        <th style="width: 14%;">Odometer</th>
        <th style="width: 20%;">Service Type</th>
        <th style="width: 20%;">Workshop / Garage</th>
        <th style="width: 22%;">Work Done &amp; Parts</th>
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
      ? `<h2>Unscheduled Repairs &amp; Parts Replaced</h2>
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
