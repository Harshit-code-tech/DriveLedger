/**
 * NotificationConditionsModal
 *
 * Displays an interactive breakdown of every notification trigger in DriveLedger:
 * - What notification it is
 * - When it pops up (timing)
 * - Exact technical conditions required
 * - Priority & Android channel
 * - Live preview of the notification text
 * - One-tap button to push all test notifications at once
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Typography, Spacing } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import {
  NOTIFICATION_RULES,
  NotificationRuleInfo,
  pushAllTestNotifications,
} from '@/services/notificationService';

interface NotificationConditionsModalProps {
  visible: boolean;
  onClose: () => void;
  /** If provided, called right after pushing test notifications */
  onTestPushed?: () => void;
}

type CategoryFilter = 'All' | 'Document' | 'Service' | 'Fuel' | 'Summary';

export function NotificationConditionsModal({
  visible,
  onClose,
  onTestPushed,
}: NotificationConditionsModalProps) {
  const colors = useThemeColors();
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('All');
  const [isPushing, setIsPushing] = useState(false);
  const [lastPushStatus, setLastPushStatus] = useState<string | null>(null);

  const categories: CategoryFilter[] = ['All', 'Document', 'Service', 'Fuel', 'Summary'];

  const filteredRules =
    selectedCategory === 'All'
      ? NOTIFICATION_RULES
      : NOTIFICATION_RULES.filter((r) => r.category === selectedCategory);

  const handlePushAll = async () => {
    setIsPushing(true);
    setLastPushStatus(null);
    try {
      const result = await pushAllTestNotifications();
      if (result.isExpoGo) {
        setLastPushStatus('Simulated (Expo Go runtime)');
        Alert.alert(
          '📱 Test Notifications Simulated',
          `All ${result.rules.length} notification types were tested successfully!\n\n⚠️ Note: Expo Go (SDK 53+) disables native background push notifications. In a native dev build or standalone APK, all ${result.rules.length} notifications are delivered straight to your Android notification tray with sound & vibration.`,
          [{ text: 'Got it!' }]
        );
      } else if (result.success) {
        setLastPushStatus(`Fired ${result.count} to notification drawer!`);
        Alert.alert(
          '🔔 All Test Notifications Dispatched!',
          `Successfully pushed ${result.count} test notifications to your notification tray!\n\nCheck your Android status bar / notification drawer.`,
          [{ text: 'Awesome! 🎉' }]
        );
      } else {
        setLastPushStatus('Push failed — check permissions');
        Alert.alert(
          '⚠️ Notice',
          'Could not dispatch to notification drawer. Please ensure notification permissions are allowed in system settings.'
        );
      }
      onTestPushed?.();
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setIsPushing(false);
    }
  };

  const getPriorityStyle = (priority: NotificationRuleInfo['priority']) => {
    switch (priority) {
      case 'CRITICAL':
        return { bg: '#450A0A', border: '#DC2626', text: '#FCA5A5' };
      case 'HIGH':
        return { bg: '#451A03', border: '#D97706', text: '#FCD34D' };
      case 'MEDIUM':
        return { bg: '#1E1B4B', border: '#6366F1', text: '#C7D2FE' };
      case 'LOW':
        return { bg: '#0F172A', border: '#475569', text: '#94A3B8' };
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <View style={{ flex: 1 }}>
            <Text style={[Typography.title, { color: colors.text, fontSize: 18 }]}>
              🔔 Notification Triggers & Conditions
            </Text>
            <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
              Complete rules for when alerts pop up & required conditions
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.border }]}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Action Bar */}
        <View style={[styles.actionBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.pushAllBtn, { backgroundColor: colors.primary }]}
            onPress={handlePushAll}
            disabled={isPushing}
            activeOpacity={0.8}
          >
            {isPushing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.pushAllBtnText}>⚡ Push All Test Notifications Now ({NOTIFICATION_RULES.length})</Text>
            )}
          </TouchableOpacity>

          {lastPushStatus && (
            <Text style={[Typography.caption, { color: colors.success, textAlign: 'center', marginTop: 4 }]}>
              ✓ {lastPushStatus}
            </Text>
          )}

          {/* Category Filter Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? colors.primary : colors.background,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: isSelected ? '#FFFFFF' : colors.textSecondary, fontWeight: isSelected ? '700' : '500' },
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Rules List */}
        <ScrollView style={styles.scrollContent} contentContainerStyle={{ padding: Spacing.md, paddingBottom: 60 }}>
          {filteredRules.map((rule) => {
            const pStyle = getPriorityStyle(rule.priority);
            return (
              <View
                key={rule.id}
                style={[
                  styles.card,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={[Typography.body, { color: colors.text, fontWeight: '700' }]}>
                      {rule.name}
                    </Text>
                    <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
                      Channel: {rule.channelName} ({rule.channelId})
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.priorityBadge,
                      { backgroundColor: pStyle.bg, borderColor: pStyle.border },
                    ]}
                  >
                    <Text style={[styles.priorityText, { color: pStyle.text }]}>{rule.priority}</Text>
                  </View>
                </View>

                {/* Timing */}
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>⏱️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[Typography.caption, { color: colors.textTertiary, fontWeight: '700' }]}>
                      WHEN IT POPS UP
                    </Text>
                    <Text style={[Typography.bodySmall, { color: colors.text, marginTop: 1 }]}>
                      {rule.timing}
                    </Text>
                  </View>
                </View>

                {/* Condition */}
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>📋</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[Typography.caption, { color: colors.textTertiary, fontWeight: '700' }]}>
                      CONDITIONS REQUIRED
                    </Text>
                    <Text style={[Typography.bodySmall, { color: colors.textSecondary, marginTop: 1, lineHeight: 18 }]}>
                      {rule.conditionDescription}
                    </Text>
                  </View>
                </View>

                {/* Notification Preview */}
                <View style={[styles.previewBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <View style={styles.previewHeader}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textTertiary, letterSpacing: 0.5 }}>
                      SYSTEM NOTIFICATION PREVIEW
                    </Text>
                  </View>
                  <Text style={[Typography.bodySmall, { color: colors.text, fontWeight: '700' }]}>
                    {rule.exampleTitle}
                  </Text>
                  <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: 3, lineHeight: 16 }]}>
                    {rule.exampleBody}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
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
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  actionBar: {
    padding: Spacing.md,
    borderBottomWidth: 1,
  },
  pushAllBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pushAllBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  categoryScroll: {
    marginTop: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: {
    fontSize: 12,
  },
  scrollContent: {
    flex: 1,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
  },
  infoIcon: {
    fontSize: 14,
    marginRight: 8,
    marginTop: 1,
  },
  previewBox: {
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
  },
  previewHeader: {
    marginBottom: 4,
  },
});
