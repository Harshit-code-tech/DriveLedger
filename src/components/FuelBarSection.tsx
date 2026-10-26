/**
 * FuelBarSection
 *
 * A 5-segment visual fuel level bar used on the Home dashboard.
 * Extracted from app/(tabs)/index.tsx to keep the screen file focused
 * on orchestration rather than component implementation.
 *
 * Shows either:
 *  - A filled bar with percentage, range estimate, and optional tank description (when `level` is known)
 *  - A tip/info text line (when only `tip` is provided)
 *  - null (when neither is available)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Typography, Spacing } from '@/constants/theme';
import type { FuelLevelResult } from '@/utils/statsHelpers';
import type { useThemeColors } from '@/hooks/useThemeColors';

export interface FuelBarSectionProps {
  title: string;
  icon: React.ReactNode;
  level: FuelLevelResult | null;
  tip?: string | null;
  tankDescription?: string;
  colors: ReturnType<typeof useThemeColors>;
}

export function FuelBarSection({
  title,
  icon,
  level,
  tip,
  tankDescription,
  colors,
}: FuelBarSectionProps) {
  if (level) {
    return (
      <View>
        <View style={styles.fuelBarHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            {icon}
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{title}</Text>
          </View>
          <Text style={[Typography.bodySmall, { color: level.color, fontWeight: '700' }]}>
            {level.percent.toFixed(0)}%
          </Text>
        </View>

        {/* 5-segment bar */}
        <View style={styles.fuelBarsRow}>
          {[1, 2, 3, 4, 5].map((bar) => (
            <View
              key={bar}
              style={[
                styles.fuelBarSegment,
                { backgroundColor: bar <= level.bars ? level.color : colors.border },
              ]}
            />
          ))}
        </View>

        {/* Labels row */}
        <View style={styles.fuelBarLabels}>
          <Text style={[Typography.caption, { color: colors.textTertiary }]}>Empty</Text>
          <Text style={[Typography.caption, { color: level.color, fontWeight: '600' }]}>
            {level.label}{level.bars <= 1 ? ' ⚠️' : level.bars === 5 ? ' ✅' : ''}
          </Text>
          <Text style={[Typography.caption, { color: colors.textTertiary }]}>Full</Text>
        </View>

        <Text style={[Typography.bodySmall, { color: colors.text, fontWeight: '600', marginTop: Spacing.sm }]}>
          ≈ {level.remainingLitres.toFixed(1)} {level.unit} left · ~{level.kmRemaining.toLocaleString()} km range
        </Text>

        {tankDescription ? (
          <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
            {tankDescription}
          </Text>
        ) : null}
      </View>
    );
  }

  if (tip) {
    return (
      <View>
        <View style={styles.fuelBarHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            {icon}
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{title}</Text>
          </View>
        </View>
        <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>{tip}</Text>
        {tankDescription ? (
          <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
            {tankDescription}
          </Text>
        ) : null}
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  fuelBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  fuelBarsRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: Spacing.xs,
  },
  fuelBarSegment: {
    flex: 1,
    height: 20,
    borderRadius: 4,
  },
  fuelBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
});
