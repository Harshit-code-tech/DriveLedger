/**
 * ManagePreferencesScreen
 *
 * Section 7: Preferences screen
 * - Measurement Units: Currency, Distance, Fuel Volume, Tyre Pressure
 * - Application Defaults: Default Vehicle
 * - Appearance: System Theme display (adheres to device dark/light mode)
 */

import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import type { ManagePalette } from '../manageTheme';

interface ManagePreferencesScreenProps {
  currencyLabel: string;
  distanceUnit: string;
  fuelVolumeUnit: string;
  pressureUnit: string;
  defaultVehicleLabel: string;
  themeModeLabel: string;
  onOpenCurrencyPicker: () => void;
  onOpenDistancePicker: () => void;
  onOpenFuelPicker: () => void;
  onOpenPressurePicker: () => void;
  onOpenDefaultVehiclePicker: () => void;
  onOpenThemeModePicker: () => void;
  colors: ManagePalette;
}

export const ManagePreferencesScreen: React.FC<ManagePreferencesScreenProps> = ({
  currencyLabel,
  distanceUnit,
  fuelVolumeUnit,
  pressureUnit,
  defaultVehicleLabel,
  themeModeLabel,
  onOpenCurrencyPicker,
  onOpenDistancePicker,
  onOpenFuelPicker,
  onOpenPressurePicker,
  onOpenDefaultVehiclePicker,
  onOpenThemeModePicker,
  colors,
}) => {
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Section A: Measurement Units ── */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Measurement Units
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          Controls how quantities, distances, and costs are formatted across all screens.
        </Text>
      </View>

      <View style={styles.rowsGroup}>
        {/* Currency */}
        <TouchableOpacity
          style={[
            styles.preferenceRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={onOpenCurrencyPicker}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Currency preference, currently ${currencyLabel}`}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={{ fontSize: 16 }}>💰</Text>
          </View>

          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>
              Currency
            </Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              How costs and prices are formatted
            </Text>
          </View>

          <View style={[styles.valuePill, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.valuePillText, { color: colors.text }]}>
              {currencyLabel}
            </Text>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path
                d="M9 18L15 12L9 6"
                stroke={colors.textSecondary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </TouchableOpacity>

        {/* Distance Unit */}
        <TouchableOpacity
          style={[
            styles.preferenceRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={onOpenDistancePicker}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Distance unit, currently ${distanceUnit === 'km' ? 'Kilometres (km)' : 'Miles (mi)'}`}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={{ fontSize: 16 }}>📏</Text>
          </View>

          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>
              Distance Unit
            </Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              Odometer readings and trip telemetry
            </Text>
          </View>

          <View style={[styles.valuePill, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.valuePillText, { color: colors.text }]}>
              {distanceUnit === 'km' ? 'km' : 'mi'}
            </Text>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path
                d="M9 18L15 12L9 6"
                stroke={colors.textSecondary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </TouchableOpacity>

        {/* Fuel Volume Unit */}
        <TouchableOpacity
          style={[
            styles.preferenceRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={onOpenFuelPicker}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Fuel volume unit, currently ${fuelVolumeUnit === 'litres' ? 'Litres' : 'Gallons'}`}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={{ fontSize: 16 }}>⛽</Text>
          </View>

          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>
              Fuel Volume Unit
            </Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              Quantity of fuel added in fill-up records
            </Text>
          </View>

          <View style={[styles.valuePill, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.valuePillText, { color: colors.text }]}>
              {fuelVolumeUnit === 'litres' ? 'Litres (L)' : 'Gallons (gal)'}
            </Text>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path
                d="M9 18L15 12L9 6"
                stroke={colors.textSecondary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </TouchableOpacity>

        {/* Tyre Pressure Unit */}
        <TouchableOpacity
          style={[
            styles.preferenceRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={onOpenPressurePicker}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Tyre pressure unit, currently ${pressureUnit}`}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={{ fontSize: 16 }}>🔴</Text>
          </View>

          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>
              Tyre Pressure Unit
            </Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              Recommended front and rear pressure display
            </Text>
          </View>

          <View style={[styles.valuePill, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.valuePillText, { color: colors.text }]}>
              {pressureUnit}
            </Text>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path
                d="M9 18L15 12L9 6"
                stroke={colors.textSecondary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Section B: Application Defaults ── */}
      <View style={[styles.sectionHeader, { marginTop: 24 }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Application Defaults
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          Define fallback choices and opening behaviors.
        </Text>
      </View>

      <View style={styles.rowsGroup}>
        {/* Default Vehicle */}
        <TouchableOpacity
          style={[
            styles.preferenceRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={onOpenDefaultVehiclePicker}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Default vehicle, currently ${defaultVehicleLabel}`}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={{ fontSize: 16 }}>🚗</Text>
          </View>

          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>
              Default Vehicle
            </Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              Vehicle automatically selected when the app opens
            </Text>
          </View>

          <View style={[styles.valuePill, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.valuePillText, { color: colors.text }]} numberOfLines={1}>
              {defaultVehicleLabel}
            </Text>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path
                d="M9 18L15 12L9 6"
                stroke={colors.textSecondary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Section C: Appearance ── */}
      <View style={[styles.sectionHeader, { marginTop: 24 }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Appearance
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          Visual theme and device synchronization.
        </Text>
      </View>

      <View style={styles.rowsGroup}>
        <TouchableOpacity
          style={[
            styles.preferenceRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={onOpenThemeModePicker}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Theme mode, currently ${themeModeLabel}`}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={{ fontSize: 16 }}>🌓</Text>
          </View>

          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>
              Theme Mode
            </Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              Switch between Light, Dark, or System Default
            </Text>
          </View>

          <View style={[styles.valuePill, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.valuePillText, { color: colors.text }]} numberOfLines={1}>
              {themeModeLabel}
            </Text>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path
                d="M9 18L15 12L9 6"
                stroke={colors.textSecondary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  rowsGroup: {
    gap: 8,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextCol: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  valuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    maxWidth: 140,
  },
  valuePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  infoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  infoBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
