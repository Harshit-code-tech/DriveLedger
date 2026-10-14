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

import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { getDatabase } from '@/database/connection';
import { useVehicleStore } from '@/stores/vehicleStore';
import { usePreferencesStore } from '@/stores/preferencesStore';
import {
  setupNotificationChannel,
  scheduleReminderNotifications,
} from '@/services/notificationService';

// Keep the splash screen visible while assets & initial state load
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const loadVehicles      = useVehicleStore((s) => s.loadVehicles);
  const vehicles           = useVehicleStore((s) => s.vehicles);
  const loadPreferences    = usePreferencesStore((s) => s.loadPreferences);
  const [appIsReady, setAppIsReady] = useState(false);

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
        await SplashScreen.hideAsync();
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
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="onboarding"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="add-fuel"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="add-service"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="add-expense"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="add-document"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="add-vehicle"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="edit-vehicle"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="checklist"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
      </Stack>
    </>
  );
}
