/**
 * ManageGpsNotificationsScreen
 *
 * Section 8: GPS & Notifications screen
 * - GPS Tracking Profile (High Accuracy, Balanced, Battery Saver)
 * - Android Location & Background Tracking permissions status check
 * - Local notification toggles & lead time configuration
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import {
  checkLocationPermissionStatus,
  requestTripTrackingPermissions,
  type LocationPermissionStatus,
} from '@/services/locationPermissionService';
import type { ManagePalette } from '../manageTheme';

interface ManageGpsNotificationsScreenProps {
  gpsTrackingProfileLabel: string;
  notificationsEnabled: boolean;
  notifyDocumentExpiry: boolean;
  notifyServiceDue: boolean;
  notifyMaintenanceTargets: boolean;
  docExpiryLeadDays: number;
  onOpenGpsProfilePicker: () => void;
  onOpenDocLeadDaysPicker: () => void;
  onToggleNotifications: (val: boolean) => void;
  onToggleDocExpiry: (val: boolean) => void;
  onToggleServiceDue: (val: boolean) => void;
  onToggleMaintenanceTargets: (val: boolean) => void;
  colors: ManagePalette;
}

export const ManageGpsNotificationsScreen: React.FC<ManageGpsNotificationsScreenProps> = ({
  gpsTrackingProfileLabel,
  notificationsEnabled,
  notifyDocumentExpiry,
  notifyServiceDue,
  notifyMaintenanceTargets,
  docExpiryLeadDays,
  onOpenGpsProfilePicker,
  onOpenDocLeadDaysPicker,
  onToggleNotifications,
  onToggleDocExpiry,
  onToggleServiceDue,
  onToggleMaintenanceTargets,
  colors,
}) => {
  const [permStatus, setPermStatus] = useState<LocationPermissionStatus | null>(null);
  const [isRequestingPerm, setIsRequestingPerm] = useState(false);

  useEffect(() => {
    // Non-prompting status check on mount
    checkLocationPermissionStatus().then(setPermStatus);
  }, []);

  const handleRequestPermission = async () => {
    setIsRequestingPerm(true);
    try {
      const res = await requestTripTrackingPermissions();
      const updated = await checkLocationPermissionStatus();
      setPermStatus(updated);
      if (res.warning) {
        Alert.alert('Permission Notice', res.warning);
      }
    } catch (e) {
      console.warn('Permission request error:', e);
    } finally {
      setIsRequestingPerm(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Section A: GPS Configuration ── */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          GPS Configuration
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          Configure tracking fidelity, battery impact, and verify Android location services.
        </Text>
      </View>

      <View style={styles.rowsGroup}>
        {/* GPS Tracking Profile */}
        <TouchableOpacity
          style={[
            styles.preferenceRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={onOpenGpsProfilePicker}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`GPS Tracking Profile, currently ${gpsTrackingProfileLabel}`}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={{ fontSize: 16 }}>🔋</Text>
          </View>

          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>
              GPS Tracking Profile
            </Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              Balances route accuracy and battery usage
            </Text>
          </View>

          <View style={[styles.valuePill, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.valuePillText, { color: colors.accent }]}>
              {gpsTrackingProfileLabel}
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

        {/* Location Permission Status Card */}
        <View
          style={[
            styles.permissionCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.permissionCardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                Location Access & Services
              </Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Required for real-time speed HUD and route logging
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.checkBtn,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border,
                },
              ]}
              onPress={handleRequestPermission}
              activeOpacity={0.7}
              disabled={isRequestingPerm}
            >
              <Text style={[styles.checkBtnText, { color: colors.accent }]}>
                {permStatus?.foregroundGranted && permStatus.backgroundGranted
                  ? 'All Granted ✓'
                  : 'Check / Grant'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Status Indicators */}
          <View style={[styles.statusIndicatorsRow, { borderTopColor: colors.divider }]}>
            <View style={styles.statusItem}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: permStatus?.foregroundGranted
                      ? colors.statusNormal
                      : colors.statusWarning,
                  },
                ]}
              />
              <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>
                Foreground GPS
              </Text>
            </View>

            <View style={styles.statusItem}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: permStatus?.backgroundGranted
                      ? colors.statusNormal
                      : colors.statusWarning,
                  },
                ]}
              />
              <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>
                Background Tracking
              </Text>
            </View>

            <View style={styles.statusItem}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: permStatus?.servicesEnabled
                      ? colors.statusNormal
                      : colors.statusCritical,
                  },
                ]}
              />
              <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>
                Location Services
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Section B: Notifications & Reminders ── */}
      <View style={[styles.sectionHeader, { marginTop: 24 }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Notifications & Reminders
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          Local on-device alerts for document expiry, scheduled servicing, and part wear.
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
                  Odometer and calendar-based service intervals
                </Text>
              </View>

              <Switch
                value={notifyServiceDue}
                onValueChange={onToggleServiceDue}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Maintenance Target Warnings */}
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
                  Maintenance Target Warnings
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  Custom targets (Engine oil, brakes, tyres)
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
    marginBottom: 10,
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
    gap: 8,
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
  permissionCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  permissionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  checkBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusIndicatorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
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
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  valuePillText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
