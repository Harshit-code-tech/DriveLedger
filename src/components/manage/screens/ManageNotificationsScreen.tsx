/**
 * ManageNotificationsScreen
 *
 * Dedicated Reminders & Alerts Screen:
 * - Master local notification toggle
 * - Document Expiry Alerts (PUC, Insurance, Registration, FASTag)
 * - Notice Window lead-time days (7, 14, 30, 45, 60 days)
 * - Service Due Reminders (mileage & date based)
 * - Maintenance Target Reminders (custom interval items)
 * - 100% offline local scheduling guarantee
 */

import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { ManagePalette } from '../manageTheme';

interface ManageNotificationsScreenProps {
  notificationsEnabled: boolean;
  notifyDocumentExpiry: boolean;
  notifyServiceDue: boolean;
  notifyMaintenanceTargets: boolean;
  docExpiryLeadDays: number;
  onOpenDocLeadDaysPicker: () => void;
  onToggleNotifications: (val: boolean) => void;
  onToggleDocExpiry: (val: boolean) => void;
  onToggleServiceDue: (val: boolean) => void;
  onToggleMaintenanceTargets: (val: boolean) => void;
  colors: ManagePalette;
}

export const ManageNotificationsScreen: React.FC<ManageNotificationsScreenProps> = ({
  notificationsEnabled,
  notifyDocumentExpiry,
  notifyServiceDue,
  notifyMaintenanceTargets,
  docExpiryLeadDays,
  onOpenDocLeadDaysPicker,
  onToggleNotifications,
  onToggleDocExpiry,
  onToggleServiceDue,
  onToggleMaintenanceTargets,
  colors,
}) => {
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Reminders & Alerts
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          Configure automated local notifications for upcoming document expiries, scheduled servicing, and part wear.
        </Text>
      </View>

      <View style={styles.rowsGroup}>
        {/* Master Toggle */}
        <View
          style={[
            styles.switchRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={{ fontSize: 16 }}>🔔</Text>
          </View>

          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>
              Enable Reminders
            </Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              Local Android notifications for upcoming dues
            </Text>
          </View>

          <Switch
            value={notificationsEnabled}
            onValueChange={onToggleNotifications}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor="#FFFFFF"
          />
        </View>

        {notificationsEnabled && (
          <>
            {/* Document Expiry Alerts */}
            <View
              style={[
                styles.switchRow,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={{ fontSize: 16 }}>📄</Text>
              </View>

              <View style={styles.rowTextCol}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>
                  Document Expiry Alerts
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  PUC, Insurance & FASTag renewal warnings
                </Text>
              </View>

              <Switch
                value={notifyDocumentExpiry}
                onValueChange={onToggleDocExpiry}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Document Notice Window */}
            <TouchableOpacity
              style={[
                styles.preferenceRow,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={onOpenDocLeadDaysPicker}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Document Notice Window, currently ${docExpiryLeadDays} days`}
            >
              <View style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={{ fontSize: 16 }}>📅</Text>
              </View>

              <View style={styles.rowTextCol}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>
                  Document Notice Window
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  Lead time before expiry warnings begin
                </Text>
              </View>

              <View style={[styles.valuePill, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={[styles.valuePillText, { color: colors.accent }]}>
                  {docExpiryLeadDays} days
                </Text>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M9 18L15 12L9 6"
                    stroke={colors.accent}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
            </TouchableOpacity>

            {/* Service Due Reminders */}
            <View
              style={[
                styles.switchRow,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={{ fontSize: 16 }}>🔧</Text>
              </View>

              <View style={styles.rowTextCol}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>
                  Service Due Reminders
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  Alerts when scheduled maintenance km or time approaches
                </Text>
              </View>

              <Switch
                value={notifyServiceDue}
                onValueChange={onToggleServiceDue}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Maintenance Targets */}
            <View
              style={[
                styles.switchRow,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={{ fontSize: 16 }}>🎯</Text>
              </View>

              <View style={styles.rowTextCol}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>
                  Maintenance Targets
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  Alerts when component wear thresholds are met
                </Text>
              </View>

              <Switch
                value={notifyMaintenanceTargets}
                onValueChange={onToggleMaintenanceTargets}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#FFFFFF"
              />
            </View>
          </>
        )}
      </View>

      {/* ── Offline Notice Card ── */}
      <View
        style={[
          styles.noticeCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.noticeHeader}>
          <Text style={{ fontSize: 16 }}>🔔</Text>
          <Text style={[styles.noticeTitle, { color: colors.text }]}>
            100% On-Device Alarm Scheduling
          </Text>
        </View>
        <Text style={[styles.noticeBody, { color: colors.textSecondary }]}>
          Notifications are scheduled directly with the Android AlarmManager on your device. They fire reliably offline without internet access or background server polling.
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  rowsGroup: {
    gap: 10,
    marginBottom: 16,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextCol: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  valuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  valuePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  noticeCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginTop: 8,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  noticeBody: {
    fontSize: 12,
    lineHeight: 17,
  },
});
