import React, { useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, TouchableOpacity } from 'react-native';
import { LineChart, CurveType } from 'react-native-gifted-charts';
import { Typography, Spacing, Sizing } from '@/constants/theme';
import { formatMileage } from '@/utils/format';

export interface MileagePoint {
  date: string; // ISO date string (YYYY-MM-DD)
  displayDate: string; // Short display e.g. "12/10"
  value: number; // Calculated mileage value
  fuelStation?: string | null;
  fuelSystem?: 'primary' | 'secondary';
}

interface MileageTrendChartProps {
  data: MileagePoint[];
  averageMileage: number | null;
  unitLabel: string;
  colors: any;
  height?: number;
}

export function MileageTrendChart({
  data,
  averageMileage,
  unitLabel,
  colors,
  height = 160,
}: MileageTrendChartProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [selectedPoint, setSelectedPoint] = useState<MileagePoint | null>(null);

  if (!data || data.length < 2) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Text style={{ fontSize: 28, marginBottom: Spacing.xs }}>📉</Text>
        <Text style={[Typography.bodySmall, { color: colors.textSecondary, fontWeight: '600', textAlign: 'center' }]}>
          Need at least 2 full-tank fill-ups to plot your mileage trendline.
        </Text>
        <Text style={[Typography.caption, { color: colors.textTertiary, textAlign: 'center', marginTop: 4 }]}>
          Keep tracking — your fuel efficiency curves will unlock automatically!
        </Text>
      </View>
    );
  }

  const avg = averageMileage ?? data.reduce((s, d) => s + d.value, 0) / data.length;

  // Chart width fitting card padding: windowWidth - (screen margins: 32 + card padding: 32)
  const chartWidth = Math.max(windowWidth - 76, 260);

  // Spacing between points
  const pointSpacing = Math.max(28, Math.min(60, (chartWidth - 40) / Math.max(data.length - 1, 1)));

  // Transform data points for gifted-charts
  const chartData = data.map((item, index) => {
    const isAboveAvg = item.value >= avg;
    const pointColor = isAboveAvg ? colors.success : colors.warning;

    return {
      value: item.value,
      label: item.displayDate,
      dataPointColor: pointColor,
      textColor: colors.textTertiary,
      textFontSize: 9,
      dataPointRadius: 4.5,
      focusedDataPointRadius: 7,
      onPress: () => setSelectedPoint(item),
    };
  });

  const allValues = data.map((d) => d.value);
  const maxVal = Math.max(...allValues, avg);
  // Add 15% headroom above the highest data point
  const yAxisMax = Math.ceil(maxVal * 1.15);

  return (
    <View style={styles.container}>
      {/* ── Active Selection Pill (if tapped) ── */}
      {selectedPoint && (
        <View style={[styles.tooltipCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={styles.tooltipRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[Typography.caption, { color: colors.textSecondary, fontWeight: '600' }]}>
                {selectedPoint.date}
              </Text>
              {selectedPoint.fuelSystem && (
                <View style={[styles.fuelSystemBadge, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[Typography.caption, { color: colors.primary, fontSize: 10, fontWeight: '700' }]}>
                    {selectedPoint.fuelSystem === 'primary' ? 'CNG' : 'Petrol'}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={() => setSelectedPoint(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ fontSize: 12, color: colors.textTertiary, paddingHorizontal: 4 }}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.tooltipDetails}>
            <Text style={[Typography.body, { color: selectedPoint.value >= avg ? colors.success : colors.warning, fontWeight: '700' }]}>
              {formatMileage(selectedPoint.value, unitLabel)}
              <Text style={[Typography.caption, { color: colors.textTertiary, fontWeight: 'normal' }]}>
                {' '}({selectedPoint.value >= avg ? `+${(selectedPoint.value - avg).toFixed(1)} above avg` : `-${(avg - selectedPoint.value).toFixed(1)} below avg`})
              </Text>
            </Text>
            {selectedPoint.fuelStation ? (
              <Text style={[Typography.caption, { color: colors.textTertiary, fontStyle: 'italic', marginTop: 2 }]}>
                📍 {selectedPoint.fuelStation}
              </Text>
            ) : null}
          </View>
        </View>
      )}

      {/* ── Line Chart ── */}
      <View style={styles.chartWrapper}>
        <LineChart
          data={chartData}
          width={chartWidth}
          height={height}
          spacing={pointSpacing}
          initialSpacing={16}
          endSpacing={16}
          curved
          curveType={CurveType.CUBIC}
          color={colors.primary}
          thickness={2.5}
          areaChart
          startFillColor={colors.primary}
          endFillColor={colors.primary}
          startOpacity={0.2}
          endOpacity={0.02}
          maxValue={yAxisMax}
          noOfSections={3}
          rulesType="solid"
          rulesColor={colors.border + '60'}
          yAxisColor={colors.border}
          xAxisColor={colors.border}
          yAxisTextStyle={{ color: colors.textTertiary, fontSize: 9 }}
          xAxisLabelTextStyle={{ color: colors.textTertiary, fontSize: 9 }}
          showReferenceLine1={avg > 0}
          referenceLine1Position={avg}
          referenceLine1Config={{
            color: colors.accent,
            dashWidth: 4,
            dashGap: 4,
            thickness: 1.5,
          }}
          isAnimated
          animationDuration={600}
        />
      </View>

      {/* ── Legend Row ── */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
          <Text style={[Typography.caption, { color: colors.textSecondary, fontSize: 11 }]}>
            Above Avg
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.warning }]} />
          <Text style={[Typography.caption, { color: colors.textSecondary, fontSize: 11 }]}>
            Below Avg
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDashedLine, { borderColor: colors.accent }]} />
          <Text style={[Typography.caption, { color: colors.textSecondary, fontSize: 11 }]}>
            Avg: {avg.toFixed(1)} {unitLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  emptyContainer: {
    padding: Spacing.xl,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltipCard: {
    padding: Spacing.sm,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  tooltipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fuelSystemBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  tooltipDetails: {
    marginTop: 3,
  },
  chartWrapper: {
    alignItems: 'center',
    overflow: 'hidden',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendDashedLine: {
    width: 14,
    height: 0,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});
