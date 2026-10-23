/**
 * Dedicated Trip Detail & Timeline Modal
 *
 * Provides in-depth inspection of a completed or interrupted trip:
 * - Summary statistics (Distance, Duration, Average speed, Max speed)
 * - GPS Diagnostic breakdowns (accepted/rejected counts, gap frequency, anomaly reasons)
 * - Virtualized GPS timeline (`FlatList`) for GPS trips, displaying:
 *   * Timestamp
 *   * Stored GPS point speed (converted from m/s to km/h) vs derived segment speed
 *   * Horizontal accuracy (or Unknown, never zero)
 *   * Step distance from previous accepted point (via Haversine)
 *   * Cumulative distance progression
 *   * Flagged signal gaps (>120s) with bridging indicators
 * - Clean odometer inspection for manual trips
 * - Handles 0 points, 1 point, and long timelines (thousands of points)
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sizing, Spacing, Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { Trip, TripLocation, TripDiagnostics } from '@/types/trip';
import type { Vehicle } from '@/types/vehicle';
import * as tripRepo from '@/database/repositories/tripRepo';
import { haversineDistance, SIGNAL_GAP_SECONDS } from '@/engine/distanceEngine';
import { formatDisplayDateLong } from '@/utils/date';
import { formatTripDuration } from './TripSummaryCard';

interface TripDetailModalProps {
  visible: boolean;
  trip: Trip | null;
  vehicle?: Vehicle | null;
  onClose: () => void;
  onDelete?: (tripId: string) => void;
}

interface ProcessedLocationPoint extends TripLocation {
  index: number;
  stepMeters: number;
  cumulativeKm: number;
  timeFormatted: string;
  gpsSpeedKmh: number | null;
  segmentSpeedKmh: number | null;
  isGapBridge: boolean;
  gapDurationSeconds: number;
}

export function TripDetailModal({
  visible,
  trip,
  vehicle,
  onClose,
  onDelete,
}: TripDetailModalProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const [rawLocations, setRawLocations] = useState<TripLocation[]>([]);
  const [isLoadingPoints, setIsLoadingPoints] = useState(false);

  const isGps = trip?.trip_type === 'gps';

  // Load points when a GPS trip modal opens
  useEffect(() => {
    if (visible && trip && trip.trip_type === 'gps') {
      setIsLoadingPoints(true);
      try {
        const points = tripRepo.getTripLocations(trip.id);
        setRawLocations(points);
      } catch (err) {
        console.warn('[TripDetailModal] Failed to query trip locations:', err);
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
    if (!trip?.diagnostics) return null;
    if (typeof trip.diagnostics === 'object') return trip.diagnostics as TripDiagnostics;
    try {
      return JSON.parse(trip.diagnostics);
    } catch {
      return null;
    }
  }, [trip?.diagnostics]);

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

        // Calculate step distance if both points are valid
        if (loc.is_rejected === 0) {
          const anchor = prevAccepted || prevLoc;
          stepMeters = haversineDistance(
            anchor.latitude,
            anchor.longitude,
            loc.latitude,
            loc.longitude
          );
          cumMeters += stepMeters;
          prevAccepted = loc;

          if (timeDeltaSec > 0 && stepMeters > 0) {
            segmentSpeedKmh = Math.round((stepMeters / timeDeltaSec) * 3.6);
          }
        }
      } else if (loc.is_rejected === 0) {
        prevAccepted = loc;
      }

      // Convert stored GPS speed from m/s to km/h (Doppler velocity from GNSS hardware)
      const gpsSpeedKmh =
        loc.speed !== null && loc.speed !== undefined && loc.speed >= 0
          ? Math.round(loc.speed * 3.6)
          : null;

      if (gpsSpeedKmh !== null && gpsSpeedKmh > maxSpeedFound) {
        maxSpeedFound = gpsSpeedKmh;
      }

      const dateObj = new Date(loc.timestamp);
      const timeFormatted = dateObj.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
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
  }, [rawLocations]);

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

  if (!visible || !trip) return null;

  const durationStr = formatTripDuration(trip.duration_seconds);
  const avgSpeedKmh =
    trip.duration_seconds > 0 && trip.distance_km > 0
      ? Math.round((trip.distance_km / (trip.duration_seconds / 3600)) * 10) / 10
      : null;

  const handleDelete = () => {
    Alert.alert(
      'Delete Trip Record? 🚗',
      `Delete this ${isGps ? 'GPS' : 'manual'} trip from ${formatDisplayDateLong(trip.start_time.split('T')[0])} (${trip.distance_km.toFixed(2)} km)?\n\nDeleting this trip will never roll back your vehicle odometer.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete?.(trip.id);
            onClose();
          },
        },
      ]
    );
  };

  // ── Header Component for the Virtualized FlatList ─────────────────
  const renderListHeader = () => (
    <View style={styles.headerContainer}>
      {/* ── Title & Meta ── */}
      <View style={styles.metaRow}>
        <View style={{ flex: 1 }}>
          <Text style={[Typography.h2, { color: colors.text }]}>
            {isGps ? '🛰️ GPS Trip Details' : '✍️ Manual Trip Details'}
          </Text>
          <Text style={[Typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
            {formatDisplayDateLong(trip.start_time.split('T')[0])}
            {vehicle?.nickname ? ` · ${vehicle.nickname}` : ''}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                trip.status === 'completed'
                  ? colors.primaryLight
                  : colors.warningLight,
            },
          ]}
        >
          <Text
            style={[
              Typography.caption,
              {
                color:
                  trip.status === 'completed'
                    ? colors.primary
                    : colors.warning,
                fontWeight: '700',
              },
            ]}
          >
            {trip.status.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* ── Warning Banner if Any ── */}
      {trip.quality_warning && (
        <View
          style={[
            styles.banner,
            { backgroundColor: colors.warningLight, borderColor: colors.warning },
          ]}
        >
          <Text style={[Typography.caption, { color: colors.warning, fontWeight: '700' }]}>
            ⚠️ Data Quality Notice
          </Text>
          <Text style={[Typography.caption, { color: colors.text, marginTop: 3 }]}>
            {trip.quality_warning}
          </Text>
        </View>
      )}

      {/* ── KPI Stat Cards ── */}
      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[Typography.caption, { color: colors.textSecondary }]}>TOTAL DISTANCE</Text>
          <Text style={[styles.kpiValue, { color: colors.primary }]}>
            {trip.distance_km.toFixed(2)}
          </Text>
          <Text style={[Typography.caption, { color: colors.textSecondary }]}>kilometers</Text>
        </View>

        <View style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[Typography.caption, { color: colors.textSecondary }]}>DURATION</Text>
          <Text style={[styles.kpiValue, { color: colors.text }]}>
            {durationStr || '—'}
          </Text>
          <Text style={[Typography.caption, { color: colors.textSecondary }]}>
            {durationStr ? 'active time' : 'not timed'}
          </Text>
        </View>
      </View>

      {/* ── Speed & Odometer Row ── */}
      <View style={styles.metricsGrid}>
        {avgSpeedKmh !== null && (
          <View style={[styles.gridCell, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[Typography.caption, { color: colors.textSecondary }]}>AVG SPEED</Text>
            <Text style={[Typography.body, { color: colors.text, fontWeight: '700', marginTop: 2 }]}>
              {avgSpeedKmh} km/h
            </Text>
          </View>
        )}

        {maxGpsSpeedKmh !== null && (
          <View style={[styles.gridCell, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[Typography.caption, { color: colors.textSecondary }]}>MAX SPEED</Text>
            <Text style={[Typography.body, { color: colors.text, fontWeight: '700', marginTop: 2 }]}>
              {maxGpsSpeedKmh} km/h
            </Text>
          </View>
        )}

        {trip.start_odometer !== null && (
          <View style={[styles.gridCell, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[Typography.caption, { color: colors.textSecondary }]}>START ODO</Text>
            <Text style={[Typography.body, { color: colors.text, fontWeight: '700', marginTop: 2 }]}>
              {trip.start_odometer.toLocaleString()} km
            </Text>
          </View>
        )}

        {trip.end_odometer !== null && (
          <View style={[styles.gridCell, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[Typography.caption, { color: colors.textSecondary }]}>END ODO</Text>
            <Text style={[Typography.body, { color: colors.text, fontWeight: '700', marginTop: 2 }]}>
              {trip.end_odometer.toLocaleString()} km
            </Text>
          </View>
        )}
      </View>

      {/* ── Purpose and Notes ── */}
      {(trip.purpose || trip.notes) && (
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: Spacing.sm }]}>
          {trip.purpose && (
            <View style={{ marginBottom: trip.notes ? Spacing.xs : 0 }}>
              <Text style={[Typography.caption, { color: colors.textSecondary }]}>TRIP PURPOSE</Text>
              <Text style={[Typography.bodySmall, { color: colors.text, fontWeight: '600' }]}>
                {trip.purpose}
              </Text>
            </View>
          )}
          {trip.notes && (
            <View style={{ marginTop: trip.purpose ? Spacing.xs : 0 }}>
              <Text style={[Typography.caption, { color: colors.textSecondary }]}>NOTES</Text>
              <Text style={[Typography.bodySmall, { color: colors.text, fontStyle: 'italic' }]}>
                "{trip.notes}"
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── Diagnostics Summary (GPS Trips Only) ── */}
      {isGps && diagnostics && (
        <View style={[styles.diagnosticsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[Typography.caption, { color: colors.textSecondary, fontWeight: '700', marginBottom: 6 }]}>
            🛰️ SENSOR DIAGNOSTICS & FILTERING
          </Text>
          <View style={styles.diagRow}>
            <Text style={[Typography.caption, { color: colors.textSecondary }]}>Samples Received:</Text>
            <Text style={[Typography.caption, { color: colors.text, fontWeight: '600' }]}>
              {diagnostics.total_samples_received} ({diagnostics.accepted_samples_count} accepted, {diagnostics.rejected_samples_count} filtered)
            </Text>
          </View>
          {diagnostics.gap_count > 0 && (
            <View style={[styles.diagRow, { marginTop: 3 }]}>
              <Text style={[Typography.caption, { color: colors.warning }]}>Signal Gaps (&gt;120s):</Text>
              <Text style={[Typography.caption, { color: colors.warning, fontWeight: '600' }]}>
                {diagnostics.gap_count} gap{diagnostics.gap_count > 1 ? 's' : ''} (max {diagnostics.max_gap_seconds}s)
              </Text>
            </View>
          )}
        </View>
      )}

      {/* ── GPS Timeline Section Title ── */}
      {/* ── GPS Timeline Section Title & Table Header ── */}
      {isGps && (
        <View style={{ marginTop: Spacing.md }}>
          <View style={styles.sectionHeader}>
            <Text style={[Typography.bodySmall, { color: colors.textSecondary, fontWeight: '700' }]}>
              RECORDED POINT TIMELINE
            </Text>
            <Text style={[Typography.caption, { color: colors.textTertiary }]}>
              {processedPoints.length} point{processedPoints.length === 1 ? '' : 's'} recorded
            </Text>
          </View>

          {processedPoints.length > 0 && (
            <View
              style={[
                styles.tableHeaderRow,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.colTime, styles.headerText, { color: colors.textSecondary }]}>
                Time
              </Text>
              <Text style={[styles.colSpeed, styles.headerText, { color: colors.textSecondary }]}>
                GPS speed
              </Text>
              <Text style={[styles.colStep, styles.headerText, { color: colors.textSecondary }]}>
                Since previous
              </Text>
              <Text style={[styles.colCum, styles.headerText, { color: colors.textSecondary }]}>
                Cumulative
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );

  // ── Render Timeline Item ──────────────────────────────────────────
  const renderPointItem = ({ item }: { item: ProcessedLocationPoint }) => {
    const isRejected = item.is_rejected === 1;

    return (
      <View>
        {/* Signal Gap Bridging Divider */}
        {item.isGapBridge && (
          <View style={[styles.gapBridge, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}>
            <Text style={[Typography.caption, { color: colors.warning, fontWeight: '700', fontSize: 11 }]}>
              ⚠️ Signal Gap Detected: {item.gapDurationSeconds}s elapsed between GPS fixes (distance bridged)
            </Text>
          </View>
        )}

        <View
          style={[
            styles.tableRow,
            {
              borderBottomColor: colors.borderLight,
              backgroundColor: isRejected ? colors.background : 'transparent',
              opacity: isRejected ? 0.6 : 1,
            },
          ]}
        >
          {/* Time */}
          <Text style={[styles.colTime, styles.cellText, { color: colors.text, fontWeight: '600' }]}>
            {item.timeFormatted}
          </Text>

          {/* GPS Speed */}
          <Text
            style={[
              styles.colSpeed,
              styles.cellText,
              {
                color: item.gpsSpeedKmh !== null && item.gpsSpeedKmh > 0 ? colors.primary : colors.textTertiary,
                fontWeight: item.gpsSpeedKmh !== null && item.gpsSpeedKmh > 0 ? '700' : '500',
              },
            ]}
          >
            {item.gpsSpeedKmh !== null ? `${item.gpsSpeedKmh} km/h` : '—'}
          </Text>

          {/* Since previous point */}
          <Text style={[styles.colStep, styles.cellText, { color: colors.textSecondary }]}>
            {item.index === 1 ? '—' : `${Math.round(item.stepMeters)} m`}
          </Text>

          {/* Cumulative */}
          <Text style={[styles.colCum, styles.cellText, { color: colors.text, fontWeight: '700' }]}>
            {item.cumulativeKm.toFixed(2)} km
          </Text>
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
            paddingTop: insets.top || Spacing.md,
            paddingBottom: insets.bottom || Spacing.md,
          },
        ]}
      >
        {/* ── Top Bar ── */}
        <View style={[styles.topBar, { borderBottomColor: colors.borderLight }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={[Typography.body, { color: colors.primary, fontWeight: '600' }]}>
              ✕ Close
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleDelete} style={styles.deleteTopBtn}>
            <Text style={[Typography.bodySmall, { color: colors.danger, fontWeight: '600' }]}>
              🗑️ Delete
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Body: Virtualized Timeline (GPS) or Scrollable Info (Manual) ── */}
        {isLoadingPoints ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: Spacing.sm }]}>
              Loading route points...
            </Text>
          </View>
        ) : isGps ? (
          <FlatList
            data={processedPoints}
            keyExtractor={(item) => item.id}
            renderItem={renderPointItem}
            ListHeaderComponent={renderListHeader}
            ListEmptyComponent={
              <View style={styles.emptyTimelineContainer}>
                <Text style={styles.emptyIcon}>📍</Text>
                <Text style={[Typography.bodySmall, { color: colors.textSecondary, textAlign: 'center' }]}>
                  {rawLocations.length === 0
                    ? 'No GPS coordinate points recorded for this trip.'
                    : '1 coordinate point recorded (stationary baseline).'}
                </Text>
              </View>
            }
            initialNumToRender={20}
            maxToRenderPerBatch={25}
            windowSize={7}
            contentContainerStyle={styles.timelineContent}
          />
        ) : (
          <FlatList
            data={[]}
            renderItem={() => null}
            ListHeaderComponent={renderListHeader}
            contentContainerStyle={styles.timelineContent}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  closeBtn: {
    paddingVertical: 6,
  },
  deleteTopBtn: {
    paddingVertical: 6,
  },
  timelineContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  headerContainer: {
    paddingTop: Spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Sizing.radiusFull,
  },
  banner: {
    padding: Spacing.sm,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  kpiCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    ...Sizing.cardShadow,
  },
  kpiValue: {
    fontSize: 26,
    fontWeight: '800',
    marginVertical: 2,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  gridCell: {
    flex: 1,
    minWidth: '45%',
    padding: Spacing.sm,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
  },
  infoCard: {
    padding: Spacing.md,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
  },
  diagnosticsCard: {
    padding: Spacing.sm,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  diagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
    paddingBottom: 4,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cellText: {
    fontSize: 12,
  },
  colTime: {
    flex: 1.1,
    textAlign: 'left',
  },
  colSpeed: {
    flex: 1.0,
    textAlign: 'center',
  },
  colStep: {
    flex: 1.1,
    textAlign: 'right',
  },
  colCum: {
    flex: 1.2,
    textAlign: 'right',
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: Spacing.sm,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    marginBottom: 4,
  },
  pointIndexCol: {
    width: 60,
  },
  pointIndexText: {
    fontSize: 10,
    fontWeight: '700',
  },
  pointMetricsCol: {
    flex: 1,
    paddingHorizontal: Spacing.xs,
  },
  speedAndAccRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  segmentDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 1,
  },
  pointDistanceCol: {
    minWidth: 70,
  },
  gapBridge: {
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    marginBottom: 4,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTimelineContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: Spacing.xs,
  },
});
