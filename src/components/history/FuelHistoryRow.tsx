import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FuelType, MILEAGE_UNIT_LABELS, getFuelSystemLabel, isHybridFuel } from '@/constants/fuelTypes';
import { Sizing, Spacing, Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { FuelEntry } from '@/types/fuel';
import type { Vehicle } from '@/types/vehicle';
import { formatDisplayDateLong } from '@/utils/date';
import { formatCurrency } from '@/utils/format';

interface FuelHistoryRowProps {
  item: FuelEntry;
  isEV: boolean;
  selectedVehicle: Vehicle | null;
  onPress: (entry: FuelEntry) => void;
  onLongPress: (entry: FuelEntry) => void;
}

export const FuelHistoryRow = memo(function FuelHistoryRow({
  item,
  isEV,
  selectedVehicle,
  onPress,
  onLongPress,
}: FuelHistoryRowProps) {
  const colors = useThemeColors();

  return (
    <TouchableOpacity
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
      activeOpacity={0.7}
      style={[styles.entryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.entryHeader}>
        <Text style={[Typography.body, { color: colors.text, fontWeight: '600' }]}>
          {formatDisplayDateLong(item.date)}
        </Text>
        <Text style={[Typography.body, { color: colors.primary, fontWeight: '700' }]}>
          {formatCurrency(item.total_cost)}
        </Text>
      </View>
      <View style={styles.entryDetails}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
            {item.fuel_amount} {item.fuel_unit} · {formatCurrency(item.price_per_unit)}/
            {item.fuel_unit === 'kWh' ? 'kWh' : item.fuel_unit === 'kg' ? 'kg' : 'L'}
          </Text>
          {item.fuel_system === 'secondary' && selectedVehicle && (
            <View style={[styles.badge, { backgroundColor: '#FEF3C7', paddingVertical: 1, paddingHorizontal: 6 }]}>
              <Text style={[Typography.caption, { color: '#B45309', fontWeight: '700', fontSize: 10 }]}>
                {getFuelSystemLabel(selectedVehicle.fuel_type as FuelType, 'secondary')}
              </Text>
            </View>
          )}
          {item.fuel_system === 'primary' && selectedVehicle && isHybridFuel(selectedVehicle.fuel_type as FuelType) && (
            <View style={[styles.badge, { backgroundColor: colors.primaryLight, paddingVertical: 1, paddingHorizontal: 6 }]}>
              <Text style={[Typography.caption, { color: colors.primary, fontWeight: '700', fontSize: 10 }]}>
                {getFuelSystemLabel(selectedVehicle.fuel_type as FuelType, 'primary')}
              </Text>
            </View>
          )}
        </View>
        <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
          {item.odometer.toLocaleString('en-IN')} km
        </Text>
      </View>
      {item.fuel_station ? (
        <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
          {isEV ? '⚡' : '📍'} {item.fuel_station}
        </Text>
      ) : null}
      {item.battery_start_percent != null && item.battery_end_percent != null && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
          <View style={[styles.badge, { backgroundColor: colors.primaryLight + '50', paddingVertical: 1, paddingHorizontal: 6 }]}>
            <Text style={[Typography.caption, { color: colors.primary, fontWeight: '700', fontSize: 10 }]}>
              🔋 {item.battery_start_percent}% → {item.battery_end_percent}% (+{Math.round(item.battery_end_percent - item.battery_start_percent)}%)
            </Text>
          </View>
        </View>
      )}
      {item.calculated_mileage && item.mileage_unit ? (
        <View style={[styles.badge, { backgroundColor: colors.successLight }]}>
          <Text style={[Typography.caption, { color: colors.success }]}>
            {item.calculated_mileage.toFixed(1)} {MILEAGE_UNIT_LABELS[item.mileage_unit]}
          </Text>
        </View>
      ) : null}
      {!item.calculated_mileage && item.is_full_tank === 0 ? (
        <View style={[styles.badge, { backgroundColor: colors.warningLight }]}>
          <Text style={[Typography.caption, { color: colors.warning }]}>Partial Fill</Text>
        </View>
      ) : null}
      <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
        Tap to edit · Long press to delete
      </Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  entryCard: {
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  entryDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Sizing.radiusFull,
    marginTop: Spacing.sm,
  },
});
