/**
 * Tab Layout
 *
 * Bottom tab navigation matching the charter's navigation structure:
 *
 * 🏠 Home (Vehicle Dashboard)
 * 📊 History
 * 📄 Documents
 * 📈 Stats
 * ⚙️ Settings
 *
 * Design: Bottom-anchored tabs for one-handed operation.
 * Large touch targets (48dp+ per tab).
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, View, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as QuickActions from 'expo-quick-actions';
import { useQuickActionRouting } from 'expo-quick-actions/router';
import { Sizing } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';

// Simple emoji-based tab icons (we'll upgrade to proper icons later)
function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View style={styles.tabIconContainer}>
      <Text style={[styles.tabEmoji, { opacity: focused ? 1 : 0.5 }]}>{emoji}</Text>
    </View>
  );
}

export default function TabLayout() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  // Handles one-tap routing when launched from an Android App Shortcut / iOS Quick Action
  useQuickActionRouting();

  useEffect(() => {
    if (Platform.OS !== 'web') {
      QuickActions.setItems([
        {
          id: 'add_fuel',
          title: 'Log Fuel',
          subtitle: 'Quick refill entry at pump',
          icon: Platform.OS === 'ios' ? 'symbol:fuelpump.fill' : 'shortcut_fuel',
          params: { href: '/add-fuel' },
        },
        {
          id: 'add_expense',
          title: 'Log Expense',
          subtitle: 'Tolls, parking & fastag',
          icon: Platform.OS === 'ios' ? 'symbol:creditcard.fill' : 'shortcut_expense',
          params: { href: '/add-expense' },
        },
        {
          id: 'add_service',
          title: 'Log Service',
          subtitle: 'Maintenance & repairs',
          icon: Platform.OS === 'ios' ? 'symbol:wrench.and.screwdriver.fill' : 'shortcut_service',
          params: { href: '/add-service' },
        },
        {
          id: 'trip_checklist',
          title: 'Trip Checklist',
          subtitle: 'Highway readiness inspection',
          icon: Platform.OS === 'ios' ? 'symbol:checklist' : 'shortcut_checklist',
          params: { href: '/checklist' },
        },
      ]).catch(() => {
        // Safe ignore on devices without quick actions support
      });
    }
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
          color: colors.text,
        },
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.tabIconSelected,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏠" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🕒" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="documents"
        options={{
          title: 'Documents',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🧾" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🧮" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="⚙️" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabIconContainer: {
    width: Sizing.touchTarget,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabEmoji: {
    fontSize: 20,
  },
});
