/**
 * Trip History Modal
 *
 * Displays a list of logged trips (both offline GPS and manual entries)
 * for the selected vehicle.
 *
 * DESIGN:
 * - Technical Automotive Cockpit aesthetic matching Original Blue — Refined
 * - Prominent action buttons: Start GPS Trip (Orange Accent) & Log Manual Trip
 * - High-density trip summary metrics (Total distance, total count, avg distance)
 * - Category filter chips (All, GPS, Manual)
 * - Virtualized FlatList of redesigned TripSummaryCard
 * - Integrates with tripStore and opens TripDetailModal for in-depth telemetry inspection
 */

import React, { useMemo, useState } from 'react';
import {
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
import { useTripStore } from '@/stores/tripStore';
import type { Vehicle } from '@/types/vehicle';
import type { Trip } from '@/types/trip';
import { TripSummaryCard } from './TripSummaryCard';
import { TripDetailModal } from './TripDetailModal';

export interface TripHistoryModalProps {
  visible: boolean;
  vehicle: Vehicle;
  onStartGpsTrip: () => void;
  onLogManualTrip: () => void;
  onClose: () => void;
}

type TripFilterType = 'all' | 'gps' | 'manual';

export function TripHistoryModal({
  visible,
  vehicle,
  onStartGpsTrip,
  onLogManualTrip,
  onClose,
}: TripHistoryModalProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const trips = useTripStore((s) => s.trips);
  const deleteTrip = useTripStore((s) => s.deleteTrip);

  const [selectedTripForDetail, setSelectedTripForDetail] = useState<Trip | null>(null);
  const [filterType, setFilterType] = useState<TripFilterType>('all');

  // Filtered trips
  const filteredTrips = useMemo(() => {
    if (filterType === 'gps') {
      return trips.filter((t) => t.trip_type === 'gps');
    }
    if (filterType === 'manual') {
      return trips.filter((t) => t.trip_type === 'manual');
    }
    return trips;
  }, [trips, filterType]);

  const gpsCount = useMemo(() => trips.filter((t) => t.trip_type === 'gps').length, [trips]);
  const manualCount = useMemo(() => trips.filter((t) => t.trip_type === 'manual').length, [trips]);

  const totalTripDistance = useMemo(() => {
    return trips.reduce((sum, t) => sum + (t.distance_km || 0), 0);
  }, [trips]);

  const avgDistance = useMemo(() => {
    return trips.length > 0 ? totalTripDistance / trips.length : 0;
  }, [trips, totalTripDistance]);

  if (!visible) return null;

  const handleDelete = (trip: Trip) => {
    Alert.alert(
      'Delete Trip Record? 🚗',
      `Are you sure you want to delete this trip record (${trip.distance_km.toFixed(1)} km)?\n\nDeleting this trip will not roll back your vehicle odometer.`,
      [
        { text: 'Keep It', style: 'cancel' },
        {
          text: 'Delete It',
          style: 'destructive',
          onPress: () => {
            deleteTrip(trip.id, vehicle.id);
            if (selectedTripForDetail?.id === trip.id) {
              setSelectedTripForDetail(null);
            }
          },
        },
      ]
    );
  };

  const renderHeader = () => (
    <View style={styles.headerBlock}>
      {/* ── Action Buttons: GPS or Manual ── */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtnGps, { backgroundColor: colors.accent }]}
          onPress={() => {
            onClose();
            onStartGpsTrip();
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.actionBtnGpsText}>📍 Start GPS Trip</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionBtnManual,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={() => {
            onClose();
            onLogManualTrip();
          }}
          activeOpacity={0.8}
        >
          <Text style={[styles.actionBtnManualText, { color: colors.text }]}>
            ✍️ Log Manual Trip
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Telemetry Summary Banner ── */}
      {trips.length > 0 && (
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
              TOTAL RECORDED
            </Text>
            <Text style={[styles.summaryValue, { color: colors.primaryDark }]}>
              {totalTripDistance.toFixed(1)}
              <Text style={[styles.summaryUnit, { color: colors.textSecondary }]}> km</Text>
            </Text>
          </View>

          <View style={[styles.summaryDivider, { backgroundColor: colors.borderLight }]} />

          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
              TRIPS LOGGED
            </Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {trips.length}
            </Text>
          </View>

          <View style={[styles.summaryDivider, { backgroundColor: colors.borderLight }]} />

          <View style={styles.summaryItem}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
              AVG / TRIP
            </Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {avgDistance.toFixed(1)}
              <Text style={[styles.summaryUnit, { color: colors.textSecondary }]}> km</Text>
            </Text>
          </View>
        </View>
      )}

      {/* ── Filter Chips Row ── */}
      {trips.length > 2 && (
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              {
                backgroundColor:
                  filterType === 'all' ? colors.primaryDark : colors.surfaceSecondary,
                borderColor: filterType === 'all' ? colors.primaryDark : colors.border,
              },
            ]}
            onPress={() => setFilterType('all')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: filterType === 'all' ? '#FFFFFF' : colors.text },
              ]}
            >
              All ({trips.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              {
                backgroundColor:
                  filterType === 'gps' ? colors.primaryDark : colors.surfaceSecondary,
                borderColor: filterType === 'gps' ? colors.primaryDark : colors.border,
              },
            ]}
            onPress={() => setFilterType('gps')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: filterType === 'gps' ? '#FFFFFF' : colors.text },
              ]}
            >
              🛰️ GPS ({gpsCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              {
                backgroundColor:
                  filterType === 'manual' ? colors.primaryDark : colors.surfaceSecondary,
                borderColor: filterType === 'manual' ? colors.primaryDark : colors.border,
              },
            ]}
            onPress={() => setFilterType('manual')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: filterType === 'manual' ? '#FFFFFF' : colors.text },
              ]}
            >
              ✍️ Manual ({manualCount})
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

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
            paddingTop: Math.max(insets.top, Spacing.sm) + Spacing.sm,
            paddingBottom: insets.bottom + Spacing.sm,
          },
        ]}
      >
        {/* ── Top Header Bar ── */}
        <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: colors.surfaceSecondary }]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={[styles.closeBtnText, { color: colors.textSecondary }]}>✕</Text>
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: colors.text }]}>Vehicle Trips</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {vehicle.nickname} · {vehicle.registration_number}
            </Text>
          </View>

          <TouchableOpacity
            onPress={onClose}
            style={[styles.doneBtn, { backgroundColor: colors.surfaceSecondary }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.doneBtnText, { color: colors.primary }]}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* ── Virtualized Trips List ── */}
        <FlatList
          data={filteredTrips}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TripSummaryCard
              trip={item}
              vehicleName={vehicle.nickname}
              onPress={(t) => setSelectedTripForDetail(t)}
              onDelete={handleDelete}
            />
          )}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconWrap, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={styles.emptyIcon}>🚗</Text>
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No trips logged yet
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Record journeys using real-time offline GPS telemetry or log manual trips using start
                and end odometer readings.
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />

        {/* ── Dedicated GPS/Manual Trip Detail Modal ── */}
        <TripDetailModal
          visible={selectedTripForDetail !== null}
          trip={selectedTripForDetail}
          vehicle={vehicle}
          onClose={() => setSelectedTripForDetail(null)}
          onDelete={(id) => {
            deleteTrip(id, vehicle.id);
            setSelectedTripForDetail(null);
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    marginBottom: Spacing.sm,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: Sizing.radiusFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  doneBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Sizing.radiusFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  headerBlock: {
    marginBottom: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  actionBtnGps: {
    flex: 1,
    height: 48,
    borderRadius: Sizing.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  actionBtnGpsText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  actionBtnManual: {
    flex: 1,
    height: 48,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnManualText: {
    fontSize: 14,
    fontWeight: '700',
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  summaryUnit: {
    fontSize: 12,
    fontWeight: '600',
  },
  summaryDivider: {
    width: 1,
    height: 28,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: Spacing.xxxl,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    paddingHorizontal: Spacing.xl,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: Sizing.radiusFull,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyIcon: {
    fontSize: 28,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
