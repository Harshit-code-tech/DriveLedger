/**
 * SettingsRow
 *
 * A tappable row for use in settings screens.
 * Displays an emoji icon, a title, an optional subtitle, and an optional
 * right-aligned text badge or a chevron (>) default.
 *
 * Originally defined inline in app/(tabs)/settings.tsx; extracted so
 * it can be reused by any screen that builds a settings-style list.
 *
 * USAGE:
 *   <SettingsRow
 *     emoji="💾"
 *     title="Backup Data"
 *     subtitle="Export to .dlbak file"
 *     onPress={handleBackup}
 *     colors={colors}
 *   />
 *
 *   // Danger variant (red title text):
 *   <SettingsRow emoji="🗑️" title="Delete Vehicle" onPress={handleDelete} colors={colors} danger />
 *
 *   // Right text badge:
 *   <SettingsRow emoji="🇮🇳" title="Currency" rightText="₹ INR" onPress={openPicker} colors={colors} />
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';

export interface SettingsRowProps {
  /** Emoji or short icon character shown on the left. */
  emoji: string;
  /** Primary label text. */
  title: string;
  /** Optional descriptive sub-label below the title. */
  subtitle?: string;
  /** Called when the row is tapped. */
  onPress?: () => void;
  /** Theme colours from useThemeColors(). */
  colors: ReturnType<typeof useThemeColors>;
  /** When true, renders the title in the danger/red colour. */
  danger?: boolean;
  /** When provided, replaces the default chevron with this text (e.g. current value). */
  rightText?: string;
}

export function SettingsRow({
  emoji, title, subtitle, onPress, colors, danger, rightText,
}: SettingsRowProps) {
  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.emoji}>{emoji}</Text>
      <View style={styles.textBlock}>
        <Text style={[Typography.body, { color: danger ? colors.danger : colors.text }]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>{subtitle}</Text>
        )}
      </View>
      <Text
        style={{
          color: rightText ? colors.primary : colors.textTertiary,
          fontSize: rightText ? 13 : 18,
          fontWeight: rightText ? '700' : '400',
        }}
      >
        {rightText ?? '\u203a'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
    minHeight: 52,
  },
  emoji: {
    fontSize: 20,
    marginRight: 12,
    width: 28,
    textAlign: 'center',
  },
  textBlock: {
    flex: 1,
  },
});
