/**
 * Manual Trip Entry Modal
 *
 * Fast, reliable odometer-based trip logging without needing GPS or location permissions.
 * Styled in the Refined Technical Automotive Cockpit design:
 * - Clean FormHeader with circular back button and quick Save action
 * - Vehicle context card showing active vehicle & current baseline
 * - Real-time calculated distance meter with live delta progression
 * - Quick increment chips for ending odometer (+5, +10, +25, +50, +100 km)
 * - DD/MM/YYYY date input with "Set Today" shortcut chip
 * - Duration input with quick presets (15m, 30m, 45m, 1h, 2h)
 * - Purpose tags & notes
 * - Canonical vehicle odometer reconciliation toggle with historical protection
 * - Pinned 52dp Automotive Orange button
 * - 100% offline
 */

import { FormHeader } from "@/components/FormHeader";
import { VehicleType } from "@/constants/fuelTypes";
import { Sizing, Spacing } from "@/constants/theme";
import {
  canUpdateCanonicalOdometer,
  validateManualTripOdometers,
} from "@/engine/odometerReconciliation";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useTripStore } from "@/stores/tripStore";
import type { Vehicle } from "@/types/vehicle";
import { todayISO } from "@/utils/date";
import {
  displayToISO,
  formatDateInput,
  isoToDisplay,
  validateDateDisplay,
} from "@/utils/dateInput";
import { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ManualTripModalProps {
  visible: boolean;
  vehicle: Vehicle;
  onSaved: () => void;
  onClose: () => void;
}

const COMMON_PURPOSES = [
  "Commute",
  "Business",
  "Personal",
  "Roadtrip",
  "Delivery",
  "Other",
] as const;
const ODO_INCREMENTS = [5, 10, 25, 50, 100] as const;
const DURATION_PRESETS = [
  { label: "15m", mins: 15 },
  { label: "30m", mins: 30 },
  { label: "45m", mins: 45 },
  { label: "1h", mins: 60 },
  { label: "1.5h", mins: 90 },
  { label: "2h", mins: 120 },
] as const;

export function ManualTripModal({
  visible,
  vehicle,
  onSaved,
  onClose,
}: ManualTripModalProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const addManualTrip = useTripStore((s) => s.addManualTrip);

  const [date, setDate] = useState(todayISO());
  const [dateDisplay, setDateDisplay] = useState(isoToDisplay(todayISO()));
  const [startOdo, setStartOdo] = useState(
    vehicle.current_odometer ? String(vehicle.current_odometer) : "",
  );
  const [endOdo, setEndOdo] = useState("");
  const [shouldUpdateVehicleOdo, setShouldUpdateVehicleOdo] = useState(true);
  const [durationMin, setDurationMin] = useState("");
  const [purpose, setPurpose] = useState("Personal");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-computed distance using pure engine validator
  const calculatedDistance = useMemo(() => {
    const s = parseFloat(startOdo);
    const e = parseFloat(endOdo);
    const validation = validateManualTripOdometers(s, e);
    return validation.isValid ? validation.distanceKm : null;
  }, [startOdo, endOdo]);

  const parsedEndOdo = endOdo.trim() ? parseFloat(endOdo.trim()) : undefined;
  const parsedStartOdo = startOdo.trim()
    ? parseFloat(startOdo.trim())
    : undefined;

  const isInvalidProgression =
    parsedStartOdo !== undefined &&
    parsedEndOdo !== undefined &&
    parsedEndOdo < parsedStartOdo;

  const isHistorical =
    parsedEndOdo !== undefined &&
    typeof vehicle.current_odometer === "number" &&
    parsedEndOdo < vehicle.current_odometer;

  if (!visible) return null;

  const handleDateChange = (text: string) => {
    const formatted = formatDateInput(text, dateDisplay);
    setDateDisplay(formatted);
    const iso = displayToISO(formatted);
    if (iso && validateDateDisplay(formatted)) {
      setDate(iso);
    }
  };

  const setDateToday = () => {
    const today = todayISO();
    setDate(today);
    setDateDisplay(isoToDisplay(today));
  };

  const handleAddKm = (km: number) => {
    const currentStart =
      parseFloat(startOdo) || (vehicle.current_odometer ?? 0);
    const currentEnd = parseFloat(endOdo);
    const base =
      !isNaN(currentEnd) && currentEnd >= currentStart
        ? currentEnd
        : currentStart;
    const newEnd = Math.round((base + km) * 10) / 10;
    setEndOdo(String(newEnd));
  };

  const handleSubmit = () => {
    const s = parseFloat(startOdo.trim());
    const e = parseFloat(endOdo.trim());

    const validation = validateManualTripOdometers(s, e);
    if (!validation.isValid) {
      Alert.alert(
        "Validation Error",
        validation.error || "Please enter valid odometer readings.",
      );
      return;
    }

    let parsedDuration: number | undefined;
    if (durationMin.trim()) {
      parsedDuration = parseInt(durationMin.trim(), 10);
      if (isNaN(parsedDuration) || parsedDuration < 0) {
        Alert.alert(
          "Invalid Duration",
          "Please enter duration in positive minutes.",
        );
        return;
      }
    }

    const isoDate = displayToISO(dateDisplay) || date || todayISO();

    const canonicalCheck = canUpdateCanonicalOdometer({
      proposedOdometer: e,
      currentCanonicalOdometer: vehicle.current_odometer,
      isExplicitlyConfirmed: shouldUpdateVehicleOdo,
    });

    try {
      setIsSubmitting(true);
      addManualTrip({
        vehicle_id: vehicle.id,
        date: isoDate,
        start_odometer: s,
        end_odometer: e,
        duration_minutes: parsedDuration,
        purpose: purpose.trim() || undefined,
        notes: notes.trim() || undefined,
        updateVehicleOdometer: canonicalCheck.canUpdate,
      });

      setIsSubmitting(false);
      onSaved();
    } catch (err: unknown) {
      setIsSubmitting(false);
      const msg =
        err instanceof Error ? err.message : "Failed to save manual trip";
      Alert.alert("Error", msg);
    }
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
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* ── Cockpit Header ── */}
        <FormHeader
          title="Log Manual Trip"
          subtitle="Odometer distance log · No GPS required"
          onCancel={onClose}
          rightAction={
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={[styles.headerSaveBtn, { backgroundColor: colors.accent }]}
              activeOpacity={0.8}
            >
              <Text style={styles.headerSaveBtnText}>Save</Text>
            </TouchableOpacity>
          }
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 80 },
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
                styles.vehIconWrap,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.borderLight,
                },
              ]}
            >
              <Text style={{ fontSize: 18 }}>
                {vehicle.vehicle_type === VehicleType.TWO_WHEELER ? "🏍️" : "🚗"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.vehNickname, { color: colors.text }]}>
                {vehicle.nickname}
              </Text>
              <Text
                style={[styles.vehDetails, { color: colors.textSecondary }]}
              >
                {vehicle.registration_number
                  ? `${vehicle.registration_number} · `
                  : ""}
                Current Odo:{" "}
                {vehicle.current_odometer
                  ? `${vehicle.current_odometer.toLocaleString("en-IN")} km`
                  : "Not set"}
              </Text>
            </View>
          </View>

          {/* ── Hero Distance Progression Card ── */}
          <View
            style={[
              styles.heroDistanceCard,
              {
                backgroundColor: isInvalidProgression
                  ? colors.statusCriticalBg
                  : calculatedDistance !== null
                    ? colors.surface
                    : colors.surface,
                borderColor: isInvalidProgression
                  ? colors.statusCritical
                  : calculatedDistance !== null
                    ? colors.accent
                    : colors.border,
              },
            ]}
          >
            <View style={styles.heroDistanceHeader}>
              <Text
                style={[styles.heroCardLabel, { color: colors.textSecondary }]}
              >
                CALCULATED TRIP DISTANCE
              </Text>
              {calculatedDistance !== null && (
                <View
                  style={[
                    styles.calcBadge,
                    { backgroundColor: colors.statusNormalBg },
                  ]}
                >
                  <Text
                    style={[
                      styles.calcBadgeText,
                      { color: colors.statusNormal },
                    ]}
                  >
                    +{calculatedDistance} KM
                  </Text>
                </View>
              )}
            </View>

            <Text
              style={[
                styles.heroBigDistance,
                {
                  color: isInvalidProgression
                    ? colors.statusCritical
                    : calculatedDistance !== null
                      ? colors.text
                      : colors.textTertiary,
                },
              ]}
            >
              {calculatedDistance !== null
                ? `${calculatedDistance}`
                : isInvalidProgression
                  ? "Invalid"
                  : "—"}
              <Text style={styles.heroUnit}> km</Text>
            </Text>

            <Text
              style={[
                styles.heroSubtitle,
                {
                  color: isInvalidProgression
                    ? colors.statusCritical
                    : colors.textSecondary,
                },
              ]}
            >
              {isInvalidProgression
                ? "⚠️ Ending reading must be greater than or equal to starting odometer"
                : calculatedDistance !== null &&
                    parsedStartOdo !== undefined &&
                    parsedEndOdo !== undefined
                  ? `${parsedStartOdo.toLocaleString("en-IN")} km ➔ ${parsedEndOdo.toLocaleString("en-IN")} km`
                  : "Enter start and end odometer readings below"}
            </Text>
          </View>

          {/* ── Form Inputs ── */}
          <View style={styles.formSection}>
            {/* 1. Starting Odometer */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text
                  style={[styles.fieldLabel, { color: colors.textSecondary }]}
                >
                  STARTING ODOMETER (KM) *
                </Text>
                {vehicle.current_odometer !== null &&
                  vehicle.current_odometer !== undefined && (
                    <TouchableOpacity
                      onPress={() =>
                        setStartOdo(String(vehicle.current_odometer))
                      }
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.helperActionText,
                          { color: colors.primary },
                        ]}
                      >
                        Use Current (
                        {vehicle.current_odometer.toLocaleString("en-IN")} km)
                      </Text>
                    </TouchableOpacity>
                  )}
              </View>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                keyboardType="numeric"
                placeholder="e.g. 45000"
                placeholderTextColor={colors.textTertiary}
                value={startOdo}
                onChangeText={setStartOdo}
              />
            </View>

            {/* 2. Ending Odometer & Quick Delta Chips */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text
                  style={[styles.fieldLabel, { color: colors.textSecondary }]}
                >
                  ENDING ODOMETER (KM) *
                </Text>
              </View>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isInvalidProgression
                      ? colors.statusCritical
                      : colors.border,
                    color: colors.text,
                  },
                ]}
                keyboardType="numeric"
                placeholder="e.g. 45035"
                placeholderTextColor={colors.textTertiary}
                value={endOdo}
                onChangeText={setEndOdo}
              />

              {/* Quick Distance Addition Chips */}
              <View style={styles.quickChipsRow}>
                <Text
                  style={[styles.chipsPrefix, { color: colors.textTertiary }]}
                >
                  Add:
                </Text>
                {ODO_INCREMENTS.map((km) => (
                  <TouchableOpacity
                    key={km}
                    style={[
                      styles.quickChip,
                      {
                        backgroundColor: colors.surfaceSecondary,
                        borderColor: colors.borderLight,
                      },
                    ]}
                    onPress={() => handleAddKm(km)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.quickChipText,
                        { color: colors.primaryDark },
                      ]}
                    >
                      +{km} km
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 3. Canonical Odometer Reconciliation Card */}
            <View
              style={[
                styles.switchCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: isHistorical
                    ? colors.statusWarning
                    : colors.border,
                },
              ]}
            >
              <View style={{ flex: 1, marginRight: Spacing.md }}>
                <Text style={[styles.switchCardTitle, { color: colors.text }]}>
                  Update Vehicle Odometer
                </Text>
                <Text
                  style={[
                    styles.switchCardSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  Set vehicle canonical odometer to{" "}
                  <Text style={{ fontWeight: "700", color: colors.text }}>
                    {parsedEndOdo !== undefined
                      ? `${parsedEndOdo.toLocaleString("en-IN")} km`
                      : "ending reading"}
                  </Text>
                </Text>
                {isHistorical && (
                  <Text
                    style={[
                      styles.switchWarningText,
                      { color: colors.statusWarning },
                    ]}
                  >
                    ⚠️ Historical reading cannot roll back vehicle odometer (
                    {vehicle.current_odometer} km).
                  </Text>
                )}
              </View>
              <Switch
                value={shouldUpdateVehicleOdo && !isHistorical}
                onValueChange={setShouldUpdateVehicleOdo}
                disabled={isHistorical || parsedEndOdo === undefined}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* 4. Date Input with "Set Today" */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text
                  style={[styles.fieldLabel, { color: colors.textSecondary }]}
                >
                  TRIP DATE (DD/MM/YYYY)
                </Text>
                <TouchableOpacity onPress={setDateToday} activeOpacity={0.7}>
                  <Text
                    style={[styles.helperActionText, { color: colors.primary }]}
                  >
                    Set Today
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="DD/MM/YYYY"
                placeholderTextColor={colors.textTertiary}
                keyboardType="numeric"
                value={dateDisplay}
                onChangeText={handleDateChange}
              />
            </View>

            {/* 5. Duration (Optional) & Preset Chips */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text
                  style={[styles.fieldLabel, { color: colors.textSecondary }]}
                >
                  DURATION IN MINUTES (OPTIONAL)
                </Text>
              </View>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                keyboardType="numeric"
                placeholder="e.g. 45"
                placeholderTextColor={colors.textTertiary}
                value={durationMin}
                onChangeText={setDurationMin}
              />

              {/* Quick Duration Presets */}
              <View style={styles.quickChipsRow}>
                <Text
                  style={[styles.chipsPrefix, { color: colors.textTertiary }]}
                >
                  Preset:
                </Text>
                {DURATION_PRESETS.map((p) => {
                  const isSelected = durationMin === String(p.mins);
                  return (
                    <TouchableOpacity
                      key={p.label}
                      style={[
                        styles.quickChip,
                        {
                          backgroundColor: isSelected
                            ? colors.accent
                            : colors.surfaceSecondary,
                          borderColor: isSelected
                            ? colors.accent
                            : colors.borderLight,
                        },
                      ]}
                      onPress={() => setDurationMin(String(p.mins))}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.quickChipText,
                          {
                            color: isSelected
                              ? "#FFFFFF"
                              : colors.textSecondary,
                          },
                        ]}
                      >
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 6. Trip Purpose Chips */}
            <View style={styles.inputGroup}>
              <Text
                style={[
                  styles.fieldLabel,
                  { color: colors.textSecondary, marginBottom: Spacing.xs },
                ]}
              >
                TRIP PURPOSE
              </Text>
              <View style={styles.purposeChipsRow}>
                {COMMON_PURPOSES.map((p) => {
                  const isSelected = purpose === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.purposeChip,
                        {
                          backgroundColor: isSelected
                            ? colors.accent
                            : colors.surface,
                          borderColor: isSelected
                            ? colors.accent
                            : colors.border,
                        },
                      ]}
                      onPress={() => setPurpose(p)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.purposeChipText,
                          { color: isSelected ? "#FFFFFF" : colors.text },
                        ]}
                      >
                        {p}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 7. Notes */}
            <View style={styles.inputGroup}>
              <Text
                style={[
                  styles.fieldLabel,
                  { color: colors.textSecondary, marginBottom: Spacing.xs },
                ]}
              >
                NOTES (OPTIONAL)
              </Text>
              <TextInput
                style={[
                  styles.textArea,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                multiline
                numberOfLines={3}
                placeholder="e.g. Highway expressway commute, light traffic"
                placeholderTextColor={colors.textTertiary}
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          </View>
        </ScrollView>

        {/* ── Pinned Bottom Bar ── */}
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, Spacing.sm),
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.submitBtn,
              {
                backgroundColor: colors.accent,
                opacity: isSubmitting ? 0.7 : 1,
              },
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            <Text style={styles.submitBtnText}>
              {isSubmitting ? "Saving Trip..." : "💾 Save Manual Trip"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  headerSaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: Sizing.radiusFull,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSaveBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  vehicleContextCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm + 2,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  vehIconWrap: {
    width: 38,
    height: 38,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  vehNickname: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  vehDetails: {
    fontSize: 12,
    marginTop: 1,
  },
  heroDistanceCard: {
    borderRadius: Sizing.radiusMd,
    borderWidth: 1.5,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    alignItems: "center",
  },
  heroDistanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 4,
  },
  heroCardLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  calcBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Sizing.radiusSm,
  },
  calcBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  heroBigDistance: {
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginVertical: 2,
  },
  heroUnit: {
    fontSize: 18,
    fontWeight: "600",
  },
  heroSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
    textAlign: "center",
  },
  formSection: {
    gap: Spacing.md,
  },
  inputGroup: {
    gap: 4,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  helperActionText: {
    fontSize: 11,
    fontWeight: "700",
  },
  textInput: {
    height: 48,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    fontWeight: "600",
  },
  quickChipsRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  chipsPrefix: {
    fontSize: 11,
    fontWeight: "600",
    marginRight: 2,
  },
  quickChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  switchCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
  },
  switchCardTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  switchCardSubtitle: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16,
  },
  switchWarningText: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  purposeChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  purposeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
  },
  purposeChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  textArea: {
    minHeight: 68,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 14,
    textAlignVertical: "top",
  },
  bottomBar: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  submitBtn: {
    height: 52,
    borderRadius: Sizing.radiusMd,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#EA580C",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
});
