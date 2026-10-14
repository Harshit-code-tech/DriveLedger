/**
 * Pre-Trip Highway Checklist Screen / Route
 *
 * Dedicated route for /checklist.
 * Accessible from:
 * - App Shortcuts / Quick Actions (Feature 4.1)
 * - Dashboard Highway Readiness Widget (Feature 4.3)
 */

import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useVehicleStore } from '@/stores/vehicleStore';
import { useDocumentStore } from '@/stores/documentStore';
import { useThemeColors } from '@/hooks/useThemeColors';
import { PreTripChecklistModal } from '@/components/PreTripChecklistModal';
import { Typography, Spacing, Sizing } from '@/constants/theme';

export default function ChecklistScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);
  const documents = useDocumentStore((s) => s.documents);

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  if (!selectedVehicle) {
    return (
      <View style={[styles.container, styles.emptyState, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: 48, marginBottom: Spacing.md }}>🚗</Text>
        <Text style={[Typography.h3, { color: colors.text }]}>No Vehicle Selected</Text>
        <Text style={[Typography.bodySmall, { color: colors.textSecondary, marginTop: Spacing.xs, textAlign: 'center' }]}>
          Add or select a vehicle to run the pre-trip inspection checklist.
        </Text>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary, marginTop: Spacing.xl }]}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={[Typography.button, { color: colors.textOnPrimary }]}>Go to Dashboard</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <PreTripChecklistModal
      visible={true}
      onClose={handleClose}
      vehicle={selectedVehicle}
      documents={documents}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxxl,
  },
  primaryButton: {
    height: Sizing.primaryButton,
    paddingHorizontal: Spacing.xxl,
    borderRadius: Sizing.radiusMd,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
