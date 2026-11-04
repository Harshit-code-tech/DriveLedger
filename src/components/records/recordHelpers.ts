/**
 * DriveLedger — Record Helpers
 *
 * Pure transformation, formatting, filtering, sorting, and grouping functions
 * for the Records page redesign defined in docs/refurnish/record.md.
 */

import type { FuelEntry } from '@/types/fuel';
import type { ServiceRecord, MaintenanceComponent } from '@/types/service';
import type { Expense } from '@/types/expense';
import type { Trip } from '@/types/trip';
import type { Vehicle } from '@/types/vehicle';
import { FUEL_TYPE_SHORT_LABELS, type FuelType } from '@/constants/fuelTypes';
import { formatCurrency } from '@/utils/format';
import { formatTripDuration } from '@/components/TripSummaryCard';
import type {
  RecordCategory,
  DateRangeOption,
  SortOrder,
  RecordItem,
  RecordSection,
} from './recordTypes';

const SHORT_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const FULL_MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

/**
 * Formats YYYY-MM-DD or ISO timestamp into "03 Nov" without timezone drift.
 */
export function formatDayMonth(dateStr: string): string {
  if (!dateStr) return '';
  const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const parts = datePart.split('-');
  if (parts.length >= 3) {
    const day = parts[2].padStart(2, '0');
    const monthIdx = parseInt(parts[1], 10) - 1;
    const month = SHORT_MONTH_NAMES[monthIdx] || parts[1];
    return `${day} ${month}`;
  }
  return dateStr;
}

/**
 * Formats YYYY-MM-DD or ISO timestamp into "NOVEMBER 2026" section label.
 */
export function formatMonthGroup(dateStr: string): string {
  if (!dateStr) return '';
  const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const parts = datePart.split('-');
  if (parts.length >= 2) {
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const month = FULL_MONTH_NAMES[monthIdx] || parts[1];
    return `${month} ${year}`;
  }
  return dateStr;
}

/**
 * Returns "YYYY-MM" key for group sorting.
 */
export function getMonthKey(dateStr: string): string {
  if (!dateStr) return '';
  const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const parts = datePart.split('-');
  if (parts.length >= 2) {
    return `${parts[0]}-${parts[1].padStart(2, '0')}`;
  }
  return dateStr;
}

/**
 * Checks whether an item's date falls within the selected date range.
 */
export function isDateInRange(dateStr: string, range: DateRangeOption): boolean {
  if (range === 'all') return true;
  if (!dateStr) return false;
  const itemDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const now = new Date();

  if (range === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return itemDate >= d.toISOString().split('T')[0];
  }
  if (range === 'month') {
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const startOfMonth = `${now.getFullYear()}-${m}-01`;
    return itemDate >= startOfMonth;
  }
  if (range === '30days') {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return itemDate >= d.toISOString().split('T')[0];
  }
  if (range === '3months') {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 3);
    return itemDate >= d.toISOString().split('T')[0];
  }
  if (range === 'year') {
    const startOfYear = `${now.getFullYear()}-01-01`;
    return itemDate >= startOfYear;
  }
  return true;
}

/**
 * Returns short abbreviation for fuel unit (e.g. 'litres' -> 'L').
 */
export function formatFuelUnitShort(unit?: string | null): string {
  if (!unit) return 'L';
  const u = unit.toLowerCase();
  if (u === 'litres' || u === 'litre' || u === 'l') {
    return 'L';
  }
  return unit;
}

/**
 * Maps a FuelEntry to a unified RecordItem with informative heading and details.
 */
export function mapFuelToRecordItem(entry: FuelEntry, vehicle?: Vehicle | null): RecordItem {
  const isEV = vehicle?.fuel_type === 'electric';
  const fuelShortLabel =
    (vehicle?.fuel_type && FUEL_TYPE_SHORT_LABELS[vehicle.fuel_type as FuelType]) ||
    vehicle?.fuel_type ||
    '';

  let title = 'Fuel Refill';
  if (isEV) {
    title = 'EV Charging Session';
  } else if (fuelShortLabel) {
    title = entry.is_full_tank ? `${fuelShortLabel} Full Tank` : `${fuelShortLabel} Partial Fill`;
  } else {
    title = entry.is_full_tank ? 'Full Tank Refill' : 'Partial Refill';
  }

  const dayMonth = formatDayMonth(entry.date);
  const detailLabel = entry.fuel_station || (isEV ? 'Electric Charge' : `${fuelShortLabel || 'Fuel'} Refill`);
  const subtitle = `${dayMonth} · ${detailLabel}`;

  const primaryValue = formatCurrency(entry.total_cost);
  const unitLabel = formatFuelUnitShort(entry.fuel_unit || (isEV ? 'kWh' : 'L'));
  const secondaryValue = `${entry.fuel_amount} ${unitLabel}`;

  const datePart = entry.date.includes('T') ? entry.date.split('T')[0] : entry.date;
  const parsedTime = new Date(datePart).getTime();
  const timestamp = isNaN(parsedTime) ? 0 : parsedTime;

  return {
    id: entry.id,
    type: 'fuel',
    date: datePart,
    timestamp,
    title,
    subtitle,
    primaryValue,
    secondaryValue,
    icon: isEV ? '⚡' : '⛽',
    raw: entry,
  };
}

/**
 * Maps a ServiceRecord to a unified RecordItem with parts/components tags.
 */
export function mapServiceToRecordItem(
  record: ServiceRecord,
  components?: MaintenanceComponent[]
): RecordItem {
  const dayMonth = formatDayMonth(record.date);
  const detailLabel = record.work_done || record.garage_name || record.service_type || 'Maintenance';
  const subtitle = `${dayMonth} · ${detailLabel}`;

  const primaryValue =
    record.cost != null && record.cost > 0 ? formatCurrency(record.cost) : 'Service';
  const secondaryValue =
    record.odometer != null ? `${record.odometer.toLocaleString('en-IN')} km` : undefined;

  const datePart = record.date.includes('T') ? record.date.split('T')[0] : record.date;
  const parsedTime = new Date(datePart).getTime();
  const timestamp = isNaN(parsedTime) ? 0 : parsedTime;

  return {
    id: record.id,
    type: 'service',
    date: datePart,
    timestamp,
    title: record.service_type || 'Maintenance',
    subtitle,
    primaryValue,
    secondaryValue,
    icon: '🔧',
    raw: record,
    components,
  };
}

/**
 * Maps an Expense to a unified RecordItem with full description and receipt awareness.
 */
export function mapExpenseToRecordItem(expense: Expense): RecordItem {
  const dayMonth = formatDayMonth(expense.date);
  const detailLabel = expense.description || expense.category;
  const subtitle = `${dayMonth} · ${detailLabel}`;

  const primaryValue = formatCurrency(expense.amount);

  const datePart = expense.date.includes('T') ? expense.date.split('T')[0] : expense.date;
  const parsedTime = new Date(datePart).getTime();
  const timestamp = isNaN(parsedTime) ? 0 : parsedTime;

  return {
    id: expense.id,
    type: 'expense',
    date: datePart,
    timestamp,
    title: expense.category,
    subtitle,
    primaryValue,
    secondaryValue: undefined,
    icon: '💰',
    raw: expense,
  };
}

/**
 * Maps a Trip to a unified RecordItem with GPS timeline and odometer awareness.
 */
export function mapTripToRecordItem(trip: Trip): RecordItem {
  const dayMonth = formatDayMonth(trip.start_time);
  const durationText = formatTripDuration(trip.duration_seconds);
  const detailLabel = durationText || (trip.trip_type === 'gps' ? 'GPS Trip' : 'Manual Trip');
  const subtitle = `${dayMonth} · ${detailLabel}`;

  const primaryValue = `${trip.distance_km.toFixed(2)} km`;
  const secondaryValue =
    trip.end_odometer != null ? `${trip.end_odometer.toLocaleString('en-IN')} km` : undefined;

  const datePart = trip.start_time.includes('T') ? trip.start_time.split('T')[0] : trip.start_time;
  const parsedTime = new Date(trip.start_time).getTime();
  const timestamp = isNaN(parsedTime) ? 0 : parsedTime;

  return {
    id: trip.id,
    type: 'trip',
    date: datePart,
    timestamp,
    title: trip.purpose ? trip.purpose : trip.trip_type === 'gps' ? 'GPS Trip' : 'Manual Trip',
    subtitle,
    primaryValue,
    secondaryValue,
    icon: trip.trip_type === 'gps' ? '🛰️' : '🚗',
    raw: trip,
  };
}

/**
 * Case-insensitive search match across existing record fields.
 */
export function matchesSearch(item: RecordItem, query: string): boolean {
  if (!query || !query.trim()) return true;
  const q = query.trim().toLowerCase();

  if (item.title.toLowerCase().includes(q)) return true;
  if (item.subtitle.toLowerCase().includes(q)) return true;
  if (item.primaryValue.toLowerCase().includes(q)) return true;
  if (item.secondaryValue && item.secondaryValue.toLowerCase().includes(q)) return true;
  if (item.date.includes(q)) return true;

  // Category search keywords
  if (item.type === 'fuel' && ('fuel'.includes(q) || 'petrol'.includes(q) || 'diesel'.includes(q) || 'cng'.includes(q) || 'charging'.includes(q))) {
    return true;
  }
  if (item.type === 'service' && ('service'.includes(q) || 'maintenance'.includes(q) || 'repair'.includes(q))) {
    return true;
  }
  if (item.type === 'expense' && ('expense'.includes(q) || 'cost'.includes(q) || 'toll'.includes(q) || 'parking'.includes(q))) {
    return true;
  }
  if (item.type === 'trip' && ('trip'.includes(q) || 'drive'.includes(q) || 'travel'.includes(q))) {
    return true;
  }

  // Raw fields match
  const raw = item.raw;
  if ('fuel_station' in raw && raw.fuel_station && raw.fuel_station.toLowerCase().includes(q)) return true;
  if ('notes' in raw && raw.notes && raw.notes.toLowerCase().includes(q)) return true;
  if ('garage_name' in raw && raw.garage_name && raw.garage_name.toLowerCase().includes(q)) return true;
  if ('work_done' in raw && raw.work_done && raw.work_done.toLowerCase().includes(q)) return true;
  if ('description' in raw && raw.description && raw.description.toLowerCase().includes(q)) return true;
  if ('purpose' in raw && raw.purpose && raw.purpose.toLowerCase().includes(q)) return true;

  if (item.components) {
    for (const c of item.components) {
      if (c.component_name.toLowerCase().includes(q)) return true;
      if (c.brand && c.brand.toLowerCase().includes(q)) return true;
    }
  }

  return false;
}

export interface FilterAndGroupOptions {
  fuelEntries: FuelEntry[];
  serviceRecords: ServiceRecord[];
  expenses: Expense[];
  trips: Trip[];
  vehicle: Vehicle | null;
  category: RecordCategory;
  dateRange: DateRangeOption;
  searchQuery: string;
  sortOrder: SortOrder;
  componentsByService?: Record<string, MaintenanceComponent[]>;
}

/**
 * Aggregates records, filters by category/date/search, sorts, and groups by month.
 */
export function filterAndGroupRecords(options: FilterAndGroupOptions): RecordSection[] {
  const {
    fuelEntries,
    serviceRecords,
    expenses,
    trips,
    vehicle,
    category,
    dateRange,
    searchQuery,
    sortOrder,
    componentsByService,
  } = options;

  let allItems: RecordItem[] = [];

  // Filter at collection stage based on category
  if (category === 'all' || category === 'fuel') {
    allItems.push(...fuelEntries.map((e) => mapFuelToRecordItem(e, vehicle)));
  }
  if (category === 'all' || category === 'service') {
    allItems.push(
      ...serviceRecords.map((s) =>
        mapServiceToRecordItem(s, componentsByService ? componentsByService[s.id] : undefined)
      )
    );
  }
  if (category === 'all' || category === 'expenses') {
    allItems.push(...expenses.map((e) => mapExpenseToRecordItem(e)));
  }
  if (category === 'all' || category === 'trips') {
    allItems.push(...trips.map((t) => mapTripToRecordItem(t)));
  }

  // Filter by date range
  if (dateRange !== 'all') {
    allItems = allItems.filter((item) => isDateInRange(item.date, dateRange));
  }

  // Filter by search query
  if (searchQuery && searchQuery.trim()) {
    allItems = allItems.filter((item) => matchesSearch(item, searchQuery));
  }

  // Sort records
  allItems.sort((a, b) => {
    if (sortOrder === 'newest') {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      if (b.timestamp !== a.timestamp) return b.timestamp - a.timestamp;
      return b.id.localeCompare(a.id);
    } else {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      return a.id.localeCompare(b.id);
    }
  });

  // Group by month
  const sectionMap = new Map<string, { title: string; monthKey: string; data: RecordItem[] }>();

  for (const item of allItems) {
    const monthKey = getMonthKey(item.date);
    let section = sectionMap.get(monthKey);
    if (!section) {
      section = {
        title: formatMonthGroup(item.date),
        monthKey,
        data: [],
      };
      sectionMap.set(monthKey, section);
    }
    section.data.push(item);
  }

  const sections = Array.from(sectionMap.values());

  // Sort sections
  sections.sort((a, b) => {
    return sortOrder === 'newest'
      ? b.monthKey.localeCompare(a.monthKey)
      : a.monthKey.localeCompare(b.monthKey);
  });

  return sections;
}
