/**
 * HomeNeedsAttention
 *
 * Section 7: Needs Attention
 * Brings existing reminders and important vehicle alerts into one visible area.
 * Displays overdue/upcoming maintenance and expiring/expired documents.
 * Empty State: Completely hidden when no actionable items exist.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { type Vehicle } from '@/types/vehicle';
import { type VehicleDocument } from '@/types/document';
import { DOCUMENT_TYPE_LABELS } from '@/constants/documentTypes';
import { daysUntil } from '@/utils/date';
import { Spacing } from '@/constants/theme';
import { type HomePalette } from './homeTheme';

interface ServiceDueStatus {
  urgency: 'overdue' | 'due_soon' | 'ok' | 'none';
  headline: string;
  subtext: string;
}

interface HomeNeedsAttentionProps {
  vehicle: Vehicle;
  serviceDueStatus: ServiceDueStatus;
  expiringDocs: VehicleDocument[];
  colors: HomePalette;
}

function docExpiryText(days: number): string {
  if (days < 0) return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return 'Expires today';
  return `Expires in ${days}d`;
}

export const HomeNeedsAttention = React.memo(function HomeNeedsAttention({
  vehicle,
  serviceDueStatus,
  expiringDocs,
  colors,
}: HomeNeedsAttentionProps) {
  const router = useRouter();

  const isServiceAlert =
    serviceDueStatus.urgency === 'overdue' || serviceDueStatus.urgency === 'due_soon';
  const hasExpiringDocs = expiringDocs.length > 0;

  // Empty state: Hide entire section when no items exist
  if (!isServiceAlert && !hasExpiringDocs) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>
        Needs Attention
      </Text>

      <View style={styles.alertList}>
        {/* ── Service Due / Overdue Row ── */}
        {isServiceAlert && (() => {
          const isOverdue = serviceDueStatus.urgency === 'overdue';
          const badgeColor = isOverdue ? colors.statusCritical : colors.statusWarning;
          const badgeBg = isOverdue ? colors.statusCriticalBg : colors.statusWarningBg;

          return (
            <TouchableOpacity
              style={[
                styles.alertRow,
                {
                  backgroundColor: colors.surface,
                  borderColor: badgeColor,
                },
              ]}
              onPress={() =>
                router.push({
                  pathname: '/add-service',
                  params: { vehicleId: vehicle.id },
                })
              }
              activeOpacity={0.75}
            >
              <View style={[styles.alertIconWrap, { backgroundColor: badgeBg }]}>
                <Text style={styles.alertIcon}>{isOverdue ? '⚠️' : '🔧'}</Text>
              </View>

              <View style={styles.alertInfo}>
                <View style={styles.titleRow}>
                  <Text style={[styles.alertTitle, { color: colors.text }]} numberOfLines={1}>
                    {serviceDueStatus.headline.replace(/^[^\w]+/, '')}
                  </Text>
                  <View style={[styles.urgencyBadge, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.urgencyBadgeText, { color: badgeColor }]}>
                      {isOverdue ? 'OVERDUE' : 'DUE SOON'}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[styles.alertSubtext, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {serviceDueStatus.subtext}
                </Text>
              </View>

              <Text style={[styles.arrow, { color: badgeColor }]}>→</Text>
            </TouchableOpacity>
          );
        })()}

        {/* ── Document Expiry Rows ── */}
        {expiringDocs.map((doc) => {
          const days = daysUntil(doc.expiry_date!);
          const isExpired = days <= 0;
          const badgeColor = isExpired ? colors.statusCritical : colors.statusWarning;
          const badgeBg = isExpired ? colors.statusCriticalBg : colors.statusWarningBg;
          const docLabel =
            DOCUMENT_TYPE_LABELS[doc.type as keyof typeof DOCUMENT_TYPE_LABELS] || doc.type;

          return (
            <TouchableOpacity
              key={doc.id}
              style={[
                styles.alertRow,
                {
                  backgroundColor: colors.surface,
                  borderColor: badgeColor,
                },
              ]}
              onPress={() => router.push('/(tabs)/documents')}
              activeOpacity={0.75}
            >
              <View style={[styles.alertIconWrap, { backgroundColor: badgeBg }]}>
                <Text style={styles.alertIcon}>🧾</Text>
              </View>

              <View style={styles.alertInfo}>
                <View style={styles.titleRow}>
                  <Text style={[styles.alertTitle, { color: colors.text }]} numberOfLines={1}>
                    {docLabel} Document
                  </Text>
                  <View style={[styles.urgencyBadge, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.urgencyBadgeText, { color: badgeColor }]}>
                      {docExpiryText(days)}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[styles.alertSubtext, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  Document #{doc.document_number || 'Record'} · Tap to view
                </Text>
              </View>

              <Text style={[styles.arrow, { color: badgeColor }]}>→</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  alertList: {
    gap: Spacing.xs,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  alertIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertIcon: {
    fontSize: 16,
  },
  alertInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  urgencyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  urgencyBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  alertSubtext: {
    fontSize: 11,
    marginTop: 2,
  },
  arrow: {
    fontSize: 14,
    fontWeight: '700',
  },
});
