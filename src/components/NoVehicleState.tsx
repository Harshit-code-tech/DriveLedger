/**
 * NoVehicleState — Empty State Component
 *
 * Shown on form screens when no vehicle is selected.
 * Previously duplicated identically in 4+ screens.
 *
 * Simple, non-intrusive — just tells the user what to do.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Typography, Spacing } from '@/constants/theme';

interface NoVehicleStateProps {
  /** Whether to show the close button at the top */
  showCloseButton?: boolean;
}

export function NoVehicleState({ showCloseButton = true }: NoVehicleStateProps) {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {showCloseButton && (
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <Text style={[Typography.body, { color: colors.primary }]}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.content}>
        <Text style={styles.emoji}>🚗</Text>
        <Text style={[Typography.h2, { color: colors.text, textAlign: 'center' }]}>
          No Vehicle Selected
        </Text>
        <Text
          style={[
            Typography.body,
            { color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm },
          ]}
        >
          Add a vehicle first from the Home or Settings tab.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.section,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  headerButton: { width: 60 },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
  },
  emoji: {
    fontSize: 48,
    marginBottom: Spacing.lg,
  },
});
