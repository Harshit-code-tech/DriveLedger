/**
 * EfficiencyScreen Component
 *
 * Section 5: Efficiency Screen
 * Focused exclusively on vehicle efficiency and mileage analysis:
 * - A. Fuel configuration context with correct units (km/L, km/kg, km/kWh)
 * - B. Mileage Trendline (MileageTrendChart) with 10 valid full fills, running avg, point inspector
 * - C. Partial-fill handling & educational notice (clarifying estimates vs verified full tanks)
 * - D. Dual-fuel performance card (separate streams when vehicle has bi-fuel configuration)
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Spacing, Typography, Sizing } from '@/constants/theme';
import { formatMileage } from '@/utils/format';
import { FuelType, MILEAGE_UNIT_LABELS, isHybridFuel, getFuelSystemLabel } from '@/constants/fuelTypes';
import { CngTankIcon } from '@/components/CngTankIcon';
import { MileageTrendChart, type MileagePoint } from '@/components/charts/MileageTrendChart';
import type { Vehicle } from '@/types/vehicle';
import type { MileageStats } from '@/engine/mileageEngine';
import type { InsightsPalette } from '../insightsTheme';
import { getEfficiencyUnit } from '../insightsHelpers';

interface EfficiencyScreenProps {
  vehicle: Vehicle;
  isEV: boolean;
  mileageTrendData: {
    points: MileagePoint[];
    average: number | null;
    unitLabel: string;
  };
  stats: MileageStats;
  biFuelTrendFilter: 'all' | 'primary' | 'secondary';
  onBiFuelFilterChange: (filter: 'all' | 'primary' | 'secondary') => void;
  colors: InsightsPalette;
}

export const EfficiencyScreen: React.FC<EfficiencyScreenProps> = ({
  vehicle,
  isEV,
  mileageTrendData,
  stats,
  biFuelTrendFilter,
  onBiFuelFilterChange,
  colors,
}) => {
  const isBiFuel = isHybridFuel(vehicle.fuel_type as FuelType);
  const efficiencyUnit = getEfficiencyUnit(vehicle.fuel_type);

  const getFuelTypeDisplay = (ft?: string) => {
    switch (ft) {
      case FuelType.ELECTRIC:
        return { name: 'Pure Electric (EV)', unit: 'km/kWh', icon: '⚡' };
      case FuelType.CNG:
        return { name: 'Compressed Natural Gas (CNG)', unit: 'km/kg', icon: '🟢' };
      case FuelType.DIESEL:
        return { name: 'Diesel', unit: 'km/L', icon: '🛢️' };
      case FuelType.HYBRID_CNG_PETROL:
        return { name: 'Bi-Fuel (CNG + Petrol)', unit: 'km/kg & km/L', icon: '🟢' };
      case FuelType.HYBRID_LPG_PETROL:
        return { name: 'Bi-Fuel (LPG + Petrol)', unit: 'km/kg & km/L', icon: '🟡' };
      default:
        return { name: 'Petrol (Gasoline)', unit: 'km/L', icon: '⛽' };
    }
  };

  const fuelConfig = getFuelTypeDisplay(vehicle.fuel_type);

  return (
    <View style={styles.container}>
      {/* ── Section A: Fuel Configuration Context ── */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.configHeader}>
          <View style={[styles.fuelIconBadge, { backgroundColor: colors.accent + '15' }]}>
            <Text style={{ fontSize: 20 }}>{fuelConfig.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.configLabel, { color: colors.textTertiary }]}>POWERTRAIN CONFIGURATION</Text>
            <Text style={[Typography.body, { color: colors.text, fontWeight: '800' }]}>
              {fuelConfig.name}
            </Text>
          </View>
          <View style={[styles.unitPill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Text style={[Typography.caption, { color: colors.accent, fontWeight: '800' }]}>
              Unit: {fuelConfig.unit}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Section B: Mileage Trendline Chart ── */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.chartHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[Typography.h3, { color: colors.text, fontWeight: '800' }]}>
              {isEV ? 'Efficiency Trendline' : 'Mileage Trendline'}
            </Text>
            <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
              {isEV
                ? 'Energy consumption rate (km/kWh) across full charges'
                : 'Tank-to-tank efficiency curve with rolling average reference line'}
            </Text>
          </View>

          {/* Bi-Fuel Stream Filter */}
          {isBiFuel && (
            <View style={[styles.segmentControl, { borderColor: colors.border }]}>
              {(['all', 'primary', 'secondary'] as const).map((sys) => (
                <TouchableOpacity
                  key={sys}
                  style={[
                    styles.segmentBtn,
                    biFuelTrendFilter === sys && { backgroundColor: colors.accent },
                  ]}
                  onPress={() => onBiFuelFilterChange(sys)}
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
                    {sys === 'all'
                      ? 'All'
                      : sys === 'primary'
                        ? vehicle.fuel_type === FuelType.HYBRID_LPG_PETROL
                          ? 'LPG'
                          : 'CNG'
                        : 'Petrol'}
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

      {/* ── Section D: Dual-Fuel Performance (Conditional on bi-fuel vehicles) ── */}
      {isBiFuel && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm }}>
            <Text style={[Typography.h3, { color: colors.text, fontWeight: '800' }]}>
              Dual-Fuel Stream Performance
            </Text>
            <CngTankIcon size={18} />
            <Text style={{ fontSize: 18 }}>⛽</Text>
          </View>

          <Text style={[Typography.caption, { color: colors.textTertiary, marginBottom: Spacing.md }]}>
            Independent efficiency tracking for primary and secondary fuel tanks
          </Text>

          <View style={styles.dualGrid}>
            <View style={[styles.dualCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <CngTankIcon size={14} />
                <Text style={[styles.dualLabel, { color: colors.textSecondary }]}>
                  {getFuelSystemLabel(vehicle.fuel_type as FuelType, 'primary')}
                </Text>
              </View>
              <Text style={[Typography.statMedium, { color: colors.accent, marginTop: 4, fontWeight: '800' }]}>
                {stats.primarySystemStats?.runningAverage
                  ? formatMileage(
                      stats.primarySystemStats.runningAverage.value,
                      MILEAGE_UNIT_LABELS[stats.primarySystemStats.runningAverage.unit]
                    )
                  : '—'}
              </Text>
              <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 2, fontSize: 11 }]}>
                Primary Gas Average
              </Text>
            </View>

            <View style={[styles.dualCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text style={{ fontSize: 14 }}>⛽</Text>
                <Text style={[styles.dualLabel, { color: colors.textSecondary }]}>
                  {getFuelSystemLabel(vehicle.fuel_type as FuelType, 'secondary')}
                </Text>
              </View>
              <Text style={[Typography.statMedium, { color: colors.tierOrange, marginTop: 4, fontWeight: '800' }]}>
                {stats.secondarySystemStats?.runningAverage
                  ? formatMileage(
                      stats.secondarySystemStats.runningAverage.value,
                      MILEAGE_UNIT_LABELS[stats.secondarySystemStats.runningAverage.unit]
                    )
                  : '—'}
              </Text>
              <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 2, fontSize: 11 }]}>
                Secondary Liquid Average
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* ── Section C: Partial-Fill Handling & Verification Notice ── */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.noticeHeader}>
          <Text style={{ fontSize: 18 }}>ℹ️</Text>
          <Text style={[Typography.body, { color: colors.text, fontWeight: '800' }]}>
            Mileage Calculation & Verification Rules
          </Text>
        </View>

        <Text style={[Typography.caption, { color: colors.textSecondary, lineHeight: 18, marginTop: 6 }]}>
          • <Text style={{ fontWeight: '700', color: colors.text }}>Tank-to-Tank Method:</Text> Official verified mileage requires two consecutive full-tank refills. Distance driven between refills is divided by the fuel needed to replenish the tank.
        </Text>

        <Text style={[Typography.caption, { color: colors.textSecondary, lineHeight: 18, marginTop: 4 }]}>
          • <Text style={{ fontWeight: '700', color: colors.text }}>Partial Fills Separated:</Text> Partial fill records are treated as replenishment estimates and marked with a tilde (~). They are NEVER mixed into the verified running average.
        </Text>

        <Text style={[Typography.caption, { color: colors.textSecondary, lineHeight: 18, marginTop: 4 }]}>
          • <Text style={{ fontWeight: '700', color: colors.text }}>Offline Determinism:</Text> All calculations run strictly on device without third-party heuristics.
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
  configHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  fuelIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  configLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  unitPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
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
    paddingVertical: 5,
  },
  dualGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  dualCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
  },
  dualLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
