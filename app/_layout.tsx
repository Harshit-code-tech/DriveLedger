/**
 * Root Layout
 *
 * The top-level layout for the entire app.
 * Sets up:
 * - Status bar styling
 * - Database initialization
 * - Vehicle data loading
 * - The Stack navigator that wraps the tab layout
 */
import AnimatedSplash from '@/components/AnimatedSplash';
import { getDatabase } from '@/database/connection';
import {
  scheduleReminderNotifications,
  setupNotificationChannel,
} from '@/services/notificationService';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { useVehicleStore } from '@/stores/vehicleStore';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import {
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';
import { useColorScheme, View } from 'react-native';

// Keep the splash screen visible while assets & initial state load
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const loadVehicles = useVehicleStore((s) => s.loadVehicles);
  const vehicles = useVehicleStore((s) => s.vehicles);
  const loadPreferences = usePreferencesStore((s) => s.loadPreferences);
  const [appIsReady, setAppIsReady] = useState(false);
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);
  const nativeSplashHidden = useRef(false);

  const handleRootLayout = useCallback(() => {
    if (nativeSplashHidden.current) return;

    nativeSplashHidden.current = true;
    void SplashScreen.hideAsync();
  }, []);

  const handleSplashFinish = useCallback(() => {
    setShowAnimatedSplash(false);
  }, []);

  useEffect(() => {
    async function prepare() {
      try {
        // Initialize database (creates tables if they don't exist)
        getDatabase();

        // Load user preferences (currency, units, etc.) from AsyncStorage
        await loadPreferences();

        // Load vehicles into state
        loadVehicles();

        // Set up notification channel (Android)
        await setupNotificationChannel();
      } catch (e) {
        console.warn('App initialization warning:', e);
      } finally {
        setAppIsReady(true);
        // await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  // Schedule expiry + service reminders whenever vehicles list changes
  useEffect(() => {
    if (vehicles.length > 0) {
      const vehicleIds = vehicles.map((v) => v.id);
      scheduleReminderNotifications(vehicleIds);
    }
  }, [vehicles]);

  return (
    <View style={{ flex: 1 }} onLayout={handleRootLayout}>
      <StatusBar
        style={
          showAnimatedSplash
            ? 'light'
            : colorScheme === 'dark'
              ? 'light'
              : 'dark'
        }
      />

      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />

        <Stack.Screen
          name="onboarding"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />

        <Stack.Screen
          name="add-fuel"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />

        <Stack.Screen
          name="add-service"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />

        <Stack.Screen
          name="add-expense"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />

        <Stack.Screen
          name="add-document"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />

        <Stack.Screen
          name="add-vehicle"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />

        <Stack.Screen
          name="edit-vehicle"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />

        <Stack.Screen
          name="checklist"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>

      {showAnimatedSplash && (
        <AnimatedSplash
          ready={appIsReady}
          onFinish={handleSplashFinish}
        />
      )}
    </View>
  );
}
