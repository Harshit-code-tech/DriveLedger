/**
 * Insights Tab / Screen
 *
 * Section 3: Phase 2 — New Insights Information Architecture
 * - Insights Overview: Compact, high-level operational overview
 * - 4 Dedicated Analytical Screens (lazy/conditional rendering):
 *   1. Spending Analysis (Fuel vs non-fuel, ₹100 insight, Donut chart, Monthly spend)
 *   2. Efficiency & Mileage (Fuel config context, trendline curves, partial-fill handling, dual-fuel performance)
 *   3. Vehicle Statistics (Quick Numbers strictly scoped to Last 6 Months with 6 metrics & disclaimers)
 *   4. Fleet Comparison (Multi-vehicle spend & efficiency benchmarks, 4 performance tiers, compatible unit grouping)
 *
 * Offline-first, resource-efficient, database-preserved architecture.
 */

import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, ScrollView, Share, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Stores & State
import { dataRevisionTracker } from "@/services/dataRevisionTracker";
import { useExpenseStore } from "@/stores/expenseStore";
import { useFuelStore } from "@/stores/fuelStore";
import { useServiceStore } from "@/stores/serviceStore";
import { useVehicleStore } from "@/stores/vehicleStore";

// Constants & Types
import {
  FuelType,
  MILEAGE_UNIT_LABELS,
  isElectricFuel,
  isHybridFuel,
} from "@/constants/fuelTypes";
import { Spacing } from "@/constants/theme";
import { computeMileageStats } from "@/engine/mileageEngine";
import { useCrossVehicleStats } from "@/hooks/useCrossVehicleStats";
import { formatCurrency, formatMileage, formatOdometer } from "@/utils/format";
import { buildShareSummary, computeCostPerKm } from "@/utils/shareSummary";
import {
  StatsTimeRange,
  aggregateCostBreakdown,
  filterRecordsByTimeRange,
} from "@/utils/insightsHelpers";

// Components & Theme
import type { MileagePoint } from "@/components/charts/MileageTrendChart";
import { HomeVehicleSelector } from "@/components/home/HomeVehicleSelector";
import { InsightsHeaderBar } from "@/components/insights/InsightsHeaderBar";
import {
  computeSixMonthStatistics,
  type InsightsSection,
} from "@/components/insights/insightsHelpers";
import { InsightsJumpToModal } from "@/components/insights/InsightsJumpToModal";
import { InsightsNavigation } from "@/components/insights/InsightsNavigation";
import { InsightsOverview } from "@/components/insights/InsightsOverview";
import { useInsightsColors } from "@/components/insights/insightsTheme";
import { EfficiencyScreen } from "@/components/insights/screens/EfficiencyScreen";
import { FleetScreen } from "@/components/insights/screens/FleetScreen";
import { SpendingScreen } from "@/components/insights/screens/SpendingScreen";
import { StatisticsScreen } from "@/components/insights/screens/StatisticsScreen";
import { NoVehicleState } from "@/components/NoVehicleState";
import { ReportExportModal } from "@/components/ReportExportModal";

export default function InsightsScreen() {
  const colors = useInsightsColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    section?: string;
    vehicleId?: string;
  }>();

  // ── Global Vehicle Store ──
  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);
  const selectVehicle = useVehicleStore((s) => s.selectVehicle);
  const vehicles = useVehicleStore((s) => s.vehicles);

  useEffect(() => {
    if (params.vehicleId && params.vehicleId !== selectedVehicle?.id) {
      selectVehicle(params.vehicleId);
    }
  }, [params.vehicleId, selectedVehicle?.id, selectVehicle]);

  // ── Active Analytical Section ──
  const [activeSection, setActiveSection] =
    useState<InsightsSection>("overview");

  useEffect(() => {
    if (
      params.section &&
      ["spending", "efficiency", "statistics", "fleet"].includes(params.section)
    ) {
      setActiveSection(params.section as InsightsSection);
    }
  }, [params.section]);

  // Android hardware back button handler
  useEffect(() => {
    const onBackPress = () => {
      if (activeSection !== "overview") {
        setActiveSection("overview");
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress,
    );
    return () => subscription.remove();
  }, [activeSection]);

  // ── Vehicle Fuel Type Flags ──
  const isEV = useMemo(
    () =>
      selectedVehicle
        ? isElectricFuel(selectedVehicle.fuel_type as FuelType)
        : false,
    [selectedVehicle?.fuel_type],
  );
  const isBiFuelVehicle = useMemo(
    () =>
      selectedVehicle
        ? isHybridFuel(selectedVehicle.fuel_type as FuelType)
        : false,
    [selectedVehicle?.fuel_type],
  );

  // ── Domain Stores ──
  const entries = useFuelStore((s) => s.entries);
  const stats = useFuelStore((s) => s.stats);
  const loadEntries = useFuelStore((s) => s.loadEntries);

  const serviceRecords = useServiceStore((s) => s.records);
  const loadRecords = useServiceStore((s) => s.loadRecords);

  const expenses = useExpenseStore((s) => s.expenses);
  const loadExpenses = useExpenseStore((s) => s.loadExpenses);

  // Universal Time Range Filter for Overview & Spending
  const [timeRange, setTimeRange] = useState<StatsTimeRange>("all");

  // Bi-Fuel Mileage Trend Filter (for Hybrid / Dual-fuel vehicles)
  const [biFuelTrendFilter, setBiFuelTrendFilter] = useState<
    "all" | "primary" | "secondary"
  >("all");

  // Report Export Modal
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  // Jump to Modal
  const [showJumpToModal, setShowJumpToModal] = useState<boolean>(false);

  // Revision-based targeted data loading on screen focus
  const lastLoadedVehicleId = useRef<string | null>(null);
  const lastLoadedRevisions = useRef<Record<string, number>>({});

  useFocusEffect(
    useCallback(() => {
      if (selectedVehicle) {
        const vId = selectedVehicle.id;
        const vehicleChanged = vId !== lastLoadedVehicleId.current;

        const fuelRev = dataRevisionTracker.getRevision("fuel", vId);
        if (
          vehicleChanged ||
          fuelRev > (lastLoadedRevisions.current[`fuel_${vId}`] ?? -1)
        ) {
          loadEntries(vId, selectedVehicle.fuel_type as FuelType);
          lastLoadedRevisions.current[`fuel_${vId}`] = fuelRev;
        }

        const serviceRev = dataRevisionTracker.getRevision("services", vId);
        if (
          vehicleChanged ||
          serviceRev > (lastLoadedRevisions.current[`services_${vId}`] ?? -1)
        ) {
          loadRecords(vId);
          lastLoadedRevisions.current[`services_${vId}`] = serviceRev;
        }

        const expenseRev = dataRevisionTracker.getRevision("expenses", vId);
        if (
          vehicleChanged ||
          expenseRev > (lastLoadedRevisions.current[`expenses_${vId}`] ?? -1)
        ) {
          loadExpenses(vId);
          lastLoadedRevisions.current[`expenses_${vId}`] = expenseRev;
        }

        lastLoadedVehicleId.current = vId;
      }
    }, [
      selectedVehicle?.id,
      selectedVehicle?.fuel_type,
      loadEntries,
      loadRecords,
      loadExpenses,
    ]),
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
    return aggregateCostBreakdown(
      filteredEntries,
      filteredServices,
      filteredExpenses,
      isEV,
    );
  }, [filteredEntries, filteredServices, filteredExpenses, isEV]);

  // ── Time-scoped mileage calculation ──
  const timeScopedMileageStats = useMemo(() => {
    if (timeRange === "all") return stats;
    if (filteredEntries.length >= 2) {
      const chronological = [...filteredEntries].reverse();
      return computeMileageStats(chronological);
    }
    return stats;
  }, [timeRange, filteredEntries, stats]);

  // ── Mileage Trend Points for MileageTrendChart ──
  const mileageTrendData = useMemo(() => {
    if (!selectedVehicle)
      return { points: [] as MileagePoint[], average: null, unitLabel: "km/L" };

    let candidateEntries = entries.filter((e) => e.calculated_mileage != null);

    if (isBiFuelVehicle && biFuelTrendFilter !== "all") {
      candidateEntries = candidateEntries.filter(
        (e) =>
          (e.fuel_system ??
            (e.fuel_unit === "kg" ? "primary" : "secondary")) ===
          biFuelTrendFilter,
      );
    }

    if (timeRange !== "all") {
      const timeScoped = filterRecordsByTimeRange(
        candidateEntries,
        (e) => e.date,
        timeRange,
      );
      if (timeScoped.length >= 2) {
        candidateEntries = timeScoped;
      }
    }

    const points: MileagePoint[] = candidateEntries
      .slice(0, 10)
      .reverse()
      .map((e) => {
        const d = new Date(e.date);
        let fuelSystem: "primary" | "secondary" | undefined;
        let fuelSystemLabel: string | undefined;

        if (isBiFuelVehicle) {
          fuelSystem = (e.fuel_system ??
            (e.fuel_unit === "kg" ? "primary" : "secondary")) as
            | "primary"
            | "secondary";
          const isLPG =
            selectedVehicle.fuel_type === FuelType.HYBRID_LPG_PETROL;
          fuelSystemLabel =
            fuelSystem === "primary"
              ? isLPG
                ? "🟢 LPG"
                : "🟢 CNG"
              : "⛽ Petrol";
        }

        return {
          date: e.date,
          displayDate: `${d.getDate()}/${d.getMonth() + 1}`,
          value: e.calculated_mileage!,
          fuelStation: e.fuel_station,
          fuelSystem,
          fuelSystemLabel,
        };
      });

    let average: number | null = null;
    if (
      isBiFuelVehicle &&
      biFuelTrendFilter === "primary" &&
      stats.primarySystemStats?.runningAverage
    ) {
      average = stats.primarySystemStats.runningAverage.value;
    } else if (
      isBiFuelVehicle &&
      biFuelTrendFilter === "secondary" &&
      stats.secondarySystemStats?.runningAverage
    ) {
      average = stats.secondarySystemStats.runningAverage.value;
    } else if (stats.runningAverage) {
      average = stats.runningAverage.value;
    }

    const defaultUnit =
      selectedVehicle.fuel_type === FuelType.ELECTRIC
        ? "km/kWh"
        : selectedVehicle.fuel_type === FuelType.CNG
          ? "km/kg"
          : "km/L";
    let unitLabel = stats.runningAverage
      ? MILEAGE_UNIT_LABELS[stats.runningAverage.unit]
      : defaultUnit;
    if (isBiFuelVehicle) {
      if (biFuelTrendFilter === "primary") {
        unitLabel =
          selectedVehicle.fuel_type === FuelType.HYBRID_LPG_PETROL
            ? "km/L"
            : "km/kg";
      } else if (biFuelTrendFilter === "secondary") {
        unitLabel = "km/L";
      }
    }

    return { points, average, unitLabel };
  }, [
    entries,
    selectedVehicle,
    isBiFuelVehicle,
    biFuelTrendFilter,
    timeRange,
    stats,
  ]);

  // ── Multi-vehicle Fleet Data ──
  const crossVehicleData = useCrossVehicleStats(vehicles);

  // ── Last 6-Months Statistics for Statistics Screen (Section 6) ──
  const sixMonthStats = useMemo(() => {
    return computeSixMonthStatistics(
      entries,
      serviceRecords,
      expenses,
      selectedVehicle,
    );
  }, [entries, serviceRecords, expenses, selectedVehicle]);

  // ── Compute scoped stats for active time range ──
  const totalFuelCost = filteredEntries.reduce(
    (sum, e) => sum + e.total_cost,
    0,
  );
  const totalServiceCost = filteredServices.reduce(
    (sum, r) => sum + (r.cost || 0),
    0,
  );
  const totalExpenseCost = filteredExpenses.reduce(
    (sum, e) => sum + e.amount,
    0,
  );
  const totalOwnershipCost =
    totalFuelCost + totalServiceCost + totalExpenseCost;
  const totalEntriesCount = filteredEntries.length;

  const numMonths = useMemo(() => {
    if (timeRange === "month") return 1;
    if (timeRange === "6m") return 6;
    if (timeRange === "year") return 12;

    const allDates = [
      ...filteredEntries.map((e) => e.date),
      ...filteredServices.map((r) => r.date),
      ...filteredExpenses.map((e) => e.date),
    ].filter(Boolean);
    if (allDates.length === 0) return 1;
    const oldest = new Date(
      allDates.reduce((min, d) => (d < min ? d : min), allDates[0]),
    );
    const now = new Date();
    const months =
      (now.getFullYear() - oldest.getFullYear()) * 12 +
      (now.getMonth() - oldest.getMonth()) +
      1;
    return Math.max(1, months);
  }, [timeRange, filteredEntries, filteredServices, filteredExpenses]);

  const monthlyAverageCost = totalOwnershipCost / numMonths;
  const fuelPercentage =
    totalOwnershipCost > 0 ? (totalFuelCost / totalOwnershipCost) * 100 : 0;
  const nonFuelPercentage = totalOwnershipCost > 0 ? 100 - fuelPercentage : 0;

  const { kmTracked, costPerKm } = computeCostPerKm(
    filteredEntries.map((e) => e.odometer),
    totalOwnershipCost,
  );

  const timeRangeLabel =
    timeRange === "month"
      ? "This Month"
      : timeRange === "6m"
        ? "Last 6 Months"
        : timeRange === "year"
          ? "Last 12 Months"
          : "All Time";

  const avgMileageText = useMemo(() => {
    if (!timeScopedMileageStats.runningAverage) return "";
    return formatMileage(
      timeScopedMileageStats.runningAverage.value,
      MILEAGE_UNIT_LABELS[timeScopedMileageStats.runningAverage.unit],
    );
  }, [timeScopedMileageStats]);

  const bestMileageText = useMemo(() => {
    if (!timeScopedMileageStats.best) return null;
    return timeScopedMileageStats.best.value.toFixed(1);
  }, [timeScopedMileageStats]);

  // ── Share summary handler (Section 8) ──
  const handleShare = async () => {
    if (!selectedVehicle) return;
    const unitLabel = timeScopedMileageStats.runningAverage
      ? MILEAGE_UNIT_LABELS[timeScopedMileageStats.runningAverage.unit]
      : null;
    const message = buildShareSummary({
      vehicleName: selectedVehicle.nickname,
      registrationNumber: selectedVehicle.registration_number,
      odometerText: selectedVehicle.current_odometer
        ? formatOdometer(selectedVehicle.current_odometer)
        : null,
      fuelCost: totalFuelCost,
      serviceCost: totalServiceCost,
      expenseCost: totalExpenseCost,
      fillUps: totalEntriesCount,
      avgMileageText:
        timeScopedMileageStats.runningAverage && unitLabel
          ? formatMileage(
              timeScopedMileageStats.runningAverage.value,
              unitLabel,
            )
          : null,
      bestMileageText: timeScopedMileageStats.best
        ? timeScopedMileageStats.best.value.toFixed(1)
        : null,
      worstMileageText: timeScopedMileageStats.worst
        ? timeScopedMileageStats.worst.value.toFixed(1)
        : null,
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

  if (!selectedVehicle) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <NoVehicleState />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      {/* ── Top Pinned Header Bar ── */}
      <InsightsHeaderBar
        activeSection={activeSection}
        onOpenJumpTo={() => setShowJumpToModal(true)}
        onExport={() => setShowExportModal(true)}
        onShare={handleShare}
        colors={colors}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Vehicle Context Selector ── */}
        <View style={styles.vehicleSelectorWrapper}>
          <HomeVehicleSelector
            vehicle={selectedVehicle}
            colors={colors as any}
          />
        </View>

        {/* ── Divider between Vehicle Selection and Overview / Subsections ── */}
        <View style={[styles.sectionDivider, { backgroundColor: colors.divider }]} />

        {/* ── Screen Navigation Controls (When inside an analytical screen) ── */}
        {activeSection !== "overview" && (
          <InsightsNavigation
            activeSection={activeSection}
            onSelectSection={setActiveSection}
            colors={colors}
            hasFleet={vehicles.length >= 2}
          />
        )}

        {/* ── View 1: Insights Overview (Default) ── */}
        {activeSection === "overview" && (
          <InsightsOverview
            vehicle={selectedVehicle}
            vehiclesCount={vehicles.length}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
            totalOwnershipCost={totalOwnershipCost}
            totalFuelCost={totalFuelCost}
            totalServiceCost={totalServiceCost}
            totalExpenseCost={totalExpenseCost}
            monthlyAverageCost={monthlyAverageCost}
            costPerKm={costPerKm}
            kmTracked={kmTracked}
            avgMileageText={avgMileageText}
            bestMileageText={bestMileageText}
            fuelPercentage={fuelPercentage}
            nonFuelPercentage={nonFuelPercentage}
            totalEntriesCount={totalEntriesCount}
            crossVehicleData={crossVehicleData}
            onNavigate={setActiveSection}
            colors={colors}
          />
        )}

        {/* ── View 2: Spending Screen (Lazy mounted) ── */}
        {activeSection === "spending" && (
          <SpendingScreen
            entries={entries}
            serviceRecords={serviceRecords}
            expenses={expenses}
            totalOwnershipCost={totalOwnershipCost}
            totalFuelCost={totalFuelCost}
            totalServiceCost={totalServiceCost}
            totalExpenseCost={totalExpenseCost}
            fuelPercentage={fuelPercentage}
            nonFuelPercentage={nonFuelPercentage}
            costBreakdownSlices={costBreakdown.slices}
            timeRangeLabel={timeRangeLabel}
            isEV={isEV}
            colors={colors}
          />
        )}

        {/* ── View 3: Efficiency Screen (Lazy mounted) ── */}
        {activeSection === "efficiency" && (
          <EfficiencyScreen
            vehicle={selectedVehicle}
            isEV={isEV}
            mileageTrendData={mileageTrendData}
            stats={timeScopedMileageStats}
            biFuelTrendFilter={biFuelTrendFilter}
            onBiFuelFilterChange={setBiFuelTrendFilter}
            colors={colors}
          />
        )}

        {/* ── View 4: Statistics Screen (Lazy mounted) ── */}
        {activeSection === "statistics" && (
          <StatisticsScreen stats={sixMonthStats} isEV={isEV} colors={colors} />
        )}

        {/* ── View 5: Fleet Comparison Screen (Lazy mounted, 2+ vehicles) ── */}
        {activeSection === "fleet" && vehicles.length >= 2 && (
          <FleetScreen
            data={crossVehicleData}
            vehicles={vehicles}
            colors={colors}
          />
        )}

        <View style={{ height: Spacing.section }} />
      </ScrollView>

      {/* ── Report Export Modal ── */}
      {selectedVehicle && (
        <ReportExportModal
          visible={showExportModal}
          onClose={() => setShowExportModal(false)}
          vehicle={selectedVehicle}
        />
      )}

      {/* ── Jump To Section Modal ── */}
      {selectedVehicle && (
        <InsightsJumpToModal
          visible={showJumpToModal}
          onClose={() => setShowJumpToModal(false)}
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          onExport={() => setShowExportModal(true)}
          onShare={handleShare}
          hasFleet={vehicles.length >= 2}
          vehicleName={selectedVehicle.nickname}
          colors={colors}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  vehicleSelectorWrapper: {
    marginHorizontal: -Spacing.lg,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  sectionDivider: {
    height: 1,
    marginHorizontal: -Spacing.lg,
    marginBottom: Spacing.lg,
  },
});
