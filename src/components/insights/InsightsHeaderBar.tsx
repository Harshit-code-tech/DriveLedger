/**
 * InsightsHeaderBar Component
 *
 * Dedicated top header for the Insights tab:
 * - Matches DocumentsHeader and RecordsHeader design language
 * - Prominent "Insights" title with active section badge
 * - "☰" Hamburger button to trigger the Jump To modal
 * - Quick "📄 Export" and "📤 Share" action buttons
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Spacing, Sizing } from '@/constants/theme';
import type { InsightsPalette } from './insightsTheme';
import type { InsightsSection } from './insightsHelpers';

interface InsightsHeaderBarProps {
  activeSection: InsightsSection;
  onOpenJumpTo: () => void;
  onExport: () => void;
  onShare: () => void;
  colors: InsightsPalette;
}

export const InsightsHeaderBar: React.FC<InsightsHeaderBarProps> = ({
  activeSection,
  onOpenJumpTo,
  onExport,
  onShare,
  colors,
}) => {
  const getSectionBadge = (sec: InsightsSection) => {
    switch (sec) {
      case 'overview':
        return 'Overview';
      case 'spending':
        return 'Spending';
      case 'efficiency':
        return 'Efficiency';
      case 'statistics':
        return 'Statistics';
      case 'fleet':
        return 'Garage';
      default:
        return 'Overview';
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.divider,
        },
      ]}
    >
      <View style={styles.contentRow}>
        {/* Title and Active Badge */}
        <View style={styles.titleGroup}>
          <Text style={[styles.tabTitle, { color: colors.text }]}>Insights</Text>
          <View style={[styles.badge, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Text style={[styles.badgeText, { color: colors.accent }]}>
              {getSectionBadge(activeSection)}
            </Text>
          </View>
        </View>

        {/* Right Actions: Export, Share, and Hamburger Menu */}
        <View style={styles.actionsGroup}>
          <TouchableOpacity
            onPress={onExport}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Export vehicle reports"
            style={[styles.headerActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={styles.actionIcon}>📄</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onShare}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Share vehicle summary"
            style={[styles.headerActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={styles.actionIcon}>📤</Text>
          </TouchableOpacity>

          {/* Hamburger Menu Button */}
          <TouchableOpacity
            onPress={onOpenJumpTo}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open jump to menu"
            style={[
              styles.hamburgerBtn,
              {
                backgroundColor: colors.accent + '15',
                borderColor: colors.accent + '35',
              },
            ]}
          >
            <View style={styles.hamburgerIconWrap}>
              <View style={[styles.hamburgerLine, { backgroundColor: colors.accent }]} />
              <View style={[styles.hamburgerLine, { backgroundColor: colors.accent, width: 14 }]} />
              <View style={[styles.hamburgerLine, { backgroundColor: colors.accent }]} />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
  },
  contentRow: {
    height: 48,
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
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 15,
  },
  hamburgerBtn: {
    width: 38,
    height: 36,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  hamburgerIconWrap: {
    width: 18,
    height: 14,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  hamburgerLine: {
    width: 18,
    height: 2,
    borderRadius: 1,
  },
});

