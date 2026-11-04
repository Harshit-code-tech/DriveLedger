/**
 * DriveLedger — Records Screen
 *
 * Implemented with user enhancements:
 * 1. Category filters with SVG icons (RecordSvgIcons).
 * 2. Header with tab name "Records" and live count.
 * 3. Small FAB at bottom right with + sign and section icon (for Fuel, Service, Trips, Expenses; hidden for All).
 * 4. Workable search in the header with search icon.
 * 5. Unified control bar below vehicle selection:
 *    - Left: Filter & Sort dropdown (Date range + Sorting).
 *    - Right: Hamburger button opening category menu with SVG icons.
 * 6. Beautiful, informative record cards with rich details:
 *    - Fuel: Refill title, quantity, price/unit, station, mileage badge, cost, odometer.
 *    - Service: Service type, garage, full description, parts/components tags, invoice badge, next due.
 *    - Expenses: Category, amount, full description, receipt badge, notes.
 *    - Trips: Date, time range, distance, duration, GPS vs manual badge, odometer range, purpose tag, inspect GPS route.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Stores & Services
import { useVehicleStore } from '@/stores/vehicleStore';
import { useFuelStore } from '@/stores/fuelStore';
import { useServiceStore } from '@/stores/serviceStore';
import { useExpenseStore } from '@/stores/expenseStore';
import { useTripStore } from '@/stores/tripStore';
import { dataRevisionTracker } from '@/services/dataRevisionTracker';
import * as fuelRepo from '@/database/repositories/fuelRepo';
import * as serviceRepo from '@/database/repositories/serviceRepo';
import * as expenseRepo from '@/database/repositories/expenseRepo';
import * as tripRepo from '@/database/repositories/tripRepo';
import * as maintCompRepo from '@/database/repositories/maintenanceComponentRepo';

// Types & Helpers
import type { FuelEntry } from '@/types/fuel';
import type { ServiceRecord, MaintenanceComponent } from '@/types/service';
import type { Expense } from '@/types/expense';
import type { Trip } from '@/types/trip';
import { formatDisplayDateLong } from '@/utils/date';
import { formatCurrency } from '@/utils/format';

// Records Domain Components
import { useRecordColors } from '@/components/records/recordTheme';
import type {
  DateRangeOption,
  RecordCategory,
  RecordItem,
  RecordSection,
  SortOrder,
} from '@/components/records/recordTypes';
import { filterAndGroupRecords } from '@/components/records/recordHelpers';
import { RecordsHeader } from '@/components/records/RecordsHeader';
import { HomeVehicleSelector } from '@/components/home/HomeVehicleSelector';
import { RecordFilterBar } from '@/components/records/RecordFilterBar';
import { RecordRow } from '@/components/records/RecordRow';
import { RecordEmptyState } from '@/components/records/RecordEmptyState';
import { RecordFab } from '@/components/records/RecordFab';

// Modals
import { TripDetailModal } from '@/components/TripDetailModal';
import { ManualTripModal } from '@/components/ManualTripModal';

export default function RecordsScreen() {
  const colors = useRecordColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ── Global Vehicle State ──
  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);
  const isEV = selectedVehicle?.fuel_type === 'electric';

  // ── Mutation Stores ──
  const deleteFuelEntry = useFuelStore((s) => s.deleteFuelEntry);
  const deleteServiceRecord = useServiceStore((s) => s.deleteRecord);
  const deleteExpense = useExpenseStore((s) => s.deleteExpense);
  const deleteTrip = useTripStore((s) => s.deleteTrip);

  // ── Records State ──
  const [fuelEntries, setFuelEntries] = useState<FuelEntry[]>([]);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [componentsByService, setComponentsByService] = useState<Record<string, MaintenanceComponent[]>>({});

  // ── Filter & Search State ──
  const [category, setCategory] = useState<RecordCategory>('all');
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRangeOption>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  // ── Modals State ──
  const [selectedTripForDetail, setSelectedTripForDetail] = useState<Trip | null>(null);
  const [showManualTripModal, setShowManualTripModal] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Revision tracker refs for smart cache invalidation
  const lastSeenRevs = useRef<Record<string, number>>({});
  const lastLoadedVehicleId = useRef<string | null>(null);

  // ── Data Loader ──
  const loadData = useCallback(() => {
    if (!selectedVehicle) return;
    const vehicleId = selectedVehicle.id;

    try {
      const f = fuelRepo.getFuelEntriesByVehicle(vehicleId);
      const s = serviceRepo.getServiceRecordsByVehicle(vehicleId);
      const e = expenseRepo.getExpensesByVehicle(vehicleId);
      const t = tripRepo.getTripsByVehicle(vehicleId);
      const compMap = maintCompRepo.getMaintenanceComponentsByServiceIds(s.map((r) => r.id));

      setFuelEntries(f);
      setServiceRecords(s);
      setExpenses(e);
      setTrips(t);
      setComponentsByService(compMap);

      lastLoadedVehicleId.current = vehicleId;
      lastSeenRevs.current['fuel'] = dataRevisionTracker.getRevision('fuel', vehicleId);
      lastSeenRevs.current['services'] = dataRevisionTracker.getRevision('services', vehicleId);
      lastSeenRevs.current['expenses'] = dataRevisionTracker.getRevision('expenses', vehicleId);
      lastSeenRevs.current['trips'] = dataRevisionTracker.getRevision('trips', vehicleId);
    } catch (err) {
      console.warn('[RecordsScreen] Error loading vehicle records:', err);
    }
  }, [selectedVehicle?.id]);

  // Initial and vehicle change load
  useEffect(() => {
    if (selectedVehicle?.id) {
      loadData();
    }
  }, [selectedVehicle?.id, loadData]);

  // Focus effect: check data revisions and reload only changed datasets
  useFocusEffect(
    useCallback(() => {
      if (!selectedVehicle) return;
      const vehicleId = selectedVehicle.id;

      const vehicleChanged = lastLoadedVehicleId.current !== vehicleId;
      const fuelChanged = dataRevisionTracker.hasChanged(
        'fuel',
        vehicleId,
        lastSeenRevs.current['fuel'] ?? 0
      );
      const serviceChanged = dataRevisionTracker.hasChanged(
        'services',
        vehicleId,
        lastSeenRevs.current['services'] ?? 0
      );
      const expenseChanged = dataRevisionTracker.hasChanged(
        'expenses',
        vehicleId,
        lastSeenRevs.current['expenses'] ?? 0
      );
      const tripsChanged = dataRevisionTracker.hasChanged(
        'trips',
        vehicleId,
        lastSeenRevs.current['trips'] ?? 0
      );

      if (vehicleChanged) {
        loadData();
        return;
      }

      if (fuelChanged) {
        setFuelEntries(fuelRepo.getFuelEntriesByVehicle(vehicleId));
        lastSeenRevs.current['fuel'] = dataRevisionTracker.getRevision('fuel', vehicleId);
      }
      if (serviceChanged) {
        const s = serviceRepo.getServiceRecordsByVehicle(vehicleId);
        setServiceRecords(s);
        const compMap = maintCompRepo.getMaintenanceComponentsByServiceIds(s.map((r) => r.id));
        setComponentsByService(compMap);
        lastSeenRevs.current['services'] = dataRevisionTracker.getRevision('services', vehicleId);
      }
      if (expenseChanged) {
        setExpenses(expenseRepo.getExpensesByVehicle(vehicleId));
        lastSeenRevs.current['expenses'] = dataRevisionTracker.getRevision('expenses', vehicleId);
      }
      if (tripsChanged) {
        setTrips(tripRepo.getTripsByVehicle(vehicleId));
        lastSeenRevs.current['trips'] = dataRevisionTracker.getRevision('trips', vehicleId);
      }
    }, [selectedVehicle?.id, loadData])
  );

  // ── Derived Grouped Sections ──
  const sections: RecordSection[] = useMemo(() => {
    return filterAndGroupRecords({
      fuelEntries,
      serviceRecords,
      expenses,
      trips,
      vehicle: selectedVehicle,
      category,
      dateRange,
      searchQuery: debouncedSearch,
      sortOrder,
      componentsByService,
    });
  }, [
    fuelEntries,
    serviceRecords,
    expenses,
    trips,
    selectedVehicle,
    category,
    dateRange,
    debouncedSearch,
    sortOrder,
    componentsByService,
  ]);

  // Counts for category badges
  const categoryCounts = useMemo(() => {
    return {
      all: fuelEntries.length + serviceRecords.length + expenses.length + trips.length,
      fuel: fuelEntries.length,
      service: serviceRecords.length,
      expenses: expenses.length,
      trips: trips.length,
    };
  }, [fuelEntries.length, serviceRecords.length, expenses.length, trips.length]);

  const totalRawRecords = categoryCounts.all;
  const isFiltered =
    category !== 'all' ||
    dateRange !== 'all' ||
    debouncedSearch.trim().length > 0 ||
    sortOrder !== 'newest';

  // ── Filter Reset Handlers ──
  const handleClearCategory = useCallback(() => setCategory('all'), []);
  const handleClearSearchText = useCallback(() => {
    setSearchText('');
    setDebouncedSearch('');
  }, []);
  const handleClearAll = useCallback(() => {
    setCategory('all');
    setSearchText('');
    setDebouncedSearch('');
    setDateRange('all');
    setSortOrder('newest');
  }, []);

  // ── Record Interaction Handlers ──
  const handlePressRecord = useCallback(
    (item: RecordItem) => {
      switch (item.type) {
        case 'fuel':
          router.push({ pathname: '/add-fuel', params: { id: item.id } });
          break;
        case 'service':
          router.push({ pathname: '/add-service', params: { id: item.id } });
          break;
        case 'expense':
          router.push({ pathname: '/add-expense', params: { id: item.id } });
          break;
        case 'trip':
          setSelectedTripForDetail(item.raw as Trip);
          break;
      }
    },
    [router]
  );

  const handleDeleteRecord = useCallback(
    (item: RecordItem) => {
      if (!selectedVehicle) return;

      switch (item.type) {
        case 'fuel': {
          const entry = item.raw as FuelEntry;
          Alert.alert(
            isEV ? 'Delete This Charge? ⚡' : 'Delete This Fill-up? ⛽',
            `Heads up — deleting the entry from ${formatDisplayDateLong(entry.date)} will trigger an ${
              isEV ? 'efficiency' : 'mileage'
            } recalculation for everything after it.\n${entry.fuel_amount} ${
              entry.fuel_unit
            } · ${formatCurrency(entry.total_cost)}\n\nStill want to delete it?`,
            [
              { text: 'Keep It', style: 'cancel' },
              {
                text: 'Delete It',
                style: 'destructive',
                onPress: () => {
                  deleteFuelEntry(entry.id, selectedVehicle);
                  setFuelEntries((prev) => prev.filter((e) => e.id !== entry.id));
                },
              },
            ]
          );
          break;
        }

        case 'service': {
          const record = item.raw as ServiceRecord;
          Alert.alert(
            'Delete Service Record? 🔧',
            `Bye-bye "${record.service_type}" from ${formatDisplayDateLong(
              record.date
            )}. Gone forever!`,
            [
              { text: 'Keep It', style: 'cancel' },
              {
                text: 'Delete It',
                style: 'destructive',
                onPress: () => {
                  deleteServiceRecord(record.id);
                  setServiceRecords((prev) => prev.filter((r) => r.id !== record.id));
                },
              },
            ]
          );
          break;
        }

        case 'expense': {
          const expense = item.raw as Expense;
          Alert.alert(
            'Delete Expense? 💸',
            `Removing "${expense.category}" — ${formatCurrency(
              expense.amount
            )}. One less thing to track!`,
            [
              { text: 'Keep It', style: 'cancel' },
              {
                text: 'Delete It',
                style: 'destructive',
                onPress: () => {
                  deleteExpense(expense.id);
                  setExpenses((prev) => prev.filter((e) => e.id !== expense.id));
                },
              },
            ]
          );
          break;
        }

        case 'trip': {
          const trip = item.raw as Trip;
          Alert.alert(
            'Delete Trip Record? 🚗',
            `Are you sure you want to delete this ${
              trip.trip_type === 'gps' ? 'GPS' : 'manual'
            } trip (${trip.distance_km.toFixed(
              2
            )} km)?\n\nDeleting this trip will not roll back your vehicle odometer.`,
            [
              { text: 'Keep It', style: 'cancel' },
              {
                text: 'Delete It',
                style: 'destructive',
                onPress: () => {
                  deleteTrip(trip.id, selectedVehicle.id);
                  setTrips((prev) => prev.filter((t) => t.id !== trip.id));
                  if (selectedTripForDetail?.id === trip.id) {
                    setSelectedTripForDetail(null);
                  }
                },
              },
            ]
          );
          break;
        }
      }
    },
    [isEV, selectedVehicle, deleteFuelEntry, deleteServiceRecord, deleteExpense, deleteTrip, selectedTripForDetail]
  );

  // ── Quick Add Navigation Callbacks ──
  const handleAddFuel = useCallback(() => router.push('/add-fuel'), [router]);
  const handleAddService = useCallback(() => router.push('/add-service'), [router]);
  const handleAddExpense = useCallback(() => router.push('/add-expense'), [router]);
  const handleAddTrip = useCallback(() => {
    Alert.alert('Record a Trip 🚗', 'Choose how you would like to log this trip:', [
      { text: '✍️ Log Manual Trip', onPress: () => setShowManualTripModal(true) },
      { text: '🛰️ Live GPS Tracker', onPress: () => router.push('/(tabs)') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [router]);

  if (!selectedVehicle) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top + 24 },
        ]}
      >
        <Text style={[styles.noVehicleText, { color: colors.textSecondary }]}>
          No vehicle selected.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      {/* ── Requirements 2 & 4: Header with Tab Name "Records" + Workable Search ── */}
      <RecordsHeader
        searchText={searchText}
        onChangeSearchText={setSearchText}
        colors={colors}
        totalRecordsCount={categoryCounts.all}
      />

      {/* ── Section 4.1: Vehicle Selector ── */}
      <HomeVehicleSelector vehicle={selectedVehicle} colors={colors} />

      {/* ── Requirements 1 & 5: Filter & Sort (Left) + Hamburger Categories with SVGs (Right) ── */}
      <RecordFilterBar
        selectedCategory={category}
        onSelectCategory={setCategory}
        dateRange={dateRange}
        onChangeDateRange={setDateRange}
        sortOrder={sortOrder}
        onChangeSortOrder={setSortOrder}
        searchText={searchText}
        onClearSearchText={handleClearSearchText}
        onClearCategory={handleClearCategory}
        onClearAll={handleClearAll}
        isEV={isEV}
        colors={colors}
        counts={categoryCounts}
      />

      {/* ── Section 4.5: Chronological Records List ── */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RecordRow
            item={item}
            onPress={handlePressRecord}
            onLongPress={handleDeleteRecord}
            colors={colors}
            isEV={isEV}
            selectedVehicle={selectedVehicle}
          />
        )}
        renderSectionHeader={({ section: { title } }) => (
          <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
            <Text style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>
              {title}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <RecordEmptyState
            isFiltered={isFiltered && totalRawRecords > 0}
            onClearFilters={handleClearAll}
            onAddFuel={handleAddFuel}
            onAddService={handleAddService}
            onAddExpense={handleAddExpense}
            onAddTrip={handleAddTrip}
            isEV={isEV}
            colors={colors}
          />
        }
        contentContainerStyle={styles.listContent}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={Platform.OS === 'android'}
        stickySectionHeadersEnabled={false}
      />

      {/* ── Requirement 3: FAB at bottom right with + sign and section icon (Fuel/Service/Trip/Expense) ── */}
      <RecordFab
        category={category}
        onAddFuel={handleAddFuel}
        onAddService={handleAddService}
        onAddExpense={handleAddExpense}
        onAddTrip={handleAddTrip}
        isEV={isEV}
        colors={colors}
      />

      {/* ── Trip Detail Modal ── */}
      {selectedTripForDetail && (
        <TripDetailModal
          visible={!!selectedTripForDetail}
          trip={selectedTripForDetail}
          vehicle={selectedVehicle}
          onClose={() => setSelectedTripForDetail(null)}
          onDelete={(tripId) => {
            if (selectedVehicle) {
              deleteTrip(tripId, selectedVehicle.id);
              setTrips((prev) => prev.filter((t) => t.id !== tripId));
              setSelectedTripForDetail(null);
            }
          }}
        />
      )}

      {/* ── Manual Trip Modal ── */}
      {showManualTripModal && selectedVehicle && (
        <ManualTripModal
          visible={showManualTripModal}
          vehicle={selectedVehicle}
          onSaved={() => {
            setShowManualTripModal(false);
            if (selectedVehicle) {
              setTrips(tripRepo.getTripsByVehicle(selectedVehicle.id));
            }
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
  noVehicleText: {
    textAlign: 'center',
    fontSize: 15,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  listContent: {
    paddingBottom: 85,
  },
});
