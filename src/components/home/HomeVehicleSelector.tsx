/**
 * HomeVehicleSelector
 *
 * Section 4: Vehicle Selector
 * Allows users to identify and switch the currently selected vehicle.
 * Displays vehicle icon, name, registration number, fuel/energy type, and dropdown chevron.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useVehicleStore } from '@/stores/vehicleStore';
import { type Vehicle } from '@/types/vehicle';
import { FUEL_TYPE_SHORT_LABELS, type FuelType } from '@/constants/fuelTypes';
import { Spacing } from '@/constants/theme';
import { type HomePalette } from './homeTheme';
import { VehicleTypeIcon } from './VehicleTypeIcon';

interface HomeVehicleSelectorProps {
  vehicle: Vehicle;
  colors: HomePalette;
}

export const HomeVehicleSelector = React.memo(function HomeVehicleSelector({
  vehicle,
  colors,
}: HomeVehicleSelectorProps) {
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);

  const vehicles = useVehicleStore((s) => s.vehicles);
  const selectVehicle = useVehicleStore((s) => s.selectVehicle);

  const fuelTypeLabel = FUEL_TYPE_SHORT_LABELS[vehicle.fuel_type as FuelType] || vehicle.fuel_type;

  const handleSelect = (id: string) => {
    selectVehicle(id);
    setModalVisible(false);
  };

  return (
    <View style={styles.container}>
      {/* ── Main Selector Surface ── */}
      <TouchableOpacity
        style={[
          styles.selectorSurface,
          {
            backgroundColor: colors.surface,
            borderColor: colors.borderLight,
          },
        ]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        {/* Left: Vehicle Icon */}
        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceSecondary }]}>
          <VehicleTypeIcon type={vehicle.vehicle_type} size={22} />
        </View>

        {/* Center: Vehicle Details */}
        <View style={styles.infoCol}>
          <View style={styles.nameRow}>
            <Text style={[styles.nickname, { color: colors.text }]} numberOfLines={1}>
              {vehicle.nickname}
            </Text>
            <View style={[styles.fuelPill, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.fuelPillText, { color: colors.accentDark }]}>
                {fuelTypeLabel}
              </Text>
            </View>
          </View>
          <Text style={[styles.regNumber, { color: colors.textSecondary }]}>
            {vehicle.registration_number}
          </Text>
        </View>

        {/* Right: Dropdown Chevron */}
        <View style={styles.chevronWrap}>
          <Text style={[styles.chevron, { color: colors.textTertiary }]}>▾</Text>
        </View>
      </TouchableOpacity>

      {/* ── Vehicle Switcher Modal ── */}
      {modalVisible && (
        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setModalVisible(false)}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setModalVisible(false)}>
            <Pressable
              style={[
                styles.modalCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Select Vehicle</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={8}>
                  <Text style={[styles.modalCloseText, { color: colors.textSecondary }]}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Vehicle List */}
              <ScrollView style={styles.vehicleList} showsVerticalScrollIndicator={false}>
                {vehicles.map((v) => {
                  const isSelected = v.id === vehicle.id;
                  const vFuelLabel = FUEL_TYPE_SHORT_LABELS[v.fuel_type as FuelType] || v.fuel_type;
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[
                        styles.vehicleItem,
                        {
                          backgroundColor: isSelected ? colors.surfaceSecondary : 'transparent',
                          borderColor: isSelected ? colors.accent : colors.borderLight,
                        },
                      ]}
                      onPress={() => handleSelect(v.id)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.itemIconWrap,
                          {
                            backgroundColor: colors.surfaceSecondary,
                          },
                        ]}
                      >
                        <VehicleTypeIcon
                          type={v.vehicle_type}
                          size={18}
                        />
                      </View>
                      <View style={styles.itemInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text
                            style={[
                              styles.itemNickname,
                              {
                                color: isSelected ? colors.accent : colors.text,
                                fontWeight: isSelected ? '700' : '600',
                              },
                            ]}
                          >
                            {v.nickname}
                          </Text>
                          <Text style={[styles.itemFuelBadge, { color: colors.textSecondary }]}>
                            · {vFuelLabel}
                          </Text>
                        </View>
                        <Text style={[styles.itemReg, { color: colors.textTertiary }]}>
                          {v.registration_number}
                        </Text>
                      </View>
                      {isSelected && (
                        <Text style={[styles.checkmark, { color: colors.accent }]}>✓</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Footer actions: Add Vehicle & Edit Current Vehicle */}
              <View style={[styles.modalFooter, { borderTopColor: colors.borderLight }]}>
                <TouchableOpacity
                  style={[styles.footerBtn, { borderColor: colors.borderLight }]}
                  onPress={() => {
                    setModalVisible(false);
                    router.push({
                      pathname: '/edit-vehicle',
                      params: { vehicleId: vehicle.id },
                    });
                  }}
                >
                  <Text style={[styles.footerBtnText, { color: colors.textSecondary }]}>
                    Edit Vehicle
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.footerBtnPrimary, { backgroundColor: colors.accent }]}
                  onPress={() => {
                    setModalVisible(false);
                    router.push('/add-vehicle');
                  }}
                >
                  <Text style={[styles.footerBtnTextPrimary, { color: '#FFFFFF' }]}>
                    + Add Vehicle
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  selectorSurface: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nickname: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  fuelPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  fuelPillText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  regNumber: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
    letterSpacing: 0.3,
  },
  chevronWrap: {
    paddingLeft: Spacing.xs,
    paddingRight: 4,
  },
  chevron: {
    fontSize: 18,
    fontWeight: '700',
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '600',
    padding: 4,
  },
  vehicleList: {
    padding: Spacing.md,
    maxHeight: 300,
  },
  vehicleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  itemIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  itemInfo: {
    flex: 1,
  },
  itemNickname: {
    fontSize: 15,
  },
  itemFuelBadge: {
    fontSize: 12,
  },
  itemReg: {
    fontSize: 11,
    marginTop: 2,
  },
  checkmark: {
    fontSize: 16,
    fontWeight: '800',
    marginLeft: Spacing.xs,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderTopWidth: 1,
  },
  footerBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  footerBtnPrimary: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBtnTextPrimary: {
    fontSize: 13,
    fontWeight: '700',
  },
});

