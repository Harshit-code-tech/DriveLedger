/**
 * HomeVehicleEssentials
 *
 * Section 8: Vehicle Essentials
 * Quick visibility into essential vehicle conditions:
 * - Estimated Fuel / Battery level(s)
 * - Recommended tyre pressures
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { type Vehicle } from '@/types/vehicle';
import { FuelType, isBiFuel, isElectricFuel, getFuelSystemLabel } from '@/constants/fuelTypes';
import { convertPressure, getPressureLabel } from '@/stores/preferencesStore';
import { type FuelLevelResult } from '@/utils/statsHelpers';
import { CngTankIcon } from '@/components/CngTankIcon';
import { TyreIcon } from '@/components/TyreIcon';
import { Spacing } from '@/constants/theme';
import { type HomePalette } from './homeTheme';

interface HomeVehicleEssentialsProps {
  vehicle: Vehicle;
  primaryFuelLevel: FuelLevelResult | null;
  secondaryFuelLevel: FuelLevelResult | null;
  primaryUnit: string;
  colors: HomePalette;
}

export const HomeVehicleEssentials = React.memo(function HomeVehicleEssentials({
  vehicle,
  primaryFuelLevel,
  secondaryFuelLevel,
  primaryUnit,
  colors,
}: HomeVehicleEssentialsProps) {
  const isEV = isElectricFuel(vehicle.fuel_type as FuelType);
  const isBiFuelVehicle = isBiFuel(vehicle.fuel_type as FuelType);
  const isCng = vehicle.fuel_type === FuelType.CNG;

  const hasTyrePressure =
    vehicle.front_tyre_pressure != null || vehicle.rear_tyre_pressure != null;
  const hasFuelLevels = primaryFuelLevel !== null || secondaryFuelLevel !== null;

  // If vehicle has neither fuel level nor tyre pressures, hide section
  if (!hasFuelLevels && !hasTyrePressure) {
    return null;
  }

  const primaryLabel = isEV
    ? 'Battery Level'
    : isBiFuelVehicle
    ? `${getFuelSystemLabel(vehicle.fuel_type as FuelType, 'primary')} Level`
    : 'Fuel Level';

  const secondaryLabel = isBiFuelVehicle
    ? `Fallback ${getFuelSystemLabel(vehicle.fuel_type as FuelType, 'secondary')} Level`
    : 'Secondary Tank';

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
        Vehicle Essentials
      </Text>

      <View
        style={[
          styles.essentialsCard,
          { backgroundColor: colors.surface, borderColor: colors.borderLight },
        ]}
      >
        {/* ── Primary Fuel / Battery Row ── */}
        {primaryFuelLevel && (
          <View style={styles.essentialRow}>
            <View style={styles.headerLine}>
              <View style={styles.iconTitleRow}>
                {isEV ? (
                  <Text style={styles.emojiIcon}>⚡</Text>
                ) : isBiFuelVehicle || isCng ? (
                  <CngTankIcon size={16} color={colors.accent} showLabel={false} />
                ) : (
                  <Text style={styles.emojiIcon}>⛽</Text>
                )}
                <Text style={[styles.essentialLabel, { color: colors.text }]}>
                  {primaryLabel}
                </Text>
              </View>

              <View style={styles.valueRow}>
                <Text style={[styles.percentageText, { color: colors.accent }]}>
                  {Math.round(primaryFuelLevel.percent)}%
                </Text>
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                  (~{primaryFuelLevel.remainingLitres.toFixed(1)} {primaryUnit})
                </Text>
              </View>
            </View>

            {/* Visual Level Track */}
            <View style={[styles.progressTrack, { backgroundColor: colors.surfaceSecondary }]}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${Math.min(100, Math.max(0, primaryFuelLevel.percent))}%`,
                    backgroundColor: colors.accent,
                  },
                ]}
              />
            </View>
          </View>
        )}

        {/* ── Fallback Secondary Fuel Row for Bi-Fuel ── */}
        {isBiFuelVehicle && secondaryFuelLevel && (
          <View style={[styles.essentialRow, { marginTop: Spacing.sm }]}>
            <View style={styles.headerLine}>
              <View style={styles.iconTitleRow}>
                <Text style={styles.emojiIcon}>⛽</Text>
                <Text style={[styles.essentialLabel, { color: colors.text }]}>
                  {secondaryLabel}
                </Text>
              </View>

              <View style={styles.valueRow}>
                <Text style={[styles.percentageText, { color: colors.accent }]}>
                  {Math.round(secondaryFuelLevel.percent)}%
                </Text>
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                  (~{secondaryFuelLevel.remainingLitres.toFixed(1)} L)
                </Text>
              </View>
            </View>

            {/* Visual Level Track */}
            <View style={[styles.progressTrack, { backgroundColor: colors.surfaceSecondary }]}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${Math.min(100, Math.max(0, secondaryFuelLevel.percent))}%`,
                    backgroundColor: colors.accent,
                  },
                ]}
              />
            </View>
          </View>
        )}

        {/* ── Tyre Pressure Info (if configured) ── */}
        {hasTyrePressure && (
          <View
            style={[
              styles.tyreSection,
              hasFuelLevels && {
                borderTopWidth: 1,
                borderTopColor: colors.borderLight,
                marginTop: Spacing.sm,
                paddingTop: Spacing.sm,
              },
            ]}
          >
            <View style={styles.tyreHeaderRow}>
              <TyreIcon size={18} rimColor={colors.accent} />
              <Text style={[styles.essentialLabel, { color: colors.text }]}>
                Recommended Tyre Pressure
              </Text>
            </View>

            <View style={styles.tyrePressuresRow}>
              {vehicle.front_tyre_pressure != null && (
                <View style={[styles.tyreChip, { backgroundColor: colors.surfaceSecondary }]}>
                  <Text style={[styles.tyreChipLabel, { color: colors.textSecondary }]}>Front</Text>
                  <Text style={[styles.tyreChipValue, { color: colors.text }]}>
                    {convertPressure(vehicle.front_tyre_pressure)} {getPressureLabel()}
                  </Text>
                </View>
              )}

              {vehicle.rear_tyre_pressure != null && (
                <View style={[styles.tyreChip, { backgroundColor: colors.surfaceSecondary }]}>
                  <Text style={[styles.tyreChipLabel, { color: colors.textSecondary }]}>Rear</Text>
                  <Text style={[styles.tyreChipValue, { color: colors.text }]}>
                    {convertPressure(vehicle.rear_tyre_pressure)} {getPressureLabel()}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}
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
  essentialsCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing.md,
  },
  essentialRow: {
    marginBottom: Spacing.xs,
  },
  headerLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  iconTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emojiIcon: {
    fontSize: 14,
  },
  essentialLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  percentageText: {
    fontSize: 14,
    fontWeight: '800',
  },
  detailText: {
    fontSize: 11,
    fontWeight: '600',
  },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  tyreSection: {},
  tyreHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  tyrePressuresRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  tyreChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: 8,
  },
  tyreChipLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  tyreChipValue: {
    fontSize: 13,
    fontWeight: '700',
  },
});
