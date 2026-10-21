/**
 * Active Trip Recording HUD Modal
 *
 * Dedicated, distraction-free display for in-progress GPS trip recording.
 *
 * DESIGN:
 * - High contrast, legible from driver's phone mount
 * - Large numbers (32sp+) for distance and elapsed time
 * - Signal quality pill with accuracy indicator
 * - 56dp+ primary touch targets for Pause / Resume / Finish
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
        {/* Top Header */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.minimizeBtn}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={[Typography.button, { color: colors.primary }]}>
              ⬇️ Minimize
            </Text>
          </TouchableOpacity>

          <View style={[styles.qualityPill, { backgroundColor: gpsBadge.bg }]}>
            <View
              style={[styles.indicatorDot, { backgroundColor: gpsBadge.color }]}
            />
            <Text
              style={[
                Typography.caption,
                { color: gpsBadge.color, fontWeight: '700' },
              ]}
            >
              {gpsBadge.label}
            </Text>
          </View>
        </View>

        {/* Vehicle Subtitle */}
        <View style={styles.vehicleRow}>
          <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
            Recording trip for{' '}
            <Text style={{ fontWeight: '700', color: colors.text }}>
              {vehicle.nickname}
            </Text>
          </Text>
        </View>

        {/* Recording Status Banner */}
        {recordingState === 'paused' ? (
          <View style={[styles.banner, { backgroundColor: colors.warningLight }]}>
            <Text
              style={[
                Typography.bodySmall,
                { color: colors.warning, fontWeight: '700' },
              ]}
            >
              ⏸️ Trip is Paused
            </Text>
          </View>
        ) : liveMetrics.hasGaps ? (
          <View style={[styles.banner, { backgroundColor: colors.warningLight }]}>
            <Text
              style={[
                Typography.caption,
                { color: colors.warning, fontWeight: '600' },
              ]}
            >
              ⚠️ Intermittent GPS signal gaps detected
            </Text>
          </View>
        ) : null}

        {/* Big Metrics Display */}
        <View style={styles.metricsContainer}>
          {/* Distance */}
          <View
            style={[
              styles.primaryMetricCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[Typography.caption, { color: colors.textSecondary }]}>
              ESTIMATED GPS DISTANCE
            </Text>
            <Text style={[styles.bigStat, { color: colors.text }]}>
              {liveMetrics.distanceKm.toFixed(2)}
            </Text>
            <Text style={[Typography.h3, { color: colors.primary }]}>
              KILOMETRES
            </Text>
          </View>

          {/* Grid: Time & Speed */}
          <View style={styles.secondaryGrid}>
            <View
              style={[
                styles.secondaryCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text
                style={[Typography.caption, { color: colors.textSecondary }]}
              >
                ELAPSED TIME
              </Text>
              <Text style={[styles.mediumStat, { color: colors.text }]}>
                {formatTime(liveMetrics.elapsedSeconds)}
              </Text>
            </View>

            <View
              style={[
                styles.secondaryCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text
                style={[Typography.caption, { color: colors.textSecondary }]}
              >
                CURRENT SPEED
              </Text>
              <Text style={[styles.mediumStat, { color: colors.text }]}>
                {speedKmh}{' '}
                <Text style={[Typography.caption, { color: colors.textSecondary }]}>
                  km/h
                </Text>
              </Text>
            </View>
          </View>

          <Text
            style={[
              Typography.caption,
              { color: colors.textTertiary, textAlign: 'center', marginTop: Spacing.sm },
            ]}
          >
            Filtered coordinates logged locally · {liveMetrics.samplesCount} valid points
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          {/* Pause / Resume Button */}
          {recordingState === 'recording' ? (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                { backgroundColor: colors.card, borderColor: colors.warning },
              ]}
              onPress={pauseGpsTrip}
            >
              <Text
                style={[
                  Typography.button,
                  { color: colors.warning, fontSize: 18 },
                ]}
              >
                ⏸️ Pause Trip
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                { backgroundColor: colors.primaryLight, borderColor: colors.primary },
              ]}
              onPress={resumeGpsTrip}
            >
              <Text
                style={[
                  Typography.button,
                  { color: colors.primary, fontSize: 18 },
                ]}
              >
                ▶️ Resume Trip
              </Text>
            </TouchableOpacity>
          )}

          {/* Finish Trip Button */}
          <TouchableOpacity
            style={[
              styles.actionBtn,
              { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={onFinish}
          >
            <Text
              style={[
                Typography.button,
                { color: colors.primaryText, fontSize: 18 },
              ]}
            >
              🏁 Finish & Save Trip
            </Text>
          </TouchableOpacity>

          {/* Discard Trip */}
          <TouchableOpacity style={styles.discardBtn} onPress={handleCancel}>
            <Text style={[Typography.bodySmall, { color: colors.danger }]}>
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
  },
  minimizeBtn: {
    paddingVertical: Spacing.xs,
  },
  qualityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Sizing.radiusFull,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  vehicleRow: {
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  banner: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: Sizing.radiusMd,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  metricsContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.md,
  },
  primaryMetricCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    borderRadius: Sizing.radiusXl,
    borderWidth: 1,
    ...Sizing.cardShadow,
  },
  bigStat: {
    fontSize: 54,
    fontWeight: '800',
    lineHeight: 64,
    letterSpacing: -1,
  },
  secondaryGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  secondaryCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: Sizing.radiusLg,
    borderWidth: 1,
    ...Sizing.cardShadow,
  },
  mediumStat: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 32,
    marginTop: Spacing.xs,
  },
  actionContainer: {
    gap: Spacing.md,
    paddingTop: Spacing.md,
  },
  actionBtn: {
    height: 56,
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
