/**
 * Trip Summary Card
 *
 * Reusable summary card for logged trips (both GPS and manual).
 * Used in the main History tab and the vehicle-scoped Trip History modal.
 *
 * FEATURES:
 * - Clear GPS vs Manual distinct badges
 * - Accurate distance display with confidence indicators
 * - Duration formatted meaningfully (never presenting missing duration as 0)
 * - Start / End odometer readings when available
 * - Purpose tags and notes quotes
 * - Signal gap and interruption warning banners
 * - High-contrast, clean layout matching app theme
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Sizing, Spacing, Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { Trip } from '@/types/trip';
import { formatDisplayDateLong } from '@/utils/date';

interface TripSummaryCardProps {
  trip: Trip;
  vehicleName?: string;
  onPress: (trip: Trip) => void;
  onDelete?: (trip: Trip) => void;
}

export function formatTripDuration(seconds: number): string | null {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds <= 0) {
    return null;
  }
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  }
  if (mins > 0) {
    return secs > 0 && mins < 5 ? `${mins}m ${secs}s` : `${mins} min`;
  }
  return `${secs} sec`;
}

export function TripSummaryCard({
  trip,
  vehicleName,
  onPress,
  onDelete,
}: TripSummaryCardProps) {
  const colors = useThemeColors();
  const isGps = trip.trip_type === 'gps';
  const durationText = formatTripDuration(trip.duration_seconds);

  // Parse time of day from ISO string if available
  let timeStr = '';
  if (trip.start_time.includes('T')) {
    const rawTime = trip.start_time.split('T')[1];
    if (rawTime) {
      timeStr = rawTime.substring(0, 5); // HH:MM
    }
  }

  const dateStr = formatDisplayDateLong(trip.start_time.split('T')[0]);

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
      activeOpacity={0.7}
      onPress={() => onPress(trip)}
    >
      {/* ── Top Header Row ── */}
      <View style={styles.topRow}>
        <View style={styles.dateBlock}>
          <Text style={[Typography.body, { color: colors.text, fontWeight: '700' }]}>
            {dateStr} {timeStr ? `· ${timeStr}` : ''}
          </Text>
          {vehicleName && (
            <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: 1 }]}>
              {vehicleName}
            </Text>
          )}
        </View>

        {/* Badges */}
        <View style={styles.badgeRow}>
          <View
            style={[
              styles.typeBadge,
              {
                backgroundColor: isGps ? colors.primaryLight : colors.borderLight,
              },
            ]}
          >
            <Text
              style={[
                Typography.caption,
                {
                  color: isGps ? colors.primary : colors.textSecondary,
                  fontWeight: '700',
                  fontSize: 11,
                },
              ]}
            >
              {isGps ? '🛰️ GPS Trip' : '✍️ Manual'}
            </Text>
          </View>

          {trip.status === 'interrupted' && (
            <View style={[styles.typeBadge, { backgroundColor: colors.warningLight }]}>
              <Text style={[Typography.caption, { color: colors.warning, fontWeight: '700', fontSize: 11 }]}>
                Interrupted
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Quality / Gap Alert Banner ── */}
      {trip.quality_warning && (
        <View style={[styles.warningStrip, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
          <Text style={[Typography.caption, { color: colors.warning, fontWeight: '600', fontSize: 11 }]}>
            ⚠️ {trip.quality_warning}
          </Text>
        </View>
      )}

      {/* ── Metric Display ── */}
      <View style={styles.metricsRow}>
        <View>
          <Text style={[styles.distanceText, { color: colors.primary }]}>
            {trip.distance_km.toFixed(2)}
            <Text style={[Typography.bodySmall, { color: colors.textSecondary, fontWeight: '500' }]}> km</Text>
          </Text>
          <Text style={[Typography.caption, { color: colors.textTertiary, fontSize: 10 }]}>
            {isGps ? 'GPS ESTIMATE' : 'ODOMETER DISTANCE'}
          </Text>
        </View>

        {durationText && (
          <View style={styles.metricItemRight}>
            <Text style={[Typography.body, { color: colors.text, fontWeight: '700' }]}>
              ⏱️ {durationText}
            </Text>
            <Text style={[Typography.caption, { color: colors.textTertiary, fontSize: 10 }]}>
              DURATION
            </Text>
          </View>
        )}
      </View>

      {/* ── Odometer Range ── */}
      {trip.start_odometer !== null && trip.end_odometer !== null && (
        <View style={[styles.odometerRow, { borderTopColor: colors.borderLight }]}>
          <Text style={[Typography.caption, { color: colors.textSecondary }]}>
            Odometer:{' '}
            <Text style={{ color: colors.text, fontWeight: '600' }}>
              {trip.start_odometer.toLocaleString()}
            </Text>
            {' → '}
            <Text style={{ color: colors.text, fontWeight: '600' }}>
              {trip.end_odometer.toLocaleString()} km
            </Text>
          </Text>
        </View>
      )}

      {/* ── Purpose and Notes ── */}
      {(trip.purpose || trip.notes) && (
        <View style={styles.footerRow}>
          {trip.purpose && (
            <View style={[styles.purposeChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[Typography.caption, { color: colors.textSecondary, fontSize: 11 }]}>
                {trip.purpose}
              </Text>
            </View>
          )}
          {trip.notes && (
            <Text
              style={[Typography.caption, { color: colors.textTertiary, fontStyle: 'italic', flex: 1 }]}
              numberOfLines={1}
            >
              "{trip.notes}"
            </Text>
          )}
        </View>
      )}

      {/* ── Footer / Delete Action ── */}
      <View style={styles.actionFooter}>
        <Text style={[Typography.caption, { color: colors.primary, fontWeight: '600' }]}>
          {isGps ? 'Inspect GPS Timeline & Route →' : 'View Trip Details →'}
        </Text>

        {onDelete && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onDelete(trip);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[Typography.caption, { color: colors.danger, fontWeight: '600' }]}>
              🗑️ Delete
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.md,
    borderRadius: Sizing.radiusLg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    ...Sizing.cardShadow,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dateBlock: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Sizing.radiusFull,
  },
  warningStrip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    marginTop: Spacing.xs,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: Spacing.sm,
  },
  distanceText: {
    fontSize: 24,
    fontWeight: '800',
  },
  metricItemRight: {
    alignItems: 'flex-end',
  },
  odometerRow: {
    borderTopWidth: 1,
    paddingTop: 6,
    marginTop: Spacing.xs,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 6,
  },
  purposeChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
  },
  actionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: 6,
  },
});
