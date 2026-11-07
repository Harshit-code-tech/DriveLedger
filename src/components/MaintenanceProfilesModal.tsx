/**
 * Maintenance Profiles & Targets Modal
 *
 * Allows users to define custom, vehicle-specific component maintenance targets
 * (e.g., Engine Oil every 10,000 km, Brake Pads every 30,000 km, Battery every 24 months)
 * without relying on remote manufacturer databases.
 *
 * Styled in the Refined Technical Automotive Cockpit design:
 * - Standardized FormHeader with circular cancel button and quick save action
 * - Vehicle context card with active vehicle and baseline odometer
 * - High-contrast target cards with status badges (On Track, Due Soon, Overdue)
 * - Quick interval presets (5k, 10k, 20k km / 6m, 12m, 24m)
 * - DD/MM/YYYY date input with auto-formatting
 * - 52dp Automotive Orange primary action buttons
 * - 100% offline
 */

import { FormHeader } from "@/components/FormHeader";
import { VehicleType } from "@/constants/fuelTypes";
import { Sizing, Spacing, Typography } from "@/constants/theme";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useMaintenanceProfileStore } from "@/stores/maintenanceProfileStore";
import type { MaintenanceProfile } from "@/types/service";
import type { Vehicle } from "@/types/vehicle";
import {
  displayToISO,
  formatDateInput,
  isoToDisplay,
  validateDateDisplay,
} from "@/utils/dateInput";
import { useState } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface MaintenanceProfilesModalProps {
  visible: boolean;
  vehicle: Vehicle;
  onClose: () => void;
}

const COMMON_COMPONENTS = [
  "Engine Oil & Filter",
  "Brake Pads & Fluid",
  "Air & Cabin Filter",
  "Tyre Rotation & Alignment",
  "Coolant Flush",
  "Spark Plugs",
  "Battery Replacement",
  "Transmission Fluid",
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
  const [componentName, setComponentName] = useState("");
  const [intervalKm, setIntervalKm] = useState("");
  const [intervalMonths, setIntervalMonths] = useState("");
  const [targetOdo, setTargetOdo] = useState("");
  const [targetDateDisplay, setTargetDateDisplay] = useState("");
  const [notes, setNotes] = useState("");

  if (!visible) return null;

  const isTwoWheeler = vehicle.vehicle_type === VehicleType.TWO_WHEELER;

  const resetForm = () => {
    setComponentName("");
    setIntervalKm("");
    setIntervalMonths("");
    setTargetOdo("");
    setTargetDateDisplay("");
    setNotes("");
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
    setIntervalKm(p.interval_km ? String(p.interval_km) : "");
    setIntervalMonths(p.interval_months ? String(p.interval_months) : "");
    setTargetOdo(p.target_odometer ? String(p.target_odometer) : "");
    setTargetDateDisplay(p.target_date ? isoToDisplay(p.target_date) : "");
    setNotes(p.notes || "");
    setIsFormOpen(true);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      "Delete Target?",
      `Are you sure you want to delete the maintenance target for "${name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteProfile(id, vehicle.id, vehicle.current_odometer);
          },
        },
      ],
    );
  };

  const handleSaveForm = () => {
    if (!componentName.trim()) {
      Alert.alert(
        "Required Field",
        "Please enter a component or service name.",
      );
      return;
    }

    const parsedIntervalKm = intervalKm.trim()
      ? parseFloat(intervalKm.trim())
      : undefined;
    const parsedIntervalMonths = intervalMonths.trim()
      ? parseInt(intervalMonths.trim(), 10)
      : undefined;
    const parsedTargetOdo = targetOdo.trim()
      ? parseFloat(targetOdo.trim())
      : undefined;

    let parsedTargetDateISO: string | undefined = undefined;
    if (targetDateDisplay.trim()) {
      const validation = validateDateDisplay(
        targetDateDisplay.trim(),
        "Target Date",
      );
      if (!validation.isValid) {
        Alert.alert(
          "Invalid Date",
          validation.error || "Please enter a valid target date (DD/MM/YYYY).",
        );
        return;
      }
      const iso = displayToISO(targetDateDisplay.trim());
      parsedTargetDateISO = iso || undefined;
    }

    if (
      parsedIntervalKm === undefined &&
      parsedIntervalMonths === undefined &&
      parsedTargetOdo === undefined &&
      !parsedTargetDateISO
    ) {
      Alert.alert(
        "Missing Target Interval",
        "Please provide at least one interval (distance in km, months, target odometer, or target date).",
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
          target_date: parsedTargetDateISO,
          notes: notes.trim() || undefined,
        },
        vehicle.current_odometer,
      );
    } else {
      addProfile(
        {
          vehicle_id: vehicle.id,
          component_name: componentName.trim(),
          interval_km: parsedIntervalKm,
          interval_months: parsedIntervalMonths,
          target_odometer: parsedTargetOdo,
          target_date: parsedTargetDateISO,
          notes: notes.trim() || undefined,
        },
        vehicle.current_odometer,
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
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* ── FormHeader ── */}
        <FormHeader
          title={
            isFormOpen
              ? editingId
                ? "Edit Target"
                : "New Target"
              : "Maintenance Targets"
          }
          subtitle={`Vehicle intervals & targets · ${vehicle.nickname}`}
          onCancel={isFormOpen ? resetForm : onClose}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom: insets.bottom + 100,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Vehicle Context Card ── */}
          <View
            style={[
              styles.vehicleContextCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.vehicleIconWrap,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.borderLight,
                },
              ]}
            >
              <Text style={{ fontSize: 18 }}>{isTwoWheeler ? "🏍️" : "🚗"}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.vehicleNameRow}>
                <Text style={[styles.vehicleNickname, { color: colors.text }]}>
                  {vehicle.nickname}
                </Text>
                {vehicle.registration_number ? (
                  <View
                    style={[
                      styles.regBadge,
                      {
                        backgroundColor: colors.surfaceSecondary,
                        borderColor: colors.borderLight,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.regBadgeText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {vehicle.registration_number}
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text
                style={[styles.vehicleSubtext, { color: colors.textSecondary }]}
              >
                Current Odometer:{" "}
                {vehicle.current_odometer !== null &&
                vehicle.current_odometer !== undefined
                  ? `${vehicle.current_odometer.toLocaleString("en-IN")} km`
                  : "Not set"}
              </Text>
            </View>
          </View>

          {isFormOpen ? (
            /* ── Add / Edit Form Card ── */
            <View
              style={[
                styles.formCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text
                style={[
                  Typography.h3,
                  { color: colors.text, marginBottom: Spacing.md },
                ]}
              >
                {editingId
                  ? "Edit Maintenance Target"
                  : "New Maintenance Target"}
              </Text>

              {/* Component Name */}
              <Text
                style={[styles.fieldLabel, { color: colors.textSecondary }]}
              >
                COMPONENT OR SERVICE *
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="e.g. Engine Oil & Filter"
                placeholderTextColor={colors.textTertiary}
                value={componentName}
                onChangeText={setComponentName}
              />

              {/* Quick Component Suggestions */}
              <View style={styles.suggestionsRow}>
                {COMMON_COMPONENTS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.suggestionChip,
                      {
                        backgroundColor:
                          componentName === c
                            ? colors.surfaceSecondary
                            : colors.surface,
                        borderColor:
                          componentName === c
                            ? colors.primary
                            : colors.borderLight,
                      },
                    ]}
                    onPress={() => setComponentName(c)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.suggestionChipText,
                        {
                          color:
                            componentName === c
                              ? colors.primary
                              : colors.textSecondary,
                        },
                      ]}
                    >
                      {componentName === c ? "✓ " : "+ "}
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Interval Km */}
              <Text
                style={[
                  styles.fieldLabel,
                  { color: colors.textSecondary, marginTop: Spacing.md },
                ]}
              >
                INTERVAL DISTANCE (KM)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                keyboardType="numeric"
                placeholder="e.g. 10000"
                placeholderTextColor={colors.textTertiary}
                value={intervalKm}
                onChangeText={setIntervalKm}
              />

              {/* Quick Interval Km Chips */}
              <View style={styles.quickChipsRow}>
                {["5000", "10000", "15000", "20000"].map((km) => (
                  <TouchableOpacity
                    key={km}
                    style={[
                      styles.quickChip,
                      {
                        backgroundColor:
                          intervalKm === km
                            ? colors.surfaceSecondary
                            : colors.surface,
                        borderColor:
                          intervalKm === km
                            ? colors.primary
                            : colors.borderLight,
                      },
                    ]}
                    onPress={() => setIntervalKm(km)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.quickChipText,
                        {
                          color:
                            intervalKm === km
                              ? colors.primary
                              : colors.textSecondary,
                        },
                      ]}
                    >
                      {parseInt(km, 10).toLocaleString("en-IN")} km
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Interval Months */}
              <Text
                style={[
                  styles.fieldLabel,
                  { color: colors.textSecondary, marginTop: Spacing.md },
                ]}
              >
                INTERVAL TIME (MONTHS)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                keyboardType="numeric"
                placeholder="e.g. 6 or 12"
                placeholderTextColor={colors.textTertiary}
                value={intervalMonths}
                onChangeText={setIntervalMonths}
              />

              {/* Quick Months Chips */}
              <View style={styles.quickChipsRow}>
                {["6", "12", "24", "36"].map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.quickChip,
                      {
                        backgroundColor:
                          intervalMonths === m
                            ? colors.surfaceSecondary
                            : colors.surface,
                        borderColor:
                          intervalMonths === m
                            ? colors.primary
                            : colors.borderLight,
                      },
                    ]}
                    onPress={() => setIntervalMonths(m)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.quickChipText,
                        {
                          color:
                            intervalMonths === m
                              ? colors.primary
                              : colors.textSecondary,
                        },
                      ]}
                    >
                      {m} Months
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Target Odometer */}
              <Text
                style={[
                  styles.fieldLabel,
                  { color: colors.textSecondary, marginTop: Spacing.md },
                ]}
              >
                EXPLICIT NEXT TARGET ODOMETER (KM)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                keyboardType="numeric"
                placeholder="e.g. 50000"
                placeholderTextColor={colors.textTertiary}
                value={targetOdo}
                onChangeText={setTargetOdo}
              />
              {vehicle.current_odometer ? (
                <View style={styles.quickChipsRow}>
                  {[5000, 10000, 20000].map((delta) => {
                    const proposed = vehicle.current_odometer! + delta;
                    return (
                      <TouchableOpacity
                        key={delta}
                        style={[
                          styles.quickChip,
                          {
                            backgroundColor: colors.surfaceSecondary,
                            borderColor: colors.borderLight,
                          },
                        ]}
                        onPress={() => setTargetOdo(String(proposed))}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.quickChipText,
                            { color: colors.primary },
                          ]}
                        >
                          +{delta.toLocaleString("en-IN")} km (
                          {proposed.toLocaleString("en-IN")})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}

              {/* Target Date */}
              <Text
                style={[
                  styles.fieldLabel,
                  { color: colors.textSecondary, marginTop: Spacing.md },
                ]}
              >
                EXPLICIT NEXT TARGET DATE (DD/MM/YYYY)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                keyboardType="numeric"
                placeholder="DD/MM/YYYY"
                placeholderTextColor={colors.textTertiary}
                value={targetDateDisplay}
                onChangeText={(text) =>
                  setTargetDateDisplay(formatDateInput(text, targetDateDisplay))
                }
                maxLength={10}
              />

              {/* Notes */}
              <Text
                style={[
                  styles.fieldLabel,
                  { color: colors.textSecondary, marginTop: Spacing.md },
                ]}
              >
                NOTES (OPTIONAL)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="e.g. 5W-30 synthetic oil only"
                placeholderTextColor={colors.textTertiary}
                value={notes}
                onChangeText={setNotes}
              />

              {/* Form Buttons */}
              <View style={styles.formBtnRow}>
                <TouchableOpacity
                  style={[
                    styles.cancelBtn,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceSecondary,
                    },
                  ]}
                  onPress={resetForm}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[Typography.button, { color: colors.textSecondary }]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: "#3983C7" }]}
                  onPress={handleSaveForm}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Save Maintenance Target"
                >
                  <Text
                    style={[
                      Typography.button,
                      { color: "#FFFFFF", fontWeight: "800" },
                    ]}
                  >
                    {editingId ? "Update Target" : "Save Target"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* ── Profiles List & Add Button ── */
            <View>
              <TouchableOpacity
                style={[
                  styles.addBtn,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.borderLight,
                  },
                ]}
                onPress={handleOpenAdd}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Add New Maintenance Target"
              >
                <Text
                  style={[
                    Typography.button,
                    { color: colors.primary, fontWeight: "800", fontSize: 15 },
                  ]}
                >
                  ➕ Add Maintenance Target
                </Text>
              </TouchableOpacity>

              {profiles.length === 0 ? (
                <View
                  style={[
                    styles.emptyBox,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.borderLight,
                    },
                  ]}
                >
                  <Text style={styles.emptyIcon}>📋</Text>
                  <Text
                    style={[
                      Typography.body,
                      { color: colors.text, fontWeight: "700" },
                    ]}
                  >
                    No custom targets defined
                  </Text>
                  <Text
                    style={[
                      Typography.bodySmall,
                      {
                        color: colors.textSecondary,
                        textAlign: "center",
                        marginTop: 4,
                        lineHeight: 18,
                      },
                    ]}
                  >
                    Define service intervals for engine oil, brake pads, tyres,
                    or filters to get proactive offline alerts.
                  </Text>
                </View>
              ) : (
                <View style={styles.list}>
                  {profiles.map((p) => {
                    const status = dueStatuses.find(
                      (d) => d.profile.id === p.id,
                    );
                    const isOverdue = status?.status === "overdue";
                    const isDueSoon = status?.status === "due_soon";

                    const badgeBg = isOverdue
                      ? colors.statusCriticalBg
                      : isDueSoon
                        ? colors.statusWarningBg
                        : colors.statusNormalBg;

                    const badgeBorder = isOverdue
                      ? colors.statusCritical
                      : isDueSoon
                        ? colors.statusWarning
                        : colors.statusNormal;

                    const badgeText = isOverdue
                      ? colors.statusCritical
                      : isDueSoon
                        ? colors.statusWarning
                        : colors.statusNormal;

                    return (
                      <View
                        key={p.id}
                        style={[
                          styles.profileItem,
                          {
                            backgroundColor: colors.surface,
                            borderColor: isOverdue
                              ? colors.danger
                              : isDueSoon
                                ? colors.warning
                                : colors.borderLight,
                            ...Sizing.cardShadow,
                          },
                        ]}
                      >
                        <View style={styles.profileHeader}>
                          <Text
                            style={[
                              styles.profileTitle,
                              { color: colors.text },
                            ]}
                            numberOfLines={1}
                          >
                            {p.component_name}
                          </Text>

                          {status && (
                            <View
                              style={[
                                styles.statusBadge,
                                {
                                  backgroundColor: badgeBg,
                                  borderColor: badgeBorder,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusBadgeText,
                                  { color: badgeText },
                                ]}
                              >
                                {isOverdue
                                  ? "⚠️ Overdue"
                                  : isDueSoon
                                    ? "⏳ Due Soon"
                                    : "✓ Good"}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Intervals Info */}
                        <View style={styles.intervalInfo}>
                          {p.interval_km && (
                            <View
                              style={[
                                styles.intervalPill,
                                {
                                  backgroundColor: colors.surfaceSecondary,
                                  borderColor: colors.borderLight,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.intervalPillText,
                                  { color: colors.textSecondary },
                                ]}
                              >
                                Every {p.interval_km.toLocaleString("en-IN")} km
                              </Text>
                            </View>
                          )}
                          {p.interval_months && (
                            <View
                              style={[
                                styles.intervalPill,
                                {
                                  backgroundColor: colors.surfaceSecondary,
                                  borderColor: colors.borderLight,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.intervalPillText,
                                  { color: colors.textSecondary },
                                ]}
                              >
                                Every {p.interval_months} months
                              </Text>
                            </View>
                          )}
                          {p.target_odometer && (
                            <View
                              style={[
                                styles.intervalPill,
                                {
                                  backgroundColor: colors.surfaceSecondary,
                                  borderColor: colors.borderLight,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.intervalPillText,
                                  { color: colors.primary, fontWeight: "700" },
                                ]}
                              >
                                Target:{" "}
                                {p.target_odometer.toLocaleString("en-IN")} km
                              </Text>
                            </View>
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
                                fontWeight: "600",
                              },
                            ]}
                          >
                            {status.subtext}
                          </Text>
                        )}

                        {p.notes ? (
                          <Text
                            style={[
                              styles.profileNotes,
                              { color: colors.textTertiary },
                            ]}
                          >
                            "{p.notes}"
                          </Text>
                        ) : null}

                        {/* Actions */}
                        <View
                          style={[
                            styles.actionsRow,
                            { borderTopColor: colors.borderLight },
                          ]}
                        >
                          <TouchableOpacity
                            onPress={() => handleOpenEdit(p)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                Typography.caption,
                                { color: colors.primary, fontWeight: "700" },
                              ]}
                            >
                              ✏️ Edit Target
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => handleDelete(p.id, p.component_name)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            activeOpacity={0.7}
                          >
                            <Text
                              style={[
                                Typography.caption,
                                { color: colors.danger, fontWeight: "700" },
                              ]}
                            >
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
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  headerCloseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Sizing.radiusFull,
  },
  headerCloseBtnText: {
    fontWeight: "700",
    fontSize: 13,
  },
  vehicleContextCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: Sizing.radiusLg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  vehicleIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  vehicleNickname: {
    fontSize: 16,
    fontWeight: "800",
  },
  regBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  regBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  vehicleSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  addBtn: {
    height: 50,
    borderRadius: Sizing.radiusLg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  emptyBox: {
    padding: Spacing.xxl,
    borderRadius: Sizing.radiusLg,
    borderWidth: 1,
    alignItems: "center",
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
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  profileTitle: {
    fontSize: 16,
    fontWeight: "800",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  intervalInfo: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
    flexWrap: "wrap",
  },
  intervalPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
  },
  intervalPillText: {
    fontSize: 11,
    fontWeight: "600",
  },
  profileNotes: {
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: "row",
    gap: Spacing.xl,
    marginTop: Spacing.md,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
  },
  formCard: {
    padding: Spacing.lg,
    borderRadius: Sizing.radiusLg,
    borderWidth: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  input: {
    height: 48,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
  },
  suggestionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  suggestionChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
  },
  suggestionChipText: {
    fontSize: 11,
    fontWeight: "600",
  },
  quickChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  quickChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: "600",
  },
  formBtnRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  cancelBtn: {
    height: 50,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  saveBtn: {
    height: 50,
    borderRadius: Sizing.radiusMd,
    alignItems: "center",
    justifyContent: "center",
    flex: 1.6,
    ...Sizing.cardShadow,
  },
});
