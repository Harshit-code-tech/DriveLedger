/**
 * DriveLedger — Home Page (Automotive Cockpit)
 *
 * Implemented according to docs/refurnish/home.md:
 * 1. App Header (HomeHeader)
 * 2. Vehicle Selector (HomeVehicleSelector)
 * 3. GPS Cockpit (HomeGpsCockpit — isolated GPS subscriptions)
 * 4. Vehicle Overview (HomeVehicleOverview — 2x2 grid)
 * 5. Needs Attention (HomeNeedsAttention — service alerts & expiring docs)
 * 6. Vehicle Essentials (HomeVehicleEssentials — fuel/battery & tyre pressures)
 * 7. Quick Access (HomeQuickAccess — targets, checklist, fuel/expense shortcuts)
 *
 * All database queries, stores, deep links, and widget coordination are preserved.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Domain Stores & Services
import { useVehicleStore } from '@/stores/vehicleStore';
import { useFuelStore } from '@/stores/fuelStore';
import { useServiceStore, getServiceDueStatus } from '@/stores/serviceStore';
import { useExpenseStore } from '@/stores/expenseStore';
import { useDocumentStore } from '@/stores/documentStore';
import { useTripStore } from '@/stores/tripStore';
import { useMaintenanceProfileStore } from '@/stores/maintenanceProfileStore';
import { useChecklistStore, buildPreTripChecklist, getChecklistStats } from '@/stores/checklistStore';
import { dataRevisionTracker } from '@/services/dataRevisionTracker';
import {
  showPostTripFuelPrompt,
  getAndClearPendingPostTripPrompt,
  resolveTripEndOdometer,
} from '@/services/postTripFuelPromptService';

// Helpers & Types
import { FuelType, isBiFuel, isElectricFuel, getFuelSystemLabel } from '@/constants/fuelTypes';
import { estimateFuelLevel, getCurrentMonthTotalSpend } from '@/utils/statsHelpers';
import { Spacing } from '@/constants/theme';

// Theme & Sub-components
import { useHomeColors } from '@/components/home/homeTheme';
import { HomeVehicleSelector } from '@/components/home/HomeVehicleSelector';
import { HomeGpsCockpit } from '@/components/home/HomeGpsCockpit';
import { HomeVehicleOverview } from '@/components/home/HomeVehicleOverview';
import { HomeNeedsAttention } from '@/components/home/HomeNeedsAttention';
import { HomeVehicleEssentials } from '@/components/home/HomeVehicleEssentials';
import { HomeQuickAccess } from '@/components/home/HomeQuickAccess';

// Modals
import { PreTripChecklistModal } from '@/components/PreTripChecklistModal';
import { MaintenanceProfilesModal } from '@/components/MaintenanceProfilesModal';
import { TripHistoryModal } from '@/components/TripHistoryModal';
import { ActiveTripModal } from '@/components/ActiveTripModal';
import { TripReviewModal } from '@/components/TripReviewModal';
import { ManualTripModal } from '@/components/ManualTripModal';

const EMPTY_CHECKED_LIST: string[] = [];

export default function HomeScreen() {
  const colors = useHomeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ vehicleId?: string; action?: string }>();

  // ── Vehicle Store ──
  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);
  const selectVehicle = useVehicleStore((s) => s.selectVehicle);
  const loadVehicles = useVehicleStore((s) => s.loadVehicles);

  useEffect(() => {
    if (params.vehicleId && params.vehicleId !== selectedVehicle?.id) {
      selectVehicle(params.vehicleId);
    }
  }, [params.vehicleId]);

  // ── Domain Stores ──
  const entries = useFuelStore((s) => s.entries);
  const stats = useFuelStore((s) => s.stats);
  const loadEntries = useFuelStore((s) => s.loadEntries);

  const serviceRecords = useServiceStore((s) => s.records);
  const loadRecords = useServiceStore((s) => s.loadRecords);

  const expenses = useExpenseStore((s) => s.expenses);
  const loadExpenses = useExpenseStore((s) => s.loadExpenses);

  const documents = useDocumentStore((s) => s.documents);
  const expiringDocs = useDocumentStore((s) => s.expiringDocs);
  const loadDocuments = useDocumentStore((s) => s.loadDocuments);

  const loadTrips = useTripStore((s) => s.loadTrips);
  const loadProfiles = useMaintenanceProfileStore((s) => s.loadProfiles);
  const recoverInterruptedTrips = useTripStore((s) => s.recoverInterruptedTrips);

  // ── Checklist Store ──
  const checkedItemsByVehicle = useChecklistStore((s) => s.checkedItemsByVehicle);
  const checkedChecklistItems =
    (selectedVehicle && checkedItemsByVehicle[selectedVehicle.id]) || EMPTY_CHECKED_LIST;
  const loadChecklist = useChecklistStore((s) => s.loadChecklist);

  // ── Modal State ──
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [showProfilesModal, setShowProfilesModal] = useState(false);
  const [showTripHistoryModal, setShowTripHistoryModal] = useState(false);
  const [showActiveTripModal, setShowActiveTripModal] = useState(false);
  const [showTripReviewModal, setShowTripReviewModal] = useState(false);
  const [showManualTripModal, setShowManualTripModal] = useState(false);

  // Stable modal openers (prevents React.memo downstream re-renders)
  const handleOpenChecklistModal = useCallback(() => setShowChecklistModal(true), []);
  const handleOpenProfilesModal = useCallback(() => setShowProfilesModal(true), []);
  const handleOpenTripHistoryModal = useCallback(() => setShowTripHistoryModal(true), []);
  const handleOpenActiveTripModal = useCallback(() => setShowActiveTripModal(true), []);
  const handleOpenTripReviewModal = useCallback(() => setShowTripReviewModal(true), []);
  const handleOpenManualTripModal = useCallback(() => setShowManualTripModal(true), []);

  // Interrupted trip recovery on app start
  useEffect(() => {
    recoverInterruptedTrips();
  }, [recoverInterruptedTrips]);

  // ── Deep Link Actions (Widgets & Shortcuts) ──
  const lastProcessedActionKey = useRef<string | null>(null);

  useEffect(() => {
    if (!params.action) {
      lastProcessedActionKey.current = null;
      return;
    }

    const actionKey = `${params.action}_${params.vehicleId || ''}`;
    if (lastProcessedActionKey.current === actionKey) {
      return;
    }
    lastProcessedActionKey.current = actionKey;

    const currentAction = params.action;
    const targetVehicleId =
      params.vehicleId ||
      selectedVehicle?.id ||
      useVehicleStore.getState().selectedVehicle?.id ||
      useVehicleStore.getState().vehicles[0]?.id;

    router.setParams({ action: undefined, vehicleId: undefined });

    if (targetVehicleId && targetVehicleId !== selectedVehicle?.id) {
      selectVehicle(targetVehicleId);
    }

    if (currentAction === 'active_trip' || currentAction === 'gps_trip') {
      const currentActiveTrip = useTripStore.getState().activeTrip;
      if (currentActiveTrip) {
        if (selectedVehicle?.id !== currentActiveTrip.vehicle_id) {
          selectVehicle(currentActiveTrip.vehicle_id);
        }
        setShowActiveTripModal(true);
      } else {
        setShowTripHistoryModal(true);
      }
    } else if (currentAction === 'trip_history') {
      setShowTripHistoryModal(true);
    } else if (currentAction === 'start_trip' || currentAction === 'start_gps') {
      const currentRecState = useTripStore.getState().recordingState;
      if (currentRecState === 'recording' || currentRecState === 'paused') {
        setShowActiveTripModal(true);
      } else if (targetVehicleId) {
        useTripStore.getState().startGpsTrip(targetVehicleId).then((res) => {
          if (res.success) {
            setShowActiveTripModal(true);
          } else {
            const currentTrip = useTripStore.getState().activeTrip;
            if (currentTrip) {
              setShowActiveTripModal(true);
            } else {
              setShowTripHistoryModal(true);
            }
          }
        });
      } else {
        setShowTripHistoryModal(true);
      }
    } else if (currentAction === 'resume_gps' || currentAction === 'resume_trip') {
      const currentRecState = useTripStore.getState().recordingState;
      if (currentRecState === 'paused') {
        useTripStore.getState().resumeGpsTrip().then(() => {
          setShowActiveTripModal(true);
        });
      } else {
        setShowActiveTripModal(true);
      }
    } else if (currentAction === 'trip_review') {
      const currentActiveTrip = useTripStore.getState().activeTrip;
      if (currentActiveTrip && selectedVehicle?.id !== currentActiveTrip.vehicle_id) {
        selectVehicle(currentActiveTrip.vehicle_id);
      }
      setShowTripReviewModal(true);
    } else if (currentAction === 'trip_checklist') {
      setShowChecklistModal(true);
    } else if (currentAction === 'manual_trip') {
      setShowManualTripModal(true);
    } else if (currentAction === 'recover_trip') {
      recoverInterruptedTrips();
      setShowTripReviewModal(true);
    }
  }, [params.action, params.vehicleId, selectedVehicle?.id, selectVehicle, recoverInterruptedTrips]);

  // ── Targeted Revision-based Invalidation ──
  const lastLoadedVehicleId = useRef<string | null>(null);
  const lastLoadedRevisions = useRef<Record<string, number>>({});

  const loadAll = useCallback(
    (force = false) => {
      const currentVehicleId = selectedVehicle?.id ?? null;
      const vehicleChanged = currentVehicleId !== lastLoadedVehicleId.current;

      const currentVehiclesRev = dataRevisionTracker.getRevision('vehicles');
      if (force || vehicleChanged || currentVehiclesRev > (lastLoadedRevisions.current['vehicles'] ?? -1)) {
        loadVehicles();
        lastLoadedRevisions.current['vehicles'] = currentVehiclesRev;
      }

      if (selectedVehicle) {
        const vId = selectedVehicle.id;

        const fuelRev = dataRevisionTracker.getRevision('fuel', vId);
        if (force || vehicleChanged || fuelRev > (lastLoadedRevisions.current[`fuel_${vId}`] ?? -1)) {
          loadEntries(vId);
          lastLoadedRevisions.current[`fuel_${vId}`] = fuelRev;
        }

        const serviceRev = dataRevisionTracker.getRevision('services', vId);
        if (force || vehicleChanged || serviceRev > (lastLoadedRevisions.current[`services_${vId}`] ?? -1)) {
          loadRecords(vId);
          lastLoadedRevisions.current[`services_${vId}`] = serviceRev;
        }

        const expenseRev = dataRevisionTracker.getRevision('expenses', vId);
        if (force || vehicleChanged || expenseRev > (lastLoadedRevisions.current[`expenses_${vId}`] ?? -1)) {
          loadExpenses(vId);
          lastLoadedRevisions.current[`expenses_${vId}`] = expenseRev;
        }

        const docRev = dataRevisionTracker.getRevision('documents', vId);
        if (force || vehicleChanged || docRev > (lastLoadedRevisions.current[`documents_${vId}`] ?? -1)) {
          loadDocuments(vId);
          lastLoadedRevisions.current[`documents_${vId}`] = docRev;
        }

        const tripRev = dataRevisionTracker.getRevision('trips', vId);
        if (force || vehicleChanged || tripRev > (lastLoadedRevisions.current[`trips_${vId}`] ?? -1)) {
          loadTrips(vId);
          lastLoadedRevisions.current[`trips_${vId}`] = tripRev;
        }

        const profileRev = dataRevisionTracker.getRevision('maintenanceProfiles', vId);
        if (force || vehicleChanged || profileRev > (lastLoadedRevisions.current[`profiles_${vId}`] ?? -1)) {
          loadProfiles(vId, selectedVehicle.current_odometer);
          lastLoadedRevisions.current[`profiles_${vId}`] = profileRev;
        }
      }

      lastLoadedVehicleId.current = currentVehicleId;
    },
    [selectedVehicle?.id, selectedVehicle?.current_odometer, loadVehicles, loadEntries, loadRecords, loadExpenses, loadDocuments, loadTrips, loadProfiles]
  );

  useFocusEffect(
    useCallback(() => {
      loadAll(false);
      // Check for deferred post-trip fuel prompt (e.g. from headless task)
      getAndClearPendingPostTripPrompt().then((pending) => {
        if (pending) {
          showPostTripFuelPrompt({
            vehicleId: pending.vehicleId,
            tripId: pending.tripId,
            odometer: pending.odometer,
            onAddFuel: (odo) => {
              router.push({
                pathname: '/add-fuel',
                params: {
                  vehicleId: pending.vehicleId,
                  ...(typeof odo === 'number' && !isNaN(odo) ? { odometer: String(odo) } : {}),
                },
              });
            },
          });
        }
      });
    }, [loadAll, router])
  );

  useEffect(() => {
    if (selectedVehicle) {
      loadChecklist(selectedVehicle.id);
    }
  }, [selectedVehicle?.id, loadChecklist]);

  // Pull-to-refresh
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAll(true);
    setTimeout(() => setRefreshing(false), 500);
  }, [loadAll]);

  // ── Memoized Computations ──
  const lastService = useMemo(
    () => (serviceRecords.length > 0 ? serviceRecords[0] : null),
    [serviceRecords]
  );

  const isBiFuelVehicle = useMemo(
    () => (selectedVehicle ? isBiFuel(selectedVehicle.fuel_type as FuelType) : false),
    [selectedVehicle?.fuel_type]
  );

  const isEV = useMemo(
    () => (selectedVehicle ? isElectricFuel(selectedVehicle.fuel_type as FuelType) : false),
    [selectedVehicle?.fuel_type]
  );

  const primaryUnit = useMemo(() => {
    if (!selectedVehicle) return 'L';
    return selectedVehicle.fuel_type === FuelType.CNG || isBiFuelVehicle
      ? 'kg'
      : isEV
      ? 'kWh'
      : 'L';
  }, [selectedVehicle?.fuel_type, isBiFuelVehicle, isEV]);

  const primaryAvgMileage = useMemo(() => {
    if (!selectedVehicle) return null;
    return isBiFuelVehicle
      ? stats.primarySystemStats?.runningAverage?.value ?? stats.runningAverage?.value ?? null
      : stats.runningAverage?.value ?? null;
  }, [selectedVehicle, isBiFuelVehicle, stats]);

  const secondaryAvgMileage = useMemo(() => {
    if (!selectedVehicle || !isBiFuelVehicle) return null;
    return stats.secondarySystemStats?.runningAverage?.value ?? null;
  }, [selectedVehicle, isBiFuelVehicle, stats]);

  const primaryFuelLevel = useMemo(() => {
    if (!selectedVehicle) return null;
    return estimateFuelLevel(
      entries,
      selectedVehicle.tank_capacity,
      selectedVehicle.current_odometer,
      primaryAvgMileage,
      primaryUnit,
      isBiFuelVehicle ? 'primary' : undefined
    );
  }, [entries, selectedVehicle, primaryAvgMileage, primaryUnit, isBiFuelVehicle]);

  const secondaryFuelLevel = useMemo(() => {
    if (!selectedVehicle || !isBiFuelVehicle || !selectedVehicle.secondary_tank_capacity) {
      return null;
    }
    return estimateFuelLevel(
      entries,
      selectedVehicle.secondary_tank_capacity,
      selectedVehicle.current_odometer,
      secondaryAvgMileage,
      'L',
      'secondary'
    );
  }, [selectedVehicle, isBiFuelVehicle, entries, secondaryAvgMileage]);

  const monthlyTotal = useMemo(
    () => getCurrentMonthTotalSpend(entries, serviceRecords, expenses).total,
    [entries, serviceRecords, expenses]
  );

  const serviceDueStatus = useMemo(
    () => (selectedVehicle ? getServiceDueStatus(selectedVehicle, lastService) : { urgency: 'none' as const, headline: '', subtext: '' }),
    [selectedVehicle, lastService]
  );

  const checklistItems = useMemo(() => {
    if (!selectedVehicle) return [];
    return buildPreTripChecklist(selectedVehicle, documents, checkedChecklistItems);
  }, [selectedVehicle, documents, checkedChecklistItems]);

  const checklistStats = useMemo(() => getChecklistStats(checklistItems), [checklistItems]);

  // ── Empty State if no vehicle exists ──
  if (!selectedVehicle) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🚗</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Vehicle Added</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Add your vehicle to enter the Automotive Cockpit!
          </Text>
          <TouchableOpacity
            style={[styles.addVehicleBtn, { backgroundColor: colors.accent }]}
            onPress={() => router.push('/add-vehicle')}
            activeOpacity={0.85}
          >
            <Text style={styles.addVehicleBtnText}>+ Add Vehicle</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 8), paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {/* Section 4: Vehicle Selector */}
        <HomeVehicleSelector vehicle={selectedVehicle} colors={colors} />

        {/* Section 5: GPS Cockpit (Self-contained Live GPS subscriptions) */}
        <HomeGpsCockpit
          vehicle={selectedVehicle}
          colors={colors}
          onOpenActiveTripModal={handleOpenActiveTripModal}
          onOpenTripReviewModal={handleOpenTripReviewModal}
          onOpenManualTripModal={handleOpenManualTripModal}
          onOpenTripHistoryModal={handleOpenTripHistoryModal}
        />

        {/* Section 6: Vehicle Overview (2x2 Grid) */}
        <HomeVehicleOverview
          vehicle={selectedVehicle}
          entries={entries}
          stats={stats}
          monthlyTotal={monthlyTotal}
          colors={colors}
        />

        {/* Section 7: Needs Attention (Service & Document alerts) */}
        <HomeNeedsAttention
          vehicle={selectedVehicle}
          serviceDueStatus={serviceDueStatus}
          expiringDocs={expiringDocs}
          colors={colors}
        />

        {/* Section 8: Vehicle Essentials (Fuel/Battery levels & Tyre pressures) */}
        <HomeVehicleEssentials
          vehicle={selectedVehicle}
          primaryFuelLevel={primaryFuelLevel}
          secondaryFuelLevel={secondaryFuelLevel}
          primaryUnit={primaryUnit}
          colors={colors}
        />

        {/* Section 9: Quick Access (Shortcuts) */}
        <HomeQuickAccess
          vehicle={selectedVehicle}
          checklistCount={checklistStats}
          onOpenProfilesModal={handleOpenProfilesModal}
          onOpenChecklistModal={handleOpenChecklistModal}
          colors={colors}
        />
      </ScrollView>

      {/* ── Dialog Modals ── */}
      {showChecklistModal && (
        <PreTripChecklistModal
          visible={showChecklistModal}
          onClose={() => setShowChecklistModal(false)}
          vehicle={selectedVehicle}
          documents={documents}
        />
      )}

      {showProfilesModal && (
        <MaintenanceProfilesModal
          visible={showProfilesModal}
          vehicle={selectedVehicle}
          onClose={() => setShowProfilesModal(false)}
        />
      )}

      {showTripHistoryModal && (
        <TripHistoryModal
          visible={showTripHistoryModal}
          vehicle={selectedVehicle}
          onStartGpsTrip={async () => {
            setShowTripHistoryModal(false);
            const res = await useTripStore.getState().startGpsTrip(
              selectedVehicle.id,
              selectedVehicle.current_odometer ?? undefined
            );
            if (res.success) {
              setShowActiveTripModal(true);
            }
          }}
          onLogManualTrip={() => {
            setShowTripHistoryModal(false);
            setShowManualTripModal(true);
          }}
          onClose={() => setShowTripHistoryModal(false)}
        />
      )}

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

      {showTripReviewModal && (
        <TripReviewModal
          visible={showTripReviewModal}
          vehicle={selectedVehicle}
          onSaved={(finalized) => {
            setShowTripReviewModal(false);
            loadVehicles();
            loadTrips(selectedVehicle.id);
            const tripOdometer = resolveTripEndOdometer(
              finalized,
              selectedVehicle.current_odometer
            );
            showPostTripFuelPrompt({
              vehicleId: selectedVehicle.id,
              tripId: finalized?.id,
              odometer: tripOdometer,
              onAddFuel: (odo) => {
                router.push({
                  pathname: '/add-fuel',
                  params: {
                    vehicleId: selectedVehicle.id,
                    ...(typeof odo === 'number' && !isNaN(odo) ? { odometer: String(odo) } : {}),
                  },
                });
              },
            });
          }}
          onCancel={() => {
            setShowTripReviewModal(false);
            setShowActiveTripModal(true);
          }}
        />
      )}

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
    paddingBottom: Spacing.xl,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  emptyEmoji: {
    fontSize: 54,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  addVehicleBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addVehicleBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
