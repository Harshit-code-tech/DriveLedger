/**
 * Pre-Trip Highway Checklist Modal (Feature 4.3)
 *
 * Provides a pilot-style pre-flight safety & compliance inspection
 * before embarking on an Indian highway road trip.
 */

import { Sizing, Spacing, Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import {
  buildPreTripChecklist,
  ChecklistCategory,
  ChecklistItem,
  getChecklistStats,
  useChecklistStore,
} from '@/stores/checklistStore';
import type { VehicleDocument } from '@/types/document';
import type { Vehicle } from '@/types/vehicle';
import { useMemo } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface PreTripChecklistModalProps {
  visible: boolean;
  onClose: () => void;
  vehicle: Vehicle;
  documents: VehicleDocument[];
}

const EMPTY_CHECKED_LIST: string[] = [];

export function PreTripChecklistModal({
  visible,
  onClose,
  vehicle,
  documents,
}: PreTripChecklistModalProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const checkedItemsByVehicle = useChecklistStore((s) => s.checkedItemsByVehicle);
  const checkedItems = checkedItemsByVehicle[vehicle.id] || EMPTY_CHECKED_LIST;
  const toggleItem = useChecklistStore((s) => s.toggleItem);
  const resetChecklist = useChecklistStore((s) => s.resetChecklist);

  // Generate customized items based on vehicle & documents
  const items = useMemo(() => {
    return buildPreTripChecklist(vehicle, documents, checkedItems);
  }, [vehicle, documents, checkedItems]);

  const stats = useMemo(() => getChecklistStats(items), [items]);

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: { category: ChecklistCategory; title: string; icon: string; items: ChecklistItem[] }[] = [
      {
        category: 'tyres',
        title: 'Tyres, Wheels & Hardware',
        icon: '🛞',
        items: items.filter((i) => i.category === 'tyres'),
      },
      {
        category: 'fluids',
        title: vehicle.fuel_type === 'ev' ? 'EV Battery & Charging' : 'Under the Bonnet & Fluids',
        icon: vehicle.fuel_type === 'ev' ? '⚡' : '🔧',
        items: items.filter((i) => i.category === 'fluids'),
      },
      {
        category: 'compliance',
        title: 'Tolls & Statutory Compliance',
        icon: '📄',
        items: items.filter((i) => i.category === 'compliance'),
      },
      {
        category: 'safety',
        title: 'Emergency & Highway Safety',
        icon: '🛡️',
        items: items.filter((i) => i.category === 'safety'),
      },
    ];

    return groups.filter((g) => g.items.length > 0);
  }, [items, vehicle.fuel_type]);

  const handleReset = () => {
    Alert.alert(
      'Reset Inspection Checklist?',
      'This will clear all checkmarks so you can start a fresh inspection for your next trip.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => resetChecklist(vehicle.id),
        },
      ]
    );
  };

  const handleShare = async () => {
    const lines = [
      `🛣️ DriveLedger Highway Readiness Report`,
      `Vehicle: ${vehicle.nickname ?? vehicle.name} (${vehicle.registration_number})`,
      `Status: ${stats.completed}/${stats.total} Checks Completed (${stats.percent}%)`,
      `Date: ${new Date().toLocaleDateString('en-IN')}`,
      '',
      ...items.map(
        (i) => `${i.checked ? '✅' : '⬜'} ${i.title}`
      ),
      '',
      stats.isComplete
        ? '🎉 100% Highway Ready! Safe travels.'
        : `⚠️ ${stats.total - stats.completed} pending check(s) before departure.`,
    ];

    try {
      await Share.share({
        message: lines.join('\n'),
        title: 'Highway Pre-Trip Inspection Summary',
      });
    } catch {
      // Ignore share cancellation
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* ── Top Header ── */}
        <View style={[styles.header, { borderBottomColor: colors.borderLight, paddingTop: Math.max(insets.top, Spacing.md) }]}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 18 }}>🛣️</Text>
              <Text style={[Typography.h3, { color: colors.text }]}>
                Pre-Trip Highway Checklist
              </Text>
            </View>
            <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
              {vehicle.nickname ?? vehicle.name} · {vehicle.registration_number}
            </Text>
          </View>

          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeButton, { backgroundColor: colors.surface }]}
            accessibilityRole="button"
            accessibilityLabel="Close checklist"
          >
            <Text style={[Typography.body, { color: colors.textSecondary, fontWeight: '700' }]}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 80, 100) }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Progress Card ── */}
          <View
            style={[
              styles.progressCard,
              {
                backgroundColor: stats.isComplete ? colors.successLight : colors.surface,
                borderColor: stats.isComplete ? colors.success : colors.border,
              },
            ]}
          >
            <View style={styles.progressRow}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    Typography.h3,
                    { color: stats.isComplete ? colors.success : colors.text },
                  ]}
                >
                  {stats.isComplete
                    ? '🚗 Highway Ready!'
                    : `${stats.completed} of ${stats.total} Checks Completed`}
                </Text>
                <Text
                  style={[
                    Typography.caption,
                    { color: stats.isComplete ? colors.success : colors.textSecondary, marginTop: 2 },
                  ]}
                >
                  {stats.isComplete
                    ? 'All pre-flight safety & compliance checks verified. Safe travels!'
                    : 'Tap items as you inspect your vehicle before hitting the expressway.'}
                </Text>
              </View>

              <View
                style={[
                  styles.percentBadge,
                  {
                    backgroundColor: stats.isComplete ? colors.success : colors.primary,
                  },
                ]}
              >
                <Text style={styles.percentText}>{stats.percent}%</Text>
              </View>
            </View>

            {/* Progress Track */}
            <View style={[styles.progressTrack, { backgroundColor: colors.borderLight }]}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${stats.percent}%`,
                    backgroundColor: stats.isComplete ? colors.success : colors.primary,
                  },
                ]}
              />
            </View>
          </View>

          {/* ── Categorized Checklist Sections ── */}
          {groupedItems.map((group) => (
            <View key={group.category} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconBadge, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight }]}>
                  <Text style={styles.sectionIconText}>{group.icon}</Text>
                </View>
                <Text style={[Typography.caption, styles.sectionTitleText, { color: colors.textSecondary }]}>
                  {group.title}
                </Text>
              </View>

              {group.items.map((item) => {
                const badgeColor =
                  item.badgeType === 'danger'
                    ? colors.danger
                    : item.badgeType === 'warning'
                      ? colors.warning
                      : item.badgeType === 'success'
                        ? colors.success
                        : colors.primary;

                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => toggleItem(vehicle.id, item.id)}
                    activeOpacity={0.7}
                    style={[
                      styles.itemCard,
                      {
                        backgroundColor: colors.surface,
                        borderColor: item.checked ? colors.primary : colors.borderLight,
                      },
                    ]}
                  >
                    <View style={styles.itemTopRow}>
                      {/* Checkbox Icon */}
                      <View
                        style={[
                          styles.checkbox,
                          {
                            borderColor: item.checked ? colors.primary : colors.border,
                            backgroundColor: item.checked ? colors.primary : 'transparent',
                          },
                        ]}
                      >
                        {item.checked && (
                          <Text style={styles.checkmarkText}>✓</Text>
                        )}
                      </View>

                      {/* Content */}
                      <View style={{ flex: 1, marginLeft: Spacing.md }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                          <Text
                            style={[
                              Typography.body,
                              {
                                color: item.checked ? colors.textSecondary : colors.text,
                                fontWeight: '700',
                                textDecorationLine: item.checked ? 'line-through' : 'none',
                                flex: 1,
                              },
                            ]}
                          >
                            {item.title}
                          </Text>

                          {item.badge && (
                            <View
                              style={[
                                styles.itemBadge,
                                {
                                  backgroundColor:
                                    item.badgeType === 'danger'
                                      ? colors.dangerLight
                                      : item.badgeType === 'warning'
                                        ? colors.warningLight
                                        : colors.successLight,
                                },
                              ]}
                            >
                              <Text style={[styles.itemBadgeText, { color: badgeColor }]}>
                                {item.badge}
                              </Text>
                            </View>
                          )}
                        </View>

                        <Text
                          style={[
                            Typography.bodySmall,
                            { color: colors.textSecondary, marginTop: 3, lineHeight: 18 },
                          ]}
                        >
                          {item.subtitle}
                        </Text>

                        {/* Highway Pro-Tip */}
                        {item.tip && !item.checked && (
                          <View style={[styles.tipContainer, { backgroundColor: colors.background, borderColor: colors.borderLight }]}>
                            <Text style={[Typography.caption, { color: colors.textTertiary, lineHeight: 16 }]}>
                              💡 <Text style={{ fontWeight: '600' }}>Pro-Tip:</Text> {item.tip}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>

        {/* ── Bottom Action Bar ── */}
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.borderLight,
              paddingBottom: Math.max(insets.bottom, Spacing.md),
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.bottomButton, { borderColor: colors.border, backgroundColor: colors.background }]}
            onPress={handleReset}
            activeOpacity={0.7}
          >
            <Text numberOfLines={1} style={[styles.bottomButtonText, { color: colors.textSecondary }]}>
              🔄 Reset
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.bottomButton, { flex: 1.2, borderColor: colors.primary, backgroundColor: colors.primaryLight }]}
            onPress={handleShare}
            activeOpacity={0.7}
          >
            <Text numberOfLines={1} style={[styles.bottomButtonText, { color: colors.primary }]}>
              📤 Share
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.bottomButton, { flex: 1.2, backgroundColor: colors.primary, borderColor: colors.primary }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text numberOfLines={1} style={[styles.bottomButtonText, { color: colors.textOnPrimary }]}>
              Done
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  progressCard: {
    padding: Spacing.lg,
    borderRadius: Sizing.radiusLg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  percentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: Spacing.sm,
  },
  percentText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
    paddingHorizontal: 2,
  },
  sectionIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  sectionIconText: {
    fontSize: 16,
    textAlign: 'center',
    includeFontPadding: false,
  },
  sectionTitleText: {
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  itemCard: {
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 16,
  },
  itemBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tipContainer: {
    marginTop: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 1,
  },
  bottomButton: {
    flex: 1,
    height: 44,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  bottomButtonText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
