jest.mock('@/database/repositories/serviceRepo', () => ({
  getServiceRecordsByVehicle: jest.fn().mockReturnValue([]),
  createServiceRecord: jest.fn(),
  updateServiceRecord: jest.fn(),
  softDeleteServiceRecord: jest.fn(),
  getServiceRecordById: jest.fn(),
}));

import { getKmUntilService, getServiceDueStatus } from '../serviceStore';
import type { Vehicle } from '@/types/vehicle';
import type { ServiceRecord } from '@/types/service';

describe('Dual-Dimension Service Reminders (Mileage vs. Time)', () => {
  const baseVehicle: Vehicle = {
    id: 'veh_test_1',
    name: 'Tata Nexon EV',
    type: 'car',
    fuel_type: 'ev',
    current_odometer: 15000,
    tank_capacity: null,
    battery_capacity: 40.5,
    registration_number: 'MH02EK1234',
    service_interval_km: 10000,
    service_interval_months: 12,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    deleted_at: null,
  };

  describe('getKmUntilService', () => {
    it('calculates km remaining based on latest service next_due_km', () => {
      const service: ServiceRecord = {
        id: 'srv_1',
        vehicle_id: 'veh_test_1',
        date: '2026-01-01',
        odometer: 10000,
        service_type: 'periodic',
        cost: 5000,
        notes: null,
        center_name: 'Tata Motors',
        next_due_km: 20000,
        next_due_date: '2027-01-01',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        deleted_at: null,
      };

      const km = getKmUntilService(baseVehicle, service);
      expect(km).toBe(5000); // 20000 - 15000
    });

    it('calculates km remaining using service odometer + vehicle service_interval_km fallback', () => {
      const service: ServiceRecord = {
        id: 'srv_1',
        vehicle_id: 'veh_test_1',
        date: '2026-01-01',
        odometer: 12000,
        service_type: 'periodic',
        cost: 5000,
        notes: null,
        center_name: null,
        next_due_km: null,
        next_due_date: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        deleted_at: null,
      };

      const km = getKmUntilService(baseVehicle, service);
      expect(km).toBe(7000); // (12000 + 10000) - 15000 = 7000
    });
  });

  describe('getServiceDueStatus', () => {
    it('returns overdue when mileage limit has been crossed', () => {
      const vehicle: Vehicle = {
        ...baseVehicle,
        current_odometer: 20500,
      };

      const service: ServiceRecord = {
        id: 'srv_1',
        vehicle_id: 'veh_test_1',
        date: new Date().toISOString().split('T')[0], // serviced today
        odometer: 10000,
        service_type: 'periodic',
        cost: 4000,
        notes: null,
        center_name: null,
        next_due_km: 20000,
        next_due_date: null, // far in the future
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        deleted_at: null,
      };

      const status = getServiceDueStatus(vehicle, service);
      expect(status.urgency).toBe('overdue');
      expect(status.reason).toBe('km');
      expect(status.kmRemaining).toBe(-500);
      expect(status.headline).toContain('Mileage Exceeded');
    });

    it('returns overdue when time interval has elapsed even with low mileage', () => {
      const vehicle: Vehicle = {
        ...baseVehicle,
        current_odometer: 11000, // only driven 1000 km since last service
      };

      // Service was 14 months ago
      const pastDate = new Date();
      pastDate.setMonth(pastDate.getMonth() - 14);

      const service: ServiceRecord = {
        id: 'srv_1',
        vehicle_id: 'veh_test_1',
        date: pastDate.toISOString().split('T')[0],
        odometer: 10000,
        service_type: 'periodic',
        cost: 4000,
        notes: null,
        center_name: null,
        next_due_km: 20000,
        next_due_date: null, // should calculate from date + 12 months
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        deleted_at: null,
      };

      const status = getServiceDueStatus(vehicle, service);
      expect(status.urgency).toBe('overdue');
      expect(status.reason).toBe('time');
      expect(status.headline).toContain('Time Limit Reached');
    });

    it('returns due_soon when mileage is within 1000 km threshold', () => {
      const vehicle: Vehicle = {
        ...baseVehicle,
        current_odometer: 19500, // 500 km remaining to 20000
      };

      const service: ServiceRecord = {
        id: 'srv_1',
        vehicle_id: 'veh_test_1',
        date: new Date().toISOString().split('T')[0],
        odometer: 10000,
        service_type: 'periodic',
        cost: 4000,
        notes: null,
        center_name: null,
        next_due_km: 20000,
        next_due_date: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        deleted_at: null,
      };

      const status = getServiceDueStatus(vehicle, service);
      expect(status.urgency).toBe('due_soon');
      expect(status.reason).toBe('km');
      expect(status.kmRemaining).toBe(500);
      expect(status.headline).toContain('500 km');
    });

    it('returns due_soon when time is within 30 days threshold', () => {
      const vehicle: Vehicle = {
        ...baseVehicle,
        current_odometer: 12000,
      };

      // Target due in 15 days
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 15);

      const service: ServiceRecord = {
        id: 'srv_1',
        vehicle_id: 'veh_test_1',
        date: '2025-10-15',
        odometer: 10000,
        service_type: 'periodic',
        cost: 4000,
        notes: null,
        center_name: null,
        next_due_km: 20000,
        next_due_date: dueDate.toISOString().split('T')[0],
        created_at: '2025-10-15T00:00:00Z',
        updated_at: '2025-10-15T00:00:00Z',
        deleted_at: null,
      };

      const status = getServiceDueStatus(vehicle, service);
      expect(status.urgency).toBe('due_soon');
      expect(status.reason).toBe('time');
      expect(status.headline).toContain('Days');
      expect(status.daysRemaining).toBeGreaterThanOrEqual(14);
      expect(status.daysRemaining).toBeLessThanOrEqual(16);
    });

    it('returns ok status when both distance and time are comfortably within interval', () => {
      const vehicle: Vehicle = {
        ...baseVehicle,
        current_odometer: 12000,
      };

      // Next due in 8 months
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + 8);

      const service: ServiceRecord = {
        id: 'srv_1',
        vehicle_id: 'veh_test_1',
        date: '2026-01-01',
        odometer: 10000,
        service_type: 'periodic',
        cost: 4000,
        notes: null,
        center_name: null,
        next_due_km: 20000,
        next_due_date: dueDate.toISOString().split('T')[0],
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        deleted_at: null,
      };

      const status = getServiceDueStatus(vehicle, service);
      expect(status.urgency).toBe('ok');
      expect(status.reason).toBeNull();
      expect(status.headline).toBe('Service Status Normal');
      expect(status.subtext).toContain('8,000 km');
    });
  });
});
