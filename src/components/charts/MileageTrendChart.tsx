/**
 * MileageTrendChart Component
 *
 * Enhanced visual analytics for vehicle fuel efficiency:
 * - Top Insight Badges: Best Mileage, Running Average, Lowest Mileage
 * - Interactive Data Inspector: Displays tapped fill-up date, station, delta vs average
 * - Cubic Bezier curved line chart with vertical area gradient
 * - Dashed reference line for running average
 * - Above / Below average color coding
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions, TouchableOpacity, ScrollView } from 'react-native';
import { LineChart, CurveType } from 'react-native-gifted-charts';
import { Typography, Spacing, Sizing } from '@/constants/theme';
import { formatMileage } from '@/utils/format';

export interface MileagePoint {
  date: string; // ISO date string (YYYY-MM-DD)
  displayDate: string; // Short display e.g. "12/10"
  value: number; // Calculated mileage value
  fuelStation?: string | null;
  fuelSystem?: 'primary' | 'secondary';
  fuelSystemLabel?: string;
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
  height = 170,
}: MileageTrendChartProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (!data || data.length < 2) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Text style={{ fontSize: 32, marginBottom: Spacing.xs }}>📉</Text>
        <Text style={[Typography.bodySmall, { color: colors.textSecondary, fontWeight: '700', textAlign: 'center' }]}>
          Need at least 2 full-tank fill-ups to plot your efficiency curve.
        </Text>
        <Text style={[Typography.caption, { color: colors.textTertiary, textAlign: 'center', marginTop: 4, lineHeight: 18 }]}>
          Keep recording fill-ups — your mileage trendline and variance analytics will appear here automatically!
        </Text>
      </View>
    );
  }

  const avg = averageMileage ?? data.reduce((s, d) => s + d.value, 0) / data.length;

  // Best & Lowest Points
  let bestPoint = data[0];
  let worstPoint = data[0];
  for (const p of data) {
    if (p.value > bestPoint.value) bestPoint = p;
    if (p.value < worstPoint.value) worstPoint = p;
  }

  // Active point for inspection
  const activeInspectorPoint = selectedIndex !== null && selectedIndex >= 0 && selectedIndex < data.length
    ? data[selectedIndex]
    : null;

  // Chart width fitting card padding: windowWidth - (screen margins: 32 + card padding: 32)
  const chartWidth = Math.max(windowWidth - 76, 260);

  // Spacing between points
  const pointSpacing = Math.max(30, Math.min(64, (chartWidth - 44) / Math.max(data.length - 1, 1)));

  // Transform data points for gifted-charts, preventing label collisions on mobile screens
  const labelInterval = Math.max(1, Math.ceil(data.length / 5));
  const chartData = data.map((item, index) => {
    const isAboveAvg = item.value >= avg;
    const isSelected = selectedIndex === index;
    const pointColor = isSelected ? colors.primary : isAboveAvg ? colors.success : colors.warning;
    const showLabel = data.length <= 6 || index === 0 || index === data.length - 1 || index % labelInterval === 0;

    return {
      value: item.value,
      label: showLabel ? item.displayDate : '',
      dataPointColor: pointColor,
      textColor: colors.textTertiary,
      textFontSize: 9,
      dataPointRadius: isSelected ? 8 : 6,
      focusedDataPointRadius: 9,
      onPress: () => setSelectedIndex(index),
    };
  });

  const allValues = data.map((d) => d.value);
  const maxVal = Math.max(...allValues, avg);
  // Add 12% headroom above the highest data point
  const yAxisMax = Math.ceil(maxVal * 1.12);

  return (
    <View style={styles.container}>
      {/* ── Top Efficiency KPI Ribbon ── */}
      <View style={styles.kpiRibbon}>
        {/* Best */}
        <View style={[styles.kpiBadge, { backgroundColor: colors.successLight ?? (colors.success + '18'), borderColor: colors.success + '40' }]}>
          <Text style={[styles.kpiBadgeTitle, { color: colors.success }]}>🏆 BEST</Text>
          <Text style={[styles.kpiBadgeVal, { color: colors.success }]}>
            {bestPoint.value.toFixed(1)} <Text style={styles.kpiBadgeUnit}>{unitLabel}</Text>
          </Text>
        </View>

        {/* Running Average */}
        <View style={[styles.kpiBadge, { backgroundColor: colors.primaryLight ?? (colors.primary + '18'), borderColor: colors.primary + '40' }]}>
          <Text style={[styles.kpiBadgeTitle, { color: colors.primary }]}>🎯 AVERAGE</Text>
          <Text style={[styles.kpiBadgeVal, { color: colors.primary }]}>
            {avg.toFixed(1)} <Text style={styles.kpiBadgeUnit}>{unitLabel}</Text>
          </Text>
        </View>

        {/* Lowest */}
        <View style={[styles.kpiBadge, { backgroundColor: colors.warningLight ?? (colors.warning + '18'), borderColor: colors.warning + '40' }]}>
          <Text style={[styles.kpiBadgeTitle, { color: colors.warning }]}>📉 LOWEST</Text>
          <Text style={[styles.kpiBadgeVal, { color: colors.warning }]}>
            {worstPoint.value.toFixed(1)} <Text style={styles.kpiBadgeUnit}>{unitLabel}</Text>
          </Text>
        </View>
      </View>

      {/* ── Active Selection Inspector Card ── */}
      {activeInspectorPoint ? (
        <View style={[styles.inspectorCard, { backgroundColor: colors.background, borderColor: colors.primary }]}>
          <View style={styles.inspectorTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <View style={[styles.pointIndexBadge, { backgroundColor: colors.primary }]}>
                <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>
                  Dot #{selectedIndex! + 1}
                </Text>
              </View>
              <Text style={[Typography.bodySmall, { color: colors.text, fontWeight: '700' }]}>
                📅 {activeInspectorPoint.date}
              </Text>
              {activeInspectorPoint.fuelSystemLabel ? (
                <View style={[styles.systemTag, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[Typography.caption, { color: colors.primary, fontSize: 10, fontWeight: '800' }]}>
                    {activeInspectorPoint.fuelSystemLabel}
                  </Text>
                </View>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={() => setSelectedIndex(null)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={{ fontSize: 12, color: colors.textTertiary, paddingHorizontal: 4 }}>✕ Deselect</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inspectorMetrics}>
            <Text style={[styles.inspectorVal, { color: activeInspectorPoint.value >= avg ? colors.success : colors.warning }]}>
              {formatMileage(activeInspectorPoint.value, unitLabel)}
            </Text>
            <View style={[styles.deltaBadge, {
              backgroundColor: activeInspectorPoint.value >= avg
                ? (colors.successLight ?? colors.success + '20')
                : (colors.warningLight ?? colors.warning + '20'),
            }]}>
              <Text style={[styles.deltaText, { color: activeInspectorPoint.value >= avg ? colors.success : colors.warning }]}>
                {activeInspectorPoint.value >= avg
                  ? `▲ +${(activeInspectorPoint.value - avg).toFixed(1)} (${(((activeInspectorPoint.value - avg) / avg) * 100).toFixed(0)}%) above avg`
                  : `▼ -${(avg - activeInspectorPoint.value).toFixed(1)} (${(((avg - activeInspectorPoint.value) / avg) * 100).toFixed(0)}%) below avg`}
              </Text>
            </View>
          </View>

          {activeInspectorPoint.fuelStation && (
            <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
              📍 Pump: <Text style={{ color: colors.text, fontWeight: '600' }}>{activeInspectorPoint.fuelStation}</Text>
            </Text>
          )}
        </View>
      ) : (
        <View style={[styles.hintCard, { backgroundColor: colors.background, borderColor: colors.borderLight }]}>
          <Text style={[Typography.caption, { color: colors.textTertiary, textAlign: 'center' }]}>
            💡 Tap any dot on the trendline curve (or chip below) to inspect details
          </Text>
        </View>
      )}

      {/* ── Line Chart with Always-Visible Dots ── */}
      <View style={styles.chartWrapper}>
        <LineChart
          data={chartData}
          width={chartWidth}
          height={height}
          spacing={pointSpacing}
          initialSpacing={20}
          endSpacing={20}
          curved
          curveType={CurveType.CUBIC}
          color={colors.primary}
          thickness={2.8}
          areaChart
          startFillColor={colors.primary}
          endFillColor={colors.primary}
          startOpacity={0.25}
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
            dashWidth: 5,
            dashGap: 4,
            thickness: 1.6,
          }}
          hideDataPoints={false}
          dataPointsRadius={6}
          dataPointsColor={colors.primary}
          focusedDataPointIndex={selectedIndex ?? undefined}
          focusedDataPointRadius={9}
          focusEnabled
          showStripOnFocus
          stripColor={colors.primary + '80'}
          stripWidth={2}
          stripStrokeDashArray={[4, 4]}
          onPress={(_item: any, idx: number) => {
            setSelectedIndex(idx);
          }}
          onFocus={(_item: any, idx: number) => {
            setSelectedIndex(idx);
          }}
        />
      </View>

      {/* ── Fill-Up Points Track (Explicitly points to dots on curve) ── */}
      <View style={styles.quickSelectorContainer}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs }}>
          <Text style={[Typography.caption, { color: colors.textSecondary, fontSize: 11, fontWeight: '700' }]}>
            📍 Fill-Up Dots (Left to right along curve):
          </Text>
          {selectedIndex !== null && (
            <Text style={[Typography.caption, { color: colors.primary, fontSize: 11, fontWeight: '700' }]}>
              Highlighting Dot #{selectedIndex + 1}
            </Text>
          )}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickPillsTrack}
        >
          {data.map((item, idx) => {
            const isSelected = selectedIndex === idx;
            const isAbove = item.value >= avg;
            return (
              <TouchableOpacity
                key={`${item.date}-${idx}`}
                style={[
                  styles.quickPointPill,
                  {
                    backgroundColor: isSelected
                      ? colors.primary
                      : isAbove
                      ? (colors.successLight ?? colors.success + '18')
                      : (colors.warningLight ?? colors.warning + '18'),
                    borderColor: isSelected
                      ? colors.primary
                      : isAbove
                      ? colors.success + '60'
                      : colors.warning + '60',
                  },
                ]}
                onPress={() => setSelectedIndex(isSelected ? null : idx)}
                activeOpacity={0.7}
              >
                {/* Dot index matching the curve from left to right */}
                <View
                  style={[
                    styles.pillDotBadge,
                    {
                      backgroundColor: isSelected
                        ? '#FFFFFF'
                        : isAbove
                        ? colors.success
                        : colors.warning,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 9,
                      fontWeight: '800',
                      color: isSelected
                        ? colors.primary
                        : '#FFFFFF',
                    }}
                  >
                    #{idx + 1}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.quickPointPillDate,
                    { color: isSelected ? '#FFFFFF' : colors.text },
                  ]}
                >
                  {item.displayDate}
                </Text>

                <Text
                  style={[
                    styles.quickPointPillVal,
                    {
                      color: isSelected
                        ? '#FFFFFF'
                        : isAbove
                        ? colors.success
                        : colors.warning,
                    },
                  ]}
                >
                  {item.value.toFixed(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Legend Row ── */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
          <Text style={[Typography.caption, { color: colors.textSecondary, fontSize: 11 }]}>
            Above Avg (Efficient)
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
          <Text style={[Typography.caption, { color: colors.textSecondary, fontSize: 11, fontWeight: '700' }]}>
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
  kpiRibbon: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  kpiBadge: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    alignItems: 'center',
  },
  kpiBadgeTitle: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  kpiBadgeVal: {
    fontSize: 14,
    fontWeight: '800',
  },
  kpiBadgeUnit: {
    fontSize: 10,
    fontWeight: '500',
  },
  inspectorCard: {
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1.5,
    marginBottom: Spacing.sm,
  },
  inspectorTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pointIndexBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  systemTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inspectorMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  inspectorVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  deltaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Sizing.radiusFull,
  },
  deltaText: {
    fontSize: 11,
    fontWeight: '700',
  },
  hintCard: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  chartWrapper: {
    alignItems: 'center',
    overflow: 'hidden',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
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
  quickSelectorContainer: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  quickPillsTrack: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  quickPointPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    minHeight: 34,
  },
  pillDotBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickPointPillDate: {
    fontSize: 11,
    fontWeight: '700',
  },
  quickPointPillVal: {
    fontSize: 11,
    fontWeight: '800',
  },
});
