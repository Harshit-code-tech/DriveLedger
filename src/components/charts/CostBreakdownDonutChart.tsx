import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
  const activeSlices = slices.filter((s) => s.amount > 0);

  if (totalCost <= 0 || activeSlices.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Text style={{ fontSize: 28, marginBottom: Spacing.xs }}>🍩</Text>
        <Text style={[Typography.bodySmall, { color: colors.textSecondary, fontWeight: '600', textAlign: 'center' }]}>
          No spending recorded for this timeframe.
        </Text>
        <Text style={[Typography.caption, { color: colors.textTertiary, textAlign: 'center', marginTop: 4 }]}>
          Log fuel refills or maintenance expenses to see your cost breakdown.
        </Text>
      </View>
    );
  }

  // Transform data for gifted-charts PieChart
  const pieData = activeSlices.map((item) => ({
    value: item.amount,
    color: item.color,
  }));

  return (
    <View style={styles.container}>
      {/* ── Donut Chart ── */}
      <View style={styles.chartWrapper}>
        <PieChart
          data={pieData}
          donut
          isAnimated
          animationDuration={600}
          radius={76}
          innerRadius={50}
          innerCircleColor={colors.surface}
          centerLabelComponent={() => (
            <View style={styles.centerLabel}>
              <Text style={[Typography.caption, { color: colors.textTertiary, fontSize: 10 }]}>
                {timeRangeLabel}
              </Text>
              <Text style={[Typography.bodySmall, { color: colors.text, fontWeight: '700', fontSize: 13, marginTop: 1 }]}>
                {formatCurrency(totalCost)}
              </Text>
            </View>
          )}
        />
      </View>

      {/* ── Category Breakdown Legend ── */}
      <View style={styles.legendContainer}>
        {activeSlices.map((item) => {
          const percent = totalCost > 0 ? Math.round((item.amount / totalCost) * 100) : 0;
          return (
            <View
              key={item.key}
              style={[styles.legendRow, { borderColor: colors.border + '40' }]}
            >
              <View style={styles.legendLeft}>
                <View style={[styles.colorIndicator, { backgroundColor: item.color }]} />
                <CategoryIcon icon={item.icon} size={14} />
                <Text style={[Typography.bodySmall, { color: colors.text, fontWeight: '600' }]}>
                  {item.label}
                </Text>
              </View>

              <View style={styles.legendRight}>
                <Text style={[Typography.caption, { color: colors.textTertiary, marginRight: 6 }]}>
                  {percent}%
                </Text>
                <Text style={[Typography.bodySmall, { color: colors.text, fontWeight: '700' }]}>
                  {formatCurrency(item.amount)}
                </Text>
              </View>
            </View>
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
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
  },
  centerLabel: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendContainer: {
    marginTop: Spacing.md,
    gap: 6,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: Sizing.radiusSm,
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
