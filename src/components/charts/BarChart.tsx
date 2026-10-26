/**
 * BarChart Component
 *
 * Mobile-First Interactive Time-Series Bar Chart:
 * - Solves small-screen compression: Automatically switches to a smooth horizontal ScrollView when data > 6 items (e.g. 12M view)
 * - Auto-scrolls to the newest month on mount so recent data is immediately visible
 * - Generous touch targets (48px wide per bar column)
 * - Beautiful capsule styling with background track & peak-spending crown indicator
 * - Dashed horizontal reference line indicating period average
 * - Mobile-friendly vertical Month Inspector Card showing full Fuel vs Service vs Other split
 */

import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Typography, Spacing, Sizing } from '@/constants/theme';
import { formatCurrency } from '@/utils/format';

export interface BarChartDataPoint {
  label: string;
  value: number;
  color?: string;
  fuel?: number;
  service?: number;
  expense?: number;
  fullLabel?: string;
}

export interface BarChartProps {
  data: BarChartDataPoint[];
  maxValue?: number;
  barColor: string;
  labelColor: string;
  valueColor: string;
  height?: number;
  colors?: any;
}

function formatBarValue(value: number): string {
  if (value >= 100000) {
    return `${(value / 100000).toFixed(1)}L`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }
  return value % 1 === 0 ? String(value) : value.toFixed(0);
}

export function BarChart({
  data,
  maxValue,
  barColor,
  labelColor,
  valueColor,
  height = 125,
  colors,
}: BarChartProps) {
  const scrollViewRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(
    data.length > 0 ? data.length - 1 : null
  );

  const isScrollable = data.length > 6;

  // Auto-scroll to latest month on mount or data length change
  useEffect(() => {
    if (isScrollable && scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [data.length, isScrollable]);

  if (!data || data.length === 0) {
    return null;
  }

  const allValues = data.map((d) => d.value);
  const max = maxValue ?? Math.max(...allValues, 1);
  const avg = Math.round(data.reduce((s, d) => s + d.value, 0) / Math.max(data.length, 1));

  // Identify peak spending month
  let peakIdx = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i].value > data[peakIdx].value) {
      peakIdx = i;
    }
  }

  const selectedItem = selectedIdx !== null && selectedIdx < data.length ? data[selectedIdx] : null;

  // Average line position (pixels from bottom)
  const avgLineBottom = max > 0 ? Math.min(height - 10, Math.max(10, (avg / max) * height)) : 0;

  const renderBarItem = (item: BarChartDataPoint, i: number) => {
    const barHeight = max > 0 ? (item.value / max) * height : 0;
    const isSelected = selectedIdx === i;
    const isPeak = i === peakIdx && item.value > 0;
    const currentBarColor = item.color ?? (isSelected ? (colors?.primary ?? barColor) : (colors?.accent ?? barColor));

    return (
      <TouchableOpacity
        key={i}
        activeOpacity={0.75}
        onPress={() => setSelectedIdx(i)}
        style={[
          styles.barColumn,
          isScrollable && { width: 52, marginHorizontal: 3 },
        ]}
      >
        {/* Peak Indicator / Value Text */}
        <View style={styles.valueContainer}>
          {isPeak && (
            <Text style={{ fontSize: 10, marginBottom: 1 }}>👑</Text>
          )}
          <Text
            style={[
              styles.barValue,
              {
                color: isSelected ? (colors?.primary ?? valueColor) : valueColor,
                fontWeight: isSelected || isPeak ? '800' : '600',
              },
            ]}
          >
            {formatBarValue(item.value)}
          </Text>
        </View>

        {/* Track & Bar Capsule */}
        <View style={[styles.barTrack, { height, backgroundColor: (colors?.borderLight ?? '#F0F2F5') }]}>
          <View
            style={[
              styles.barFill,
              {
                height: Math.max(barHeight, item.value > 0 ? 6 : 2),
                backgroundColor: currentBarColor,
                opacity: isSelected ? 1 : 0.85,
                borderColor: isSelected ? (colors?.primary ?? '#1A73E8') : 'transparent',
                borderWidth: isSelected ? 1.5 : 0,
              },
            ]}
          />
        </View>

        {/* Month Label */}
        <View
          style={[
            styles.labelWrapper,
            isSelected && {
              backgroundColor: (colors?.primaryLight ?? '#E8F0FE'),
              borderColor: (colors?.primary ?? '#1A73E8') + '40',
              borderWidth: 1,
            },
          ]}
        >
          <Text
            style={[
              styles.label,
              {
                color: isSelected ? (colors?.primary ?? labelColor) : labelColor,
                fontWeight: isSelected ? '800' : '500',
              },
            ]}
            numberOfLines={1}
          >
            {item.label}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* ── Average Reference Badge & Instruction ── */}
      <View style={styles.topInfoRow}>
        <View style={styles.avgLegend}>
          <View style={[styles.avgDashedLine, { borderColor: colors?.accent ?? '#F59E0B' }]} />
          <Text style={[Typography.caption, { color: labelColor, fontSize: 11 }]}>
            Avg: <Text style={{ fontWeight: '700', color: valueColor }}>{formatCurrency(avg)}</Text>/mo
          </Text>
        </View>
        <Text style={[Typography.caption, { color: colors?.textTertiary ?? '#9AA0A6', fontSize: 11 }]}>
          {isScrollable ? 'Swipe ⇄ to see all months' : 'Tap any bar to inspect'}
        </Text>
      </View>

      {/* ── Bars Container ── */}
      <View style={[styles.chartArea, { height: height + 28 }]}>
        {/* Horizontal Average Reference Line */}
        {avg > 0 && max > 0 && (
          <View
            pointerEvents="none"
            style={[
              styles.referenceLine,
              {
                bottom: avgLineBottom + 22,
                borderColor: (colors?.accent ?? '#F59E0B') + '70',
              },
            ]}
          />
        )}

        {isScrollable ? (
          <ScrollView
            ref={scrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={[styles.barsRow, { height }]}>
              {data.map((item, i) => renderBarItem(item, i))}
            </View>
          </ScrollView>
        ) : (
          <View style={[styles.barsRow, { height, width: '100%' }]}>
            {data.map((item, i) => renderBarItem(item, i))}
          </View>
        )}
      </View>

      {/* ── Mobile-Optimized Month Inspector Card ── */}
      {selectedItem && (
        <View
          style={[
            styles.inspectorCard,
            {
              backgroundColor: colors?.background ?? '#F8F9FC',
              borderColor: colors?.border ?? '#E0E3E8',
            },
          ]}
        >
          {/* Header Row */}
          <View style={styles.inspectorHeader}>
            <View style={{ flex: 1, paddingRight: Spacing.sm }}>
              <Text style={[Typography.body, { color: colors?.text ?? '#1A1C1E', fontWeight: '800' }]}>
                📅 {selectedItem.fullLabel ?? selectedItem.label} Spend
              </Text>
              <Text style={[Typography.caption, { color: colors?.textSecondary ?? '#5F6368', marginTop: 2 }]}>
                {selectedItem.value >= avg
                  ? `▲ ${formatCurrency(selectedItem.value - avg)} above average`
                  : `▼ ${formatCurrency(avg - selectedItem.value)} below average`}
              </Text>
            </View>
            <Text style={[Typography.statMedium, { color: colors?.primary ?? barColor, fontWeight: '800' }]}>
              {formatCurrency(selectedItem.value)}
            </Text>
          </View>

          {/* Clean, Full-Width Stacked Category Breakdown */}
          {selectedItem.value > 0 ? (
            <View style={styles.categoryStack}>
              {/* Fuel & Charging */}
              {selectedItem.fuel !== undefined && selectedItem.fuel > 0 && (
                <View style={styles.categoryRow}>
                  <View style={styles.categoryHeader}>
                    <View style={styles.categoryTitleGroup}>
                      <Text style={{ fontSize: 13 }}>⚡/⛽</Text>
                      <Text style={[Typography.caption, { color: colors?.text ?? '#1A1C1E', fontWeight: '700' }]}>
                        Fuel & Energy
                      </Text>
                      <View style={[styles.percentBadge, { backgroundColor: (colors?.primary ?? '#1A73E8') + '18' }]}>
                        <Text style={[styles.percentBadgeText, { color: colors?.primary ?? '#1A73E8' }]}>
                          {Math.round((selectedItem.fuel / selectedItem.value) * 100)}%
                        </Text>
                      </View>
                    </View>
                    <Text style={[Typography.bodySmall, { color: colors?.primary ?? '#1A73E8', fontWeight: '800' }]}>
                      {formatCurrency(selectedItem.fuel)}
                    </Text>
                  </View>
                  <View style={[styles.microTrack, { backgroundColor: (colors?.borderLight ?? '#F0F2F5') }]}>
                    <View
                      style={[
                        styles.microFill,
                        {
                          width: `${Math.min(100, (selectedItem.fuel / selectedItem.value) * 100)}%`,
                          backgroundColor: colors?.primary ?? '#1A73E8',
                        },
                      ]}
                    />
                  </View>
                </View>
              )}

              {/* Service & Maintenance */}
              {selectedItem.service !== undefined && selectedItem.service > 0 && (
                <View style={styles.categoryRow}>
                  <View style={styles.categoryHeader}>
                    <View style={styles.categoryTitleGroup}>
                      <Text style={{ fontSize: 13 }}>🔧</Text>
                      <Text style={[Typography.caption, { color: colors?.text ?? '#1A1C1E', fontWeight: '700' }]}>
                        Service & Parts
                      </Text>
                      <View style={[styles.percentBadge, { backgroundColor: (colors?.warning ?? '#F59E0B') + '18' }]}>
                        <Text style={[styles.percentBadgeText, { color: '#B45309' }]}>
                          {Math.round((selectedItem.service / selectedItem.value) * 100)}%
                        </Text>
                      </View>
                    </View>
                    <Text style={[Typography.bodySmall, { color: '#B45309', fontWeight: '800' }]}>
                      {formatCurrency(selectedItem.service)}
                    </Text>
                  </View>
                  <View style={[styles.microTrack, { backgroundColor: (colors?.borderLight ?? '#F0F2F5') }]}>
                    <View
                      style={[
                        styles.microFill,
                        {
                          width: `${Math.min(100, (selectedItem.service / selectedItem.value) * 100)}%`,
                          backgroundColor: colors?.accent ?? '#F59E0B',
                        },
                      ]}
                    />
                  </View>
                </View>
              )}

              {/* Other Running Costs */}
              {selectedItem.expense !== undefined && selectedItem.expense > 0 && (
                <View style={styles.categoryRow}>
                  <View style={styles.categoryHeader}>
                    <View style={styles.categoryTitleGroup}>
                      <Text style={{ fontSize: 13 }}>📄</Text>
                      <Text style={[Typography.caption, { color: colors?.text ?? '#1A1C1E', fontWeight: '700' }]}>
                        Running Costs & Bills
                      </Text>
                      <View style={[styles.percentBadge, { backgroundColor: (colors?.textSecondary ?? '#5F6368') + '18' }]}>
                        <Text style={[styles.percentBadgeText, { color: colors?.textSecondary ?? '#5F6368' }]}>
                          {Math.round((selectedItem.expense / selectedItem.value) * 100)}%
                        </Text>
                      </View>
                    </View>
                    <Text style={[Typography.bodySmall, { color: colors?.text ?? '#1A1C1E', fontWeight: '800' }]}>
                      {formatCurrency(selectedItem.expense)}
                    </Text>
                  </View>
                  <View style={[styles.microTrack, { backgroundColor: (colors?.borderLight ?? '#F0F2F5') }]}>
                    <View
                      style={[
                        styles.microFill,
                        {
                          width: `${Math.min(100, (selectedItem.expense / selectedItem.value) * 100)}%`,
                          backgroundColor: colors?.textSecondary ?? '#5F6368',
                        },
                      ]}
                    />
                  </View>
                </View>
              )}
            </View>
          ) : (
            <Text style={[Typography.caption, { color: colors?.textTertiary ?? '#9AA0A6', marginTop: Spacing.xs, fontStyle: 'italic' }]}>
              No expenses recorded for this billing cycle.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  topInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    flexWrap: 'wrap',
    gap: 4,
  },
  avgLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avgDashedLine: {
    width: 14,
    height: 0,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  chartArea: {
    position: 'relative',
    justifyContent: 'flex-end',
  },
  referenceLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    zIndex: 1,
  },
  scrollContent: {
    paddingHorizontal: 4,
    alignItems: 'flex-end',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 2,
  },
  valueContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 22,
  },
  barValue: {
    fontSize: 9,
    marginBottom: 2,
    textAlign: 'center',
  },
  barTrack: {
    width: 26,
    borderRadius: Sizing.radiusFull,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barFill: {
    width: '100%',
    borderRadius: Sizing.radiusFull,
  },
  labelWrapper: {
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  label: {
    fontSize: 10,
    textAlign: 'center',
  },
  inspectorCard: {
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  inspectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryStack: {
    marginTop: Spacing.md,
    gap: 10,
  },
  categoryRow: {
    width: '100%',
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  categoryTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  percentBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  percentBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  microTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    width: '100%',
  },
  microFill: {
    height: '100%',
    borderRadius: 2,
  },
});
