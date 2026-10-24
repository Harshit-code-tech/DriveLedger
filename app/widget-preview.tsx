/**
 * In-App Widget Interactive Preview Screen
 *
 * Dedicated route: /widget-preview
 * Allows testing and previewing the GPS Cockpit Widget and Vehicle Glance Widget
 * in real-time within Expo without building a native APK.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Typography, Spacing, Sizing } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useVehicleStore } from '@/stores/vehicleStore';
import { useTripStore } from '@/stores/tripStore';

export default function WidgetPreviewScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);
  const vehicles = useVehicleStore((s) => s.vehicles);

  // Simulation state
  const [activeState, setActiveState] = useState<'idle' | 'recording' | 'paused'>('idle');
  const [simSpeed, setSimSpeed] = useState(0);
  const [simDistance, setSimDistance] = useState(0);
  const [simSeconds, setSimSeconds] = useState(0);
  const [vehicleIdx, setVehicleIdx] = useState(0);

  const currentVehicle = vehicles[vehicleIdx] ?? selectedVehicle ?? {
    id: 'demo-1',
    nickname: 'City VTEC',
    registration_number: 'DL 01 AB 1234',
    fuel_type: 'petrol',
    current_odometer: 48250,
  };

  // Live timer & acceleration simulation
  useEffect(() => {
    if (activeState !== 'recording') return;

    const interval = setInterval(() => {
      setSimSeconds((s) => s + 1);
      setSimSpeed((prev) => {
        const target = 68;
        if (prev < target) return prev + 6;
        return target + Math.round((Math.random() - 0.5) * 3);
      });
      setSimDistance((d) => d + 0.02);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeState]);

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleStart = () => {
    setActiveState('recording');
    setSimSpeed(15);
    setSimDistance(0);
    setSimSeconds(0);
  };

  const handlePause = () => {
    setActiveState('paused');
    setSimSpeed(0);
  };

  const handleResume = () => {
    setActiveState('recording');
  };

  const handleFinish = () => {
    setActiveState('idle');
    setSimSpeed(0);
  };

  const handleCycle = () => {
    if (vehicles.length > 1) {
      setVehicleIdx((prev) => (prev + 1) % vehicles.length);
    }
  };

  const isRecording = activeState === 'recording';
  const isPaused = activeState === 'paused';

  const widgetBorderColor = isRecording ? '#0891B2' : isPaused ? '#D97706' : '#334155';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#030712' }]}>
      {/* Header Bar */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          style={styles.backBtn}
        >
          <Text style={{ color: '#06B6D4', fontSize: 16, fontWeight: '700' }}>← Back</Text>
        </TouchableOpacity>
        <Text style={[Typography.h3, { color: '#FFFFFF', fontSize: 18 }]}>GPS Widget Preview</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Subtitle */}
        <Text style={[Typography.caption, { color: '#94A3B8', textAlign: 'center', marginBottom: 20 }]}>
          Zero-build interactive simulator. Tap widget buttons directly or use controls below.
        </Text>

        {/* ── Simulated Android Widget Container (4x2) ── */}
        <View style={[styles.widgetBox, { borderColor: widgetBorderColor }]}>
          {/* Header Row */}
          <View style={styles.widgetHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {isRecording ? (
                <View style={styles.recBadge}>
                  <View style={styles.recDot} />
                  <Text style={{ color: '#FCA5A5', fontSize: 10, fontWeight: '800' }}>REC</Text>
                </View>
              ) : isPaused ? (
                <View style={styles.pausedBadge}>
                  <Text style={{ color: '#FCD34D', fontSize: 10, fontWeight: '800' }}>⏸️ PAUSED</Text>
                </View>
              ) : (
                <Text style={{ fontSize: 14 }}>⛽</Text>
              )}

              <Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                {currentVehicle.nickname}
              </Text>
              <View style={styles.regChip}>
                <Text style={{ color: '#94A3B8', fontSize: 10, fontWeight: '600' }}>
                  {currentVehicle.registration_number}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {!isRecording && !isPaused && vehicles.length > 1 && (
                <TouchableOpacity style={styles.switchBtn} onPress={handleCycle}>
                  <Text style={{ color: '#A5B4FC', fontSize: 10, fontWeight: '700' }}>Switch 🔄</Text>
                </TouchableOpacity>
              )}
              <View style={styles.offlineBadge}>
                <Text style={{ color: '#6EE7B7', fontSize: 10, fontWeight: '700' }}>
                  {isRecording ? 'GPS Lock 8m' : isPaused ? 'Zero-Drift Safe' : '100% Offline'}
                </Text>
              </View>
            </View>
          </View>

          {/* Telematics Center Row */}
          {activeState === 'idle' ? (
            <View style={styles.idleRow}>
              <View style={styles.idleItem}>
                <Text style={styles.itemLabel}>ODOMETER</Text>
                <Text style={styles.itemVal}>{Number(currentVehicle.current_odometer || 0).toLocaleString('en-IN')} km</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.idleItem}>
                <Text style={styles.itemLabel}>LAST TRIP</Text>
                <Text style={[styles.itemVal, { color: '#67E8F9' }]}>24.6 km · 38m</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.idleItem}>
                <Text style={styles.itemLabel}>CHECKLIST</Text>
                <Text style={[styles.itemVal, { color: '#6EE7B7' }]}>Ready ✅</Text>
              </View>
            </View>
          ) : (
            <View style={[styles.activeRow, isPaused && { borderColor: '#D97706' }]}>
              {/* Speed */}
              <View style={styles.metricCol}>
                <Text style={styles.metricLabel}>SPEED</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
                  <Text style={[styles.metricBig, isPaused ? { color: '#64748B' } : { color: '#6EE7B7' }]}>
                    {simSpeed}
                  </Text>
                  <Text style={{ fontSize: 10, color: '#94A3B8', marginBottom: 2 }}>km/h</Text>
                </View>
                <Text style={{ fontSize: 9, color: '#94A3B8' }}>{isPaused ? 'Stationary' : 'Cruising'}</Text>
              </View>

              <View style={styles.divider} />

              {/* Distance */}
              <View style={[styles.metricCol, { flex: 1.2 }]}>
                <Text style={styles.metricLabel}>{isPaused ? 'FROZEN DISTANCE' : 'DISTANCE'}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
                  <Text style={[styles.metricBig, isPaused ? { color: '#FCD34D' } : { color: '#67E8F9' }]}>
                    {simDistance.toFixed(2)}
                  </Text>
                  <Text style={{ fontSize: 10, color: isPaused ? '#FCD34D' : '#67E8F9', marginBottom: 2, fontWeight: '700' }}>
                    KM
                  </Text>
                </View>
                <Text style={{ fontSize: 9, color: '#94A3B8' }}>{isPaused ? 'Hold position' : 'Active tracking'}</Text>
              </View>

              <View style={styles.divider} />

              {/* Elapsed */}
              <View style={styles.metricCol}>
                <Text style={styles.metricLabel}>{isPaused ? 'TRIP TIME' : 'ELAPSED'}</Text>
                <Text style={[styles.metricBig, { fontSize: 20, color: '#F8FAFC', marginTop: 2 }]}>
                  {formatElapsed(simSeconds)}
                </Text>
                <Text style={{ fontSize: 9, color: isPaused ? '#FCD34D' : '#6EE7B7' }}>
                  {isPaused ? 'Pit-Stop' : 'Live'}
                </Text>
              </View>
            </View>
          )}

          {/* Action Buttons Row */}
          <View style={styles.actionsRow}>
            {activeState === 'idle' ? (
              <>
                <TouchableOpacity style={[styles.wBtn, styles.btnStart]} onPress={handleStart} activeOpacity={0.8}>
                  <Text style={{ color: '#67E8F9', fontWeight: '800', fontSize: 12 }}>▶️  START GPS TRIP</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.wBtn, styles.btnChecklist]}
                  onPress={() => router.push('/checklist')}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: '#F8FAFC', fontWeight: '600', fontSize: 12 }}>🛣️  Checklist</Text>
                </TouchableOpacity>
              </>
            ) : isPaused ? (
              <>
                <TouchableOpacity style={[styles.wBtn, styles.btnResume]} onPress={handleResume} activeOpacity={0.8}>
                  <Text style={{ color: '#6EE7B7', fontWeight: '800', fontSize: 12 }}>▶️  RESUME TRIP</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.wBtn, styles.btnFinish]} onPress={handleFinish} activeOpacity={0.8}>
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12 }}>🏁  FINISH</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={[styles.wBtn, styles.btnPause]} onPress={handlePause} activeOpacity={0.8}>
                  <Text style={{ color: '#FCD34D', fontWeight: '800', fontSize: 12 }}>⏸️  PAUSE</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.wBtn, styles.btnFinish]} onPress={handleFinish} activeOpacity={0.8}>
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12 }}>🏁  FINISH & LOG</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* ── State Switcher Bar ── */}
        <View style={styles.controlCard}>
          <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700', marginBottom: 10 }}>
            Mode Switcher
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[styles.pillBtn, activeState === 'idle' && styles.pillActive]}
              onPress={() => setActiveState('idle')}
            >
              <Text style={styles.pillText}>Idle Launcher</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pillBtn, activeState === 'recording' && styles.pillActive]}
              onPress={() => {
                setActiveState('recording');
                setSimSpeed(68);
              }}
            >
              <Text style={styles.pillText}>Recording HUD</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pillBtn, activeState === 'paused' && styles.pillActive]}
              onPress={() => {
                setActiveState('paused');
                setSimSpeed(0);
              }}
            >
              <Text style={styles.pillText}>Paused Pit-Stop</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  backBtn: {
    padding: 6,
  },
  scrollContent: {
    padding: 16,
    alignItems: 'center',
  },
  widgetBox: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0B1120',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1.5,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 8,
    marginBottom: 24,
  },
  widgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  regChip: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  recBadge: {
    backgroundColor: '#450A0A',
    borderColor: '#DC2626',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  pausedBadge: {
    backgroundColor: '#451A03',
    borderColor: '#D97706',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  switchBtn: {
    backgroundColor: '#1E1B4B',
    borderColor: '#4F46E5',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  offlineBadge: {
    backgroundColor: '#064E3B',
    borderColor: '#059669',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  idleRow: {
    backgroundColor: '#162032',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  idleItem: {
    alignItems: 'flex-start',
  },
  itemLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: '#64748B',
  },
  itemVal: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 1,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: '#334155',
  },
  activeRow: {
    backgroundColor: '#162032',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#64748B',
  },
  metricBig: {
    fontSize: 22,
    fontWeight: '800',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  wBtn: {
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  btnStart: {
    flex: 2,
    backgroundColor: '#083344',
    borderColor: '#0E7490',
  },
  btnChecklist: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderColor: '#334155',
  },
  btnPause: {
    flex: 1,
    backgroundColor: '#451A03',
    borderColor: '#D97706',
  },
  btnResume: {
    flex: 1.3,
    backgroundColor: '#064E3B',
    borderColor: '#059669',
  },
  btnFinish: {
    flex: 1.2,
    backgroundColor: '#450A0A',
    borderColor: '#DC2626',
  },
  controlCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0E1626',
    borderColor: '#1E293B',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  pillBtn: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#162032',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
  },
  pillActive: {
    backgroundColor: '#06B6D4',
    borderColor: '#06B6D4',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E2E8F0',
  },
});
