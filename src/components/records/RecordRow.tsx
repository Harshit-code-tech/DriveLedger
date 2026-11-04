/**
 * RecordRow
 *
 * Rich, informative, beautiful record card for every domain:
 * - Fuel: Title, quantity, price/unit, fuel station, mileage badge, cost, odometer, edit/delete hint.
 * - Service: Service type, garage, full work done, parts/component tags, invoice badge, next due.
 * - Expense: Category, amount, full description, receipt badge, notes.
 * - Trip: Date, time range, distance, duration, GPS vs manual badge, odometer range, purpose tag, inspect GPS route.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { FuelEntry } from '@/types/fuel';
import type { ServiceRecord, MaintenanceComponent } from '@/types/service';
import type { Expense } from '@/types/expense';
import type { Trip } from '@/types/trip';
import type { Vehicle } from '@/types/vehicle';
import { MILEAGE_UNIT_LABELS, type MileageUnit } from '@/constants/fuelTypes';
import { TyreIcon } from '@/components/TyreIcon';
import { formatDisplayDateLong } from '@/utils/date';
import { formatCurrency } from '@/utils/format';
import { formatTripDuration } from '@/components/TripSummaryCard';
import type { RecordItem } from './recordTypes';
import type { RecordPalette } from './recordTheme';
import {
  CategoryFuelIcon,
  CategoryElectricIcon,
  CategoryServiceIcon,
  CategoryTripIcon,
  CategoryExpenseIcon,
} from './RecordSvgIcons';

interface RecordRowProps {
  item: RecordItem;
  onPress: (item: RecordItem) => void;
  onLongPress: (item: RecordItem) => void;
  colors: RecordPalette;
  isEV?: boolean;
  selectedVehicle?: Vehicle | null;
}

function renderComponentTagIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes('tyre') || lower.includes('tire')) {
    return <TyreIcon size={12} />;
  }
  if (lower.includes('oil filter')) return <Text style={{ fontSize: 10 }}>⚙️</Text>;
  if (lower.includes('oil')) return <Text style={{ fontSize: 10 }}>🛢️</Text>;
  if (lower.includes('brake')) return <Text style={{ fontSize: 10 }}>🛑</Text>;
  if (lower.includes('spark')) return <Text style={{ fontSize: 10 }}>⚡</Text>;
  if (lower.includes('battery')) return <Text style={{ fontSize: 10 }}>🔋</Text>;
  if (lower.includes('air')) return <Text style={{ fontSize: 10 }}>💨</Text>;
  if (lower.includes('coolant')) return <Text style={{ fontSize: 10 }}>🧪</Text>;
  if (lower.includes('belt')) return <Text style={{ fontSize: 10 }}>🔄</Text>;
  return <Text style={{ fontSize: 10 }}>⚙️</Text>;
}

export const RecordRow = React.memo(function RecordRow({
  item,
  onPress,
  onLongPress,
  colors,
  isEV = false,
  selectedVehicle,
}: RecordRowProps) {
  // ── 1. FUEL ENTRY ──────────────────────────────────────────────────
  if (item.type === 'fuel') {
    const entry = item.raw as FuelEntry;
    const unit = entry.fuel_unit === 'kWh' ? 'kWh' : entry.fuel_unit === 'kg' ? 'kg' : 'L';

    return (
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.borderLight,
          },
        ]}
        onPress={() => onPress(item)}
        onLongPress={() => onLongPress(item)}
        activeOpacity={0.75}
      >
        {/* Header Row: Title & Total Cost */}
        <View style={styles.cardHeader}>
          <View style={styles.titleWithIcon}>
            <View style={[styles.iconBadge, { backgroundColor: colors.surfaceSecondary }]}>
              {isEV ? (
                <CategoryElectricIcon size={16} color={colors.accent} />
              ) : (
                <CategoryFuelIcon size={16} color={colors.accent} />
              )}
            </View>
            <View>
              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.cardDate, { color: colors.textSecondary }]}>
                {formatDisplayDateLong(entry.date)}
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <Text style={[styles.costHighlight, { color: colors.accent }]}>
              {formatCurrency(entry.total_cost)}
            </Text>
            <Text style={[styles.odometerSubtext, { color: colors.textSecondary }]}>
              {entry.odometer.toLocaleString('en-IN')} km
            </Text>
          </View>
        </View>

        {/* Quantity & Unit Price */}
        <View style={styles.detailsRow}>
          <Text style={[styles.quantityText, { color: colors.text }]}>
            {entry.fuel_amount} {unit}
          </Text>
          <Text style={[styles.unitPriceText, { color: colors.textSecondary }]}>
            · {formatCurrency(entry.price_per_unit)}/{unit}
          </Text>
        </View>

        {/* Station / Place */}
        {entry.fuel_station ? (
          <View style={styles.stationRow}>
            <Text style={[styles.stationText, { color: colors.textSecondary }]}>
              {isEV ? '⚡ ' : '📍 '}
              {entry.fuel_station}
            </Text>
          </View>
        ) : null}

        {/* Mileage badge / Partial Fill / Battery Delta */}
        <View style={styles.badgeWrapRow}>
          {entry.calculated_mileage && entry.mileage_unit ? (
            <View style={[styles.mileageBadge, { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }]}>
              <Text style={[styles.mileageBadgeText, { color: '#166534' }]}>
                ⭐ {entry.calculated_mileage.toFixed(1)}{' '}
                {MILEAGE_UNIT_LABELS[entry.mileage_unit as MileageUnit] || 'km/L'}
              </Text>
            </View>
          ) : null}

          {!entry.calculated_mileage && entry.is_full_tank === 0 ? (
            <View style={[styles.warningBadge, { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }]}>
              <Text style={[styles.warningBadgeText, { color: '#B45309' }]}>
                Partial Fill
              </Text>
            </View>
          ) : null}

          {entry.battery_start_percent != null && entry.battery_end_percent != null && (
            <View style={[styles.batteryBadge, { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.batteryBadgeText, { color: colors.text }]}>
                🔋 {entry.battery_start_percent}% → {entry.battery_end_percent}% (+
                {Math.round(entry.battery_end_percent - entry.battery_start_percent)}%)
              </Text>
            </View>
          )}

          {entry.notes ? (
            <Text style={[styles.notesText, { color: colors.textTertiary }]} numberOfLines={1}>
              "{entry.notes}"
            </Text>
          ) : null}
        </View>

        {/* Footer Hint */}
        <View style={[styles.cardFooter, { borderTopColor: colors.borderLight }]}>
          <Text style={[styles.footerHint, { color: colors.textTertiary }]}>
            Tap to edit · Long press to delete
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  // ── 2. SERVICE & MAINTENANCE ───────────────────────────────────────
  if (item.type === 'service') {
    const record = item.raw as ServiceRecord;
    const components = item.components || [];

    return (
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.borderLight,
          },
        ]}
        onPress={() => onPress(item)}
        onLongPress={() => onLongPress(item)}
        activeOpacity={0.75}
      >
        {/* Header Row: Service Type & Cost */}
        <View style={styles.cardHeader}>
          <View style={styles.titleWithIcon}>
            <View style={[styles.iconBadge, { backgroundColor: colors.surfaceSecondary }]}>
              <CategoryServiceIcon size={16} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                {record.service_type}
              </Text>
              <Text style={[styles.cardDate, { color: colors.textSecondary }]}>
                {formatDisplayDateLong(record.date)}
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            {record.cost != null && record.cost > 0 ? (
              <Text style={[styles.costHighlight, { color: colors.accent }]}>
                {formatCurrency(record.cost)}
              </Text>
            ) : (
              <Text style={[styles.costHighlight, { color: colors.textSecondary, fontSize: 13 }]}>
                Free
              </Text>
            )}
            {record.odometer != null && (
              <Text style={[styles.odometerSubtext, { color: colors.textSecondary }]}>
                {Math.round(record.odometer).toLocaleString('en-IN')} km
              </Text>
            )}
          </View>
        </View>

        {/* Garage / Service Center */}
        {record.garage_name ? (
          <View style={styles.stationRow}>
            <Text style={[styles.stationText, { color: colors.textSecondary }]}>
              🏢 {record.garage_name}
            </Text>
          </View>
        ) : null}

        {/* Work Done / Full Description (never truncated) */}
        {record.work_done ? (
          <View style={styles.fullDescriptionBox}>
            <Text style={[styles.fullDescriptionText, { color: colors.text }]}>
              {record.work_done}
            </Text>
          </View>
        ) : null}

        {/* Serviced Parts & Component Tags */}
        {(components.length > 0 || !!record.receipt_photo_uri || !!record.next_due_km) && (
          <View style={styles.tagsContainer}>
            {components.map((c) => (
              <View
                key={c.id}
                style={[
                  styles.compTagPill,
                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight },
                ]}
              >
                {renderComponentTagIcon(c.component_name)}
                <Text style={[styles.compTagText, { color: colors.text }]}>
                  {c.component_name}
                  {c.brand ? ` (${c.brand})` : ''}
                </Text>
              </View>
            ))}

            {record.receipt_photo_uri ? (
              <View
                style={[
                  styles.compTagPill,
                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.accent },
                ]}
              >
                <Text style={{ fontSize: 10 }}>🧾</Text>
                <Text style={[styles.compTagText, { color: colors.accent, fontWeight: '700' }]}>
                  Invoice
                </Text>
              </View>
            ) : null}

            {record.next_due_km != null ? (
              <View
                style={[
                  styles.compTagPill,
                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight },
                ]}
              >
                <Text style={{ fontSize: 10 }}>📅</Text>
                <Text style={[styles.compTagText, { color: colors.textSecondary }]}>
                  Due at {record.next_due_km.toLocaleString('en-IN')} km
                </Text>
              </View>
            ) : null}
          </View>
        )}

        {record.notes ? (
          <Text style={[styles.notesText, { color: colors.textTertiary, marginTop: 4 }]}>
            "{record.notes}"
          </Text>
        ) : null}

        {/* Footer Hint */}
        <View style={[styles.cardFooter, { borderTopColor: colors.borderLight }]}>
          <Text style={[styles.footerHint, { color: colors.textTertiary }]}>
            Tap to edit · Long press to delete
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  // ── 3. EXPENSES (Tolls, Parking, Fastag, Challan, Wash, etc.) ───────
  if (item.type === 'expense') {
    const expense = item.raw as Expense;

    return (
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.borderLight,
          },
        ]}
        onPress={() => onPress(item)}
        onLongPress={() => onLongPress(item)}
        activeOpacity={0.75}
      >
        {/* Header Row: Category & Amount */}
        <View style={styles.cardHeader}>
          <View style={styles.titleWithIcon}>
            <View style={[styles.iconBadge, { backgroundColor: colors.surfaceSecondary }]}>
              <CategoryExpenseIcon size={16} color={colors.accent} />
            </View>
            <View>
              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                {expense.category}
              </Text>
              <Text style={[styles.cardDate, { color: colors.textSecondary }]}>
                {formatDisplayDateLong(expense.date)}
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <Text style={[styles.costHighlight, { color: colors.accent }]}>
              {formatCurrency(expense.amount)}
            </Text>
          </View>
        </View>

        {/* Full Description (never truncated!) */}
        {expense.description ? (
          <View style={styles.fullDescriptionBox}>
            <Text style={[styles.fullDescriptionText, { color: colors.text }]}>
              {expense.description}
            </Text>
          </View>
        ) : null}

        {/* Receipt Tag */}
        {expense.receipt_photo_uri ? (
          <View style={styles.tagsContainer}>
            <View
              style={[
                styles.compTagPill,
                { backgroundColor: colors.surfaceSecondary, borderColor: colors.accent },
              ]}
            >
              <Text style={{ fontSize: 10 }}>🧾</Text>
              <Text style={[styles.compTagText, { color: colors.accent, fontWeight: '700' }]}>
                Receipt attached
              </Text>
            </View>
          </View>
        ) : null}

        {/* Footer Hint */}
        <View style={[styles.cardFooter, { borderTopColor: colors.borderLight }]}>
          <Text style={[styles.footerHint, { color: colors.textTertiary }]}>
            Tap to edit · Long press to delete
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  // ── 4. TRIP RECORD ──────────────────────────────────────────────────
  const trip = item.raw as Trip;
  const isGps = trip.trip_type === 'gps';
  const durationText = formatTripDuration(trip.duration_seconds);

  // Time range string
  let timeRangeStr = '';
  if (trip.start_time.includes('T')) {
    const startTime = trip.start_time.split('T')[1]?.substring(0, 5) || '';
    const endTime =
      trip.end_time && trip.end_time.includes('T')
        ? trip.end_time.split('T')[1]?.substring(0, 5) || ''
        : '';
    timeRangeStr = endTime ? `${startTime} - ${endTime}` : startTime;
  }

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.borderLight,
        },
      ]}
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
      activeOpacity={0.75}
    >
      {/* Header Row: Date/Time & Type Badge */}
      <View style={styles.cardHeader}>
        <View style={styles.titleWithIcon}>
          <View style={[styles.iconBadge, { backgroundColor: colors.surfaceSecondary }]}>
            <CategoryTripIcon size={16} color={colors.accent} />
          </View>
          <View>
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
              {formatDisplayDateLong(trip.start_time.split('T')[0])}
            </Text>
            {timeRangeStr ? (
              <Text style={[styles.cardDate, { color: colors.textSecondary }]}>
                ⏱️ {timeRangeStr}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.headerRight}>
          <View
            style={[
              styles.typeBadge,
              {
                backgroundColor: isGps ? colors.surfaceSecondary : colors.surfaceSecondary,
                borderColor: isGps ? colors.accent : colors.borderLight,
              },
            ]}
          >
            <Text
              style={[
                styles.typeBadgeText,
                { color: isGps ? colors.accent : colors.textSecondary },
              ]}
            >
              {isGps ? '🛰️ GPS Trip' : '✍️ Manual'}
            </Text>
          </View>
        </View>
      </View>

      {/* Metrics Row: Distance & Duration */}
      <View style={styles.tripMetricsRow}>
        <View>
          <Text style={[styles.tripDistanceValue, { color: colors.text }]}>
            {trip.distance_km.toFixed(2)}{' '}
            <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary }}>km</Text>
          </Text>
          <Text style={[styles.tripDistanceLabel, { color: colors.textTertiary }]}>
            {isGps ? 'GPS ESTIMATE' : 'ODOMETER DISTANCE'}
          </Text>
        </View>

        {durationText && (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.tripDurationValue, { color: colors.text }]}>
              {durationText}
            </Text>
            <Text style={[styles.tripDistanceLabel, { color: colors.textTertiary }]}>
              DURATION
            </Text>
          </View>
        )}
      </View>

      {/* Odometer Range */}
      {trip.start_odometer != null && trip.end_odometer != null && (
        <View style={[styles.odometerRangeRow, { backgroundColor: colors.surfaceSecondary }]}>
          <Text style={[styles.odometerRangeText, { color: colors.textSecondary }]}>
            Odometer:{' '}
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {trip.start_odometer.toLocaleString('en-IN')}
            </Text>
            {' → '}
            <Text style={{ color: colors.text, fontWeight: '700' }}>
              {trip.end_odometer.toLocaleString('en-IN')} km
            </Text>
          </Text>
        </View>
      )}

      {/* Purpose Tag & Notes */}
      {(trip.purpose || trip.notes) && (
        <View style={styles.tagsContainer}>
          {trip.purpose ? (
            <View
              style={[
                styles.compTagPill,
                { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderLight },
              ]}
            >
              <Text style={{ fontSize: 10 }}>🏷️</Text>
              <Text style={[styles.compTagText, { color: colors.text }]}>{trip.purpose}</Text>
            </View>
          ) : null}

          {trip.notes ? (
            <Text style={[styles.notesText, { color: colors.textTertiary, flex: 1 }]}>
              "{trip.notes}"
            </Text>
          ) : null}
        </View>
      )}

      {/* Quality warning if any */}
      {trip.quality_warning ? (
        <View style={[styles.warningBadge, { backgroundColor: '#FEF3C7', borderColor: '#FCD34D', marginTop: 6 }]}>
          <Text style={[styles.warningBadgeText, { color: '#B45309' }]}>
            ⚠️ {trip.quality_warning}
          </Text>
        </View>
      ) : null}

      {/* Footer Action: Inspect GPS Timeline */}
      <View style={[styles.cardFooter, { borderTopColor: colors.borderLight }]}>
        <Text style={[styles.inspectRouteText, { color: colors.accent }]}>
          {isGps ? 'Inspect GPS Timeline & Route →' : 'View Trip Details →'}
        </Text>
        <Text style={[styles.footerHint, { color: colors.textTertiary }]}>
          Long press to delete
        </Text>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardDate: {
    fontSize: 12,
    marginTop: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  costHighlight: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  odometerSubtext: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 8,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '700',
  },
  unitPriceText: {
    fontSize: 13,
  },
  stationRow: {
    marginTop: 4,
  },
  stationText: {
    fontSize: 12,
    fontWeight: '500',
  },
  badgeWrapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  mileageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  mileageBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  warningBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  warningBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  batteryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  batteryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  notesText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  fullDescriptionBox: {
    marginTop: 6,
  },
  fullDescriptionText: {
    fontSize: 13,
    lineHeight: 18,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  compTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  compTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tripMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 10,
  },
  tripDistanceValue: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tripDistanceLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  tripDurationValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  odometerRangeRow: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 8,
  },
  odometerRangeText: {
    fontSize: 12,
  },
  inspectRouteText: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    marginTop: 8,
  },
  footerHint: {
    fontSize: 11,
  },
});
