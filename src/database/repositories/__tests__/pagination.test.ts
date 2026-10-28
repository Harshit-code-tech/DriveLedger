import { resetMockDatabase } from '@/__mocks__/expo-sqlite';
import { getDatabase } from '@/database/connection';
import { createTables } from '@/database/schema';
import * as vehicleRepo from '../vehicleRepo';
import * as fuelRepo from '../fuelRepo';
import * as serviceRepo from '../serviceRepo';
import * as expenseRepo from '../expenseRepo';
import * as tripRepo from '../tripRepo';
import * as maintCompRepo from '../maintenanceComponentRepo';
import { FuelType, VehicleType, FuelUnit } from '@/constants/fuelTypes';
import type { Vehicle } from '@/types/vehicle';

describe('Repository Pagination & Batch Queries', () => {
  let vehicle: Vehicle;

  beforeEach(() => {
    resetMockDatabase();
    const db = getDatabase();
    createTables(db);

    vehicle = vehicleRepo.createVehicle({
      nickname: 'Pagination Test Car',
      vehicle_type: VehicleType.CAR,
      fuel_type: FuelType.PETROL,
      registration_number: 'DL-01-PG-9999',
      current_odometer: 10000,
    });
  });

  describe('Fuel Pagination', () => {
    it('paginates fuel entries and computes total count', () => {
      // Create 5 entries across different dates
      for (let i = 1; i <= 5; i++) {
        fuelRepo.createFuelEntryAtomic(
          {
            vehicle_id: vehicle.id,
            date: `2026-03-0${i}`,
            odometer: 10000 + i * 100,
            fuel_amount: 25,
            fuel_unit: FuelUnit.LITRES,
            price_per_unit: 100,
            is_full_tank: 1,
            fuel_station: i % 2 === 0 ? 'Shell' : 'IndianOil',
          },
          vehicle.fuel_type as FuelType,
          vehicle.vehicle_type as VehicleType
        );
      }

      expect(fuelRepo.getFuelEntryCount(vehicle.id)).toBe(5);

      // Page 1 (limit 3)
      const page1 = fuelRepo.getPaginatedFuelEntries(vehicle.id, { limit: 3 });
      expect(page1.items).toHaveLength(3);
      expect(page1.hasMore).toBe(true);
      expect(page1.totalCount).toBe(5);
      expect(page1.items[0].date).toBe('2026-03-05');
      expect(page1.nextCursor).not.toBeNull();

      // Page 2 (from cursor)
      const page2 = fuelRepo.getPaginatedFuelEntries(vehicle.id, {
        limit: 3,
        cursor: page1.nextCursor,
      });
      expect(page2.items).toHaveLength(2);
      expect(page2.hasMore).toBe(false);
      expect(page2.items[0].date).toBe('2026-03-02');
      expect(page2.items[1].date).toBe('2026-03-01');

      // Search filtering
      const searchResult = fuelRepo.getPaginatedFuelEntries(vehicle.id, {
        searchQuery: 'shell',
      });
      expect(searchResult.items).toHaveLength(2);
      expect(searchResult.totalCount).toBe(2);

      // Date range filtering
      const dateResult = fuelRepo.getPaginatedFuelEntries(vehicle.id, {
        startDate: '2026-03-04',
      });
      expect(dateResult.items).toHaveLength(2);
    });
  });

  describe('Service Pagination & Batch Components', () => {
    it('paginates service records and batches maintenance components by service ID', () => {
      const serviceIds: string[] = [];
      for (let i = 1; i <= 4; i++) {
        const s = serviceRepo.createServiceRecord({
          vehicle_id: vehicle.id,
          date: `2026-04-1${i}`,
          odometer: 11000 + i * 200,
          service_type: i % 2 === 0 ? 'General Service' : 'Oil Change',
          cost: 1500 * i,
        });
        serviceIds.push(s.id);

        maintCompRepo.createMaintenanceComponent({
          service_record_id: s.id,
          vehicle_id: vehicle.id,
          component_name: `Part ${i}`,
          cost: 500,
        });
      }

      expect(serviceRepo.getServiceRecordCount(vehicle.id)).toBe(4);

      // Paginated
      const page = serviceRepo.getPaginatedServiceRecords(vehicle.id, { limit: 2 });
      expect(page.items).toHaveLength(2);
      expect(page.hasMore).toBe(true);

      // Batch maintenance components
      const compMap = maintCompRepo.getMaintenanceComponentsByServiceIds(page.items.map((r) => r.id));
      expect(Object.keys(compMap)).toHaveLength(2);
      expect(compMap[page.items[0].id]).toHaveLength(1);
      expect(compMap[page.items[1].id]).toHaveLength(1);

      // Empty serviceIds returns empty object without querying
      expect(maintCompRepo.getMaintenanceComponentsByServiceIds([])).toEqual({});
    });
  });

  describe('Expense Pagination', () => {
    it('paginates expenses and filters by category/description', () => {
      for (let i = 1; i <= 3; i++) {
        expenseRepo.createExpense({
          vehicle_id: vehicle.id,
          date: `2026-05-0${i}`,
          category: i === 1 ? 'Toll' : 'Parking',
          amount: 100 * i,
          description: `Receipt note ${i}`,
        });
      }

      expect(expenseRepo.getExpenseCount(vehicle.id)).toBe(3);

      const page = expenseRepo.getPaginatedExpenses(vehicle.id, {
        limit: 2,
      });
      expect(page.items).toHaveLength(2);
      expect(page.hasMore).toBe(true);

      const search = expenseRepo.getPaginatedExpenses(vehicle.id, {
        searchQuery: 'toll',
      });
      expect(search.items).toHaveLength(1);
      expect(search.items[0].category).toBe('Toll');
    });
  });

  describe('Trip Pagination', () => {
    it('paginates trips and excludes discarded status', () => {
      for (let i = 1; i <= 3; i++) {
        tripRepo.createManualTrip({
          vehicle_id: vehicle.id,
          date: `2026-06-0${i}`,
          start_odometer: 12000 + (i - 1) * 50,
          end_odometer: 12000 + i * 50,
          purpose: i === 1 ? 'Office commute' : 'Errand',
        });
      }

      // Discarded trip
      const discarded = tripRepo.createManualTrip({
        vehicle_id: vehicle.id,
        date: '2026-06-04',
        start_odometer: 12200,
        end_odometer: 12210,
      });
      tripRepo.updateTripStatus(discarded.id, 'discarded');

      expect(tripRepo.getTripCount(vehicle.id)).toBe(3);

      const page = tripRepo.getPaginatedTrips(vehicle.id, { limit: 2 });
      expect(page.items).toHaveLength(2);
      expect(page.hasMore).toBe(true);
      expect(page.items.some((t) => t.id === discarded.id)).toBe(false);
    });
  });
});
