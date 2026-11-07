/**
 * FormHeader — Shared Form Screen Header
 *
 * Consistent Cancel — Title — (spacer) layout used by
 * add-fuel, add-service, add-expense, and add-document screens.
 *
 * Keeps the header pattern DRY while allowing per-screen customization.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Typography, Spacing, Sizing } from '@/constants/theme';

interface FormHeaderProps {
  /** The title displayed in the center */
  title: string;
  /** Optional subtitle displayed beneath the title */
  subtitle?: string;
  /** Override the default "Cancel" back action */
  onCancel?: () => void;
  /** Optional right-side action button or widget */
  rightAction?: React.ReactNode;
}

export function FormHeader({ title, subtitle, onCancel, rightAction }: FormHeaderProps) {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.border,
          paddingTop: Math.max(insets.top, Spacing.sm) + Spacing.sm,
        },
      ]}
    >
      <TouchableOpacity
        onPress={onCancel ?? (() => router.back())}
        style={[styles.headerButton, { backgroundColor: colors.surfaceSecondary }]}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Cancel and go back"
      >
        <Text style={[styles.cancelText, { color: colors.textSecondary }]}>✕</Text>
      </TouchableOpacity>

      <View style={styles.titleContainer}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.rightContainer}>
        {rightAction || <View style={styles.headerButtonPlaceholder} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: Sizing.radiusFull,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonPlaceholder: {
    width: 36,
    height: 36,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '700',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
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
  rightContainer: {
    minWidth: 36,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
