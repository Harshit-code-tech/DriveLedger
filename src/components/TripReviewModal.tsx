/**
 * Trip Review & Finish Modal
 *
 * Screen presented upon concluding an active GPS trip.
 * Allows user to verify recorded distance, review GPS estimated endpoint,
 * resolve any baseline conflicts, enter confirmed dashboard odometer reading,
 * assign a purpose/notes, and explicitly choose whether to update the canonical vehicle odometer.
 *
 * Styled in the Refined Technical Automotive Cockpit design:
 * - Clean FormHeader with circular back button and quick Save action
 * - Vehicle context card showing active vehicle & current baseline
 * - 4-tile telematics metrics grid (Distance, Duration, Avg Pace, Recorded Waypoints)
 * - Baseline conflict & GPS signal gap warning cards
 * - Speed & Efficiency breakdown section
 * - Visual odometer reconciliation card with progression arrow
 * - Dashboard odometer input with quick shortcut chips (Use GPS Est, +1, +5, +10 km)
 * - Canonical vehicle odometer reconciliation toggle with historical rollback protection
 * - Purpose chips & optional notes
 * - Pinned 52dp Automotive Orange save button
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
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import type { Vehicle } from '@/types/vehicle';
import type { Trip } from '@/types/trip';
import { formatDisplayDateLong } from '@/utils/date';
import * as tripRepo from '@/database/repositories/tripRepo';
import * as fuelRepo from '@/database/repositories/fuelRepo';
import { FuelType, VehicleType } from '@/constants/fuelTypes';
import { computeMileageStats } from '@/engine/mileageEngine';
import { analyzeTripSpeedBands } from '@/engine/speedBandAnalysisEngine';
import { SpeedEfficiencySection } from '@/components/SpeedEfficiencySection';
import { FormHeader } from '@/components/FormHeader';
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

const COMMON_PURPOSES = [
  'Commute',
  'Business',
  'Personal',
  'Highway Roadtrip',
  'Service Run',
  'Delivery',
  'Other',
];

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

  const isTwoWheeler = targetVehicle.vehicle_type === VehicleType.TWO_WHEELER;
  const durationMinutes = Math.round(liveMetrics.elapsedSeconds / 60);
  const avgSpeedKmh = liveMetrics.distanceKm > 0 && liveMetrics.elapsedSeconds > 10
    ? Math.round(liveMetrics.distanceKm / (liveMetrics.elapsedSeconds / 3600))
    : 0;

  const parsedEndOdo = endOdometer.trim() ? parseFloat(endOdometer.trim()) : undefined;
  const isHistorical =
    parsedEndOdo !== undefined &&
    typeof targetVehicle.current_odometer === 'number' &&
    parsedEndOdo < targetVehicle.current_odometer;

  const handleQuickAdd = (delta: number) => {
    const current = parseFloat(endOdometer) || estimatedEndOdo || (activeTrip.start_odometer ?? targetVehicle.current_odometer ?? 0);
    setEndOdometer(String(Math.round((current + delta) * 10) / 10));
  };

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
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Standardized Automotive Cockpit Header ── */}
        <FormHeader
          title="Trip Summary & Review"
          subtitle={`${formatDisplayDateLong(new Date().toISOString().split('T')[0])} · ${targetVehicle.nickname}`}
          onCancel={onCancel}
          rightAction={
            <TouchableOpacity
              onPress={handleSave}
              disabled={isSaving}
              style={[styles.headerSaveBtn, { backgroundColor: '#EA580C', opacity: isSaving ? 0.6 : 1 }]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Save Trip"
            >
              <Text style={styles.headerSaveBtnText}>{isSaving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          }
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom: insets.bottom + 110,
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
                { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight },
              ]}
            >
              <Text style={{ fontSize: 18 }}>{isTwoWheeler ? '🏍️' : '🚗'}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.vehicleNameRow}>
                <Text style={[styles.vehicleNickname, { color: colors.text }]}>
                  {targetVehicle.nickname}
                </Text>
                {targetVehicle.registration_number ? (
                  <View
                    style={[
                      styles.regBadge,
                      { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight },
                    ]}
                  >
                    <Text style={[styles.regBadgeText, { color: colors.textSecondary }]}>
                      {targetVehicle.registration_number}
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text style={[styles.vehicleSubtext, { color: colors.textSecondary }]}>
                Current Odometer: {targetVehicle.current_odometer !== null && targetVehicle.current_odometer !== undefined ? `${targetVehicle.current_odometer.toLocaleString('en-IN')} km` : 'Not set'}
              </Text>
            </View>
          </View>

          {/* ── Baseline Conflict Alert Banner ── */}
          {baselineConflict.hasConflict && (
            <View
              style={[
                styles.conflictBanner,
                { backgroundColor: colors.warningLight, borderColor: colors.warning },
              ]}
            >
              <Text style={[Typography.caption, { color: colors.warning, fontWeight: '800' }]}>
                ⚠️ Baseline Odometer Conflict Detected
              </Text>
              <Text style={[Typography.caption, { color: colors.text, marginTop: 4, lineHeight: 18 }]}>
                {baselineConflict.reason}
              </Text>
              <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                Please verify and confirm your physical dashboard odometer reading before saving.
              </Text>
            </View>
          )}

          {/* ── GPS Signal Gap Warning ── */}
          {liveMetrics.hasGaps && (
            <View
              style={[
                styles.gapBanner,
                { backgroundColor: colors.warningLight, borderColor: colors.warning },
              ]}
            >
              <Text style={[Typography.caption, { color: colors.warning, fontWeight: '700' }]}>
                ⚠️ Intermittent GPS signal gaps detected during tracking. Distance represents best interpolated approximation.
              </Text>
            </View>
          )}

          {/* ── 4-Tile Telematics Metrics Grid ── */}
          <View style={styles.metricsGrid}>
            <View
              style={[
                styles.metricCard,
                { backgroundColor: colors.surface, borderColor: colors.borderLight, ...Sizing.cardShadow },
              ]}
            >
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                GPS DISTANCE
              </Text>
              <Text
                style={[
                  styles.metricValue,
                  { color: colors.primary, fontVariant: ['tabular-nums'] },
                ]}
              >
                {liveMetrics.distanceKm.toFixed(2)}
              </Text>
              <Text style={[styles.metricUnit, { color: colors.textSecondary }]}>
                KM
              </Text>
            </View>

            <View
              style={[
                styles.metricCard,
                { backgroundColor: colors.surface, borderColor: colors.borderLight, ...Sizing.cardShadow },
              ]}
            >
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                DURATION
              </Text>
              <Text
                style={[
                  styles.metricValue,
                  { color: colors.text, fontVariant: ['tabular-nums'] },
                ]}
              >
                {durationMinutes}
              </Text>
              <Text style={[styles.metricUnit, { color: colors.textSecondary }]}>
                MINUTES
              </Text>
            </View>

            <View
              style={[
                styles.metricCard,
                { backgroundColor: colors.surface, borderColor: colors.borderLight, ...Sizing.cardShadow },
              ]}
            >
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                AVG PACE
              </Text>
              <Text
                style={[
                  styles.metricValue,
                  { color: colors.text, fontVariant: ['tabular-nums'] },
                ]}
              >
                {avgSpeedKmh}
              </Text>
              <Text style={[styles.metricUnit, { color: colors.textSecondary }]}>
                KM / H
              </Text>
            </View>

            <View
              style={[
                styles.metricCard,
                { backgroundColor: colors.surface, borderColor: colors.borderLight, ...Sizing.cardShadow },
              ]}
            >
              <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>
                WAYPOINTS
              </Text>
              <Text
                style={[
                  styles.metricValue,
                  { color: colors.text, fontVariant: ['tabular-nums'] },
                ]}
              >
                {rawLocations.length || liveMetrics.samplesCount}
              </Text>
              <Text style={[styles.metricUnit, { color: colors.textSecondary }]}>
                SAMPLES
              </Text>
            </View>
          </View>

          {/* ── Speed & Efficiency Analysis Breakdown ── */}
          {speedAnalysis && speedAnalysis.hasSufficientData && (
            <View style={{ marginBottom: Spacing.md }}>
              <SpeedEfficiencySection
                analysis={speedAnalysis}
                vehicleAverageMileage={vehicleAverageMileage}
                vehicleFuelType={targetVehicle.fuel_type}
              />
            </View>
          )}

          {/* ── Form Section ── */}
          <View style={styles.formSection}>
            {/* Odometer Progression Card */}
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              ODOMETER RECONCILIATION
            </Text>

            <View
              style={[
                styles.progressionCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.progressionCol}>
                <Text style={[styles.progressionSubLabel, { color: colors.textSecondary }]}>
                  START BASELINE
                </Text>
                <Text style={[styles.progressionValue, { color: colors.text }]}>
                  {activeTrip.start_odometer !== null
                    ? `${activeTrip.start_odometer.toLocaleString('en-IN')} km`
                    : 'None recorded'}
                </Text>
              </View>

              <View style={styles.progressionArrowCol}>
                <View
                  style={[
                    styles.progressionDeltaPill,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight },
                  ]}
                >
                  <Text style={[styles.progressionDeltaText, { color: colors.primary }]}>
                    +{liveMetrics.distanceKm.toFixed(2)} km
                  </Text>
                </View>
                <Text style={{ fontSize: 16, color: colors.textSecondary }}>➔</Text>
              </View>

              <View style={[styles.progressionCol, { alignItems: 'flex-end' }]}>
                <Text style={[styles.progressionSubLabel, { color: colors.textSecondary }]}>
                  GPS ESTIMATED END
                </Text>
                <Text style={[styles.progressionValue, { color: colors.primary }]}>
                  {estimatedEndOdo !== null ? `${estimatedEndOdo.toLocaleString('en-IN')} km` : '—'}
                </Text>
              </View>
            </View>

            {/* Dashboard Odometer Input */}
            <View style={styles.fieldHeaderRow}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                CONFIRMED DASHBOARD ODOMETER (KM)
              </Text>
            </View>

            {/* Quick Adjustment Increment Chips */}
            <View style={styles.quickChipsRow}>
              {estimatedEndOdo !== null && (
                <TouchableOpacity
                  style={[
                    styles.quickChip,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight },
                  ]}
                  onPress={() => setEndOdometer(String(estimatedEndOdo))}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.quickChipText, { color: colors.primary, fontWeight: '700' }]}>
                    🎯 Use GPS Est ({estimatedEndOdo})
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.quickChip,
                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight },
                ]}
                onPress={() => handleQuickAdd(1)}
                activeOpacity={0.7}
              >
                <Text style={[styles.quickChipText, { color: colors.textSecondary }]}>+1 km</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.quickChip,
                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight },
                ]}
                onPress={() => handleQuickAdd(5)}
                activeOpacity={0.7}
              >
                <Text style={[styles.quickChipText, { color: colors.textSecondary }]}>+5 km</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.quickChip,
                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight },
                ]}
                onPress={() => handleQuickAdd(10)}
                activeOpacity={0.7}
              >
                <Text style={[styles.quickChipText, { color: colors.textSecondary }]}>+10 km</Text>
              </TouchableOpacity>
              {endOdometer ? (
                <TouchableOpacity
                  style={[
                    styles.quickChip,
                    { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight },
                  ]}
                  onPress={() => setEndOdometer('')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.quickChipText, { color: colors.danger }]}>✕ Clear</Text>
                </TouchableOpacity>
              ) : null}
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
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  marginTop: Spacing.md,
                },
              ]}
            >
              <View style={{ flex: 1, marginRight: Spacing.md }}>
                <Text style={[Typography.bodySmall, { color: colors.text, fontWeight: '700' }]}>
                  Update Vehicle Odometer
                </Text>
                <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                  Set canonical vehicle odometer to {parsedEndOdo !== undefined ? `${parsedEndOdo.toLocaleString('en-IN')} km` : 'this reading'}
                </Text>
                {isHistorical && (
                  <Text style={[Typography.caption, { color: colors.warning, marginTop: 4, fontWeight: '700' }]}>
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

            {/* Trip Purpose */}
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.textSecondary, marginTop: Spacing.lg, marginBottom: Spacing.xs },
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
                        backgroundColor: isSelected ? colors.primary : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setPurpose(p)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.purposeChipText,
                        {
                          color: isSelected ? colors.primaryText : colors.textSecondary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {p}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Optional Trip Notes */}
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.textSecondary, marginTop: Spacing.lg, marginBottom: Spacing.xs },
              ]}
            >
              TRIP NOTES (OPTIONAL)
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
              placeholder="e.g. Heavy traffic near toll plaza, highway route"
              placeholderTextColor={colors.textTertiary}
              value={notes}
              onChangeText={setNotes}
            />
          </View>
        </ScrollView>

        {/* ── Pinned Bottom Bar ── */}
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.borderLight,
              paddingBottom: Math.max(insets.bottom, Spacing.sm),
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.saveBtn,
              { backgroundColor: '#EA580C', opacity: isSaving ? 0.7 : 1 },
            ]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Save Trip to Logbook"
          >
            <Text style={[Typography.button, { color: '#FFFFFF', fontSize: 16, fontWeight: '800' }]}>
              {isSaving ? 'Saving Trip...' : '💾 Save Trip to Logbook'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onCancel}
            hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
            activeOpacity={0.7}
          >
            <Text style={[Typography.bodySmall, { color: colors.textSecondary, fontWeight: '600' }]}>
              Back to Recording HUD
            </Text>
          </TouchableOpacity>
        </View>
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
  headerSaveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Sizing.radiusFull,
  },
  headerSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  vehicleContextCard: {
    flexDirection: 'row',
    alignItems: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vehicleNickname: {
    fontSize: 16,
    fontWeight: '800',
  },
  regBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  regBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  vehicleSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  conflictBanner: {
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  gapBanner: {
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  metricCard: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: 4,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    marginVertical: 2,
  },
  metricUnit: {
    fontSize: 10,
    fontWeight: '700',
  },
  formSection: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  progressionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  progressionCol: {
    flex: 1,
  },
  progressionArrowCol: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    gap: 2,
  },
  progressionSubLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  progressionValue: {
    fontSize: 14,
    fontWeight: '800',
    marginTop: 3,
  },
  progressionDeltaPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
  },
  progressionDeltaText: {
    fontSize: 11,
    fontWeight: '800',
  },
  fieldHeaderRow: {
    marginBottom: Spacing.xs,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: 12,
  },
  textInput: {
    height: 48,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
  },
  purposeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  purposeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
  },
  purposeChipText: {
    fontSize: 12,
  },
  textArea: {
    minHeight: 76,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
  },
  saveBtn: {
    height: 52,
    borderRadius: Sizing.radiusLg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Sizing.cardShadow,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
});
