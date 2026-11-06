/**
 * SpendingScreen Component
 *
 * Section 4: Spending Screen
 * Dedicated screen for all vehicle spending analysis:
 * - A. Fuel vs Non-fuel overview with proportional horizontal bar
 * - Distinct Fuel & Non-fuel sections (separating service vs other expenses internally)
 * - B. ₹100 Spending Insight
 * - C. Cost Breakdown interactive Donut Chart
 * - D. Monthly Spending Analysis (MonthlySpendCard)
 */

import { CostBreakdownDonutChart } from "@/components/charts/CostBreakdownDonutChart";
import { MonthlySpendCard } from "@/components/MonthlySpendCard";
import { Sizing, Spacing, Typography } from "@/constants/theme";
import type { VehicleExpense } from "@/types/expense";
import type { FuelEntry } from "@/types/fuel";
import type { ServiceRecord } from "@/types/service";
import { formatCurrency } from "@/utils/format";
import type { CostCategorySlice } from "@/utils/insightsHelpers";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { InsightsPalette } from "../insightsTheme";

interface SpendingScreenProps {
  entries: FuelEntry[];
  serviceRecords: ServiceRecord[];
  expenses: VehicleExpense[];
  totalOwnershipCost: number;
  totalFuelCost: number;
  totalServiceCost: number;
  totalExpenseCost: number;
  fuelPercentage: number;
  nonFuelPercentage: number;
  costBreakdownSlices: CostCategorySlice[];
  timeRangeLabel: string;
  isEV: boolean;
  colors: InsightsPalette;
}

export const SpendingScreen: React.FC<SpendingScreenProps> = ({
  entries,
  serviceRecords,
  expenses,
  totalOwnershipCost,
  totalFuelCost,
  totalServiceCost,
  totalExpenseCost,
  fuelPercentage,
  nonFuelPercentage,
  costBreakdownSlices,
  timeRangeLabel,
  isEV,
  colors,
}) => {
  const nonFuelCost = totalServiceCost + totalExpenseCost;

  return (
    <View style={styles.container}>
      {/* ── Section A: Fuel vs Non-Fuel Spending Overview ── */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text
              style={[Typography.h3, { color: colors.text, fontWeight: "800" }]}
            >
              Spending Split
            </Text>
            <Text
              style={[
                Typography.caption,
                { color: colors.textTertiary, marginTop: 1 },
              ]}
            >
              {isEV
                ? "Charging vs Non-Fuel Running Costs"
                : "Direct Fuel vs Running Costs"}
            </Text>
          </View>

          <View style={styles.ratioPillsRow}>
            {totalOwnershipCost > 0 && (
              <View
                style={[styles.badge, { backgroundColor: colors.primaryLight }]}
              >
                <Text
                  style={[
                    Typography.caption,
                    { color: colors.accent, fontWeight: "800", fontSize: 11 },
                  ]}
                >
                  {fuelPercentage.toFixed(0)} : {nonFuelPercentage.toFixed(0)}{" "}
                  Ratio
                </Text>
              </View>
            )}
            <View
              style={[
                styles.badge,
                { backgroundColor: colors.surfaceSecondary },
              ]}
            >
              <Text
                style={[
                  Typography.caption,
                  {
                    color: colors.textSecondary,
                    fontWeight: "700",
                    fontSize: 11,
                  },
                ]}
              >
                {timeRangeLabel}
              </Text>
            </View>
          </View>
        </View>

        {/* Proportional Horizontal Bar */}
        <View
          style={[
            styles.proportionTrack,
            { backgroundColor: colors.borderLight },
          ]}
        >
          {totalOwnershipCost > 0 ? (
            <>
              <View
                style={{
                  flex: Math.max(0.01, fuelPercentage),
                  backgroundColor: colors.accent,
                }}
              />
              <View
                style={{
                  flex: Math.max(0.01, nonFuelPercentage),
                  backgroundColor: colors.tierOrange,
                }}
              />
            </>
          ) : (
            <View style={styles.emptyTrack}>
              <Text
                style={{
                  fontSize: 9,
                  color: colors.textTertiary,
                  fontWeight: "700",
                }}
              >
                NO EXPENSES RECORDED
              </Text>
            </View>
          )}
        </View>

        {/* Fuel vs Non-Fuel Distinct Section Tiles */}
        <View style={styles.tilesRow}>
          {/* Fuel Tile */}
          <View
            style={[
              styles.splitTile,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.tileHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <View
                  style={[
                    styles.iconBadge,
                    { backgroundColor: colors.accent + "20" },
                  ]}
                >
                  <Text style={{ fontSize: 12 }}>{isEV ? "⚡" : "⛽"}</Text>
                </View>
                <Text
                  style={[
                    Typography.caption,
                    {
                      color: colors.textSecondary,
                      fontWeight: "800",
                      fontSize: 11,
                    },
                  ]}
                >
                  {isEV ? "CHARGING" : "FUEL"}
                </Text>
              </View>
              <View
                style={[
                  styles.percentPill,
                  { backgroundColor: colors.accent + "20" },
                ]}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "800",
                    color: colors.accent,
                  }}
                >
                  {totalOwnershipCost > 0
                    ? `${fuelPercentage.toFixed(0)}%`
                    : "0%"}
                </Text>
              </View>
            </View>

            <Text
              style={[
                Typography.h3,
                {
                  color: colors.text,
                  marginTop: 4,
                  fontWeight: "800",
                  fontSize: 17,
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatCurrency(totalFuelCost)}
            </Text>
            <Text
              style={[
                Typography.caption,
                { color: colors.textTertiary, marginTop: 2, fontSize: 11 },
              ]}
            >
              Direct consumption
            </Text>
          </View>

          {/* Non-Fuel Tile */}
          <View
            style={[
              styles.splitTile,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.tileHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <View
                  style={[
                    styles.iconBadge,
                    { backgroundColor: colors.tierOrange + "20" },
                  ]}
                >
                  <Text style={{ fontSize: 12 }}>🛠️</Text>
                </View>
                <Text
                  style={[
                    Typography.caption,
                    {
                      color: colors.textSecondary,
                      fontWeight: "800",
                      fontSize: 11,
                    },
                  ]}
                >
                  NON-FUEL
                </Text>
              </View>
              <View
                style={[
                  styles.percentPill,
                  { backgroundColor: colors.tierOrange + "20" },
                ]}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "800",
                    color: colors.tierOrange,
                  }}
                >
                  {totalOwnershipCost > 0
                    ? `${nonFuelPercentage.toFixed(0)}%`
                    : "0%"}
                </Text>
              </View>
            </View>

            <Text
              style={[
                Typography.h3,
                {
                  color: colors.text,
                  marginTop: 4,
                  fontWeight: "800",
                  fontSize: 17,
                },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatCurrency(nonFuelCost)}
            </Text>
            <Text
              style={[
                Typography.caption,
                { color: colors.textTertiary, marginTop: 2, fontSize: 11 },
              ]}
            >
              Service & expenses
            </Text>
          </View>
        </View>

        {/* Distinct Sub-categories for Non-Fuel: Service vs Other Expenses */}
        {nonFuelCost > 0 && (
          <View
            style={[
              styles.subCategoriesRow,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.subCatItem}>
              <Text style={{ fontSize: 12 }}>🔧</Text>
              <Text
                style={[Typography.caption, { color: colors.textSecondary }]}
              >
                Service:{" "}
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  {formatCurrency(totalServiceCost)}
                </Text>
              </Text>
            </View>
            <View
              style={[styles.vDivider, { backgroundColor: colors.border }]}
            />
            <View style={styles.subCatItem}>
              <Text style={{ fontSize: 12 }}>📄</Text>
              <Text
                style={[Typography.caption, { color: colors.textSecondary }]}
              >
                Other:{" "}
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  {formatCurrency(totalExpenseCost)}
                </Text>
              </Text>
            </View>
          </View>
        )}

        {/* ── Section B: ₹100 Spending Insight ── */}
        {totalOwnershipCost > 0 && (
          <View
            style={[
              styles.insightCard,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                Typography.caption,
                { color: colors.textSecondary, lineHeight: 18 },
              ]}
            >
              💡{" "}
              <Text style={{ fontWeight: "800", color: colors.text }}>
                For every ₹100 spent:
              </Text>{" "}
              <Text style={{ fontWeight: "800", color: colors.accent }}>
                ₹{fuelPercentage.toFixed(0)}
              </Text>{" "}
              goes to {isEV ? "charging" : "fuel"},{" "}
              <Text style={{ fontWeight: "800", color: colors.tierOrange }}>
                ₹{((totalServiceCost / totalOwnershipCost) * 100).toFixed(0)}
              </Text>{" "}
              to maintenance & repairs, and{" "}
              <Text style={{ fontWeight: "800", color: colors.text }}>
                ₹{((totalExpenseCost / totalOwnershipCost) * 100).toFixed(0)}
              </Text>{" "}
              to general running costs.
            </Text>
          </View>
        )}
      </View>

      {/* ── Section C: Cost Breakdown Donut Chart ── */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.sectionTitleGroup}>
          <Text
            style={[Typography.h3, { color: colors.text, fontWeight: "800" }]}
          >
            Cost Breakdown
          </Text>
          <Text
            style={[
              Typography.caption,
              { color: colors.textTertiary, marginTop: 2 },
            ]}
          >
            {timeRangeLabel} spending across categories with interactive segment
            inspection
          </Text>
        </View>

        <CostBreakdownDonutChart
          slices={costBreakdownSlices}
          totalCost={totalOwnershipCost}
          timeRangeLabel={timeRangeLabel}
          colors={colors}
        />
      </View>

      {/* ── Section D: Monthly Spending Analysis ── */}
      <MonthlySpendCard
        entries={entries}
        serviceRecords={serviceRecords}
        expenses={expenses}
        colors={colors}
        isEV={isEV}
      />
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  ratioPillsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Sizing.radiusFull,
  },
  proportionTrack: {
    height: 12,
    borderRadius: 6,
    flexDirection: "row",
    overflow: "hidden",
    marginVertical: Spacing.md,
  },
  emptyTrack: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tilesRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  splitTile: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
  },
  tileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  iconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  percentPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Sizing.radiusFull,
  },
  subCategoriesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  subCatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  vDivider: {
    width: 1,
    height: 14,
  },
  insightCard: {
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  sectionTitleGroup: {
    marginBottom: Spacing.md,
  },
});
