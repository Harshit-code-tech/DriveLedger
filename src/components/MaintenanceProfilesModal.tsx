/**
 * Maintenance Profiles & Targets Modal (Part B)
 *
 * Allows users to define custom, vehicle-specific component maintenance targets
 * (e.g., Engine Oil every 10,000 km, Brake Pads every 30,000 km, Battery every 24 months)
 * without relying on remote manufacturer databases.
 *
 * Integrates with notificationService and smart insights.
 */

import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sizing, Spacing, Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useMaintenanceProfileStore } from '@/stores/maintenanceProfileStore';
import type { Vehicle } from '@/types/vehicle';
import type { MaintenanceProfile } from '@/types/service';

interface MaintenanceProfilesModalProps {
  visible: boolean;
  vehicle: Vehicle;
  onClose: () => void;
}

const COMMON_COMPONENTS = [
  'Engine Oil & Filter',
  'Brake Pads & Fluid',
  'Air & Cabin Filter',
  'Tyre Rotation & Alignment',
  'Coolant Flush',
  'Spark Plugs',
  'Battery Replacement',
  'Transmission Fluid',
];

export function MaintenanceProfilesModal({
  visible,
  vehicle,
  onClose,
}: MaintenanceProfilesModalProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const profiles = useMaintenanceProfileStore((s) => s.profiles);
  const dueStatuses = useMaintenanceProfileStore((s) => s.dueStatuses);
  const addProfile = useMaintenanceProfileStore((s) => s.addProfile);
  const editProfile = useMaintenanceProfileStore((s) => s.editProfile);
  const deleteProfile = useMaintenanceProfileStore((s) => s.deleteProfile);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [componentName, setComponentName] = useState('');
  const [intervalKm, setIntervalKm] = useState('');
  const [intervalMonths, setIntervalMonths] = useState('');
  const [targetOdo, setTargetOdo] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [notes, setNotes] = useState('');

  if (!visible) return null;

  const resetForm = () => {
    setComponentName('');
    setIntervalKm('');
    setIntervalMonths('');
    setTargetOdo('');
    setTargetDate('');
    setNotes('');
    setEditingId(null);
    setIsFormOpen(false);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleOpenEdit = (p: MaintenanceProfile) => {
    setEditingId(p.id);
    setComponentName(p.component_name);
    setIntervalKm(p.interval_km ? String(p.interval_km) : '');
    setIntervalMonths(p.interval_months ? String(p.interval_months) : '');
    setTargetOdo(p.target_odometer ? String(p.target_odometer) : '');
    setTargetDate(p.target_date || '');
    setNotes(p.notes || '');
    setIsFormOpen(true);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Delete Target?',
      `Are you sure you want to delete the maintenance target for "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteProfile(id, vehicle.id, vehicle.current_odometer);
          },
        },
      ]
    );
  };

  const handleSaveForm = () => {
    if (!componentName.trim()) {
      Alert.alert('Required Field', 'Please enter a component or service name.');
      return;
    }

    const parsedIntervalKm = intervalKm.trim() ? parseFloat(intervalKm.trim()) : undefined;
    const parsedIntervalMonths = intervalMonths.trim() ? parseInt(intervalMonths.trim(), 10) : undefined;
    const parsedTargetOdo = targetOdo.trim() ? parseFloat(targetOdo.trim()) : undefined;

    if (
      parsedIntervalKm === undefined &&
      parsedIntervalMonths === undefined &&
      parsedTargetOdo === undefined &&
      !targetDate.trim()
    ) {
      Alert.alert(
        'Missing Target',
        'Please provide at least one interval (distance in km, months, target odometer, or target date).'
      );
      return;
    }

    if (editingId) {
      editProfile(
        editingId,
        {
          component_name: componentName.trim(),
          interval_km: parsedIntervalKm,
          interval_months: parsedIntervalMonths,
          target_odometer: parsedTargetOdo,
          target_date: targetDate.trim() || undefined,
          notes: notes.trim() || undefined,
        },
        vehicle.current_odometer
      );
    } else {
      addProfile(
        {
          vehicle_id: vehicle.id,
          component_name: componentName.trim(),
          interval_km: parsedIntervalKm,
          interval_months: parsedIntervalMonths,
          target_odometer: parsedTargetOdo,
          target_date: targetDate.trim() || undefined,
          notes: notes.trim() || undefined,
        },
        vehicle.current_odometer
      );
    }

    resetForm();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Spacing.xl,
              paddingBottom: insets.bottom + Spacing.xxl,
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[Typography.h2, { color: colors.text }]}>
                Maintenance Profiles
              </Text>
              <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
                Vehicle targets & intervals · {vehicle.nickname}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={[Typography.body, { color: colors.primary, fontWeight: '600' }]}>
                Done
              </Text>
            </TouchableOpacity>
          </View>

          {isFormOpen ? (
            /* Add / Edit Form */
            <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[Typography.h3, { color: colors.text, marginBottom: Spacing.md }]}>
                {editingId ? 'Edit Maintenance Target' : 'New Maintenance Target'}
              </Text>

              {/* Component Name */}
              <Text style={[Typography.caption, { color: colors.textSecondary, marginBottom: Spacing.xs }]}>
                COMPONENT OR SERVICE *
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder="e.g. Engine Oil & Filter"
                placeholderTextColor={colors.textTertiary}
                value={componentName}
                onChangeText={setComponentName}
              />

              {/* Quick Component Suggestions */}
              <View style={styles.suggestionsRow}>
                {COMMON_COMPONENTS.slice(0, 4).map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.suggestionChip, { borderColor: colors.border }]}
                    onPress={() => setComponentName(c)}
                  >
                    <Text style={[Typography.caption, { color: colors.textSecondary }]}>
                      + {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Interval Km */}
              <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xs }]}>
                INTERVAL DISTANCE (KM)
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                keyboardType="numeric"
                placeholder="e.g. 10000"
                placeholderTextColor={colors.textTertiary}
                value={intervalKm}
                onChangeText={setIntervalKm}
              />

              {/* Interval Months */}
              <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xs }]}>
                INTERVAL TIME (MONTHS)
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                keyboardType="numeric"
                placeholder="e.g. 6 or 12"
                placeholderTextColor={colors.textTertiary}
                value={intervalMonths}
                onChangeText={setIntervalMonths}
              />

              {/* Target Odometer */}
              <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xs }]}>
                EXPLICIT NEXT TARGET ODOMETER (KM)
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                keyboardType="numeric"
                placeholder="e.g. 50000"
                placeholderTextColor={colors.textTertiary}
                value={targetOdo}
                onChangeText={setTargetOdo}
              />

              {/* Target Date */}
              <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xs }]}>
                EXPLICIT NEXT TARGET DATE (YYYY-MM-DD)
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textTertiary}
                value={targetDate}
                onChangeText={setTargetDate}
              />

              {/* Notes */}
              <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xs }]}>
                NOTES (OPTIONAL)
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                placeholder="e.g. 5W-30 synthetic oil only"
                placeholderTextColor={colors.textTertiary}
                value={notes}
                onChangeText={setNotes}
              />

              {/* Form Buttons */}
              <View style={styles.formBtnRow}>
                <TouchableOpacity
                  style={[styles.formBtn, { backgroundColor: colors.borderLight }]}
                  onPress={resetForm}
                >
                  <Text style={[Typography.button, { color: colors.textSecondary }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.formBtn, { backgroundColor: colors.primary, flex: 2 }]}
                  onPress={handleSaveForm}
                >
                  <Text style={[Typography.button, { color: colors.primaryText }]}>
                    {editingId ? 'Update Target' : 'Save Target'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Profiles List & Add Button */
            <View>
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
                onPress={handleOpenAdd}
              >
                <Text style={[Typography.button, { color: colors.primary }]}>
                  ➕ Add Maintenance Target
                </Text>
              </TouchableOpacity>

              {profiles.length === 0 ? (
                <View style={[styles.emptyBox, { borderColor: colors.border }]}>
                  <Text style={styles.emptyIcon}>📋</Text>
                  <Text style={[Typography.body, { color: colors.text, fontWeight: '600' }]}>
                    No custom targets defined
                  </Text>
                  <Text style={[Typography.bodySmall, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>
                    Define intervals for engine oil, brake pads, tyres, or filters to get proactive local alerts.
                  </Text>
                </View>
              ) : (
                <View style={styles.list}>
                  {profiles.map((p) => {
                    const status = dueStatuses.find((d) => d.profile.id === p.id);
                    const isOverdue = status?.status === 'overdue';
                    const isDueSoon = status?.status === 'due_soon';

                    return (
                      <View
                        key={p.id}
                        style={[
                          styles.profileItem,
                          {
                            backgroundColor: colors.card,
                            borderColor: isOverdue ? colors.danger : isDueSoon ? colors.warning : colors.border,
                          },
                        ]}
                      >
                        <View style={styles.profileHeader}>
                          <Text style={[Typography.body, { color: colors.text, fontWeight: '700', flex: 1 }]}>
                            {p.component_name}
                          </Text>

                          {status && (
                            <View
                              style={[
                                styles.statusBadge,
                                {
                                  backgroundColor: isOverdue
                                    ? colors.dangerLight
                                    : isDueSoon
                                    ? colors.warningLight
                                    : colors.successLight,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  Typography.caption,
                                  {
                                    color: isOverdue
                                      ? colors.danger
                                      : isDueSoon
                                      ? colors.warning
                                      : colors.success,
                                    fontWeight: '700',
                                  },
                                ]}
                              >
                                {isOverdue ? 'Overdue' : isDueSoon ? 'Due Soon' : 'Good'}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Intervals Info */}
                        <View style={styles.intervalInfo}>
                          {p.interval_km && (
                            <Text style={[Typography.caption, { color: colors.textSecondary }]}>
                              Every {p.interval_km.toLocaleString()} km
                            </Text>
                          )}
                          {p.interval_months && (
                            <Text style={[Typography.caption, { color: colors.textSecondary }]}>
                              Every {p.interval_months} months
                            </Text>
                          )}
                          {p.target_odometer && (
                            <Text style={[Typography.caption, { color: colors.primary }]}>
                              Target: {p.target_odometer.toLocaleString()} km
                            </Text>
                          )}
                        </View>

                        {/* Due status details */}
                        {status && (
                          <Text
                            style={[
                              Typography.bodySmall,
                              {
                                color: isOverdue
                                  ? colors.danger
                                  : isDueSoon
                                  ? colors.warning
                                  : colors.textSecondary,
                                marginTop: 6,
                              },
                            ]}
                          >
                            {status.subtext}
                          </Text>
                        )}

                        {/* Actions */}
                        <View style={styles.actionsRow}>
                          <TouchableOpacity onPress={() => handleOpenEdit(p)}>
                            <Text style={[Typography.caption, { color: colors.primary, fontWeight: '600' }]}>
                              ✏️ Edit
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity onPress={() => handleDelete(p.id, p.component_name)}>
                            <Text style={[Typography.caption, { color: colors.danger, fontWeight: '600' }]}>
                              🗑️ Delete
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  addBtn: {
    height: 52,
    borderRadius: Sizing.radiusLg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyBox: {
    padding: Spacing.xxl,
    borderRadius: Sizing.radiusLg,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: Spacing.xs,
  },
  list: {
    gap: Spacing.md,
  },
  profileItem: {
    padding: Spacing.md,
    borderRadius: Sizing.radiusLg,
    borderWidth: 1,
    ...Sizing.cardShadow,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Sizing.radiusFull,
  },
  intervalInfo: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.xl,
    marginTop: Spacing.md,
    paddingTop: Spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
  },
  formCard: {
    padding: Spacing.lg,
    borderRadius: Sizing.radiusLg,
    borderWidth: 1,
    ...Sizing.cardShadow,
  },
  input: {
    height: 48,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  suggestionChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
  },
  formBtnRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  formBtn: {
    height: 52,
    borderRadius: Sizing.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
});
