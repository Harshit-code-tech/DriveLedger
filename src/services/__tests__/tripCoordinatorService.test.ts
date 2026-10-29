import * as Location from 'expo-location';
import { getDatabase } from '@/database/connection';
import { createTables } from '@/database/schema';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import * as tripRepo from '@/database/repositories/tripRepo';
import { VehicleType, FuelType } from '@/constants/fuelTypes';
import { resetMockDatabase } from '@/__mocks__/expo-sqlite';
import {
  startGpsTripCoordinator,
  pauseGpsTripCoordinator,
  resumeGpsTripCoordinator,
  finishGpsTripCoordinator,
  resetInteractionsForTesting,
} from '../tripCoordinatorService';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getLastKnownPositionAsync: jest.fn().mockResolvedValue(null),
  getCurrentPositionAsync: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/services/locationPermissionService', () => ({
  checkLocationPermissionStatus: jest.fn().mockResolvedValue({
    servicesEnabled: true,
    foregroundGranted: true,
    backgroundGranted: true,
  }),
}));

jest.mock('@/tasks/backgroundLocationTask', () => ({
  startBackgroundLocationUpdates: jest.fn().mockResolvedValue(true),
  stopBackgroundLocationUpdates: jest.fn().mockResolvedValue(undefined),
  resetBackgroundLocationAnchor: jest.fn(),
}));

jest.mock('@/widgets/widgetDataService', () => ({
  syncAllWidgets: jest.fn(),
  syncGpsWidgetState: jest.fn(),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
}));

describe('tripCoordinatorService Lifecycle & Idempotency', () => {
  let vehicle1: any;
  let vehicle2: any;

  beforeEach(() => {
    resetMockDatabase();
    const db = getDatabase();
    createTables(db);
    resetInteractionsForTesting();
    jest.clearAllMocks();

    vehicle1 = vehicleRepo.createVehicle({
      nickname: 'Car 1',
      vehicle_type: VehicleType.CAR,
      fuel_type: FuelType.PETROL,
      registration_number: 'DL01AA0001',
      current_odometer: 10000,
    });

    vehicle2 = vehicleRepo.createVehicle({
      nickname: 'Car 2',
      vehicle_type: VehicleType.CAR,
      fuel_type: FuelType.DIESEL,
      registration_number: 'DL01BB0002',
      current_odometer: 20000,
    });
  });

  describe('startGpsTripCoordinator', () => {
    it('starts an active trip successfully', async () => {
      const res = await startGpsTripCoordinator(vehicle1.id);
      expect(res.success).toBe(true);
      expect(res.data?.status).toBe('recording');
      expect(res.data?.vehicle_id).toBe(vehicle1.id);

      const active = tripRepo.getActiveTrip();
      expect(active?.id).toBe(res.data?.id);
    });

    it('is idempotent when start is called again for the already recording trip', async () => {
      const res1 = await startGpsTripCoordinator(vehicle1.id);
      expect(res1.success).toBe(true);

      const res2 = await startGpsTripCoordinator(vehicle1.id);
      expect(res2.success).toBe(true);
      expect(res2.data?.id).toBe(res1.data?.id);
    });

    it('rejects starting a new trip when a trip is already active on another vehicle', async () => {
      const res1 = await startGpsTripCoordinator(vehicle1.id);
      expect(res1.success).toBe(true);

      const res2 = await startGpsTripCoordinator(vehicle2.id);
      expect(res2.success).toBe(false);
      expect(res2.error).toContain('Only one active trip can exist globally');
    });
  });

  describe('pause and resume idempotency', () => {
    it('pauses a recording trip, and repeated pause is idempotent', async () => {
      const startRes = await startGpsTripCoordinator(vehicle1.id);
      expect(startRes.success).toBe(true);

      const pauseRes1 = await pauseGpsTripCoordinator(startRes.data?.id);
      expect(pauseRes1.success).toBe(true);
      expect(pauseRes1.data?.status).toBe('paused');

      // Second pause call should be idempotent
      const pauseRes2 = await pauseGpsTripCoordinator(startRes.data?.id);
      expect(pauseRes2.success).toBe(true);
      expect(pauseRes2.data?.status).toBe('paused');
    });

    it('resumes a paused trip, and repeated resume is idempotent', async () => {
      const startRes = await startGpsTripCoordinator(vehicle1.id);
      await pauseGpsTripCoordinator(startRes.data?.id);

      const resumeRes1 = await resumeGpsTripCoordinator(startRes.data?.id);
      expect(resumeRes1.success).toBe(true);
      expect(resumeRes1.data?.status).toBe('recording');

      // Second resume call should be idempotent
      const resumeRes2 = await resumeGpsTripCoordinator(startRes.data?.id);
      expect(resumeRes2.success).toBe(true);
      expect(resumeRes2.data?.status).toBe('recording');
    });
  });

  describe('finishGpsTripCoordinator', () => {
    it('finishes an active trip and is idempotent on completed tripId', async () => {
      const startRes = await startGpsTripCoordinator(vehicle1.id);
      const tripId = startRes.data!.id;

      const finishRes1 = await finishGpsTripCoordinator(tripId, { distance_km: 12.5 });
      expect(finishRes1.success).toBe(true);
      expect(finishRes1.data?.status).toBe('completed');
      expect(finishRes1.data?.distance_km).toBe(12.5);

      expect(tripRepo.getActiveTrip()).toBeNull();

      // Repeated finish on the same tripId should return success with completed trip
      const finishRes2 = await finishGpsTripCoordinator(tripId);
      expect(finishRes2.success).toBe(true);
      expect(finishRes2.data?.status).toBe('completed');
      expect(finishRes2.data?.id).toBe(tripId);
    });
  });
});
