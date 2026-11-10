/**
 * InsightsOverview Component
 *
 * Section 3A: Insights Overview
 * Compact, informative entry point answering:
 * 1. How much has the vehicle cost to operate?
 * 2. How efficiently is it running?
 * 3. Where can the user explore more detailed information?
 *
 * Provides visually distinct navigation cards into:
 * - Spending
 * - Efficiency
 * - Statistics
 * - Fleet Comparison (when 2+ vehicles exist)
 */

import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, Typography, Sizing } from '@/constants/theme';
import { formatCurrency, formatMileage } from '@/utils/format';
import { FuelType, MILEAGE_UNIT_LABELS, isElectricFuel } from '@/constants/fuelTypes';
import { CngTankIcon } from '@/components/CngTankIcon';
import type { StatsTimeRange } from '@/utils/insightsHelpers';
import type { InsightsPalette } from './insightsTheme';
import type { InsightsSection } from './insightsHelpers';
import type { Vehicle } from '@/types/vehicle';
import type { VehicleSummary } from '@/hooks/useCrossVehicleStats';

interface InsightsOverviewProps {
  vehicle: Vehicle;
  vehiclesCount: number;
  timeRange: StatsTimeRange;
  onTimeRangeChange: (range: StatsTimeRange) => void;
  totalOwnershipCost: number;
  totalFuelCost: number;
  totalServiceCost: number;
  totalExpenseCost: number;
  monthlyAverageCost: number;
  costPerKm: number | null;
  kmTracked: number;
  avgMileageText: string;
  bestMileageText: string | null;
  fuelPercentage: number;
  nonFuelPercentage: number;
  totalEntriesCount: number;
  crossVehicleData: VehicleSummary[] | null;
  onNavigate: (section: InsightsSection) => void;
  colors: InsightsPalette;
}

export const InsightsOverview: React.FC<InsightsOverviewProps> = memo(({
  vehicle,
  vehiclesCount,
  timeRange,
  onTimeRangeChange,
  totalOwnershipCost,
  totalFuelCost,
  totalServiceCost,
  totalExpenseCost,
  monthlyAverageCost,
  costPerKm,
  kmTracked,
  avgMileageText,
  bestMileageText,
  fuelPercentage,
  nonFuelPercentage,
  totalEntriesCount,
  crossVehicleData,
  onNavigate,
  colors,
}) => {
  const isEV = isElectricFuel(vehicle.fuel_type as FuelType);
  const isCNG = vehicle.fuel_type === FuelType.CNG;

  const timeRangeLabel =
    timeRange === 'month'
      ? 'This Month'
      : timeRange === '6m'
        ? 'Last 6 Months'
        : timeRange === 'year'
          ? 'Last 12 Months'
          : 'All Time';

  const fuelPct = totalOwnershipCost > 0 ? Math.round((totalFuelCost / totalOwnershipCost) * 100) : 0;
  const servicePct = totalOwnershipCost > 0 ? Math.round((totalServiceCost / totalOwnershipCost) * 100) : 0;
  const expensePct = totalOwnershipCost > 0 ? Math.max(0, 100 - fuelPct - servicePct) : 0;

  return (
    <View style={styles.container}>
      {/* ── Overview Section Heading ── */}
      <View style={styles.overviewHeaderRow}>
        <View style={styles.overviewTitleCol}>
          <Text style={[styles.overviewTitle, { color: colors.text }]}>Overview</Text>
          <Text style={[styles.overviewSubtitle, { color: colors.textTertiary }]}>
            Vehicle running costs & efficiency summary
          </Text>
        </View>
      </View>

      {/* ── Universal Time Range Selector ── */}
      <View style={[styles.timeFilterContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {(
          [
            { id: 'month', label: 'This Month' },
            { id: '6m', label: '6 Months' },
            { id: 'year', label: '1 Year' },
            { id: 'all', label: 'All Time' },
          ] as const
        ).map((tab) => {
          const isActive = timeRange === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.timeFilterBtn,
                isActive && { backgroundColor: colors.accent },
              ]}
              onPress={() => onTimeRangeChange(tab.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  Typography.caption,
                  {
                    color: isActive ? '#FFFFFF' : colors.textSecondary,
                    fontWeight: isActive ? '800' : '600',
                    fontSize: 12,
                  },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Recorded Running Cost (Hero Card) ── */}
      <LinearGradient
        colors={
          colors.isDark
            ? ['#14253D', '#0F1E33', '#0B1728']
            : ['#183B63', '#133256', '#0F2847']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.heroCard,
          {
            borderColor: colors.isDark ? 'rgba(79, 160, 232, 0.22)' : 'rgba(24, 59, 99, 0.12)',
            shadowColor: colors.isDark ? '#000000' : colors.primary,
          },
        ]}
      >
        <View style={styles.heroHeaderRow}>
          <Text style={[styles.heroLabel, { color: 'rgba(255,255,255,0.78)' }]}>
            Recorded Running Cost
          </Text>
          <View style={styles.heroFilterBadge}>
            <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
              {timeRangeLabel}
            </Text>
          </View>
        </View>

        <Text style={[styles.heroTotal, { color: '#FFFFFF' }]}>
          {formatCurrency(totalOwnershipCost)}
        </Text>

        <Text style={[styles.heroExcludesNotice, { color: 'rgba(255,255,255,0.68)' }]}>
          Excludes vehicle purchase, financing & depreciation
        </Text>

        {/* Data-Driven Proportion Segmented Bar */}
        <View style={styles.ratioBarTrack}>
          {totalOwnershipCost > 0 ? (
            <>
              {totalFuelCost > 0 && (
                <View
                  style={[
                    styles.ratioSegment,
                    {
                      flex: totalFuelCost,
                      backgroundColor: '#38BDF8',
                    },
                  ]}
                />
              )}
              {totalServiceCost > 0 && (
                <View
                  style={[
                    styles.ratioSegment,
                    {
                      flex: totalServiceCost,
                      backgroundColor: '#34D399',
                    },
                  ]}
                />
              )}
              {totalExpenseCost > 0 && (
                <View
                  style={[
                    styles.ratioSegment,
                    {
                      flex: totalExpenseCost,
                      backgroundColor: '#A78BFA',
                    },
                  ]}
                />
              )}
            </>
          ) : (
            <View style={[styles.ratioSegment, { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.12)' }]} />
          )}
        </View>

        {/* Breakdown Pills with Category Dots & Percentages */}
        <View style={styles.heroBreakdown}>
          <View style={[styles.heroBreakdownPill, { flexDirection: 'row', alignItems: 'center', gap: 5 }]}>
            <View style={[styles.pillColorDot, { backgroundColor: '#38BDF8' }]} />
            {isEV ? (
              <Text style={{ fontSize: 11 }}>⚡</Text>
            ) : isCNG ? (
              <CngTankIcon size={12} color="#FFFFFF" showLabel={false} />
            ) : (
              <Text style={{ fontSize: 11 }}>⛽</Text>
            )}
            <Text style={[styles.heroPillText, { color: 'rgba(255,255,255,0.95)' }]}>
              {formatCurrency(totalFuelCost)}
            </Text>
            {totalOwnershipCost > 0 && totalFuelCost > 0 && (
              <Text style={styles.heroPillPct}>{fuelPct}%</Text>
            )}
          </View>

          <View style={[styles.heroBreakdownPill, { flexDirection: 'row', alignItems: 'center', gap: 5 }]}>
            <View style={[styles.pillColorDot, { backgroundColor: '#34D399' }]} />
            <Text style={{ fontSize: 11 }}>🔧</Text>
            <Text style={[styles.heroPillText, { color: 'rgba(255,255,255,0.95)' }]}>
              {formatCurrency(totalServiceCost)}
            </Text>
            {totalOwnershipCost > 0 && totalServiceCost > 0 && (
              <Text style={styles.heroPillPct}>{servicePct}%</Text>
            )}
          </View>

          <View style={[styles.heroBreakdownPill, { flexDirection: 'row', alignItems: 'center', gap: 5 }]}>
            <View style={[styles.pillColorDot, { backgroundColor: '#A78BFA' }]} />
            <Text style={{ fontSize: 11 }}>💰</Text>
            <Text style={[styles.heroPillText, { color: 'rgba(255,255,255,0.95)' }]}>
              {formatCurrency(totalExpenseCost)}
            </Text>
            {totalOwnershipCost > 0 && totalExpenseCost > 0 && (
              <Text style={styles.heroPillPct}>{expensePct}%</Text>
            )}
          </View>
        </View>
      </LinearGradient>

      {/* ── Key Metrics Grid ── */}
      <View style={styles.grid}>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          <Text style={[styles.cardLabel, { color: colors.textTertiary }]}>
            {isEV ? 'Avg Efficiency' : 'Avg Mileage'}
          </Text>
          <Text
            style={[styles.kpiValue, { color: colors.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {avgMileageText || '—'}
          </Text>
          <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: 2, fontSize: 11 }]}>
            {bestMileageText ? `Best: ${bestMileageText}` : 'Verified full tanks'}
          </Text>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          <Text style={[styles.cardLabel, { color: colors.textTertiary }]}>
            Operating Cost / km
          </Text>
          <Text
            style={[styles.kpiValue, { color: colors.accent }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {costPerKm != null ? `${formatCurrency(costPerKm)}/km` : '—'}
          </Text>
          <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: 2, fontSize: 11 }]}>
            {kmTracked > 0 ? `${kmTracked.toLocaleString('en-IN')} km tracked` : 'Track fill-ups to calculate'}
          </Text>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          <Text style={[styles.cardLabel, { color: colors.textTertiary }]}>
            Monthly Average
          </Text>
          <Text
            style={[styles.kpiValue, { color: colors.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatCurrency(monthlyAverageCost)}
            <Text style={{ fontSize: 11, fontWeight: '500', color: colors.textTertiary }}>/mo</Text>
          </Text>
          <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: 2, fontSize: 11 }]}>
            {timeRangeLabel} baseline
          </Text>
        </View>

        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          <Text style={[styles.cardLabel, { color: colors.textTertiary }]}>
            {isEV ? 'Charging Cost' : 'Fuel Cost'}
          </Text>
          <Text
            style={[styles.kpiValue, { color: colors.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatCurrency(totalFuelCost)}
          </Text>
          <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: 2, fontSize: 11 }]}>
            {totalEntriesCount} {isEV ? 'charges' : 'fill-ups'} logged
          </Text>
        </View>
      </View>

      {/* ── Divider between Overview and Insight Categories ── */}
      <View style={[styles.categoryDivider, { backgroundColor: colors.divider }]} />

      {/* ── Analytical Screen Navigation Section (Insight Categories) ── */}
      <View style={styles.sectionHeader}>
        <Text style={[Typography.h3, { color: colors.text, fontWeight: '800' }]}>
          Insight Categories
        </Text>
        <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
          Dedicated deep-dive screens for spending, efficiency, stats & garage
        </Text>
      </View>

      {/* Card 1: Spending Analysis */}
      <TouchableOpacity
        style={[styles.navCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        activeOpacity={0.75}
        onPress={() => onNavigate('spending')}
      >
        <View style={styles.navCardHeader}>
          <View style={[styles.navIconBox, { backgroundColor: colors.accent + '15' }]}>
            <Text style={{ fontSize: 20 }}>💳</Text>
          </View>
          <View style={styles.navCardTitleCol}>
            <Text style={[styles.navCardTitle, { color: colors.text }]}>
              Spending Analysis
            </Text>
            <Text style={[styles.navCardSubtitle, { color: colors.textTertiary }]}>
              Fuel vs non-fuel split, category distribution & monthly spend history
            </Text>
          </View>
          <Text style={[styles.chevron, { color: colors.accent }]}>→</Text>
        </View>

        {/* Micro-preview preview row */}
        <View style={[styles.previewRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight }]}>
          <View style={{ flex: 1 }}>
            <Text style={[Typography.caption, { color: colors.textTertiary, fontSize: 10, fontWeight: '700' }]}>
              SPEND SPLIT
            </Text>
            <Text style={[Typography.bodySmall, { color: colors.text, fontWeight: '700', marginTop: 1 }]}>
              {totalOwnershipCost > 0
                ? `${fuelPercentage.toFixed(0)}% Fuel · ${nonFuelPercentage.toFixed(0)}% Other`
                : 'No expenses recorded'}
            </Text>
          </View>
          <View style={[styles.ctaPill, { backgroundColor: colors.accent + '20' }]}>
            <Text style={[styles.ctaText, { color: colors.accent }]}>View Spending →</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Card 2: Efficiency & Mileage */}
      <TouchableOpacity
        style={[styles.navCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        activeOpacity={0.75}
        onPress={() => onNavigate('efficiency')}
      >
        <View style={styles.navCardHeader}>
          <View style={[styles.navIconBox, { backgroundColor: colors.tierGreen + '15' }]}>
            <Text style={{ fontSize: 20 }}>{isEV ? '⚡' : isCNG ? '🟢' : '⛽'}</Text>
          </View>
          <View style={styles.navCardTitleCol}>
            <Text style={[styles.navCardTitle, { color: colors.text }]}>
              Efficiency & Mileage
            </Text>
            <Text style={[styles.navCardSubtitle, { color: colors.textTertiary }]}>
              Fuel configuration context, trendline curves & rolling average
            </Text>
          </View>
          <Text style={[styles.chevron, { color: colors.accent }]}>→</Text>
        </View>

        <View style={[styles.previewRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight }]}>
          <View style={{ flex: 1 }}>
            <Text style={[Typography.caption, { color: colors.textTertiary, fontSize: 10, fontWeight: '700' }]}>
              RUNNING AVERAGE
            </Text>
            <Text style={[Typography.bodySmall, { color: colors.text, fontWeight: '700', marginTop: 1 }]}>
              {avgMileageText || 'Awaiting full-tank entries'}
            </Text>
          </View>
          <View style={[styles.ctaPill, { backgroundColor: colors.tierGreen + '20' }]}>
            <Text style={[styles.ctaText, { color: colors.tierGreen }]}>View Efficiency →</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Card 3: Vehicle Statistics */}
      <TouchableOpacity
        style={[styles.navCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        activeOpacity={0.75}
        onPress={() => onNavigate('statistics')}
      >
        <View style={styles.navCardHeader}>
          <View style={[styles.navIconBox, { backgroundColor: colors.tierOrange + '15' }]}>
            <Text style={{ fontSize: 20 }}>📊</Text>
          </View>
          <View style={styles.navCardTitleCol}>
            <Text style={[styles.navCardTitle, { color: colors.text }]}>
              Vehicle Statistics
            </Text>
            <Text style={[styles.navCardSubtitle, { color: colors.textTertiary }]}>
              Last 6 months operating numbers, amortization & consumption
            </Text>
          </View>
          <Text style={[styles.chevron, { color: colors.accent }]}>→</Text>
        </View>

        <View style={[styles.previewRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight }]}>
          <View style={{ flex: 1 }}>
            <Text style={[Typography.caption, { color: colors.textTertiary, fontSize: 10, fontWeight: '700' }]}>
              SCOPE: 6 MONTHS
            </Text>
            <Text style={[Typography.bodySmall, { color: colors.text, fontWeight: '700', marginTop: 1 }]}>
              {costPerKm != null ? `${formatCurrency(costPerKm)}/km` : 'Amortization metrics'}
            </Text>
          </View>
          <View style={[styles.ctaPill, { backgroundColor: colors.tierOrange + '20' }]}>
            <Text style={[styles.ctaText, { color: colors.tierOrange }]}>View Statistics →</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Card 4: Garage Comparison (Conditional on 2+ vehicles) */}
      {vehiclesCount >= 2 && (
        <TouchableOpacity
          style={[styles.navCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          activeOpacity={0.75}
          onPress={() => onNavigate('fleet')}
        >
          <View style={styles.navCardHeader}>
            <View style={[styles.navIconBox, { backgroundColor: colors.accentDark + '15' }]}>
              <Text style={{ fontSize: 20 }}>🚗</Text>
            </View>
            <View style={styles.navCardTitleCol}>
              <Text style={[styles.navCardTitle, { color: colors.text }]}>
                Garage Comparison
              </Text>
              <Text style={[styles.navCardSubtitle, { color: colors.textTertiary }]}>
                Compare running costs and fuel economy across your {vehiclesCount} vehicles
              </Text>
            </View>
            <Text style={[styles.chevron, { color: colors.accent }]}>→</Text>
          </View>

          <View style={[styles.previewRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight }]}>
            <View style={{ flex: 1 }}>
              <Text style={[Typography.caption, { color: colors.textTertiary, fontSize: 10, fontWeight: '700' }]}>
                ALL VEHICLES
              </Text>
              <Text style={[Typography.bodySmall, { color: colors.text, fontWeight: '700', marginTop: 1 }]}>
                {crossVehicleData ? `${crossVehicleData.length} vehicles recorded` : 'Compare costs & mileage'}
              </Text>
            </View>
            <View style={[styles.ctaPill, { backgroundColor: colors.accentDark + '20' }]}>
              <Text style={[styles.ctaText, { color: colors.accentDark }]}>Compare Vehicles →</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingBottom: Spacing.xl,
  },
  overviewHeaderRow: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  overviewTitleCol: {
    gap: 2,
  },
  overviewTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  overviewSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  timeFilterContainer: {
    flexDirection: 'row',
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    padding: 4,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  timeFilterBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Sizing.radiusSm,
  },
  heroCard: {
    borderRadius: Sizing.radiusLg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroFilterBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  heroTotal: {
    fontSize: 27,
    fontWeight: '800',
    marginTop: 6,
    letterSpacing: -0.6,
  },
  heroExcludesNotice: {
    fontSize: 11,
    marginTop: 2,
  },
  ratioBarTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    flexDirection: 'row',
    overflow: 'hidden',
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    gap: 2,
  },
  ratioSegment: {
    height: '100%',
    borderRadius: 2,
  },
  heroBreakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  heroBreakdownPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Sizing.radiusSm,
  },
  pillColorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  heroPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroPillPct: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.65)',
    marginLeft: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  categoryDivider: {
    height: 1,
    marginHorizontal: -Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  summaryCard: {
    width: '48.5%',
    borderRadius: Sizing.radiusMd,
    padding: Spacing.md,
    borderWidth: 1,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  kpiValue: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sectionHeader: {
    marginBottom: Spacing.md,
  },
  navCard: {
    borderRadius: Sizing.radiusMd,
    padding: Spacing.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  navCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  navIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navCardTitleCol: {
    flex: 1,
  },
  navCardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  navCardSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  chevron: {
    fontSize: 18,
    fontWeight: '800',
    paddingHorizontal: 4,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
  },
  ctaPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Sizing.radiusFull,
  },
  ctaText: {
    fontSize: 11,
    fontWeight: '800',
  },
});

