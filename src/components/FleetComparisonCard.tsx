/**
 * FleetComparisonCard Component
 *
 * Mobile-first Multi-Vehicle Comparison:
 * - 100% full-width responsive layout, zero horizontal scrolling
 * - Clean Month & Period Selector:
 *   - "All Time", "This Month", "Last Month", or step through recent months
 * - Dual Comparison Modes:
 *   - 💰 Total Spend (Rupee amount, % share of fleet spend, category breakdown)
 *   - ⛽ Efficiency (km/L, km/kg, km/kWh with fleet ranking)
 * - Fleet Summary KPI Ribbon:
 *   - Fleet Total, Vehicle Average, Fleet Leader
 * - Comparative Visual Progress Bars:
 *   - Spans full width of vehicle card, zero text clipping
 * - One-Tap Dashboard Vehicle Switch
 */

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Typography, Spacing, Sizing } from '@/constants/theme';
import { formatCurrency, formatMileage } from '@/utils/format';
import { useVehicleStore } from '@/stores/vehicleStore';
import type { VehicleSummary } from '@/hooks/useCrossVehicleStats';
import type { Vehicle } from '@/types/vehicle';

interface FleetComparisonCardProps {
  data: VehicleSummary[];
  vehicles: Vehicle[];
  colors: any;
}

type FleetMode = 'cost' | 'mileage';
type PeriodKey = 'all' | 'this_month' | 'last_month' | string;

function formatCompactValue(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return `₹${value}`;
}

export function FleetComparisonCard({
  data,
  vehicles,
  colors,
}: FleetComparisonCardProps) {
  const [mode, setMode] = useState<FleetMode>('cost');
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('this_month');
  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);
  const selectVehicle = useVehicleStore((s) => s.selectVehicle);

  if (!data || data.length < 2) {
    return null;
  }

  // Vehicle metadata map (make, model, reg, fuel_type)
  const vehicleMap = useMemo(() => {
    const map = new Map<string, Vehicle>();
    for (const v of vehicles) map.set(v.id, v);
    return map;
  }, [vehicles]);

  // Available months from first vehicle (all vehicles share same recent 6 months list)
  const availableMonths = data[0]?.availableMonths || [];
  const thisMonthKey = availableMonths[0]?.key;
  const lastMonthKey = availableMonths[1]?.key;

  // Resolved active month key
  const activeMonthKey = useMemo(() => {
    if (selectedPeriod === 'all') return 'all';
    if (selectedPeriod === 'this_month') return thisMonthKey || 'all';
    if (selectedPeriod === 'last_month') return lastMonthKey || 'all';
    return selectedPeriod;
  }, [selectedPeriod, thisMonthKey, lastMonthKey]);

  // Active period display label
  const periodLabel = useMemo(() => {
    if (activeMonthKey === 'all') return 'All Time';
    const found = availableMonths.find((m) => m.key === activeMonthKey);
    return found ? found.label : 'Selected Month';
  }, [activeMonthKey, availableMonths]);

  // Current month index for stepper (if viewing a specific month)
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

  // Compute per-vehicle stats based on active period
  const vehicleStats = useMemo(() => {
    return data.map((d) => {
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
        // If this month has calculated mileage use it, otherwise fall back to running average
        mileage: m?.avgMileage ?? d.avgMileage,
        mileageUnit: d.mileageUnit || 'km/L',
      };
    });
  }, [data, activeMonthKey]);

  // Cost ranking
  const costList = useMemo(() => {
    return [...vehicleStats].sort((a, b) => b.cost - a.cost);
  }, [vehicleStats]);

  const totalPeriodFleetCost = useMemo(() => {
    return vehicleStats.reduce((s, v) => s + v.cost, 0);
  }, [vehicleStats]);

  const maxCost = useMemo(() => {
    return Math.max(...vehicleStats.map((v) => v.cost), 1);
  }, [vehicleStats]);

  const avgCostPerVehicle = Math.round(totalPeriodFleetCost / Math.max(vehicleStats.length, 1));
  const highestSpender = costList[0]?.cost > 0 ? costList[0] : null;

  // Mileage ranking
  const validMileageList = useMemo(() => {
    return [...vehicleStats]
      .filter((v) => v.mileage !== null && v.mileage > 0)
      .sort((a, b) => (b.mileage ?? 0) - (a.mileage ?? 0));
  }, [vehicleStats]);

  const maxMileage = validMileageList.length > 0 ? (validMileageList[0].mileage ?? 1) : 1;
  const bestMileageVehicle = validMileageList.length > 0 ? validMileageList[0] : null;
  const fleetAvgMileage = validMileageList.length > 0
    ? validMileageList.reduce((sum, d) => sum + (d.mileage ?? 0), 0) / validMileageList.length
    : 0;

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
    <View style={[styles.container, { backgroundColor: colors.surface, ...Sizing.cardShadow }]}>
      {/* ── Header Row ── */}
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: Spacing.xs }}>
          <Text style={[Typography.h3, { color: colors.text }]}>🚗 Fleet Comparison</Text>
          <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
            {data.length} vehicles in your garage
          </Text>
        </View>

        {/* Mode Selector Toggle */}
        <View style={[styles.segmentControl, { borderColor: colors.border, backgroundColor: colors.background }]}>
          <TouchableOpacity
            onPress={() => setMode('cost')}
            style={[styles.segmentBtn, mode === 'cost' && { backgroundColor: colors.primary }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.segmentBtnText, { color: mode === 'cost' ? '#FFF' : colors.textSecondary }]}>
              💰 Spend
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setMode('mileage')}
            style={[styles.segmentBtn, mode === 'mileage' && { backgroundColor: colors.primary }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.segmentBtnText, { color: mode === 'mileage' ? '#FFF' : colors.textSecondary }]}>
              ⛽ Efficiency
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Period Selector Ribbon (Zero Horizontal Scrolling) ── */}
      <View style={[styles.periodSection, { borderColor: colors.border, backgroundColor: colors.background }]}>
        {/* Quick Period Buttons */}
        <View style={styles.quickPeriodRow}>
          <TouchableOpacity
            onPress={() => setSelectedPeriod('this_month')}
            style={[
              styles.periodChip,
              selectedPeriod === 'this_month' && { backgroundColor: colors.primary, borderColor: colors.primary },
              selectedPeriod !== 'this_month' && { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.periodChipText,
                { color: selectedPeriod === 'this_month' ? '#FFF' : colors.textSecondary },
              ]}
            >
              📅 This Month
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSelectedPeriod('last_month')}
            style={[
              styles.periodChip,
              selectedPeriod === 'last_month' && { backgroundColor: colors.primary, borderColor: colors.primary },
              selectedPeriod !== 'last_month' && { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.periodChipText,
                { color: selectedPeriod === 'last_month' ? '#FFF' : colors.textSecondary },
              ]}
            >
              📅 Last Month
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setSelectedPeriod('all')}
            style={[
              styles.periodChip,
              selectedPeriod === 'all' && { backgroundColor: colors.primary, borderColor: colors.primary },
              selectedPeriod !== 'all' && { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.periodChipText,
                { color: selectedPeriod === 'all' ? '#FFF' : colors.textSecondary },
              ]}
            >
              🌐 All Time
            </Text>
          </TouchableOpacity>
        </View>

        {/* Month Stepper (Allows inspecting any past month with crystal clear visual feedback) */}
        {activeMonthKey !== 'all' && (
          <View style={styles.stepperRow}>
            <TouchableOpacity
              onPress={handlePrevMonth}
              disabled={currentMonthIdx >= availableMonths.length - 1}
              style={[
                styles.stepperArrow,
                { borderColor: colors.border },
                currentMonthIdx >= availableMonths.length - 1 && { opacity: 0.3 },
              ]}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '800' }}>◀</Text>
            </TouchableOpacity>

            <View style={styles.stepperLabelWrap}>
              <Text style={[Typography.bodySmall, { color: colors.text, fontWeight: '800' }]}>
                {periodLabel}
              </Text>
              <Text style={[Typography.caption, { color: colors.textTertiary, fontSize: 10 }]}>
                Comparing fleet performance
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleNextMonth}
              disabled={currentMonthIdx <= 0}
              style={[
                styles.stepperArrow,
                { borderColor: colors.border },
                currentMonthIdx <= 0 && { opacity: 0.3 },
              ]}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '800' }}>▶</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Fleet Summary KPI Banner ── */}
      {mode === 'cost' && (
        <View style={[styles.kpiBanner, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={styles.kpiCol}>
            <Text style={[styles.kpiColLabel, { color: colors.textTertiary }]}>FLEET TOTAL SPEND</Text>
            <Text style={[styles.kpiColValue, { color: colors.text }]}>
              {formatCurrency(totalPeriodFleetCost)}
            </Text>
          </View>
          <View style={[styles.kpiColDivider, { backgroundColor: colors.border }]} />
          <View style={styles.kpiCol}>
            <Text style={[styles.kpiColLabel, { color: colors.textTertiary }]}>AVG / VEHICLE</Text>
            <Text style={[styles.kpiColValue, { color: colors.primary }]}>
              {formatCurrency(avgCostPerVehicle)}
            </Text>
          </View>
          <View style={[styles.kpiColDivider, { backgroundColor: colors.border }]} />
          <View style={styles.kpiCol}>
            <Text style={[styles.kpiColLabel, { color: colors.textTertiary }]}>TOP SPENDER</Text>
            <Text style={[styles.kpiColValue, { color: colors.accent }]} numberOfLines={1}>
              {highestSpender ? highestSpender.name : '—'}
            </Text>
          </View>
        </View>
      )}

      {mode === 'mileage' && (
        <View style={[styles.kpiBanner, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={styles.kpiCol}>
            <Text style={[styles.kpiColLabel, { color: colors.textTertiary }]}>FLEET AVERAGE</Text>
            <Text style={[styles.kpiColValue, { color: colors.primary }]}>
              {fleetAvgMileage > 0 ? `${fleetAvgMileage.toFixed(1)} km/L` : '—'}
            </Text>
          </View>
          <View style={[styles.kpiColDivider, { backgroundColor: colors.border }]} />
          <View style={styles.kpiCol}>
            <Text style={[styles.kpiColLabel, { color: colors.textTertiary }]}>EFFICIENCY LEADER</Text>
            <Text style={[styles.kpiColValue, { color: colors.success }]} numberOfLines={1}>
              {bestMileageVehicle?.mileage
                ? `${bestMileageVehicle.name} (${bestMileageVehicle.mileage.toFixed(1)})`
                : '—'}
            </Text>
          </View>
        </View>
      )}

      {/* ── Vehicle List: Cost Comparison Mode ── */}
      {mode === 'cost' && (
        <View style={styles.vehicleList}>
          {costList.map((item) => {
            const v = vehicleMap.get(item.id);
            const isSelected = selectedVehicle?.id === item.id;
            const isHighest = item.id === highestSpender?.id && totalPeriodFleetCost > 0;
            const progress = maxCost > 0 && item.cost > 0 ? Math.max(8, Math.round((item.cost / maxCost) * 100)) : 0;
            const share = totalPeriodFleetCost > 0 ? Math.round((item.cost / totalPeriodFleetCost) * 100) : 0;
            const isEV = v?.fuel_type?.toLowerCase().includes('electric');

            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => selectVehicle(item.id)}
                activeOpacity={0.8}
                style={[
                  styles.vehicleCard,
                  {
                    backgroundColor: isSelected ? (colors.primaryLight ?? (colors.primary + '14')) : colors.background,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderWidth: isSelected ? 1.5 : 1,
                  },
                ]}
              >
                {/* Header: Identity + Badges */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.nameGroup}>
                    <Text style={{ fontSize: 18 }}>{getFuelEmoji(v?.fuel_type)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[Typography.body, { color: colors.text, fontWeight: '800' }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[Typography.caption, { color: colors.textTertiary, fontSize: 11 }]}>
                        {v?.make ? `${v.make} ${v.model || ''}` : v?.registration_number || 'Vehicle'}
                        {v?.registration_number && v?.make ? ` • ${v.registration_number}` : ''}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.badgeGroup}>
                    {isSelected && (
                      <View style={[styles.pill, { backgroundColor: colors.primary + '20' }]}>
                        <Text style={[styles.pillText, { color: colors.primary }]}>Active</Text>
                      </View>
                    )}
                    {isHighest && (
                      <View style={[styles.pill, { backgroundColor: colors.accent + '20' }]}>
                        <Text style={[styles.pillText, { color: colors.accent }]}>Highest Spend</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Primary Metric Line */}
                <View style={styles.metricRow}>
                  <Text style={[styles.bigMetric, { color: item.cost > 0 ? colors.text : colors.textTertiary }]}>
                    {item.cost > 0 ? formatCurrency(item.cost) : '₹0'}
                  </Text>
                  {totalPeriodFleetCost > 0 && item.cost > 0 ? (
                    <Text style={[Typography.caption, { color: colors.primary, fontWeight: '700', fontSize: 12 }]}>
                      {share}% of fleet spend
                    </Text>
                  ) : (
                    <Text style={[Typography.caption, { color: colors.textTertiary, fontSize: 11 }]}>
                      No spend in {periodLabel}
                    </Text>
                  )}
                </View>

                {/* Full-Width Comparative Progress Track */}
                <View style={[styles.trackBar, { backgroundColor: colors.borderLight ?? (colors.border + '50') }]}>
                  {progress > 0 && (
                    <View
                      style={[
                        styles.fillBar,
                        {
                          width: `${progress}%`,
                          backgroundColor: isHighest ? colors.accent : (isSelected ? colors.primary : colors.primary + '99'),
                        },
                      ]}
                    />
                  )}
                </View>

                {/* Category Sub-Row */}
                {item.cost > 0 && (
                  <View style={styles.catTagsRow}>
                    {item.fuelCost > 0 && (
                      <View style={[styles.catTag, { backgroundColor: colors.primary + '14' }]}>
                        <Text style={[styles.catTagText, { color: colors.primary }]}>
                          {isEV ? '⚡ Energy' : '⛽ Fuel'}: {formatCompactValue(item.fuelCost)}
                        </Text>
                      </View>
                    )}
                    {item.serviceCost > 0 && (
                      <View style={[styles.catTag, { backgroundColor: colors.accent + '14' }]}>
                        <Text style={[styles.catTagText, { color: colors.accent }]}>
                          🔧 Service: {formatCompactValue(item.serviceCost)}
                        </Text>
                      </View>
                    )}
                    {item.expenseCost > 0 && (
                      <View style={[styles.catTag, { backgroundColor: colors.border }]}>
                        <Text style={[styles.catTagText, { color: colors.textSecondary }]}>
                          📑 Other: {formatCompactValue(item.expenseCost)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Footer Switch Tip */}
                <View style={styles.actionFooter}>
                  <Text
                    style={[
                      Typography.caption,
                      {
                        color: isSelected ? colors.primary : colors.textTertiary,
                        fontWeight: isSelected ? '700' : '500',
                        fontSize: 11,
                      },
                    ]}
                  >
                    {isSelected ? '✓ Current dashboard active vehicle' : 'Tap to switch dashboard to this vehicle ➔'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── Vehicle List: Mileage Comparison Mode ── */}
      {mode === 'mileage' && (
        <View style={styles.vehicleList}>
          {validMileageList.length > 0 ? (
            validMileageList.map((item) => {
              const v = vehicleMap.get(item.id);
              const isSelected = selectedVehicle?.id === item.id;
              const isBest = item.id === bestMileageVehicle?.id;
              const progress = Math.max(12, Math.min(100, ((item.mileage ?? 0) / maxMileage) * 100));
              const diffFromBest = (maxMileage - (item.mileage ?? 0));

              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => selectVehicle(item.id)}
                  activeOpacity={0.8}
                  style={[
                    styles.vehicleCard,
                    {
                      backgroundColor: isSelected ? (colors.primaryLight ?? (colors.primary + '14')) : colors.background,
                      borderColor: isSelected ? colors.primary : colors.border,
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
                          {v?.make ? `${v.make} ${v.model || ''}` : v?.registration_number || 'Vehicle'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.badgeGroup}>
                      {isSelected && (
                        <View style={[styles.pill, { backgroundColor: colors.primary + '20' }]}>
                          <Text style={[styles.pillText, { color: colors.primary }]}>Active</Text>
                        </View>
                      )}
                      {isBest && (
                        <View style={[styles.pill, { backgroundColor: colors.success + '20' }]}>
                          <Text style={[styles.pillText, { color: colors.success }]}>🏆 Leader</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <View style={styles.metricRow}>
                    <Text style={[styles.bigMetric, { color: isBest ? colors.success : colors.text }]}>
                      {formatMileage(item.mileage!, item.mileageUnit)}
                    </Text>
                    <Text style={[Typography.caption, { color: isBest ? colors.success : colors.textSecondary, fontWeight: '600', fontSize: 11 }]}>
                      {isBest ? 'Fleet efficiency leader' : `▼ ${diffFromBest.toFixed(1)} below leader`}
                    </Text>
                  </View>

                  {/* Progress Track */}
                  <View style={[styles.trackBar, { backgroundColor: colors.borderLight ?? (colors.border + '50') }]}>
                    <View
                      style={[
                        styles.fillBar,
                        {
                          width: `${progress}%`,
                          backgroundColor: isBest ? colors.success : (isSelected ? colors.primary : colors.accent),
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.actionFooter}>
                    <Text
                      style={[
                        Typography.caption,
                        {
                          color: isSelected ? colors.primary : colors.textTertiary,
                          fontWeight: isSelected ? '700' : '500',
                          fontSize: 11,
                        },
                      ]}
                    >
                      {isSelected ? '✓ Current dashboard active vehicle' : 'Tap to switch dashboard to this vehicle ➔'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={[styles.emptyBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[Typography.caption, { color: colors.textTertiary, textAlign: 'center' }]}>
                Record full-tank fill-ups or charging logs to compare vehicle efficiencies.
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Sizing.radiusMd,
    padding: Spacing.lg,
    width: '100%',
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
  periodSection: {
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  quickPeriodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  periodChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
  },
  periodChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
  },
  stepperArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperLabelWrap: {
    alignItems: 'center',
  },
  kpiBanner: {
    flexDirection: 'row',
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  kpiCol: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  kpiColDivider: {
    width: 1,
    height: 24,
  },
  kpiColLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  kpiColValue: {
    fontSize: 12,
    fontWeight: '800',
  },
  vehicleList: {
    gap: 10,
  },
  vehicleCard: {
    borderRadius: Sizing.radiusSm,
    padding: Spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  nameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 6,
  },
  bigMetric: {
    fontSize: 18,
    fontWeight: '900',
  },
  trackBar: {
    height: 6,
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
    marginBottom: 8,
  },
  fillBar: {
    height: '100%',
    borderRadius: 3,
  },
  catTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  catTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  catTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  actionFooter: {
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.1)',
  },
  emptyBox: {
    padding: Spacing.lg,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    alignItems: 'center',
  },
});
