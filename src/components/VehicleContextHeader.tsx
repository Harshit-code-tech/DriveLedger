/**
 * VehicleContextHeader — Vehicle Identification & Switcher
 *
 * Displays which vehicle the user is currently viewing/logging for.
 * When multiple vehicles exist, shows a horizontal chip row to switch.
 *
 * DESIGN PHILOSOPHY:
 * - Minimal footprint: single-line text when only 1 vehicle
 * - Compact chip row when 2+ vehicles (same pattern as dashboard)
 * - Never overwhelming — designed to sit quietly below headers
 *
 * USAGE:
 * Import and place at the top of any screen that operates on selectedVehicle.
 */

import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useVehicleStore } from '@/stores/vehicleStore';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Spacing, Sizing } from '@/constants/theme';

interface VehicleContextHeaderProps {
  /**
   * Optional label prefix, e.g. "Logging for" or "Stats for".
   * Shown only when there's exactly 1 vehicle (no chip row needed).
   */
  label?: string;
  /**
   * If true, hides the single-vehicle bar completely when there's only 1 vehicle
   * (avoids duplicate title on screens with their own vehicle header).
   */
  hideIfSingle?: boolean;
}

export function VehicleContextHeader({ label = 'For', hideIfSingle = false }: VehicleContextHeaderProps) {
  const colors = useThemeColors();
  const vehicles = useVehicleStore((s) => s.vehicles);
  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);
  const selectVehicle = useVehicleStore((s) => s.selectVehicle);

  if (!selectedVehicle) return null;

  // Single vehicle — subtle inline label or hidden if requested
  if (vehicles.length <= 1) {
    if (hideIfSingle) return null;
    return (
      <View style={[styles.singleContainer, { borderBottomColor: colors.border }]}>
        <Text style={[styles.singleLabel, { color: colors.textTertiary }]}>
          {label}
        </Text>
        <Text style={[styles.singleName, { color: colors.text }]} numberOfLines={1}>
          {selectedVehicle.nickname}
        </Text>
        <Text style={[styles.singleReg, { color: colors.textTertiary }]}>
          {selectedVehicle.registration_number}
        </Text>
      </View>
    );
  }

  // Multiple vehicles — horizontal chip row
  return (
    <View style={[styles.multiContainer, { borderBottomColor: colors.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipScroll}
      >
        {vehicles.map((v) => {
          const isSelected = v.id === selectedVehicle.id;
          return (
            <Pressable
              key={v.id}
              onPress={() => selectVehicle(v.id)}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? colors.primary : colors.surface,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: isSelected ? colors.textOnPrimary : colors.text },
                ]}
                numberOfLines={1}
              >
                {v.nickname}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Single Vehicle (minimal) ──
  singleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.xs,
  },
  singleLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  singleName: {
    fontSize: 13,
    fontWeight: '700',
  },
  singleReg: {
    fontSize: 11,
    fontWeight: '400',
  },

  // ── Multiple Vehicles (chip row) ──
  multiContainer: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chipScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1.5,
    minHeight: 32,
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
