/**
 * MonthlySpendCard Component
 *
 * Mobile-first Monthly Total Spend analytics & reporting:
 * - 100% responsive, zero horizontal scrolling
 * - Top KPI strip: Monthly Average, Period Total, Peak Spend
 * - 6M | 12M | Year range selector
 * - Interactive Month Spotlight Hero: Stacked category bar + percentage breakdown
 * - Vertical Month History List: Full-width comparative visual bars & category tags
 * - Single-tap month selection to inspect any month's breakdown
 */

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Typography, Spacing, Sizing } from '@/constants/theme';
import { formatCurrency } from '@/utils/format';
import { getMonthlySpendHistory, getMonthlyTotalSpend } from '@/utils/statsHelpers';
import type { FuelEntry } from '@/types/fuel';
import type { ServiceRecord } from '@/types/service';
import type { VehicleExpense } from '@/types/expense';

interface MonthlySpendCardProps {
  entries: FuelEntry[];
  serviceRecords: ServiceRecord[];
  expenses: VehicleExpense[];
  colors: any;
  isEV?: boolean;
}

type RangeOption = '6m' | '12m' | 'year';

export interface MonthlyItem {
  label: string;     // e.g. "Oct"
  fullLabel: string; // e.g. "October 2026"
  total: number;
  fuel: number;
  service: number;
  expense: number;
  monthIndex?: number;
  year?: number;
}

function formatCompactValue(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return `₹${value}`;
}

export function MonthlySpendCard({
  entries,
  serviceRecords,
  expenses,
  colors,
  isEV = false,
}: MonthlySpendCardProps) {
  const [range, setRange] = useState<RangeOption>('6m');

  // Compute spend items based on range
  const items: MonthlyItem[] = useMemo(() => {
    if (range === 'year') {
      const currentYear = new Date().getFullYear();
      return [currentYear - 2, currentYear - 1, currentYear].map((year) => {
        let total = 0, fuel = 0, service = 0, expense = 0;
        for (let m = 0; m < 12; m++) {
          const spend = getMonthlyTotalSpend(entries, serviceRecords, expenses, m, year);
          total += spend.total;
          fuel += spend.fuel;
          service += spend.service;
          expense += spend.expense;
        }
        return {
          label: `${year}`,
          fullLabel: `Year ${year}`,
          total: Math.round(total),
          fuel: Math.round(fuel),
          service: Math.round(service),
          expense: Math.round(expense),
          year,
        };
      });
    }

    const monthsCount = range === '12m' ? 12 : 6;
    const history = getMonthlySpendHistory(entries, serviceRecords, expenses, monthsCount);
    return history.map((h) => ({
      label: h.label,
      fullLabel: h.fullLabel ?? `${h.label}`,
      total: Math.round(h.value),
      fuel: Math.round(h.fuel),
      service: Math.round(h.service),
      expense: Math.round(h.expense),
      monthIndex: (h as any).month,
      year: (h as any).year,
    }));
  }, [entries, serviceRecords, expenses, range]);

  const hasAnySpend = useMemo(() => items.some((i) => i.total > 0), [items]);

  // Selected item index (defaults to latest month: items.length - 1)
  const [selectedIdx, setSelectedIdx] = useState<number>(0);

  // When range changes, select latest month
  React.useEffect(() => {
    setSelectedIdx(items.length > 0 ? items.length - 1 : 0);
  }, [items.length, range]);

  if (!hasAnySpend && entries.length === 0 && serviceRecords.length === 0 && expenses.length === 0) {
    return null;
  }

  const totalSpend = items.reduce((s, i) => s + i.total, 0);
  const avgSpend   = Math.round(totalSpend / Math.max(items.length, 1));
  const maxSpend   = Math.max(...items.map((i) => i.total), 1);

  let peakItem = items[0] ?? null;
  for (const item of items) {
    if (item.total > (peakItem?.total ?? 0)) peakItem = item;
  }

  const selectedItem = items[selectedIdx] ?? items[items.length - 1] ?? null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, ...Sizing.cardShadow }]}>
      {/* ── Header Row ── */}
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: Spacing.xs }}>
          <Text style={[Typography.h3, { color: colors.text }]}>📅 Monthly Spend</Text>
          <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
            Fuel/Energy · Service · Running Expenses
          </Text>
        </View>

        {/* Range Selector */}
        <View style={[styles.segmentControl, { borderColor: colors.border, backgroundColor: colors.background }]}>
          {(['6m', '12m', 'year'] as const).map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.segmentBtn, range === r && { backgroundColor: colors.primary }]}
              onPress={() => setRange(r)}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentBtnText, { color: range === r ? '#FFF' : colors.textSecondary }]}>
                {r === '6m' ? '6M' : r === '12m' ? '12M' : 'Year'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── KPI Strip ── */}
      <View style={[styles.kpiStrip, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiLabel, { color: colors.textTertiary }]}>AVG / MONTH</Text>
          <Text style={[styles.kpiValue, { color: colors.primary }]}>{formatCurrency(avgSpend)}</Text>
        </View>
        <View style={[styles.kpiDivider, { backgroundColor: colors.border }]} />
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiLabel, { color: colors.textTertiary }]}>PERIOD TOTAL</Text>
          <Text style={[styles.kpiValue, { color: colors.text }]}>{formatCurrency(totalSpend)}</Text>
        </View>
        <View style={[styles.kpiDivider, { backgroundColor: colors.border }]} />
        <View style={styles.kpiItem}>
          <Text style={[styles.kpiLabel, { color: colors.textTertiary }]}>PEAK PERIOD</Text>
          <Text style={[styles.kpiValue, { color: colors.accent }]} numberOfLines={1}>
            {peakItem && peakItem.total > 0 ? `${peakItem.label} · ${formatCompactValue(peakItem.total)}` : '—'}
          </Text>
        </View>
      </View>

      {/* ── Active Month Spotlight (Hero Card) ── */}
      {selectedItem && (
        <View style={[styles.spotlightCard, { backgroundColor: colors.background, borderColor: colors.primary + '55' }]}>
          {/* Top Info */}
          <View style={styles.spotlightTop}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={[Typography.body, { color: colors.text, fontWeight: '800' }]}>
                  📅 {selectedItem.fullLabel}
                </Text>
                {selectedItem.total > 0 && selectedItem.total === peakItem?.total && (
                  <View style={[styles.tag, { backgroundColor: colors.accent + '20' }]}>
                    <Text style={[styles.tagText, { color: colors.accent }]}>👑 Peak Spend</Text>
                  </View>
                )}
                {selectedIdx === items.length - 1 && range !== 'year' && (
                  <View style={[styles.tag, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.tagText, { color: colors.primary }]}>Latest</Text>
                  </View>
                )}
              </View>

              {/* Delta vs monthly average */}
              {selectedItem.total > 0 && avgSpend > 0 ? (
                <Text
                  style={[
                    Typography.caption,
                    {
                      color: selectedItem.total > avgSpend ? colors.accent : colors.success,
                      marginTop: 3,
                      fontWeight: '700',
                      fontSize: 11,
                    },
                  ]}
                >
                  {selectedItem.total > avgSpend
                    ? `▲ ${formatCurrency(selectedItem.total - avgSpend)} (${Math.round(((selectedItem.total - avgSpend) / avgSpend) * 100)}%) above period avg`
                    : selectedItem.total < avgSpend
                    ? `▼ ${formatCurrency(avgSpend - selectedItem.total)} (${Math.round(((avgSpend - selectedItem.total) / avgSpend) * 100)}%) below period avg`
                    : 'Equal to period average'}
                </Text>
              ) : (
                <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 3 }]}>
                  {selectedItem.total === 0 ? 'No expenses recorded in this period' : 'Period baseline'}
                </Text>
              )}
            </View>

            {/* Total Value */}
            <Text style={[styles.spotlightTotal, { color: selectedItem.total > 0 ? colors.primary : colors.textTertiary }]}>
              {selectedItem.total > 0 ? formatCurrency(selectedItem.total) : '₹0'}
            </Text>
          </View>

          {/* Stacked Proportional Bar */}
          {selectedItem.total > 0 && (
            <View style={[styles.stackedTrack, { backgroundColor: colors.borderLight ?? colors.border }]}>
              {selectedItem.fuel > 0 && (
                <View
                  style={[
                    styles.stackedSeg,
                    {
                      flex: selectedItem.fuel,
                      backgroundColor: colors.primary,
                      borderTopLeftRadius: 4,
                      borderBottomLeftRadius: 4,
                    },
                  ]}
                />
              )}
              {selectedItem.service > 0 && (
                <View
                  style={[
                    styles.stackedSeg,
                    {
                      flex: selectedItem.service,
                      backgroundColor: colors.accent,
                    },
                  ]}
                />
              )}
              {selectedItem.expense > 0 && (
                <View
                  style={[
                    styles.stackedSeg,
                    {
                      flex: selectedItem.expense,
                      backgroundColor: colors.textSecondary + '90',
                      borderTopRightRadius: 4,
                      borderBottomRightRadius: 4,
                    },
                  ]}
                />
              )}
            </View>
          )}

          {/* Category Chips */}
          {selectedItem.total > 0 ? (
            <View style={styles.catGrid}>
              {selectedItem.fuel > 0 && (
                <View style={[styles.catBadge, { backgroundColor: colors.surface, borderColor: colors.primary + '40' }]}>
                  <Text style={[styles.catBadgeIcon]}>{isEV ? '⚡' : '⛽'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.catBadgeName, { color: colors.textSecondary }]}>
                      {isEV ? 'Energy/Charge' : 'Fuel'}
                    </Text>
                    <Text style={[styles.catBadgeAmt, { color: colors.primary }]}>
                      {formatCurrency(selectedItem.fuel)}
                    </Text>
                  </View>
                  <Text style={[styles.catBadgePct, { color: colors.textTertiary }]}>
                    {Math.round((selectedItem.fuel / selectedItem.total) * 100)}%
                  </Text>
                </View>
              )}

              {selectedItem.service > 0 && (
                <View style={[styles.catBadge, { backgroundColor: colors.surface, borderColor: colors.accent + '40' }]}>
                  <Text style={[styles.catBadgeIcon]}>🔧</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.catBadgeName, { color: colors.textSecondary }]}>Service</Text>
                    <Text style={[styles.catBadgeAmt, { color: colors.accent }]}>
                      {formatCurrency(selectedItem.service)}
                    </Text>
                  </View>
                  <Text style={[styles.catBadgePct, { color: colors.textTertiary }]}>
                    {Math.round((selectedItem.service / selectedItem.total) * 100)}%
                  </Text>
                </View>
              )}

              {selectedItem.expense > 0 && (
                <View style={[styles.catBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.catBadgeIcon]}>📑</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.catBadgeName, { color: colors.textSecondary }]}>Expenses & Tolls</Text>
                    <Text style={[styles.catBadgeAmt, { color: colors.text }]}>
                      {formatCurrency(selectedItem.expense)}
                    </Text>
                  </View>
                  <Text style={[styles.catBadgePct, { color: colors.textTertiary }]}>
                    {Math.round((selectedItem.expense / selectedItem.total) * 100)}%
                  </Text>
                </View>
              )}
            </View>
          ) : null}
        </View>
      )}

      {/* ── All Months History (Full-Width Vertical Cards, ZERO Horizontal Scrolling) ── */}
      <View style={styles.historySection}>
        <View style={styles.historyHeader}>
          <Text style={[Typography.bodySmall, { color: colors.textSecondary, fontWeight: '700' }]}>
            {range === 'year' ? 'Annual Breakdown' : 'All Months Breakdown'}
          </Text>
          <Text style={[Typography.caption, { color: colors.textTertiary, fontSize: 11 }]}>
            Tap any month to inspect
          </Text>
        </View>

        <View style={styles.monthList}>
          {[...items].reverse().map((item, revIdx) => {
            const originalIdx = items.length - 1 - revIdx;
            const isSelected = selectedIdx === originalIdx;
            const isPeak = item.total > 0 && item.total === peakItem?.total;
            // Proportional width relative to peak spend
            const fillWidth = maxSpend > 0 ? Math.max(item.total > 0 ? 8 : 0, Math.round((item.total / maxSpend) * 100)) : 0;

            return (
              <TouchableOpacity
                key={item.fullLabel + originalIdx}
                onPress={() => setSelectedIdx(originalIdx)}
                activeOpacity={0.75}
                style={[
                  styles.monthRowCard,
                  {
                    backgroundColor: isSelected ? (colors.primaryLight ?? (colors.primary + '14')) : colors.background,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderWidth: isSelected ? 1.5 : 1,
                  },
                ]}
              >
                {/* Row Header: Month Label + Total Amount */}
                <View style={styles.monthRowTop}>
                  <View style={styles.monthRowLeft}>
                    <Text style={[styles.monthRowTitle, { color: colors.text, fontWeight: isSelected ? '800' : '700' }]}>
                      {item.fullLabel}
                    </Text>
                    {isPeak && (
                      <View style={[styles.miniBadge, { backgroundColor: colors.accent + '20' }]}>
                        <Text style={[styles.miniBadgeText, { color: colors.accent }]}>👑 Peak</Text>
                      </View>
                    )}
                    {isSelected && (
                      <View style={[styles.miniBadge, { backgroundColor: colors.primary + '20' }]}>
                        <Text style={[styles.miniBadgeText, { color: colors.primary }]}>Active</Text>
                      </View>
                    )}
                  </View>

                  <Text style={[styles.monthRowTotal, { color: item.total > 0 ? (isSelected ? colors.primary : colors.text) : colors.textTertiary }]}>
                    {item.total > 0 ? formatCurrency(item.total) : '₹0'}
                  </Text>
                </View>

                {/* Relative Spend Visual Fill Bar */}
                <View style={[styles.rowTrack, { backgroundColor: colors.borderLight ?? (colors.border + '50') }]}>
                  {fillWidth > 0 && (
                    <View
                      style={[
                        styles.rowFill,
                        {
                          width: `${fillWidth}%`,
                          backgroundColor: isPeak ? colors.accent : (isSelected ? colors.primary : colors.primary + '99'),
                        },
                      ]}
                    />
                  )}
                </View>

                {/* Sub-line Category Decomposition Tags */}
                {item.total > 0 ? (
                  <View style={styles.tagRow}>
                    {item.fuel > 0 && (
                      <View style={[styles.subTag, { backgroundColor: colors.primary + '15' }]}>
                        <Text style={[styles.subTagText, { color: colors.primary }]}>
                          {isEV ? '⚡' : '⛽'} {formatCompactValue(item.fuel)} ({Math.round((item.fuel / item.total) * 100)}%)
                        </Text>
                      </View>
                    )}
                    {item.service > 0 && (
                      <View style={[styles.subTag, { backgroundColor: colors.accent + '15' }]}>
                        <Text style={[styles.subTagText, { color: colors.accent }]}>
                          🔧 {formatCompactValue(item.service)} ({Math.round((item.service / item.total) * 100)}%)
                        </Text>
                      </View>
                    )}
                    {item.expense > 0 && (
                      <View style={[styles.subTag, { backgroundColor: colors.border }]}>
                        <Text style={[styles.subTagText, { color: colors.textSecondary }]}>
                          📑 {formatCompactValue(item.expense)} ({Math.round((item.expense / item.total) * 100)}%)
                        </Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <Text style={[Typography.caption, { color: colors.textTertiary, fontSize: 11 }]}>
                    No expenses logged
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Sizing.radiusMd,
    padding: Spacing.lg,
    width: '100%',
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  segmentControl: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: Sizing.radiusSm,
    padding: 2,
    alignSelf: 'flex-start',
  },
  segmentBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Sizing.radiusSm - 2,
  },
  segmentBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  kpiStrip: {
    flexDirection: 'row',
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  kpiItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  kpiDivider: {
    width: 1,
    height: 24,
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  spotlightCard: {
    borderRadius: Sizing.radiusSm,
    borderWidth: 1.5,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  spotlightTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  spotlightTotal: {
    fontSize: 22,
    fontWeight: '900',
  },
  tag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: Sizing.radiusFull,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '800',
  },
  stackedTrack: {
    height: 8,
    borderRadius: 4,
    flexDirection: 'row',
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  stackedSeg: {
    height: '100%',
  },
  catGrid: {
    gap: 6,
    marginTop: 4,
  },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    gap: 8,
  },
  catBadgeIcon: {
    fontSize: 14,
  },
  catBadgeName: {
    fontSize: 11,
    fontWeight: '600',
  },
  catBadgeAmt: {
    fontSize: 13,
    fontWeight: '800',
  },
  catBadgePct: {
    fontSize: 11,
    fontWeight: '700',
  },
  historySection: {
    marginTop: Spacing.xs,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  monthList: {
    gap: 8,
  },
  monthRowCard: {
    borderRadius: Sizing.radiusSm,
    padding: Spacing.sm + 2,
  },
  monthRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  monthRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    flex: 1,
  },
  monthRowTitle: {
    fontSize: 13,
  },
  monthRowTotal: {
    fontSize: 15,
    fontWeight: '800',
  },
  miniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  miniBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  rowTrack: {
    height: 5,
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
    marginBottom: 6,
  },
  rowFill: {
    height: '100%',
    borderRadius: 3,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  subTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  subTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
