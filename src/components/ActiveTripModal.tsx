/**
 * Active Trip Recording HUD Modal
 *
 * Dedicated, distraction-free digital cockpit display for in-progress GPS trip recording.
 *
 * DESIGN:
 * - High-contrast automotive cockpit aesthetics
 * - Hero digital speedometer dial with large 72sp speed readout
 * - Flanking telematics gauges for Distance and Elapsed Time
 * - Dedicated 100% Offline privacy pill and GPS precision indicator
 * - 56dp tactile driver touch controls for Pause / Resume / Finish
 * - Zero map dependencies; 100% offline
 */

import React from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sizing, Spacing, Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useTripStore } from '@/stores/tripStore';
import type { Vehicle } from '@/types/vehicle';

interface ActiveTripModalProps {
  visible: boolean;
  vehicle: Vehicle;
  onFinish: () => void;
  onClose: () => void;
}

export function ActiveTripModal({
  visible,
  vehicle,
  onFinish,
  onClose,
}: ActiveTripModalProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const activeTrip = useTripStore((s) => s.activeTrip);
  const recordingState = useTripStore((s) => s.recordingState);
  const liveMetrics = useTripStore((s) => s.liveMetrics);
  const pauseGpsTrip = useTripStore((s) => s.pauseGpsTrip);
  const resumeGpsTrip = useTripStore((s) => s.resumeGpsTrip);
  const cancelGpsTrip = useTripStore((s) => s.cancelGpsTrip);

  if (!visible || !activeTrip) return null;

  // Format seconds into HH:MM:SS
  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
  };

  const speedKmh = liveMetrics.currentSpeed !== null
    ? Math.round(liveMetrics.currentSpeed * 3.6)
    : 0;

  const handleCancel = () => {
    Alert.alert(
      'Discard Trip?',
      'Are you sure you want to stop and discard this recorded trip? All recorded location points will be discarded.',
      [
        { text: 'Keep Recording', style: 'cancel' },
        {
          text: 'Discard Trip',
          style: 'destructive',
          onPress: async () => {
            await cancelGpsTrip();
            onClose();
          },
        },
      ]
    );
  };

  const getGpsQualityBadge = () => {
    switch (liveMetrics.gpsQuality) {
      case 'good':
        return {
          label: `GPS Good (${Math.round(liveMetrics.currentAccuracy ?? 0)}m)`,
          color: colors.success,
          bg: colors.successLight,
        };
      case 'fair':
        return {
          label: `GPS Fair (${Math.round(liveMetrics.currentAccuracy ?? 0)}m)`,
          color: colors.warning,
          bg: colors.warningLight,
        };
      case 'poor':
        return {
          label: `GPS Weak (${Math.round(liveMetrics.currentAccuracy ?? 0)}m)`,
          color: colors.danger,
          bg: colors.dangerLight,
        };
      default:
        return {
          label: 'Acquiring GPS...',
          color: colors.textSecondary,
          bg: colors.borderLight,
        };
    }
  };

  const gpsBadge = getGpsQualityBadge();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + Spacing.md,
            paddingBottom: insets.bottom + Spacing.lg,
          },
        ]}
      >
        {/* ── Top Bar: Navigation & Status ── */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={[styles.minimizeBtn, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.8}
          >
            <Text style={[Typography.button, { color: colors.primary, fontSize: 13 }]}>
              ⬇️ Dashboard
            </Text>
          </TouchableOpacity>

          <View style={styles.topBarRightStatus}>
            {/* GPS Quality Pill */}
            <View style={[styles.qualityPill, { backgroundColor: gpsBadge.bg }]}>
              <View style={[styles.indicatorDot, { backgroundColor: gpsBadge.color }]} />
              <Text style={[Typography.caption, { color: gpsBadge.color, fontWeight: '700', fontSize: 11 }]}>
                {gpsBadge.label}
              </Text>
            </View>

            {/* Offline Badge */}
            <View style={[styles.offlinePill, { backgroundColor: colors.successLight }]}>
              <Text style={[Typography.caption, { color: colors.success, fontWeight: '800', fontSize: 10 }]}>
                🔒 OFFLINE
              </Text>
            </View>
          </View>
        </View>

        {/* ── Vehicle Subtitle ── */}
        <View style={styles.vehicleHeaderRow}>
          <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
            Trip Computer for{' '}
            <Text style={{ fontWeight: '800', color: colors.text }}>
              {vehicle.nickname}
            </Text>
          </Text>
        </View>

        {/* ── Paused / Gap Warning Banner ── */}
        {recordingState === 'paused' ? (
          <View style={[styles.statusBanner, { backgroundColor: colors.warningLight }]}>
            <Text style={[Typography.bodySmall, { color: colors.warning, fontWeight: '800' }]}>
              ⏸️ Trip is Paused · Speedometer Inactive
            </Text>
          </View>
        ) : liveMetrics.hasGaps ? (
          <View style={[styles.statusBanner, { backgroundColor: colors.warningLight }]}>
            <Text style={[Typography.caption, { color: colors.warning, fontWeight: '700' }]}>
              ⚠️ Intermittent GPS signal gaps detected
            </Text>
          </View>
        ) : null}

        {/* ── Main Cockpit Display ── */}
        <View style={styles.cockpitCenter}>
          {/* Hero Speedometer Gauge Card */}
          <View
            style={[
              styles.speedometerCard,
              {
                backgroundColor: colors.surface,
                borderColor: recordingState === 'paused' ? colors.warning + '60' : colors.primary + '50',
                ...Sizing.cardShadow,
              },
            ]}
          >
            <View style={styles.speedometerRing}>
              <View
                style={[
                  styles.speedModeBadge,
                  {
                    backgroundColor:
                      recordingState === 'paused'
                        ? colors.warningLight
                        : colors.primaryLight ?? (colors.primary + '20'),
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '800',
                    color: recordingState === 'paused' ? colors.warning : colors.primary,
                    letterSpacing: 1,
                  }}
                >
                  {recordingState === 'paused' ? 'PAUSED' : 'LIVE SPEED'}
                </Text>
              </View>

              {/* Large Digital Speed Readout */}
              <Text style={[styles.speedHeroNumber, { color: colors.text }]}>
                {speedKmh}
              </Text>

              <Text style={[styles.speedUnitLabel, { color: colors.primary }]}>
                KM / H
              </Text>
            </View>
          </View>

          {/* Dual Telematics Gauges: Distance & Time */}
          <View style={styles.telematicsGaugesRow}>
            {/* Distance Gauge */}
            <View
              style={[
                styles.telematicsGaugeCard,
                { backgroundColor: colors.surface, borderColor: colors.borderLight, ...Sizing.cardShadow },
              ]}
            >
              <Text style={[Typography.caption, { color: colors.textSecondary, fontWeight: '700', letterSpacing: 0.5 }]}>
                DISTANCE
              </Text>
              <Text style={[styles.gaugeStatNumber, { color: colors.text }]}>
                {liveMetrics.distanceKm.toFixed(2)}
              </Text>
              <Text style={[Typography.caption, { color: colors.primary, fontWeight: '800', fontSize: 12 }]}>
                KILOMETRES
              </Text>
            </View>

            {/* Time Gauge */}
            <View
              style={[
                styles.telematicsGaugeCard,
                { backgroundColor: colors.surface, borderColor: colors.borderLight, ...Sizing.cardShadow },
              ]}
            >
              <Text style={[Typography.caption, { color: colors.textSecondary, fontWeight: '700', letterSpacing: 0.5 }]}>
                TIME
              </Text>
              <Text style={[styles.gaugeStatNumber, { color: colors.text }]}>
                {formatTime(liveMetrics.elapsedSeconds)}
              </Text>
              <Text style={[Typography.caption, { color: colors.textSecondary, fontWeight: '700', fontSize: 12 }]}>
                ELAPSED
              </Text>
            </View>
          </View>

          {/* Precision & Privacy Footer */}
          <View style={styles.telemetryFooterInfo}>
            <Text style={[Typography.caption, { color: colors.textTertiary, textAlign: 'center', fontSize: 11 }]}>
              📍 {liveMetrics.samplesCount} GPS Points Logged · Device-Only · No Data Required
            </Text>
          </View>
        </View>

        {/* ── Driver Tactile Controls ── */}
        <View style={styles.actionContainer}>
          {/* Pause / Resume Button */}
          {recordingState === 'recording' ? (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                { backgroundColor: colors.warningLight, borderColor: colors.warning },
              ]}
              onPress={pauseGpsTrip}
              activeOpacity={0.8}
            >
              <Text style={[Typography.button, { color: colors.warning, fontSize: 16 }]}>
                ⏸️ Pause Trip
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                { backgroundColor: colors.primaryLight ?? (colors.primary + '20'), borderColor: colors.primary },
              ]}
              onPress={resumeGpsTrip}
              activeOpacity={0.8}
            >
              <Text style={[Typography.button, { color: colors.primary, fontSize: 16 }]}>
                ▶️ Resume Trip
              </Text>
            </TouchableOpacity>
          )}

          {/* Finish & Save Trip Button */}
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={onFinish}
            activeOpacity={0.85}
          >
            <Text style={[Typography.button, { color: colors.primaryText, fontSize: 16 }]}>
              🏁 End & Save Trip
            </Text>
          </TouchableOpacity>

          {/* Discard Trip */}
          <TouchableOpacity style={styles.discardBtn} onPress={handleCancel} activeOpacity={0.7}>
            <Text style={[Typography.bodySmall, { color: colors.danger, fontWeight: '600' }]}>
              Discard This Trip
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  minimizeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
  },
  topBarRightStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qualityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Sizing.radiusFull,
  },
  offlinePill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Sizing.radiusFull,
  },
  indicatorDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  vehicleHeaderRow: {
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  statusBanner: {
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: Sizing.radiusMd,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  cockpitCenter: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  speedometerCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    borderRadius: Sizing.radiusXl,
    borderWidth: 2,
  },
  speedometerRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedModeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Sizing.radiusFull,
    marginBottom: 6,
  },
  speedHeroNumber: {
    fontSize: 76,
    fontWeight: '900',
    lineHeight: 84,
    letterSpacing: -2,
  },
  speedUnitLabel: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 2,
  },
  telematicsGaugesRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  telematicsGaugeCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Sizing.radiusLg,
    borderWidth: 1,
  },
  gaugeStatNumber: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    marginVertical: 2,
  },
  telemetryFooterInfo: {
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  actionContainer: {
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  actionBtn: {
    height: 54,
    borderRadius: Sizing.radiusLg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
});
