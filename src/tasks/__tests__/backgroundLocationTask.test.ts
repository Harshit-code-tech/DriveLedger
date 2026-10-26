/**
 * Tests for BackgroundLocationTask
 *
 * Validates background location execution, SQLite persistence,
 * diagnostic tracking, and listener dispatch.
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { getDatabase } from '@/database/connection';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import * as tripRepo from '@/database/repositories/tripRepo';
import { VehicleType, FuelType } from '@/constants/fuelTypes';
import {
  BACKGROUND_LOCATION_TASK,
  handleBackgroundLocations,
  startBackgroundLocationUpdates,
  stopBackgroundLocationUpdates,
  isBackgroundLocationUpdatesActive,
  addBackgroundLocationListener,
  getGpsTrackingOptions,
} from '../backgroundLocationTask';

jest.mock('@/widgets/widgetDataService', () => ({
  syncGpsWidgetState: jest.fn().mockResolvedValue(undefined),
}));

describe('BackgroundLocationTask (Android 8+ Lifecycle & Persistence)', () => {
  let vehicleId: string;

  beforeEach(() => {
    jest.clearAllMocks();
    (Location as any)._resetLocationMockState?.();

    const db = getDatabase();
    db.execSync(`
      DELETE FROM trip_locations;
      DELETE FROM trips;
      DELETE FROM vehicles;
    `);

    const vehicle = vehicleRepo.createVehicle({
      nickname: 'Test Car',
      vehicle_type: VehicleType.CAR,
      fuel_type: FuelType.PETROL,
      registration_number: 'DL-01-AB-1234',
      current_odometer: 10000,
    });
    vehicleId = vehicle.id;

    (Location.isBackgroundLocationAvailableAsync as jest.Mock).mockResolvedValue(true);
    (Location.hasStartedLocationUpdatesAsync as jest.Mock).mockResolvedValue(false);
  });

  describe('Task Registration', () => {
    test('registers BACKGROUND_LOCATION_TASK with TaskManager', () => {
      expect(TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)).toBe(true);
    });
  });

  describe('handleBackgroundLocations', () => {
    test('stops background updates and exits if no trip is actively recording in SQLite', async () => {
      (Location.hasStartedLocationUpdatesAsync as jest.Mock).mockResolvedValueOnce(true);

      const fakeLocations: Location.LocationObject[] = [
        {
          coords: {
            latitude: 28.6139,
            longitude: 77.209,
            altitude: 210,
            accuracy: 10,
            altitudeAccuracy: null,
            speed: 15,
            heading: 90,
          },
          timestamp: 1700000000000,
        },
      ];

      await handleBackgroundLocations(fakeLocations);

      expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith(BACKGROUND_LOCATION_TASK);
    });

    test('persists accepted samples, increments distance, and updates SQLite trip row', async () => {
      const trip = tripRepo.createActiveTrip({
        vehicle_id: vehicleId,
        recording_method: 'gps',
      });

      const listenerCalls: any[] = [];
      const unsubscribe = addBackgroundLocationListener((event) => {
        listenerCalls.push(event);
      });

      const sampleBatch1: Location.LocationObject[] = [
        {
          coords: {
            latitude: 28.6139,
            longitude: 77.209,
            altitude: 200,
            accuracy: 10,
            altitudeAccuracy: null,
            speed: 12,
            heading: 90,
          },
          timestamp: 1700000000000,
        },
        {
          // ~111m away
          coords: {
            latitude: 28.6149,
            longitude: 77.209,
            altitude: 200,
            accuracy: 8,
            altitudeAccuracy: null,
            speed: 15,
            heading: 90,
          },
          timestamp: 1700000005000,
        },
      ];

      await handleBackgroundLocations(sampleBatch1);

      // Verify points in SQLite
      const storedLocations = tripRepo.getTripLocations(trip.id);
      expect(storedLocations.length).toBe(2);
      expect(storedLocations[0].is_rejected).toBe(0);
      expect(storedLocations[1].is_rejected).toBe(0);

      // Verify trip record updated in SQLite
      const updatedTrip = tripRepo.getTripById(trip.id)!;
      expect(updatedTrip.distance_km).toBeGreaterThan(0.08);
      expect(updatedTrip.sample_count).toBe(2);

      // Verify listener was notified
      expect(listenerCalls.length).toBe(1);
      expect(listenerCalls[0].tripId).toBe(trip.id);
      expect(listenerCalls[0].acceptedSamplesCount).toBe(2);
      expect(listenerCalls[0].totalDistanceKm).toBe(updatedTrip.distance_km);

      unsubscribe();
    });

    test('tracks rejections and signal gaps in SQLite diagnostics', async () => {
      const trip = tripRepo.createActiveTrip({
        vehicle_id: vehicleId,
        recording_method: 'gps',
      });

      const locations: Location.LocationObject[] = [
        {
          // Initial anchor fix
          coords: {
            latitude: 28.6139,
            longitude: 77.209,
            altitude: 200,
            accuracy: 10,
            altitudeAccuracy: null,
            speed: 10,
            heading: 0,
          },
          timestamp: 1700000000000,
        },
        {
          // Poor accuracy (> 35m)
          coords: {
            latitude: 28.615,
            longitude: 77.209,
            altitude: 200,
            accuracy: 65,
            altitudeAccuracy: null,
            speed: 10,
            heading: 0,
          },
          timestamp: 1700000002000,
        },
        {
          // 150 seconds later (> 120s threshold = gap detected)
          coords: {
            latitude: 28.62,
            longitude: 77.209,
            altitude: 200,
            accuracy: 8,
            altitudeAccuracy: null,
            speed: 15,
            heading: 0,
          },
          timestamp: 1700000150000,
        },
      ];

      await handleBackgroundLocations(locations);

      const updatedTrip = tripRepo.getTripById(trip.id)!;
      expect(updatedTrip.diagnostics).toBeDefined();

      const diag = JSON.parse(updatedTrip.diagnostics!);
      expect(diag.total_samples_received).toBe(3);
      expect(diag.accepted_samples_count).toBe(2);
      expect(diag.rejected_samples_count).toBe(1);
      expect(diag.rejection_counts.poor_accuracy).toBe(1);
      expect(diag.has_gap_warning).toBe(true);
      expect(diag.gap_count).toBe(1);
    });
  });

  describe('startBackgroundLocationUpdates & stopBackgroundLocationUpdates', () => {
    test('provides progressively lower-power GPS profiles', () => {
      expect(getGpsTrackingOptions('high_accuracy')).toMatchObject({
        accuracy: Location.Accuracy.High,
        timeInterval: 2000,
        distanceInterval: 3,
      });
      expect(getGpsTrackingOptions('balanced')).toMatchObject({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
        distanceInterval: 10,
      });
      expect(getGpsTrackingOptions('battery_saver')).toMatchObject({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 10000,
        distanceInterval: 20,
      });
    });

    test('starts Location.startLocationUpdatesAsync with Android Foreground Service notification options', async () => {
      const started = await startBackgroundLocationUpdates();
      expect(started).toBe(true);

      expect(Location.startLocationUpdatesAsync).toHaveBeenCalledWith(
        BACKGROUND_LOCATION_TASK,
        expect.objectContaining({
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 3,
          deferredUpdatesDistance: 15,
          deferredUpdatesInterval: 10000,
          deferredTimeout: 15000,
          showsBackgroundLocationIndicator: true,
          foregroundService: expect.objectContaining({
            notificationTitle: 'DriveLedger Trip Recording',
            notificationBody: expect.any(String),
            notificationColor: '#084CB4',
          }),
        })
      );
    });

    test('stops background updates with Location.stopLocationUpdatesAsync', async () => {
      (Location.hasStartedLocationUpdatesAsync as jest.Mock).mockResolvedValueOnce(true);

      await stopBackgroundLocationUpdates();
      expect(Location.stopLocationUpdatesAsync).toHaveBeenCalledWith(BACKGROUND_LOCATION_TASK);
    });

    test('isBackgroundLocationUpdatesActive returns correct boolean status', async () => {
      (Location.hasStartedLocationUpdatesAsync as jest.Mock).mockResolvedValueOnce(true);
      const active = await isBackgroundLocationUpdatesActive();
      expect(active).toBe(true);
    });
  });
});
