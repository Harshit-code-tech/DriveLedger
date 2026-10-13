/**
 * History Screen
 *
 * Shows fuel history, service history, and expense history.
 * Features:
 * - Segmented tabs: Fuel | Service | Expenses
 * - Search bar — filters across all text fields on the active tab
 * - Date range chips: All | This Week | This Month | 3 Months
 * - Tap to edit, long press to delete
 * - FABs for quick-add service/expense
 * - Wired to centralized Zustand stores
 */

import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput } from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { useVehicleStore } from '@/stores/vehicleStore';
import { useFuelStore } from '@/stores/fuelStore';
import { useServiceStore } from '@/stores/serviceStore';
import { useExpenseStore } from '@/stores/expenseStore';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Typography, Spacing, Sizing } from '@/constants/theme';
import { formatCurrency } from '@/utils/format';
import { formatDisplayDateLong } from '@/utils/date';
import type { FuelEntry } from '@/types/fuel';
import type { ServiceRecord } from '@/types/service';
import type { Expense } from '@/types/expense';
import { VehicleContextHeader } from '@/components/VehicleContextHeader';
import { MILEAGE_UNIT_LABELS, isHybridFuel, FuelType, getFuelSystemLabel } from '@/constants/fuelTypes';

// ─── Types ───────────────────────────────────────────────────────────

type Tab = 'fuel' | 'service' | 'expenses';
type DateRange = 'all' | 'week' | 'month' | '3months';

const DATE_CHIPS: { value: DateRange; label: string }[] = [
  { value: 'all',     label: 'All Time'   },
  { value: 'week',    label: 'This Week'  },
  { value: 'month',   label: 'This Month' },
  { value: '3months', label: '3 Months'   },
];

// ─── Date range helpers ───────────────────────────────────────────────

function getDateRangeStart(range: DateRange): Date | null {
  if (range === 'all') return null;
  const now = new Date();
  if (range === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (range === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (range === '3months') {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 3);
    return d;
  }
  return null;
}

function isInRange(dateStr: string, rangeStart: Date | null): boolean {
  if (!rangeStart) return true;
  return new Date(dateStr) >= rangeStart;
}

// ─── Main Screen ──────────────────────────────────────────────────────

export default function HistoryScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);

  // Stores
  const fuelEntries      = useFuelStore((s) => s.entries);
  const loadEntries      = useFuelStore((s) => s.loadEntries);
  const deleteFuelEntry  = useFuelStore((s) => s.deleteFuelEntry);

  const serviceRecords    = useServiceStore((s) => s.records);
  const loadRecords       = useServiceStore((s) => s.loadRecords);
  const deleteServiceRecord = useServiceStore((s) => s.deleteRecord);

  const expenses      = useExpenseStore((s) => s.expenses);
  const loadExpenses  = useExpenseStore((s) => s.loadExpenses);
  const deleteExpense = useExpenseStore((s) => s.deleteExpense);

  // UI state
  const [tab, setTab]             = useState<Tab>('fuel');
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange]   = useState<DateRange>('all');

  const loadAll = useCallback(() => {
    if (selectedVehicle) {
      loadEntries(selectedVehicle.id);
      loadRecords(selectedVehicle.id);
      loadExpenses(selectedVehicle.id);
    }
  }, [selectedVehicle?.id]);

  useFocusEffect(loadAll);

  // ── Filtered data (pure, no side-effects) ────────────────────────
  const rangeStart = useMemo(() => getDateRangeStart(dateRange), [dateRange]);
  const query = searchText.toLowerCase().trim();

  const filteredFuel = useMemo(() => {
    return fuelEntries.filter((e) => {
      if (!isInRange(e.date, rangeStart)) return false;
      if (!query) return true;
      return (
        e.fuel_station?.toLowerCase().includes(query) ||
        e.notes?.toLowerCase().includes(query) ||
        e.odometer.toString().includes(query) ||
        e.fuel_unit.toLowerCase().includes(query) ||
        formatDisplayDateLong(e.date).toLowerCase().includes(query)
      );
    });
  }, [fuelEntries, rangeStart, query]);

  const filteredService = useMemo(() => {
    return serviceRecords.filter((r) => {
      if (!isInRange(r.date, rangeStart)) return false;
      if (!query) return true;
      return (
        r.service_type.toLowerCase().includes(query) ||
        r.garage_name?.toLowerCase().includes(query) ||
        r.work_done?.toLowerCase().includes(query) ||
        r.notes?.toLowerCase().includes(query) ||
        formatDisplayDateLong(r.date).toLowerCase().includes(query)
      );
    });
  }, [serviceRecords, rangeStart, query]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (!isInRange(e.date, rangeStart)) return false;
      if (!query) return true;
      return (
        e.category.toLowerCase().includes(query) ||
        e.description?.toLowerCase().includes(query) ||
        formatDisplayDateLong(e.date).toLowerCase().includes(query)
      );
    });
  }, [expenses, rangeStart, query]);

  // ── Tab counts (unfiltered, for the tab label) ────────────────────
  const tabCounts = { fuel: fuelEntries.length, service: serviceRecords.length, expenses: expenses.length };

  // ── Delete handlers ───────────────────────────────────────────────
  const handleDeleteFuel = (entry: FuelEntry) => {
    Alert.alert(
      'Delete This Fill-up? ⛽',
      `Heads up — deleting the entry from ${formatDisplayDateLong(entry.date)} will trigger a mileage recalculation for everything after it.\n${entry.fuel_amount} ${entry.fuel_unit} · ${formatCurrency(entry.total_cost)}\n\nStill want to nuke it?`,
      [
        { text: 'Keep It', style: 'cancel' },
        {
          text: 'Delete It',
          style: 'destructive',
          onPress: () => { if (selectedVehicle) deleteFuelEntry(entry.id, selectedVehicle); },
        },
      ]
    );
  };

  const handleDeleteService = (record: ServiceRecord) => {
    Alert.alert(
      'Delete Service Record? 🔧',
      `Bye-bye "${record.service_type}" from ${formatDisplayDateLong(record.date)}. Gone forever!`,
      [
        { text: 'Keep It', style: 'cancel' },
        { text: 'Delete It', style: 'destructive', onPress: () => deleteServiceRecord(record.id) },
      ]
    );
  };

  const handleDeleteExpense = (expense: Expense) => {
    Alert.alert(
      'Delete Expense? 💸',
      `Removing "${expense.category}" — ${formatCurrency(expense.amount)}. One less thing to track!`,
      [
        { text: 'Keep It', style: 'cancel' },
        { text: 'Delete It', style: 'destructive', onPress: () => deleteExpense(expense.id) },
      ]
    );
  };

  // ── Row renderers ─────────────────────────────────────────────────

  const renderFuelEntry = ({ item }: { item: FuelEntry }) => (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/add-fuel', params: { id: item.id } })}
      onLongPress={() => handleDeleteFuel(item)}
      activeOpacity={0.7}
      style={[styles.entryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.entryHeader}>
        <Text style={[Typography.body, { color: colors.text, fontWeight: '600' }]}>
          {formatDisplayDateLong(item.date)}
        </Text>
        <Text style={[Typography.body, { color: colors.primary, fontWeight: '700' }]}>
          {formatCurrency(item.total_cost)}
        </Text>
      </View>
      <View style={styles.entryDetails}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
            {item.fuel_amount} {item.fuel_unit} · {formatCurrency(item.price_per_unit)}/{item.fuel_unit === 'kWh' ? 'kWh' : item.fuel_unit === 'kg' ? 'kg' : 'L'}
          </Text>
          {item.fuel_system === 'secondary' && selectedVehicle && (
            <View style={[styles.badge, { backgroundColor: '#FEF3C7', paddingVertical: 1, paddingHorizontal: 6 }]}>
              <Text style={[Typography.caption, { color: '#B45309', fontWeight: '700', fontSize: 10 }]}>
                {getFuelSystemLabel(selectedVehicle.fuel_type as FuelType, 'secondary')}
              </Text>
            </View>
          )}
          {item.fuel_system === 'primary' && selectedVehicle && isHybridFuel(selectedVehicle.fuel_type as FuelType) && (
            <View style={[styles.badge, { backgroundColor: colors.primaryLight, paddingVertical: 1, paddingHorizontal: 6 }]}>
              <Text style={[Typography.caption, { color: colors.primary, fontWeight: '700', fontSize: 10 }]}>
                {getFuelSystemLabel(selectedVehicle.fuel_type as FuelType, 'primary')}
              </Text>
            </View>
          )}
        </View>
        <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
          {item.odometer.toLocaleString('en-IN')} km
        </Text>
      </View>
      {item.fuel_station ? (
        <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
          📍 {item.fuel_station}
        </Text>
      ) : null}
      {item.calculated_mileage && item.mileage_unit ? (
        <View style={[styles.badge, { backgroundColor: colors.successLight }]}>
          <Text style={[Typography.caption, { color: colors.success }]}>
            {item.calculated_mileage.toFixed(1)} {MILEAGE_UNIT_LABELS[item.mileage_unit]}
          </Text>
        </View>
      ) : null}
      {!item.calculated_mileage && item.is_full_tank === 0 ? (
        <View style={[styles.badge, { backgroundColor: colors.warningLight }]}>
          <Text style={[Typography.caption, { color: colors.warning }]}>Partial Fill</Text>
        </View>
      ) : null}
      <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
        Tap to edit · Long press to delete
      </Text>
    </TouchableOpacity>
  );

  const renderServiceRecord = ({ item }: { item: ServiceRecord }) => (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/add-service', params: { id: item.id } })}
      onLongPress={() => handleDeleteService(item)}
      activeOpacity={0.7}
      style={[styles.entryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.entryHeader}>
        <Text style={[Typography.body, { color: colors.text, fontWeight: '600' }]}>
          {item.service_type}
        </Text>
        {item.cost != null && (
          <Text style={[Typography.body, { color: colors.primary, fontWeight: '700' }]}>
            {formatCurrency(item.cost)}
          </Text>
        )}
      </View>
      <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
        {formatDisplayDateLong(item.date)}
        {item.garage_name ? ` · ${item.garage_name}` : ''}
      </Text>
      {item.work_done ? (
        <Text style={[Typography.bodySmall, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
          {item.work_done}
        </Text>
      ) : null}
      <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
        Tap to edit · Long press to delete
      </Text>
    </TouchableOpacity>
  );

  const renderExpense = ({ item }: { item: Expense }) => (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/add-expense', params: { id: item.id } })}
      onLongPress={() => handleDeleteExpense(item)}
      activeOpacity={0.7}
      style={[styles.entryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.entryHeader}>
        <Text style={[Typography.body, { color: colors.text, fontWeight: '600' }]}>
          {item.category}
        </Text>
        <Text style={[Typography.body, { color: colors.accent, fontWeight: '700' }]}>
          {formatCurrency(item.amount)}
        </Text>
      </View>
      <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
        {formatDisplayDateLong(item.date)}
      </Text>
      {item.description ? (
        <Text style={[Typography.bodySmall, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
          {item.description}
        </Text>
      ) : null}
      <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
        Tap to edit · Long press to delete
      </Text>
    </TouchableOpacity>
  );

  // ── Empty state ───────────────────────────────────────────────────
  const renderEmpty = (type: string, isFiltered: boolean) => (
    <View style={styles.emptyState}>
      <Text style={{ fontSize: 48, marginBottom: Spacing.lg }}>
        {isFiltered ? '🔍' : type === 'fuel' ? '⛽' : type === 'service' ? '🔧' : '💰'}
      </Text>
      <Text style={[Typography.h3, { color: colors.text }]}>
        {isFiltered ? 'No results found' : `No ${type} entries yet`}
      </Text>
      <Text style={[Typography.bodySmall, { color: colors.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
        {isFiltered
          ? 'Try a different search term or date range.'
          : type === 'fuel'
          ? 'Tap ⛽ Add Fuel on the Home screen to record a refill.'
          : type === 'service'
          ? "Tap 🔧 below to record your vehicle's latest maintenance."
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

  const isFiltered = query.length > 0 || dateRange !== 'all';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Vehicle Context ── */}
      <VehicleContextHeader label="History for" />

      {/* ── Segmented Tabs ── */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {(['fuel', 'service', 'expenses'] as Tab[]).map((t) => (
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
              {t === 'fuel' ? `Fuel (${tabCounts.fuel})` : t === 'service' ? `Service (${tabCounts.service})` : `Expenses (${tabCounts.expenses})`}
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
              tab === 'fuel' ? 'Search by station, notes, date…'
              : tab === 'service' ? 'Search by service type, garage…'
              : 'Search by category, description…'
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
              {tab === 'fuel' ? filteredFuel.length : tab === 'service' ? filteredService.length : filteredExpenses.length}
              {' '}result{(tab === 'fuel' ? filteredFuel.length : tab === 'service' ? filteredService.length : filteredExpenses.length) !== 1 ? 's' : ''}
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
          data={filteredFuel}
          keyExtractor={(item) => item.id}
          renderItem={renderFuelEntry}
          contentContainerStyle={styles.list}
          ListEmptyComponent={renderEmpty('fuel', isFiltered)}
          keyboardShouldPersistTaps="handled"
        />
      )}
      {tab === 'service' && (
        <FlatList
          data={filteredService}
          keyExtractor={(item) => item.id}
          renderItem={renderServiceRecord}
          contentContainerStyle={styles.list}
          ListEmptyComponent={renderEmpty('service', isFiltered)}
          keyboardShouldPersistTaps="handled"
        />
      )}
      {tab === 'expenses' && (
        <FlatList
          data={filteredExpenses}
          keyExtractor={(item) => item.id}
          renderItem={renderExpense}
          contentContainerStyle={styles.list}
          ListEmptyComponent={renderEmpty('expenses', isFiltered)}
          keyboardShouldPersistTaps="handled"
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

  // ── Entry card ──
  entryCard: {
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  entryDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Sizing.radiusFull,
    marginTop: Spacing.sm,
  },

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
