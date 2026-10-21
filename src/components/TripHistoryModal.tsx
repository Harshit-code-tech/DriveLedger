/**
 * Trip History Modal
 *
 * Displays a list of logged trips (both offline GPS and manual entries)
 * for the selected vehicle.
 *
 * Integrates with tripStore and allows starting trips or viewing summaries.
 */

import React, { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
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
import { formatDisplayDateLong } from '@/utils/date';

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

  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  if (!visible) return null;

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Trip?',
      'Are you sure you want to delete this trip record? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteTrip(id, vehicle.id);
            if (selectedTrip?.id === id) setSelectedTrip(null);
          },
        },
      ]
    );
  };

  const totalTripDistance = trips.reduce((sum, t) => sum + t.distance_km, 0);

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
            paddingBottom: insets.bottom + Spacing.lg,
          },
        ]}
      >
        {/* Header */}
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

        {/* Action Buttons: GPS or Manual */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={onStartGpsTrip}
          >
            <Text style={[Typography.button, { color: colors.primaryText, fontSize: 14 }]}>
              📍 Start GPS Trip
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 1 }]}
            onPress={onLogManualTrip}
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

        {/* Trips List */}
        <ScrollView contentContainerStyle={styles.listContent}>
          {trips.length === 0 ? (
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
          ) : (
            trips.map((trip) => {
              const isGps = trip.trip_type === 'gps';
              const durationMins = Math.round(trip.duration_seconds / 60);
              return (
                <View
                  key={trip.id}
                  style={[
                    styles.tripItem,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.tripTopRow}>
                    <View style={styles.tripDateGroup}>
                      <Text style={[Typography.body, { color: colors.text, fontWeight: '700' }]}>
                        {formatDisplayDateLong(trip.start_time.split('T')[0])}
                      </Text>
                      {trip.purpose && (
                        <Text style={[Typography.caption, { color: colors.textSecondary }]}>
                          {trip.purpose}
                        </Text>
                      )}
                    </View>

                    <View style={styles.badgeGroup}>
                      <View
                        style={[
                          styles.badge,
                          {
                            backgroundColor: isGps
                              ? colors.primaryLight
                              : colors.borderLight,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            Typography.caption,
                            {
                              color: isGps ? colors.primary : colors.textSecondary,
                              fontWeight: '700',
                            },
                          ]}
                        >
                          {isGps ? 'GPS' : 'Manual'}
                        </Text>
                      </View>

                      {trip.quality_warning && (
                        <View
                          style={[
                            styles.badge,
                            { backgroundColor: colors.warningLight },
                          ]}
                        >
                          <Text
                            style={[
                              Typography.caption,
                              { color: colors.warning, fontWeight: '700' },
                            ]}
                          >
                            Signal Gap
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Distance & Duration */}
                  <View style={styles.tripMetricsRow}>
                    <View>
                      <Text style={[styles.distanceText, { color: colors.primary }]}>
                        {trip.distance_km.toFixed(1)} km
                      </Text>
                    </View>
                    {durationMins > 0 && (
                      <View>
                        <Text style={[Typography.caption, { color: colors.textSecondary }]}>
                          Duration: {durationMins} mins
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Odometer info if present */}
                  {trip.start_odometer !== null && trip.end_odometer !== null && (
                    <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 4 }]}>
                      Odometer: {trip.start_odometer.toLocaleString()} → {trip.end_odometer.toLocaleString()} km
                    </Text>
                  )}

                  {/* Notes */}
                  {trip.notes && (
                    <Text
                      style={[
                        Typography.bodySmall,
                        { color: colors.textSecondary, marginTop: 6, fontStyle: 'italic' },
                      ]}
                    >
                      "{trip.notes}"
                    </Text>
                  )}

                  {/* Delete button */}
                  <View style={styles.deleteRow}>
                    <TouchableOpacity onPress={() => handleDelete(trip.id)}>
                      <Text style={[Typography.caption, { color: colors.danger, fontWeight: '600' }]}>
                        🗑️ Delete
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
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
    marginBottom: Spacing.md,
    ...Sizing.cardShadow,
  },
  summaryStat: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 2,
  },
  listContent: {
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: Spacing.sm,
  },
  tripItem: {
    padding: Spacing.md,
    borderRadius: Sizing.radiusLg,
    borderWidth: 1,
    ...Sizing.cardShadow,
  },
  tripTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tripDateGroup: {
    flex: 1,
  },
  badgeGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Sizing.radiusFull,
  },
  tripMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  distanceText: {
    fontSize: 22,
    fontWeight: '800',
  },
  deleteRow: {
    marginTop: Spacing.xs,
    paddingTop: 6,
    alignItems: 'flex-end',
  },
});
