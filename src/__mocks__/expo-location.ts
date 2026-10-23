/**
 * Mock for expo-location in Jest unit tests
 */

export const Accuracy = {
  Lowest: 1,
  Low: 2,
  Balanced: 3,
  High: 4,
  Highest: 5,
  BestForNavigation: 6,
};

export const PermissionStatus = {
  UNDETERMINED: 'undetermined',
  GRANTED: 'granted',
  DENIED: 'denied',
};

let startedTasks = new Set<string>();

export const requestForegroundPermissionsAsync = jest.fn(async () => ({
  status: 'granted',
  granted: true,
  canAskAgain: true,
  expires: 'never',
}));

export const getForegroundPermissionsAsync = jest.fn(async () => ({
  status: 'granted',
  granted: true,
  canAskAgain: true,
  expires: 'never',
}));

export const requestBackgroundPermissionsAsync = jest.fn(async () => ({
  status: 'granted',
  granted: true,
  canAskAgain: true,
  expires: 'never',
}));

export const getBackgroundPermissionsAsync = jest.fn(async () => ({
  status: 'granted',
  granted: true,
  canAskAgain: true,
  expires: 'never',
}));

export const hasServicesEnabledAsync = jest.fn(async () => true);

export const isBackgroundLocationAvailableAsync = jest.fn(async () => true);

export const startLocationUpdatesAsync = jest.fn(async (taskName: string, _options?: any) => {
  startedTasks.add(taskName);
});

export const stopLocationUpdatesAsync = jest.fn(async (taskName: string) => {
  startedTasks.delete(taskName);
});

export const hasStartedLocationUpdatesAsync = jest.fn(async (taskName: string) => {
  return startedTasks.has(taskName);
});

export const watchPositionAsync = jest.fn(async (_options, callback) => {
  return {
    remove: jest.fn(),
  };
});

export const _resetLocationMockState = () => {
  startedTasks.clear();
};
