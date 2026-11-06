/**
 * FleetScreen Component
 *
 * Section 7: Fleet Comparison Screen
 * Reusable multi-vehicle analytical screen:
 * - Available only when at least 2 vehicles exist
 * - Period Controls: All Time | This Month | Last Month | Month Steppers
 * - Spending Mode: Fleet total, vehicle average, Highest Spender (never called leader), % share of fleet spend
 * - Efficiency Mode: Grouped by compatible efficiency units (km/L vs km/kg vs km/kWh never conflated),
 *   4 visual performance tiers (Green 0-5%, Orange 5-15%, Yellow 15-30%, Red >30%), Efficiency Leader
 * - Global vehicle selection on vehicle tap
 */

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Typography, Spacing, Sizing } from '@/constants/theme';
import { formatCurrency, formatMileage } from '@/utils/format';
import { useVehicleStore } from '@/stores/vehicleStore';
import type { VehicleSummary } from '@/hooks/useCrossVehicleStats';
import type { Vehicle } from '@/types/vehicle';
import type { InsightsPalette } from '../insightsTheme';
import {
  getEfficiencyPerformanceTier,
  getVehicleEfficiencyGroup,
  type EfficiencyFuelGroup,
} from '../insightsHelpers';

interface FleetScreenProps {
  data: VehicleSummary[] | null;
  vehicles: Vehicle[];
  colors: InsightsPalette;
}

type FleetMode = 'cost' | 'mileage';
type PeriodKey = 'all' | 'this_month' | 'last_month' | string;

function formatCompactValue(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return `₹${value}`;
}

export const FleetScreen: React.FC<FleetScreenProps> = ({
  data,
  vehicles,
  colors,
}) => {
  const [mode, setMode] = useState<FleetMode>('cost');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('this_month');

  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);
  const selectVehicle = useVehicleStore((s) => s.selectVehicle);

  // Vehicle metadata map
  const vehicleMap = useMemo(() => {
    const map = new Map<string, Vehicle>();
    for (const v of vehicles) map.set(v.id, v);
    return map;
  }, [vehicles]);

  if (!data || data.length < 2) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[Typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
          Add at least 2 vehicles to your garage to compare their running costs and fuel economy.
        </Text>
      </View>
    );
  }

  // Available months from first vehicle
  const availableMonths = data[0]?.availableMonths || [];
  const thisMonthKey = availableMonths[0]?.key;
  const lastMonthKey = availableMonths[1]?.key;

  const activeMonthKey = useMemo(() => {
    if (selectedPeriod === 'all') return 'all';
    if (selectedPeriod === 'this_month') return thisMonthKey || 'all';
    if (selectedPeriod === 'last_month') return lastMonthKey || 'all';
    return selectedPeriod;
  }, [selectedPeriod, thisMonthKey, lastMonthKey]);

  const periodLabel = useMemo(() => {
    if (activeMonthKey === 'all') return 'All Time';
    const found = availableMonths.find((m) => m.key === activeMonthKey);
    return found ? found.label : 'Selected Month';
  }, [activeMonthKey, availableMonths]);

  const currentMonthIdx = availableMonths.findIndex((m) => m.key === activeMonthKey);

  const handlePrevMonth = () => {
    if (currentMonthIdx === -1) {
      if (availableMonths.length > 0) setSelectedPeriod(availableMonths[0].key);
    } else if (currentMonthIdx < availableMonths.length - 1) {
      setSelectedPeriod(availableMonths[currentMonthIdx + 1].key);
    }
  };

  const handleNextMonth = () => {
    if (currentMonthIdx > 0) {
      setSelectedPeriod(availableMonths[currentMonthIdx - 1].key);
    }
  };

  // Compute stats per vehicle based on active period
  const vehicleStats = useMemo(() => {
    return data.map((d) => {
      const v = vehicleMap.get(d.id);
      if (activeMonthKey === 'all') {
        return {
          id: d.id,
          name: d.name,
          cost: d.totalCost,
          fuelCost: d.fuelCost,
          serviceCost: d.serviceCost,
          expenseCost: d.expenseCost,
          mileage: d.avgMileage,
          mileageUnit: d.mileageUnit || 'km/L',
          fuelType: v?.fuel_type,
        };
      }

      const m = d.monthlyStats[activeMonthKey];
      return {
        id: d.id,
        name: d.name,
        cost: m?.totalCost ?? 0,
        fuelCost: m?.fuelCost ?? 0,
        serviceCost: m?.serviceCost ?? 0,
        expenseCost: m?.expenseCost ?? 0,
        mileage: m?.avgMileage ?? d.avgMileage,
        mileageUnit: d.mileageUnit || 'km/L',
        fuelType: v?.fuel_type,
      };
    });
  }, [data, activeMonthKey, vehicleMap]);

  // Spending calculations
  const totalFleetCost = useMemo(() => vehicleStats.reduce((s, v) => s + v.cost, 0), [vehicleStats]);
  const avgCostPerVehicle = Math.round(totalFleetCost / Math.max(vehicleStats.length, 1));
  const maxCost = useMemo(() => Math.max(...vehicleStats.map((v) => v.cost), 1), [vehicleStats]);

  const sortedBySpend = useMemo(() => [...vehicleStats].sort((a, b) => b.cost - a.cost), [vehicleStats]);
  const highestSpender = sortedBySpend[0]?.cost > 0 ? sortedBySpend[0] : null;

  // Efficiency calculations: Group by compatible fuel units (Section 7C)
  const groupedEfficiency = useMemo(() => {
    const groups: Record<EfficiencyFuelGroup, { label: string; unit: string; items: typeof vehicleStats }> = {
      liquid: { label: '⛽ Liquid Fuel (Petrol & Diesel)', unit: 'km/L', items: [] },
      cng_lpg: { label: '🟢 Gas Powertrains (CNG/LPG)', unit: 'km/kg', items: [] },
      electric: { label: '⚡ Electric Powertrains', unit: 'km/kWh', items: [] },
      hybrid: { label: '🔄 Dual-Fuel / Hybrids', unit: 'km/kg & km/L', items: [] },
    };

    for (const item of vehicleStats) {
      if (item.mileage !== null && item.mileage > 0) {
        const { group } = getVehicleEfficiencyGroup(item.fuelType);
        groups[group].items.push(item);
      }
    }

    // Sort items inside each group descending by mileage
    for (const key of Object.keys(groups) as EfficiencyFuelGroup[]) {
      groups[key].items.sort((a, b) => (b.mileage ?? 0) - (a.mileage ?? 0));
    }

    return groups;
  }, [vehicleStats]);

  const getFuelEmoji = (fuelType?: string) => {
    if (!fuelType) return '🚗';
    const lower = fuelType.toLowerCase();
    if (lower.includes('electric') || lower.includes('ev')) return '⚡';
    if (lower.includes('cng')) return '🟢';
    if (lower.includes('lpg')) return '🟡';
    if (lower.includes('diesel')) return '🛢️';
    return '⛽';
  };

  return (
    <View style={styles.container}>
      {/* ── Mode Selector: Spend vs Efficiency ── */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, paddingRight: Spacing.xs }}>
            <Text style={[Typography.h3, { color: colors.text, fontWeight: '800' }]}>
              Garage Comparison
            </Text>
            <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 1 }]}>
              {vehicles.length} vehicles in your garage
            </Text>
          </View>

          <View style={[styles.segmentControl, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}>
            <TouchableOpacity
              onPress={() => setMode('cost')}
              style={[styles.segmentBtn, mode === 'cost' && { backgroundColor: colors.accent }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentBtnText, { color: mode === 'cost' ? '#FFF' : colors.textSecondary }]}>
                💰 Costs
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setMode('mileage')}
              style={[styles.segmentBtn, mode === 'mileage' && { backgroundColor: colors.accent }]}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentBtnText, { color: mode === 'mileage' ? '#FFF' : colors.textSecondary }]}>
                ⛽ Mileage
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Period Selector Ribbon ── */}
        <View style={[styles.periodSection, { borderColor: colors.borderLight, backgroundColor: colors.surfaceSecondary }]}>
          <View style={styles.quickPeriodRow}>
            {(['this_month', 'last_month', 'all'] as const).map((p) => {
              const isSelected = selectedPeriod === p;
              return (
                <TouchableOpacity
                  key={p}
                  onPress={() => setSelectedPeriod(p)}
                  style={[
                    styles.periodChip,
                    isSelected && { backgroundColor: colors.accent, borderColor: colors.accent },
                    !isSelected && { borderColor: colors.border, backgroundColor: colors.surface },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.periodChipText, { color: isSelected ? '#FFF' : colors.textSecondary }]}>
                    {p === 'this_month' ? '📅 This Month' : p === 'last_month' ? '📅 Last Month' : 'All Time'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Stepper for months */}
          {selectedPeriod !== 'all' && (
            <View style={styles.stepperRow}>
              <TouchableOpacity
                onPress={handlePrevMonth}
                disabled={currentMonthIdx >= availableMonths.length - 1}
                style={[styles.stepBtn, { opacity: currentMonthIdx >= availableMonths.length - 1 ? 0.4 : 1 }]}
              >
                <Text style={{ color: colors.accent, fontWeight: '800' }}>‹ Earlier</Text>
              </TouchableOpacity>

              <Text style={[Typography.caption, { color: colors.text, fontWeight: '800' }]}>
                {periodLabel}
              </Text>

              <TouchableOpacity
                onPress={handleNextMonth}
                disabled={currentMonthIdx <= 0}
                style={[styles.stepBtn, { opacity: currentMonthIdx <= 0 ? 0.4 : 1 }]}
              >
                <Text style={{ color: colors.accent, fontWeight: '800' }}>Later ›</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Summary Ribbon ── */}
        <View style={[styles.summaryRibbon, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={styles.summaryRibbonCol}>
            <Text style={[styles.ribbonLabel, { color: colors.textTertiary }]}>ALL VEHICLES TOTAL</Text>
            <Text style={[styles.ribbonValue, { color: colors.text }]}>
              {formatCurrency(totalFleetCost)}
            </Text>
          </View>

          <View style={[styles.ribbonDivider, { backgroundColor: colors.border }]} />

          <View style={styles.summaryRibbonCol}>
            <Text style={[styles.ribbonLabel, { color: colors.textTertiary }]}>AVERAGE PER VEHICLE</Text>
            <Text style={[styles.ribbonValue, { color: colors.accent }]}>
              {formatCurrency(avgCostPerVehicle)}
            </Text>
          </View>

          <View style={[styles.ribbonDivider, { backgroundColor: colors.border }]} />

          <View style={styles.summaryRibbonCol}>
            <Text style={[styles.ribbonLabel, { color: colors.textTertiary }]}>
              {mode === 'cost' ? 'HIGHEST EXPENSE' : 'TOP PERFORMER'}
            </Text>
            <Text style={[styles.ribbonValue, { color: colors.tierOrange }]} numberOfLines={1}>
              {highestSpender ? highestSpender.name : '—'}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Spending Mode Vehicle List ── */}
      {mode === 'cost' && (
        <View style={styles.vehicleList}>
          {sortedBySpend.map((item) => {
            const v = vehicleMap.get(item.id);
            const isSelected = selectedVehicle?.id === item.id;
            const isHighest = highestSpender?.id === item.id && item.cost > 0;
            const progress = totalFleetCost > 0 ? Math.min(100, Math.round((item.cost / maxCost) * 100)) : 0;
            const share = totalFleetCost > 0 ? Math.round((item.cost / totalFleetCost) * 100) : 0;
            const isEV = v?.fuel_type === 'electric';

            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => selectVehicle(item.id)}
                activeOpacity={0.8}
                style={[
                  styles.vehicleCard,
                  {
                    backgroundColor: isSelected ? colors.primaryLight : colors.surface,
                    borderColor: isSelected ? colors.accent : colors.border,
                    borderWidth: isSelected ? 1.5 : 1,
                  },
                ]}
              >
                {/* Header Row */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.nameGroup}>
                    <Text style={{ fontSize: 18 }}>{getFuelEmoji(v?.fuel_type)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[Typography.body, { color: colors.text, fontWeight: '800' }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[Typography.caption, { color: colors.textTertiary, fontSize: 11 }]}>
                        {v?.manufacturer ? `${v.manufacturer} ${v.model || ''}` : v?.registration_number || 'Vehicle'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.badgeGroup}>
                    {isSelected && (
                      <View style={[styles.pill, { backgroundColor: colors.accent + '20' }]}>
                        <Text style={[styles.pillText, { color: colors.accent }]}>Active</Text>
                      </View>
                    )}
                    {isHighest && (
                      <View style={[styles.pill, { backgroundColor: colors.tierOrange + '20' }]}>
                        <Text style={[styles.pillText, { color: colors.tierOrange }]}>Highest Cost</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Metric Line */}
                <View style={styles.metricRow}>
                  <Text style={[styles.bigMetric, { color: item.cost > 0 ? colors.text : colors.textTertiary }]}>
                    {item.cost > 0 ? formatCurrency(item.cost) : '₹0'}
                  </Text>
                  {item.cost > 0 ? (
                    <Text style={[Typography.caption, { color: colors.accent, fontWeight: '800', fontSize: 11 }]}>
                      {share}% of all vehicle costs
                    </Text>
                  ) : (
                    <Text style={[Typography.caption, { color: colors.textTertiary, fontSize: 11 }]}>
                      No costs logged in {periodLabel}
                    </Text>
                  )}
                </View>

                {/* Comparative Progress Track */}
                <View style={[styles.trackBar, { backgroundColor: colors.borderLight }]}>
                  {progress > 0 && (
                    <View
                      style={[
                        styles.fillBar,
                        {
                          width: `${progress}%`,
                          backgroundColor: isHighest ? colors.tierOrange : colors.accent,
                        },
                      ]}
                    />
                  )}
                </View>

                {/* Category Sub-Row */}
                {item.cost > 0 && (
                  <View style={styles.catTagsRow}>
                    {item.fuelCost > 0 && (
                      <View style={[styles.catTag, { backgroundColor: colors.accent + '14' }]}>
                        <Text style={[styles.catTagText, { color: colors.accent }]}>
                          {isEV ? '⚡ Energy' : '⛽ Fuel'}: {formatCompactValue(item.fuelCost)}
                        </Text>
                      </View>
                    )}
                    {item.serviceCost > 0 && (
                      <View style={[styles.catTag, { backgroundColor: colors.tierOrange + '14' }]}>
                        <Text style={[styles.catTagText, { color: colors.tierOrange }]}>
                          🔧 Service: {formatCompactValue(item.serviceCost)}
                        </Text>
                      </View>
                    )}
                    {item.expenseCost > 0 && (
                      <View style={[styles.catTag, { backgroundColor: colors.surfaceSecondary }]}>
                        <Text style={[styles.catTagText, { color: colors.textSecondary }]}>
                          📄 Other: {formatCompactValue(item.expenseCost)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Selection Footer Note */}
                <View style={styles.actionFooter}>
                  <Text
                    style={[
                      Typography.caption,
                      {
                        color: isSelected ? colors.accent : colors.textTertiary,
                        fontWeight: isSelected ? '800' : '500',
                        fontSize: 11,
                      },
                    ]}
                  >
                    {isSelected ? '✓ Active vehicle on dashboard' : 'Tap to switch dashboard to this vehicle ➔'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── Efficiency Mode: Grouped by Compatible Units (Section 7C & 7D) ── */}
      {mode === 'mileage' && (
        <View style={styles.vehicleList}>
          {(Object.keys(groupedEfficiency) as EfficiencyFuelGroup[]).map((groupKey) => {
            const group = groupedEfficiency[groupKey];
            if (group.items.length === 0) return null;

            const leader = group.items[0];
            const leaderMileage = leader.mileage ?? 1;

            return (
              <View key={groupKey} style={styles.groupContainer}>
                {/* Group Heading */}
                <View style={styles.groupHeaderRow}>
                  <Text style={[Typography.bodySmall, { color: colors.text, fontWeight: '800' }]}>
                    {group.label}
                  </Text>
                  <Text style={[Typography.caption, { color: colors.textTertiary }]}>
                    Unit: {group.unit}
                  </Text>
                </View>

                {group.items.map((item) => {
                  const v = vehicleMap.get(item.id);
                  const isSelected = selectedVehicle?.id === item.id;
                  const isLeader = item.id === leader.id;
                  const percentBelow = leaderMileage > 0
                    ? Math.max(0, ((leaderMileage - (item.mileage ?? 0)) / leaderMileage) * 100)
                    : 0;

                  // 4 Visual Performance Tiers (Section 7D)
                  const tier = getEfficiencyPerformanceTier(percentBelow);
                  const tierColor = colors[tier.colorKey];
                  const tierBg = colors[tier.bgKey];
                  const progress = Math.max(12, Math.min(100, ((item.mileage ?? 0) / leaderMileage) * 100));

                  return (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => selectVehicle(item.id)}
                      activeOpacity={0.8}
                      style={[
                        styles.vehicleCard,
                        {
                          backgroundColor: isSelected ? colors.primaryLight : colors.surface,
                          borderColor: isSelected ? colors.accent : colors.border,
                          borderWidth: isSelected ? 1.5 : 1,
                        },
                      ]}
                    >
                      <View style={styles.cardHeaderRow}>
                        <View style={styles.nameGroup}>
                          <Text style={{ fontSize: 18 }}>{getFuelEmoji(v?.fuel_type)}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={[Typography.body, { color: colors.text, fontWeight: '800' }]} numberOfLines={1}>
                              {item.name}
                            </Text>
                            <Text style={[Typography.caption, { color: colors.textTertiary, fontSize: 11 }]}>
                              {v?.manufacturer ? `${v.manufacturer} ${v.model || ''}` : v?.registration_number || 'Vehicle'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.badgeGroup}>
                          {isSelected && (
                            <View style={[styles.pill, { backgroundColor: colors.accent + '20' }]}>
                              <Text style={[styles.pillText, { color: colors.accent }]}>Active</Text>
                            </View>
                          )}
                          {isLeader && (
                            <View style={[styles.pill, { backgroundColor: colors.tierGreenBg }]}>
                              <Text style={[styles.pillText, { color: colors.tierGreen }]}>🏆 Best Mileage</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Metric Row */}
                      <View style={styles.metricRow}>
                        <Text style={[styles.bigMetric, { color: isLeader ? colors.tierGreen : colors.text }]}>
                          {formatMileage(item.mileage!, item.mileageUnit)}
                        </Text>

                        {isLeader ? (
                          <View style={[styles.tierBadge, { backgroundColor: tierBg }]}>
                            <Text style={[styles.tierBadgeText, { color: tierColor }]}>
                              Best in Category
                            </Text>
                          </View>
                        ) : (
                          <View style={[styles.tierBadge, { backgroundColor: tierBg }]}>
                            <Text style={[styles.tierBadgeText, { color: tierColor }]}>
                              ▼ {percentBelow.toFixed(1)}% vs best
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* 4-Tier Colored Comparison Bar */}
                      <View style={[styles.trackBar, { backgroundColor: colors.borderLight }]}>
                        <View
                          style={[
                            styles.fillBar,
                            {
                              width: `${progress}%`,
                              backgroundColor: isLeader ? colors.tierGreen : tierColor,
                            },
                          ]}
                        />
                      </View>

                      {/* Action Footer */}
                      <View style={styles.actionFooter}>
                        <Text
                          style={[
                            Typography.caption,
                            {
                              color: isSelected ? colors.accent : colors.textTertiary,
                              fontWeight: isSelected ? '800' : '500',
                              fontSize: 11,
                            },
                          ]}
                        >
                          {isSelected ? '✓ Currently selected vehicle' : 'Tap to switch dashboard to this vehicle ➔'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </View>
      )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  segmentControl: {
    flexDirection: 'row',
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    overflow: 'hidden',
  },
  segmentBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
  },
  segmentBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  periodSection: {
    padding: Spacing.sm,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  quickPeriodRow: {
    flexDirection: 'row',
    gap: 6,
  },
  periodChip: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
  },
  periodChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.xs,
    marginTop: 4,
  },
  stepBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  summaryRibbon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
  },
  summaryRibbonCol: {
    flex: 1,
    alignItems: 'center',
  },
  ribbonDivider: {
    width: 1,
    height: 24,
  },
  ribbonLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ribbonValue: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  vehicleList: {
    gap: Spacing.sm,
  },
  groupContainer: {
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
  },
  vehicleCard: {
    borderRadius: Sizing.radiusMd,
    padding: Spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  nameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  badgeGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Sizing.radiusFull,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: Spacing.xs,
    marginBottom: 6,
  },
  bigMetric: {
    fontSize: 16,
    fontWeight: '800',
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Sizing.radiusFull,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  trackBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: 4,
  },
  fillBar: {
    height: '100%',
    borderRadius: 4,
  },
  catTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: Spacing.xs,
  },
  catTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  catTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  actionFooter: {
    marginTop: Spacing.xs,
    paddingTop: 4,
  },
});

