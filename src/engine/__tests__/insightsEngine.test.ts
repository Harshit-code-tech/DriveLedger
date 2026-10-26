/**
 * Smart Insights Engine Unit Tests
 *
 * Verifies local, deterministic evaluation of maintenance needs,
 * mileage anomalies, repeated repairs, and cost patterns.
 */

import {
  evaluateVehicleInsights,
  generateVehicleInsights,
  type InsightItem,
} from '../insightsEngine';
import { FuelType, FuelUnit, VehicleType } from '@/constants/fuelTypes';
import type { Vehicle } from '@/types/vehicle';
import type { FuelEntry } from '@/types/fuel';
import type { ServiceRecord, MaintenanceProfile, ProfileDueStatus } from '@/types/service';
import type { Expense } from '@/types/expense';
import type { MileageStats } from '@/engine/mileageEngine';

const mockVehicle: Vehicle = {
  id: 'veh_test_1',
  nickname: 'Family Honda City',
  vehicle_type: VehicleType.CAR,
  fuel_type: FuelType.PETROL,
  registration_number: 'DL-01-AB-1234',
  manufacturer: 'Honda',
  model: 'City',
  variant: 'ZX',
  year: 2021,
  color: 'White',
  tank_capacity: 40,
  secondary_tank_capacity: null,
  current_odometer: 42000,
  front_tyre_pressure: 32,
  rear_tyre_pressure: 30,
  service_interval_km: 10000,
  service_interval_months: 6,
  purchase_date: '2021-01-15',
  notes: null,
  is_archived: 0,
  created_at: '2021-01-15T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
};

const emptyMileageStats: MileageStats = {
  lastFillMileage: null,
  runningAverage: null,
  monthlyAverage: null,
  best: null,
  worst: null,
};

describe('InsightsEngine — Insufficient Data & Baseline', () => {
  test('returns insufficient data message and 0 active issues when records < 2', () => {
    const result = evaluateVehicleInsights({
      vehicle: mockVehicle,
      fuelEntries: [],
      serviceRecords: [],
      expenses: [],
      mileageStats: emptyMileageStats,
    });

    expect(result.hasInsufficientData).toBe(true);
    expect(result.activeIssuesCount).toBe(0);
    expect(result.summaryMessage).toContain('More records are needed');
  });
});

describe('InsightsEngine — Scheduled Maintenance Due & Overdue', () => {
  test('flags critical overdue maintenance when current odometer exceeds service interval', () => {
    const lastService: ServiceRecord = {
      id: 'srv_1',
      vehicle_id: mockVehicle.id,
      date: '2025-06-01',
      odometer: 30000,
      service_type: 'General Service',
      cost: 5000,
      work_done: null,
      garage_name: null,
      next_due_km: 40000,
      next_due_date: '2025-12-01',
      notes: null,
      created_at: '2025-06-01T00:00:00Z',
      updated_at: '2025-06-01T00:00:00Z',
      deleted_at: null,
    };

    // Vehicle current odometer is 42000, next due was 40000 -> 2000 km overdue!
    const result = evaluateVehicleInsights({
      vehicle: mockVehicle,
      fuelEntries: [
        {
          id: 'f1',
          vehicle_id: mockVehicle.id,
          date: '2026-01-01',
          odometer: 42000,
          fuel_amount: 30,
          fuel_unit: FuelUnit.LITRES,
          price_per_unit: 100,
          fuel_station: null,
          receipt_photo_uri: null,
          total_cost: 3000,
          is_full_tank: 1,
          calculated_mileage: 15,
          mileage_unit: null,
          fuel_system: null,
          notes: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          deleted_at: null,
        },
      ],
      serviceRecords: [lastService],
      expenses: [],
      mileageStats: emptyMileageStats,
    });

    const overdueInsight = result.insights.find((i) => i.type === 'maintenance_overdue');
    expect(overdueInsight).toBeDefined();
    expect(overdueInsight?.severity).toBe('critical');
    expect(overdueInsight?.reason).toContain('overdue');
  });
});

describe('InsightsEngine — Repeated Repairs Detection', () => {
  test('detects repeated repair for the same component within 5,000 km', () => {
    const srv1: ServiceRecord = {
      id: 'srv_a',
      vehicle_id: mockVehicle.id,
      date: '2025-08-01',
      odometer: 38000,
      service_type: 'Brake Pad Replacement',
      cost: 4000,
      work_done: null,
      garage_name: null,
      next_due_km: null,
      next_due_date: null,
      notes: null,
      created_at: '2025-08-01T00:00:00Z',
      updated_at: '2025-08-01T00:00:00Z',
      deleted_at: null,
    };

    const srv2: ServiceRecord = {
      id: 'srv_b',
      vehicle_id: mockVehicle.id,
      date: '2025-10-15',
      odometer: 40500, // 2,500 km later
      service_type: 'Brake Pad Replacement',
      cost: 4200,
      work_done: null,
      garage_name: null,
      next_due_km: null,
      next_due_date: null,
      notes: null,
      created_at: '2025-10-15T00:00:00Z',
      updated_at: '2025-10-15T00:00:00Z',
      deleted_at: null,
    };

    const result = evaluateVehicleInsights({
      vehicle: mockVehicle,
      fuelEntries: [],
      serviceRecords: [srv2, srv1],
      expenses: [],
      mileageStats: emptyMileageStats,
    });

    const repeatedInsight = result.insights.find((i) => i.type === 'repeated_repair');
    expect(repeatedInsight).toBeDefined();
    expect(repeatedInsight?.title).toContain('Repeated Repair');
    expect(repeatedInsight?.reason).toContain('twice');
  });
});

describe('InsightsEngine — Mileage Anomaly Detection', () => {
  test('flags sustained drop across 3 completed intervals vs baseline (>18% decrease)', () => {
    // 3 baseline entries averaging 18 km/L
    // followed by 3 recent entries averaging 13.5 km/L (25% drop)
    const fuelEntries: FuelEntry[] = [
      // Recent drop entries (descending order by date)
      { id: 'f6', vehicle_id: mockVehicle.id, date: '2026-03-01', odometer: 42000, fuel_amount: 30, fuel_unit: FuelUnit.LITRES, price_per_unit: 100, fuel_station: null, receipt_photo_uri: null, total_cost: 3000, is_full_tank: 1, calculated_mileage: 13.5, mileage_unit: null, fuel_system: null, notes: null, created_at: '', updated_at: '', deleted_at: null },
      { id: 'f5', vehicle_id: mockVehicle.id, date: '2026-02-15', odometer: 41595, fuel_amount: 30, fuel_unit: FuelUnit.LITRES, price_per_unit: 100, fuel_station: null, receipt_photo_uri: null, total_cost: 3000, is_full_tank: 1, calculated_mileage: 13.6, mileage_unit: null, fuel_system: null, notes: null, created_at: '', updated_at: '', deleted_at: null },
      { id: 'f4', vehicle_id: mockVehicle.id, date: '2026-02-01', odometer: 41187, fuel_amount: 30, fuel_unit: FuelUnit.LITRES, price_per_unit: 100, fuel_station: null, receipt_photo_uri: null, total_cost: 3000, is_full_tank: 1, calculated_mileage: 13.4, mileage_unit: null, fuel_system: null, notes: null, created_at: '', updated_at: '', deleted_at: null },
      // Historical baseline entries
      { id: 'f3', vehicle_id: mockVehicle.id, date: '2026-01-15', odometer: 40785, fuel_amount: 30, fuel_unit: FuelUnit.LITRES, price_per_unit: 100, fuel_station: null, receipt_photo_uri: null, total_cost: 3000, is_full_tank: 1, calculated_mileage: 18.0, mileage_unit: null, fuel_system: null, notes: null, created_at: '', updated_at: '', deleted_at: null },
      { id: 'f2', vehicle_id: mockVehicle.id, date: '2026-01-01', odometer: 40245, fuel_amount: 30, fuel_unit: FuelUnit.LITRES, price_per_unit: 100, fuel_station: null, receipt_photo_uri: null, total_cost: 3000, is_full_tank: 1, calculated_mileage: 18.2, mileage_unit: null, fuel_system: null, notes: null, created_at: '', updated_at: '', deleted_at: null },
      { id: 'f1', vehicle_id: mockVehicle.id, date: '2025-12-15', odometer: 39699, fuel_amount: 30, fuel_unit: FuelUnit.LITRES, price_per_unit: 100, fuel_station: null, receipt_photo_uri: null, total_cost: 3000, is_full_tank: 1, calculated_mileage: 17.8, mileage_unit: null, fuel_system: null, notes: null, created_at: '', updated_at: '', deleted_at: null },
    ];

    const result = evaluateVehicleInsights({
      vehicle: mockVehicle,
      fuelEntries,
      serviceRecords: [],
      expenses: [],
      mileageStats: {
        ...emptyMileageStats,
        runningAverage: { value: 18.0, unit: 'km_per_litre' as any },
      },
    });

    const anomalyInsight = result.insights.find((i) => i.type === 'mileage_anomaly');
    expect(anomalyInsight).toBeDefined();
    expect(anomalyInsight?.severity).toBe('warning');
    expect(anomalyInsight?.reason).toContain('below');
    expect(anomalyInsight?.suggestedAction).toContain('tyre pressure');
  });

  test('does not alarm on an isolated single partial or normal variation', () => {
    // 3 entries with only 1 drop and 2 normal entries
    const fuelEntries: FuelEntry[] = [
      { id: 'f3', vehicle_id: mockVehicle.id, date: '2026-02-01', odometer: 41000, fuel_amount: 30, fuel_unit: FuelUnit.LITRES, price_per_unit: 100, fuel_station: null, receipt_photo_uri: null, total_cost: 3000, is_full_tank: 1, calculated_mileage: 17.5, mileage_unit: null, fuel_system: null, notes: null, created_at: '', updated_at: '', deleted_at: null },
      { id: 'f2', vehicle_id: mockVehicle.id, date: '2026-01-15', odometer: 40500, fuel_amount: 30, fuel_unit: FuelUnit.LITRES, price_per_unit: 100, fuel_station: null, receipt_photo_uri: null, total_cost: 3000, is_full_tank: 1, calculated_mileage: 14.0, mileage_unit: null, fuel_system: null, notes: null, created_at: '', updated_at: '', deleted_at: null },
      { id: 'f1', vehicle_id: mockVehicle.id, date: '2026-01-01', odometer: 40000, fuel_amount: 30, fuel_unit: FuelUnit.LITRES, price_per_unit: 100, fuel_station: null, receipt_photo_uri: null, total_cost: 3000, is_full_tank: 1, calculated_mileage: 17.8, mileage_unit: null, fuel_system: null, notes: null, created_at: '', updated_at: '', deleted_at: null },
    ];

    const result = evaluateVehicleInsights({
      vehicle: mockVehicle,
      fuelEntries,
      serviceRecords: [],
      expenses: [],
      mileageStats: {
        ...emptyMileageStats,
        runningAverage: { value: 17.0, unit: 'km_per_litre' as any },
      },
    });

    const anomalyInsight = result.insights.find((i) => i.type === 'mileage_anomaly');
    expect(anomalyInsight).toBeUndefined();
  });
});

describe('InsightsEngine — Data Integrity & Odometer Checks', () => {
  test('does not report anomaly when multiple fills occur on the same date with increasing odometer', () => {
    // Two entries on the same date: 46100 then 46250
    // Passed in reverse-chronological order (46250 first, 46100 second)
    const fuelEntries: FuelEntry[] = [
      {
        id: 'f2',
        vehicle_id: mockVehicle.id,
        date: '2026-10-26',
        odometer: 46250,
        fuel_amount: 10,
        fuel_unit: FuelUnit.LITRES,
        price_per_unit: 90.5,
        total_cost: 905,
        fuel_station: null,
        is_full_tank: 0,
        calculated_mileage: null,
        mileage_unit: null,
        receipt_photo_uri: null,
        notes: null,
        created_at: '2026-10-26T14:00:00Z',
        updated_at: '2026-10-26T14:00:00Z',
        deleted_at: null,
      },
      {
        id: 'f1',
        vehicle_id: mockVehicle.id,
        date: '2026-10-26',
        odometer: 46100,
        fuel_amount: 29,
        fuel_unit: FuelUnit.LITRES,
        price_per_unit: 90.5,
        total_cost: 2624.5,
        fuel_station: null,
        is_full_tank: 1,
        calculated_mileage: 20,
        mileage_unit: null,
        receipt_photo_uri: null,
        notes: null,
        created_at: '2026-10-26T08:00:00Z',
        updated_at: '2026-10-26T08:00:00Z',
        deleted_at: null,
      },
    ];

    const result = evaluateVehicleInsights({
      vehicle: mockVehicle,
      fuelEntries,
      serviceRecords: [],
      expenses: [],
      mileageStats: emptyMileageStats,
    });

    const dropInsight = result.insights.find((i) => i.type === 'data_anomaly');
    expect(dropInsight).toBeUndefined();
  });

  test('reports anomaly with DD-MM-YYYY dates when true odometer rollback occurs', () => {
    const fuelEntries: FuelEntry[] = [
      {
        id: 'f2',
        vehicle_id: mockVehicle.id,
        date: '2026-10-26',
        odometer: 45000, // Rollback from 46100
        fuel_amount: 30,
        fuel_unit: FuelUnit.LITRES,
        price_per_unit: 90,
        total_cost: 2700,
        fuel_station: null,
        is_full_tank: 1,
        calculated_mileage: null,
        mileage_unit: null,
        receipt_photo_uri: null,
        notes: null,
        created_at: '2026-10-26T10:00:00Z',
        updated_at: '2026-10-26T10:00:00Z',
        deleted_at: null,
      },
      {
        id: 'f1',
        vehicle_id: mockVehicle.id,
        date: '2026-10-20',
        odometer: 46100,
        fuel_amount: 30,
        fuel_unit: FuelUnit.LITRES,
        price_per_unit: 90,
        total_cost: 2700,
        fuel_station: null,
        is_full_tank: 1,
        calculated_mileage: null,
        mileage_unit: null,
        receipt_photo_uri: null,
        notes: null,
        created_at: '2026-10-20T10:00:00Z',
        updated_at: '2026-10-20T10:00:00Z',
        deleted_at: null,
      },
    ];

    const result = evaluateVehicleInsights({
      vehicle: mockVehicle,
      fuelEntries,
      serviceRecords: [],
      expenses: [],
      mileageStats: emptyMileageStats,
    });

    const dropInsight = result.insights.find((i) => i.type === 'data_anomaly');
    expect(dropInsight).toBeDefined();
    expect(dropInsight?.severity).toBe('warning');
    expect(dropInsight?.reason).toContain('26-10-2026');
    expect(dropInsight?.reason).toContain('20-10-2026');
    expect(dropInsight?.reason).toContain('45,000 km');
    expect(dropInsight?.reason).toContain('46,100 km');
  });
});

describe('InsightsEngine — Public generateVehicleInsights Wrapper', () => {
  test('returns cleanly formatted VehicleInsight array for UI', () => {
    const insights = generateVehicleInsights(
      mockVehicle,
      [],
      [],
      [],
      []
    );
    expect(Array.isArray(insights)).toBe(true);
  });
});
