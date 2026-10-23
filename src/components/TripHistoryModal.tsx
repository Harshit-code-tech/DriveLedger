/**
 * Trip History Modal
 *
 * Displays a list of logged trips (both offline GPS and manual entries)
 * for the selected vehicle.
 *
 * Integrates with tripStore and opens TripDetailModal for in-depth timeline inspection.
 */

import React, { useState } from 'react';
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

interface TripHistoryModalProps {
  visible: boolean;
  vehicle: Vehicle;
  onStartGpsTrip: () => void;
  onLogManualTrip: () => void;
  onClose: () => void;
}

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

  const totalTripDistance = trips.reduce((sum, t) => sum + t.distance_km, 0);

  const renderHeader = () => (
    <View style={styles.headerBlock}>
      {/* Action Buttons: GPS or Manual */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          onPress={onStartGpsTrip}
          activeOpacity={0.8}
        >
          <Text style={[Typography.button, { color: colors.primaryText, fontSize: 14 }]}>
            📍 Start GPS Trip
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.actionBtn,
            { backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 1 },
          ]}
          onPress={onLogManualTrip}
          activeOpacity={0.8}
        >
          <Text style={[Typography.button, { color: colors.primary, fontSize: 14 }]}>
            ✍️ Log Manual Trip
          </Text>
        </TouchableOpacity>
      </View>

      {/* Summary Card */}
      {trips.length > 0 && (
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[Typography.caption, { color: colors.textSecondary }]}>
            TOTAL RECORDED TRIP DISTANCE
          </Text>
          <Text style={[styles.summaryStat, { color: colors.primary }]}>
            {totalTripDistance.toFixed(1)} km
          </Text>
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
            paddingTop: Spacing.xl,
            paddingBottom: insets.bottom + Spacing.sm,
          },
        ]}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <View>
            <Text style={[Typography.h2, { color: colors.text }]}>
              Vehicle Trips
            </Text>
            <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
              {vehicle.nickname} · {trips.length} {trips.length === 1 ? 'trip' : 'trips'} logged
            </Text>
          </View>
          <TouchableOpacity onPress={onClose}>
            <Text style={[Typography.body, { color: colors.primary, fontWeight: '600' }]}>
              Done
            </Text>
          </TouchableOpacity>
        </View>

        {/* Virtualized Trips List */}
        <FlatList
          data={trips}
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
              <Text style={styles.emptyIcon}>🚗</Text>
              <Text style={[Typography.body, { color: colors.text, fontWeight: '600' }]}>
                No trips logged yet
              </Text>
              <Text
                style={[
                  Typography.bodySmall,
                  { color: colors.textSecondary, textAlign: 'center', marginTop: 4 },
                ]}
              >
                Track trips using offline GPS or log them manually using start and end odometer readings.
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />

        {/* Dedicated GPS/Manual Trip Detail Modal */}
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
    paddingHorizontal: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerBlock: {
    marginBottom: Spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: Sizing.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: {
    padding: Spacing.md,
    borderRadius: Sizing.radiusLg,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: Spacing.sm,
    ...Sizing.cardShadow,
  },
  summaryStat: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 2,
  },
  listContent: {
    paddingBottom: Spacing.xxl,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: Spacing.sm,
  },
});
