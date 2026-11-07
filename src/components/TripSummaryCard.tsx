/**
 * Trip Summary Card
 *
 * Reusable summary card for logged trips (both GPS telemetry and manual odometer).
 * Used in the main Records tab and the vehicle-scoped Trip History modal.
 *
 * DESIGN:
 * - Original Blue — Refined technical automotive aesthetic
 * - Clear GPS Telemetry vs Manual Odometer badges
 * - Accurate distance display in bold tabular numerals
 * - Meaningful duration formatting (never presents missing duration as 0)
 * - Start / End odometer readings with net delta
 * - Purpose tags and notes
 * - Signal gap and interruption warning banners
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Sizing, Spacing, Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { Trip } from '@/types/trip';
import { formatDisplayDateLong } from '@/utils/date';

export interface TripSummaryCardProps {
  trip: Trip;
  vehicleName?: string;
  onPress: (trip: Trip) => void;
  onDelete?: (trip: Trip) => void;
}

/**
 * Format duration in seconds into human-readable automotive time.
 * Preserves strict rules tested by Phase 4 test suite.
 */
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

  // Derived average speed if GPS trip has valid duration & distance
  const avgSpeedKmh =
    isGps && trip.duration_seconds && trip.duration_seconds > 30 && trip.distance_km > 0.1
      ? Math.round((trip.distance_km / (trip.duration_seconds / 3600)))
      : null;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
      activeOpacity={0.75}
      onPress={() => onPress(trip)}
    >
      {/* ── Top Header Row ── */}
      <View style={styles.topRow}>
        <View style={styles.dateBlock}>
          <Text style={[styles.dateText, { color: colors.text }]}>
            {dateStr} {timeStr ? `· ${timeStr}` : ''}
          </Text>
          {vehicleName ? (
            <Text style={[styles.vehicleText, { color: colors.textSecondary }]}>
              {vehicleName}
            </Text>
          ) : null}
        </View>

        {/* Badges */}
        <View style={styles.badgeRow}>
          <View
            style={[
              styles.typeBadge,
              {
                backgroundColor: isGps ? colors.primaryLight : colors.surfaceSecondary,
                borderColor: isGps ? colors.primary + '33' : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.typeBadgeText,
                { color: isGps ? colors.primary : colors.textSecondary },
              ]}
            >
              {isGps ? '🛰️ GPS TELEMETRY' : '✍️ MANUAL ODO'}
            </Text>
          </View>

          {trip.status === 'interrupted' && (
            <View
              style={[
                styles.typeBadge,
                {
                  backgroundColor: colors.statusWarningBg,
                  borderColor: colors.statusWarning + '55',
                },
              ]}
            >
              <Text style={[styles.typeBadgeText, { color: colors.statusWarning }]}>
                Interrupted ⚠️
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Quality / Signal Gap Warning Banner ── */}
      {trip.quality_warning ? (
        <View
          style={[
            styles.warningStrip,
            {
              backgroundColor: colors.statusWarningBg,
              borderColor: colors.statusWarning + '44',
            },
          ]}
        >
          <Text style={[styles.warningText, { color: colors.statusWarning }]}>
            ⚠️ {trip.quality_warning}
          </Text>
        </View>
      ) : null}

      {/* ── Metric Display ── */}
      <View style={styles.metricsRow}>
        <View>
          <Text style={[styles.distanceText, { color: colors.primaryDark }]}>
            {trip.distance_km.toFixed(2)}
            <Text style={[styles.distanceUnit, { color: colors.textSecondary }]}> km</Text>
          </Text>
          <Text style={[styles.metricSubtitle, { color: colors.textTertiary }]}>
            {isGps ? 'GPS ESTIMATE' : 'RECORDED DISTANCE'}
          </Text>
        </View>

        <View style={styles.rightMetricsWrap}>
          {durationText ? (
            <View style={[styles.metricPill, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.metricPillText, { color: colors.text }]}>
                ⏱️ {durationText}
              </Text>
            </View>
          ) : null}

          {avgSpeedKmh ? (
            <View style={[styles.metricPill, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.metricPillText, { color: colors.accent }]}>
                ⚡ {avgSpeedKmh} km/h
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* ── Odometer Range ── */}
      {trip.start_odometer !== null && trip.end_odometer !== null && (
        <View style={[styles.odometerRow, { borderTopColor: colors.borderLight }]}>
          <Text style={[styles.odometerLabel, { color: colors.textSecondary }]}>
            Odometer:{' '}
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {trip.start_odometer.toLocaleString('en-IN')}
            </Text>
            {' ➔ '}
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {trip.end_odometer.toLocaleString('en-IN')} km
            </Text>
            {trip.end_odometer > trip.start_odometer ? (
              <Text style={{ color: colors.statusNormal, fontWeight: '600' }}>
                {' '}
                (+{(trip.end_odometer - trip.start_odometer).toLocaleString('en-IN')} km)
              </Text>
            ) : null}
          </Text>
        </View>
      )}

      {/* ── Purpose and Notes ── */}
      {(trip.purpose || trip.notes) && (
        <View style={styles.footerInfoRow}>
          {trip.purpose ? (
            <View
              style={[
                styles.purposeChip,
                { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight },
              ]}
            >
              <Text style={[styles.purposeText, { color: colors.textSecondary }]}>
                🏷️ {trip.purpose}
              </Text>
            </View>
          ) : null}
          {trip.notes ? (
            <Text
              style={[styles.notesText, { color: colors.textTertiary }]}
              numberOfLines={1}
            >
              "{trip.notes}"
            </Text>
          ) : null}
        </View>
      )}

      {/* ── Footer / Delete Action ── */}
      <View style={[styles.actionFooter, { borderTopColor: colors.borderLight }]}>
        <Text style={[styles.inspectLink, { color: colors.primary }]}>
          {isGps ? 'Inspect GPS Timeline & Route ➔' : 'View Trip Details ➔'}
        </Text>

        {onDelete ? (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onDelete(trip);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
          >
            <Text style={[styles.deleteText, { color: colors.danger }]}>
              🗑️ Delete
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    marginBottom: Spacing.sm,
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
  dateText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  vehicleText: {
    fontSize: 12,
    marginTop: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  warningStrip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    marginTop: Spacing.xs,
  },
  warningText: {
    fontSize: 11,
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: Spacing.sm,
  },
  distanceText: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  distanceUnit: {
    fontSize: 14,
    fontWeight: '600',
  },
  metricSubtitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  rightMetricsWrap: {
    flexDirection: 'row',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  metricPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Sizing.radiusSm,
  },
  metricPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  odometerRow: {
    borderTopWidth: 1,
    paddingTop: 6,
    marginTop: Spacing.sm,
  },
  odometerLabel: {
    fontSize: 12,
  },
  footerInfoRow: {
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
  purposeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  notesText: {
    fontSize: 11,
    fontStyle: 'italic',
    flex: 1,
  },
  actionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  inspectLink: {
    fontSize: 12,
    fontWeight: '700',
  },
  deleteText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
