/**
 * StatisticsScreen Component
 *
 * Section 6: Statistics Screen
 * Dedicated Quick Numbers analytical screen:
 * - Scoped strictly and visibly to: Last 6 Months (180 Days)
 * - 6 Exact Metrics:
 *   1. Total fuel / energy consumed (L, kg, or kWh; separated for dual-fuel)
 *   2. Average cost per fill or charge
 *   3. Services logged count
 *   4. Total service cost
 *   5. Distance tracked (odometer-based)
 *   6. Operating cost per kilometre
 * - Explicit disclaimers:
 *   - Scope: Recorded fuel, service & general expenses only (excludes purchase, depreciation & financing)
 *   - GPS Separation: Distance is odometer-based from recorded logbook entries, strictly separated from GPS trip logs
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Spacing, Typography, Sizing } from '@/constants/theme';
import { formatCurrency } from '@/utils/format';
import type { InsightsPalette } from '../insightsTheme';
import type { SixMonthStatistics } from '../insightsHelpers';

interface StatisticsScreenProps {
  stats: SixMonthStatistics;
  isEV: boolean;
  colors: InsightsPalette;
}

export const StatisticsScreen: React.FC<StatisticsScreenProps> = ({
  stats,
  isEV,
  colors,
}) => {
  return (
    <View style={styles.container}>
      {/* ── Time Scope Header Ribbon ── */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.scopeHeaderRow}>
          <View style={styles.scopeTitleCol}>
            <View style={styles.badgeRow}>
              <View style={[styles.scopeBadge, { backgroundColor: colors.accent + '20' }]}>
                <Text style={[styles.scopeBadgeText, { color: colors.accent }]}>FIXED 6-MONTH SCOPE</Text>
              </View>
            </View>
            <Text style={[Typography.h3, { color: colors.text, fontWeight: '800' }]}>
              Quick Numbers
            </Text>
            <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 1 }]}>
              {stats.dateRangeLabel} · Odometer-based metrics
            </Text>
          </View>
        </View>

        {/* ── Metric 1: Total Fuel / Energy Consumed ── */}
        <View style={[styles.metricRow, { borderBottomColor: colors.borderLight }]}>
          <View style={styles.metricLabelCol}>
            <Text style={[Typography.body, { color: colors.text, fontWeight: '700' }]}>
              1. Total {isEV ? 'Energy Consumed' : 'Fuel Consumed'}
            </Text>
            <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 1 }]}>
              {stats.consumption.isDualFuel
                ? 'Separated by primary and secondary tanks'
                : `Logged consumption in ${stats.consumption.defaultUnit}`}
            </Text>
          </View>

          <View style={styles.metricValCol}>
            {stats.consumption.isDualFuel ? (
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[Typography.body, { color: colors.text, fontWeight: '800' }]}>
                  {stats.consumption.primaryAmount.toFixed(1)} {stats.consumption.primaryUnit} (Primary)
                </Text>
                <Text style={[Typography.caption, { color: colors.tierOrange, fontWeight: '700', marginTop: 2 }]}>
                  {stats.consumption.secondaryAmount.toFixed(1)} {stats.consumption.secondaryUnit} (Secondary)
                </Text>
              </View>
            ) : (
              <Text style={[Typography.body, { color: colors.text, fontWeight: '800' }]}>
                {stats.consumption.totalQuantity.toFixed(1)} {stats.consumption.defaultUnit}
              </Text>
            )}
          </View>
        </View>

        {/* ── Metric 2: Average Cost Per Fill / Charge ── */}
        <View style={[styles.metricRow, { borderBottomColor: colors.borderLight }]}>
          <View style={styles.metricLabelCol}>
            <Text style={[Typography.body, { color: colors.text, fontWeight: '700' }]}>
              2. {isEV ? 'Avg Cost per Charge' : 'Avg Cost per Fill'}
            </Text>
            <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 1 }]}>
              Across {stats.fillCount} recorded {isEV ? 'charging sessions' : 'fill-ups'}
            </Text>
          </View>
          <Text style={[Typography.body, { color: colors.text, fontWeight: '800' }]}>
            {stats.avgCostPerFill != null ? formatCurrency(stats.avgCostPerFill) : '—'}
          </Text>
        </View>

        {/* ── Metric 3: Services Logged ── */}
        <View style={[styles.metricRow, { borderBottomColor: colors.borderLight }]}>
          <View style={styles.metricLabelCol}>
            <Text style={[Typography.body, { color: colors.text, fontWeight: '700' }]}>
              3. Services Logged
            </Text>
            <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 1 }]}>
              Maintenance, repairs & component jobs
            </Text>
          </View>
          <Text style={[Typography.body, { color: colors.text, fontWeight: '800' }]}>
            {stats.servicesLogged}
          </Text>
        </View>

        {/* ── Metric 4: Total Service Cost ── */}
        <View style={[styles.metricRow, { borderBottomColor: colors.borderLight }]}>
          <View style={styles.metricLabelCol}>
            <Text style={[Typography.body, { color: colors.text, fontWeight: '700' }]}>
              4. Total Service Cost
            </Text>
            <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 1 }]}>
              Parts, lubricants & workshop labor
            </Text>
          </View>
          <Text style={[Typography.body, { color: colors.text, fontWeight: '800' }]}>
            {formatCurrency(stats.totalServiceCost)}
          </Text>
        </View>

        {/* ── Metric 5: Distance Tracked ── */}
        <View style={[styles.metricRow, { borderBottomColor: colors.borderLight }]}>
          <View style={styles.metricLabelCol}>
            <Text style={[Typography.body, { color: colors.text, fontWeight: '700' }]}>
              5. Distance Tracked
            </Text>
            <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 1 }]}>
              Odometer delta over 6-month entries
            </Text>
          </View>
          <Text style={[Typography.body, { color: colors.text, fontWeight: '800' }]}>
            {stats.kmTracked > 0 ? `${stats.kmTracked.toLocaleString('en-IN')} km` : '—'}
          </Text>
        </View>

        {/* ── Metric 6: Operating Cost Per Kilometre ── */}
        <View style={[styles.metricRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
          <View style={styles.metricLabelCol}>
            <Text style={[Typography.body, { color: colors.accent, fontWeight: '800' }]}>
              6. Operating Cost per km
            </Text>
            <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 1 }]}>
              Fuel + service + general expenses
            </Text>
          </View>
          <Text style={[Typography.body, { color: colors.accent, fontWeight: '800', fontSize: 16 }]}>
            {stats.costPerKm != null ? `${formatCurrency(stats.costPerKm)}/km` : '—'}
          </Text>
        </View>
      </View>

      {/* ── Architectural Calculation & GPS Distance Disclaimers ── */}
      <View style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight }]}>
        <Text style={[Typography.caption, { color: colors.textSecondary, lineHeight: 18 }]}>
          📌 <Text style={{ fontWeight: '800', color: colors.text }}>Scope Definition:</Text>{' '}
          Operating cost includes strictly recorded fuel, scheduled maintenance, and general operating expenses. It excludes vehicle purchase price, depreciation, and financing costs.
        </Text>

        <Text style={[Typography.caption, { color: colors.textSecondary, lineHeight: 18, marginTop: Spacing.sm }]}>
          🧭 <Text style={{ fontWeight: '800', color: colors.text }}>GPS Distance Separation:</Text>{' '}
          Distance tracked in Statistics is computed from odometer intervals on recorded logbook entries. In compliance with core architecture, GPS trip logs are maintained as a separate telematics stream and never conflated with odometer amortization.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  card: {
    borderRadius: Sizing.radiusMd,
    padding: Spacing.md,
    borderWidth: 1,
  },
  scopeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  scopeTitleCol: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  scopeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Sizing.radiusFull,
  },
  scopeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  metricLabelCol: {
    flex: 1,
    paddingRight: Spacing.md,
  },
  metricValCol: {
    alignItems: 'flex-end',
  },
});

