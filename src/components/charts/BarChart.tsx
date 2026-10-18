/**
 * BarChart Component
 *
 * A pure React Native bar chart for displaying discrete categorical data.
 * Originally inlined in stats.tsx; extracted for reusability.
 *
 * USAGE:
 *   <BarChart
 *     data={[{ label: 'Jan', value: 4800 }, { label: 'Feb', value: 3200 }]}
 *     barColor={colors.primary}
 *     labelColor={colors.textSecondary}
 *     valueColor={colors.text}
 *   />
 *
 * Each bar scales proportionally to the highest value in the dataset.
 * Values >= 1000 are abbreviated (e.g. 4800 → "4.8k", 12000 → "12k").
 * An optional per-item `color` overrides the global `barColor`.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface BarChartDataPoint {
  /** Short label displayed below the bar (e.g. 'Jan', '2024') */
  label: string;
  /** Numeric value determining bar height */
  value: number;
  /** Optional per-bar colour override. Falls back to the global `barColor`. */
  color?: string;
}

export interface BarChartProps {
  data: BarChartDataPoint[];
  /** If provided, all bars scale relative to this value instead of the dataset max. */
  maxValue?: number;
  /** Default bar fill colour (can be overridden per-bar via `data[n].color`). */
  barColor: string;
  /** Colour applied to the label text below each bar. */
  labelColor: string;
  /** Colour applied to the value text above each bar. */
  valueColor: string;
  /** Height of the bar area in logical pixels. Defaults to 110. */
  height?: number;
}

/**
 * Formats a numeric value for compact display above a bar.
 * - Values >= 10 000 → "12k"
 * - Values >= 1 000  → "4.8k"
 * - Integer values   → displayed as-is
 * - Float values     → rounded to 0 decimal places
 */
function formatBarValue(value: number): string | number {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }
  return value % 1 === 0 ? value : value.toFixed(0);
}

export function BarChart({
  data,
  maxValue,
  barColor,
  labelColor,
  valueColor,
  height = 110,
}: BarChartProps) {
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);

  return (
    <View>
      <View style={[styles.barsRow, { height }]}>
        {data.map((item, i) => {
          const barHeight = max > 0 ? (item.value / max) * height : 0;
          return (
            <View key={i} style={styles.barColumn}>
              <Text style={[styles.barValue, { color: valueColor }]}>
                {formatBarValue(item.value)}
              </Text>
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(barHeight, 4),
                    backgroundColor: item.color ?? barColor,
                    borderRadius: 4,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.labelsRow}>
        {data.map((item, i) => (
          <View key={i} style={styles.labelColumn}>
            <Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '80%',
    minWidth: 12,
  },
  barValue: {
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 4,
  },
  labelsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  labelColumn: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
});
