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
import '@/tasks/backgroundLocationTask';
import AnimatedSplash from '@/components/AnimatedSplash';
import { getDatabase } from '@/database/connection';
import {
  reconcileNotifications,
  refreshReminders,
  scheduleReminderNotifications,
  setupNotificationChannel,
} from '@/services/notificationService';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { useVehicleStore } from '@/stores/vehicleStore';
import { syncWidgetState } from '@/widgets/widgetDataService';
import { Stack, useGlobalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
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
  const router = useRouter();
  const colorScheme = useColorScheme();
  const loadVehicles = useVehicleStore((s) => s.loadVehicles);
  // Only subscribe to a serialized key of vehicle IDs, so loadVehicles() does NOT re-render RootLayout on tab focus
  const vehicleIdsKey = useVehicleStore((s) => s.vehicles.map((v) => v.id).join(','));
  const loadPreferences = usePreferencesStore((s) => s.loadPreferences);
  const globalParams = useGlobalSearchParams<{ vehicleId?: string }>();
  const [appIsReady, setAppIsReady] = useState(false);
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);
  const nativeSplashHidden = useRef(false);

  // Deep-link vehicle selection (e.g. from Widget tap)
  // Changes currently active vehicle in session WITHOUT altering defaultVehicleId preference
  useEffect(() => {
    if (globalParams.vehicleId) {
      useVehicleStore.getState().selectVehicle(globalParams.vehicleId);
    }
  }, [globalParams.vehicleId]);

  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url) return;
      try {
        const parsed = Linking.parse(url);
        const vid = parsed.queryParams?.vehicleId;
        if (typeof vid === 'string' && vid) {
          useVehicleStore.getState().selectVehicle(vid);
        }
        const action = parsed.queryParams?.action;
        if (typeof action === 'string' && action) {
          try {
            router.replace({
              pathname: '/(tabs)',
              params: { action, vehicleId: typeof vid === 'string' ? vid : undefined },
            });
          } catch (navErr) {
            console.debug('Deep link navigation deferred:', navErr);
          }
        }
      } catch (err) {
        console.debug('Failed to parse deep link URL:', err);
      }
    };

    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', (event) => handleUrl(event.url));
    return () => sub.remove();
  }, [router]);

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

        // Initial sync of Android Home Screen Widget
        syncWidgetState().catch((err) => console.debug('Initial widget sync skipped:', err));

        // Set up notification channel (Android) and reconcile notification schedules
        await setupNotificationChannel();
        await reconcileNotifications(undefined, { force: true });
      } catch (e) {
        console.warn('App initialization warning:', e);
      } finally {
        setAppIsReady(true);
        // await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  const isInitialMount = useRef(true);
  // Schedule expiry + service reminders & sync widget whenever vehicles list actually changes post-startup
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (vehicleIdsKey) {
      refreshReminders();
      syncWidgetState().catch((err) => console.debug('Widget sync on vehicles change skipped:', err));
    }
  }, [vehicleIdsKey]);

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
