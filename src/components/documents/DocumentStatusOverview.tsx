/**
 * DocumentStatusOverview
 *
 * Section 9: Document Status Overview
 * Displays verified status metrics for the selected vehicle:
 * - Active tab: Total Documents, Expiring Soon (and Expired if any exist)
 * - Renewal History tab: Archived Renewals, Active Policies
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Spacing } from '@/constants/theme';
import type { DocumentPalette } from './documentTheme';
import { formatCount } from './documentHelpers';
import type { DocumentTab } from './DocumentNavigation';

interface DocumentStatusOverviewProps {
  activeTab: DocumentTab;
  totalActive: number;
  expiringSoon: number;
  expired: number;
  totalSuperseded: number;
  colors: DocumentPalette;
}

export const DocumentStatusOverview = React.memo(function DocumentStatusOverview({
  activeTab,
  totalActive,
  expiringSoon,
  expired,
  totalSuperseded,
  colors,
}: DocumentStatusOverviewProps) {
  const isHistory = activeTab === 'history';

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
        DOCUMENT STATUS
      </Text>

      <View style={styles.gridRow}>
        {!isHistory ? (
          <>
            {/* Metric 1: Total Documents */}
            <View
              style={[
                styles.statCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Total Documents
              </Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {formatCount(totalActive)}
              </Text>
            </View>

            {/* Metric 2: Expiring Soon */}
            <View
              style={[
                styles.statCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: expiringSoon > 0 ? colors.statusWarning : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.statLabel,
                  { color: expiringSoon > 0 ? colors.statusWarning : colors.textSecondary },
                ]}
              >
                Expiring Soon
              </Text>
              <Text
                style={[
                  styles.statValue,
                  { color: expiringSoon > 0 ? colors.statusWarning : colors.text },
                ]}
              >
                {formatCount(expiringSoon)}
              </Text>
            </View>

            {/* Metric 3: Expired (rendered if any expired documents exist) */}
            {expired > 0 && (
              <View
                style={[
                  styles.statCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.statusCritical,
                  },
                ]}
              >
                <Text style={[styles.statLabel, { color: colors.statusCritical }]}>
                  Expired
                </Text>
                <Text style={[styles.statValue, { color: colors.statusCritical }]}>
                  {formatCount(expired)}
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            {/* Renewal History Metric 1: Archived Records */}
            <View
              style={[
                styles.statCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Archived Renewals
              </Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {formatCount(totalSuperseded)}
              </Text>
            </View>

            {/* Renewal History Metric 2: Active Policies */}
            <View
              style={[
                styles.statCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                Active Policies
              </Text>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {formatCount(totalActive)}
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  gridRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: -0.1,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});
