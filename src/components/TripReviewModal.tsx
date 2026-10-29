/**
 * Trip Review & Finish Modal
 *
 * Screen presented upon concluding an active GPS trip.
 * Allows user to verify recorded distance, review GPS estimated endpoint,
 * resolve any baseline conflicts, enter confirmed dashboard odometer reading,
 * assign a purpose/notes, and explicitly choose whether to update the canonical vehicle odometer.
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
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import type { Vehicle } from '@/types/vehicle';
import type { Trip } from '@/types/trip';
import { formatDisplayDateLong } from '@/utils/date';
import * as tripRepo from '@/database/repositories/tripRepo';
import * as fuelRepo from '@/database/repositories/fuelRepo';
import { FuelType } from '@/constants/fuelTypes';
import { computeMileageStats } from '@/engine/mileageEngine';
import { analyzeTripSpeedBands } from '@/engine/speedBandAnalysisEngine';
import { SpeedEfficiencySection } from '@/components/SpeedEfficiencySection';
import {
  calculateEstimatedEndOdometer,
  detectBaselineConflict,
  canUpdateCanonicalOdometer,
} from '@/engine/odometerReconciliation';

interface TripReviewModalProps {
  visible: boolean;
  vehicle: Vehicle;
  onSaved: (finalizedTrip?: Trip | null) => void;
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

  const targetVehicle = useMemo(() => {
    if (!visible) return vehicle;
    if (activeTrip && activeTrip.vehicle_id !== vehicle.id) {
      const v = vehicleRepo.getVehicleById(activeTrip.vehicle_id);
      if (v) return v;
    }
    return vehicle;
  }, [visible, activeTrip?.vehicle_id, vehicle]);

  const estimatedEndOdo = useMemo(() => {
    if (!visible || !activeTrip) return null;
    const startOdo = activeTrip.start_odometer ?? targetVehicle.current_odometer;
    return calculateEstimatedEndOdometer(startOdo, liveMetrics.distanceKm);
  }, [visible, activeTrip?.start_odometer, targetVehicle.current_odometer, liveMetrics.distanceKm]);

  const baselineConflict = useMemo(() => {
    if (!visible || !activeTrip) return { hasConflict: false, expectedEstimatedEndOdo: null };
    return detectBaselineConflict(
      activeTrip.start_odometer,
      targetVehicle.current_odometer,
      liveMetrics.distanceKm
    );
  }, [visible, activeTrip?.start_odometer, targetVehicle.current_odometer, liveMetrics.distanceKm]);

  const rawLocations = useMemo(() => {
    if (!visible || !activeTrip) return [];
    try {
      return tripRepo.getTripLocations(activeTrip.id);
    } catch {
      return [];
    }
  }, [visible, activeTrip?.id]);

  const vehicleAverageMileage = useMemo(() => {
    if (!visible || !targetVehicle?.id) return null;
    try {
      const entries = fuelRepo.getFuelEntriesByVehicle(targetVehicle.id);
      const stats = computeMileageStats(entries, targetVehicle.fuel_type as FuelType);
      return stats.runningAverage;
    } catch {
      return null;
    }
  }, [visible, targetVehicle]);

  const speedAnalysis = useMemo(() => {
    if (!visible || !activeTrip || rawLocations.length === 0) return null;
    let pauseIntervals: Array<{ paused_at: number; resumed_at: number }> = [];
    if (activeTrip.diagnostics) {
      try {
        const parsed = JSON.parse(activeTrip.diagnostics);
        if (Array.isArray(parsed?.pause_intervals)) {
          pauseIntervals = parsed.pause_intervals;
        }
      } catch {}
    }
    return analyzeTripSpeedBands(rawLocations, {
      pauseIntervals,
      totalTripDistanceKm: liveMetrics.distanceKm,
      totalTripDurationSeconds: liveMetrics.elapsedSeconds,
      baselineMileage: vehicleAverageMileage?.value,
      fuelType: targetVehicle?.fuel_type,
    });
  }, [visible, activeTrip, rawLocations, liveMetrics.distanceKm, liveMetrics.elapsedSeconds, vehicleAverageMileage, targetVehicle]);

  const [purpose, setPurpose] = useState(activeTrip?.purpose || 'Personal');
  const [endOdometer, setEndOdometer] = useState(
    estimatedEndOdo !== null ? String(estimatedEndOdo) : ''
  );
  const [shouldUpdateVehicleOdo, setShouldUpdateVehicleOdo] = useState(true);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!visible || !activeTrip) return null;

  const durationMinutes = Math.round(liveMetrics.elapsedSeconds / 60);

  const parsedEndOdo = endOdometer.trim() ? parseFloat(endOdometer.trim()) : undefined;
  const isHistorical =
    parsedEndOdo !== undefined &&
    typeof targetVehicle.current_odometer === 'number' &&
    parsedEndOdo < targetVehicle.current_odometer;

  const handleSave = async () => {
    if (isSaving) return;

    // Validate odometer if provided
    let validEndOdo: number | undefined;
    if (endOdometer.trim()) {
      validEndOdo = parseFloat(endOdometer.trim());
      if (isNaN(validEndOdo) || validEndOdo < 0) {
        Alert.alert('Invalid Odometer', 'Please enter a valid non-negative odometer reading.');
        return;
      }
      if (
        typeof activeTrip.start_odometer === 'number' &&
        validEndOdo < activeTrip.start_odometer
      ) {
        Alert.alert(
          'Odometer Warning',
          `End odometer (${validEndOdo}) cannot be lower than start baseline (${activeTrip.start_odometer}).`
        );
        return;
      }
    }

    const canonicalCheck = canUpdateCanonicalOdometer({
      proposedOdometer: validEndOdo,
      currentCanonicalOdometer: targetVehicle.current_odometer,
      isExplicitlyConfirmed: shouldUpdateVehicleOdo,
    });

    try {
      setIsSaving(true);
      const finalized = await finishGpsTrip({
        notes: notes.trim() || undefined,
        purpose: purpose.trim() || undefined,
        endOdometer: validEndOdo,
        updateVehicleOdometer: canonicalCheck.canUpdate,
      });

      if (finalized) {
        setIsSaving(false);
        onSaved(finalized);
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
              {formatDisplayDateLong(new Date().toISOString().split('T')[0])} · {targetVehicle.nickname}
            </Text>
          </View>

          {/* Baseline Conflict Banner */}
          {baselineConflict.hasConflict && (
            <View
              style={[
                styles.banner,
                { backgroundColor: colors.warningLight, borderColor: colors.warning },
              ]}
            >
              <Text style={[Typography.caption, { color: colors.warning, fontWeight: '700' }]}>
                ⚠️ Baseline Odometer Conflict Detected
              </Text>
              <Text style={[Typography.caption, { color: colors.text, marginTop: 4 }]}>
                {baselineConflict.reason}
              </Text>
              <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                Please check and enter your physical dashboard odometer reading before saving.
              </Text>
            </View>
          )}

          {/* Signal Gap Warning */}
          {liveMetrics.hasGaps && (
            <View
              style={[
                styles.banner,
                { backgroundColor: colors.warningLight, borderColor: colors.warning },
              ]}
            >
              <Text style={[Typography.caption, { color: colors.warning, fontWeight: '700' }]}>
                ⚠️ Signal loss or coordinate gaps detected during this trip. Distance is an approximation.
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
                GPS DISTANCE
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

          {/* Speed & Efficiency Analysis Breakdown */}
          {speedAnalysis && speedAnalysis.hasSufficientData && (
            <View style={{ marginBottom: Spacing.md }}>
              <SpeedEfficiencySection
                analysis={speedAnalysis}
                vehicleAverageMileage={vehicleAverageMileage}
                vehicleFuelType={targetVehicle.fuel_type}
              />
            </View>
          )}

          {/* Form Fields */}
          <View style={styles.formSection}>
            {/* Odometer Reconciliation */}
            <Text
              style={[
                Typography.caption,
                { color: colors.textSecondary, marginBottom: Spacing.xs },
              ]}
            >
              ODOMETER RECONCILIATION
            </Text>

            <View
              style={[
                styles.baselineCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.baselineRow}>
                <Text style={[Typography.caption, { color: colors.textSecondary }]}>
                  Trip Start Baseline:
                </Text>
                <Text style={[Typography.bodySmall, { color: colors.text, fontWeight: '600' }]}>
                  {activeTrip.start_odometer !== null ? `${activeTrip.start_odometer} km` : 'None recorded'}
                </Text>
              </View>
              <View style={[styles.baselineRow, { marginTop: 6 }]}>
                <Text style={[Typography.caption, { color: colors.textSecondary }]}>
                  GPS Estimated Endpoint:
                </Text>
                <Text style={[Typography.bodySmall, { color: colors.primary, fontWeight: '700' }]}>
                  {estimatedEndOdo !== null ? `${estimatedEndOdo} km` : '—'}
                </Text>
              </View>
            </View>

            {/* Dashboard Odometer Input */}
            <Text
              style={[
                Typography.caption,
                { color: colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xs },
              ]}
            >
              CONFIRMED DASHBOARD ODOMETER (KM)
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
              placeholder={estimatedEndOdo !== null ? String(estimatedEndOdo) : 'e.g. 42350'}
              placeholderTextColor={colors.textTertiary}
              value={endOdometer}
              onChangeText={setEndOdometer}
            />
            <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 4 }]}>
              Editing this reading confirms your dashboard value and never alters your recorded GPS distance ({liveMetrics.distanceKm.toFixed(2)} km).
            </Text>

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
                  Set canonical vehicle odometer to {parsedEndOdo !== undefined ? `${parsedEndOdo} km` : 'this reading'}
                </Text>
                {isHistorical && (
                  <Text style={[Typography.caption, { color: colors.warning, marginTop: 4, fontWeight: '600' }]}>
                    Historical reading cannot roll back current vehicle odometer ({targetVehicle.current_odometer} km).
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

            {/* Purpose */}
            <Text
              style={[
                Typography.caption,
                { color: colors.textSecondary, marginTop: Spacing.lg, marginBottom: Spacing.xs },
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
  banner: {
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
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
  baselineCard: {
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
  },
  baselineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
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
