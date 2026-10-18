/**
 * Stats Screen
 *
 * Comprehensive Visual Analytics & Reporting Dashboard:
 * - Universal Time Range Filter: This Month | 6 Months | 1 Year | All Time
 * - Total Ownership Cost hero card with category badges
 * - 4 Summary KPI cards (Fuel Cost, Fill-ups, Avg Mileage, Best/Worst)
 * - Bi-Fuel Dual-Stream Performance card (for CNG / Hybrid vehicles)
 * - Visual Chart 1: Mileage Evolution & Trendline (bezier curved line chart with
 *   rolling average dashed reference line, above/below average point coding,
 *   and interactive tapped tooltip)
 * - Visual Chart 2: Cost Breakdown Donut Chart (center total expenditure label,
 *   clean categorized legend with percentage and ₹ totals)
 * - Visual Chart 3: Monthly Spend Bar Chart (6M | 12M | Year historical progression)
 * - Quick Numbers / Vehicle Amortization Trajectory (Cost per km, services, total fuel)
 * - Fleet Comparison (when user has 2+ vehicles)
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { VehicleContextHeader } from '@/components/VehicleContextHeader';
import { FuelType, MILEAGE_UNIT_LABELS, getFuelSystemLabel, isElectricFuel, isHybridFuel } from '@/constants/fuelTypes';
import { Sizing, Spacing, Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useExpenseStore } from '@/stores/expenseStore';
import { useFuelStore } from '@/stores/fuelStore';
import { useServiceStore } from '@/stores/serviceStore';
import { useVehicleStore } from '@/stores/vehicleStore';
import { formatCurrency, formatMileage, formatOdometer } from '@/utils/format';
import { buildShareSummary, computeCostPerKm } from '@/utils/shareSummary';
import {
  StatsTimeRange,
  aggregateCostBreakdown,
  filterRecordsByTimeRange,
  getMonthlySpendHistory,
  getMonthlyTotalSpend,
} from '@/utils/statsHelpers';
// serviceRepo and expenseRepo reads are now inside useCrossVehicleStats hook
import { BarChart } from '@/components/charts/BarChart';
import { CostBreakdownDonutChart } from '@/components/charts/CostBreakdownDonutChart';
import { MileagePoint, MileageTrendChart } from '@/components/charts/MileageTrendChart';
import { CngTankIcon } from '@/components/CngTankIcon';
import { ReportExportModal } from '@/components/ReportExportModal';
import { computeMileageStats } from '@/engine/mileageEngine';
import { useCrossVehicleStats } from '@/hooks/useCrossVehicleStats';

// BarChart is now in src/components/charts/BarChart.tsx (imported above)

// ─── Stats Screen Component ─────────────────────────────────────────

export default function StatsScreen() {
  const colors = useThemeColors();

  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);
  const isEV = selectedVehicle ? isElectricFuel(selectedVehicle.fuel_type as FuelType) : false;

  const entries = useFuelStore((s) => s.entries);
  const stats = useFuelStore((s) => s.stats);
  const loadEntries = useFuelStore((s) => s.loadEntries);

  const serviceRecords = useServiceStore((s) => s.records);
  const loadRecords = useServiceStore((s) => s.loadRecords);

  const expenses = useExpenseStore((s) => s.expenses);
  const loadExpenses = useExpenseStore((s) => s.loadExpenses);

  const vehicles = useVehicleStore((s) => s.vehicles);

  // Universal Time Range Filter: 'month' | '6m' | 'year' | 'all'
  const [timeRange, setTimeRange] = useState<StatsTimeRange>('all');

  // Bi-Fuel Mileage Trend Filter (for Hybrid / Dual-fuel vehicles)
  const [biFuelTrendFilter, setBiFuelTrendFilter] = useState<'all' | 'primary' | 'secondary'>('all');

  // Monthly Bar Chart range toggle: 6M | 12M | Year
  const [monthlyChartRange, setMonthlyChartRange] = useState<'6m' | '12m' | 'year'>('6m');

  // Report Export Modal
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  useFocusEffect(
    useCallback(() => {
      if (selectedVehicle) {
        loadEntries(selectedVehicle.id, selectedVehicle.fuel_type as FuelType);
        loadRecords(selectedVehicle.id);
        loadExpenses(selectedVehicle.id);
      }
    }, [selectedVehicle?.id])
  );

  // ── Filtered data sets based on active Time Range Filter ──
  const filteredEntries = useMemo(() => {
    return filterRecordsByTimeRange(entries, (e) => e.date, timeRange);
  }, [entries, timeRange]);

  const filteredServices = useMemo(() => {
    return filterRecordsByTimeRange(serviceRecords, (r) => r.date, timeRange);
  }, [serviceRecords, timeRange]);

  const filteredExpenses = useMemo(() => {
    return filterRecordsByTimeRange(expenses, (e) => e.date, timeRange);
  }, [expenses, timeRange]);

  // ── Aggregated Cost Breakdown for Donut Chart ──
  const costBreakdown = useMemo(() => {
    return aggregateCostBreakdown(filteredEntries, filteredServices, filteredExpenses, isEV);
  }, [filteredEntries, filteredServices, filteredExpenses, isEV]);

  // ── Time-scoped mileage calculation ──
  // NOTE: Must be computed BEFORE any early return to satisfy Rules of Hooks.
  const timeScopedMileageStats = useMemo(() => {
    if (timeRange === 'all') return stats;
    if (filteredEntries.length >= 2) {
      const chronological = [...filteredEntries].reverse();
      return computeMileageStats(chronological);
    }
    return stats;
  }, [timeRange, filteredEntries, stats]);

  // ── Mileage Trend Points for MileageTrendChart ──
  const mileageTrendData = useMemo(() => {
    if (!selectedVehicle) return { points: [] as MileagePoint[], average: null, unitLabel: 'km/L' };

    const isHybrid = isHybridFuel(selectedVehicle.fuel_type as FuelType);
    let candidateEntries = entries.filter((e) => e.calculated_mileage != null);

    // Apply Bi-Fuel system filter if selected
    if (isHybrid && biFuelTrendFilter !== 'all') {
      candidateEntries = candidateEntries.filter(
        (e) => (e.fuel_system ?? (e.fuel_unit === 'kg' ? 'primary' : 'secondary')) === biFuelTrendFilter
      );
    }

    // Apply Time Range if it has at least 2 points; otherwise show recent points
    if (timeRange !== 'all') {
      const timeScoped = filterRecordsByTimeRange(candidateEntries, (e) => e.date, timeRange);
      if (timeScoped.length >= 2) {
        candidateEntries = timeScoped;
      }
    }

    // Newest entries are first in store; take up to 15 newest and reverse for chronological order
    const points: MileagePoint[] = candidateEntries
      .slice(0, 15)
      .reverse()
      .map((e) => {
        const d = new Date(e.date);
        return {
          date: e.date,
          displayDate: `${d.getDate()}/${d.getMonth() + 1}`,
          value: e.calculated_mileage!,
          fuelStation: e.fuel_station,
          fuelSystem: (e.fuel_system ?? (e.fuel_unit === 'kg' ? 'primary' : 'secondary')) as 'primary' | 'secondary',
        };
      });

    // Determine appropriate average reference line
    let average: number | null = null;
    if (isHybrid && biFuelTrendFilter === 'primary' && stats.primarySystemStats?.runningAverage) {
      average = stats.primarySystemStats.runningAverage.value;
    } else if (isHybrid && biFuelTrendFilter === 'secondary' && stats.secondarySystemStats?.runningAverage) {
      average = stats.secondarySystemStats.runningAverage.value;
    } else if (stats.runningAverage) {
      average = stats.runningAverage.value;
    }

    // Determine unit label
    let unitLabel = stats.runningAverage ? MILEAGE_UNIT_LABELS[stats.runningAverage.unit] : 'km/L';
    if (isHybrid) {
      if (biFuelTrendFilter === 'primary') unitLabel = 'km/kg';
      else if (biFuelTrendFilter === 'secondary') unitLabel = 'km/L';
    }

    return { points, average, unitLabel };
  }, [entries, selectedVehicle, biFuelTrendFilter, timeRange, stats]);

  // ── Monthly Spend History Chart Data ──
  const monthlyCostData = useMemo(() => {
    if (!selectedVehicle) return [];
    if (monthlyChartRange === 'year') {
      // Yearly aggregation: sum all 12 months per calendar year for the last 3 years.
      // Uses getMonthlyTotalSpend to avoid duplicating the filter-reduce pattern inline.
      const now = new Date();
      return [0, 1, 2].reverse().map((yearsAgo) => {
        const year = now.getFullYear() - yearsAgo;
        let total = 0;
        for (let m = 0; m < 12; m++) {
          const { total: monthTotal } = getMonthlyTotalSpend(entries, serviceRecords, expenses, m, year);
          total += monthTotal;
        }
        return { label: `${year}`, value: Math.round(total) };
      });
    }
    const months = monthlyChartRange === '12m' ? 12 : 6;
    return getMonthlySpendHistory(entries, serviceRecords, expenses, months);
  }, [monthlyChartRange, entries, serviceRecords, expenses, selectedVehicle]);

  // -- Cross-vehicle comparison --
  // Extracted to useCrossVehicleStats hook to separate data-loading from render.
  const crossVehicleData = useCrossVehicleStats(vehicles);

  if (!selectedVehicle) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 48 }}>📈</Text>
          <Text style={[Typography.h3, { color: colors.text, marginTop: Spacing.lg }]}>
            No vehicle selected
          </Text>
        </View>
      </View>
    );
  }

  // ── Compute scoped stats for active time range ──
  const totalFuelCost = filteredEntries.reduce((sum, e) => sum + e.total_cost, 0);
  const totalServiceCost = filteredServices.reduce((sum, r) => sum + (r.cost || 0), 0);
  const totalExpenseCost = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalOwnershipCost = totalFuelCost + totalServiceCost + totalExpenseCost;
  const totalFuelQuantity = filteredEntries.reduce((sum, e) => sum + e.fuel_amount, 0);
  const totalEntriesCount = filteredEntries.length;

  // timeScopedMileageStats is now computed above the early return (Rules of Hooks compliance).

  // Distance tracked & ₹/km
  const { kmTracked, costPerKm } = computeCostPerKm(
    filteredEntries.map((e) => e.odometer),
    totalOwnershipCost
  );

  // Timeframe label for cards & donut chart center
  const timeRangeLabel =
    timeRange === 'month'
      ? 'This Month'
      : timeRange === '6m'
        ? 'Last 6 Months'
        : timeRange === 'year'
          ? 'Last 12 Months'
          : 'All Time';

  // ── Share summary handler ──
  const handleShare = async () => {
    const unitLabel = timeScopedMileageStats.runningAverage
      ? MILEAGE_UNIT_LABELS[timeScopedMileageStats.runningAverage.unit]
      : null;
    const message = buildShareSummary({
      vehicleName: selectedVehicle.nickname,
      registrationNumber: selectedVehicle.registration_number,
      odometerText: selectedVehicle.current_odometer ? formatOdometer(selectedVehicle.current_odometer) : null,
      fuelCost: totalFuelCost,
      serviceCost: totalServiceCost,
      expenseCost: totalExpenseCost,
      fillUps: totalEntriesCount,
      avgMileageText: timeScopedMileageStats.runningAverage && unitLabel
        ? formatMileage(timeScopedMileageStats.runningAverage.value, unitLabel)
        : null,
      bestMileageText: timeScopedMileageStats.best ? timeScopedMileageStats.best.value.toFixed(1) : null,
      worstMileageText: timeScopedMileageStats.worst ? timeScopedMileageStats.worst.value.toFixed(1) : null,
      kmTracked,
      costPerKm,
      formatMoney: formatCurrency,
    });
    try {
      await Share.share({ message });
    } catch {
      // User dismissed share dialog
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <VehicleContextHeader label="Stats for" />

        {/* ── Title & Share Header ── */}
        <View style={styles.titleRow}>
          <Text style={[Typography.h2, { color: colors.text, flex: 1 }]}>
            {selectedVehicle.nickname} Analytics
          </Text>
          <View style={styles.headerButtonsRow}>
            <TouchableOpacity
              onPress={() => setShowExportModal(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Export vehicle reports"
              style={[styles.exportButton, { borderColor: colors.primary, backgroundColor: colors.primaryLight }]}
            >
              <Text style={[Typography.caption, { color: colors.primary, fontWeight: '700' }]}>
                📄 Export
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleShare}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Share summary"
              style={[styles.shareButton, { borderColor: colors.primary }]}
            >
              <Text style={[Typography.caption, { color: colors.primary, fontWeight: '700' }]}>
                📤 Share
              </Text>
            </TouchableOpacity>
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
                  isActive && { backgroundColor: colors.primary },
                ]}
                onPress={() => setTimeRange(tab.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    Typography.caption,
                    {
                      color: isActive ? '#FFFFFF' : colors.textSecondary,
                      fontWeight: isActive ? '700' : '500',
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

        {/* ── Total Ownership Cost (Hero Card) ── */}
        <View style={[styles.heroCard, { backgroundColor: colors.primary }]}>
          <View style={styles.heroHeaderRow}>
            <Text style={[styles.heroLabel, { color: 'rgba(255,255,255,0.85)' }]}>
              {timeRange === 'all' ? 'Total Ownership Cost' : `${timeRangeLabel} Spend`}
            </Text>
            {timeRange !== 'all' && (
              <View style={styles.heroFilterBadge}>
                <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>
                  {timeRangeLabel}
                </Text>
              </View>
            )}
          </View>
          <Text style={[Typography.stat, { color: '#FFFFFF', marginTop: 2 }]}>
            {formatCurrency(totalOwnershipCost)}
          </Text>
          <View style={styles.heroBreakdown}>
            <View style={styles.heroBreakdownPill}>
              <Text style={[Typography.caption, { color: 'rgba(255,255,255,0.9)', fontWeight: '600' }]}>
                {isEV ? '⚡' : '⛽'} {formatCurrency(totalFuelCost)}
              </Text>
            </View>
            <View style={styles.heroBreakdownPill}>
              <Text style={[Typography.caption, { color: 'rgba(255,255,255,0.9)', fontWeight: '600' }]}>
                🔧 {formatCurrency(totalServiceCost)}
              </Text>
            </View>
            <View style={styles.heroBreakdownPill}>
              <Text style={[Typography.caption, { color: 'rgba(255,255,255,0.9)', fontWeight: '600' }]}>
                💰 {formatCurrency(totalExpenseCost)}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Summary KPI Cards ── */}
        <View style={styles.grid}>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, ...Sizing.cardShadow }]}>
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>{isEV ? 'Charging Cost' : 'Fuel Cost'}</Text>
            <Text style={[Typography.statMedium, { color: colors.text }]}>
              {formatCurrency(totalFuelCost)}
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, ...Sizing.cardShadow }]}>
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>{isEV ? 'Charge Sessions' : 'Fill-ups'}</Text>
            <Text style={[Typography.statMedium, { color: colors.text }]}>
              {totalEntriesCount}
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, ...Sizing.cardShadow }]}>
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>{isEV ? 'Avg Efficiency' : 'Avg Mileage'}</Text>
            <Text style={[Typography.statMedium, { color: colors.text }]}>
              {timeScopedMileageStats.runningAverage
                ? formatMileage(
                  timeScopedMileageStats.runningAverage.value,
                  MILEAGE_UNIT_LABELS[timeScopedMileageStats.runningAverage.unit]
                )
                : '—'}
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, ...Sizing.cardShadow }]}>
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Best / Worst</Text>
            <Text style={[Typography.statMedium, { color: colors.success }]}>
              {timeScopedMileageStats.best ? timeScopedMileageStats.best.value.toFixed(1) : '—'}
            </Text>
            {timeScopedMileageStats.worst && (
              <Text style={[Typography.caption, { color: colors.danger, marginTop: 1 }]}>
                / {timeScopedMileageStats.worst.value.toFixed(1)}
              </Text>
            )}
          </View>
        </View>

        {/* ── Bi-Fuel Dual Stream Breakdown Card (if Hybrid) ── */}
        {selectedVehicle && isHybridFuel(selectedVehicle.fuel_type as FuelType) && (
          <View style={[styles.chartCard, { backgroundColor: colors.surface, ...Sizing.cardShadow, marginBottom: Spacing.lg }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm }}>
              <Text style={[Typography.h3, { color: colors.text }]}>
                Bi-Fuel Performance
              </Text>
              <CngTankIcon size={18} />
              <Text style={{ fontSize: 18 }}>⛽</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm }}>
              <View style={[styles.summaryCard, { flex: 1, backgroundColor: colors.background, padding: Spacing.md }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <CngTankIcon size={14} />
                  <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>
                    {getFuelSystemLabel(selectedVehicle.fuel_type as FuelType, 'primary')}
                  </Text>
                </View>
                <Text style={[Typography.statMedium, { color: colors.primary, marginTop: 4 }]}>
                  {stats.primarySystemStats?.runningAverage
                    ? formatMileage(
                      stats.primarySystemStats.runningAverage.value,
                      MILEAGE_UNIT_LABELS[stats.primarySystemStats.runningAverage.unit]
                    )
                    : '—'}
                </Text>
              </View>
              <View style={[styles.summaryCard, { flex: 1, backgroundColor: colors.background, padding: Spacing.md }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Text style={{ fontSize: 14 }}>⛽</Text>
                  <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>
                    {getFuelSystemLabel(selectedVehicle.fuel_type as FuelType, 'secondary')}
                  </Text>
                </View>
                <Text style={[Typography.statMedium, { color: '#B45309', marginTop: 4 }]}>
                  {stats.secondarySystemStats?.runningAverage
                    ? formatMileage(
                      stats.secondarySystemStats.runningAverage.value,
                      MILEAGE_UNIT_LABELS[stats.secondarySystemStats.runningAverage.unit]
                    )
                    : '—'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Visual Chart 1: Mileage Trend & Evolution ── */}
        <View style={[styles.chartCard, { backgroundColor: colors.surface, ...Sizing.cardShadow }]}>
          <View style={styles.chartHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[Typography.h3, { color: colors.text }]}>
                Mileage Trendline
              </Text>
              <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
                Efficiency curve with rolling average reference line
              </Text>
            </View>

            {/* Bi-Fuel System Filter (if vehicle has two fuel systems) */}
            {selectedVehicle && isHybridFuel(selectedVehicle.fuel_type as FuelType) && (
              <View style={[styles.segmentControl, { borderColor: colors.border }]}>
                {(['all', 'primary', 'secondary'] as const).map((sys) => (
                  <TouchableOpacity
                    key={sys}
                    style={[
                      styles.segmentBtn,
                      biFuelTrendFilter === sys && { backgroundColor: colors.primary },
                    ]}
                    onPress={() => setBiFuelTrendFilter(sys)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        Typography.caption,
                        {
                          color: biFuelTrendFilter === sys ? '#FFF' : colors.textSecondary,
                          fontWeight: '700',
                          fontSize: 10,
                        },
                      ]}
                    >
                      {sys === 'all' ? 'All' : sys === 'primary' ? 'CNG' : 'Petrol'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={{ marginTop: Spacing.md }}>
            <MileageTrendChart
              data={mileageTrendData.points}
              averageMileage={mileageTrendData.average}
              unitLabel={mileageTrendData.unitLabel}
              colors={colors}
              height={160}
            />
          </View>
        </View>

        {/* ── Visual Chart 2: Total Cost Breakdown Donut Chart ── */}
        <View style={[styles.chartCard, { backgroundColor: colors.surface, ...Sizing.cardShadow }]}>
          <View style={{ marginBottom: Spacing.md }}>
            <Text style={[Typography.h3, { color: colors.text }]}>
              Cost Breakdown
            </Text>
            <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
              {timeRangeLabel} spending across {isEV ? 'charging' : 'fuel'}, service & categories
            </Text>
          </View>

          <CostBreakdownDonutChart
            slices={costBreakdown.slices}
            totalCost={costBreakdown.totalCost}
            timeRangeLabel={timeRangeLabel}
            colors={colors}
          />
        </View>

        {/* ── Visual Chart 3: Monthly Spend History ── */}
        {monthlyCostData.some((d) => d.value > 0) && (
          <View style={[styles.chartCard, { backgroundColor: colors.surface, ...Sizing.cardShadow }]}>
            <View style={styles.chartHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[Typography.h3, { color: colors.text }]}>
                  Monthly Total Spend
                </Text>
                <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
                  Fuel + Service + Expenses
                </Text>
              </View>

              {/* Monthly Range toggle */}
              <View style={[styles.segmentControl, { borderColor: colors.border }]}>
                {(['6m', '12m', 'year'] as const).map((range) => (
                  <TouchableOpacity
                    key={range}
                    style={[
                      styles.segmentBtn,
                      monthlyChartRange === range && { backgroundColor: colors.primary },
                    ]}
                    onPress={() => setMonthlyChartRange(range)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        Typography.caption,
                        {
                          color: monthlyChartRange === range ? '#FFF' : colors.textSecondary,
                          fontWeight: '700',
                          fontSize: 11,
                        },
                      ]}
                    >
                      {range === '6m' ? '6M' : range === '12m' ? '12M' : 'Year'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ marginTop: Spacing.lg }}>
              <BarChart
                data={monthlyCostData}
                barColor={colors.accent}
                labelColor={colors.textTertiary}
                valueColor={colors.textSecondary}
                height={monthlyChartRange === 'year' ? 90 : 110}
              />
            </View>
          </View>
        )}

        {/* ── Quick Numbers / Amortization Trajectory ── */}
        <View style={[styles.chartCard, { backgroundColor: colors.surface, ...Sizing.cardShadow }]}>
          <Text style={[Typography.h3, { color: colors.text, marginBottom: Spacing.md }]}>
            Quick Numbers ({timeRangeLabel})
          </Text>

          <View style={[styles.quickRow, { borderBottomColor: colors.border }]}>
            <Text style={[Typography.body, { color: colors.textSecondary }]}>
              {isEV ? 'Total energy consumed' : `Total ${entries[0]?.fuel_unit || 'fuel'} consumed`}
            </Text>
            <Text style={[Typography.body, { color: colors.text, fontWeight: '700' }]}>
              {totalFuelQuantity.toFixed(1)} {isEV ? 'kWh' : (entries[0]?.fuel_unit || 'L')}
            </Text>
          </View>

          <View style={[styles.quickRow, { borderBottomColor: colors.border }]}>
            <Text style={[Typography.body, { color: colors.textSecondary }]}>
              {isEV ? 'Avg cost per charge' : 'Avg cost per fill'}
            </Text>
            <Text style={[Typography.body, { color: colors.text, fontWeight: '700' }]}>
              {totalEntriesCount > 0 ? formatCurrency(totalFuelCost / totalEntriesCount) : '—'}
            </Text>
          </View>

          <View style={[styles.quickRow, { borderBottomColor: colors.border }]}>
            <Text style={[Typography.body, { color: colors.textSecondary }]}>
              Services logged
            </Text>
            <Text style={[Typography.body, { color: colors.text, fontWeight: '700' }]}>
              {filteredServices.length}
            </Text>
          </View>

          <View style={[styles.quickRow, { borderBottomColor: colors.border }]}>
            <Text style={[Typography.body, { color: colors.textSecondary }]}>
              Total service cost
            </Text>
            <Text style={[Typography.body, { color: colors.text, fontWeight: '700' }]}>
              {formatCurrency(totalServiceCost)}
            </Text>
          </View>

          {filteredEntries.length >= 2 && (
            <View style={[styles.quickRow, { borderBottomColor: colors.border }]}>
              <Text style={[Typography.body, { color: colors.textSecondary }]}>
                Distance tracked
              </Text>
              <Text style={[Typography.body, { color: colors.text, fontWeight: '700' }]}>
                {kmTracked.toLocaleString('en-IN')} km
              </Text>
            </View>
          )}

          {costPerKm != null && (
            <View style={[styles.quickRow, { borderBottomColor: colors.border }]}>
              <Text style={[Typography.body, { color: colors.textSecondary }]}>
                Cost per km
              </Text>
              <Text style={[Typography.body, { color: colors.primary, fontWeight: '700' }]}>
                {formatCurrency(costPerKm)}/km
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: Spacing.section }} />

        {/* ── Cross-vehicle Comparison ── */}
        {crossVehicleData && crossVehicleData.length >= 2 && (() => {
          const mileageRows = crossVehicleData.filter((d) => d.avgMileage !== null);
          const costRows = [...crossVehicleData].sort((a, b) => b.totalCost - a.totalCost);
          return (
            <View style={[styles.chartCard, { backgroundColor: colors.surface, ...Sizing.cardShadow }]}>
              <Text style={[Typography.h3, { color: colors.text, marginBottom: Spacing.md }]}>
                🚗 Fleet Comparison
              </Text>

              {mileageRows.length >= 2 && (
                <>
                  <Text style={[Typography.caption, { color: colors.textTertiary, marginBottom: Spacing.sm }]}>
                    Avg mileage per vehicle
                  </Text>
                  <BarChart
                    data={mileageRows.map((d) => ({ label: d.name, value: Number(d.avgMileage!.toFixed(1)) }))}
                    barColor={colors.primary}
                    labelColor={colors.textTertiary}
                    valueColor={colors.textSecondary}
                    height={90}
                  />
                  <View style={{ height: Spacing.lg }} />
                </>
              )}

              <Text style={[Typography.caption, { color: colors.textTertiary, marginBottom: Spacing.sm }]}>
                Total ownership cost
              </Text>
              {costRows.map((d) => (
                <View key={d.id} style={[styles.quickRow, { borderBottomColor: colors.border }]}>
                  <Text style={[Typography.body, { color: colors.textSecondary }]}>{d.name}</Text>
                  <Text style={[Typography.body, { color: colors.text, fontWeight: '700' }]}>
                    {formatCurrency(d.totalCost)}
                  </Text>
                </View>
              ))}
            </View>
          );
        })()}

        <View style={{ height: Spacing.section }} />
      </View>

      {/* ── Vehicle Report Export Modal ── */}
      {selectedVehicle && (
        <ReportExportModal
          visible={showExportModal}
          onClose={() => setShowExportModal(false)}
          vehicle={selectedVehicle}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  headerButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1.5,
  },
  shareButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1.5,
  },
  timeFilterContainer: {
    flexDirection: 'row',
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    padding: 3,
    marginBottom: Spacing.lg,
  },
  timeFilterBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Sizing.radiusSm,
  },
  heroCard: {
    borderRadius: Sizing.radiusLg,
    padding: Spacing.xxl,
    marginBottom: Spacing.xl,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroFilterBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Sizing.radiusFull,
  },
  heroBreakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  heroBreakdownPill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Sizing.radiusSm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginBottom: Spacing.xl },
  summaryCard: {
    width: '47%',
    borderRadius: Sizing.radiusMd,
    padding: Spacing.lg,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  chartCard: {
    borderRadius: Sizing.radiusMd,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  segmentControl: {
    flexDirection: 'row',
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    overflow: 'hidden',
  },
  segmentBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

