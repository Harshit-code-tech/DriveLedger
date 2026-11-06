/**
 * ManageVehiclesScreen
 *
 * Section 6: Vehicles screen
 * - Registered vehicles count & list
 * - Compact horizontal layout: Vehicle icon left, details middle, active status / actions right
 * - Active vehicle selection (updates global vehicleStore)
 * - Edit, Archive, and Restore interactions
 * - Add Vehicle button
 */

import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import type { Vehicle } from '@/types/vehicle';
import { FUEL_TYPE_SHORT_LABELS, VehicleType } from '@/constants/fuelTypes';
import type { ManagePalette } from '../manageTheme';
import { VehicleSvgIcon } from '../VehicleSvgIcon';

interface ManageVehiclesScreenProps {
  vehicles: Vehicle[];
  selectedVehicleId: string | null;
  defaultVehicleId: string | null;
  archivedVehicles: Vehicle[];
  pressureUnit: string;
  onSelectVehicle: (id: string) => void;
  onEditVehicle: (id: string) => void;
  onArchiveVehicle: (vehicle: Vehicle) => void;
  onRestoreVehicle: (vehicle: Vehicle) => void;
  onAddVehicle: () => void;
  colors: ManagePalette;
}

export const ManageVehiclesScreen: React.FC<ManageVehiclesScreenProps> = ({
  vehicles,
  selectedVehicleId,
  defaultVehicleId,
  archivedVehicles,
  pressureUnit,
  onSelectVehicle,
  onEditVehicle,
  onArchiveVehicle,
  onRestoreVehicle,
  onAddVehicle,
  colors,
}) => {
  const [showArchived, setShowArchived] = useState(false);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Context & Count ── */}
      <View style={styles.headerBox}>
        <View style={styles.headerRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Registered Vehicles
          </Text>
          <View
            style={[
              styles.countBadge,
              { backgroundColor: colors.surfaceSecondary },
            ]}
          >
            <Text style={[styles.countBadgeText, { color: colors.textSecondary }]}>
              {vehicles.length} {vehicles.length === 1 ? 'vehicle' : 'vehicles'}
            </Text>
          </View>
        </View>
        <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          Manage your vehicles, change specs, or switch the active vehicle used across all tabs.
        </Text>
      </View>

      {/* ── Active Vehicle Explanation Card ── */}
      <View
        style={[
          styles.activeExplainCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.activeExplainHeader}>
          <Text style={{ fontSize: 16 }}>💡</Text>
          <Text style={[styles.activeExplainTitle, { color: colors.text }]}>
            What does "Active" mean?
          </Text>
        </View>
        <Text style={[styles.activeExplainBody, { color: colors.textSecondary }]}>
          The <Text style={{ fontWeight: '700', color: colors.statusNormal }}>ACTIVE</Text> vehicle is the one currently loaded on your <Text style={{ fontWeight: '600' }}>Home dashboard, Records, Documents, and Insights</Text>. All new fuel logs, expenses, and GPS trips are recorded for this vehicle.
        </Text>
        <Text style={[styles.activeExplainSubtext, { color: colors.accent, marginTop: 4 }]}>
          👉 Tap any vehicle below to switch to it immediately.
        </Text>
      </View>

      {/* ── Active Vehicles List ── */}
      <View style={styles.vehicleList}>
        {vehicles.map((v, index) => {
          const isActive = v.id === selectedVehicleId;
          const isDefault =
            v.id === defaultVehicleId ||
            (!defaultVehicleId && vehicles[0]?.id === v.id);

          const fuelLabel =
            FUEL_TYPE_SHORT_LABELS[v.fuel_type as keyof typeof FUEL_TYPE_SHORT_LABELS] ||
            v.fuel_type;

          const yearModel = [
            v.year ? `${v.year}` : '',
            v.manufacturer,
            v.model,
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <TouchableOpacity
              key={v.id}
              style={[
                styles.vehicleRow,
                {
                  backgroundColor: colors.surface,
                  borderColor: isActive ? colors.accent : colors.border,
                  borderWidth: isActive ? 1.5 : 1,
                },
              ]}
              onPress={() => onSelectVehicle(v.id)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`${v.nickname}, ${isActive ? 'Currently active' : 'Tap to make active'}`}
            >
              {/* Left icon */}
              <View
                style={[
                  styles.vehicleIconBox,
                  {
                    backgroundColor: isActive
                      ? 'rgba(57, 131, 199, 0.12)'
                      : colors.surfaceSecondary,
                  },
                ]}
              >
                <VehicleSvgIcon
                  vehicleType={v.vehicle_type}
                  color={isActive ? colors.accent : colors.textSecondary}
                  size={24}
                />
              </View>

              {/* Middle details */}
              <View style={styles.vehicleCenter}>
                <View style={styles.nameRow}>
                  <Text
                    style={[styles.vehicleNickname, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {v.nickname}
                  </Text>
                  {isDefault && (
                    <View
                      style={[
                        styles.defaultBadge,
                        { backgroundColor: colors.surfaceSecondary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.defaultBadgeText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        DEFAULT
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.metaRow}>
                  <View
                    style={[
                      styles.wheelBadge,
                      {
                        backgroundColor: colors.surfaceSecondary,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.wheelBadgeText, { color: colors.textSecondary }]}
                    >
                      {v.vehicle_type === VehicleType.TWO_WHEELER
                        ? '2W'
                        : v.vehicle_type === VehicleType.THREE_WHEELER
                        ? '3W'
                        : v.vehicle_type === VehicleType.OTHER
                        ? 'Multi'
                        : '4W'}
                    </Text>
                  </View>

                  {v.registration_number ? (
                    <Text
                      style={[
                        styles.regText,
                        {
                          color: colors.textSecondary,
                          backgroundColor: colors.surfaceSecondary,
                        },
                      ]}
                    >
                      {v.registration_number}
                    </Text>
                  ) : null}

                  <Text
                    style={[styles.metaSubtext, { color: colors.textSecondary }]}
                  >
                    {fuelLabel}
                  </Text>

                  {yearModel ? (
                    <Text
                      style={[styles.metaSubtext, { color: colors.textTertiary }]}
                      numberOfLines={1}
                    >
                      · {yearModel}
                    </Text>
                  ) : null}
                </View>

                {(v.front_tyre_pressure || v.rear_tyre_pressure) && (
                  <Text
                    style={[styles.tyreText, { color: colors.textTertiary }]}
                    numberOfLines={1}
                  >
                    Tyre: {v.front_tyre_pressure ? `F ${v.front_tyre_pressure}` : ''}
                    {v.front_tyre_pressure && v.rear_tyre_pressure ? ' · ' : ''}
                    {v.rear_tyre_pressure ? `R ${v.rear_tyre_pressure}` : ''} {pressureUnit}
                  </Text>
                )}
              </View>

              {/* Right actions */}
              <View style={styles.vehicleRight}>
                {isActive ? (
                  <View
                    style={[
                      styles.activeTag,
                      {
                        backgroundColor: colors.statusNormalBg,
                        borderColor: colors.statusNormal + '30',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.activeTagText,
                        { color: colors.statusNormal },
                      ]}
                    >
                      ● ACTIVE NOW
                    </Text>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.selectTag,
                      {
                        backgroundColor: colors.surfaceSecondary,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.selectTagText,
                        { color: colors.accent },
                      ]}
                    >
                      Set Active
                    </Text>
                  </View>
                )}

                <View style={styles.buttonActionRow}>
                  <TouchableOpacity
                    style={[
                      styles.actionIconBtn,
                      { borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
                    ]}
                    onPress={() => onEditVehicle(v.id)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${v.nickname}`}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={[styles.actionBtnText, { color: colors.accent }]}>
                      Edit
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionIconBtn,
                      { borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
                    ]}
                    onPress={() => onArchiveVehicle(v)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Archive ${v.nickname}`}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text
                      style={[styles.actionBtnText, { color: colors.textTertiary }]}
                    >
                      Archive
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Add Vehicle Action ── */}
      <TouchableOpacity
        style={[
          styles.addVehicleBtn,
          {
            backgroundColor: colors.surface,
            borderColor: colors.accent,
          },
        ]}
        onPress={onAddVehicle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Add another vehicle"
      >
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 5V19M5 12H19"
            stroke={colors.accent}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        </Svg>
        <Text style={[styles.addVehicleBtnText, { color: colors.accent }]}>
          Add Another Vehicle
        </Text>
      </TouchableOpacity>

      {/* ── Archived Vehicles ── */}
      {archivedVehicles.length > 0 && (
        <View style={styles.archivedContainer}>
          <TouchableOpacity
            style={[
              styles.archivedToggleBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={() => setShowArchived(!showArchived)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Toggle archived vehicles list"
          >
            <Text style={[styles.archivedToggleText, { color: colors.textSecondary }]}>
              {showArchived ? 'Hide' : 'Show'} Archived Vehicles ({archivedVehicles.length})
            </Text>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path
                d={showArchived ? 'M18 15L12 9L6 15' : 'M6 9L12 15L18 9'}
                stroke={colors.textSecondary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </TouchableOpacity>

          {showArchived && (
            <View style={styles.archivedList}>
              {archivedVehicles.map((v) => (
                <View
                  key={v.id}
                  style={[
                    styles.archivedRow,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.archivedIconBox,
                      { backgroundColor: colors.surfaceSecondary },
                    ]}
                  >
                    <VehicleSvgIcon
                      vehicleType={v.vehicle_type}
                      color={colors.textTertiary}
                      size={20}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.archivedName, { color: colors.text }]}
                    >
                      {v.nickname}
                    </Text>
                    <Text
                      style={[
                        styles.archivedMeta,
                        { color: colors.textTertiary },
                      ]}
                    >
                      {v.registration_number} · Archived
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.restoreBtn,
                      {
                        backgroundColor: colors.statusNormalBg,
                        borderColor: colors.statusNormal + '40',
                      },
                    ]}
                    onPress={() => onRestoreVehicle(v)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Restore ${v.nickname}`}
                  >
                    <Text
                      style={[
                        styles.restoreBtnText,
                        { color: colors.statusNormal },
                      ]}
                    >
                      Restore
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
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
  headerBox: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sectionDescription: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  activeExplainCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  activeExplainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  activeExplainTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  activeExplainBody: {
    fontSize: 12,
    lineHeight: 17,
  },
  activeExplainSubtext: {
    fontSize: 11,
    fontWeight: '600',
  },
  vehicleList: {
    gap: 10,
    marginBottom: 16,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  vehicleIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleCenter: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vehicleNickname: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  defaultBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  defaultBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 3,
  },
  regText: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  wheelBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  wheelBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  metaSubtext: {
    fontSize: 11,
    fontWeight: '500',
  },
  tyreText: {
    fontSize: 10,
    marginTop: 2,
  },
  vehicleRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  activeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  activeTagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  selectTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  selectTagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  buttonActionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  actionIconBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  addVehicleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    marginBottom: 20,
  },
  addVehicleBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  archivedContainer: {
    marginTop: 4,
  },
  archivedToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  archivedToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  archivedList: {
    marginTop: 8,
    gap: 8,
  },
  archivedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    opacity: 0.8,
    gap: 10,
  },
  archivedIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  archivedName: {
    fontSize: 14,
    fontWeight: '600',
  },
  archivedMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  restoreBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  restoreBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
