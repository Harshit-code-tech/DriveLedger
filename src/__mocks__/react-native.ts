export const Platform = {
  OS: 'android',
  select: (obj: any) => obj.android ?? obj.default,
};

export const Alert = {
  alert: jest.fn(),
};

export const StyleSheet = {
  create: (styles: any) => styles,
  flatten: (styles: any) => styles,
};

export const View = 'View';
export const Text = 'Text';
export const TouchableOpacity = 'TouchableOpacity';
export const FlatList = 'FlatList';
export const Modal = 'Modal';
export const ActivityIndicator = 'ActivityIndicator';
export const TextInput = 'TextInput';

export default {
  Platform,
  Alert,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
  TextInput,
};

