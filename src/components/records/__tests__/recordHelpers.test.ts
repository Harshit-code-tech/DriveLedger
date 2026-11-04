/**
 * Unit tests for recordHelpers.ts
 */

import {
  formatDayMonth,
  formatMonthGroup,
  getMonthKey,
  isDateInRange,
  mapFuelToRecordItem,
  mapServiceToRecordItem,
  mapExpenseToRecordItem,
  mapTripToRecordItem,
  matchesSearch,
  filterAndGroupRecords,
} from '../recordHelpers';
import type { FuelEntry } from '@/types/fuel';
import type { ServiceRecord } from '@/types/service';
import type { Expense } from '@/types/expense';
import type { Trip } from '@/types/trip';
import type { Vehicle } from '@/types/vehicle';
import { FuelType, VehicleType, FuelUnit, MileageUnit } from '@/constants/fuelTypes';

describe('recordHelpers', () => {
  describe('formatDayMonth', () => {
    it('formats ISO dates correctly into day and month', () => {
      expect(formatDayMonth('2026-11-03')).toBe('03 Nov');
      expect(formatDayMonth('2026-01-15')).toBe('15 Jan');
      expect(formatDayMonth('2026-10-28T14:30:00.000Z')).toBe('28 Oct');
    });

    it('handles empty or malformed strings safely', () => {
      expect(formatDayMonth('')).toBe('');
      expect(formatDayMonth('invalid')).toBe('invalid');
    });
  });

  describe('formatMonthGroup', () => {
    it('formats month and year into header string', () => {
      expect(formatMonthGroup('2026-11-03')).toBe('NOVEMBER 2026');
      expect(formatMonthGroup('2026-10-28T10:00:00Z')).toBe('OCTOBER 2026');
    });
  });

  describe('getMonthKey', () => {
    it('returns YYYY-MM', () => {
      expect(getMonthKey('2026-11-03')).toBe('2026-11');
      expect(getMonthKey('2026-10-28T10:00:00Z')).toBe('2026-10');
    });
  });

  describe('isDateInRange', () => {
    it('returns true for all range', () => {
      expect(isDateInRange('2020-01-01', 'all')).toBe(true);
    });

    it('returns correct value for recent ranges', () => {
      const today = new Date().toISOString().split('T')[0];
      expect(isDateInRange(today, 'week')).toBe(true);
      expect(isDateInRange(today, 'month')).toBe(true);
      expect(isDateInRange(today, '30days')).toBe(true);
      expect(isDateInRange('2020-01-01', 'week')).toBe(false);
    });
  });

  describe('mapping to RecordItem', () => {
    const testVehicle: Vehicle = {
      id: 'v1',
      nickname: 'Honda City',
      manufacturer: 'Honda',
      model: 'City',
      variant: null,
      year: 2022,
      color: null,
      registration_number: 'OD 02 AB 1234',
      vehicle_type: VehicleType.CAR,
      fuel_type: FuelType.PETROL,
      tank_capacity: 40,
      secondary_tank_capacity: null,
      current_odometer: 25000,
      front_tyre_pressure: 32,
      rear_tyre_pressure: 30,
      service_interval_km: 10000,
      service_interval_months: 12,
      purchase_date: null,
      notes: null,
      is_archived: 0,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      deleted_at: null,
    };

    it('maps fuel entry correctly', () => {
      const fuel: FuelEntry = {
        id: 'f1',
        vehicle_id: 'v1',
        date: '2026-11-03',
        odometer: 25000,
        fuel_amount: 12.5,
        fuel_unit: FuelUnit.LITRES,
        price_per_unit: 96,
        total_cost: 1200,
        fuel_station: 'Shell Petrol Pump',
        is_full_tank: 1,
        calculated_mileage: 18.2,
        mileage_unit: MileageUnit.KM_PER_LITRE,
        receipt_photo_uri: null,
        notes: 'Full tank test',
        created_at: '2026-11-03',
        updated_at: '2026-11-03',
        deleted_at: null,
      };

      const item = mapFuelToRecordItem(fuel, testVehicle);
      expect(item.type).toBe('fuel');
      expect(item.icon).toBe('⛽');
      expect(item.title).toBe('Petrol Full Tank');
      expect(item.subtitle).toBe('03 Nov · Shell Petrol Pump');
      expect(item.secondaryValue).toBe('12.5 L');
    });

    it('maps service record correctly', () => {
      const service: ServiceRecord = {
        id: 's1',
        vehicle_id: 'v1',
        date: '2026-11-02',
        odometer: 24800,
        service_type: 'Maintenance',
        cost: 850,
        work_done: 'Oil change',
        garage_name: 'City Motors',
        next_due_km: 30000,
        next_due_date: '2027-05-01',
        notes: 'Synthetic oil used',
        receipt_photo_uri: null,
        created_at: '2026-11-02',
        updated_at: '2026-11-02',
        deleted_at: null,
      };

      const item = mapServiceToRecordItem(service);
      expect(item.type).toBe('service');
      expect(item.icon).toBe('🔧');
      expect(item.subtitle).toBe('02 Nov · Oil change');
    });

    it('maps trip record correctly', () => {
      const trip: Trip = {
        id: 't1',
        vehicle_id: 'v1',
        start_time: '2026-11-01T09:00:00Z',
        end_time: '2026-11-01T09:28:00Z',
        distance_km: 12.4,
        duration_seconds: 1680,
        trip_type: 'gps',
        status: 'completed',
        purpose: 'Trip',
        notes: 'Morning highway run',
        start_odometer: 24700,
        end_odometer: 24712,
        sample_count: 50,
        quality_warning: null,
        diagnostics: null,
        created_at: '2026-11-01',
        updated_at: '2026-11-01',
        deleted_at: null,
      };

      const item = mapTripToRecordItem(trip);
      expect(item.type).toBe('trip');
      expect(item.primaryValue).toBe('12.40 km');
      expect(item.subtitle).toBe('01 Nov · 28 min');
    });
  });

  describe('filterAndGroupRecords', () => {
    it('correctly filters and groups records chronologically', () => {
      const fuelEntries: FuelEntry[] = [
        {
          id: 'f1',
          vehicle_id: 'v1',
          date: '2026-11-03',
          odometer: 25000,
          fuel_amount: 12.5,
          fuel_unit: FuelUnit.LITRES,
          price_per_unit: 96,
          total_cost: 1200,
          fuel_station: 'Shell',
          is_full_tank: 1,
          calculated_mileage: null,
          mileage_unit: null,
          receipt_photo_uri: null,
          notes: null,
          created_at: '2026-11-03',
          updated_at: '2026-11-03',
          deleted_at: null,
        },
        {
          id: 'f2',
          vehicle_id: 'v1',
          date: '2026-10-28',
          odometer: 24000,
          fuel_amount: 15,
          fuel_unit: FuelUnit.LITRES,
          price_per_unit: 100,
          total_cost: 1500,
          fuel_station: 'IOCL',
          is_full_tank: 1,
          calculated_mileage: null,
          mileage_unit: null,
          receipt_photo_uri: null,
          notes: null,
          created_at: '2026-10-28',
          updated_at: '2026-10-28',
          deleted_at: null,
        },
      ];

      const serviceRecords: ServiceRecord[] = [
        {
          id: 's1',
          vehicle_id: 'v1',
          date: '2026-11-02',
          odometer: 24800,
          service_type: 'Maintenance',
          cost: 850,
          work_done: 'Oil change',
          garage_name: null,
          next_due_km: null,
          next_due_date: null,
          notes: null,
          receipt_photo_uri: null,
          created_at: '2026-11-02',
          updated_at: '2026-11-02',
          deleted_at: null,
        },
      ];

      const trips: Trip[] = [
        {
          id: 't1',
          vehicle_id: 'v1',
          start_time: '2026-11-01T10:00:00Z',
          end_time: '2026-11-01T10:28:00Z',
          distance_km: 12.4,
          duration_seconds: 1680,
          trip_type: 'gps',
          status: 'completed',
          purpose: 'Trip',
          notes: null,
          start_odometer: null,
          end_odometer: null,
          sample_count: 40,
          quality_warning: null,
          diagnostics: null,
          created_at: '2026-11-01',
          updated_at: '2026-11-01',
          deleted_at: null,
        },
      ];

      const sections = filterAndGroupRecords({
        fuelEntries,
        serviceRecords,
        expenses: [],
        trips,
        vehicle: null,
        category: 'all',
        dateRange: 'all',
        searchQuery: '',
        sortOrder: 'newest',
      });

      expect(sections.length).toBe(2);
      expect(sections[0].title).toBe('NOVEMBER 2026');
      expect(sections[0].data.length).toBe(3);
      expect(sections[0].data[0].id).toBe('f1');
      expect(sections[0].data[1].id).toBe('s1');
      expect(sections[0].data[2].id).toBe('t1');

      expect(sections[1].title).toBe('OCTOBER 2026');
      expect(sections[1].data.length).toBe(1);
      expect(sections[1].data[0].id).toBe('f2');
    });
  });
});
