/**
 * CostBreakdownDonutChart Component
 *
 * Enhanced visual analytics for vehicle ownership expenditure:
 * - Dynamic Interactive Center: Tap any slice or legend item to inspect category share and amount
 * - Primary Cost Driver insight banner
 * - Interactive category cards with horizontal progress micro-bars
 * - Animated Pie/Donut Chart with curved segment styling
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { Typography, Spacing, Sizing } from '@/constants/theme';
import { formatCurrency } from '@/utils/format';
import { CategoryIcon } from '@/components/CategoryIcon';

import type { CostCategorySlice } from '@/utils/statsHelpers';
export type { CostCategorySlice };

interface CostBreakdownDonutChartProps {
  slices: CostCategorySlice[];
  totalCost: number;
  timeRangeLabel?: string;
  colors: any;
}

export function CostBreakdownDonutChart({
  slices,
  totalCost,
  timeRangeLabel = 'Total Spend',
  colors,
}: CostBreakdownDonutChartProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const activeSlices = slices.filter((s) => s.amount > 0);

  if (totalCost <= 0 || activeSlices.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Text style={{ fontSize: 32, marginBottom: Spacing.xs }}>🍩</Text>
        <Text style={[Typography.bodySmall, { color: colors.textSecondary, fontWeight: '700', textAlign: 'center' }]}>
          No spending recorded for this timeframe.
        </Text>
        <Text style={[Typography.caption, { color: colors.textTertiary, textAlign: 'center', marginTop: 4, lineHeight: 18 }]}>
          Log fuel fill-ups, maintenance records, or vehicle bills to see your cost distribution.
        </Text>
      </View>
    );
  }

  // Identify top spending driver
  const sortedSlices = [...activeSlices].sort((a, b) => b.amount - a.amount);
  const topSlice = sortedSlices[0];
  const topSlicePercent = totalCost > 0 ? Math.round((topSlice.amount / totalCost) * 100) : 0;

  // Active inspected slice
  const selectedSlice = activeSlices.find((s) => s.key === selectedKey) ?? null;

  // Transform data for gifted-charts PieChart
  const pieData = activeSlices.map((item) => {
    const isSelected = selectedKey === item.key;
    return {
      value: item.amount,
      color: item.color,
      focused: isSelected,
      onPress: () => {
        setSelectedKey(selectedKey === item.key ? null : item.key);
      },
    };
  });

  return (
    <View style={styles.container}>
      {/* ── Primary Cost Driver Insight Banner ── */}
      {topSlice && (
        <View style={[styles.insightBanner, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={[Typography.caption, { color: colors.textSecondary, lineHeight: 18 }]}>
            💡 <Text style={{ fontWeight: '700', color: colors.text }}>Key Driver:</Text>{' '}
            <Text style={{ fontWeight: '700', color: topSlice.color }}>{topSlice.label}</Text> makes up{' '}
            <Text style={{ fontWeight: '700', color: colors.text }}>{topSlicePercent}%</Text> ({formatCurrency(topSlice.amount)}) of your spend.
          </Text>
        </View>
      )}

      {/* ── Donut Chart with Interactive Center ── */}
      <View style={styles.chartWrapper}>
        <PieChart
          data={pieData}
          donut
          isAnimated
          animationDuration={600}
          radius={88}
          innerRadius={60}
          innerCircleColor={colors.surface}
          centerLabelComponent={() => (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setSelectedKey(null)}
              style={styles.centerLabel}
            >
              {selectedSlice ? (
                <>
                  <Text style={[styles.centerSub, { color: selectedSlice.color }]} numberOfLines={1}>
                    {selectedSlice.label}
                  </Text>
                  <Text style={[styles.centerVal, { color: colors.text }]}>
                    {formatCurrency(selectedSlice.amount)}
                  </Text>
                  <Text style={[styles.centerPercent, { color: colors.textSecondary }]}>
                    {Math.round((selectedSlice.amount / totalCost) * 100)}% of spend
                  </Text>
                </>
              ) : (
                <>
                  <Text style={[styles.centerSub, { color: colors.textTertiary }]}>
                    TOTAL SPEND
                  </Text>
                  <Text style={[styles.centerVal, { color: colors.text }]}>
                    {formatCurrency(totalCost)}
                  </Text>
                  <Text style={[styles.centerHint, { color: colors.textTertiary }]}>
                    Tap to inspect
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        />
      </View>

      {/* ── Interactive Category Breakdown Cards with Progress Bars ── */}
      <View style={styles.legendContainer}>
        {activeSlices.map((item) => {
          const percent = totalCost > 0 ? (item.amount / totalCost) * 100 : 0;
          const isSelected = selectedKey === item.key;

          return (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.75}
              onPress={() => setSelectedKey(isSelected ? null : item.key)}
              style={[
                styles.legendCard,
                {
                  backgroundColor: isSelected ? (colors.primaryLight ?? colors.background) : colors.background,
                  borderColor: isSelected ? colors.primary : colors.border,
                  borderWidth: isSelected ? 1.5 : 1,
                },
              ]}
            >
              <View style={styles.legendCardHeader}>
                <View style={styles.legendLeft}>
                  <View style={[styles.iconWrapper, { backgroundColor: item.color + '22' }]}>
                    <CategoryIcon icon={item.icon} size={15} />
                  </View>
                  <View>
                    <Text style={[Typography.bodySmall, { color: colors.text, fontWeight: '700' }]}>
                      {item.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.legendRight}>
                  <View style={[styles.percentBadge, { backgroundColor: item.color + '18' }]}>
                    <Text style={[styles.percentText, { color: item.color }]}>
                      {percent.toFixed(0)}%
                    </Text>
                  </View>
                  <Text style={[Typography.bodySmall, { color: colors.text, fontWeight: '800' }]}>
                    {formatCurrency(item.amount)}
                  </Text>
                </View>
              </View>

              {/* Progress micro-bar */}
              <View style={[styles.progressTrack, { backgroundColor: colors.border + '60' }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.max(2, Math.min(100, percent))}%`,
                      backgroundColor: item.color,
                    },
                  ]}
                />
              </View>
            </TouchableOpacity>
          );
        })}
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
  insightBanner: {
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
  },
  centerLabel: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 116,
    height: 116,
  },
  centerSub: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  centerVal: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  centerPercent: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  centerHint: {
    fontSize: 9,
    fontStyle: 'italic',
    marginTop: 2,
  },
  legendContainer: {
    marginTop: Spacing.md,
    gap: 8,
  },
  legendCard: {
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: Sizing.radiusMd,
  },
  legendCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  percentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Sizing.radiusFull,
  },
  percentText: {
    fontSize: 11,
    fontWeight: '800',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});
