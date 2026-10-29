/**
 * Speed & Efficiency Analysis Section Component
 *
 * Rendered on completed GPS Trip Details screen.
 * Shows:
 * 1. Non-overlapping speed bands (0–20, 20–30, 30–50, 50–80, 80+ km/h)
 * 2. Segmented toggle between Distance (km) and Time % (proportion of analysed duration)
 * 3. Proportional horizontal bars sharing identical denominator as displayed metric
 * 4. Dedicated vehicle average mileage summary row below speed bands (never inside a bar)
 * 5. Honest data quality and signal gap indicators
 */

import { FuelType, MILEAGE_UNIT_LABELS, MileageUnit } from '@/constants/fuelTypes';
import { Sizing, Spacing, Typography } from '@/constants/theme';
import type { MileageResult } from '@/engine/mileageEngine';
import type { SpeedBandAnalysisResult } from '@/engine/speedBandAnalysisEngine';
import { useThemeColors } from '@/hooks/useThemeColors';
import { formatMileage } from '@/utils/format';
import { memo, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SpeedEfficiencySectionProps {
  analysis: SpeedBandAnalysisResult;
  vehicleAverageMileage?: MileageResult | null;
  vehicleFuelType?: FuelType | string;
}

export type SpeedDisplayMode = 'distance' | 'time' | 'mileage';

function formatDistanceValue(km: number): string {
  if (km <= 0) return '0.00 km';
  if (km < 10) return `${km.toFixed(2)} km`;
  return `${km.toFixed(1)} km`;
}

function formatAnalysedDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  return remSec > 0 ? `${mins}m ${remSec}s` : `${mins}m`;
}

export const SpeedEfficiencySection = memo(function SpeedEfficiencySection({
  analysis,
  vehicleAverageMileage,
  vehicleFuelType,
}: SpeedEfficiencySectionProps) {
  const colors = useThemeColors();
  const [mode, setMode] = useState<SpeedDisplayMode>('distance');

  const {
    hasSufficientData,
    insufficientDataReason,
    bands,
    analysedDistanceKm,
    analysedDurationSeconds,
    qualityWarning,
  } = analysis;

  const unitLabel = useMemo(() => {
    if (vehicleAverageMileage) {
      return MILEAGE_UNIT_LABELS[vehicleAverageMileage.unit as MileageUnit] ?? vehicleAverageMileage.unit;
    }
    if (vehicleFuelType === 'electric' || vehicleFuelType === FuelType.ELECTRIC) {
      return 'km/kWh';
    }
    if (vehicleFuelType === 'cng' || vehicleFuelType === FuelType.CNG) {
      return 'km/kg';
    }
    return 'km/L';
  }, [vehicleAverageMileage, vehicleFuelType]);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      {/* ── Section Title & Mode Toggle ── */}
      <View style={styles.headerRow}>
        <View style={styles.titleCol}>
          <Text style={[Typography.caption, { color: colors.textSecondary, fontWeight: '700' }]}>
            ⚡ Speed Stats
          </Text>
          {hasSufficientData && (
            <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 1, fontSize: 11 }]}>
              Analysed: {formatDistanceValue(analysedDistanceKm)} · {formatAnalysedDuration(analysedDurationSeconds)}
            </Text>
          )}
        </View>

        {hasSufficientData && (
          <View
            style={[
              styles.segmentedToggle,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Show distance in kilometers"
              style={[
                styles.toggleSegment,
                mode === 'distance' && {
                  backgroundColor: colors.primary,
                },
              ]}
              onPress={() => setMode('distance')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.toggleText,
                  {
                    color: mode === 'distance' ? '#ffffff' : colors.textSecondary,
                    fontWeight: mode === 'distance' ? '700' : '500',
                  },
                ]}
              >
                Distance
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Show time percentage"
              style={[
                styles.toggleSegment,
                mode === 'time' && {
                  backgroundColor: colors.primary,
                },
              ]}
              onPress={() => setMode('time')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.toggleText,
                  {
                    color: mode === 'time' ? '#ffffff' : colors.textSecondary,
                    fontWeight: mode === 'time' ? '700' : '500',
                  },
                ]}
              >
                Time %
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Show estimated mileage by speed band"
              style={[
                styles.toggleSegment,
                mode === 'mileage' && {
                  backgroundColor: colors.primary,
                },
              ]}
              onPress={() => setMode('mileage')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.toggleText,
                  {
                    color: mode === 'mileage' ? '#ffffff' : colors.textSecondary,
                    fontWeight: mode === 'mileage' ? '700' : '500',
                  },
                ]}
              >
                Mileage
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Content: Speed Bands or Insufficient Data Message ── */}
      {!hasSufficientData ? (
        <View style={[styles.insufficientBox, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          <Text style={[Typography.caption, { color: colors.textSecondary, textAlign: 'center' }]}>
            ℹ️ {insufficientDataReason || 'Insufficient GPS data to analyse speed and efficiency.'}
          </Text>
        </View>
      ) : (
        <View style={styles.bandsContainer}>
          {bands.map((metric) => {
            const barPercentage =
              mode === 'distance'
                ? metric.distancePercentage
                : mode === 'time'
                  ? metric.timePercentage
                  : Math.min(100, Math.max(0, (metric.efficiencyMultiplier / 1.30) * 100));

            const valueText =
              mode === 'distance'
                ? formatDistanceValue(metric.distanceKm)
                : mode === 'time'
                  ? `${Math.round(metric.timePercentage)}%`
                  : metric.estimatedMileage !== null
                    ? `~${metric.estimatedMileage} ${unitLabel}`
                    : '—';

            const subText =
              mode === 'mileage'
                ? `${metric.efficiencyRating} · ${formatDistanceValue(metric.distanceKm)} (${Math.round(metric.timePercentage)}%)`
                : `${metric.efficiencyRating}${metric.estimatedMileage !== null ? ` · ~${metric.estimatedMileage} ${unitLabel}` : ''}`;

            return (
              <View key={metric.band.id} style={styles.bandRow}>
                <View style={styles.bandHeader}>
                  <View style={{ flex: 1, paddingRight: Spacing.xs }}>
                    <Text style={[Typography.caption, { color: colors.text, fontWeight: '600' }]}>
                      {metric.band.fullLabel}
                    </Text>
                    <Text style={[Typography.caption, { color: colors.textTertiary, fontSize: 10, marginTop: 1 }]}>
                      {subText}
                    </Text>
                  </View>
                  <Text
                    style={[
                      Typography.caption,
                      {
                        color: barPercentage > 0 ? colors.primary : colors.textTertiary,
                        fontWeight: '700',
                        fontSize: 12,
                      },
                    ]}
                  >
                    {valueText}
                  </Text>
                </View>

                {/* Proportional Bar */}
                <View
                  style={[
                    styles.barTrack,
                    { backgroundColor: colors.borderLight },
                  ]}
                >
                  <View
                    style={[
                      styles.barFill,
                      {
                        backgroundColor:
                          mode === 'mileage' && metric.efficiencyMultiplier >= 1.15
                            ? '#10B981' // Green for optimal sweet spot
                            : colors.primary,
                        width: `${Math.min(100, Math.max(0, barPercentage))}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ── Quality Warning Banner if Any ── */}
      {qualityWarning && (
        <View
          style={[
            styles.warningBanner,
            {
              backgroundColor: colors.warningLight,
              borderColor: colors.warning,
            },
          ]}
        >
          <Text style={[Typography.caption, { color: colors.warning, fontWeight: '600', fontSize: 11 }]}>
            ⚠️ {qualityWarning}
          </Text>
        </View>
      )}

      {/* ── Distinct Vehicle Average Mileage Row (Below Speed Bands) ── */}
      <View
        style={[
          styles.mileageRow,
          {
            borderTopColor: colors.borderLight,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[Typography.caption, { color: colors.textSecondary, fontWeight: '600' }]}>
            Calculated vehicle average
          </Text>
          <Text style={[Typography.caption, { color: colors.textTertiary, fontSize: 11, marginTop: 1 }]}>
            {vehicleAverageMileage
              ? 'Based on available fuel records'
              : 'Add a valid fuel record interval to calculate the vehicle average.'}
          </Text>
        </View>

        {vehicleAverageMileage && (
          <View style={styles.mileageValueBadge}>
            <Text style={[Typography.body, { color: colors.text, fontWeight: '700' }]}>
              {formatMileage(
                vehicleAverageMileage.value,
                MILEAGE_UNIT_LABELS[vehicleAverageMileage.unit as MileageUnit] ?? vehicleAverageMileage.unit
              )}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    marginTop: Spacing.sm,
    ...Sizing.cardShadow,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  titleCol: {
    flex: 1,
    paddingRight: Spacing.xs,
  },
  segmentedToggle: {
    flexDirection: 'row',
    borderRadius: Sizing.radiusSm,
    padding: 2,
    borderWidth: 1,
  },
  toggleSegment: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: Sizing.radiusSm - 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: {
    fontSize: 11,
  },
  bandsContainer: {
    marginTop: 2,
  },
  bandRow: {
    marginBottom: Spacing.xs,
  },
  bandHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  barTrack: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  insufficientBox: {
    padding: Spacing.sm,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    marginVertical: Spacing.xs,
  },
  warningBanner: {
    padding: Spacing.xs,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    marginTop: Spacing.xs,
  },
  mileageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
  },
  mileageValueBadge: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
