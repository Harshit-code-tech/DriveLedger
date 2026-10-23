/**
 * Home / Vehicle Dashboard
 *
 * THE MOST IMPORTANT SCREEN. This is what the user sees 80% of the time.
 *
 * Charter requirements:
 * - Last selected vehicle dashboard on open
 * - Mileage card (last fill + running average)
 * - Quick stats (total spent, last service, this month, km until service)
 * - [+ Add Fuel] — biggest button on screen
 * - Vehicle switcher (top area)
 * - Document expiry warnings
 *
 * Flow: Open App → Dashboard → Tap [+ Add Fuel] → Fill → Save → See mileage → Close
 */

import { CngTankIcon } from '@/components/CngTankIcon';
import { PreTripChecklistModal } from '@/components/PreTripChecklistModal';
import { VehicleContextHeader } from '@/components/VehicleContextHeader';
import { DOCUMENT_TYPE_LABELS } from '@/constants/documentTypes';
import { FuelType, getFuelSystemLabel, isBiFuel, MILEAGE_UNIT_LABELS } from '@/constants/fuelTypes';
import { Sizing, Spacing, Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { buildPreTripChecklist, getChecklistStats, useChecklistStore } from '@/stores/checklistStore';
import { useDocumentStore } from '@/stores/documentStore';
import { useExpenseStore } from '@/stores/expenseStore';
import { useFuelStore } from '@/stores/fuelStore';
import { convertPressure, getPressureLabel } from '@/stores/preferencesStore';
import { getKmUntilService, getServiceDueStatus, useServiceStore, type ServiceDueStatus } from '@/stores/serviceStore';
import { useVehicleStore } from '@/stores/vehicleStore';
import { daysUntil, formatDisplayDateLong } from '@/utils/date';
import { formatCurrency, formatMileage, formatOdometer } from '@/utils/format';
import { estimateFuelLevel, getCurrentMonthTotalSpend, type FuelLevelResult } from '@/utils/statsHelpers';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SmartInsightsCard } from '@/components/SmartInsightsCard';
import { ActiveTripModal } from '@/components/ActiveTripModal';
import { TripReviewModal } from '@/components/TripReviewModal';
import { ManualTripModal } from '@/components/ManualTripModal';
import { MaintenanceProfilesModal } from '@/components/MaintenanceProfilesModal';
import { TripHistoryModal } from '@/components/TripHistoryModal';
import { useTripStore } from '@/stores/tripStore';
import { useMaintenanceProfileStore } from '@/stores/maintenanceProfileStore';

interface FuelBarSectionProps {
  title: string;
  icon: React.ReactNode;
  level: FuelLevelResult | null;
  tip?: string | null;
  tankDescription?: string;
  colors: ReturnType<typeof useThemeColors>;
}

function FuelBarSection({
  title,
  icon,
  level,
  tip,
  tankDescription,
  colors,
}: FuelBarSectionProps) {
  if (level) {
    return (
      <View>
        <View style={styles.fuelBarHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            {icon}
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{title}</Text>
          </View>
          <Text style={[Typography.bodySmall, { color: level.color, fontWeight: '700' }]}>
            {level.percent.toFixed(0)}%
          </Text>
        </View>

        {/* 5-segment bar */}
        <View style={styles.fuelBarsRow}>
          {[1, 2, 3, 4, 5].map((bar) => (
            <View
              key={bar}
              style={[
                styles.fuelBarSegment,
                { backgroundColor: bar <= level.bars ? level.color : colors.border },
              ]}
            />
          ))}
        </View>

        {/* Labels row */}
        <View style={styles.fuelBarLabels}>
          <Text style={[Typography.caption, { color: colors.textTertiary }]}>Empty</Text>
          <Text style={[Typography.caption, { color: level.color, fontWeight: '600' }]}>
            {level.label}{level.bars <= 1 ? ' ⚠️' : level.bars === 5 ? ' ✅' : ''}
          </Text>
          <Text style={[Typography.caption, { color: colors.textTertiary }]}>Full</Text>
        </View>

        <Text style={[Typography.bodySmall, { color: colors.text, fontWeight: '600', marginTop: Spacing.sm }]}>
          ≈ {level.remainingLitres.toFixed(1)} {level.unit} left · ~{level.kmRemaining.toLocaleString()} km range
        </Text>

        {tankDescription ? (
          <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
            {tankDescription}
          </Text>
        ) : null}
      </View>
    );
  }

  if (tip) {
    return (
      <View>
        <View style={styles.fuelBarHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            {icon}
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{title}</Text>
          </View>
        </View>
        <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>{tip}</Text>
        {tankDescription ? (
          <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
            {tankDescription}
          </Text>
        ) : null}
      </View>
    );
  }

  return null;
}

const EMPTY_CHECKED_LIST: string[] = [];

export default function HomeScreen() {
  const colors = useThemeColors();
  const router = useRouter();

  const params = useLocalSearchParams<{ vehicleId?: string; action?: string }>();
  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);
  const selectVehicle = useVehicleStore((s) => s.selectVehicle);
  const loadVehicles = useVehicleStore((s) => s.loadVehicles);

  useEffect(() => {
    if (params.vehicleId && params.vehicleId !== selectedVehicle?.id) {
      selectVehicle(params.vehicleId);
    }
  }, [params.vehicleId]);

  useEffect(() => {
    if (params.action === 'active_trip') {
      setShowActiveTripModal(true);
    } else if (params.action === 'start_trip') {
      setShowTripHistoryModal(true);
    } else if (params.action === 'manual_trip') {
      setShowManualTripModal(true);
    } else if (params.action === 'recover_trip') {
      recoverInterruptedTrips();
      setShowTripReviewModal(true);
    }
  }, [params.action]);

  const entries = useFuelStore((s) => s.entries);
  const stats = useFuelStore((s) => s.stats);
  const partialEstimates = useFuelStore((s) => s.partialEstimates);
  const loadEntries = useFuelStore((s) => s.loadEntries);

  const serviceRecords = useServiceStore((s) => s.records);
  const loadRecords = useServiceStore((s) => s.loadRecords);

  const expenses = useExpenseStore((s) => s.expenses);
  const loadExpenses = useExpenseStore((s) => s.loadExpenses);

  const documents = useDocumentStore((s) => s.documents);
  const expiringDocs = useDocumentStore((s) => s.expiringDocs);
  const loadDocuments = useDocumentStore((s) => s.loadDocuments);

  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [showProfilesModal, setShowProfilesModal] = useState(false);
  const [showTripHistoryModal, setShowTripHistoryModal] = useState(false);
  const [showActiveTripModal, setShowActiveTripModal] = useState(false);
  const [showTripReviewModal, setShowTripReviewModal] = useState(false);
  const [showManualTripModal, setShowManualTripModal] = useState(false);

  const checkedItemsByVehicle = useChecklistStore((s) => s.checkedItemsByVehicle);
  const checkedChecklistItems = (selectedVehicle && checkedItemsByVehicle[selectedVehicle.id]) || EMPTY_CHECKED_LIST;
  const loadChecklist = useChecklistStore((s) => s.loadChecklist);

  // ── P2 Trip & Profile Stores ──
  const trips = useTripStore((s) => s.trips);
  const activeTrip = useTripStore((s) => s.activeTrip);
  const recordingState = useTripStore((s) => s.recordingState);
  const liveMetrics = useTripStore((s) => s.liveMetrics);
  const loadTrips = useTripStore((s) => s.loadTrips);
  const startGpsTrip = useTripStore((s) => s.startGpsTrip);
  const pauseGpsTrip = useTripStore((s) => s.pauseGpsTrip);
  const resumeGpsTrip = useTripStore((s) => s.resumeGpsTrip);
  const cancelGpsTrip = useTripStore((s) => s.cancelGpsTrip);
  const recoverInterruptedTrips = useTripStore((s) => s.recoverInterruptedTrips);

  const loadProfiles = useMaintenanceProfileStore((s) => s.loadProfiles);

  // Recover any interrupted trips from previous app crashes on mount
  useEffect(() => {
    recoverInterruptedTrips();
  }, []);

  // ── Data loading ─────────────────────────────────────────────────────
  // useFocusEffect fires on initial mount AND every time this tab gains
  // focus (e.g. returning from History after an edit/delete).
  // Single hook — no redundant useEffect needed.
  const loadAll = useCallback(() => {
    // Always refresh vehicle list so current_odometer reflects latest DB value
    loadVehicles();
    if (selectedVehicle) {
      loadEntries(selectedVehicle.id);
      loadRecords(selectedVehicle.id);
      loadExpenses(selectedVehicle.id);
      loadDocuments(selectedVehicle.id);
      loadTrips(selectedVehicle.id);
      loadProfiles(selectedVehicle.id, selectedVehicle.current_odometer);
      // Note: loadChecklist is intentionally NOT here — AsyncStorage reads
      // are slow (~2-3s) and checklist data only needs to load when the
      // vehicle changes, not on every tab focus event.
    }
  }, [selectedVehicle?.id]);

  useFocusEffect(loadAll);

  // Load checklist state once per vehicle change (not on every tab focus).
  // AsyncStorage is significantly slower than SQLite, so keeping this
  // separate from useFocusEffect prevents tab-switch lag.
  useEffect(() => {
    if (selectedVehicle) {
      loadChecklist(selectedVehicle.id);
    }
  }, [selectedVehicle?.id]);

  // ── Pull-to-refresh ──────────────────────────────────────────────────
  // Loads are synchronous (SQLite), so the spinner is just brief feedback.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll();
    setTimeout(() => setRefreshing(false), 500);
  }, [loadAll]);

  // ── Pre-Trip Checklist Hook Calculations (must run before any conditional returns) ──
  const checklistItems = useMemo(() => {
    if (!selectedVehicle) return [];
    return buildPreTripChecklist(selectedVehicle, documents, checkedChecklistItems);
  }, [selectedVehicle, documents, checkedChecklistItems]);

  const checklistStats = useMemo(() => getChecklistStats(checklistItems), [checklistItems]);

  if (!selectedVehicle) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyEmoji]}>🚗</Text>
          <Text style={[Typography.h2, { color: colors.text }]}>No vehicles yet</Text>
          <Text style={[Typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm }]}>
            Add your first vehicle to start tracking!
          </Text>
          <TouchableOpacity
            style={[styles.addVehicleButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/add-vehicle')}
            activeOpacity={0.85}
          >
            <Text style={[Typography.button, { color: colors.textOnPrimary }]}>+ Add Vehicle</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const lastEntry = entries.length > 0 ? entries[0] : null;
  const lastService = serviceRecords.length > 0 ? serviceRecords[0] : null;
  const kmUntilService = getKmUntilService(selectedVehicle, lastService);

  const { total: monthlyTotal } = getCurrentMonthTotalSpend(entries, serviceRecords, expenses);

  const isBiFuelVehicle = isBiFuel(selectedVehicle.fuel_type as FuelType);
  const isPureCng = selectedVehicle.fuel_type === FuelType.CNG;
  const isEV = selectedVehicle.fuel_type === FuelType.ELECTRIC;
  const primaryUnit = (selectedVehicle.fuel_type === FuelType.CNG || isBiFuelVehicle)
    ? 'kg'
    : isEV
      ? 'kWh'
      : 'L';
  const tankName = isBiFuelVehicle
    ? `Primary ${getFuelSystemLabel(selectedVehicle.fuel_type as FuelType, 'primary')} Cylinder`
    : isEV
      ? 'Battery Pack'
      : 'Fuel Tank';

  const primarySystemLabel = isBiFuelVehicle
    ? getFuelSystemLabel(selectedVehicle.fuel_type as FuelType, 'primary')
    : 'Primary Tank';
  const secondarySystemLabel = isBiFuelVehicle
    ? getFuelSystemLabel(selectedVehicle.fuel_type as FuelType, 'secondary')
    : 'Secondary Tank';

  const primaryAvgMileage = isBiFuelVehicle
    ? (stats.primarySystemStats?.runningAverage?.value ?? stats.runningAverage?.value ?? null)
    : (stats.runningAverage?.value ?? null);

  const secondaryAvgMileage = isBiFuelVehicle
    ? (stats.secondarySystemStats?.runningAverage?.value ?? null)
    : null;

  // Primary fuel level estimate
  const primaryFuelLevel = estimateFuelLevel(
    entries,
    selectedVehicle.tank_capacity,
    selectedVehicle.current_odometer,
    primaryAvgMileage,
    primaryUnit,
    isBiFuelVehicle ? 'primary' : undefined
  );

  // Secondary fuel level estimate (for Bi-Fuel vehicles)
  const secondaryFuelLevel = isBiFuelVehicle && selectedVehicle.secondary_tank_capacity
    ? estimateFuelLevel(
      entries,
      selectedVehicle.secondary_tank_capacity,
      selectedVehicle.current_odometer,
      secondaryAvgMileage,
      'L',
      'secondary'
    )
    : null;

  /** Tips for why fuel/battery levels can't be shown yet */
  const primaryFuelLevelTip: string | null =
    primaryFuelLevel !== null
      ? null
      : !selectedVehicle.tank_capacity
        ? `Add your ${isBiFuelVehicle ? 'primary cylinder' : isEV ? 'battery' : 'tank'} capacity (Edit Vehicle) to see an estimated ${isEV ? 'battery' : 'fuel'} level.`
        : !primaryAvgMileage
          ? isEV
            ? 'Log two charge sessions to unlock the estimated battery level.'
            : `Log two full-tank fill-ups${isBiFuelVehicle ? ` for ${primarySystemLabel}` : ''} to unlock the estimated fuel level.`
          : null;

  const secondaryFuelLevelTip: string | null =
    !isBiFuelVehicle || secondaryFuelLevel !== null
      ? null
      : !selectedVehicle.secondary_tank_capacity
        ? `Add your fallback ${secondarySystemLabel} tank capacity (Edit Vehicle) to see estimated fuel level.`
        : !secondaryAvgMileage
          ? `Log two full-tank fill-ups for fallback ${secondarySystemLabel} to unlock estimated fuel level.`
          : null;

  // ── Inline rendering helpers ─────────────────────────────────────────

  /** Formats document expiry days into a user-facing string. */
  const docExpiryText = (days: number): string => {
    if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ago`;
    if (days === 0) return 'Expires today!';
    return `Expires in ${days} day${days !== 1 ? 's' : ''}`;
  };

  const serviceDueStatus = getServiceDueStatus(selectedVehicle, lastService);

  /** Returns bg/border/text color triplet for the dual-dimension service alert card. */
  const getServiceStatusTheme = (status: ServiceDueStatus) => {
    if (status.urgency === 'overdue') {
      return { bg: colors.dangerLight, border: colors.danger, text: colors.danger };
    }
    if (status.urgency === 'due_soon') {
      return { bg: colors.warningLight, border: colors.warning, text: colors.warning };
    }
    return { bg: colors.successLight, border: colors.success, text: colors.success };
  };

  // ── GPS Trip & Live Driving HUD Handlers ──
  const formatTripTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
  };

  const currentSpeedKmh = liveMetrics.currentSpeed !== null
    ? Math.round(liveMetrics.currentSpeed * 3.6)
    : 0;

  const handleStartGpsTrip = async () => {
    if (!selectedVehicle) return;
    const res = await startGpsTrip(selectedVehicle.id, selectedVehicle.current_odometer ?? undefined);
    if (res.success) {
      setShowActiveTripModal(true);
    } else {
      Alert.alert(
        'GPS Trip Recording',
        res.error || 'Failed to start GPS tracking. Please ensure location permissions are granted.'
      );
    }
  };

  const handleDiscardGpsTrip = () => {
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
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* ── Vehicle Context Header ── */}
        <VehicleContextHeader hideIfSingle />

        {/* ── Vehicle Header ── */}
        <View style={styles.vehicleHeader}>
          <Text style={[Typography.h1, { color: colors.text }]}>
            {selectedVehicle.nickname}
          </Text>
          <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
            {selectedVehicle.registration_number}
          </Text>
        </View>

        {/* ── Mileage Card ── */}
        <View style={[styles.mileageCard, { backgroundColor: colors.primary }]}>
          {stats.lastFillMileage ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={[styles.mileageLabel, { color: 'rgba(255,255,255,0.85)' }]}>
                  {isEV ? 'Last Charge Efficiency' : 'Last Fill Mileage'}
                </Text>
                {isBiFuelVehicle && lastEntry && (
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.22)', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {lastEntry.fuel_system === 'secondary' ? (
                      <Text style={{ fontSize: 11 }}>⛽</Text>
                    ) : (
                      <CngTankIcon size={12} color="#FFFFFF" showLabel={false} />
                    )}
                    <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                      {getFuelSystemLabel(selectedVehicle.fuel_type as FuelType, lastEntry.fuel_system ?? 'primary')}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[Typography.stat, { color: '#FFFFFF' }]}>
                {formatMileage(
                  stats.lastFillMileage.value,
                  MILEAGE_UNIT_LABELS[stats.lastFillMileage.unit]
                )}
              </Text>
              {stats.runningAverage && (
                <Text style={[Typography.bodySmall, { color: 'rgba(255,255,255,0.7)', marginTop: Spacing.xs }]}>
                  {isEV ? 'Running efficiency: ' : 'Running avg: '}
                  {formatMileage(
                    stats.runningAverage.value,
                    MILEAGE_UNIT_LABELS[stats.runningAverage.unit]
                  )}
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={[Typography.h3, { color: '#FFFFFF' }]}>
                {entries.length === 0
                  ? (isEV ? 'No charge sessions yet' : 'No fuel entries yet')
                  : 'Not enough data yet'}
              </Text>
              <Text style={[Typography.bodySmall, { color: 'rgba(255,255,255,0.7)', marginTop: Spacing.sm }]}>
                {entries.length === 0
                  ? (isEV ? 'Charge up and tap + to log your first session! ⚡' : 'Fill up and tap + to log your first refill! ⛽')
                  : (isEV ? 'Log one more charge session to calculate efficiency! ⚡' : 'One more full-tank fill and we can calculate your mileage! 🎉')}
              </Text>
            </>
          )}
        </View>

        {/* ── Estimated Fuel Level Bar(s) ── */}
        {(primaryFuelLevel || secondaryFuelLevel || primaryFuelLevelTip || secondaryFuelLevelTip) && (
          <View style={[styles.fuelBarCard, { backgroundColor: colors.surface, ...Sizing.cardShadow }]}>
            {/* Primary Fuel System (Gas/CNG, or Petrol/Diesel/EV for single-fuel) */}
            <FuelBarSection
              title={
                isBiFuelVehicle
                  ? `Est. ${primarySystemLabel} Level`
                  : selectedVehicle.fuel_type === FuelType.ELECTRIC
                    ? 'Est. Battery Level'
                    : 'Est. Fuel Level'
              }
              icon={
                isBiFuelVehicle || isPureCng ? (
                  <CngTankIcon size={15} color={colors.primary} />
                ) : selectedVehicle.fuel_type === FuelType.ELECTRIC ? (
                  <Text style={{ fontSize: 13 }}>⚡</Text>
                ) : (
                  <Text style={{ fontSize: 13 }}>⛽</Text>
                )
              }
              level={primaryFuelLevel}
              tip={primaryFuelLevelTip}
              tankDescription={
                selectedVehicle.tank_capacity
                  ? `Est. based on avg mileage · ${tankName}: ${selectedVehicle.tank_capacity} ${primaryUnit}`
                  : undefined
              }
              colors={colors}
            />

            {/* Secondary Fuel System for Bi-Fuel / Hybrid */}
            {isBiFuelVehicle && (
              <View style={{ marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
                <FuelBarSection
                  title={`Est. Fallback ${secondarySystemLabel} Level`}
                  icon={<Text style={{ fontSize: 13 }}>⛽</Text>}
                  level={secondaryFuelLevel}
                  tip={secondaryFuelLevelTip}
                  tankDescription={
                    selectedVehicle.secondary_tank_capacity
                      ? `Est. based on avg mileage · Fallback ${secondarySystemLabel} Tank: ${selectedVehicle.secondary_tank_capacity} L`
                      : undefined
                  }
                  colors={colors}
                />
              </View>
            )}
          </View>
        )}

        {/* ── Document Expiry Warnings ── */}
        {expiringDocs.length > 0 && (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/documents')}
            style={[styles.expiryBanner, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}
            activeOpacity={0.7}
          >
            <Text style={[Typography.body, { color: colors.danger, fontWeight: '700', marginBottom: Spacing.xs }]}>
              ⚠️ Document Alert
            </Text>
            {expiringDocs.map((doc) => {
              const days = daysUntil(doc.expiry_date!);
              const label = DOCUMENT_TYPE_LABELS[doc.type as keyof typeof DOCUMENT_TYPE_LABELS] || doc.type;
              return (
                <Text key={doc.id} style={[Typography.bodySmall, { color: colors.danger }]}>
                  {label}: {docExpiryText(days)}
                </Text>
              );
            })}
            <Text style={[Typography.caption, { color: colors.danger, marginTop: Spacing.xs, opacity: 0.7 }]}>
              Tap to view documents →
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Vehicle Vitals (Odometer, Last Fill, Last Service, Spend) ── */}
        <View style={[styles.vitalsCard, { backgroundColor: colors.surface, borderColor: colors.borderLight, ...Sizing.cardShadow }]}>
          <View style={styles.vitalsRow}>
            <View style={styles.vitalItem}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Odometer</Text>
              <Text style={[Typography.statMedium, { color: colors.text, marginTop: 2 }]}>
                {selectedVehicle.current_odometer
                  ? formatOdometer(selectedVehicle.current_odometer)
                  : '—'}
              </Text>
            </View>
            <View style={[styles.vitalDivider, { backgroundColor: colors.borderLight }]} />
            <View style={styles.vitalItem}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                {isEV ? 'Last Charge' : 'Last Fill'}
              </Text>
              <Text style={[Typography.statMedium, { color: colors.text, marginTop: 2 }]} numberOfLines={1}>
                {lastEntry ? formatDisplayDateLong(lastEntry.date) : '—'}
              </Text>
            </View>
          </View>
          <View style={[styles.vitalHorizontalDivider, { backgroundColor: colors.borderLight }]} />
          <View style={styles.vitalsRow}>
            <View style={styles.vitalItem}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Last Service</Text>
              <Text style={[Typography.statMedium, { color: colors.text, marginTop: 2 }]} numberOfLines={1}>
                {lastService ? formatDisplayDateLong(lastService.date) : '—'}
              </Text>
              {lastService && (
                <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 1 }]} numberOfLines={1}>
                  {lastService.service_type}
                </Text>
              )}
            </View>
            <View style={[styles.vitalDivider, { backgroundColor: colors.borderLight }]} />
            <View style={styles.vitalItem}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Spend (This Month)</Text>
              <Text style={[Typography.statMedium, { color: monthlyTotal > 0 ? colors.accent : colors.text, marginTop: 2 }]}>
                {monthlyTotal > 0 ? formatCurrency(monthlyTotal) : '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Dual-Dimension Service Status: Only shown when Overdue ── */}
        {serviceDueStatus.urgency === 'overdue' && (
          <View style={[styles.serviceAlertCard, { backgroundColor: colors.dangerLight ?? '#FEE2E2', borderColor: colors.danger }]}>
            {/* Top Badge Strip: Action Required + Vehicle Context */}
            <View style={styles.serviceAlertTopRow}>
              <View style={[styles.serviceAlertPill, { backgroundColor: colors.danger }]}>
                <Text style={styles.serviceAlertPillText}>⚠️ ACTION REQUIRED</Text>
              </View>
              <Text style={[Typography.caption, { color: colors.danger, fontWeight: '700' }]} numberOfLines={1}>
                {selectedVehicle.nickname} · Regular Service
              </Text>
            </View>

            {/* Clear Headline */}
            <Text style={[Typography.body, { color: colors.danger, fontWeight: '800', marginTop: Spacing.xs }]}>
              {serviceDueStatus.headline.replace(/^[^\w]+/, '')}
            </Text>

            {/* Clear Subtext explaining odometer/time breach */}
            <Text style={[Typography.bodySmall, { color: colors.text, marginTop: 4, lineHeight: 19 }]}>
              {serviceDueStatus.subtext}
            </Text>

            {/* Explicit Action Button */}
            <TouchableOpacity
              style={[styles.serviceAlertActionBtn, { backgroundColor: colors.danger }]}
              onPress={() => router.push({ pathname: '/add-service', params: { vehicleId: selectedVehicle.id } })}
              activeOpacity={0.8}
            >
              <Text style={styles.serviceAlertActionBtnText}>
                Log Service Record →
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Tyre Pressure Recommendation ── */}
        {(selectedVehicle.front_tyre_pressure != null || selectedVehicle.rear_tyre_pressure != null) && (
          <View style={[styles.tyrePressureCard, { backgroundColor: colors.surface, ...Sizing.cardShadow }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary, marginBottom: Spacing.sm }]}>
              🚨 Recommended Tyre Pressure
            </Text>
            <View style={styles.tyrePressureRow}>
              {selectedVehicle.front_tyre_pressure != null && (
                <View style={styles.tyrePressureItem}>
                  <Text style={[Typography.caption, { color: colors.textTertiary }]}>Front</Text>
                  <Text style={[Typography.statMedium, { color: colors.text }]}>
                    {convertPressure(selectedVehicle.front_tyre_pressure)} {getPressureLabel()}
                  </Text>
                </View>
              )}
              {selectedVehicle.rear_tyre_pressure != null && (
                <View style={styles.tyrePressureItem}>
                  <Text style={[Typography.caption, { color: colors.textTertiary }]}>Rear</Text>
                  <Text style={[Typography.statMedium, { color: colors.text }]}>
                    {convertPressure(selectedVehicle.rear_tyre_pressure)} {getPressureLabel()}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── LIVE DRIVING HUD CARD (When Trip is In-Progress or Paused) ── */}
        {activeTrip ? (
          <View
            style={[
              styles.activeTripHudCard,
              {
                backgroundColor: colors.surface,
                borderColor: recordingState === 'paused' ? colors.warning : colors.primary,
                ...Sizing.cardShadow,
              },
            ]}
          >
            {/* Top Status Header */}
            <View style={styles.hudHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View
                  style={[
                    styles.hudLivePulse,
                    { backgroundColor: recordingState === 'paused' ? colors.warning : colors.danger },
                  ]}
                />
                <Text style={[Typography.bodySmall, { color: colors.text, fontWeight: '700' }]}>
                  {recordingState === 'paused' ? 'Trip Paused' : 'Recording Trip'}
                </Text>
              </View>

              {/* GPS Signal Quality Badge */}
              <View
                style={[
                  styles.hudGpsBadge,
                  {
                    backgroundColor:
                      liveMetrics.gpsQuality === 'good'
                        ? colors.successLight
                        : liveMetrics.gpsQuality === 'fair'
                        ? colors.warningLight
                        : colors.dangerLight,
                  },
                ]}
              >
                <Text
                  style={[
                    Typography.caption,
                    {
                      color:
                        liveMetrics.gpsQuality === 'good'
                          ? colors.success
                          : liveMetrics.gpsQuality === 'fair'
                          ? colors.warning
                          : colors.danger,
                      fontWeight: '700',
                    },
                  ]}
                >
                  {liveMetrics.gpsQuality === 'good'
                    ? `🟢 GPS Good (${Math.round(liveMetrics.currentAccuracy ?? 0)}m)`
                    : liveMetrics.gpsQuality === 'fair'
                    ? `🟡 GPS Fair (${Math.round(liveMetrics.currentAccuracy ?? 0)}m)`
                    : '🔴 Acquiring GPS...'}
                </Text>
              </View>
            </View>

            {/* Vehicle context subtext */}
            <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: Spacing.xs }]}>
              Recording route for <Text style={{ fontWeight: '700', color: colors.text }}>{selectedVehicle.nickname}</Text> · {liveMetrics.samplesCount} GPS points logged
            </Text>

            {/* Main HUD Metrics Row */}
            <View style={[styles.hudMetricsContainer, { backgroundColor: colors.background, borderColor: colors.borderLight }]}>
              {/* Distance */}
              <View style={styles.hudMetricCol}>
                <Text style={[Typography.caption, { color: colors.textSecondary }]}>DISTANCE</Text>
                <Text style={[styles.hudBigNumber, { color: colors.primary }]}>
                  {liveMetrics.distanceKm.toFixed(2)}
                </Text>
                <Text style={[Typography.caption, { color: colors.primary, fontWeight: '700' }]}>KM</Text>
              </View>

              <View style={[styles.hudMetricDivider, { backgroundColor: colors.borderLight }]} />

              {/* Speed */}
              <View style={styles.hudMetricCol}>
                <Text style={[Typography.caption, { color: colors.textSecondary }]}>SPEED</Text>
                <Text style={[styles.hudMedNumber, { color: colors.text }]}>
                  {currentSpeedKmh}
                </Text>
                <Text style={[Typography.caption, { color: colors.textSecondary }]}>km/h</Text>
              </View>

              <View style={[styles.hudMetricDivider, { backgroundColor: colors.borderLight }]} />

              {/* Time */}
              <View style={styles.hudMetricCol}>
                <Text style={[Typography.caption, { color: colors.textSecondary }]}>ELAPSED</Text>
                <Text style={[styles.hudMedNumber, { color: colors.text }]}>
                  {formatTripTime(liveMetrics.elapsedSeconds)}
                </Text>
                <Text style={[Typography.caption, { color: colors.textSecondary }]}>time</Text>
              </View>
            </View>

            {/* Direct Action Controls Right On The Dashboard */}
            <View style={styles.hudActionButtonsRow}>
              {/* Pause / Resume */}
              {recordingState === 'recording' ? (
                <TouchableOpacity
                  style={[styles.hudSecondaryActionBtn, { borderColor: colors.warning, backgroundColor: colors.warningLight }]}
                  onPress={pauseGpsTrip}
                  activeOpacity={0.8}
                >
                  <Text style={[Typography.button, { color: colors.warning, fontSize: 13 }]}>
                    ⏸️ Pause
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.hudSecondaryActionBtn, { borderColor: colors.primary, backgroundColor: colors.primaryLight }]}
                  onPress={resumeGpsTrip}
                  activeOpacity={0.8}
                >
                  <Text style={[Typography.button, { color: colors.primary, fontSize: 13 }]}>
                    ▶️ Resume
                  </Text>
                </TouchableOpacity>
              )}

              {/* End & Save Trip */}
              <TouchableOpacity
                style={[styles.hudPrimaryActionBtn, { backgroundColor: colors.danger }]}
                onPress={() => setShowTripReviewModal(true)}
                activeOpacity={0.85}
              >
                <Text style={[Typography.button, { color: '#FFFFFF', fontSize: 14 }]}>
                  🏁 End & Save Trip
                </Text>
              </TouchableOpacity>
            </View>

            {/* Secondary links: Expand Fullscreen HUD & Discard */}
            <View style={styles.hudSecondaryRow}>
              <TouchableOpacity
                onPress={() => setShowActiveTripModal(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[Typography.bodySmall, { color: colors.primary, fontWeight: '700' }]}>
                  📱 Speedometer View →
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleDiscardGpsTrip}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[Typography.caption, { color: colors.danger, fontWeight: '600' }]}>
                  Discard Trip
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* ── GPS TRIP TRACKER CARD (Clean & Minimal) ── */
          <View
            style={[
              styles.gpsLauncherCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderLight,
                ...Sizing.cardShadow,
              },
            ]}
          >
            {/* Header: Icon + Title + 100% Offline Badge */}
            <View style={styles.gpsLauncherHeader}>
              <View style={[styles.toolIconWrap, { backgroundColor: colors.primaryLight ?? (colors.primary + '18') }]}>
                <Text style={{ fontSize: 20 }}>📍</Text>
              </View>
              <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={[Typography.body, { color: colors.text, fontWeight: '700', fontSize: 16 }]}>
                    GPS Trip Tracker
                  </Text>
                  <View style={[styles.offlineBadge, { backgroundColor: colors.successLight }]}>
                    <Text style={[Typography.caption, { color: colors.success, fontWeight: '700', fontSize: 10 }]}>
                      100% Offline
                    </Text>
                  </View>
                </View>
                <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                  Track driving route, live speed, and distance.
                </Text>
              </View>
            </View>

            {/* Primary Start Button */}
            <TouchableOpacity
              style={[styles.startGpsPrimaryBtn, { backgroundColor: colors.primary }]}
              onPress={handleStartGpsTrip}
              activeOpacity={0.85}
            >
              <Text style={{ fontSize: 16, marginRight: 8 }}>▶️</Text>
              <Text style={[Typography.button, { color: colors.primaryText, fontSize: 15 }]}>
                Start GPS Trip
              </Text>
            </TouchableOpacity>

            {/* Sub-actions: Manual Trip & History */}
            <View style={styles.gpsLauncherLinksRow}>
              <TouchableOpacity
                style={styles.gpsLauncherSubLink}
                onPress={() => setShowManualTripModal(true)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[Typography.caption, { color: colors.textSecondary, fontWeight: '600' }]}>
                  ✍️ Log Manual Trip
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.gpsLauncherSubLink}
                onPress={() => setShowTripHistoryModal(true)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[Typography.caption, { color: colors.primary, fontWeight: '700' }]}>
                  Trip History ({trips.length}) →
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Quick Tools Grid: Targets & Highway Checks ── */}
        <View style={styles.quickToolsGrid}>
          <TouchableOpacity
            style={[styles.toolGridCard, { backgroundColor: colors.surface, borderColor: colors.borderLight, ...Sizing.cardShadow }]}
            onPress={() => setShowProfilesModal(true)}
            activeOpacity={0.75}
          >
            <View style={styles.toolCardTop}>
              <View style={[styles.toolIconWrap, { backgroundColor: colors.accentLight ?? (colors.accent + '18') }]}>
                <Text style={{ fontSize: 20 }}>🎯</Text>
              </View>
              <Text style={[styles.toolCardArrow, { color: colors.accent }]}>→</Text>
            </View>
            <Text style={[Typography.body, { color: colors.text, fontWeight: '700', marginTop: Spacing.sm }]}>
              Targets
            </Text>
            <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: 2, lineHeight: 16 }]}>
              Custom intervals
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolGridCard, { backgroundColor: colors.surface, borderColor: colors.borderLight, ...Sizing.cardShadow }]}
            onPress={() => setShowChecklistModal(true)}
            activeOpacity={0.75}
          >
            <View style={styles.toolCardTop}>
              <View style={[styles.toolIconWrap, { backgroundColor: colors.successLight ?? (colors.success + '18') }]}>
                <Text style={{ fontSize: 20 }}>🛣️</Text>
              </View>
              <Text style={[styles.toolCardArrow, { color: colors.success }]}>→</Text>
            </View>
            <Text style={[Typography.body, { color: colors.text, fontWeight: '700', marginTop: Spacing.sm }]}>
              Highway Checks
            </Text>
            <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: 2, lineHeight: 16 }]}>
              {checklistStats.isComplete ? 'Ready ✅' : `${checklistStats.completed}/${checklistStats.total} inspected`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Smart Maintenance & Mileage Insights (Part A) ── */}
        <SmartInsightsCard
          vehicle={selectedVehicle}
          onOpenProfiles={() => setShowProfilesModal(true)}
          onOpenTrips={() => setShowTripHistoryModal(true)}
        />

        {/* ── Highway Road Trip Readiness Checklist (Feature 4.3) ── */}
        <TouchableOpacity
          style={[
            styles.checklistCard,
            {
              backgroundColor: colors.surface,
              borderColor: checklistStats.isComplete ? colors.success : colors.borderLight,
              ...Sizing.cardShadow,
            },
          ]}
          onPress={() => setShowChecklistModal(true)}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <Text style={{ fontSize: 16 }}>🛣️</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Highway Trip Readiness
              </Text>
            </View>
            <View
              style={{
                backgroundColor: checklistStats.isComplete ? colors.successLight : colors.primaryLight,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: checklistStats.isComplete ? colors.success : colors.primary,
                }}
              >
                {checklistStats.isComplete ? 'Ready ✅' : `${checklistStats.completed}/${checklistStats.total} Checks`}
              </Text>
            </View>
          </View>

          <Text style={[Typography.bodySmall, { color: colors.text, fontWeight: '600', marginTop: 2 }]}>
            {checklistStats.isComplete
              ? 'Vehicle is 100% inspected and ready for highway driving.'
              : 'Inspect tyre PSI, engine oil, stepney, PUC & FASTag.'}
          </Text>

          {/* Mini progress bar */}
          <View style={[styles.miniProgressTrack, { backgroundColor: colors.borderLight, marginTop: Spacing.sm }]}>
            <View
              style={[
                styles.miniProgressBar,
                {
                  width: `${checklistStats.percent}%`,
                  backgroundColor: checklistStats.isComplete ? colors.success : colors.primary,
                },
              ]}
            />
          </View>
        </TouchableOpacity>

        {/* ── Recent Entries ── */}
        {entries.length > 0 && (
          <View style={styles.section}>
            <Text style={[Typography.h3, { color: colors.text, marginBottom: Spacing.md }]}>
              Recent Fuel Entries
            </Text>
            {entries.slice(0, 5).map((entry) => {
              const estimate = partialEstimates[entry.id];
              // Resolve unit label once per entry (e.g. "km/L", "km/kg", "km/kWh")
              const mileageUnitLabel = entry.mileage_unit
                ? MILEAGE_UNIT_LABELS[entry.mileage_unit]
                : '';
              return (
                <View
                  key={entry.id}
                  style={[styles.entryRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.entryLeft}>
                    <Text style={[Typography.body, { color: colors.text, fontWeight: '600' }]}>
                      {formatDisplayDateLong(entry.date)}
                    </Text>
                    <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
                      {entry.fuel_amount} {entry.fuel_unit} · {formatCurrency(entry.total_cost)}
                    </Text>
                  </View>
                  <View style={styles.entryRight}>
                    {entry.calculated_mileage ? (
                      // Accurate mileage — show value + unit
                      <Text style={[Typography.body, { color: colors.success, fontWeight: '700' }]}>
                        {entry.calculated_mileage.toFixed(1)} {mileageUnitLabel}
                      </Text>
                    ) : estimate ? (
                      // Estimated (partial fill) — show with ~ prefix and est. label
                      <>
                        <Text style={[Typography.body, { color: colors.warning, fontWeight: '700' }]}>
                          ~{estimate.value.toFixed(1)} {MILEAGE_UNIT_LABELS[estimate.unit]}
                        </Text>
                        <Text style={[Typography.caption, { color: colors.textTertiary }]}>est.</Text>
                      </>
                    ) : (
                      // First fill or partial with no prior full tank
                      <Text style={[Typography.bodySmall, { color: colors.textTertiary }]}>
                        {entry.is_full_tank === 1 ? '—' : 'Partial'}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Bottom padding for FAB */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── FAB: Add Fuel / Add Charge (biggest button on screen) ── */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.accent }]}
        activeOpacity={0.85}
        onPress={() => router.push('/add-fuel')}
      >
        <View style={styles.fabIconContainer}>
          {isEV ? (
            <Text style={styles.fabIcon}>⚡</Text>
          ) : isPureCng ? (
            <CngTankIcon size={18} color="#1A1C1E" showLabel={false} />
          ) : (
            <Text style={styles.fabIcon}>⛽</Text>
          )}
        </View>
        <Text style={[styles.fabText, { color: '#1A1C1E' }]}>
          {isEV ? 'Add Charge' : isPureCng ? 'Add CNG' : 'Add Fuel'}
        </Text>
      </TouchableOpacity>

      {/* ── Pre-Trip Highway Checklist Modal (Feature 4.3) ── */}
      {showChecklistModal && (
        <PreTripChecklistModal
          visible={showChecklistModal}
          onClose={() => setShowChecklistModal(false)}
          vehicle={selectedVehicle}
          documents={documents}
        />
      )}

      {/* ── Maintenance Profiles & Targets Modal (Part B) ── */}
      {showProfilesModal && (
        <MaintenanceProfilesModal
          visible={showProfilesModal}
          vehicle={selectedVehicle}
          onClose={() => setShowProfilesModal(false)}
        />
      )}

      {/* ── Trip History Modal (Part C & D) ── */}
      {showTripHistoryModal && (
        <TripHistoryModal
          visible={showTripHistoryModal}
          vehicle={selectedVehicle}
          onStartGpsTrip={async () => {
            setShowTripHistoryModal(false);
            const res = await startGpsTrip(selectedVehicle.id, selectedVehicle.current_odometer ?? undefined);
            if (res.success) {
              setShowActiveTripModal(true);
            } else {
              Alert.alert('GPS Recording', res.error || 'Failed to start GPS tracking.');
            }
          }}
          onLogManualTrip={() => {
            setShowTripHistoryModal(false);
            setShowManualTripModal(true);
          }}
          onClose={() => setShowTripHistoryModal(false)}
        />
      )}

      {/* ── Active GPS Trip HUD (Part C) ── */}
      {showActiveTripModal && (
        <ActiveTripModal
          visible={showActiveTripModal}
          vehicle={selectedVehicle}
          onFinish={() => {
            setShowActiveTripModal(false);
            setShowTripReviewModal(true);
          }}
          onClose={() => setShowActiveTripModal(false)}
        />
      )}

      {/* ── Trip Review & Save Modal (Part C6) ── */}
      {showTripReviewModal && (
        <TripReviewModal
          visible={showTripReviewModal}
          vehicle={selectedVehicle}
          onSaved={() => {
            setShowTripReviewModal(false);
            loadTrips(selectedVehicle.id);
          }}
          onCancel={() => {
            setShowTripReviewModal(false);
            setShowActiveTripModal(true);
          }}
        />
      )}

      {/* ── Manual Trip Modal (Part D1) ── */}
      {showManualTripModal && (
        <ManualTripModal
          visible={showManualTripModal}
          vehicle={selectedVehicle}
          onSaved={() => {
            setShowManualTripModal(false);
            loadTrips(selectedVehicle.id);
          }}
          onClose={() => setShowManualTripModal(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  // ── Vehicle Header ──
  vehicleHeader: {
    marginBottom: Spacing.xl,
  },
  // ── Mileage Card ──
  mileageCard: {
    borderRadius: Sizing.radiusLg,
    padding: Spacing.xxl,
    marginBottom: Spacing.lg,
    minHeight: 140,
    justifyContent: 'center',
  },
  mileageLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // ── Stats / Vitals Card ──
  vitalsCard: {
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  vitalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  vitalItem: {
    flex: 1,
    paddingHorizontal: Spacing.sm,
  },
  vitalDivider: {
    width: 1,
    height: '70%',
    marginHorizontal: Spacing.xs,
  },
  vitalHorizontalDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    marginVertical: Spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    borderRadius: Sizing.radiusMd,
    padding: Spacing.lg,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  // ── Fuel Bar ──
  fuelBarCard: {
    borderRadius: Sizing.radiusMd,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  fuelBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  fuelBarsRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: Spacing.xs,
  },
  fuelBarSegment: {
    flex: 1,
    height: 20,
    borderRadius: 4,
  },
  fuelBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  // ── Service Overdue Alert Card ──
  serviceAlertCard: {
    borderRadius: Sizing.radiusMd,
    borderWidth: 1.5,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  serviceAlertTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  serviceAlertPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  serviceAlertPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  serviceAlertActionBtn: {
    marginTop: Spacing.md,
    paddingVertical: 10,
    paddingHorizontal: Spacing.lg,
    borderRadius: Sizing.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceAlertActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  // ── Section ──
  section: {
    marginBottom: Spacing.xxl,
  },
  // ── Entry Row ──
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  entryLeft: {
    flex: 1,
  },
  entryRight: {
    marginLeft: Spacing.md,
    alignItems: 'flex-end',
  },
  // ── FAB ──
  fab: {
    position: 'absolute',
    bottom: Spacing.xxl,
    right: Spacing.lg,
    height: Sizing.fab,
    borderRadius: Sizing.radiusFull,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    gap: Spacing.sm,
  },
  fabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabIcon: {
    fontSize: 22,
  },
  fabText: {
    fontSize: 16,
    fontWeight: '700',
  },
  // ── Empty State ──
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxxl,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: Spacing.lg,
  },
  addVehicleButton: {
    marginTop: Spacing.xxl,
    height: Sizing.primaryButton,
    borderRadius: Sizing.radiusMd,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
  // ── Expiry Banner ──
  expiryBanner: {
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  // ── Tyre Pressure ──
  tyrePressureCard: {
    borderRadius: Sizing.radiusMd,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  tyrePressureRow: {
    flexDirection: 'row',
    gap: Spacing.xxl,
  },
  tyrePressureItem: {
    alignItems: 'center',
  },
  // ── Road Trip Checklist ──
  checklistCard: {
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  miniProgressTrack: {
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  miniProgressBar: {
    height: '100%',
    borderRadius: 2.5,
  },
  activeTripBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: Sizing.radiusLg,
    borderWidth: 1.5,
    marginBottom: Spacing.md,
    ...Sizing.cardShadow,
  },
  // ── Live Driving HUD Card (Dashboard) ──
  activeTripHudCard: {
    borderRadius: Sizing.radiusLg,
    borderWidth: 2,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  hudHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hudLivePulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  hudGpsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  hudMetricsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  hudMetricCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudBigNumber: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 32,
    letterSpacing: -0.5,
  },
  hudMedNumber: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 26,
  },
  hudMetricDivider: {
    width: 1,
    height: 36,
  },
  hudActionButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  hudPrimaryActionBtn: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: Sizing.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudSecondaryActionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudSecondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.xs,
  },
  // ── GPS Launcher Card (Idle State) ──
  gpsLauncherCard: {
    borderRadius: Sizing.radiusLg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  gpsLauncherHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  offlineBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Sizing.radiusFull,
  },
  startGpsPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: Sizing.radiusMd,
    marginBottom: Spacing.sm,
  },
  gpsLauncherLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
    paddingHorizontal: 4,
  },
  gpsLauncherSubLink: {
    paddingVertical: 4,
  },
  quickToolsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  toolGridCard: {
    flex: 1,
    borderRadius: Sizing.radiusLg,
    borderWidth: 1,
    padding: Spacing.md,
    minHeight: 104,
    justifyContent: 'space-between',
  },
  toolCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toolIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolCardArrow: {
    fontSize: 16,
    fontWeight: '700',
  },
});
