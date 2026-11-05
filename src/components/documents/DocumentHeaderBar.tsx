/**
 * DocumentHeaderBar
 *
 * Section 7: Vehicle Documents Section Label & Sleek Export Report Action
 * Compact, refined section bar with spacious alignment.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Spacing } from '@/constants/theme';
import type { DocumentPalette } from './documentTheme';

interface DocumentHeaderBarProps {
  onExport: () => void;
  colors: DocumentPalette;
}

export const DocumentHeaderBar = React.memo(function DocumentHeaderBar({
  onExport,
  colors,
}: DocumentHeaderBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.titleWrap}>
        <Text style={[styles.title, { color: colors.text }]}>Vehicle Documents</Text>
      </View>

      <TouchableOpacity
        style={[
          styles.exportButton,
          {
            backgroundColor: colors.surfaceSecondary,
            borderColor: colors.border,
          },
        ]}
        onPress={onExport}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Export vehicle documents report"
      >
        <Text style={[styles.exportIcon, { color: colors.accent }]}>↓</Text>
        <Text style={[styles.exportText, { color: colors.accent }]}>Export Report</Text>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  exportIcon: {
    fontSize: 12,
    fontWeight: '700',
  },
  exportText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
