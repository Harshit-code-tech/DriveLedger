/**
 * DocumentsHeader
 *
 * Top screen header displaying the tab title "Documents" and live document count badge.
 * Consistent with RecordsHeader and other tab headers.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Spacing } from '@/constants/theme';
import type { DocumentPalette } from './documentTheme';

interface DocumentsHeaderProps {
  totalCount: number;
  colors: DocumentPalette;
}

export const DocumentsHeader = React.memo(function DocumentsHeader({
  totalCount,
  colors,
}: DocumentsHeaderProps) {
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.borderLight,
        },
      ]}
    >
      <View style={styles.titleRow}>
        <View style={styles.titleGroup}>
          <Text style={[styles.tabTitle, { color: colors.text }]}>Documents</Text>
          <View
            style={[
              styles.countBadge,
              { backgroundColor: colors.surfaceSecondary },
            ]}
          >
            <Text style={[styles.countBadgeText, { color: colors.accentDark }]}>
              {totalCount}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleRow: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

