import { buildPreTripChecklist, getChecklistStats } from '../checklistStore';
import type { Vehicle } from '@/types/vehicle';
import type { VehicleDocument } from '@/types/document';
import { DocumentType } from '@/constants/documentTypes';
import { FuelType, VehicleType } from '@/constants/fuelTypes';

describe('Pre-Trip Road Trip Inspection Checklist (Feature 4.3)', () => {
  const mockCar: Vehicle = {
    id: 'veh_car_1',
    nickname: 'Honda City',
    manufacturer: 'Honda',
    model: 'City',
    variant: null,
    year: null,
    color: null,
    vehicle_type: VehicleType.CAR,
    fuel_type: FuelType.PETROL,
    current_odometer: 45000,
    front_tyre_pressure: 32,
    rear_tyre_pressure: 35,
    tank_capacity: 40,
    secondary_tank_capacity: null,
    registration_number: 'MH12AB1234',
    service_interval_km: 10000,
    service_interval_months: 12,
    purchase_date: null,
    notes: null,
    is_archived: 0,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    deleted_at: null,
  };

  const mockBike: Vehicle = {
    id: 'veh_bike_1',
    nickname: 'Royal Enfield Hunter',
    manufacturer: 'Royal Enfield',
    model: 'Hunter',
    variant: null,
    year: null,
    color: null,
    vehicle_type: VehicleType.TWO_WHEELER,
    fuel_type: FuelType.PETROL,
    current_odometer: 12000,
    front_tyre_pressure: 28,
    rear_tyre_pressure: 32,
    tank_capacity: 13,
    secondary_tank_capacity: null,
    registration_number: 'MH14XY9999',
    service_interval_km: 5000,
    service_interval_months: 6,
    purchase_date: null,
    notes: null,
    is_archived: 0,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    deleted_at: null,
  };

  const mockEV: Vehicle = {
    id: 'veh_ev_1',
    nickname: 'Tata Nexon EV',
    manufacturer: 'Tata',
    model: 'Nexon EV',
    variant: null,
    year: null,
    color: null,
    vehicle_type: VehicleType.CAR,
    fuel_type: FuelType.ELECTRIC,
    current_odometer: 20000,
    front_tyre_pressure: 34,
    rear_tyre_pressure: 34,
    tank_capacity: 40.5,
    secondary_tank_capacity: null,
    registration_number: 'DL1CAB0001',
    service_interval_km: 10000,
    service_interval_months: 12,
    purchase_date: null,
    notes: null,
    is_archived: 0,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    deleted_at: null,
  };

  describe('Vehicle-Adaptive Item Generation', () => {
    it('includes stepney, jack tools, and washer fluid for a car', () => {
      const items = buildPreTripChecklist(mockCar, []);
      const itemIds = items.map((i) => i.id);

      expect(itemIds).toContain('front_tyre');
      expect(itemIds).toContain('rear_tyre');
      expect(itemIds).toContain('spare_wheel');
      expect(itemIds).toContain('jack_tools');
      expect(itemIds).toContain('engine_oil');
      expect(itemIds).toContain('coolant');
      expect(itemIds).toContain('washer_fluid');
      expect(itemIds).not.toContain('chain_brakes');
      expect(itemIds).not.toContain('charging_cable');

      // Check specific recommended PSI from vehicle specs
      const front = items.find((i) => i.id === 'front_tyre');
      expect(front?.title).toContain('32 PSI');
      const rear = items.find((i) => i.id === 'rear_tyre');
      expect(rear?.title).toContain('35 PSI');
    });

    it('adapts items for a 2-wheeler (chain slack, no stepney/jack)', () => {
      const items = buildPreTripChecklist(mockBike, []);
      const itemIds = items.map((i) => i.id);

      expect(itemIds).toContain('front_tyre');
      expect(itemIds).toContain('rear_tyre');
      expect(itemIds).toContain('chain_brakes');
      expect(itemIds).toContain('engine_oil');
      expect(itemIds).toContain('coolant');
      expect(itemIds).not.toContain('spare_wheel');
      expect(itemIds).not.toContain('jack_tools');
      expect(itemIds).not.toContain('washer_fluid');

      const front = items.find((i) => i.id === 'front_tyre');
      expect(front?.title).toContain('28 PSI');
    });

    it('adapts items for an EV (replaces engine oil/coolant with charger/cables)', () => {
      const items = buildPreTripChecklist(mockEV, []);
      const itemIds = items.map((i) => i.id);

      expect(itemIds).toContain('charging_cable');
      expect(itemIds).toContain('battery_charge');
      expect(itemIds).not.toContain('engine_oil');
      expect(itemIds).not.toContain('coolant');
    });
  });

  describe('PUC Auto-Verification', () => {
    it('flags expired PUC certificate with 10k fine warning', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);

      const docs: VehicleDocument[] = [
        {
          id: 'doc_puc_1',
          vehicle_id: 'veh_car_1',
          type: DocumentType.PUC,
          document_number: 'PUC123',
          insurer_name: 'Govt PUC',
          issue_date: '2025-01-01',
          expiry_date: pastDate.toISOString().split('T')[0],
          file_uri: null,
          notes: null,
          superseded_by: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          deleted_at: null,
        },
      ];

      const items = buildPreTripChecklist(mockCar, docs);
      const pucItem = items.find((i) => i.id === 'puc_validity');
      expect(pucItem?.badgeType).toBe('danger');
      expect(pucItem?.title).toContain('EXPIRED');
      expect(pucItem?.tip).toContain('10,000 fine');
    });

    it('marks valid PUC certificate with success badge', () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 6);

      const docs: VehicleDocument[] = [
        {
          id: 'doc_puc_1',
          vehicle_id: 'veh_car_1',
          type: DocumentType.PUC,
          document_number: 'PUC123',
          insurer_name: 'Govt PUC',
          issue_date: '2026-01-01',
          expiry_date: futureDate.toISOString().split('T')[0],
          file_uri: null,
          notes: null,
          superseded_by: null,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          deleted_at: null,
        },
      ];

      const items = buildPreTripChecklist(mockCar, docs);
      const pucItem = items.find((i) => i.id === 'puc_validity');
      expect(pucItem?.badgeType).toBe('success');
      expect(pucItem?.title).toContain('Valid ✅');
    });
  });

  describe('Checklist Statistics', () => {
    it('computes correct completion percentage and status', () => {
      const items = buildPreTripChecklist(mockCar, []);
      expect(getChecklistStats(items).percent).toBe(0);
      expect(getChecklistStats(items).isComplete).toBe(false);

      // Check all items
      const allIds = items.map((i) => i.id);
      const checkedItems = buildPreTripChecklist(mockCar, [], allIds);
      const stats = getChecklistStats(checkedItems);

      expect(stats.completed).toBe(stats.total);
      expect(stats.percent).toBe(100);
      expect(stats.isComplete).toBe(true);
    });
  });
});
