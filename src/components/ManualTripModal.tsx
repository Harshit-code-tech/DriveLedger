/**
 * Manual Trip Entry Modal
 *
 * Fast, reliable odometer-based trip logging without needing GPS or location permissions.
 *
 * FEATURES:
 * - Start / End odometer inputs
 * - Real-time distance calculation (end - start)
 * - Strict validation: end >= start via odometerReconciliation engine
 * - Canonical vehicle odometer reconciliation toggle with historical protection
 * - Purpose tags & notes
 * - 100% offline
 */

import React, { useMemo, useState } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sizing, Spacing, Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useTripStore } from '@/stores/tripStore';
import type { Vehicle } from '@/types/vehicle';
import { todayISO } from '@/utils/date';
import {
  validateManualTripOdometers,
  canUpdateCanonicalOdometer,
} from '@/engine/odometerReconciliation';

interface ManualTripModalProps {
  visible: boolean;
  vehicle: Vehicle;
  onSaved: () => void;
  onClose: () => void;
}

const COMMON_PURPOSES = ['Commute', 'Business', 'Personal', 'Roadtrip', 'Delivery'];

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
  const [startOdo, setStartOdo] = useState(
    vehicle.current_odometer ? String(vehicle.current_odometer) : ''
  );
  const [endOdo, setEndOdo] = useState('');
  const [shouldUpdateVehicleOdo, setShouldUpdateVehicleOdo] = useState(true);
  const [durationMin, setDurationMin] = useState('');
  const [purpose, setPurpose] = useState('Personal');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-computed distance using pure engine validator
  const calculatedDistance = useMemo(() => {
    const s = parseFloat(startOdo);
    const e = parseFloat(endOdo);
    const validation = validateManualTripOdometers(s, e);
    return validation.isValid ? validation.distanceKm : null;
  }, [startOdo, endOdo]);

  const parsedEndOdo = endOdo.trim() ? parseFloat(endOdo.trim()) : undefined;
  const isHistorical =
    parsedEndOdo !== undefined &&
    typeof vehicle.current_odometer === 'number' &&
    parsedEndOdo < vehicle.current_odometer;

  if (!visible) return null;

  const handleSubmit = () => {
    const s = parseFloat(startOdo.trim());
    const e = parseFloat(endOdo.trim());

    const validation = validateManualTripOdometers(s, e);
    if (!validation.isValid) {
      Alert.alert('Validation Error', validation.error || 'Please enter valid odometer readings.');
      return;
    }

    let parsedDuration: number | undefined;
    if (durationMin.trim()) {
      parsedDuration = parseInt(durationMin.trim(), 10);
      if (isNaN(parsedDuration) || parsedDuration < 0) {
        Alert.alert('Invalid Duration', 'Please enter duration in positive minutes.');
        return;
      }
    }

    const canonicalCheck = canUpdateCanonicalOdometer({
      proposedOdometer: e,
      currentCanonicalOdometer: vehicle.current_odometer,
      isExplicitlyConfirmed: shouldUpdateVehicleOdo,
    });

    try {
      setIsSubmitting(true);
      addManualTrip({
        vehicle_id: vehicle.id,
        date: date || todayISO(),
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
      const msg = err instanceof Error ? err.message : 'Failed to save manual trip';
      Alert.alert('Error', msg);
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
                Log Manual Trip
              </Text>
              <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
                Odometer distance log · No GPS required
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={[Typography.body, { color: colors.primary, fontWeight: '600' }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>

          {/* Computed Distance Banner */}
          <View
            style={[
              styles.distanceCard,
              {
                backgroundColor: calculatedDistance !== null ? colors.primaryLight : colors.card,
                borderColor: calculatedDistance !== null ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={[Typography.caption, { color: colors.textSecondary }]}>
              CALCULATED TRIP DISTANCE
            </Text>
            <Text
              style={[
                styles.bigDistance,
                { color: calculatedDistance !== null ? colors.primary : colors.textTertiary },
              ]}
            >
              {calculatedDistance !== null ? `${calculatedDistance} km` : '— km'}
            </Text>
          </View>

          {/* Inputs */}
          <View style={styles.formSection}>
            {/* Start Odometer */}
            <Text style={[Typography.caption, { color: colors.textSecondary, marginBottom: Spacing.xs }]}>
              STARTING ODOMETER (KM) *
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
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

            {/* End Odometer */}
            <Text
              style={[
                Typography.caption,
                { color: colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xs },
              ]}
            >
              ENDING ODOMETER (KM) *
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              keyboardType="numeric"
              placeholder="e.g. 45120"
              placeholderTextColor={colors.textTertiary}
              value={endOdo}
              onChangeText={setEndOdo}
            />

            {/* Canonical Odometer Update Toggle */}
            <View
              style={[
                styles.switchCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  marginTop: Spacing.md,
                },
              ]}
            >
              <View style={{ flex: 1, marginRight: Spacing.md }}>
                <Text style={[Typography.bodySmall, { color: colors.text, fontWeight: '600' }]}>
                  Update Vehicle Odometer
                </Text>
                <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                  Set canonical vehicle odometer to {parsedEndOdo !== undefined ? `${parsedEndOdo} km` : 'ending reading'}
                </Text>
                {isHistorical && (
                  <Text style={[Typography.caption, { color: colors.warning, marginTop: 4, fontWeight: '600' }]}>
                    Historical reading cannot roll back current vehicle odometer ({vehicle.current_odometer} km).
                  </Text>
                )}
              </View>
              <Switch
                value={shouldUpdateVehicleOdo && !isHistorical}
                onValueChange={setShouldUpdateVehicleOdo}
                disabled={isHistorical || parsedEndOdo === undefined}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            {/* Duration */}
            <Text
              style={[
                Typography.caption,
                { color: colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xs },
              ]}
            >
              DURATION IN MINUTES (OPTIONAL)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              keyboardType="numeric"
              placeholder="e.g. 90"
              placeholderTextColor={colors.textTertiary}
              value={durationMin}
              onChangeText={setDurationMin}
            />

            {/* Date */}
            <Text
              style={[
                Typography.caption,
                { color: colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xs },
              ]}
            >
              DATE (YYYY-MM-DD)
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
              value={date}
              onChangeText={setDate}
            />

            {/* Purpose */}
            <Text
              style={[
                Typography.caption,
                { color: colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xs },
              ]}
            >
              TRIP PURPOSE
            </Text>
            <View style={styles.chipsRow}>
              {COMMON_PURPOSES.map((p) => {
                const isSelected = purpose === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.card,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setPurpose(p)}
                  >
                    <Text
                      style={[
                        Typography.caption,
                        {
                          color: isSelected ? colors.primaryText : colors.textSecondary,
                          fontWeight: '600',
                        },
                      ]}
                    >
                      {p}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Notes */}
            <Text
              style={[
                Typography.caption,
                { color: colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xs },
              ]}
            >
              NOTES (OPTIONAL)
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              multiline
              numberOfLines={3}
              placeholder="e.g. Client site visit via highway"
              placeholderTextColor={colors.textTertiary}
              value={notes}
              onChangeText={setNotes}
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              { backgroundColor: colors.primary, opacity: isSubmitting ? 0.7 : 1 },
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={[Typography.button, { color: colors.primaryText }]}>
              {isSubmitting ? 'Saving...' : '💾 Save Manual Trip'}
            </Text>
          </TouchableOpacity>
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
  distanceCard: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: Sizing.radiusLg,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Sizing.cardShadow,
  },
  bigDistance: {
    fontSize: 36,
    fontWeight: '800',
    marginTop: 4,
  },
  formSection: {
    marginBottom: Spacing.xl,
  },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
  },
  input: {
    height: 48,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  textArea: {
    minHeight: 70,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
  },
  submitBtn: {
    height: 56,
    borderRadius: Sizing.radiusLg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
