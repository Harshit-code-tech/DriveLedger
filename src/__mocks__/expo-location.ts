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

export const requestForegroundPermissionsAsync = jest.fn(async () => ({
  status: 'granted',
  granted: true,
  canAskAgain: true,
  expires: 'never',
}));

export const hasServicesEnabledAsync = jest.fn(async () => true);

export const watchPositionAsync = jest.fn(async (_options, callback) => {
  return {
    remove: jest.fn(),
  };
});
