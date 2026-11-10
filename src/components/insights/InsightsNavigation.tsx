/**
 * InsightsNavigation Component
 *
 * Section 3: Navigation structure for moving between dedicated analytical screens.
 * Redesigned into a unified, high-polish automotive control card:
 * - "← Overview" tactile breadcrumb back button
 * - Prominent Category Title & Subtitle block with themed squircle icon
 * - Sub-section classification badge (Financials, Performance, Telemetry, Garage)
 * - 4 segmented category tags (pills) with active indicator dot and smooth horizontal scroll
 */

import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Spacing, Sizing } from '@/constants/theme';
import type { InsightsPalette } from './insightsTheme';
import type { InsightsSection } from './insightsHelpers';

interface InsightsNavigationProps {
  activeSection: InsightsSection;
  onSelectSection: (section: InsightsSection) => void;
  colors: InsightsPalette;
  hasFleet: boolean;
}

export const InsightsNavigation: React.FC<InsightsNavigationProps> = memo(({
  activeSection,
  onSelectSection,
  colors,
  hasFleet,
}) => {
  const tabs = useMemo(
    () => [
      { id: 'spending' as InsightsSection, label: 'Spending', icon: '💳' },
      { id: 'efficiency' as InsightsSection, label: 'Efficiency', icon: '⚡' },
      { id: 'statistics' as InsightsSection, label: 'Statistics', icon: '📊' },
      ...(hasFleet ? [{ id: 'fleet' as InsightsSection, label: 'Garage', icon: '🚗' }] : []),
    ],
    [hasFleet],
  );

  const getCategoryMeta = (section: InsightsSection) => {
    switch (section) {
      case 'spending':
        return {
          title: 'Spending Analysis',
          subtitle: 'Fuel vs non-fuel split, breakdown & monthly trends',
          icon: '💳',
          iconBg: colors.accent + '18',
          badge: 'Financials',
        };
      case 'efficiency':
        return {
          title: 'Efficiency & Mileage',
          subtitle: 'Rolling averages, consumption trends & powertrain stats',
          icon: '⚡',
          iconBg: colors.tierGreen + '18',
          badge: 'Performance',
        };
      case 'statistics':
        return {
          title: 'Vehicle Statistics',
          subtitle: '6-month operating metrics & consumption KPIs',
          icon: '📊',
          iconBg: colors.tierOrange + '18',
          badge: 'Telemetry',
        };
      case 'fleet':
        return {
          title: 'Garage Comparison',
          subtitle: 'Multi-vehicle benchmarks, spending & mileage ranks',
          icon: '🚗',
          iconBg: colors.accent + '18',
          badge: 'Garage',
        };
      default:
        return {
          title: 'Overview',
          subtitle: 'Vehicle running costs & efficiency summary',
          icon: '🏠',
          iconBg: colors.accent + '18',
          badge: 'Summary',
        };
    }
  };

  const currentMeta = getCategoryMeta(activeSection);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      {/* ── Top Bar: Back to Overview & Category Badge ── */}
      <View style={styles.topRow}>
        <TouchableOpacity
          onPress={() => onSelectSection('overview')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Back to Insights Overview"
          style={[
            styles.backButton,
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={[styles.backArrowCircle, { backgroundColor: colors.accent + '20' }]}>
            <Text style={[styles.backArrow, { color: colors.accent }]}>←</Text>
          </View>
          <Text style={[styles.backLabel, { color: colors.text }]}>Overview</Text>
        </TouchableOpacity>

        <View
          style={[
            styles.badge,
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: colors.borderLight,
            },
          ]}
        >
          <Text style={[styles.badgeText, { color: colors.accent }]}>
            {currentMeta.badge}
          </Text>
        </View>
      </View>

      {/* ── Category Title Block ── */}
      <View style={styles.categoryTitleRow}>
        <View style={[styles.categoryIconWrap, { backgroundColor: currentMeta.iconBg }]}>
          <Text style={styles.categoryIcon}>{currentMeta.icon}</Text>
        </View>
        <View style={styles.categoryTextCol}>
          <Text style={[styles.categoryTitle, { color: colors.text }]}>
            {currentMeta.title}
          </Text>
          <Text style={[styles.categorySubtitle, { color: colors.textTertiary }]} numberOfLines={1}>
            {currentMeta.subtitle}
          </Text>
        </View>
      </View>

      {/* ── Inner Divider ── */}
      <View style={[styles.innerDivider, { backgroundColor: colors.borderLight }]} />

      {/* ── 4 Category Tags (Segmented Switcher) ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillsScroll}
      >
        {tabs.map((t) => {
          const isActive = activeSection === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              onPress={() => onSelectSection(t.id)}
              activeOpacity={0.75}
              style={[
                styles.pill,
                isActive
                  ? {
                      backgroundColor: colors.accent,
                      borderColor: colors.accent,
                    }
                  : {
                      backgroundColor: colors.surfaceSecondary,
                      borderColor: colors.border,
                    },
              ]}
            >
              <Text style={{ fontSize: 13 }}>{t.icon}</Text>
              <Text
                style={[
                  styles.pillText,
                  {
                    color: isActive ? '#FFFFFF' : colors.textSecondary,
                    fontWeight: isActive ? '800' : '600',
                  },
                ]}
              >
                {t.label}
              </Text>
              {isActive && <View style={styles.activeDot} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: Sizing.radiusLg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    ...Sizing.cardShadow,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
    minHeight: 34,
  },
  backArrowCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 13,
    fontWeight: '900',
    marginTop: -1,
  },
  backLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 2,
    marginBottom: Spacing.xs,
  },
  categoryIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIcon: {
    fontSize: 18,
  },
  categoryTextCol: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  categorySubtitle: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 1,
  },
  innerDivider: {
    height: 1,
    marginVertical: Spacing.sm,
  },
  pillsScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
    minHeight: 34,
  },
  pillText: {
    fontSize: 12,
    letterSpacing: -0.2,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
    marginLeft: 1,
  },
});
