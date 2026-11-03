/**
 * HomeVehicleOverview
 *
 * Section 6: Vehicle Overview
 * Displays 4 primary vehicle metrics in a 2x2 grid of 4 separated cards,
 * with section heading and dedicated SVG icons for each metric:
 * 1. Odometer
 * 2. Mileage / Efficiency
 * 3. Last Fill / Last Charge
 * 4. Monthly Spend
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { type Vehicle } from '@/types/vehicle';
import { type FuelEntry } from '@/types/fuel';
import { type MileageStats } from '@/engine/mileageEngine';
import { FuelType, isBiFuel, MileageUnit, MILEAGE_UNIT_LABELS } from '@/constants/fuelTypes';
import { formatCurrency, formatMileage, formatOdometer } from '@/utils/format';
import { formatDisplayDateLong } from '@/utils/date';
import { Spacing } from '@/constants/theme';
import { type HomePalette } from './homeTheme';

interface HomeVehicleOverviewProps {
  vehicle: Vehicle;
  entries: FuelEntry[];
  stats: MileageStats;
  monthlyTotal: number;
  colors: HomePalette;
}

export const HomeVehicleOverview = React.memo(function HomeVehicleOverview({
  vehicle,
  entries,
  stats,
  monthlyTotal,
  colors,
}: HomeVehicleOverviewProps) {
  const isEV = vehicle.fuel_type === FuelType.ELECTRIC;
  const isBiFuelVehicle = isBiFuel(vehicle.fuel_type as FuelType);

  const lastEntry = useMemo(() => (entries.length > 0 ? entries[0] : null), [entries]);

  // Efficiency / Mileage value resolution
  const efficiencyDisplay = useMemo(() => {
    if (isEV) {
      if (stats.runningAverage) {
        return `${stats.runningAverage.value.toFixed(1)} km/kWh`;
      }
      if (stats.lastFillMileage) {
        return `${stats.lastFillMileage.value.toFixed(1)} km/kWh`;
      }
      return '—';
    }

    if (isBiFuelVehicle) {
      const avg = stats.primarySystemStats?.runningAverage?.value ?? stats.runningAverage?.value;
      const unit = (stats.primarySystemStats?.runningAverage?.unit ?? stats.runningAverage?.unit) as MileageUnit | undefined;
      if (avg != null && unit && MILEAGE_UNIT_LABELS[unit]) {
        return formatMileage(avg, MILEAGE_UNIT_LABELS[unit]);
      }
      if (stats.lastFillMileage && MILEAGE_UNIT_LABELS[stats.lastFillMileage.unit as MileageUnit]) {
        return formatMileage(stats.lastFillMileage.value, MILEAGE_UNIT_LABELS[stats.lastFillMileage.unit as MileageUnit]);
      }
      return '—';
    }

    if (stats.runningAverage && MILEAGE_UNIT_LABELS[stats.runningAverage.unit as MileageUnit]) {
      return formatMileage(stats.runningAverage.value, MILEAGE_UNIT_LABELS[stats.runningAverage.unit as MileageUnit]);
    }
    if (stats.lastFillMileage && MILEAGE_UNIT_LABELS[stats.lastFillMileage.unit as MileageUnit]) {
      return formatMileage(stats.lastFillMileage.value, MILEAGE_UNIT_LABELS[stats.lastFillMileage.unit as MileageUnit]);
    }
    return '—';
  }, [isEV, isBiFuelVehicle, stats]);

  return (
    <View style={styles.container}>
      {/* ── Section Heading ── */}
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
        Vehicle Overview
      </Text>

      {/* ── 4 Separated Boxes (2x2 Grid) ── */}
      <View style={styles.gridContainer}>
        {/* Row 1: Odometer & Efficiency */}
        <View style={styles.gridRow}>
          {/* Box 1: Odometer */}
          <View
            style={[
              styles.boxCard,
              { backgroundColor: colors.surface, borderColor: colors.borderLight },
            ]}
          >
            <View style={styles.boxHeader}>
              <View style={[styles.iconWrap, { backgroundColor: colors.surfaceSecondary }]}>
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 4C7.58 4 4 7.58 4 12C4 14.21 4.9 16.21 6.34 17.66L7.75 16.25C6.67 15.17 6 13.67 6 12C6 8.69 8.69 6 12 6C15.31 6 18 8.69 18 12C18 13.67 17.33 15.17 16.25 16.25L17.66 17.66C19.1 16.21 20 14.21 20 12C20 7.58 16.42 4 12 4Z"
                    fill={colors.accent}
                  />
                  <Path
                    d="M12 9V12L14.5 14.5"
                    stroke={colors.accent}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Circle cx="12" cy="12" r="1.5" fill={colors.accent} />
                </Svg>
              </View>
              <Text style={[styles.boxLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                Odometer
              </Text>
            </View>
            <Text style={[styles.boxValue, { color: colors.text }]} numberOfLines={1}>
              {vehicle.current_odometer ? formatOdometer(vehicle.current_odometer) : '—'}
            </Text>
          </View>

          {/* Box 2: Mileage / Efficiency */}
          <View
            style={[
              styles.boxCard,
              { backgroundColor: colors.surface, borderColor: colors.borderLight },
            ]}
          >
            <View style={styles.boxHeader}>
              <View style={[styles.iconWrap, { backgroundColor: colors.surfaceSecondary }]}>
                {isEV ? (
                  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
                      stroke={colors.accent}
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                ) : (
                  <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M4 4H14V20H4V4Z"
                      stroke={colors.accent}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <Path d="M7 8H11" stroke={colors.accent} strokeWidth="1.8" strokeLinecap="round" />
                    <Path
                      d="M14 9H16.5C17.33 9 18 9.67 18 10.5V15C18 15.55 17.55 16 17 16H16"
                      stroke={colors.accent}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </Svg>
                )}
              </View>
              <Text style={[styles.boxLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                {isEV ? 'Efficiency' : 'Avg. Mileage'}
              </Text>
            </View>
            <Text
              style={[
                styles.boxValue,
                { color: efficiencyDisplay !== '—' ? colors.accent : colors.text },
              ]}
              numberOfLines={1}
            >
              {efficiencyDisplay}
            </Text>
          </View>
        </View>

        {/* Row 2: Last Fill / Charge & Monthly Spend */}
        <View style={styles.gridRow}>
          {/* Box 3: Last Fill / Charge */}
          <View
            style={[
              styles.boxCard,
              { backgroundColor: colors.surface, borderColor: colors.borderLight },
            ]}
          >
            <View style={styles.boxHeader}>
              <View style={[styles.iconWrap, { backgroundColor: colors.surfaceSecondary }]}>
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                  <Rect x="3" y="4" width="18" height="17" rx="3" stroke={colors.accent} strokeWidth="1.8" />
                  <Path d="M3 9H21" stroke={colors.accent} strokeWidth="1.8" />
                  <Path d="M8 2V5M16 2V5" stroke={colors.accent} strokeWidth="1.8" strokeLinecap="round" />
                  <Circle cx="12" cy="14.5" r="2" fill={colors.accent} />
                </Svg>
              </View>
              <Text style={[styles.boxLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                {isEV ? 'Last Charge' : 'Last Fill'}
              </Text>
            </View>
            <Text style={[styles.boxValue, { color: colors.text }]} numberOfLines={1}>
              {lastEntry ? formatDisplayDateLong(lastEntry.date) : '—'}
            </Text>
          </View>

          {/* Box 4: Monthly Spend */}
          <View
            style={[
              styles.boxCard,
              { backgroundColor: colors.surface, borderColor: colors.borderLight },
            ]}
          >
            <View style={styles.boxHeader}>
              <View style={[styles.iconWrap, { backgroundColor: colors.surfaceSecondary }]}>
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                  <Rect x="2" y="5" width="20" height="14" rx="3" stroke={colors.accent} strokeWidth="1.8" />
                  <Path d="M2 10H22" stroke={colors.accent} strokeWidth="1.8" />
                  <Circle cx="16.5" cy="14.5" r="1.5" fill={colors.accent} />
                </Svg>
              </View>
              <Text style={[styles.boxLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                Monthly Spend
              </Text>
            </View>
            <Text
              style={[
                styles.boxValue,
                { color: monthlyTotal > 0 ? colors.accent : colors.text },
              ]}
              numberOfLines={1}
            >
              {monthlyTotal > 0 ? formatCurrency(monthlyTotal) : '—'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  gridContainer: {
    gap: Spacing.sm,
  },
  gridRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  boxCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 11,
  },
  boxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  boxValue: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});
