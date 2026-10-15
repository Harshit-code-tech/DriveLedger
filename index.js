import { Platform } from 'react-native';
import 'expo-router/entry';

// Register Android Home Screen Widget task handler
if (Platform.OS === 'android') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { registerWidgetTaskHandler } = require('react-native-android-widget');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { widgetTaskHandler } = require('./src/widgets/widgetTaskHandler');

    registerWidgetTaskHandler(widgetTaskHandler);
  } catch (error) {
    console.warn('Notice: Widget task handler not registered (development/preview mode):', error);
  }
}
