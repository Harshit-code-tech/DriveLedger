/**
 * Trip Review & Finish Modal
 *
 * Screen presented upon concluding an active GPS trip.
 * Allows user to verify recorded distance, enter odometer reconciliation,
 * assign a purpose/notes, and persist to SQLite.
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
import { useTripStore } from '@/stores/tripStore';
import type { Vehicle } from '@/types/vehicle';
import { formatDisplayDateLong } from '@/utils/date';

interface TripReviewModalProps {
  visible: boolean;
  vehicle: Vehicle;
  onSaved: () => void;
  onCancel: () => void;
}

const COMMON_PURPOSES = ['Commute', 'Business', 'Personal', 'Highway Roadtrip', 'Service Run'];

export function TripReviewModal({
  visible,
  vehicle,
  onSaved,
  onCancel,
}: TripReviewModalProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const activeTrip = useTripStore((s) => s.activeTrip);
  const liveMetrics = useTripStore((s) => s.liveMetrics);
  const finishGpsTrip = useTripStore((s) => s.finishGpsTrip);

  const [purpose, setPurpose] = useState(activeTrip?.purpose || 'Personal');
  const [endOdometer, setEndOdometer] = useState(
    vehicle.current_odometer
      ? String(Math.round(vehicle.current_odometer + liveMetrics.distanceKm))
      : ''
  );
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!visible || !activeTrip) return null;

  const durationMinutes = Math.round(liveMetrics.elapsedSeconds / 60);

  const handleSave = async () => {
    if (isSaving) return;

    // Validate odometer if provided
    let parsedEndOdo: number | undefined;
    if (endOdometer.trim()) {
      parsedEndOdo = parseFloat(endOdometer.trim());
      if (isNaN(parsedEndOdo) || parsedEndOdo < 0) {
        Alert.alert('Invalid Odometer', 'Please enter a valid non-negative odometer reading.');
        return;
      }
      if (activeTrip.start_odometer && parsedEndOdo < activeTrip.start_odometer) {
        Alert.alert(
          'Odometer Warning',
          `End odometer (${parsedEndOdo}) cannot be lower than start odometer (${activeTrip.start_odometer}).`
        );
        return;
      }
    }

    try {
      setIsSaving(true);
      const finalized = await finishGpsTrip({
        notes: notes.trim() || undefined,
        purpose: purpose.trim() || undefined,
        endOdometer: parsedEndOdo,
      });

      if (finalized) {
        setIsSaving(false);
        onSaved();
      } else {
        setIsSaving(false);
        Alert.alert('Save Failed', 'Unable to finalize trip record. Please try again.');
      }
    } catch (err: unknown) {
      setIsSaving(false);
      const msg = err instanceof Error ? err.message : 'Error finalizing trip';
      Alert.alert('Error', msg);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
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
            <Text style={[Typography.h2, { color: colors.text }]}>
              Trip Summary
            </Text>
            <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
              {formatDisplayDateLong(new Date().toISOString().split('T')[0])} · {vehicle.nickname}
            </Text>
          </View>

          {/* Warning Banner if GPS quality had issues */}
          {liveMetrics.hasGaps && (
            <View
              style={[
                styles.warningBanner,
                { backgroundColor: colors.warningLight },
              ]}
            >
              <Text
                style={[
                  Typography.caption,
                  { color: colors.warning, fontWeight: '700' },
                ]}
              >
                ⚠️ Note: Signal loss or coordinate gaps were detected during this trip. Distance is an approximation.
              </Text>
            </View>
          )}

          {/* Stat Cards */}
          <View style={styles.statsRow}>
            <View
              style={[
                styles.statCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[Typography.caption, { color: colors.textSecondary }]}>
                ESTIMATED DISTANCE
              </Text>
              <Text style={[styles.statValue, { color: colors.primary }]}>
                {liveMetrics.distanceKm.toFixed(2)}
              </Text>
              <Text style={[Typography.caption, { color: colors.textSecondary }]}>
                km
              </Text>
            </View>

            <View
              style={[
                styles.statCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[Typography.caption, { color: colors.textSecondary }]}>
                DURATION
              </Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {durationMinutes}
              </Text>
              <Text style={[Typography.caption, { color: colors.textSecondary }]}>
                minutes
              </Text>
            </View>
          </View>

          {/* Form Fields */}
          <View style={styles.formSection}>
            {/* Purpose */}
            <Text
              style={[
                Typography.caption,
                { color: colors.textSecondary, marginBottom: Spacing.xs },
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
                        backgroundColor: isSelected
                          ? colors.primary
                          : colors.card,
                        borderColor: isSelected
                          ? colors.primary
                          : colors.border,
                      },
                    ]}
                    onPress={() => setPurpose(p)}
                  >
                    <Text
                      style={[
                        Typography.caption,
                        {
                          color: isSelected
                            ? colors.primaryText
                            : colors.textSecondary,
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

            {/* End Odometer */}
            <Text
              style={[
                Typography.caption,
                { color: colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xs },
              ]}
            >
              END ODOMETER READING (OPTIONAL)
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
              placeholder="e.g. 42350"
              placeholderTextColor={colors.textTertiary}
              value={endOdometer}
              onChangeText={setEndOdometer}
            />

            {/* Notes */}
            <Text
              style={[
                Typography.caption,
                { color: colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xs },
              ]}
            >
              TRIP NOTES (OPTIONAL)
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
              placeholder="e.g. Heavy traffic near toll plaza, highway route"
              placeholderTextColor={colors.textTertiary}
              value={notes}
              onChangeText={setNotes}
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[
              styles.saveBtn,
              { backgroundColor: colors.primary, opacity: isSaving ? 0.7 : 1 },
            ]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={[Typography.button, { color: colors.primaryText }]}>
              {isSaving ? 'Saving Trip...' : '💾 Save Trip to Logbook'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
              Back to Recording HUD
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
    marginBottom: Spacing.md,
  },
  warningBanner: {
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Sizing.radiusLg,
    borderWidth: 1,
    alignItems: 'center',
    ...Sizing.cardShadow,
  },
  statValue: {
    fontSize: 34,
    fontWeight: '800',
    marginVertical: 4,
  },
  formSection: {
    marginBottom: Spacing.xl,
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
  input: {
    height: 48,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  saveBtn: {
    height: 56,
    borderRadius: Sizing.radiusLg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
});
