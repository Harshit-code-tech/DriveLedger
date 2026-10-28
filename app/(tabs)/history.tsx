/**
 * History Screen
 *
 * Shows fuel history, service history, expense history, and trip history.
 * Features:
 * - Segmented tabs: Fuel | Service | Expenses | Trips
 * - Cursor-based pagination on SQLite with bounded initial query volume
 * - Lazy-loading: only the currently active tab loads data
 * - Search bar with pushed SQLite LIKE predicates
 * - Date range chips: All | This Week | This Month | 3 Months
 * - Virtualized list with memoized rows and batched maintenance components
 * - Wired to centralized Zustand stores and dataRevisionTracker for invalidation
 */

import { VehicleContextHeader } from '@/components/VehicleContextHeader';
import { Sizing, Spacing, Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useExpenseStore } from '@/stores/expenseStore';
import { useFuelStore } from '@/stores/fuelStore';
import { useServiceStore } from '@/stores/serviceStore';
import { useVehicleStore } from '@/stores/vehicleStore';
import { useTripStore } from '@/stores/tripStore';
import type { Expense } from '@/types/expense';
import type { FuelEntry } from '@/types/fuel';
import type { ServiceRecord, MaintenanceComponent } from '@/types/service';
import type { Trip } from '@/types/trip';
import * as fuelRepo from '@/database/repositories/fuelRepo';
import * as serviceRepo from '@/database/repositories/serviceRepo';
import * as expenseRepo from '@/database/repositories/expenseRepo';
import * as tripRepo from '@/database/repositories/tripRepo';
import * as maintCompRepo from '@/database/repositories/maintenanceComponentRepo';
import { FuelHistoryRow } from '@/components/history/FuelHistoryRow';
import { ServiceHistoryRow } from '@/components/history/ServiceHistoryRow';
import { ExpenseHistoryRow } from '@/components/history/ExpenseHistoryRow';
import { TripSummaryCard } from '@/components/TripSummaryCard';
import { TripDetailModal } from '@/components/TripDetailModal';
import { ManualTripModal } from '@/components/ManualTripModal';
import { dataRevisionTracker } from '@/services/dataRevisionTracker';
import { formatDisplayDateLong } from '@/utils/date';
import { formatCurrency } from '@/utils/format';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// ─── Types ───────────────────────────────────────────────────────────

type Tab = 'fuel' | 'service' | 'expenses' | 'trips';
type DateRange = 'all' | 'week' | 'month' | '3months';

const DATE_CHIPS: { value: DateRange; label: string }[] = [
  { value: 'all', label: 'All Time' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: '3months', label: '3 Months' },
];

function getDateRangeStart(range: DateRange): string | null {
  if (range === 'all') return null;
  const now = new Date();
  if (range === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  }
  if (range === 'month') {
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${m}-01`;
  }
  if (range === '3months') {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  }
  return null;
}

// ─── Main Screen ──────────────────────────────────────────────────────

export default function HistoryScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);
  const isEV = selectedVehicle?.fuel_type === 'electric';

  // Stores
  const deleteFuelEntry = useFuelStore((s) => s.deleteFuelEntry);
  const deleteServiceRecord = useServiceStore((s) => s.deleteRecord);
  const deleteExpense = useExpenseStore((s) => s.deleteExpense);
  const deleteTrip = useTripStore((s) => s.deleteTrip);

  // UI state
  const [tab, setTab] = useState<Tab>('fuel');
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>('all');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 150);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Tab counts
  const [tabCounts, setTabCounts] = useState({ fuel: 0, service: 0, expenses: 0, trips: 0 });

  // Separate paginated state per tab
  const [fuelData, setFuelData] = useState<{
    items: FuelEntry[];
    nextCursor: fuelRepo.PaginatedFuelCursor | null;
    hasMore: boolean;
    totalFiltered: number;
    isLoadingMore: boolean;
  }>({ items: [], nextCursor: null, hasMore: false, totalFiltered: 0, isLoadingMore: false });

  const [serviceData, setServiceData] = useState<{
    items: ServiceRecord[];
    nextCursor: serviceRepo.PaginatedServiceCursor | null;
    hasMore: boolean;
    totalFiltered: number;
    isLoadingMore: boolean;
  }>({ items: [], nextCursor: null, hasMore: false, totalFiltered: 0, isLoadingMore: false });

  const [expenseData, setExpenseData] = useState<{
    items: Expense[];
    nextCursor: expenseRepo.PaginatedExpenseCursor | null;
    hasMore: boolean;
    totalFiltered: number;
    isLoadingMore: boolean;
  }>({ items: [], nextCursor: null, hasMore: false, totalFiltered: 0, isLoadingMore: false });

  const [tripData, setTripData] = useState<{
    items: Trip[];
    nextCursor: tripRepo.PaginatedTripCursor | null;
    hasMore: boolean;
    totalFiltered: number;
    isLoadingMore: boolean;
  }>({ items: [], nextCursor: null, hasMore: false, totalFiltered: 0, isLoadingMore: false });

  const [componentsByService, setComponentsByService] = useState<Record<string, MaintenanceComponent[]>>({});
  const [selectedTripForDetail, setSelectedTripForDetail] = useState<Trip | null>(null);
  const [showManualTripModal, setShowManualTripModal] = useState(false);

  // Invalidation tracking
  const lastSeenRevs = useRef<Record<string, number>>({});

  // ── Tab Counts ────────────────────────────────────────────────────
  const refreshTabCounts = useCallback(() => {
    if (!selectedVehicle) return;
    try {
      const f = fuelRepo.getFuelEntryCount(selectedVehicle.id);
      const s = serviceRepo.getServiceRecordCount(selectedVehicle.id);
      const e = expenseRepo.getExpenseCount(selectedVehicle.id);
      const t = tripRepo.getTripCount(selectedVehicle.id);
      setTabCounts({ fuel: f, service: s, expenses: e, trips: t });
    } catch (err) {
      console.warn('[HistoryScreen] Failed to refresh tab counts:', err);
    }
  }, [selectedVehicle?.id]);

  // ── Loaders ───────────────────────────────────────────────────────
  const loadFuel = useCallback(
    (reset = false) => {
      if (!selectedVehicle) return;
      const startDate = getDateRangeStart(dateRange);
      const cursor = reset ? null : fuelData.nextCursor;
      if (!reset && (!fuelData.hasMore || fuelData.isLoadingMore)) return;

      if (!reset) setFuelData((prev) => ({ ...prev, isLoadingMore: true }));
      try {
        const res = fuelRepo.getPaginatedFuelEntries(selectedVehicle.id, {
          startDate,
          searchQuery: debouncedSearch,
          cursor,
          limit: 35,
        });

        setFuelData((prev) => ({
          items: reset ? res.items : [...prev.items, ...res.items],
          nextCursor: res.nextCursor,
          hasMore: res.hasMore,
          totalFiltered: res.totalCount,
          isLoadingMore: false,
        }));
      } catch (err) {
        console.warn('[HistoryScreen] Failed to load fuel page:', err);
        setFuelData((prev) => ({ ...prev, isLoadingMore: false }));
      }
    },
    [selectedVehicle?.id, dateRange, debouncedSearch, fuelData.nextCursor, fuelData.hasMore, fuelData.isLoadingMore]
  );

  const loadService = useCallback(
    (reset = false) => {
      if (!selectedVehicle) return;
      const startDate = getDateRangeStart(dateRange);
      const cursor = reset ? null : serviceData.nextCursor;
      if (!reset && (!serviceData.hasMore || serviceData.isLoadingMore)) return;

      if (!reset) setServiceData((prev) => ({ ...prev, isLoadingMore: true }));
      try {
        const res = serviceRepo.getPaginatedServiceRecords(selectedVehicle.id, {
          startDate,
          searchQuery: debouncedSearch,
          cursor,
          limit: 35,
        });

        // Batch load components for current page only
        const compMap = maintCompRepo.getMaintenanceComponentsByServiceIds(
          res.items.map((r) => r.id)
        );
        setComponentsByService((prev) => ({ ...prev, ...compMap }));

        setServiceData((prev) => ({
          items: reset ? res.items : [...prev.items, ...res.items],
          nextCursor: res.nextCursor,
          hasMore: res.hasMore,
          totalFiltered: res.totalCount,
          isLoadingMore: false,
        }));
      } catch (err) {
        console.warn('[HistoryScreen] Failed to load service page:', err);
        setServiceData((prev) => ({ ...prev, isLoadingMore: false }));
      }
    },
    [selectedVehicle?.id, dateRange, debouncedSearch, serviceData.nextCursor, serviceData.hasMore, serviceData.isLoadingMore]
  );

  const loadExpenses = useCallback(
    (reset = false) => {
      if (!selectedVehicle) return;
      const startDate = getDateRangeStart(dateRange);
      const cursor = reset ? null : expenseData.nextCursor;
      if (!reset && (!expenseData.hasMore || expenseData.isLoadingMore)) return;

      if (!reset) setExpenseData((prev) => ({ ...prev, isLoadingMore: true }));
      try {
        const res = expenseRepo.getPaginatedExpenses(selectedVehicle.id, {
          startDate,
          searchQuery: debouncedSearch,
          cursor,
          limit: 35,
        });

        setExpenseData((prev) => ({
          items: reset ? res.items : [...prev.items, ...res.items],
          nextCursor: res.nextCursor,
          hasMore: res.hasMore,
          totalFiltered: res.totalCount,
          isLoadingMore: false,
        }));
      } catch (err) {
        console.warn('[HistoryScreen] Failed to load expense page:', err);
        setExpenseData((prev) => ({ ...prev, isLoadingMore: false }));
      }
    },
    [selectedVehicle?.id, dateRange, debouncedSearch, expenseData.nextCursor, expenseData.hasMore, expenseData.isLoadingMore]
  );

  const loadTrips = useCallback(
    (reset = false) => {
      if (!selectedVehicle) return;
      const startDate = getDateRangeStart(dateRange);
      const cursor = reset ? null : tripData.nextCursor;
      if (!reset && (!tripData.hasMore || tripData.isLoadingMore)) return;

      if (!reset) setTripData((prev) => ({ ...prev, isLoadingMore: true }));
      try {
        const res = tripRepo.getPaginatedTrips(selectedVehicle.id, {
          startDate,
          searchQuery: debouncedSearch,
          cursor,
          limit: 35,
        });

        setTripData((prev) => ({
          items: reset ? res.items : [...prev.items, ...res.items],
          nextCursor: res.nextCursor,
          hasMore: res.hasMore,
          totalFiltered: res.totalCount,
          isLoadingMore: false,
        }));
      } catch (err) {
        console.warn('[HistoryScreen] Failed to load trips page:', err);
        setTripData((prev) => ({ ...prev, isLoadingMore: false }));
      }
    },
    [selectedVehicle?.id, dateRange, debouncedSearch, tripData.nextCursor, tripData.hasMore, tripData.isLoadingMore]
  );

  // Reload current tab on filter/vehicle change
  useEffect(() => {
    if (tab === 'fuel') loadFuel(true);
    else if (tab === 'service') loadService(true);
    else if (tab === 'expenses') loadExpenses(true);
    else if (tab === 'trips') loadTrips(true);
  }, [tab, debouncedSearch, dateRange, selectedVehicle?.id]);

  // Focus effect: check revisions and refresh counts
  useFocusEffect(
    useCallback(() => {
      if (!selectedVehicle) return;
      refreshTabCounts();

      const fuelChanged = dataRevisionTracker.hasChanged(
        'fuel',
        selectedVehicle.id,
        lastSeenRevs.current['fuel'] ?? 0
      );
      const serviceChanged = dataRevisionTracker.hasChanged(
        'services',
        selectedVehicle.id,
        lastSeenRevs.current['services'] ?? 0
      );
      const expenseChanged = dataRevisionTracker.hasChanged(
        'expenses',
        selectedVehicle.id,
        lastSeenRevs.current['expenses'] ?? 0
      );
      const tripsChanged = dataRevisionTracker.hasChanged(
        'trips',
        selectedVehicle.id,
        lastSeenRevs.current['trips'] ?? 0
      );

      lastSeenRevs.current['fuel'] = dataRevisionTracker.getRevision('fuel', selectedVehicle.id);
      lastSeenRevs.current['services'] = dataRevisionTracker.getRevision('services', selectedVehicle.id);
      lastSeenRevs.current['expenses'] = dataRevisionTracker.getRevision('expenses', selectedVehicle.id);
      lastSeenRevs.current['trips'] = dataRevisionTracker.getRevision('trips', selectedVehicle.id);

      if (tab === 'fuel' && (fuelChanged || fuelData.items.length === 0)) loadFuel(true);
      if (tab === 'service' && (serviceChanged || serviceData.items.length === 0)) loadService(true);
      if (tab === 'expenses' && (expenseChanged || expenseData.items.length === 0)) loadExpenses(true);
      if (tab === 'trips' && (tripsChanged || tripData.items.length === 0)) loadTrips(true);
    }, [selectedVehicle?.id, tab, refreshTabCounts])
  );

  // ── Delete handlers ───────────────────────────────────────────────
  const handleDeleteFuel = useCallback(
    (entry: FuelEntry) => {
      Alert.alert(
        isEV ? 'Delete This Charge? ⚡' : 'Delete This Fill-up? ⛽',
        `Heads up — deleting the entry from ${formatDisplayDateLong(entry.date)} will trigger an ${isEV ? 'efficiency' : 'mileage'} recalculation for everything after it.\n${entry.fuel_amount} ${entry.fuel_unit} · ${formatCurrency(entry.total_cost)}\n\nStill want to delete it?`,
        [
          { text: 'Keep It', style: 'cancel' },
          {
            text: 'Delete It',
            style: 'destructive',
            onPress: () => {
              if (selectedVehicle) {
                deleteFuelEntry(entry.id, selectedVehicle);
                setFuelData((prev) => ({
                  ...prev,
                  items: prev.items.filter((item) => item.id !== entry.id),
                  totalFiltered: Math.max(0, prev.totalFiltered - 1),
                }));
                refreshTabCounts();
              }
            },
          },
        ]
      );
    },
    [isEV, selectedVehicle, deleteFuelEntry, refreshTabCounts]
  );

  const handleDeleteService = useCallback(
    (record: ServiceRecord) => {
      Alert.alert(
        'Delete Service Record? 🔧',
        `Bye-bye "${record.service_type}" from ${formatDisplayDateLong(record.date)}. Gone forever!`,
        [
          { text: 'Keep It', style: 'cancel' },
          {
            text: 'Delete It',
            style: 'destructive',
            onPress: () => {
              deleteServiceRecord(record.id);
              setServiceData((prev) => ({
                ...prev,
                items: prev.items.filter((item) => item.id !== record.id),
                totalFiltered: Math.max(0, prev.totalFiltered - 1),
              }));
              refreshTabCounts();
            },
          },
        ]
      );
    },
    [deleteServiceRecord, refreshTabCounts]
  );

  const handleDeleteExpense = useCallback(
    (expense: Expense) => {
      Alert.alert(
        'Delete Expense? 💸',
        `Removing "${expense.category}" — ${formatCurrency(expense.amount)}. One less thing to track!`,
        [
          { text: 'Keep It', style: 'cancel' },
          {
            text: 'Delete It',
            style: 'destructive',
            onPress: () => {
              deleteExpense(expense.id);
              setExpenseData((prev) => ({
                ...prev,
                items: prev.items.filter((item) => item.id !== expense.id),
                totalFiltered: Math.max(0, prev.totalFiltered - 1),
              }));
              refreshTabCounts();
            },
          },
        ]
      );
    },
    [deleteExpense, refreshTabCounts]
  );

  const handleDeleteTrip = useCallback(
    (trip: Trip) => {
      Alert.alert(
        'Delete Trip Record? 🚗',
        `Are you sure you want to delete this ${trip.trip_type === 'gps' ? 'GPS' : 'manual'} trip (${trip.distance_km.toFixed(2)} km)?\n\nDeleting this trip will not roll back your vehicle odometer.`,
        [
          { text: 'Keep It', style: 'cancel' },
          {
            text: 'Delete It',
            style: 'destructive',
            onPress: () => {
              if (selectedVehicle) {
                deleteTrip(trip.id, selectedVehicle.id);
                setTripData((prev) => ({
                  ...prev,
                  items: prev.items.filter((item) => item.id !== trip.id),
                  totalFiltered: Math.max(0, prev.totalFiltered - 1),
                }));
                refreshTabCounts();
                if (selectedTripForDetail?.id === trip.id) {
                  setSelectedTripForDetail(null);
                }
              }
            },
          },
        ]
      );
    },
    [selectedVehicle, deleteTrip, selectedTripForDetail, refreshTabCounts]
  );

  // ── Navigation callbacks ──────────────────────────────────────────
  const handlePressFuel = useCallback(
    (entry: FuelEntry) => {
      router.push({ pathname: '/add-fuel', params: { id: entry.id } });
    },
    [router]
  );

  const handlePressService = useCallback(
    (record: ServiceRecord) => {
      router.push({ pathname: '/add-service', params: { id: record.id } });
    },
    [router]
  );

  const handlePressExpense = useCallback(
    (expense: Expense) => {
      router.push({ pathname: '/add-expense', params: { id: expense.id } });
    },
    [router]
  );

  const handlePressTrip = useCallback((trip: Trip) => {
    setSelectedTripForDetail(trip);
  }, []);

  // ── Empty state ───────────────────────────────────────────────────
  const isFiltered = debouncedSearch.length > 0 || dateRange !== 'all';

  const renderEmpty = (type: Tab) => (
    <View style={styles.emptyState}>
      <Text style={{ fontSize: 48, marginBottom: Spacing.lg }}>
        {isFiltered ? '🔍' : type === 'fuel' ? (isEV ? '⚡' : '⛽') : type === 'service' ? '🔧' : type === 'trips' ? '🗺️' : '💰'}
      </Text>
      <Text style={[Typography.h3, { color: colors.text }]}>
        {isFiltered ? 'No results found' : type === 'fuel' ? (isEV ? 'No charging sessions yet' : 'No fuel entries yet') : type === 'trips' ? 'No trips recorded yet' : `No ${type} entries yet`}
      </Text>
      <Text style={[Typography.bodySmall, { color: colors.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
        {isFiltered
          ? 'Try a different search term or date range.'
          : type === 'fuel'
            ? (isEV ? 'Tap ⚡ Add Charge on the Home screen to record a session.' : 'Tap ⛽ Add Fuel on the Home screen to record a refill.')
            : type === 'service'
              ? "Tap 🔧 below to record your vehicle's latest maintenance."
              : type === 'trips'
                ? 'Record trips from the Home screen or tap Log Trip below.'
                : 'Tap 💰 below to record non-fuel costs like tolls or parking.'}
      </Text>
    </View>
  );

  if (!selectedVehicle) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[Typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.section }]}>
          No vehicle selected.
        </Text>
      </View>
    );
  }

  const currentCount =
    tab === 'fuel'
      ? fuelData.totalFiltered
      : tab === 'service'
      ? serviceData.totalFiltered
      : tab === 'expenses'
      ? expenseData.totalFiltered
      : tripData.totalFiltered;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Vehicle Context ── */}
      <VehicleContextHeader label="History for" />

      {/* ── Segmented Tabs ── */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {(['fuel', 'service', 'expenses', 'trips'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            style={[
              styles.tabButton,
              tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
            ]}
          >
            <Text
              style={[
                Typography.bodySmall,
                { color: tab === t ? colors.primary : colors.textSecondary, fontWeight: tab === t ? '700' : '400' },
              ]}
            >
              {t === 'fuel'
                ? (isEV ? `Charging (${tabCounts.fuel})` : `Fuel (${tabCounts.fuel})`)
                : t === 'service'
                ? `Service (${tabCounts.service})`
                : t === 'expenses'
                ? `Expenses (${tabCounts.expenses})`
                : `Trips (${tabCounts.trips})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Search Bar ── */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[styles.searchInputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={
              tab === 'fuel' ? (isEV ? 'Search by network, notes, date…' : 'Search by station, notes, date…')
                : tab === 'service' ? 'Search by service type, garage…'
                  : tab === 'expenses' ? 'Search by category, description…'
                    : 'Search by purpose, notes, date…'
            }
            placeholderTextColor={colors.textTertiary}
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: colors.textTertiary, fontSize: 18 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Date Range Chips ── */}
        <View style={styles.chipsRow}>
          {DATE_CHIPS.map((chip) => {
            const isActive = dateRange === chip.value;
            return (
              <TouchableOpacity
                key={chip.value}
                onPress={() => setDateRange(chip.value)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isActive ? colors.primary : colors.background,
                    borderColor: isActive ? colors.primary : colors.border,
                  },
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    Typography.caption,
                    { color: isActive ? '#FFFFFF' : colors.textSecondary, fontWeight: isActive ? '700' : '500' },
                  ]}
                >
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Active filter summary */}
        {isFiltered && (
          <View style={styles.filterSummary}>
            <Text style={[Typography.caption, { color: colors.textSecondary }]}>
              {currentCount} result{currentCount !== 1 ? 's' : ''}
            </Text>
            <TouchableOpacity
              onPress={() => { setSearchText(''); setDateRange('all'); }}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <Text style={[Typography.caption, { color: colors.primary, fontWeight: '600' }]}>
                Clear filters
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Lists ── */}
      {tab === 'fuel' && (
        <FlatList
          data={fuelData.items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FuelHistoryRow
              item={item}
              isEV={isEV}
              selectedVehicle={selectedVehicle}
              onPress={handlePressFuel}
              onLongPress={handleDeleteFuel}
            />
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={renderEmpty('fuel')}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          onEndReached={() => loadFuel(false)}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            fuelData.isLoadingMore ? (
              <View style={{ paddingVertical: Spacing.md, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : undefined
          }
        />
      )}
      {tab === 'service' && (
        <FlatList
          data={serviceData.items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ServiceHistoryRow
              item={item}
              components={componentsByService[item.id] || []}
              onPress={handlePressService}
              onLongPress={handleDeleteService}
            />
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={renderEmpty('service')}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          onEndReached={() => loadService(false)}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            serviceData.isLoadingMore ? (
              <View style={{ paddingVertical: Spacing.md, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : undefined
          }
        />
      )}
      {tab === 'expenses' && (
        <FlatList
          data={expenseData.items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ExpenseHistoryRow
              item={item}
              onPress={handlePressExpense}
              onLongPress={handleDeleteExpense}
            />
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={renderEmpty('expenses')}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          onEndReached={() => loadExpenses(false)}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            expenseData.isLoadingMore ? (
              <View style={{ paddingVertical: Spacing.md, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : undefined
          }
        />
      )}
      {tab === 'trips' && (
        <FlatList
          data={tripData.items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TripSummaryCard
              trip={item}
              vehicleName={selectedVehicle?.nickname || `${selectedVehicle?.manufacturer ?? ''} ${selectedVehicle?.model ?? ''}`.trim() || 'Vehicle'}
              onPress={handlePressTrip}
              onDelete={handleDeleteTrip}
            />
          )}
          contentContainerStyle={styles.list}
          ListEmptyComponent={renderEmpty('trips')}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews={Platform.OS === 'android'}
          onEndReached={() => loadTrips(false)}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            tripData.isLoadingMore ? (
              <View style={{ paddingVertical: Spacing.md, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : undefined
          }
        />
      )}

      {/* ── FABs ── */}
      {tab === 'service' && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
          onPress={() => router.push('/add-service')}
        >
          <Text style={styles.fabIcon}>🔧</Text>
          <Text style={[styles.fabText, { color: colors.textOnPrimary }]}>Record Maintenance</Text>
        </TouchableOpacity>
      )}
      {tab === 'expenses' && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.accent }]}
          activeOpacity={0.85}
          onPress={() => router.push('/add-expense')}
        >
          <Text style={styles.fabIcon}>💰</Text>
          <Text style={[styles.fabText, { color: '#1A1C1E' }]}>Track Running Cost</Text>
        </TouchableOpacity>
      )}
      {tab === 'trips' && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          activeOpacity={0.85}
          onPress={() => {
            Alert.alert(
              'Record a Trip 🚗',
              'Choose how you would like to log this trip:',
              [
                {
                  text: '✍️ Log Manual Trip',
                  onPress: () => setShowManualTripModal(true),
                },
                {
                  text: '🛰️ Live GPS Tracker',
                  onPress: () => router.push('/(tabs)'),
                },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          }}
        >
          <Text style={styles.fabIcon}>🗺️</Text>
          <Text style={[styles.fabText, { color: colors.textOnPrimary }]}>Log Trip</Text>
        </TouchableOpacity>
      )}

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
              setTripData((prev) => ({
                ...prev,
                items: prev.items.filter((item) => item.id !== tripId),
                totalFiltered: Math.max(0, prev.totalFiltered - 1),
              }));
              refreshTabCounts();
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
            loadTrips(true);
            refreshTabCounts();
          }}
          onClose={() => setShowManualTripModal(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Tab bar ──
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },

  // ── Search / Filter section ──
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    height: 44,
    marginBottom: Spacing.sm,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },

  // ── Date chips ──
  chipsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    marginBottom: Spacing.xs,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
  },

  // ── Filter summary row ──
  filterSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
  },

  // ── List ──
  list: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 120 },

  // ── Empty state ──
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing.section * 2,
    paddingHorizontal: Spacing.xxxl,
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
  fabIcon: { fontSize: 24, color: '#FFFFFF', fontWeight: '700' },
  fabText: { fontSize: 16, fontWeight: '700' },
});
