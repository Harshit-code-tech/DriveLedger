export const Platform = {
  OS: 'android',
  select: (obj: any) => obj.android ?? obj.default,
};

export const Alert = {
  alert: jest.fn(),
};

export default {
  Platform,
  Alert,
};
