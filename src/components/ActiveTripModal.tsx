/**
 * Active Trip Recording HUD Modal
 *
 * Dedicated, distraction-free digital cockpit display for in-progress GPS trip recording.
 * Styled in the Refined Technical Automotive Cockpit design:
 * - High-contrast automotive instrument cluster aesthetics
 * - Hero digital speedometer dial with 84sp tabular readout & dynamic speed band indicator
 * - 3-gauge telematics cluster (Distance, Duration, Average Pace)
 * - Vehicle context strip with start odometer baseline
 * - Dedicated 100% Offline privacy pill and real-time GPS precision indicator
 * - 54dp tactile driver touch controls with Automotive Orange finish action
 * - Zero map dependencies; 100% offline
 */

import { VehicleType } from "@/constants/fuelTypes";
import { Sizing, Spacing, Typography } from "@/constants/theme";
import * as vehicleRepo from "@/database/repositories/vehicleRepo";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useTripStore } from "@/stores/tripStore";
import type { Vehicle } from "@/types/vehicle";
import { useMemo } from "react";
import {
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

  const targetVehicle = useMemo(() => {
    if (activeTrip && activeTrip.vehicle_id !== vehicle.id) {
      const v = vehicleRepo.getVehicleById(activeTrip.vehicle_id);
      if (v) return v;
    }
    return vehicle;
  }, [activeTrip?.vehicle_id, vehicle]);

  if (!visible || !activeTrip) return null;

  const isTwoWheeler = targetVehicle.vehicle_type === VehicleType.TWO_WHEELER;

  // Format seconds into HH:MM:SS or MM:SS
  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    return hrs > 0
      ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}`
      : `${pad(mins)}:${pad(secs)}`;
  };

  const speedKmh =
    liveMetrics.currentSpeed !== null
      ? Math.max(0, Math.round(liveMetrics.currentSpeed * 3.6))
      : 0;

  const avgSpeedKmh =
    liveMetrics.distanceKm > 0 && liveMetrics.elapsedSeconds > 10
      ? Math.round(liveMetrics.distanceKm / (liveMetrics.elapsedSeconds / 3600))
      : 0;

  const handleCancel = () => {
    Alert.alert(
      "Discard Trip?",
      "Are you sure you want to stop and discard this recorded trip? All recorded location points will be discarded.",
      [
        { text: "Keep Recording", style: "cancel" },
        {
          text: "Discard Trip",
          style: "destructive",
          onPress: async () => {
            await cancelGpsTrip();
            onClose();
          },
        },
      ],
    );
  };

  const getGpsQualityBadge = () => {
    switch (liveMetrics.gpsQuality) {
      case "good":
        return {
          label: "GPS LOCK",
          acc:
            liveMetrics.currentAccuracy !== null
              ? `±${Math.round(liveMetrics.currentAccuracy)}m`
              : "Accurate",
          color: colors.success,
          bg: colors.successLight,
        };
      case "fair":
        return {
          label: "GPS FAIR",
          acc:
            liveMetrics.currentAccuracy !== null
              ? `±${Math.round(liveMetrics.currentAccuracy)}m`
              : "Fair",
          color: colors.warning,
          bg: colors.warningLight,
        };
      case "poor":
        return {
          label: "GPS WEAK",
          acc:
            liveMetrics.currentAccuracy !== null
              ? `±${Math.round(liveMetrics.currentAccuracy)}m`
              : "Weak",
          color: colors.danger,
          bg: colors.dangerLight,
        };
      default:
        return {
          label: "ACQUIRING...",
          acc: "Searching",
          color: colors.textSecondary,
          bg: colors.surfaceSecondary,
        };
    }
  };

  const getSpeedBandBadge = (speed: number) => {
    if (recordingState === "paused") {
      return {
        label: "PAUSED",
        color: colors.warning,
        bg: colors.warningLight,
      };
    }
    if (speed === 0) {
      return {
        label: "IDLE / STOPPED",
        color: colors.textSecondary,
        bg: colors.surfaceSecondary,
      };
    }
    if (speed < 20) {
      return { label: "0–20 KM/H · CRAWL", color: "#F59E0B", bg: "#FEF3C7" };
    }
    if (speed < 30) {
      return {
        label: "20–30 KM/H · CITY TRAFFIC",
        color: "#F59E0B",
        bg: "#FEF3C7",
      };
    }
    if (speed < 50) {
      return {
        label: "30–50 KM/H · CITY FLOW",
        color: colors.primary,
        bg: colors.surfaceSecondary,
      };
    }
    if (speed < 80) {
      return {
        label: "50–80 KM/H · OPTIMAL CRUISE",
        color: colors.success,
        bg: colors.successLight,
      };
    }
    return { label: "80+ KM/H · HIGHWAY", color: "#8B5CF6", bg: "#EDE9FE" };
  };

  const gpsBadge = getGpsQualityBadge();
  const speedBandBadge = getSpeedBandBadge(speedKmh);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top, Spacing.md) + Spacing.xs,
              paddingBottom: Math.max(insets.bottom, Spacing.md) + Spacing.sm,
            },
          ]}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Top Bar: Navigation & Telemetry Health ── */}
          <View style={styles.topBar}>
            <TouchableOpacity
              style={[
                styles.minimizeBtn,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Minimize HUD to Dashboard"
            >
              <Text
                style={[
                  Typography.caption,
                  { color: colors.textSecondary, fontWeight: "700" },
                ]}
              >
                ⤓ DASHBOARD
              </Text>
            </TouchableOpacity>

            <View style={styles.topBarRightStatus}>
              {/* GPS Quality Pill */}
              <View
                style={[
                  styles.qualityPill,
                  {
                    backgroundColor: gpsBadge.bg,
                    borderColor: gpsBadge.color + "30",
                  },
                ]}
              >
                <View
                  style={[
                    styles.indicatorDot,
                    { backgroundColor: gpsBadge.color },
                  ]}
                />
                <Text style={[styles.qualityText, { color: gpsBadge.color }]}>
                  {gpsBadge.label}
                </Text>
                <Text style={[styles.accuracyText, { color: gpsBadge.color }]}>
                  {gpsBadge.acc}
                </Text>
              </View>

              {/* Offline Shield Badge */}
              <View
                style={[
                  styles.offlinePill,
                  {
                    backgroundColor: colors.successLight,
                    borderColor: colors.success + "50",
                  },
                ]}
              >
                <Text style={[styles.offlineText, { color: colors.success }]}>
                  🔒 100% OFFLINE
                </Text>
              </View>
            </View>
          </View>

          {/* ── Vehicle Identity Bar ── */}
          <View
            style={[
              styles.vehicleContextCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderLight,
              },
            ]}
          >
            <View style={styles.vehicleInfoRow}>
              <View
                style={[
                  styles.vehicleIconWrap,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.borderLight,
                  },
                ]}
              >
                <Text style={{ fontSize: 16 }}>
                  {isTwoWheeler ? "🏍️" : "🚗"}
                </Text>
              </View>

              <View style={styles.vehicleTextCol}>
                <View style={styles.vehicleNameRow}>
                  <Text
                    style={[styles.vehicleNameText, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {targetVehicle.nickname}
                  </Text>
                  {targetVehicle.registration_number ? (
                    <View
                      style={[
                        styles.regPill,
                        {
                          backgroundColor: colors.surfaceSecondary,
                          borderColor: colors.borderLight,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.regText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {targetVehicle.registration_number}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text
                  style={[styles.baselineText, { color: colors.textSecondary }]}
                >
                  {activeTrip.start_odometer !== null
                    ? `Baseline: ${activeTrip.start_odometer.toLocaleString("en-IN")} km`
                    : "No start odometer baseline"}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Paused / Gap Warning Banner ── */}
          {recordingState === "paused" ? (
            <View
              style={[
                styles.statusBanner,
                {
                  backgroundColor: colors.warningLight,
                  borderColor: colors.warning,
                },
              ]}
            >
              <Text
                style={[
                  Typography.bodySmall,
                  { color: colors.warning, fontWeight: "800" },
                ]}
              >
                ⏸️ TRIP RECORDING PAUSED
              </Text>
              <Text
                style={[
                  Typography.caption,
                  { color: colors.warning, opacity: 0.9, marginTop: 2 },
                ]}
              >
                GPS tracking and distance accumulation suspended · Tap Resume to
                continue
              </Text>
            </View>
          ) : liveMetrics.hasGaps ? (
            <View
              style={[
                styles.statusBanner,
                {
                  backgroundColor: colors.warningLight,
                  borderColor: colors.warning,
                },
              ]}
            >
              <Text
                style={[
                  Typography.caption,
                  { color: colors.warning, fontWeight: "700" },
                ]}
              >
                ⚠️ Signal loss or coordinate gaps detected · Distance calculated
                with interpolation
              </Text>
            </View>
          ) : null}

          {/* ── Main Cockpit Speedometer Instrument Pod ── */}
          <View style={styles.cockpitCenter}>
            <View
              style={[
                styles.speedometerCard,
                {
                  backgroundColor: colors.surface,
                  borderColor:
                    recordingState === "paused"
                      ? colors.warning + "70"
                      : colors.primary + "50",
                  ...Sizing.cardShadow,
                },
              ]}
            >
              {/* Outer Decorative Ring */}
              <View
                style={[
                  styles.speedometerBezel,
                  {
                    borderColor:
                      recordingState === "paused"
                        ? colors.warning + "30"
                        : colors.primary + "25",
                  },
                ]}
              >
                {/* State Mode Badge */}
                <View
                  style={[
                    styles.speedModeBadge,
                    {
                      backgroundColor:
                        recordingState === "paused"
                          ? colors.warningLight
                          : (colors.primaryLight ?? colors.primary + "20"),
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "800",
                      color:
                        recordingState === "paused"
                          ? colors.warning
                          : colors.primary,
                      letterSpacing: 1.2,
                    }}
                  >
                    {recordingState === "paused"
                      ? "RECORDING PAUSED"
                      : "LIVE TELEMETRY"}
                  </Text>
                </View>

                {/* Hero Digital Speed Display */}
                <Text
                  style={[
                    styles.speedHeroNumber,
                    { color: colors.text, fontVariant: ["tabular-nums"] },
                  ]}
                >
                  {speedKmh}
                </Text>

                <Text
                  style={[styles.speedUnitLabel, { color: colors.primary }]}
                >
                  KM / H
                </Text>

                {/* Dynamic Speed Band Efficiency Indicator */}
                <View
                  style={[
                    styles.speedBandPill,
                    { backgroundColor: speedBandBadge.bg },
                  ]}
                >
                  <Text
                    style={[
                      styles.speedBandText,
                      { color: speedBandBadge.color },
                    ]}
                  >
                    {speedBandBadge.label}
                  </Text>
                </View>
              </View>
            </View>

            {/* ── 3-Gauge Telematics Cluster ── */}
            <View style={styles.telematicsGaugesRow}>
              {/* Distance Gauge */}
              <View
                style={[
                  styles.telematicsGaugeCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderLight,
                    ...Sizing.cardShadow,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.gaugeHeaderLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  DISTANCE
                </Text>
                <Text
                  style={[
                    styles.gaugeStatNumber,
                    { color: colors.text, fontVariant: ["tabular-nums"] },
                  ]}
                >
                  {liveMetrics.distanceKm.toFixed(2)}
                </Text>
                <Text
                  style={[styles.gaugeUnitLabel, { color: colors.primary }]}
                >
                  KM
                </Text>
              </View>

              {/* Elapsed Time Gauge */}
              <View
                style={[
                  styles.telematicsGaugeCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderLight,
                    ...Sizing.cardShadow,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.gaugeHeaderLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  DURATION
                </Text>
                <Text
                  style={[
                    styles.gaugeStatNumber,
                    { color: colors.text, fontVariant: ["tabular-nums"] },
                  ]}
                >
                  {formatTime(liveMetrics.elapsedSeconds)}
                </Text>
                <Text
                  style={[
                    styles.gaugeUnitLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  ELAPSED
                </Text>
              </View>

              {/* Trip Average Speed Gauge */}
              <View
                style={[
                  styles.telematicsGaugeCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderLight,
                    ...Sizing.cardShadow,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.gaugeHeaderLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  AVG PACE
                </Text>
                <Text
                  style={[
                    styles.gaugeStatNumber,
                    { color: colors.text, fontVariant: ["tabular-nums"] },
                  ]}
                >
                  {avgSpeedKmh}
                </Text>
                <Text
                  style={[
                    styles.gaugeUnitLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  KM / H
                </Text>
              </View>
            </View>

            {/* Precision & Waypoints Telemetry Footer */}
            <View style={styles.telemetryFooterInfo}>
              <Text
                style={[
                  Typography.caption,
                  {
                    color: colors.textTertiary,
                    textAlign: "center",
                    fontSize: 11,
                  },
                ]}
              >
                📍 {liveMetrics.samplesCount} Waypoints Recorded · 100%
                On-Device Sensor Telemetry
              </Text>
            </View>
          </View>

          {/* ── Driver Tactile Controls ── */}
          <View style={styles.actionContainer}>
            {/* Pause / Resume Button */}
            {recordingState === "recording" ? (
              <TouchableOpacity
                style={[
                  styles.pauseResumeBtn,
                  {
                    backgroundColor: colors.warningLight,
                    borderColor: colors.warning,
                  },
                ]}
                onPress={pauseGpsTrip}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Pause Trip"
              >
                <Text
                  style={[
                    Typography.button,
                    { color: colors.warning, fontSize: 16 },
                  ]}
                >
                  ⏸️ Pause Trip
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.pauseResumeBtn,
                  {
                    backgroundColor:
                      colors.primaryLight ?? colors.primary + "20",
                    borderColor: colors.primary,
                  },
                ]}
                onPress={resumeGpsTrip}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Resume Trip"
              >
                <Text
                  style={[
                    Typography.button,
                    { color: colors.primary, fontSize: 16 },
                  ]}
                >
                  ▶️ Resume Trip
                </Text>
              </TouchableOpacity>
            )}

            {/* Finish & Review Trip Action — Automotive Blue */}
            <TouchableOpacity
              style={[
                styles.finishBtn,
                {
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                },
              ]}
              onPress={onFinish}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="End and Review Trip"
            >
              <Text
                style={[
                  Typography.button,
                  {
                    color: colors.primaryText,
                    fontSize: 16,
                    fontWeight: "800",
                  },
                ]}
              >
                🏁 End & Review Trip
              </Text>
            </TouchableOpacity>

            {/* Discard Trip */}
            <TouchableOpacity
              style={styles.discardBtn}
              onPress={handleCancel}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Discard This Trip"
            >
              <Text
                style={[
                  Typography.bodySmall,
                  { color: colors.danger, fontWeight: "600" },
                ]}
              >
                Discard Trip
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  minimizeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
  },
  topBarRightStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  qualityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
  },
  indicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  qualityText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  accuracyText: {
    fontSize: 10,
    fontWeight: "700",
  },
  offlinePill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
  },
  offlineText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  vehicleContextCard: {
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
  },
  vehicleInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  vehicleIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleTextCol: {
    flex: 1,
  },
  vehicleNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  vehicleNameText: {
    fontSize: 14,
    fontWeight: "700",
  },
  regPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  regText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  baselineText: {
    fontSize: 11,
    marginTop: 1,
  },
  statusBanner: {
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  cockpitCenter: {
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  speedometerCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: 24,
    borderWidth: 2,
  },
  speedometerBezel: {
    alignItems: "center",
    justifyContent: "center",
    width: "92%",
    paddingVertical: Spacing.md,
    borderRadius: 20,
    borderWidth: 1,
  },
  speedModeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Sizing.radiusFull,
    marginBottom: 4,
  },
  speedHeroNumber: {
    fontSize: 84,
    fontWeight: "900",
    lineHeight: 92,
    letterSpacing: -3,
  },
  speedUnitLabel: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 2.5,
    marginTop: -2,
    marginBottom: 6,
  },
  speedBandPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Sizing.radiusFull,
    marginTop: 2,
  },
  speedBandText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  telematicsGaugesRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  telematicsGaugeCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: Sizing.radiusLg,
    borderWidth: 1,
  },
  gaugeHeaderLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  gaugeStatNumber: {
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
    marginVertical: 2,
  },
  gaugeUnitLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  telemetryFooterInfo: {
    alignItems: "center",
  },
  actionContainer: {
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  pauseResumeBtn: {
    height: 50,
    borderRadius: Sizing.radiusLg,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  finishBtn: {
    height: 54,
    borderRadius: Sizing.radiusLg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    ...Sizing.cardShadow,
  },
  discardBtn: {
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
});
