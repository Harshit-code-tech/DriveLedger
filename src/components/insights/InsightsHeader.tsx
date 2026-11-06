/**
 * InsightsHeader Component
 *
 * Section 3 & 8: Header bar with Vehicle Title, Export action, and Share action
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Spacing, Typography, Sizing } from '@/constants/theme';
import type { InsightsPalette } from './insightsTheme';

interface InsightsHeaderProps {
  vehicleName: string;
  colors: InsightsPalette;
  onExport: () => void;
  onShare: () => void;
  subtitle?: string;
}

export const InsightsHeader: React.FC<InsightsHeaderProps> = ({
  vehicleName,
  colors,
  onExport,
  onShare,
  subtitle = 'Telemetry & Analytics',
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.titleCol}>
        <View style={styles.badgeRow}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>VEHICLE INSIGHTS</Text>
        </View>
        <Text style={[Typography.h2, { color: colors.text, fontWeight: '800' }]} numberOfLines={1}>
          {vehicleName}
        </Text>
        <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 1 }]}>
          {subtitle}
        </Text>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          onPress={onExport}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Export vehicle reports"
          style={[
            styles.actionButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.actionIcon]}>📄</Text>
          <Text style={[styles.actionLabel, { color: colors.text }]}>Export</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onShare}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Share summary"
          style={[
            styles.actionButton,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.actionIcon]}>📤</Text>
          <Text style={[styles.actionLabel, { color: colors.text }]}>Share</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  titleCol: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    minHeight: 38,
  },
  actionIcon: {
    fontSize: 13,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
});

