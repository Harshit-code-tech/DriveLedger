/**
 * Dedicated Trip Detail & Telemetry Modal
 *
 * Provides in-depth inspection of a completed or interrupted trip:
 * - Summary statistics (Distance, Duration, Average speed, Max speed)
 * - GPS Diagnostic breakdowns (accepted/rejected counts, gap frequency, anomaly reasons)
 * - Journey Speed Profile sparkline visualization
 * - Interactive Vertical Journey Timeline with Milestones vs All Points toggle
 * - Tap-to-inspect coordinate telemetry inspector (Lat/Long, Accuracy, Doppler vs Segment speed)
 * - Handles 0 points, 1 point, and long timelines (thousands of points)
 */

import type { FuelType } from "@/constants/fuelTypes";
import { Colors, Sizing, Spacing } from "@/constants/theme";
import * as fuelRepo from "@/database/repositories/fuelRepo";
import * as tripRepo from "@/database/repositories/tripRepo";
import * as vehicleRepo from "@/database/repositories/vehicleRepo";
import { haversineDistance, SIGNAL_GAP_SECONDS } from "@/engine/distanceEngine";
import { computeMileageStats } from "@/engine/mileageEngine";
import { analyzeTripSpeedBands } from "@/engine/speedBandAnalysisEngine";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { Trip, TripDiagnostics, TripLocation } from "@/types/trip";
import type { Vehicle } from "@/types/vehicle";
import { formatDisplayDateLong } from "@/utils/date";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SpeedEfficiencySection } from "./SpeedEfficiencySection";
import { formatTripDuration } from "./TripSummaryCard";

export interface TripDetailModalProps {
  visible: boolean;
  trip: Trip | null;
  vehicle?: Vehicle | null;
  onClose: () => void;
  onDelete?: (tripId: string) => void;
}

export type MilestoneType =
  | "start"
  | "finish"
  | "peak_speed"
  | "km_mark"
  | "signal_gap"
  | "regular";

export interface ProcessedLocationPoint extends TripLocation {
  index: number;
  stepMeters: number;
  cumulativeKm: number;
  timeFormatted: string;
  gpsSpeedKmh: number | null;
  segmentSpeedKmh: number | null;
  isGapBridge: boolean;
  gapDurationSeconds: number;
  milestoneType?: MilestoneType;
  milestoneLabel?: string;
}

export function TripDetailModal({
  visible,
  trip,
  vehicle,
  onClose,
  onDelete,
}: TripDetailModalProps) {
  const colors = useThemeColors();
  const isDark = colors.background === Colors.dark.background;
  const insets = useSafeAreaInsets();

  const [rawLocations, setRawLocations] = useState<TripLocation[]>([]);
  const [isLoadingPoints, setIsLoadingPoints] = useState(false);
  const [timelineMode, setTimelineMode] = useState<"milestones" | "all">(
    "milestones",
  );
  const [expandedPointId, setExpandedPointId] = useState<string | null>(null);
  const [selectedBar, setSelectedBar] = useState<{
    index: number;
    pointIndex: number;
    speed: number;
    approxKm: number;
    timeFormatted: string;
  } | null>(null);

  const isGps = trip?.trip_type === "gps";

  // Load points when a GPS trip modal opens
  useEffect(() => {
    if (visible && trip && trip.trip_type === "gps") {
      setIsLoadingPoints(true);
      try {
        const points = tripRepo.getTripLocations(trip.id);
        setRawLocations(points);
      } catch (err) {
        console.warn("[TripDetailModal] Failed to query trip locations:", err);
        setRawLocations([]);
      } finally {
        setIsLoadingPoints(false);
      }
    } else {
      setRawLocations([]);
    }
  }, [visible, trip?.id, trip?.trip_type]);

  // Parse diagnostics object if present
  const diagnostics: TripDiagnostics | null = useMemo(() => {
    if (!visible || !trip?.diagnostics) return null;
    if (typeof trip.diagnostics === "object")
      return trip.diagnostics as TripDiagnostics;
    try {
      return JSON.parse(trip.diagnostics);
    } catch {
      return null;
    }
  }, [visible, trip?.diagnostics]);

  // Compute processed timeline points with step & cumulative distances
  const processedPoints: ProcessedLocationPoint[] = useMemo(() => {
    if (!rawLocations || rawLocations.length === 0) return [];

    let cumMeters = 0;
    let prevAccepted: TripLocation | null = null;
    let maxSpeedFound = 0;

    return rawLocations.map((loc, idx) => {
      let stepMeters = 0;
      let isGapBridge = false;
      let gapDuration = 0;
      let segmentSpeedKmh: number | null = null;

      if (idx > 0) {
        const prevLoc = rawLocations[idx - 1];
        const timeDeltaSec = (loc.timestamp - prevLoc.timestamp) / 1000;

        if (timeDeltaSec > SIGNAL_GAP_SECONDS) {
          isGapBridge = true;
          gapDuration = Math.round(timeDeltaSec);
        }

        if (loc.is_rejected === 0) {
          const anchor = prevAccepted || prevLoc;
          let isPauseBoundary = false;
          if (
            diagnostics?.pause_intervals &&
            Array.isArray(diagnostics.pause_intervals)
          ) {
            for (const interval of diagnostics.pause_intervals) {
              if (
                anchor.timestamp <= interval.paused_at &&
                loc.timestamp >= interval.resumed_at
              ) {
                isPauseBoundary = true;
                break;
              }
            }
          }

          if (isPauseBoundary) {
            stepMeters = 0;
          } else {
            stepMeters = haversineDistance(
              anchor.latitude,
              anchor.longitude,
              loc.latitude,
              loc.longitude,
            );
          }
          cumMeters += stepMeters;
          prevAccepted = loc;

          if (timeDeltaSec > 0 && stepMeters > 0) {
            segmentSpeedKmh = Math.round((stepMeters / timeDeltaSec) * 3.6);
          }
        }
      } else if (loc.is_rejected === 0) {
        prevAccepted = loc;
      }

      const gpsSpeedKmh =
        loc.speed !== null && loc.speed !== undefined && loc.speed >= 0
          ? Math.round(loc.speed * 3.6)
          : null;

      if (gpsSpeedKmh !== null && gpsSpeedKmh > maxSpeedFound) {
        maxSpeedFound = gpsSpeedKmh;
      }

      const dateObj = new Date(loc.timestamp);
      const timeFormatted = dateObj.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

      return {
        ...loc,
        index: idx + 1,
        stepMeters: Math.round(stepMeters * 10) / 10,
        cumulativeKm: Math.round((cumMeters / 1000) * 100) / 100,
        timeFormatted,
        gpsSpeedKmh,
        segmentSpeedKmh,
        isGapBridge,
        gapDurationSeconds: gapDuration,
      };
    });
  }, [rawLocations, diagnostics?.pause_intervals]);

  // Derived timeline metrics
  const maxGpsSpeedKmh = useMemo(() => {
    let maxS = 0;
    for (const p of processedPoints) {
      if (p.gpsSpeedKmh !== null && p.gpsSpeedKmh > maxS) {
        maxS = p.gpsSpeedKmh;
      }
    }
    return maxS > 0 ? maxS : null;
  }, [processedPoints]);

  // Compute Milestones & Journey Markers
  const pointsWithMilestones = useMemo<ProcessedLocationPoint[]>(() => {
    if (!processedPoints || processedPoints.length === 0) return [];

    let peakSpeed = 0;
    let peakIndex = -1;
    processedPoints.forEach((p, i) => {
      if (p.gpsSpeedKmh !== null && p.gpsSpeedKmh > peakSpeed) {
        peakSpeed = p.gpsSpeedKmh;
        peakIndex = i;
      }
    });

    let lastKmMarker = 0;
    const kmStep =
      trip && trip.distance_km > 25 ? 5 : trip && trip.distance_km > 10 ? 2 : 1;

    return processedPoints.map((p, idx) => {
      let milestoneType: MilestoneType = "regular";
      let milestoneLabel: string | undefined;

      if (idx === 0) {
        milestoneType = "start";
        milestoneLabel = "Trip Start";
      } else if (idx === processedPoints.length - 1) {
        milestoneType = "finish";
        milestoneLabel = `Trip Finished (${p.cumulativeKm.toFixed(2)} km)`;
      } else if (idx === peakIndex && peakSpeed > 25) {
        milestoneType = "peak_speed";
        milestoneLabel = `Peak Speed: ${peakSpeed} km/h`;
      } else if (p.isGapBridge) {
        milestoneType = "signal_gap";
        milestoneLabel = `Signal Reconnected (${p.gapDurationSeconds}s)`;
      } else if (Math.floor(p.cumulativeKm / kmStep) > lastKmMarker) {
        lastKmMarker = Math.floor(p.cumulativeKm / kmStep);
        milestoneType = "km_mark";
        milestoneLabel = `${(lastKmMarker * kmStep).toFixed(0)} km Milestone`;
      }

      return {
        ...p,
        milestoneType,
        milestoneLabel,
      };
    });
  }, [processedPoints, trip?.distance_km]);

  // Filter points depending on Milestones vs All mode
  const displayedPoints = useMemo(() => {
    if (timelineMode === "all" || pointsWithMilestones.length <= 15) {
      return pointsWithMilestones;
    }
    return pointsWithMilestones.filter((p) => p.milestoneType !== "regular");
  }, [timelineMode, pointsWithMilestones]);

  const milestonesCount = useMemo(() => {
    return pointsWithMilestones.filter((p) => p.milestoneType !== "regular")
      .length;
  }, [pointsWithMilestones]);

  const avgSpeedKmh = useMemo(() => {
    if (!trip || trip.duration_seconds <= 0 || trip.distance_km <= 0)
      return null;
    return (
      Math.round((trip.distance_km / (trip.duration_seconds / 3600)) * 10) / 10
    );
  }, [trip?.duration_seconds, trip?.distance_km]);

  const avgSpeedPct = useMemo(() => {
    if (!avgSpeedKmh || !maxGpsSpeedKmh || maxGpsSpeedKmh <= 0) return null;
    const maxSpeed = Math.max(maxGpsSpeedKmh, 10);
    return Math.min(92, Math.max(8, (avgSpeedKmh / maxSpeed) * 100));
  }, [avgSpeedKmh, maxGpsSpeedKmh]);

  // Speed Profile Sparkline Samples (up to 48 slices across journey)
  const speedSparkline = useMemo(() => {
    if (processedPoints.length < 5) return [];
    const sampleCount = Math.min(48, processedPoints.length);
    const step = processedPoints.length / sampleCount;
    const samples: {
      id: string;
      speed: number;
      pct: number;
      approxKm: number;
      pointIndex: number;
      timeFormatted: string;
      isPeak: boolean;
    }[] = [];
    const maxSpeed = Math.max(maxGpsSpeedKmh || 1, 10);

    let peakIdx = -1;
    let highestSpeed = 0;

    for (let i = 0; i < sampleCount; i++) {
      const idx = Math.min(Math.floor(i * step), processedPoints.length - 1);
      const pt = processedPoints[idx];
      const spd = pt.gpsSpeedKmh || pt.segmentSpeedKmh || 0;
      if (spd > highestSpeed) {
        highestSpeed = spd;
        peakIdx = i;
      }
      samples.push({
        id: `spark-${i}`,
        speed: spd,
        pct: Math.min(100, Math.max(8, (spd / maxSpeed) * 100)),
        approxKm: pt.cumulativeKm,
        pointIndex: pt.index,
        timeFormatted: pt.timeFormatted,
        isPeak: false,
      });
    }

    if (peakIdx >= 0 && highestSpeed > 15) {
      samples[peakIdx].isPeak = true;
    }

    return samples;
  }, [processedPoints, maxGpsSpeedKmh]);

  // Authoritative vehicle running average mileage
  const vehicleAverageMileage = useMemo(() => {
    if (!visible || !trip?.vehicle_id) return null;
    try {
      const entries = fuelRepo.getFuelEntriesByVehicle(trip.vehicle_id);
      const targetVeh =
        vehicle?.id === trip.vehicle_id
          ? vehicle
          : vehicleRepo.getVehicleById(trip.vehicle_id);
      const stats = computeMileageStats(
        entries,
        targetVeh?.fuel_type as FuelType,
      );
      return stats.runningAverage;
    } catch {
      return null;
    }
  }, [visible, trip?.vehicle_id, vehicle]);

  // Speed & Efficiency Analysis for completed GPS trips
  const speedAnalysis = useMemo(() => {
    if (
      !visible ||
      !isGps ||
      !trip ||
      trip.status !== "completed" ||
      rawLocations.length === 0
    ) {
      return null;
    }
    const targetVeh =
      vehicle?.id === trip.vehicle_id
        ? vehicle
        : vehicleRepo.getVehicleById(trip.vehicle_id);

    return analyzeTripSpeedBands(rawLocations, {
      pauseIntervals: diagnostics?.pause_intervals,
      totalTripDistanceKm: trip.distance_km,
      totalTripDurationSeconds: trip.duration_seconds,
      baselineMileage: vehicleAverageMileage?.value,
      fuelType: targetVeh?.fuel_type,
    });
  }, [
    visible,
    isGps,
    trip,
    rawLocations,
    diagnostics?.pause_intervals,
    vehicleAverageMileage,
    vehicle,
  ]);

  if (!visible || !trip) return null;

  const durationStr = formatTripDuration(trip.duration_seconds);

  const handleDelete = () => {
    Alert.alert(
      "Delete Trip Record? 🚗",
      `Delete this ${isGps ? "GPS telemetry" : "manual"} trip from ${formatDisplayDateLong(
        trip.start_time.split("T")[0],
      )} (${trip.distance_km.toFixed(2)} km)?\n\nDeleting this trip will not roll back your vehicle odometer.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Trip",
          style: "destructive",
          onPress: () => {
            onDelete?.(trip.id);
            onClose();
          },
        },
      ],
    );
  };

  // Speed color helper
  const getSpeedColor = (speed: number | null) => {
    if (speed === null || speed <= 0) return colors.textTertiary;
    if (speed <= 25) return colors.primary; // City speed
    if (speed <= 65) return colors.primaryDark; // Moderate cruise
    return colors.accent; // Highway pace
  };

  // Node icon helper
  const renderNodeIcon = (type?: MilestoneType, isRejected?: boolean) => {
    if (isRejected) return <Text style={styles.nodeText}>✖</Text>;
    switch (type) {
      case "start":
        return <Text style={styles.nodeText}>🟢</Text>;
      case "finish":
        return <Text style={styles.nodeText}>🏁</Text>;
      case "peak_speed":
        return <Text style={styles.nodeText}>⚡</Text>;
      case "km_mark":
        return <Text style={styles.nodeText}>📍</Text>;
      case "signal_gap":
        return <Text style={styles.nodeText}>⚠️</Text>;
      default:
        return (
          <View
            style={[styles.regularDot, { backgroundColor: colors.accent }]}
          />
        );
    }
  };

  // ── Header Component for the Virtualized FlatList ─────────────────
  const renderListHeader = () => (
    <View style={styles.headerContainer}>
      {/* ── Status & Date Banner ── */}
      <View
        style={[
          styles.tripTypeBanner,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.bannerLeft}>
          <Text style={{ fontSize: 20 }}>{isGps ? "🛰️" : "✍️"}</Text>
          <View>
            <Text style={[styles.bannerTitle, { color: colors.text }]}>
              {isGps ? "GPS Telemetry Recording" : "Manual Odometer Entry"}
            </Text>
            <Text
              style={[styles.bannerSubtitle, { color: colors.textSecondary }]}
            >
              {formatDisplayDateLong(trip.start_time.split("T")[0])}
              {vehicle?.nickname ? ` · ${vehicle.nickname}` : ""}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                trip.status === "completed"
                  ? colors.statusNormalBg
                  : colors.statusWarningBg,
            },
          ]}
        >
          <Text
            style={[
              styles.statusBadgeText,
              {
                color:
                  trip.status === "completed"
                    ? colors.statusNormal
                    : colors.statusWarning,
              },
            ]}
          >
            {trip.status.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* ── Warning Banner if Any ── */}
      {trip.quality_warning ? (
        <View
          style={[
            styles.warningCard,
            {
              backgroundColor: colors.statusWarningBg,
              borderColor: colors.statusWarning,
            },
          ]}
        >
          <Text style={[styles.warningTitle, { color: colors.statusWarning }]}>
            ⚠️ Data Quality Notice
          </Text>
          <Text style={[styles.warningBody, { color: colors.text }]}>
            {trip.quality_warning}
          </Text>
        </View>
      ) : null}

      {/* ── Hero Distance & Duration Card ── */}
      <View style={styles.kpiRow}>
        <View
          style={[
            styles.kpiCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>
            TOTAL DISTANCE
          </Text>
          <Text style={[styles.kpiValue, { color: colors.primaryDark }]}>
            {trip.distance_km.toFixed(2)}
          </Text>
          <Text style={[styles.kpiUnit, { color: colors.textSecondary }]}>
            kilometers
          </Text>
        </View>

        <View
          style={[
            styles.kpiCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>
            RECORDED DURATION
          </Text>
          <Text style={[styles.kpiValue, { color: colors.text }]}>
            {durationStr || "—"}
          </Text>
          <Text style={[styles.kpiUnit, { color: colors.textSecondary }]}>
            {durationStr ? "active travel time" : "not timed"}
          </Text>
        </View>
      </View>

      {/* ── Speed & Odometer Telematics Grid ── */}
      <View style={styles.metricsGrid}>
        {avgSpeedKmh !== null && (
          <View
            style={[
              styles.gridCell,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.cellLabel, { color: colors.textSecondary }]}>
              AVG SPEED
            </Text>
            <Text style={[styles.cellValue, { color: colors.text }]}>
              {avgSpeedKmh} <Text style={styles.cellUnit}>km/h</Text>
            </Text>
          </View>
        )}

        {maxGpsSpeedKmh !== null && (
          <View
            style={[
              styles.gridCell,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.cellLabel, { color: colors.textSecondary }]}>
              MAX SPEED
            </Text>
            <Text style={[styles.cellValue, { color: colors.accent }]}>
              {maxGpsSpeedKmh} <Text style={styles.cellUnit}>km/h</Text>
            </Text>
          </View>
        )}

        {trip.start_odometer !== null && (
          <View
            style={[
              styles.gridCell,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.cellLabel, { color: colors.textSecondary }]}>
              START ODO
            </Text>
            <Text style={[styles.cellValue, { color: colors.text }]}>
              {trip.start_odometer.toLocaleString("en-IN")}{" "}
              <Text style={styles.cellUnit}>km</Text>
            </Text>
          </View>
        )}

        {trip.end_odometer !== null && (
          <View
            style={[
              styles.gridCell,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.cellLabel, { color: colors.textSecondary }]}>
              END ODO
            </Text>
            <Text style={[styles.cellValue, { color: colors.text }]}>
              {trip.end_odometer.toLocaleString("en-IN")}{" "}
              <Text style={styles.cellUnit}>km</Text>
            </Text>
          </View>
        )}
      </View>

      {/* ── Purpose and Notes ── */}
      {(trip.purpose || trip.notes) && (
        <View
          style={[
            styles.infoCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {trip.purpose ? (
            <View style={{ marginBottom: trip.notes ? Spacing.xs : 0 }}>
              <Text style={[styles.cellLabel, { color: colors.textSecondary }]}>
                TRIP PURPOSE
              </Text>
              <Text style={[styles.infoText, { color: colors.text }]}>
                🏷️ {trip.purpose}
              </Text>
            </View>
          ) : null}
          {trip.notes ? (
            <View style={{ marginTop: trip.purpose ? Spacing.xs : 0 }}>
              <Text style={[styles.cellLabel, { color: colors.textSecondary }]}>
                NOTES
              </Text>
              <Text style={[styles.notesText, { color: colors.textSecondary }]}>
                "{trip.notes}"
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {/* ── Diagnostics Summary (GPS Trips Only) ── */}
      {isGps && diagnostics && (
        <View
          style={[
            styles.diagnosticsCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.diagHeader}>
            <Text style={[styles.diagTitle, { color: colors.text }]}>
              🛰️ GNSS Sensor & Signal Diagnostics
            </Text>
            <View
              style={[
                styles.diagBadge,
                { backgroundColor: colors.surfaceSecondary },
              ]}
            >
              <Text style={[styles.diagBadgeText, { color: colors.primary }]}>
                OFFLINE GNSS
              </Text>
            </View>
          </View>

          {(() => {
            const accepted = diagnostics.accepted_samples_count || 0;
            const filtered = diagnostics.rejected_samples_count || 0;
            const total = Math.max(
              diagnostics.total_samples_received || 0,
              accepted + filtered,
            );
            const acceptedPct =
              total > 0 ? Math.round((accepted / total) * 100) : 100;
            return (
              <View style={styles.diagRowsWrap}>
                <View style={styles.diagRow}>
                  <Text
                    style={[styles.diagLabel, { color: colors.textSecondary }]}
                  >
                    Satellite GPS Readings:
                  </Text>
                  <Text style={[styles.diagValue, { color: colors.text }]}>
                    {total} received
                  </Text>
                </View>
                <View style={styles.diagRow}>
                  <Text
                    style={[styles.diagLabel, { color: colors.textSecondary }]}
                  >
                    Signal Quality:
                  </Text>
                  <Text style={[styles.diagValue, { color: colors.text }]}>
                    {accepted} accepted ({acceptedPct}%) · {filtered} filtered
                  </Text>
                </View>
              </View>
            );
          })()}

          {diagnostics.gap_count > 0 && (
            <View style={[styles.diagRow, { marginTop: 4 }]}>
              <Text style={[styles.diagLabel, { color: colors.statusWarning }]}>
                Signal Gaps (&gt;120s):
              </Text>
              <Text style={[styles.diagValue, { color: colors.statusWarning }]}>
                {diagnostics.gap_count} gap
                {diagnostics.gap_count > 1 ? "s" : ""} (max{" "}
                {diagnostics.max_gap_seconds}s)
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Speed & Efficiency Analysis (Completed GPS Trips Only) ── */}
      {isGps && trip.status === "completed" && speedAnalysis && (
        <SpeedEfficiencySection
          analysis={speedAnalysis}
          vehicleAverageMileage={vehicleAverageMileage}
          vehicleFuelType={vehicle?.fuel_type}
        />
      )}

      {/* ── GPS Timeline Section Title, Sparkline & Controls ── */}
      {isGps && (
        <View style={{ marginTop: Spacing.lg }}>
          {/* Section Heading with Points Count */}
          <View style={styles.timelineSectionHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                JOURNEY TIMELINE
              </Text>
              <Text
                style={[
                  styles.sectionSubtitle,
                  { color: colors.textSecondary },
                ]}
              >
                {processedPoints.length} GPS route waypoints recorded
              </Text>
            </View>
            <View
              style={[
                styles.pointsCountBadge,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.borderLight,
                },
              ]}
            >
              <Text
                style={[styles.pointsCountText, { color: colors.primaryDark }]}
              >
                {timelineMode === "milestones"
                  ? `${milestonesCount} Milestones`
                  : `${processedPoints.length} Waypoints`}
              </Text>
            </View>
          </View>

          {/* View Mode Switcher: Dedicated Full-Width Row */}
          {pointsWithMilestones.length > 15 && (
            <View
              style={[
                styles.modeSwitcherContainer,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border,
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.modeBtn,
                  timelineMode === "milestones" && [
                    styles.modeBtnActive,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ],
                ]}
                onPress={() => setTimelineMode("milestones")}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.modeBtnText,
                    {
                      color:
                        timelineMode === "milestones"
                          ? colors.primaryDark
                          : colors.textSecondary,
                      fontWeight: timelineMode === "milestones" ? "700" : "500",
                    },
                  ]}
                >
                  🎯 Key Milestones ({milestonesCount})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeBtn,
                  timelineMode === "all" && [
                    styles.modeBtnActive,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ],
                ]}
                onPress={() => setTimelineMode("all")}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.modeBtnText,
                    {
                      color:
                        timelineMode === "all"
                          ? colors.primaryDark
                          : colors.textSecondary,
                      fontWeight: timelineMode === "all" ? "700" : "500",
                    },
                  ]}
                >
                  📋 All Points ({processedPoints.length})
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Journey Speed Sparkline / Profile Card ── */}
          {speedSparkline.length > 5 && (
            <View
              style={[
                styles.sparklineCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {/* Header: Title and Telemetry Stats */}
              <View style={styles.sparklineHeader}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Text
                    style={[
                      styles.sparklineLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    SPEED TELEMETRY PROFILE
                  </Text>
                </View>

                <View style={styles.sparkStatChips}>
                  {avgSpeedKmh !== null && (
                    <View
                      style={[
                        styles.statChip,
                        { backgroundColor: colors.surfaceSecondary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statChipLabel,
                          { color: colors.textSecondary },
                        ]}
                      >
                        AVG
                      </Text>
                      <Text
                        style={[
                          styles.statChipValue,
                          { color: colors.primaryDark },
                        ]}
                      >
                        {avgSpeedKmh} km/h
                      </Text>
                    </View>
                  )}
                  {maxGpsSpeedKmh !== null && (
                    <View
                      style={[
                        styles.statChip,
                        { backgroundColor: "#EA580C15" },
                      ]}
                    >
                      <Text
                        style={[styles.statChipLabel, { color: colors.accent }]}
                      >
                        PEAK
                      </Text>
                      <Text
                        style={[styles.statChipValue, { color: colors.accent }]}
                      >
                        {maxGpsSpeedKmh} km/h
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Interactive Telemetry Inspection Bubble if a bar is selected */}
              {selectedBar && (
                <TouchableOpacity
                  style={[
                    styles.selectedBarBanner,
                    {
                      backgroundColor: isDark ? "#EAB30818" : "#FEF9C3",
                      borderColor: "#EAB308",
                    },
                  ]}
                  onPress={() => setSelectedBar(null)}
                  activeOpacity={0.8}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      flex: 1,
                      overflow: "hidden",
                    }}
                  >
                    <Text style={{ fontSize: 12 }}>🟡</Text>
                    <Text
                      style={[
                        styles.selectedBarText,
                        { color: isDark ? "#FEF08A" : "#854D0E", flex: 1 },
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      Waypoint #{selectedBar.pointIndex} ·{" "}
                      <Text
                        style={{
                          color: isDark ? "#FACC15" : "#A16207",
                          fontWeight: "800",
                        }}
                      >
                        {selectedBar.speed} km/h
                      </Text>{" "}
                      · {selectedBar.approxKm.toFixed(1)} km ·{" "}
                      {selectedBar.timeFormatted}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.selectedBarClose,
                      { color: isDark ? "#FEF08A" : "#854D0E" },
                    ]}
                  >
                    ✕
                  </Text>
                </TouchableOpacity>
              )}

              {/* Chart Visual Canvas with Grid Lines */}
              <View style={styles.chartCanvas}>
                {/* Horizontal Reference Lines */}
                <View
                  style={[
                    styles.gridLine,
                    { top: 0, borderColor: colors.borderLight },
                  ]}
                />
                {avgSpeedPct !== null && (
                  <View
                    style={[
                      styles.avgGridLine,
                      {
                        bottom: `${avgSpeedPct}%`,
                        borderColor: colors.primary,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.avgLineBadge, { color: colors.primary }]}
                    >
                      avg {Math.round(avgSpeedKmh!)}
                    </Text>
                  </View>
                )}
                <View
                  style={[
                    styles.gridLine,
                    { bottom: 0, borderColor: colors.borderLight },
                  ]}
                />

                {/* Vertical Speed Bars */}
                <View style={styles.sparklineBarsRow}>
                  {speedSparkline.map((item, idx) => {
                    const isSelected =
                      selectedBar?.pointIndex === item.pointIndex;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.sparkBarWrap}
                        onPress={() =>
                          setSelectedBar(
                            isSelected
                              ? null
                              : {
                                  index: idx,
                                  pointIndex: item.pointIndex,
                                  speed: item.speed,
                                  approxKm: item.approxKm,
                                  timeFormatted: item.timeFormatted,
                                },
                          )
                        }
                        activeOpacity={0.7}
                      >
                        {isSelected ? (
                          <View style={styles.selectedIndicatorPin}>
                            <Text style={styles.selectedPinIcon}>▼</Text>
                          </View>
                        ) : item.isPeak ? (
                          <View style={styles.peakIndicatorDot} />
                        ) : null}
                        <View
                          style={[
                            styles.sparkBar,
                            {
                              height: `${item.pct}%`,
                              backgroundColor: isSelected
                                ? "#EAB308"
                                : getSpeedColor(item.speed),
                              borderWidth: isSelected ? 1.5 : 0,
                              borderColor: isSelected
                                ? "#FEF08A"
                                : "transparent",
                              zIndex: isSelected ? 10 : 1,
                            },
                          ]}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Speed Zone Legend & Journey Axis */}
              <View style={styles.sparklineFooter}>
                <View style={styles.speedLegendRow}>
                  <View style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: colors.primary },
                      ]}
                    />
                    <Text
                      style={[
                        styles.legendText,
                        { color: colors.textTertiary },
                      ]}
                    >
                      &lt;25 City
                    </Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: colors.primaryDark },
                      ]}
                    />
                    <Text
                      style={[
                        styles.legendText,
                        { color: colors.textTertiary },
                      ]}
                    >
                      25-65 Cruise
                    </Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: colors.accent },
                      ]}
                    />
                    <Text
                      style={[
                        styles.legendText,
                        { color: colors.textTertiary },
                      ]}
                    >
                      &gt;65 Express
                    </Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View
                      style={[styles.legendDot, { backgroundColor: "#EAB308" }]}
                    />
                    <Text
                      style={[
                        styles.legendText,
                        { color: "#EAB308", fontWeight: "700" },
                      ]}
                    >
                      Selected
                    </Text>
                  </View>
                </View>

                <View style={styles.journeyAxisRow}>
                  <Text
                    style={[
                      styles.sparkFooterText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    0 km
                  </Text>
                  <Text
                    style={[
                      styles.sparkFooterText,
                      { color: colors.textTertiary },
                    ]}
                  >
                    Progress ➔
                  </Text>
                  <Text
                    style={[
                      styles.sparkFooterText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {trip.distance_km.toFixed(1)} km
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Timeline Table Hint */}
          <View style={styles.timelineHintRow}>
            <Text
              style={[styles.timelineHintText, { color: colors.textTertiary }]}
            >
              💡 Tap any waypoint card to inspect GNSS accuracy & exact lat/long
              coordinates
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  // ── Render Timeline Waypoint Node ─────────────────────────────────
  const renderPointItem = ({
    item,
    index,
  }: {
    item: ProcessedLocationPoint;
    index: number;
  }) => {
    const isRejected = item.is_rejected === 1;
    const isExpanded = expandedPointId === item.id;
    const isSelected = selectedBar?.pointIndex === item.index;
    const isLast = index === displayedPoints.length - 1;

    return (
      <View style={styles.waypointRowContainer}>
        {/* Signal Gap Bridging Divider */}
        {item.isGapBridge && (
          <View
            style={[
              styles.gapBridge,
              {
                backgroundColor: colors.statusWarningBg,
                borderColor: colors.statusWarning,
              },
            ]}
          >
            <Text
              style={[styles.gapBridgeText, { color: colors.statusWarning }]}
            >
              ⚠️ Signal Gap: {item.gapDurationSeconds}s elapsed without GPS signal
              (gap bridged via Haversine)
            </Text>
          </View>
        )}

        <View style={styles.trackRow}>
          {/* Vertical Connecting Track Line */}
          <View style={styles.trackColumn}>
            <View
              style={[
                styles.nodeCircle,
                {
                  backgroundColor: isSelected
                    ? isDark
                      ? "#EAB30830"
                      : "#FEF08A"
                    : item.milestoneType === "start"
                      ? "#10B98120"
                      : item.milestoneType === "finish"
                        ? "#EA580C20"
                        : item.milestoneType === "peak_speed"
                          ? "#F59E0B20"
                          : colors.surfaceSecondary,
                  borderColor: isSelected
                    ? "#EAB308"
                    : item.milestoneType === "start"
                      ? "#10B981"
                      : item.milestoneType === "finish"
                        ? "#EA580C"
                        : item.milestoneType === "peak_speed"
                          ? "#F59E0B"
                          : colors.border,
                  borderWidth: isSelected ? 2 : 1.5,
                },
              ]}
            >
              {isSelected ? (
                <Text style={{ fontSize: 10 }}>🟡</Text>
              ) : (
                renderNodeIcon(item.milestoneType, isRejected)
              )}
            </View>
            {!isLast && (
              <View
                style={[
                  styles.verticalLine,
                  { backgroundColor: colors.borderLight },
                ]}
              />
            )}
          </View>

          {/* Waypoint Interactive Content Card */}
          <TouchableOpacity
            style={[
              styles.waypointCard,
              {
                backgroundColor: isSelected
                  ? isDark
                    ? "#EAB30818"
                    : "#FEF9C350"
                  : isExpanded
                    ? colors.surfaceSecondary
                    : colors.surface,
                borderColor: isSelected
                  ? "#EAB308"
                  : isExpanded
                    ? colors.primary
                    : colors.border,
                borderWidth: isSelected ? 1.5 : 1,
                opacity: isRejected ? 0.6 : 1,
              },
            ]}
            onPress={() => setExpandedPointId(isExpanded ? null : item.id)}
            activeOpacity={0.7}
          >
            {/* If selected on graph, show dedicated clean banner at the top of the card */}
            {isSelected && (
              <View
                style={[
                  styles.selectedBannerStrip,
                  { backgroundColor: isDark ? "#EAB30825" : "#FEF08A" },
                ]}
              >
                <Text
                  style={[
                    styles.selectedBannerText,
                    { color: isDark ? "#FDE047" : "#854D0E" },
                  ]}
                >
                  🟡 SELECTED WAYPOINT #{item.index}
                </Text>
              </View>
            )}

            {/* Top Row: Milestone/Waypoint Label on Left, Speed Pill on Right */}
            <View style={styles.cardHeaderRow}>
              <View style={{ flex: 1, marginRight: Spacing.xs }}>
                {item.milestoneLabel ? (
                  <View
                    style={[
                      styles.milestonePill,
                      {
                        backgroundColor:
                          item.milestoneType === "start"
                            ? colors.statusNormalBg
                            : item.milestoneType === "finish"
                              ? "#EA580C18"
                              : item.milestoneType === "peak_speed"
                                ? "#FEF3C7"
                                : colors.surfaceSecondary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.milestonePillText,
                        {
                          color:
                            item.milestoneType === "start"
                              ? colors.statusNormal
                              : item.milestoneType === "finish"
                                ? "#EA580C"
                                : item.milestoneType === "peak_speed"
                                  ? "#B45309"
                                  : colors.text,
                        },
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {item.milestoneLabel}
                    </Text>
                  </View>
                ) : (
                  <View
                    style={[
                      styles.fixTagPill,
                      { backgroundColor: colors.surfaceSecondary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.fixTagText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      Waypoint #{item.index}
                    </Text>
                  </View>
                )}
              </View>

              {/* Speed Pill on Right */}
              <View
                style={[
                  styles.speedBadge,
                  {
                    backgroundColor: isSelected
                      ? isDark
                        ? "#EAB30830"
                        : "#FEF08A"
                      : item.gpsSpeedKmh && item.gpsSpeedKmh > 65
                        ? "#EA580C18"
                        : colors.surfaceSecondary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.speedBadgeText,
                    {
                      color: isSelected
                        ? isDark
                          ? "#FDE047"
                          : "#854D0E"
                        : getSpeedColor(item.gpsSpeedKmh),
                    },
                  ]}
                >
                  {item.gpsSpeedKmh !== null && item.gpsSpeedKmh > 0
                    ? `${item.gpsSpeedKmh} km/h`
                    : item.gpsSpeedKmh === 0
                      ? "0 km/h"
                      : "—"}
                </Text>
              </View>
            </View>

            {/* Bottom Row: Time & Step Subtext on Left, Cumulative Distance on Right */}
            <View style={styles.cardFooterRow}>
              <View style={styles.cardTelemetryWrap}>
                <Text style={[styles.pointTime, { color: colors.text }]}>
                  {item.timeFormatted}
                </Text>
                <Text
                  style={[styles.stepSubtext, { color: colors.textTertiary }]}
                >
                  {item.index === 1
                    ? "· Origin"
                    : `· +${Math.round(item.stepMeters)}m`}
                  {item.accuracy ? ` · ±${Math.round(item.accuracy)}m` : ""}
                </Text>
              </View>

              <Text style={[styles.cumDistanceText, { color: colors.text }]}>
                {item.cumulativeKm.toFixed(2)} km
              </Text>
            </View>

            {/* ── Expanded Technical Inspector ── */}
            {isExpanded && (
              <View
                style={[
                  styles.inspectorBox,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderLight,
                  },
                ]}
              >
                <View style={styles.inspectorHeaderRow}>
                  <Text
                    style={[styles.inspectorTitle, { color: colors.primaryDark }]}
                  >
                    🛰️ Waypoint Telemetry Diagnostics
                  </Text>
                  <Text style={[styles.inspectorFixIndex, { color: colors.textTertiary }]}>
                    Waypoint #{item.index}
                  </Text>
                </View>

                {/* ── GNSS Core Sensor Metrics ── */}
                <View style={styles.inspectorGrid}>
                  <View style={styles.inspectorItem}>
                    <Text
                      style={[
                        styles.inspectorLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      COORDINATES
                    </Text>
                    <Text
                      style={[styles.inspectorValue, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {item.latitude.toFixed(6)}°, {item.longitude.toFixed(6)}°
                    </Text>
                  </View>

                  <View style={styles.inspectorItem}>
                    <Text
                      style={[
                        styles.inspectorLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      ACCURACY
                    </Text>
                    <Text
                      style={[styles.inspectorValue, { color: colors.text }]}
                    >
                      {item.accuracy
                        ? `±${Math.round(item.accuracy * 10) / 10} meters`
                        : "Unknown"}
                    </Text>
                  </View>

                  {item.altitude !== null && (
                    <View style={styles.inspectorItem}>
                      <Text
                        style={[
                          styles.inspectorLabel,
                          { color: colors.textSecondary },
                        ]}
                      >
                        ALTITUDE
                      </Text>
                      <Text
                        style={[styles.inspectorValue, { color: colors.text }]}
                      >
                        {Math.round(item.altitude)} m MSL
                      </Text>
                    </View>
                  )}
                </View>

                {/* ── Dedicated Speed Comparison Cards (Doppler vs Segment) ── */}
                <View style={styles.speedComparisonSection}>
                  <Text style={[styles.speedComparisonHeading, { color: colors.textSecondary }]}>
                    SPEED CALCULATION COMPARISON
                  </Text>

                  <View style={styles.speedComparisonCardsRow}>
                    {/* Doppler / GNSS Sensor Card */}
                    <View
                      style={[
                        styles.speedComparisonCard,
                        {
                          backgroundColor: colors.surfaceSecondary,
                          borderColor: colors.borderLight,
                        },
                      ]}
                    >
                      <View style={styles.compareTitleRow}>
                        <Text style={[styles.compareBadge, { color: colors.primary }]}>
                          DOPPLER SENSOR
                        </Text>
                      </View>
                      <Text style={[styles.compareSpeedNumber, { color: colors.primaryDark }]}>
                        {item.gpsSpeedKmh !== null ? `${item.gpsSpeedKmh}` : "—"}
                        <Text style={styles.compareSpeedUnit}> km/h</Text>
                      </Text>
                      <Text style={[styles.compareExplainer, { color: colors.textTertiary }]}>
                        Instantaneous radio velocity from GPS satellites
                      </Text>
                    </View>

                    {/* Segment / Step Average Card */}
                    <View
                      style={[
                        styles.speedComparisonCard,
                        {
                          backgroundColor: colors.surfaceSecondary,
                          borderColor: colors.borderLight,
                        },
                      ]}
                    >
                      <View style={styles.compareTitleRow}>
                        <Text style={[styles.compareBadge, { color: colors.textSecondary }]}>
                          SEGMENT AVERAGE
                        </Text>
                      </View>
                      <Text style={[styles.compareSpeedNumber, { color: colors.text }]}>
                        {item.segmentSpeedKmh !== null ? `${item.segmentSpeedKmh}` : "—"}
                        <Text style={styles.compareSpeedUnit}> km/h</Text>
                      </Text>
                      <Text style={[styles.compareExplainer, { color: colors.textTertiary }]}>
                        Calculated step: distance ÷ time between waypoints
                      </Text>
                    </View>
                  </View>
                </View>

                {isRejected && (
                  <View
                    style={[
                      styles.rejectionBanner,
                      { backgroundColor: colors.statusCriticalBg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.rejectionText,
                        { color: colors.statusCritical },
                      ]}
                    >
                      ⚠️ Filtered Point:{" "}
                      {item.rejection_reason || "Out of accuracy bounds"}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            paddingTop: Math.max(insets.top, Spacing.sm) + Spacing.sm,
            paddingBottom: insets.bottom || Spacing.md,
          },
        ]}
      >
        {/* ── Top Bar ── */}
        <View
          style={[styles.topBar, { borderBottomColor: colors.borderLight }]}
        >
          <TouchableOpacity
            onPress={onClose}
            style={[
              styles.closeBtn,
              { backgroundColor: colors.surfaceSecondary },
            ]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close trip details"
          >
            <Text
              style={[styles.closeBtnText, { color: colors.textSecondary }]}
            >
              ✕
            </Text>
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text style={[styles.screenTitle, { color: colors.text }]}>
              Trip Telemetry
            </Text>
            <Text
              style={[styles.screenSubtitle, { color: colors.textSecondary }]}
            >
              {formatDisplayDateLong(trip.start_time.split("T")[0])}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleDelete}
            style={[
              styles.deleteBtn,
              { backgroundColor: colors.statusCriticalBg },
            ]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Delete trip"
          >
            <Text
              style={[styles.deleteBtnText, { color: colors.statusCritical }]}
            >
              🗑️ Delete
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Body: Virtualized Timeline (GPS) or Scrollable Info (Manual) ── */}
        {isLoadingPoints ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading telemetry points...
            </Text>
          </View>
        ) : isGps ? (
          <FlatList
            data={displayedPoints}
            keyExtractor={(item) => item.id}
            renderItem={renderPointItem}
            ListHeaderComponent={renderListHeader}
            ListEmptyComponent={
              <View style={styles.emptyTimelineContainer}>
                <Text style={styles.emptyIcon}>📍</Text>
                <Text
                  style={[
                    styles.emptyTimelineText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {rawLocations.length === 0
                    ? diagnostics &&
                      diagnostics.rejected_samples_count > 0 &&
                      diagnostics.accepted_samples_count === 0
                      ? `${Math.max(
                          diagnostics.total_samples_received || 0,
                          diagnostics.rejected_samples_count,
                        )} GPS signal readings received, but all were filtered due to ${
                          diagnostics.rejection_counts?.poor_accuracy &&
                          diagnostics.rejection_counts.poor_accuracy > 0
                            ? "poor accuracy (>35m)"
                            : diagnostics.rejection_counts?.stationary_drift &&
                                diagnostics.rejection_counts.stationary_drift >
                                  0
                              ? "stationary drift (<4m)"
                              : "signal filtering"
                        }.`
                      : Math.max(
                            diagnostics?.total_samples_received || 0,
                            (diagnostics?.accepted_samples_count || 0) +
                              (diagnostics?.rejected_samples_count || 0),
                          ) === 0
                        ? "No GPS location readings were received from device location services."
                        : "No GPS coordinate points recorded for this trip."
                    : "1 coordinate point recorded (stationary baseline)."}
                </Text>
              </View>
            }
            initialNumToRender={20}
            maxToRenderPerBatch={25}
            windowSize={7}
            contentContainerStyle={styles.timelineContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <FlatList
            data={[]}
            renderItem={() => null}
            ListHeaderComponent={renderListHeader}
            contentContainerStyle={styles.timelineContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: Sizing.radiusFull,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: "700",
  },
  titleContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  screenTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  screenSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 1,
  },
  deleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Sizing.radiusFull,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  timelineContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  headerContainer: {
    paddingTop: Spacing.sm,
  },
  tripTypeBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  bannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  bannerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Sizing.radiusSm,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  warningCard: {
    padding: Spacing.sm,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  warningTitle: {
    fontSize: 12,
    fontWeight: "700",
  },
  warningBody: {
    fontSize: 12,
    marginTop: 2,
  },
  kpiRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  kpiCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    alignItems: "center",
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginVertical: 2,
  },
  kpiUnit: {
    fontSize: 11,
    fontWeight: "500",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  gridCell: {
    flex: 1,
    minWidth: "45%",
    padding: Spacing.sm,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
  },
  cellLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  cellValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  cellUnit: {
    fontSize: 12,
    fontWeight: "500",
  },
  infoCard: {
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  infoText: {
    fontSize: 13,
    fontWeight: "600",
  },
  notesText: {
    fontSize: 12,
    fontStyle: "italic",
  },
  diagnosticsCard: {
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  diagHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  diagTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  diagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  diagBadgeText: {
    fontSize: 9,
    fontWeight: "800",
  },
  diagRowsWrap: {
    gap: 2,
  },
  diagRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  diagLabel: {
    fontSize: 11,
  },
  diagValue: {
    fontSize: 11,
    fontWeight: "700",
  },
  timelineSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  pointsCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
  },
  pointsCountText: {
    fontSize: 10,
    fontWeight: "700",
  },
  modeSwitcherContainer: {
    flexDirection: "row",
    borderRadius: Sizing.radiusMd,
    padding: 3,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Sizing.radiusSm,
  },
  modeBtnActive: {
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  modeBtnText: {
    fontSize: 12,
  },
  sparklineCard: {
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    padding: Spacing.md,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  sparklineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  sparklineLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  sparkStatChips: {
    flexDirection: "row",
    gap: 6,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statChipLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  statChipValue: {
    fontSize: 10,
    fontWeight: "800",
  },
  selectedBarBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    marginBottom: 8,
  },
  selectedBarText: {
    fontSize: 11,
    fontWeight: "600",
  },
  selectedBarClose: {
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 4,
  },
  chartCanvas: {
    height: 64,
    position: "relative",
    justifyContent: "flex-end",
    marginBottom: Spacing.xs,
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    borderBottomWidth: 1,
    borderStyle: "dashed",
  },
  avgGridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    borderBottomWidth: 1,
    borderStyle: "dashed",
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  avgLineBadge: {
    fontSize: 9,
    fontWeight: "700",
    paddingHorizontal: 4,
    marginTop: -12,
  },
  sparklineBarsRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: "100%",
    gap: 2,
  },
  sparkBarWrap: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  peakIndicatorDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#EA580C",
    marginBottom: 2,
  },
  selectedIndicatorPin: {
    alignItems: "center",
    marginBottom: 1,
  },
  selectedPinIcon: {
    fontSize: 8,
    color: "#EAB308",
    lineHeight: 9,
  },
  sparkBar: {
    width: "100%",
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    minHeight: 3,
  },
  sparklineFooter: {
    marginTop: 6,
    gap: 4,
  },
  speedLegendRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 12,
    paddingTop: 2,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
    fontWeight: "600",
  },
  journeyAxisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sparkFooterText: {
    fontSize: 10,
    fontWeight: "600",
  },
  timelineHintRow: {
    paddingVertical: 4,
    marginBottom: Spacing.xs,
  },
  timelineHintText: {
    fontSize: 11,
    fontStyle: "italic",
  },
  waypointRowContainer: {
    marginBottom: 6,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  trackColumn: {
    width: 28,
    alignItems: "center",
    paddingTop: 8,
  },
  nodeCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  nodeText: {
    fontSize: 11,
  },
  regularDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  verticalLine: {
    width: 2,
    flex: 1,
    minHeight: 38,
    marginTop: 2,
  },
  waypointCard: {
    flex: 1,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    padding: Spacing.sm + 2,
    marginLeft: Spacing.xs,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  milestonePill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: Sizing.radiusSm,
    maxWidth: "75%",
  },
  milestonePillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  fixTagPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  fixTagText: {
    fontSize: 10,
    fontWeight: "700",
  },
  selectedBannerStrip: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedBannerText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  speedBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  speedBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  cardFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTelemetryWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
    flexWrap: "wrap",
  },
  pointTime: {
    fontSize: 12,
    fontWeight: "700",
  },
  stepSubtext: {
    fontSize: 11,
  },
  cumDistanceText: {
    fontSize: 12,
    fontWeight: "800",
  },
  inspectorBox: {
    marginTop: Spacing.sm,
    padding: Spacing.sm + 2,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
  },
  inspectorHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  inspectorTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  inspectorFixIndex: {
    fontSize: 10,
    fontWeight: "700",
  },
  inspectorGrid: {
    gap: 5,
  },
  inspectorItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  inspectorLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
    flexShrink: 0,
  },
  inspectorValue: {
    fontSize: 11,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
  },
  speedComparisonSection: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#00000010",
  },
  speedComparisonHeading: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  speedComparisonCardsRow: {
    flexDirection: "row",
    gap: 6,
  },
  speedComparisonCard: {
    flex: 1,
    padding: 8,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
  },
  compareTitleRow: {
    marginBottom: 2,
  },
  compareBadge: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  compareSpeedNumber: {
    fontSize: 16,
    fontWeight: "800",
    marginVertical: 2,
  },
  compareSpeedUnit: {
    fontSize: 10,
    fontWeight: "600",
  },
  compareExplainer: {
    fontSize: 9,
    lineHeight: 12,
    marginTop: 2,
  },
  rejectionBanner: {
    padding: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  rejectionText: {
    fontSize: 10,
    fontWeight: "700",
  },
  gapBridge: {
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    marginBottom: 4,
    marginTop: 2,
  },
  gapBridgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 12,
    marginTop: Spacing.sm,
  },
  emptyTimelineContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: Spacing.xs,
  },
  emptyTimelineText: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});
