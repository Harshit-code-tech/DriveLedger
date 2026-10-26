/**
 * Fuel & Expense CSV Generator
 *
 * Produces an RFC 4180 compliant CSV with UTF-8 BOM for Microsoft Excel / Google Sheets.
 * Covers fuel fill-ups, routine services, and non-fuel expenses in a single
 * chronologically sorted ledger suitable for tax reimbursement submissions.
 *
 * Extracted from reportService.ts for single-responsibility organisation.
 */

import type { Vehicle } from '@/types/vehicle';
import type { ServiceRecord } from '@/types/service';
import type { FuelEntry } from '@/types/fuel';
import type { Expense } from '@/types/expense';
import { escapeCsv } from './reportHtmlHelpers';

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
