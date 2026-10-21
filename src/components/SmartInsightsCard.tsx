/**
 * Smart Insights Card Component
 *
 * Displays locally computed proactive maintenance insights, mileage anomaly detection,
 * repeated repair warnings, and cost pattern analysis.
 *
 * 100% deterministic & offline. Never contacts remote AI/cloud services.
 */

import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Sizing, Spacing, Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { Vehicle } from '@/types/vehicle';
import { useFuelStore } from '@/stores/fuelStore';
import { useServiceStore } from '@/stores/serviceStore';
import { useExpenseStore } from '@/stores/expenseStore';
import { useMaintenanceProfileStore } from '@/stores/maintenanceProfileStore';
import { generateVehicleInsights, type VehicleInsight } from '@/engine/insightsEngine';
import { formatCurrency } from '@/utils/format';

interface SmartInsightsCardProps {
  vehicle: Vehicle;
  onOpenProfiles?: () => void;
  onOpenTrips?: () => void;
}

export function SmartInsightsCard({
  vehicle,
  onOpenProfiles,
}: SmartInsightsCardProps) {
  const colors = useThemeColors();
  const fuelEntries = useFuelStore((s) => s.entries);
  const serviceRecords = useServiceStore((s) => s.records);
  const expenses = useExpenseStore((s) => s.expenses);
  const profiles = useMaintenanceProfileStore((s) => s.profiles);

  const [expanded, setExpanded] = useState(false);

  // Locally compute insights for this vehicle
  const insights = useMemo(() => {
    return generateVehicleInsights(
      vehicle,
      fuelEntries,
      serviceRecords,
      expenses,
      profiles
    );
  }, [vehicle, fuelEntries, serviceRecords, expenses, profiles]);

  // Prioritize critical and warning insights
  const criticalCount = insights.filter((i) => i.severity === 'critical').length;
  const warningCount = insights.filter((i) => i.severity === 'warning').length;

  const displayedInsights = expanded ? insights : insights.slice(0, 3);

  const getSeverityBadge = (severity: VehicleInsight['severity']) => {
    switch (severity) {
      case 'critical':
        return {
          bg: colors.dangerLight ?? '#FEE2E2',
          text: colors.danger,
          label: 'Action Required',
          icon: '⚠️',
        };
      case 'warning':
        return {
          bg: colors.warningLight ?? '#FEF3C7',
          text: colors.warning,
          label: 'Notice',
          icon: '⚡',
        };
      case 'info':
      default:
        return {
          bg: colors.primaryLight ?? (colors.primary + '18'),
          text: colors.primary,
          label: 'Insight',
          icon: '💡',
        };
    }
  };

  const getCategoryLabel = (type: VehicleInsight['type']) => {
    switch (type) {
      case 'maintenance_due':
      case 'maintenance_overdue':
        return 'MAINTENANCE';
      case 'component_target':
        return 'TARGET';
      case 'repeated_repair':
        return 'REPAIR';
      case 'mileage_anomaly':
        return 'EFFICIENCY';
      case 'cost_surge':
      case 'fuel_spending_surge':
      case 'category_concentration':
        return 'SPENDING';
      default:
        return 'ANALYTICS';
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor:
            criticalCount > 0
              ? colors.danger
              : warningCount > 0
              ? colors.warning
              : colors.border,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Text style={styles.headerIcon}>💡</Text>
          <View style={{ flex: 1, marginRight: Spacing.xs }}>
            <Text style={[Typography.h3, { color: colors.text }]}>
              Smart Vehicle Insights
            </Text>
            <Text style={[Typography.caption, { color: colors.textSecondary }]}>
              Deterministic local analysis · 100% offline
            </Text>
          </View>
        </View>

        {insights.length > 0 && (
          <View
            style={[
              styles.countPill,
              {
                backgroundColor:
                  criticalCount > 0
                    ? colors.dangerLight
                    : warningCount > 0
                    ? colors.warningLight
                    : colors.primaryLight,
              },
            ]}
          >
            <Text
              style={[
                Typography.caption,
                {
                  color:
                    criticalCount > 0
                      ? colors.danger
                      : warningCount > 0
                      ? colors.warning
                      : colors.primary,
                  fontWeight: '700',
                },
              ]}
            >
              {insights.length} {insights.length === 1 ? 'item' : 'items'}
            </Text>
          </View>
        )}
      </View>

      {/* Content */}
      {insights.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🛡️</Text>
          <Text
            style={[
              Typography.body,
              { color: colors.text, fontWeight: '600', textAlign: 'center' },
            ]}
          >
            No active issues detected
          </Text>
          <Text
            style={[
              Typography.bodySmall,
              { color: colors.textSecondary, textAlign: 'center', marginTop: 4 },
            ]}
          >
            All recorded mileage intervals, maintenance targets, and expenditure
            patterns align with your historical baselines.
          </Text>
          {onOpenProfiles && (
            <TouchableOpacity
              style={[
                styles.configureButton,
                { borderColor: colors.primary, marginTop: Spacing.md },
              ]}
              onPress={onOpenProfiles}
            >
              <Text
                style={[
                  Typography.button,
                  { color: colors.primary, fontSize: 14 },
                ]}
              >
                ⚙️ Configure Target Intervals
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.insightsList}>
          {displayedInsights.map((insight) => {
            const badge = getSeverityBadge(insight.severity);
            return (
              <View
                key={insight.id}
                style={[
                  styles.insightItem,
                  {
                    backgroundColor: colors.background,
                    borderLeftColor: badge.text,
                  },
                ]}
              >
                {/* ── Dedicated Tags Row (Never overlaps title) ── */}
                <View style={styles.insightTagsRow}>
                  <View
                    style={[styles.severityPill, { backgroundColor: badge.bg }]}
                  >
                    <Text
                      style={[
                        styles.severityPillText,
                        { color: badge.text },
                      ]}
                    >
                      {badge.icon} {badge.label.toUpperCase()}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.categoryPill,
                      { backgroundColor: colors.borderLight },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryPillText,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {getCategoryLabel(insight.type)}
                    </Text>
                  </View>
                </View>

                {/* ── Unobstructed Title ── */}
                <Text
                  style={[
                    Typography.body,
                    { color: colors.text, fontWeight: '700', marginTop: 4 },
                  ]}
                >
                  {insight.title}
                </Text>

                <Text
                  style={[
                    Typography.bodySmall,
                    { color: colors.textSecondary, marginTop: 4 },
                  ]}
                >
                  {insight.description}
                </Text>

                {/* Metric values if available */}
                {(insight.metricValue !== undefined ||
                  insight.relatedDate ||
                  insight.costImpact) && (
                  <View style={styles.metricsRow}>
                    {insight.metricValue !== undefined && (
                      <Text
                        style={[
                          Typography.caption,
                          { color: colors.textTertiary, marginRight: 12 },
                        ]}
                      >
                        Value: {insight.metricValue}
                      </Text>
                    )}
                    {insight.relatedDate && (
                      <Text
                        style={[
                          Typography.caption,
                          { color: colors.textTertiary, marginRight: 12 },
                        ]}
                      >
                        Target: {insight.relatedDate}
                      </Text>
                    )}
                    {insight.costImpact !== undefined && (
                      <Text
                        style={[
                          Typography.caption,
                          { color: colors.textTertiary },
                        ]}
                      >
                        Cost: {formatCurrency(insight.costImpact)}
                      </Text>
                    )}
                  </View>
                )}

                {/* Suggested Action */}
                <View style={styles.actionRow}>
                  <Text style={[Typography.caption, { color: colors.primary, fontWeight: '600' }]}>
                    👉 Next action: {insight.suggestedAction}
                  </Text>
                </View>
              </View>
            );
          })}

          {insights.length > 3 && (
            <TouchableOpacity
              style={styles.expandButton}
              onPress={() => setExpanded(!expanded)}
            >
              <Text
                style={[
                  Typography.button,
                  { color: colors.primary, fontSize: 14 },
                ]}
              >
                {expanded
                  ? 'Show fewer insights'
                  : `Show all ${insights.length} insights`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Sizing.radiusLg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Sizing.cardShadow,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  headerIcon: {
    fontSize: 24,
  },
  countPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Sizing.radiusFull,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: Spacing.xs,
  },
  configureButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
  },
  insightsList: {
    gap: Spacing.md,
  },
  insightItem: {
    borderRadius: Sizing.radiusMd,
    padding: Spacing.md,
    borderLeftWidth: 4,
  },
  insightTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  severityPill: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: Sizing.radiusFull,
  },
  severityPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  categoryPill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: Sizing.radiusFull,
  },
  categoryPillText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  metricsRow: {
    flexDirection: 'row',
    marginTop: 6,
    flexWrap: 'wrap',
  },
  actionRow: {
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
  },
  expandButton: {
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
});
