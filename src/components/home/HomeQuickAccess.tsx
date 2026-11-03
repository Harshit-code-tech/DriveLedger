/**
 * HomeQuickAccess
 *
 * Section 9: Quick Access
 * Compact shortcuts to existing frequently used actions:
 * - Maintenance Targets
 * - Highway Readiness Checks
 * - Log Fuel / Charge
 * - Log Expense
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { type Vehicle } from '@/types/vehicle';
import { isElectricFuel, type FuelType } from '@/constants/fuelTypes';
import { Spacing } from '@/constants/theme';
import { type HomePalette } from './homeTheme';

interface HomeQuickAccessProps {
  vehicle: Vehicle;
  checklistCount: { completed: number; total: number; isComplete: boolean };
  onOpenProfilesModal: () => void;
  onOpenChecklistModal: () => void;
  colors: HomePalette;
}

export const HomeQuickAccess = React.memo(function HomeQuickAccess({
  vehicle,
  checklistCount,
  onOpenProfilesModal,
  onOpenChecklistModal,
  colors,
}: HomeQuickAccessProps) {
  const router = useRouter();
  const isEV = isElectricFuel(vehicle.fuel_type as FuelType);

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
        Quick Access
      </Text>

      <View style={styles.grid}>
        {/* Shortcut 1: Log Fuel / Add Charge */}
        <TouchableOpacity
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.borderLight },
          ]}
          onPress={() =>
            router.push({
              pathname: '/add-fuel',
              params: { vehicleId: vehicle.id },
            })
          }
          activeOpacity={0.75}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={styles.icon}>{isEV ? '⚡' : '⛽'}</Text>
          </View>
          <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
            {isEV ? 'Log Charge' : 'Log Refill'}
          </Text>
          <Text style={[styles.sublabel, { color: colors.textSecondary }]}>Fuel entry</Text>
        </TouchableOpacity>

        {/* Shortcut 2: Log Expense */}
        <TouchableOpacity
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.borderLight },
          ]}
          onPress={() =>
            router.push({
              pathname: '/add-expense',
              params: { vehicleId: vehicle.id },
            })
          }
          activeOpacity={0.75}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={styles.icon}>💳</Text>
          </View>
          <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
            Log Expense
          </Text>
          <Text style={[styles.sublabel, { color: colors.textSecondary }]}>Tolls, parking</Text>
        </TouchableOpacity>

        {/* Shortcut 3: Highway Checks */}
        <TouchableOpacity
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.borderLight },
          ]}
          onPress={onOpenChecklistModal}
          activeOpacity={0.75}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={styles.icon}>🛣️</Text>
          </View>
          <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
            Highway Checks
          </Text>
          <Text
            style={[
              styles.sublabel,
              { color: checklistCount.isComplete ? colors.statusNormal : colors.textSecondary },
            ]}
          >
            {checklistCount.isComplete ? 'Ready ✅' : `${checklistCount.completed}/${checklistCount.total}`}
          </Text>
        </TouchableOpacity>

        {/* Shortcut 4: Maintenance Targets */}
        <TouchableOpacity
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.borderLight },
          ]}
          onPress={onOpenProfilesModal}
          activeOpacity={0.75}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={styles.icon}>🎯</Text>
          </View>
          <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
            Targets
          </Text>
          <Text style={[styles.sublabel, { color: colors.textSecondary }]}>Intervals</Text>
        </TouchableOpacity>
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
  grid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  card: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  icon: {
    fontSize: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  sublabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
});

