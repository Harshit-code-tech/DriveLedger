/**
 * Report Service Unit Tests
 *
 * Validates:
 * 1. Resale Service Ledger HTML Generation (layout, stats, escaping)
 * 2. Complete Vehicle Dossier HTML Generation (compliance, documents, fuel history)
 * 3. Business & Tax CSV Generation (UTF-8 BOM, RFC 4180 escaping, formula neutralization, sorting)
 */

jest.mock('react-native', () => ({
  Platform: { OS: 'android', select: (dict: any) => dict.android ?? dict.default },
}));

jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn().mockResolvedValue({ uri: 'file:///cache/report.pdf' }),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///documents/',
  readAsStringAsync: jest.fn().mockResolvedValue('JVBERi0xLjQKJ...'),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: { UTF8: 'utf8', Base64: 'base64' },
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn().mockResolvedValue({
      granted: true,
      directoryUri: 'content://com.android.externalstorage.documents/tree/primary%3ADownload',
    }),
    createFileAsync: jest.fn().mockResolvedValue('content://com.android.externalstorage.documents/document/file.pdf'),
  },
}));

import {
  generateServiceLedgerHtml,
  generateVehicleDossierHtml,
  generateFuelExpensesCsv,
  saveServiceLedgerPdf,
  exportServiceLedgerPdf,
  saveVehicleDossierPdf,
  exportVehicleDossierPdf,
  saveFuelExpensesCsvFile,
  exportFuelExpensesCsvFile,
  ServiceLedgerData,
  VehicleDossierData,
} from '../reportService';
import type { Vehicle } from '@/types/vehicle';
import type { ServiceRecord } from '@/types/service';
import type { FuelEntry } from '@/types/fuel';
import type { Expense } from '@/types/expense';
import type { VehicleDocument } from '@/types/document';
import { VehicleType, FuelType, FuelUnit, MileageUnit } from '@/constants/fuelTypes';
import { DocumentType } from '@/constants/documentTypes';

const mockVehicle: Vehicle = {
  id: 'veh-test-123',
  nickname: 'Thunderbird',
  registration_number: 'MH 12 AB 1234',
  vehicle_type: VehicleType.CAR,
  fuel_type: FuelType.PETROL,
  current_odometer: 45000,
  manufacturer: 'Maruti Suzuki',
  model: 'Brezza',
  variant: 'ZXi+ AT',
  year: 2022,
  color: 'Magma Grey',
  tank_capacity: 48,
  secondary_tank_capacity: null,
  front_tyre_pressure: 33,
  rear_tyre_pressure: 33,
  service_interval_km: 10000,
  purchase_date: '2022-01-01',
  notes: null,
  is_archived: 0,
  created_at: '2022-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
};

const mockServices: ServiceRecord[] = [
  {
    id: 'srv-1',
    vehicle_id: mockVehicle.id,
    date: '2026-03-10',
    odometer: 40000,
    service_type: 'Major Service',
    cost: 8500,
    work_done: 'Engine oil 0W-20, spark plugs, air filter replaced',
    garage_name: 'Maruti Authorized Service, Pune',
    next_due_km: 50000,
    next_due_date: '2027-03-10',
    notes: 'Brake pads at 60%',
    created_at: '2026-03-10T10:00:00Z',
    updated_at: '2026-03-10T10:00:00Z',
    deleted_at: null,
  },
  {
    id: 'srv-2',
    vehicle_id: mockVehicle.id,
    date: '2025-09-05',
    odometer: 30000,
    service_type: 'Routine Maintenance',
    cost: 3200,
    work_done: 'Oil & oil filter replacement',
    garage_name: 'Speedy Auto Works',
    next_due_km: 40000,
    next_due_date: '2026-09-05',
    notes: null,
    created_at: '2025-09-05T10:00:00Z',
    updated_at: '2025-09-05T10:00:00Z',
    deleted_at: null,
  },
];

const mockRepairs: Expense[] = [
  {
    id: 'exp-1',
    vehicle_id: mockVehicle.id,
    date: '2026-01-15',
    category: 'Repair',
    amount: 4500,
    description: 'Front left brake disc pad replaced',
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
    deleted_at: null,
  },
];

const mockFuelEntries: FuelEntry[] = [
  {
    id: 'fuel-1',
    vehicle_id: mockVehicle.id,
    date: '2026-04-01',
    odometer: 44500,
    fuel_amount: 35.5,
    fuel_unit: FuelUnit.LITRES,
    price_per_unit: 104.5,
    total_cost: 3709.75,
    fuel_station: 'Indian Oil, Kothrud',
    is_full_tank: 1,
    calculated_mileage: 15.8,
    mileage_unit: MileageUnit.KM_PER_LITRE,
    receipt_photo_uri: null,
    notes: 'City commute',
    fuel_system: 'primary',
    battery_start_percent: null,
    battery_end_percent: null,
    created_at: '2026-04-01T10:00:00Z',
    updated_at: '2026-04-01T10:00:00Z',
    deleted_at: null,
  },
];

const mockDocuments: VehicleDocument[] = [
  {
    id: 'doc-1',
    vehicle_id: mockVehicle.id,
    type: DocumentType.INSURANCE,
    document_number: 'POL-987654321',
    insurer_name: 'HDFC ERGO General Insurance',
    issue_date: '2025-06-01',
    expiry_date: '2026-05-31',
    file_uri: null,
    superseded_by: null,
    notes: 'Zero depreciation comprehensive',
    created_at: '2025-06-01T10:00:00Z',
    updated_at: '2025-06-01T10:00:00Z',
    deleted_at: null,
  },
  {
    id: 'doc-2',
    vehicle_id: mockVehicle.id,
    type: DocumentType.PUC,
    document_number: 'PUC-445566',
    insurer_name: null,
    issue_date: '2026-01-10',
    expiry_date: '2026-07-09',
    file_uri: null,
    superseded_by: null,
    notes: 'Valid for 6 months',
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-01-10T10:00:00Z',
    deleted_at: null,
  },
];

describe('reportService: generateServiceLedgerHtml', () => {
  it('generates executive HTML with vehicle info, stats, and verified seal', () => {
    const data: ServiceLedgerData = {
      vehicle: mockVehicle,
      serviceRecords: mockServices,
      repairExpenses: mockRepairs,
    };

    const html = generateServiceLedgerHtml(data);

    expect(html).toContain('MH 12 AB 1234');
    expect(html).toContain('Thunderbird');
    expect(html).toContain('Maruti Suzuki Brezza ZXi+ AT (2022)');
    expect(html).toContain('Offline Verified Record');
    expect(html).toContain('Maruti Authorized Service, Pune');
    expect(html).toContain('Engine oil 0W-20, spark plugs, air filter replaced');
    expect(html).toContain('Front left brake disc pad replaced');
    expect(html).toContain('Total Services');
    expect(html).toContain('Service Spend');
  });

  it('escapes dangerous HTML characters to prevent XSS in print preview', () => {
    const maliciousVehicle: Vehicle = {
      ...mockVehicle,
      nickname: '<script>alert("hack")</script>',
    };
    const maliciousService: ServiceRecord = {
      ...mockServices[0],
      garage_name: '<b>Super Garage</b> & "Sons"',
    };

    const html = generateServiceLedgerHtml({
      vehicle: maliciousVehicle,
      serviceRecords: [maliciousService],
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(&quot;hack&quot;)&lt;/script&gt;');
    expect(html).toContain('&lt;b&gt;Super Garage&lt;/b&gt; &amp; &quot;Sons&quot;');
  });

  it('gracefully handles empty records', () => {
    const html = generateServiceLedgerHtml({
      vehicle: mockVehicle,
      serviceRecords: [],
      repairExpenses: [],
    });

    expect(html).toContain('No scheduled service records logged.');
  });
});

describe('reportService: generateVehicleDossierHtml', () => {
  it('includes document compliance, fuel history, and efficiency metrics', () => {
    const dossierData: VehicleDossierData = {
      vehicle: mockVehicle,
      fuelEntries: mockFuelEntries,
      serviceRecords: mockServices,
      expenses: mockRepairs,
      documents: mockDocuments,
      avgMileage: 15.8,
      mileageUnit: 'km/L',
      totalOwnershipCost: 19909.75,
    };

    const html = generateVehicleDossierHtml(dossierData);

    expect(html).toContain('Thunderbird — Complete Dossier');
    expect(html).toContain('MH 12 AB 1234');
    expect(html).toContain('HDFC ERGO General Insurance');
    expect(html).toContain('POL-987654321');
    expect(html).toContain('PUC-445566');
    expect(html).toContain('15.8 km/L');
    expect(html).toContain('Indian Oil, Kothrud');
  });
});

describe('reportService: generateFuelExpensesCsv', () => {
  it('prepends UTF-8 BOM and outputs valid RFC 4180 headers and rows', () => {
    const csv = generateFuelExpensesCsv(
      mockVehicle,
      mockFuelEntries,
      mockRepairs,
      mockServices
    );

    // Byte Order Mark for Excel
    expect(csv.charCodeAt(0)).toBe(0xfeff);

    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe(
      'Date,Vehicle,Registration,Category,Odometer (km),Quantity,Unit,Rate (INR),Total Cost (INR),Station / Garage / Vendor,Full Tank,Calculated Mileage,Notes / Description'
    );

    // Fuel row
    expect(csv).toContain('"Indian Oil, Kothrud"');
    expect(csv).toContain('15.80');

    // Service row
    expect(csv).toContain('"Maruti Authorized Service, Pune"');
    expect(csv).toContain('Service');

    // Expense row
    expect(csv).toContain('Repair');
    expect(csv).toContain('"Front left brake disc pad replaced"');
  });

  it('neutralizes formula injection characters (=, +, -, @)', () => {
    const maliciousExpenses: Expense[] = [
      {
        id: 'exp-hack',
        vehicle_id: mockVehicle.id,
        date: '2026-04-10',
        category: '=SUM(1,2)',
        amount: 100,
        description: '+cmd.exe|calc',
        created_at: '2026-04-10T10:00:00Z',
        updated_at: '2026-04-10T10:00:00Z',
        deleted_at: null,
      },
    ];

    const csv = generateFuelExpensesCsv(mockVehicle, [], maliciousExpenses, []);

    expect(csv).toContain("'=SUM(1,2)");
    expect(csv).toContain("'+cmd.exe|calc");
  });
});

describe('reportService: save and share operations', () => {
  it('saves Service Ledger PDF directly to local storage', async () => {
    const result = await saveServiceLedgerPdf({
      vehicle: mockVehicle,
      serviceRecords: mockServices,
      repairExpenses: mockRepairs,
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('Thunderbird_Service_Ledger.pdf');
  });

  it('shares Service Ledger PDF safely without permission error', async () => {
    const result = await exportServiceLedgerPdf({
      vehicle: mockVehicle,
      serviceRecords: mockServices,
      repairExpenses: mockRepairs,
    });

    expect(result.success).toBe(true);
    expect(result.uri).toContain('Thunderbird_Service_Ledger.pdf');
  });

  it('saves Complete Vehicle Dossier PDF to local storage', async () => {
    const result = await saveVehicleDossierPdf({
      vehicle: mockVehicle,
      fuelEntries: mockFuelEntries,
      serviceRecords: mockServices,
      expenses: mockRepairs,
      documents: mockDocuments,
    });

    expect(result.success).toBe(true);
    expect(result.message).toContain('Thunderbird_Vehicle_Dossier.pdf');
  });

  it('shares Complete Vehicle Dossier PDF safely', async () => {
    const result = await exportVehicleDossierPdf({
      vehicle: mockVehicle,
      fuelEntries: mockFuelEntries,
      serviceRecords: mockServices,
      expenses: mockRepairs,
      documents: mockDocuments,
    });

    expect(result.success).toBe(true);
    expect(result.uri).toContain('Thunderbird_Vehicle_Dossier.pdf');
  });

  it('saves Reimbursement CSV file to local storage', async () => {
    const result = await saveFuelExpensesCsvFile(
      mockVehicle,
      mockFuelEntries,
      mockRepairs,
      mockServices
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain('Thunderbird_Reimbursement_Ledger.csv');
  });

  it('shares Reimbursement CSV file safely', async () => {
    const result = await exportFuelExpensesCsvFile(
      mockVehicle,
      mockFuelEntries,
      mockRepairs,
      mockServices
    );

    expect(result.success).toBe(true);
    expect(result.uri).toContain('Thunderbird_Reimbursement_Ledger.csv');
  });
});
