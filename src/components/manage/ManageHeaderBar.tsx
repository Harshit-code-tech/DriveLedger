/**
 * ManageHeaderBar
 *
 * Section 5A: Header
 * - Title: Manage
 * - Short supporting text: Your vehicles and app controls
 * - Appropriate management/settings icon
 * - Compact, focused header bar
 * - Contextual Back button when navigated into a sub-section
 */

import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import type { ManagePalette } from './manageTheme';

export type ManageSection =
  | 'overview'
  | 'vehicles'
  | 'preferences'
  | 'trip_tracking'
  | 'gps_tracking'
  | 'notifications'
  | 'gps_notifications'
  | 'data_backup'
  | 'app_info';

interface ManageHeaderBarProps {
  activeSection: ManageSection;
  onBack: () => void;
  colors: ManagePalette;
}

const SECTION_TITLES: Record<ManageSection, { title: string; subtitle: string }> = {
  overview: {
    title: 'Manage',
    subtitle: 'Your vehicles and app controls',
  },
  vehicles: {
    title: 'Vehicles',
    subtitle: 'Manage your registered vehicles',
  },
  preferences: {
    title: 'Preferences',
    subtitle: 'Units, appearance and app behaviour',
  },
  trip_tracking: {
    title: 'Trip Tracking',
    subtitle: 'Route telemetry, location access and recording profiles',
  },
  gps_tracking: {
    title: 'Trip Tracking',
    subtitle: 'Route telemetry, location access and recording profiles',
  },
  notifications: {
    title: 'Reminders & Alerts',
    subtitle: 'Document expiry, service, and maintenance alerts',
  },
  gps_notifications: {
    title: 'GPS & Notifications',
    subtitle: 'Trip recording and notification settings',
  },
  data_backup: {
    title: 'Data & Backup',
    subtitle: 'Backup, restore and export your data',
  },
  app_info: {
    title: 'App Information',
    subtitle: 'Version, updates and onboarding',
  },
};

export const ManageHeaderBar: React.FC<ManageHeaderBarProps> = memo(({
  activeSection,
  onBack,
  colors,
}) => {
  const insets = useSafeAreaInsets();
  const isOverview = activeSection === 'overview';
  const { title, subtitle } = SECTION_TITLES[activeSection];

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 12),
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.contentRow}>
        {!isOverview ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel="Back to Manage Overview"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path
                d="M19 12H5M5 12L12 19M5 12L12 5"
                stroke={colors.accent}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>
        ) : null}

        <View style={styles.titleColumn}>
          <Text
            style={[styles.title, { color: colors.text }]}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {title}
          </Text>
          <Text
            style={[styles.subtitle, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
  },
  backButton: {
    paddingVertical: 6,
    paddingRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
});
