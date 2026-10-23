/**
 * Trip Repository Test Suite
 *
 * Verifies SQLite CRUD operations for GPS trips, manual odometer-based entries,
 * coordinate samples batching, and crash recovery (`recoverInterruptedTrips`).
 */

import { getDatabase } from '@/database/connection';
import { createTables } from '@/database/schema';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import * as tripRepo from '../tripRepo';
import { FuelType, VehicleType } from '@/constants/fuelTypes';
import { resetMockDatabase } from '@/__mocks__/expo-sqlite';
import type { Vehicle } from '@/types/vehicle';
import type { FilteredLocationSample } from '@/types/trip';

describe('Trip Repository', () => {
  let db: any;
  let testVehicle: Vehicle;

  beforeEach(() => {
    resetMockDatabase();
    db = getDatabase();
    createTables(db);

    testVehicle = vehicleRepo.createVehicle({
      nickname: 'Workhorse Thar',
      vehicle_type: VehicleType.CAR,
      fuel_type: FuelType.DIESEL,
      registration_number: 'MH-02-CB-1234',
      current_odometer: 15000,
    });
  });

  test('creates active GPS trip and retrieves it via getActiveTrip', () => {
    const trip = tripRepo.createActiveTrip({
      vehicle_id: testVehicle.id,
      recording_method: 'gps',
      start_odometer: 15000,
      purpose: 'Highway Drive',
    });

    expect(trip.id).toBeDefined();
    expect(trip.status).toBe('recording');
    expect(trip.trip_type).toBe('gps');
    expect(trip.start_odometer).toBe(15000);

    const active = tripRepo.getActiveTrip(testVehicle.id);
    expect(active?.id).toBe(trip.id);
    expect(active?.status).toBe('recording');
  });

  test('updates trip status between recording and paused', () => {
    const trip = tripRepo.createActiveTrip({
      vehicle_id: testVehicle.id,
    });

    tripRepo.updateTripStatus(trip.id, 'paused');
    let fetched = tripRepo.getTripById(trip.id);
    expect(fetched?.status).toBe('paused');

    tripRepo.updateTripStatus(trip.id, 'recording');
    fetched = tripRepo.getTripById(trip.id);
    expect(fetched?.status).toBe('recording');
  });

  test('finalizes active trip with calculated metrics, notes, and warnings', () => {
    const trip = tripRepo.createActiveTrip({
      vehicle_id: testVehicle.id,
    });

    const finalized = tripRepo.finalizeTrip(trip.id, {
      distance_km: 24.5,
      duration_minutes: 32,
      notes: 'Rainy highway commute',
      purpose: 'Commute',
      end_odometer: 15025,
      has_quality_warnings: true,
      quality_notes: 'Temporary signal loss under flyover',
    });

    expect(finalized?.status).toBe('completed');
    expect(finalized?.distance_km).toBe(24.5);
    expect(finalized?.duration_seconds).toBe(32 * 60);
    expect(finalized?.notes).toBe('Rainy highway commute');
    expect(finalized?.end_odometer).toBe(15025);
    expect(finalized?.quality_warning).toBe('Temporary signal loss under flyover');

    // Trip is no longer active
    expect(tripRepo.getActiveTrip(testVehicle.id)).toBeNull();
  });

  test('creates manual odometer-based trip with correct distance calculation', () => {
    const manualTrip = tripRepo.createManualTrip({
      vehicle_id: testVehicle.id,
      date: '2026-03-10',
      start_odometer: 15000,
      end_odometer: 15120, // 120 km
      duration_minutes: 100,
      purpose: 'Client Site Visit',
      notes: 'NH-48 route',
    });

    expect(manualTrip.status).toBe('completed');
    expect(manualTrip.trip_type).toBe('manual');
    expect(manualTrip.distance_km).toBe(120);
    expect(manualTrip.start_odometer).toBe(15000);
    expect(manualTrip.end_odometer).toBe(15120);
    expect(manualTrip.duration_seconds).toBe(6000);
  });

  test('rejects manual trip when end odometer is lower than start odometer', () => {
    expect(() => {
      tripRepo.createManualTrip({
        vehicle_id: testVehicle.id,
        date: '2026-03-10',
        start_odometer: 15100,
        end_odometer: 15050, // Invalid: backwards odometer
      });
    }).toThrow('Ending odometer cannot be lower than starting odometer.');
  });

  test('saves GPS location samples in batch and increments sample_count', () => {
    const trip = tripRepo.createActiveTrip({
      vehicle_id: testVehicle.id,
    });

    const samples: FilteredLocationSample[] = [
      {
        latitude: 28.631,
        longitude: 77.216,
        accuracy: 10,
        altitude: 215,
        speed: 12,
        heading: 90,
        timestamp: 1700000000000,
        isAccepted: true,
        stepDistanceMeters: 0,
      },
      {
        latitude: 28.632,
        longitude: 77.217,
        accuracy: 12,
        altitude: 216,
        speed: 14,
        heading: 92,
        timestamp: 1700000005000,
        isAccepted: true,
        stepDistanceMeters: 140,
      },
    ];

    tripRepo.saveTripLocationsBatch(trip.id, samples);

    const storedLocations = tripRepo.getTripLocations(trip.id);
    expect(storedLocations.length).toBe(2);
    expect(storedLocations[0].latitude).toBe(28.631);
    expect(storedLocations[1].longitude).toBe(77.217);

    const updatedTrip = tripRepo.getTripById(trip.id);
    expect(updatedTrip?.sample_count).toBe(2);
  });

  test('recoverInterruptedTrips recovers abandoned/crashed trips on restart with calculated distance from stored locations', () => {
    // Simulate an app crash during recording
    const danglingTrip = tripRepo.createActiveTrip({
      vehicle_id: testVehicle.id,
      purpose: 'Unfinished drive',
    });

    // Add location samples to the trip before crash
    const samples: FilteredLocationSample[] = [
      {
        latitude: 28.631,
        longitude: 77.216,
        accuracy: 10,
        timestamp: 1700000000000,
        isAccepted: true,
        stepDistanceMeters: 0,
      },
      {
        latitude: 28.640,
        longitude: 77.225, // ~1.3 km away
        accuracy: 10,
        timestamp: 1700000120000,
        isAccepted: true,
        stepDistanceMeters: 1300,
      },
    ];
    tripRepo.saveTripLocationsBatch(danglingTrip.id, samples);

    // Verify it is currently in recording status
    expect(tripRepo.getActiveTrip(testVehicle.id)?.id).toBe(danglingTrip.id);

    // Call recovery (runs on app boot)
    const recoveredCount = tripRepo.recoverInterruptedTrips();
    expect(recoveredCount).toBe(1);

    // Should now be marked 'interrupted' with explanatory quality warning and preserved distance
    const recovered = tripRepo.getTripById(danglingTrip.id);
    expect(recovered?.status).toBe('interrupted');
    expect(recovered?.quality_warning).toContain('interrupted');
    expect(recovered?.distance_km).toBeGreaterThan(1.0);
    expect(recovered?.duration_seconds).toBe(120);
    expect(recovered?.sample_count).toBe(2);

    // No longer blocks new trips as an active trip
    expect(tripRepo.getActiveTrip(testVehicle.id)).toBeNull();
  });

  test('recoverInterruptedTrips does NOT mark paused trips as interrupted', () => {
    const pausedTrip = tripRepo.createActiveTrip({
      vehicle_id: testVehicle.id,
      purpose: 'Paused errand',
    });
    tripRepo.updateTripStatus(pausedTrip.id, 'paused');

    // Run recovery
    const recoveredCount = tripRepo.recoverInterruptedTrips();
    expect(recoveredCount).toBe(0);

    // Should remain paused and still be retrieved via getActiveTrip
    const stillActive = tripRepo.getActiveTrip(testVehicle.id);
    expect(stillActive?.id).toBe(pausedTrip.id);
    expect(stillActive?.status).toBe('paused');
  });

  test('finalizes active trip with diagnostics and reads it back', () => {
    const trip = tripRepo.createActiveTrip({
      vehicle_id: testVehicle.id,
    });

    const finalized = tripRepo.finalizeTrip(trip.id, {
      distance_km: 15.2,
      duration_minutes: 20,
      diagnostics: {
        rejection_counts: {
          invalid_coordinates: 0,
          poor_accuracy: 2,
          unknown_accuracy: 1,
          stale_or_duplicate_timestamp: 0,
          stationary_drift: 3,
          implausible_speed: 0,
        },
        total_samples_received: 30,
        accepted_samples_count: 24,
        rejected_samples_count: 6,
        gap_count: 0,
        max_gap_seconds: 0,
        has_gap_warning: false,
      },
    });

    expect(finalized?.status).toBe('completed');
    expect(finalized?.diagnostics).toBeDefined();
    const parsed = JSON.parse(finalized!.diagnostics!);
    expect(parsed.total_samples_received).toBe(30);
    expect(parsed.rejection_counts.unknown_accuracy).toBe(1);
    expect(parsed.rejection_counts.stationary_drift).toBe(3);
  });

  test('getActiveTrip returns active trip globally regardless of vehicle when called without vehicleId', () => {
    const trip = tripRepo.createActiveTrip({
      vehicle_id: testVehicle.id,
    });

    const globalActive = tripRepo.getActiveTrip();
    expect(globalActive?.id).toBe(trip.id);
    expect(globalActive?.vehicle_id).toBe(testVehicle.id);
  });
});
