/**
 * Vehicle Dossier Report
 *
 * Generates the "Complete Vehicle Dossier" PDF HTML template.
 * Full executive report containing efficiency metrics, service history,
 * and active document validity (Insurance, PUC, RC).
 *
 * Extracted from reportService.ts for single-responsibility organisation.
 */

import type { Vehicle } from '@/types/vehicle';
import type { ServiceRecord } from '@/types/service';
import type { FuelEntry } from '@/types/fuel';
import type { Expense } from '@/types/expense';
import type { VehicleDocument } from '@/types/document';
import { formatCurrency, formatOdometer, formatMileage } from '@/utils/format';
import { escapeHtml } from './reportHtmlHelpers';

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

  <h2>Active Documents &amp; Validity</h2>
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
