/**
 * Tests for LocationPermissionService
 *
 * Validates permission flows across Android 8.0+ versions (API 26-36).
 */

import * as Location from 'expo-location';
import {
  checkLocationPermissionStatus,
  requestTripTrackingPermissions,
} from '../locationPermissionService';

describe('LocationPermissionService (Android 8+ Support)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    });
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    });
    (Location.isBackgroundLocationAvailableAsync as jest.Mock).mockResolvedValue(true);
    (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    });
    (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
      granted: true,
      canAskAgain: true,
      expires: 'never',
    });
  });

  describe('checkLocationPermissionStatus', () => {
    test('returns false for servicesEnabled when hardware GPS is disabled', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValueOnce(false);

      const status = await checkLocationPermissionStatus();
      expect(status.servicesEnabled).toBe(false);
    });

    test('returns foregroundGranted true and queries background when foreground is granted', async () => {
      const status = await checkLocationPermissionStatus();
      expect(status.servicesEnabled).toBe(true);
      expect(status.foregroundGranted).toBe(true);
      expect(status.backgroundGranted).toBe(true);
      expect(status.canAskBackground).toBe(true);
    });

    test('does not check background if foreground is not granted', async () => {
      (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
        granted: false,
      });

      const status = await checkLocationPermissionStatus();
      expect(status.foregroundGranted).toBe(false);
      expect(status.backgroundGranted).toBe(false);
      expect(Location.getBackgroundPermissionsAsync).not.toHaveBeenCalled();
    });
  });

  describe('requestTripTrackingPermissions', () => {
    test('fails immediately if device hardware location services are disabled', async () => {
      (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValueOnce(false);

      const result = await requestTripTrackingPermissions();
      expect(result.success).toBe(false);
      expect(result.backgroundGranted).toBe(false);
      expect(result.error).toContain('services are disabled');
    });

    test('fails if foreground location permission is denied by user', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
        granted: false,
      });

      const result = await requestTripTrackingPermissions();
      expect(result.success).toBe(false);
      expect(result.backgroundGranted).toBe(false);
      expect(result.error).toContain('permission was denied');
    });

    test('succeeds with backgroundGranted: true when both foreground and background are granted', async () => {
      const result = await requestTripTrackingPermissions();
      expect(result.success).toBe(true);
      expect(result.backgroundGranted).toBe(true);
      expect(result.warning).toBeUndefined();
    });

    test('gracefully degrades with warning when background tracking is unavailable on device', async () => {
      (Location.isBackgroundLocationAvailableAsync as jest.Mock).mockResolvedValueOnce(false);

      const result = await requestTripTrackingPermissions();
      expect(result.success).toBe(true);
      expect(result.backgroundGranted).toBe(false);
      expect(result.warning).toContain('Background location tracking is not available');
    });

    test('gracefully degrades with warning when background permission is denied (Android 11+ two-step flow)', async () => {
      (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
        granted: false,
        canAskAgain: true,
      });
      (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
        granted: false,
      });

      const result = await requestTripTrackingPermissions();
      expect(result.success).toBe(true);
      expect(result.backgroundGranted).toBe(false);
      expect(result.warning).toContain('Background location permission ("Allow all the time") was not granted');
    });

    test('warns when background permission is restricted in system settings', async () => {
      (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'denied',
        granted: false,
        canAskAgain: false,
      });

      const result = await requestTripTrackingPermissions();
      expect(result.success).toBe(true);
      expect(result.backgroundGranted).toBe(false);
      expect(result.warning).toContain('Background location is restricted in system settings');
    });
  });
});
