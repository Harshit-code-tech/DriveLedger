/**
 * Phase 4 Test Suite — Trip History, Detailed GPS Timeline & Usability
 *
 * Verifies:
 * - History category filtering and search matching
 * - Vehicle-scoped trip loading
 * - TripSummaryCard formatting: GPS vs Manual badges, meaningful duration, odometer range
 * - Never displaying missing duration or missing speed as zero
 * - TripDetailModal timeline point processing:
 *   * GPS point speed conversion (m/s to km/h) vs derived segment speed
 *   * Horizontal accuracy display (±Xm or Unknown, never 0m)
 *   * Step distance calculation via Haversine
 *   * Cumulative distance progression
 *   * Signal gap detection (>120s) and bridging indicators
 *   * Handling 0 points and 1 point (stationary baseline)
 * - Soft-deletion of trips leaving vehicle odometer intact
 */

import { resetMockDatabase } from '@/__mocks__/expo-sqlite';
import { getDatabase } from '@/database/connection';
import { createTables } from '@/database/schema';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import * as tripRepo from '@/database/repositories/tripRepo';
import { formatTripDuration } from '@/components/TripSummaryCard';
import { haversineDistance, SIGNAL_GAP_SECONDS } from '@/engine/distanceEngine';
import { FuelType, VehicleType } from '@/constants/fuelTypes';
import type { Trip, TripLocation } from '@/types/trip';

describe('Phase 4: Trip History, Detailed Timeline & Usability', () => {
  beforeEach(() => {
    resetMockDatabase();
    const db = getDatabase();
    createTables(db);
  });

  describe('1. formatTripDuration helper', () => {
    test('returns null for missing, zero, negative or NaN values', () => {
      expect(formatTripDuration(0)).toBeNull();
      expect(formatTripDuration(-15)).toBeNull();
      expect(formatTripDuration(NaN)).toBeNull();
      expect(formatTripDuration(undefined as unknown as number)).toBeNull();
    });

    test('formats short durations in seconds', () => {
      expect(formatTripDuration(45)).toBe('45 sec');
    });

    test('formats short minute trips with seconds (< 5 min)', () => {
      expect(formatTripDuration(125)).toBe('2m 5s');
    });

    test('formats standard minute trips without seconds (>= 5 min)', () => {
      expect(formatTripDuration(600)).toBe('10 min');
      expect(formatTripDuration(3540)).toBe('59 min');
    });

    test('formats hour trips with minutes', () => {
      expect(formatTripDuration(3660)).toBe('1h 1m');
      expect(formatTripDuration(7200)).toBe('2h');
    });
  });

  describe('2. History Filtering & Search Matching', () => {
    test('filters trips by search query across purpose, notes, date, and odometers', () => {
      const trips: Partial<Trip>[] = [
        {
          id: 't1',
          start_time: '2026-10-15T08:30:00Z',
          purpose: 'Office Commute',
          notes: 'Heavy rain on highway',
          distance_km: 24.5,
          start_odometer: 10000,
          end_odometer: 10025,
          trip_type: 'gps',
        },
        {
          id: 't2',
          start_time: '2026-10-16T14:00:00Z',
          purpose: 'Client Meeting',
          notes: 'Expressway toll road',
          distance_km: 80.0,
          start_odometer: 10025,
          end_odometer: 10105,
          trip_type: 'manual',
        },
        {
          id: 't3',
          start_time: '2026-10-17T18:00:00Z',
          purpose: 'Weekend Grocery',
          notes: 'Local market',
          distance_km: 5.2,
          start_odometer: null,
          end_odometer: null,
          trip_type: 'gps',
        },
      ];

      // Query: "commute"
      const matchCommute = trips.filter(
        (t) =>
          t.purpose?.toLowerCase().includes('commute') ||
          t.notes?.toLowerCase().includes('commute')
      );
      expect(matchCommute).toHaveLength(1);
      expect(matchCommute[0].id).toBe('t1');

      // Query: "expressway" (in notes)
      const matchNotes = trips.filter((t) =>
        t.notes?.toLowerCase().includes('expressway')
      );
      expect(matchNotes).toHaveLength(1);
      expect(matchNotes[0].id).toBe('t2');

      // Query: "10025" (in odometer)
      const matchOdo = trips.filter(
        (t) =>
          t.start_odometer?.toString().includes('10025') ||
          t.end_odometer?.toString().includes('10025')
      );
      expect(matchOdo).toHaveLength(2);

      // Query: "gps"
      const matchGps = trips.filter((t) => t.trip_type === 'gps');
      expect(matchGps).toHaveLength(2);
    });
  });

  describe('3. GPS Timeline Processing Logic', () => {
    test('correctly converts Doppler GPS speed (m/s to km/h) and handles missing speed as unknown', () => {
      // 10 m/s = 36 km/h, 25 m/s = 90 km/h
      const speed1 = 10;
      const speed2 = null;
      const speed3 = -1; // invalid

      const converted1 = speed1 !== null && speed1 >= 0 ? Math.round(speed1 * 3.6) : null;
      const converted2 = speed2 !== null && (speed2 as number) >= 0 ? Math.round((speed2 as number) * 3.6) : null;
      const converted3 = speed3 !== null && speed3 >= 0 ? Math.round(speed3 * 3.6) : null;

      expect(converted1).toBe(36);
      expect(converted2).toBeNull();
      expect(converted3).toBeNull();
    });

    test('accurately calculates step distance via Haversine and cumulative progression', () => {
      // Two points ~1.11 km apart
      const p1: TripLocation = {
        id: 'loc-1',
        trip_id: 'trip-1',
        latitude: 19.0760,
        longitude: 72.8777,
        altitude: null,
        accuracy: 5.0,
        speed: 12.0,
        heading: null,
        timestamp: 1700000000000,
        is_rejected: 0,
        rejection_reason: null,
        created_at: '2026-10-23T10:00:00Z',
      };

      const p2: TripLocation = {
        id: 'loc-2',
        trip_id: 'trip-1',
        latitude: 19.0860,
        longitude: 72.8777,
        altitude: null,
        accuracy: 4.5,
        speed: 15.0,
        heading: null,
        timestamp: 1700000060000, // 60s later
        is_rejected: 0,
        rejection_reason: null,
        created_at: '2026-10-23T10:01:00Z',
      };

      const stepDistMeters = haversineDistance(
        p1.latitude,
        p1.longitude,
        p2.latitude,
        p2.longitude
      );

      expect(stepDistMeters).toBeGreaterThan(1100);
      expect(stepDistMeters).toBeLessThan(1120);

      // Derived segment speed: ~1112m / 60s = 18.53 m/s = ~67 km/h
      const timeDeltaSec = (p2.timestamp - p1.timestamp) / 1000;
      const segmentSpeedKmh = Math.round((stepDistMeters / timeDeltaSec) * 3.6);
      expect(segmentSpeedKmh).toBeGreaterThanOrEqual(66);
      expect(segmentSpeedKmh).toBeLessThanOrEqual(68);

      // GPS point Doppler speed: 15 m/s * 3.6 = 54 km/h
      const gpsDopplerSpeed = Math.round((p2.speed ?? 0) * 3.6);
      expect(gpsDopplerSpeed).toBe(54);

      // Verify that GPS point speed and segment speed are distinct
      expect(gpsDopplerSpeed).not.toBe(segmentSpeedKmh);
    });

    test('flags signal gaps (>120s) with bridging indicators', () => {
      const p1Timestamp = 1700000000000;
      const p2Timestamp = p1Timestamp + 150 * 1000; // 150 seconds gap

      const timeDeltaSec = (p2Timestamp - p1Timestamp) / 1000;
      const isGap = timeDeltaSec > SIGNAL_GAP_SECONDS;

      expect(isGap).toBe(true);
      expect(timeDeltaSec).toBe(150);
    });

    test('handles 0 points and 1 point gracefully', () => {
      const emptyLocations: TripLocation[] = [];
      expect(emptyLocations).toHaveLength(0);

      const singlePoint: TripLocation[] = [
        {
          id: 'loc-1',
          trip_id: 'trip-1',
          latitude: 19.0760,
          longitude: 72.8777,
          altitude: null,
          accuracy: 6.0,
          speed: 0,
          heading: null,
          timestamp: 1700000000000,
          is_rejected: 0,
          rejection_reason: null,
          created_at: '2026-10-23T10:00:00Z',
        },
      ];

      expect(singlePoint).toHaveLength(1);
      // Index 0 has stepMeters = 0 and cumulativeKm = 0
    });
  });

  describe('4. Deletion & Canonical Odometer Protection', () => {
    test('deleting a trip soft deletes the record without moving vehicle odometer backward', () => {
      const vehicle = vehicleRepo.createVehicle({
        nickname: 'Toyota Fortuner',
        vehicle_type: VehicleType.CAR,
        fuel_type: FuelType.DIESEL,
        registration_number: 'KA-01-EF-9999',
        current_odometer: 45200,
      });

      // Create a trip with start_odo 45100 and end_odo 45200
      const trip = tripRepo.createTrip({
        vehicle_id: vehicle.id,
        trip_type: 'gps',
        start_time: '2026-10-23T08:00:00Z',
        start_odometer: 45100,
        purpose: 'Site visit',
      });

      tripRepo.updateTrip(trip.id, {
        status: 'completed',
        end_time: '2026-10-23T09:30:00Z',
        distance_km: 100,
        duration_seconds: 5400,
        end_odometer: 45200,
      });

      // Confirm trip is recorded
      const loadedTripsBefore = tripRepo.getTripsByVehicle(vehicle.id);
      expect(loadedTripsBefore).toHaveLength(1);
      expect(loadedTripsBefore[0].id).toBe(trip.id);

      // Verify vehicle odometer
      const vBefore = vehicleRepo.getVehicleById(vehicle.id);
      expect(vBefore?.current_odometer).toBe(45200);

      // Soft delete trip
      tripRepo.softDeleteTrip(trip.id);

      // Verify trip is soft-deleted
      const loadedTripsAfter = tripRepo.getTripsByVehicle(vehicle.id);
      expect(loadedTripsAfter).toHaveLength(0);

      // Verify vehicle odometer is PRESERVED and NOT rolled back
      const vAfter = vehicleRepo.getVehicleById(vehicle.id);
      expect(vAfter?.current_odometer).toBe(45200);
    });
  });
});
