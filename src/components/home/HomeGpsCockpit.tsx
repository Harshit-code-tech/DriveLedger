/**
 * HomeGpsCockpit
 *
 * Section 5: GPS Cockpit
 * Hero interactive section for GPS trip tracking.
 * Features an optimized driving-perspective highway background image,
 * dynamic multi-stop linear gradient vignette (so the road & sunset lights shine through),
 * high-contrast digital speedometer with text shadow, frosted HUD metrics,
 * state-dependent controls, and manual trip/history shortcuts.
 *
 * PERFORMANCE:
 * Subscribes to `useTripStore` selectors locally so that frequent GPS liveMetrics ticks
 * are isolated to this component and do not re-render the rest of the Home page.
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTripStore } from '@/stores/tripStore';
import { useVehicleStore } from '@/stores/vehicleStore';
import { type Vehicle } from '@/types/vehicle';
import { Spacing } from '@/constants/theme';
import { type HomePalette } from './homeTheme';

interface HomeGpsCockpitProps {
  vehicle: Vehicle;
  colors: HomePalette;
  onOpenActiveTripModal: () => void;
  onOpenTripReviewModal: () => void;
  onOpenManualTripModal: () => void;
  onOpenTripHistoryModal: () => void;
}

function formatTripTime(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}

export const HomeGpsCockpit = React.memo(function HomeGpsCockpit({
  vehicle,
  colors,
  onOpenActiveTripModal,
  onOpenTripReviewModal,
  onOpenManualTripModal,
  onOpenTripHistoryModal,
}: HomeGpsCockpitProps) {
  // Localized subscriptions to prevent full-screen re-renders
  const activeTrip = useTripStore((s) => s.activeTrip);
  const recordingState = useTripStore((s) => s.recordingState);
  const liveMetrics = useTripStore((s) => s.liveMetrics);
  const trips = useTripStore((s) => s.trips);
  const startGpsTrip = useTripStore((s) => s.startGpsTrip);
  const pauseGpsTrip = useTripStore((s) => s.pauseGpsTrip);
  const resumeGpsTrip = useTripStore((s) => s.resumeGpsTrip);
  const cancelGpsTrip = useTripStore((s) => s.cancelGpsTrip);

  const vehicles = useVehicleStore((s) => s.vehicles);
  const selectVehicle = useVehicleStore((s) => s.selectVehicle);

  // Check if a trip is active on THIS vehicle or ANOTHER vehicle
  const isTripOnThisVehicle = Boolean(
    activeTrip && String(activeTrip.vehicle_id) === String(vehicle.id)
  );
  const isTripOnOtherVehicle = Boolean(
    activeTrip && String(activeTrip.vehicle_id) !== String(vehicle.id)
  );
  const otherVehicle = useMemo(() => {
    if (!isTripOnOtherVehicle || !activeTrip) return null;
    return vehicles.find((v) => String(v.id) === String(activeTrip.vehicle_id)) || null;
  }, [isTripOnOtherVehicle, activeTrip, vehicles]);

  // Speed in km/h
  const currentSpeedKmh = useMemo(() => {
    if (liveMetrics.currentSpeed !== null && liveMetrics.currentSpeed > 0) {
      return Math.round(liveMetrics.currentSpeed * 3.6);
    }
    return 0;
  }, [liveMetrics.currentSpeed]);

  // GPS Quality Pill
  const gpsQuality = useMemo(() => {
    if (recordingState === 'idle') {
      return {
        label: 'GPS Ready',
        color: '#94A3B8',
        dotColor: '#94A3B8',
      };
    }
    switch (liveMetrics.gpsQuality) {
      case 'good':
        return {
          label: `GPS Good (${Math.round(liveMetrics.currentAccuracy ?? 0)}m)`,
          color: '#22C55E',
          dotColor: '#22C55E',
        };
      case 'fair':
        return {
          label: `GPS Fair (${Math.round(liveMetrics.currentAccuracy ?? 0)}m)`,
          color: '#F59E0B',
          dotColor: '#F59E0B',
        };
      default:
        return {
          label: 'Acquiring GPS...',
          color: '#EF4444',
          dotColor: '#EF4444',
        };
    }
  }, [recordingState, liveMetrics.gpsQuality, liveMetrics.currentAccuracy]);

  // Handlers
  const handleStartTrip = useCallback(async () => {
    if (isTripOnOtherVehicle && otherVehicle) {
      Alert.alert(
        'Trip Already Active',
        `A GPS trip is already recording for ${otherVehicle.nickname}. Only one vehicle can record a trip at a time.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: `Switch to ${otherVehicle.nickname}`,
            onPress: () => selectVehicle(otherVehicle.id),
          },
        ]
      );
      return;
    }

    const res = await startGpsTrip(vehicle.id, vehicle.current_odometer ?? undefined);
    if (!res.success) {
      Alert.alert(
        'GPS Tracking',
        res.error || 'Failed to start GPS tracking. Please check location permissions.'
      );
    }
  }, [vehicle.id, vehicle.current_odometer, isTripOnOtherVehicle, otherVehicle, startGpsTrip, selectVehicle]);

  const handleDiscardTrip = useCallback(() => {
    Alert.alert(
      'Discard Trip?',
      'Are you sure you want to discard this recorded trip? All recorded location points will be lost.',
      [
        { text: 'Keep Recording', style: 'cancel' },
        {
          text: 'Discard Trip',
          style: 'destructive',
          onPress: async () => {
            await cancelGpsTrip();
          },
        },
      ]
    );
  }, [cancelGpsTrip]);

  return (
    <View style={styles.container}>
      {/* ── Active Trip on Another Vehicle Banner ── */}
      {isTripOnOtherVehicle && otherVehicle && (
        <TouchableOpacity
          style={[styles.otherTripBanner, { backgroundColor: colors.surfaceSecondary, borderColor: colors.accent }]}
          onPress={() => selectVehicle(otherVehicle.id)}
          activeOpacity={0.85}
        >
          <View style={styles.otherTripDot} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.otherTripTitle, { color: colors.text }]}>
              {recordingState === 'paused' ? '⏸️ Trip Paused' : '🔴 Trip Active'} on {otherVehicle.nickname}
            </Text>
            <Text style={[styles.otherTripSubtext, { color: colors.textSecondary }]}>
              {liveMetrics.distanceKm.toFixed(1)} km · Tap to switch vehicle
            </Text>
          </View>
          <Text style={[styles.otherTripAction, { color: colors.accent }]}>Switch →</Text>
        </TouchableOpacity>
      )}

      {/* ── Hero Cockpit Card with Luminous Vignette ── */}
      <View
        style={[
          styles.cockpitCard,
          {
            borderColor: colors.isDark
              ? 'rgba(224, 120, 72, 0.45)'
              : 'rgba(198, 91, 46, 0.35)',
          },
        ]}
      >
        <ImageBackground
          source={require('../../../assets/images/cockpit-highway-bg.jpg')}
          style={styles.bgImage}
          imageStyle={styles.bgImageStyle}
          resizeMode="cover"
        >
          {/* Multi-stop gradient overlay: transparent center lets highway pop, dark bottom secures button readability */}
          <LinearGradient
            colors={[
              'rgba(10, 15, 30, 0.58)',
              'rgba(10, 15, 30, 0.22)',
              'rgba(10, 15, 30, 0.45)',
              'rgba(8, 12, 22, 0.94)',
            ]}
            locations={[0, 0.28, 0.62, 1]}
            style={styles.darkOverlay}
          >
            {/* Top Bar: Telematics Status + GPS Accuracy Pill */}
            <View style={styles.telematicsBar}>
              <View style={styles.statusIndicator}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        recordingState === 'recording'
                          ? '#22C55E'
                          : recordingState === 'paused'
                          ? '#F59E0B'
                          : '#94A3B8',
                    },
                  ]}
                />
                <Text style={styles.statusText}>
                  {recordingState === 'recording'
                    ? 'TRACKING ACTIVE'
                    : recordingState === 'paused'
                    ? 'TRIP PAUSED'
                    : 'GPS STANDBY'}
                </Text>
              </View>

              <View style={[styles.gpsPill, { borderColor: gpsQuality.color }]}>
                <View style={[styles.gpsPillDot, { backgroundColor: gpsQuality.dotColor }]} />
                <Text style={[styles.gpsPillText, { color: gpsQuality.color }]}>
                  {gpsQuality.label}
                </Text>
              </View>
            </View>

            {/* Center Area: Primary Speed Dial with Drop Shadow */}
            <View style={styles.speedometerContainer}>
              <View style={styles.speedRow}>
                <Text style={styles.speedValue}>{currentSpeedKmh}</Text>
                <View style={styles.speedUnitCol}>
                  <Text style={styles.speedUnit}>KM/H</Text>
                  <Text style={styles.speedLabel}>SPEED</Text>
                </View>
              </View>
            </View>

            {/* Secondary Metrics: Frosted Glass HUD Box */}
            <View style={styles.metricsRow}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>DISTANCE</Text>
                <View style={styles.metricValueRow}>
                  <Text style={styles.metricValue}>
                    {isTripOnThisVehicle ? liveMetrics.distanceKm.toFixed(2) : '0.00'}
                  </Text>
                  <Text style={styles.metricUnit}>KM</Text>
                </View>
              </View>

              <View style={styles.metricDivider} />

              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>DURATION</Text>
                <View style={styles.metricValueRow}>
                  <Text style={styles.metricValue}>
                    {isTripOnThisVehicle ? formatTripTime(liveMetrics.elapsedSeconds) : '00:00'}
                  </Text>
                  <Text style={styles.metricUnit}>TIME</Text>
                </View>
              </View>
            </View>

            {/* Primary Action Controls (State-dependent) */}
            <View style={styles.controlsRow}>
              {isTripOnThisVehicle ? (
                <>
                  {/* Pause / Resume Button */}
                  {recordingState === 'recording' ? (
                    <TouchableOpacity
                      style={[styles.actionBtnSecondary, { borderColor: '#F59E0B' }]}
                      onPress={pauseGpsTrip}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.actionBtnText, { color: '#F59E0B' }]}>⏸ Pause</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.actionBtnSecondary, { borderColor: '#22C55E' }]}
                      onPress={resumeGpsTrip}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.actionBtnText, { color: '#22C55E' }]}>▶ Resume</Text>
                    </TouchableOpacity>
                  )}

                  {/* Finish & Save Button */}
                  <TouchableOpacity
                    style={[styles.actionBtnPrimary, { backgroundColor: '#DC2626' }]}
                    onPress={onOpenTripReviewModal}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.actionBtnTextPrimary}>🏁 Finish Trip</Text>
                  </TouchableOpacity>
                </>
              ) : (
                /* Idle State: Hero Start Trip Button */
                <TouchableOpacity
                  style={[
                    styles.actionBtnHero,
                    {
                      backgroundColor: colors.accent,
                      opacity: isTripOnOtherVehicle ? 0.6 : 1,
                    },
                  ]}
                  onPress={handleStartTrip}
                  activeOpacity={0.85}
                >
                  <Text style={styles.actionBtnTextHero}>
                    {isTripOnOtherVehicle ? `Trip Active on ${otherVehicle?.nickname}` : '▶ Start GPS Trip'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Bottom Cockpit Strip: Log Trip leftmost, Trip History rightmost with > */}
            <View style={styles.bottomStrip}>
              {isTripOnThisVehicle ? (
                <View style={styles.bottomLinksRow}>
                  <TouchableOpacity onPress={onOpenActiveTripModal} hitSlop={8}>
                    <Text style={styles.inTripLink}>Full HUD Speedometer &gt;</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleDiscardTrip} hitSlop={8}>
                    <Text style={[styles.inTripLink, { color: '#EF4444' }]}>Discard</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.bottomLinksRow}>
                  <TouchableOpacity
                    style={styles.subLinkItem}
                    onPress={onOpenManualTripModal}
                    hitSlop={8}
                  >
                    <Text style={styles.subLinkText}>✍️ Log Trip</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.subLinkItem}
                    onPress={onOpenTripHistoryModal}
                    hitSlop={8}
                  >
                    <Text style={styles.subLinkTextHighlight}>
                      Trip History ({trips.length}) &gt;
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </LinearGradient>
        </ImageBackground>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  otherTripBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: Spacing.xs,
    gap: 8,
  },
  otherTripDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  otherTripTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  otherTripSubtext: {
    fontSize: 10,
    marginTop: 1,
  },
  otherTripAction: {
    fontSize: 11,
    fontWeight: '700',
  },
  cockpitCard: {
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 1.2,
    backgroundColor: '#090E18',
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  bgImage: {
    width: '100%',
  },
  bgImageStyle: {
    borderRadius: 14,
  },
  darkOverlay: {
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  telematicsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#E2E8F0',
    letterSpacing: 0.6,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  gpsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(5, 10, 20, 0.65)',
    gap: 4,
  },
  gpsPillDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  gpsPillText: {
    fontSize: 9,
    fontWeight: '700',
  },
  speedometerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  speedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  speedValue: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -1.8,
    lineHeight: 46,
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  speedUnitCol: {
    marginLeft: 6,
    marginTop: 5,
  },
  speedUnit: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.6,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  speedLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#CBD5E1',
    letterSpacing: 0.6,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 16, 30, 0.58)',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginVertical: 4,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.6,
    marginBottom: 1,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  metricUnit: {
    fontSize: 9,
    fontWeight: '700',
    color: '#F59E0B',
  },
  metricDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  actionBtnHero: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  actionBtnTextHero: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  actionBtnSecondary: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  actionBtnPrimary: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnTextPrimary: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  bottomStrip: {
    marginTop: 6,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.12)',
  },
  bottomLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  subLinkItem: {
    paddingVertical: 2,
  },
  subLinkText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#E2E8F0',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subLinkTextHighlight: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  inTripLink: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
  },
});
