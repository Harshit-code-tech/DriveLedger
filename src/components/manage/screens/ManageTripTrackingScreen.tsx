/**
 * ManageTripTrackingScreen
 *
 * Dedicated Trip Tracking Screen:
 * 1. Location Access:
 *    - Location Permission status (Granted / Missing)
 *    - Background Location status (Granted / Missing)
 *    - Action to open Android settings when permission is missing
 *    - Clear explanation of why background access is required
 * 2. Recording Configuration:
 *    - Existing GPS Profile picker (High Accuracy, Balanced, Battery Saver)
 *    - Recording Behaviour details (cadence, stationary filtering, speed bands)
 * 3. Background Operation:
 *    - Battery optimization restrictions (OEM Doze & Standby limits)
 *    - Background activity and system status indicators
 *    - Action to open App Settings for "Unrestricted" battery
 * 4. Trip Recording Information:
 *    - How GPS trip recording works (100% offline SQLite, zero cloud)
 *    - Permission requirements summary
 *    - Interactive GPS trip recording walkthrough
 */

import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
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

interface ManageTripTrackingScreenProps {
  gpsTrackingProfileLabel: string;
  onOpenGpsProfilePicker: () => void;
  colors: ManagePalette;
}

export const ManageTripTrackingScreen: React.FC<ManageTripTrackingScreenProps> = ({
  gpsTrackingProfileLabel,
  onOpenGpsProfilePicker,
  colors,
}) => {
  const [permStatus, setPermStatus] = useState<LocationPermissionStatus | null>(null);
  const [isRequestingPerm, setIsRequestingPerm] = useState(false);

  useEffect(() => {
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

  const handleOpenSettings = () => {
    Linking.openSettings().catch((err) => {
      Alert.alert(
        'Unable to Open Settings',
        'Please open Android Settings manually, go to Apps → DriveLedger → Permissions, and enable Location.'
      );
    });
  };

  const handleShowGpsWalkthrough = () => {
    Alert.alert(
      '🚗 GPS Trip Recording Walkthrough',
      `1. START RECORDING\n` +
      `• Tap "Start Trip" on the Home tab or from the Android Home Screen Widget.\n\n` +
      `2. DRIVE OR RIDE\n` +
      `• Put your phone away or mount it on your dashboard. Background GPS logs route and speed points even when the screen is locked.\n\n` +
      `3. PERSISTENT SPEED HUD\n` +
      `• The Android notification bar displays live speed, distance, and duration.\n\n` +
      `4. FINISH & SYNC\n` +
      `• Tap "Finish Trip" upon arrival. Speed bands (City/Highway), max speed, and odometer update automatically!`,
      [{ text: 'Got It! 👍' }]
    );
  };

  const isLocationGranted = !!permStatus?.foregroundGranted;
  const isBackgroundGranted = !!permStatus?.backgroundGranted;
  const isAllGranted = isLocationGranted && isBackgroundGranted;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* ─────────────────────────────────────────────────────────────
          1. Location Access
      ───────────────────────────────────────────────────────────── */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          1. Location Access
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          Current GPS and background location permission status on this device.
        </Text>
      </View>

      <View style={styles.groupContainer}>
        {/* Location Permission Item */}
        <View
          style={[
            styles.statusRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z"
                stroke={colors.accent}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Circle cx="12" cy="9" r="2.5" stroke={colors.accent} strokeWidth={1.8} />
            </Svg>
          </View>

          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>
              Location Permission
            </Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              Current GPS permission status
            </Text>
          </View>

          <View
            style={[
              styles.badgePill,
              {
                backgroundColor: isLocationGranted
                  ? colors.statusNormalBg
                  : colors.statusWarningBg,
                borderColor: isLocationGranted
                  ? colors.statusNormal + '40'
                  : colors.statusWarning + '40',
              },
            ]}
          >
            <View
              style={[
                styles.badgeDot,
                {
                  backgroundColor: isLocationGranted
                    ? colors.statusNormal
                    : colors.statusWarning,
                },
              ]}
            />
            <Text
              style={[
                styles.badgeText,
                {
                  color: isLocationGranted
                    ? colors.statusNormal
                    : colors.statusWarning,
                },
              ]}
            >
              {isLocationGranted ? 'Granted' : 'Not Granted'}
            </Text>
          </View>
        </View>

        {/* Background Location Item */}
        <View
          style={[
            styles.statusRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 2V6M12 18V22M2 12H6M18 12H22"
                stroke={colors.accent}
                strokeWidth={1.8}
                strokeLinecap="round"
              />
              <Circle cx="12" cy="12" r="3" stroke={colors.accent} strokeWidth={1.8} />
              <Circle cx="12" cy="12" r="8" stroke={colors.accent} strokeWidth={1.5} strokeDasharray="3 3" />
            </Svg>
          </View>

          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>
              Background Location
            </Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              Permission required for supported background recording
            </Text>
          </View>

          <View
            style={[
              styles.badgePill,
              {
                backgroundColor: isBackgroundGranted
                  ? colors.statusNormalBg
                  : colors.statusWarningBg,
                borderColor: isBackgroundGranted
                  ? colors.statusNormal + '40'
                  : colors.statusWarning + '40',
              },
            ]}
          >
            <View
              style={[
                styles.badgeDot,
                {
                  backgroundColor: isBackgroundGranted
                    ? colors.statusNormal
                    : colors.statusWarning,
                },
              ]}
            />
            <Text
              style={[
                styles.badgeText,
                {
                  color: isBackgroundGranted
                    ? colors.statusNormal
                    : colors.statusWarning,
                },
              ]}
            >
              {isBackgroundGranted ? 'Granted' : 'Missing'}
            </Text>
          </View>
        </View>

        {/* Action Button Row */}
        <View style={styles.actionsRow}>
          {!isAllGranted ? (
            <TouchableOpacity
              style={[styles.primaryActionBtn, { backgroundColor: colors.accent }]}
              onPress={handleRequestPermission}
              activeOpacity={0.7}
              disabled={isRequestingPerm}
            >
              <Text style={styles.primaryActionBtnText}>
                {isRequestingPerm ? 'Requesting...' : 'Request Permissions'}
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[
              styles.secondaryActionBtn,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                flex: !isAllGranted ? 1 : undefined,
              },
            ]}
            onPress={handleOpenSettings}
            activeOpacity={0.7}
          >
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path
                d="M18 13V19C18 20.1046 17.1046 21 16 21H5C3.89543 21 3 20.1046 3 19V8C3 6.89543 3.89543 6 5 6H11M15 3H21M21 3V9M21 3L10 14"
                stroke={colors.accent}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={[styles.secondaryActionBtnText, { color: colors.accent }]}>
              Open Android Settings
            </Text>
          </TouchableOpacity>
        </View>

        {/* Why background access is required callout */}
        <View
          style={[
            styles.explainCallout,
            { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.explainCalloutTitle, { color: colors.text }]}>
            💡 Why is Background Location Access Required?
          </Text>
          <Text style={[styles.explainCalloutBody, { color: colors.textSecondary }]}>
            When your screen locks or you switch to navigation apps, Android pauses foreground GPS updates. Background access ("Allow all the time") allows DriveLedger's background service to log your exact route and distance continuously without missing segments.
          </Text>
        </View>
      </View>

      {/* ─────────────────────────────────────────────────────────────
          2. Recording Configuration
      ───────────────────────────────────────────────────────────── */}
      <View style={[styles.sectionHeader, { marginTop: 22 }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          2. Recording Configuration
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          Preserve your active GPS sensor profile and recording preferences.
        </Text>
      </View>

      <View style={styles.groupContainer}>
        {/* GPS Profile */}
        <TouchableOpacity
          style={[
            styles.statusRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={onOpenGpsProfilePicker}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`GPS Profile, currently ${gpsTrackingProfileLabel}`}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
                stroke={colors.accent}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>

          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>
              GPS Profile
            </Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              Existing recording profile, if configurable
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

        {/* Recording Behaviour Card */}
        <View
          style={[
            styles.detailCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.detailCardHeader}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>
              Recording Behaviour
            </Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              Existing trip recording preferences
            </Text>
          </View>

          <View style={styles.behaviourList}>
            <View style={styles.behaviourItem}>
              <Text style={[styles.behaviourDot, { color: colors.accent }]}>●</Text>
              <Text style={[styles.behaviourText, { color: colors.textSecondary }]}>
                <Text style={{ fontWeight: '700', color: colors.text }}>Cadence: </Text>
                {gpsTrackingProfileLabel.toLowerCase().includes('high')
                  ? 'High Accuracy (2s interval · 3m delta) for granular speed telemetry'
                  : gpsTrackingProfileLabel.toLowerCase().includes('balanced')
                  ? 'Balanced (5s interval · 10m delta) for daily commutes'
                  : 'Battery Saver (10s interval · 20m delta) for extended long-distance drives'}
              </Text>
            </View>

            <View style={styles.behaviourItem}>
              <Text style={[styles.behaviourDot, { color: colors.accent }]}>●</Text>
              <Text style={[styles.behaviourText, { color: colors.textSecondary }]}>
                <Text style={{ fontWeight: '700', color: colors.text }}>Stationary Filtering: </Text>
                Automatic stop reconciliation pauses distance accumulation when idling in traffic.
              </Text>
            </View>

            <View style={styles.behaviourItem}>
              <Text style={[styles.behaviourDot, { color: colors.accent }]}>●</Text>
              <Text style={[styles.behaviourText, { color: colors.textSecondary }]}>
                <Text style={{ fontWeight: '700', color: colors.text }}>Speed Band Telemetry: </Text>
                Segments speed automatically into City (&lt;40 km/h), Highway (40–80 km/h), and Cruising (80+ km/h).
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* ─────────────────────────────────────────────────────────────
          3. Background Operation
      ───────────────────────────────────────────────────────────── */}
      <View style={[styles.sectionHeader, { marginTop: 22 }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          3. Background Operation
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          Android battery restrictions and background process reliability.
        </Text>
      </View>

      <View style={styles.groupContainer}>
        {/* Battery Optimization Card */}
        <View
          style={[
            styles.detailCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.detailCardHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 16 }}>🔋</Text>
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                Battery Optimization Restrictions
              </Text>
            </View>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary, marginTop: 4 }]}>
              Android manufacturers aggressively restrict background location updates to conserve power.
            </Text>
          </View>

          <Text style={[styles.batteryExplainText, { color: colors.textSecondary }]}>
            OEM skins (Samsung OneUI, Xiaomi HyperOS, OnePlus OxygenOS, etc.) can freeze DriveLedger during long drives unless battery optimization is disabled.
          </Text>

          <View style={[styles.oemStepBox, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={[styles.oemStepTitle, { color: colors.text }]}>
              Recommended Device Setting:
            </Text>
            <Text style={[styles.oemStepLine, { color: colors.textSecondary }]}>
              1. Tap below to open DriveLedger App Info.
            </Text>
            <Text style={[styles.oemStepLine, { color: colors.textSecondary }]}>
              2. Select <Text style={{ fontWeight: '700' }}>Battery</Text> → Set to <Text style={{ fontWeight: '700', color: colors.accent }}>"Unrestricted"</Text>.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.secondaryActionBtn, { borderColor: colors.border, marginTop: 10 }]}
            onPress={handleOpenSettings}
            activeOpacity={0.7}
          >
            <Text style={[styles.secondaryActionBtnText, { color: colors.accent }]}>
              Open Battery Settings in Android
            </Text>
          </TouchableOpacity>
        </View>

        {/* Background Activity Status */}
        <View
          style={[
            styles.statusRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M22 12H18L15 21L9 3L6 12H2"
                stroke={colors.accent}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>

          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>
              Background Activity
            </Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              Show relevant background permission or system status
            </Text>
          </View>

          <View
            style={[
              styles.badgePill,
              {
                backgroundColor: isBackgroundGranted
                  ? colors.statusNormalBg
                  : colors.statusWarningBg,
                borderColor: isBackgroundGranted
                  ? colors.statusNormal + '40'
                  : colors.statusWarning + '40',
              },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                {
                  color: isBackgroundGranted
                    ? colors.statusNormal
                    : colors.statusWarning,
                },
              ]}
            >
              {isBackgroundGranted ? 'Supported & Active' : 'Foreground Only'}
            </Text>
          </View>
        </View>
      </View>

      {/* ─────────────────────────────────────────────────────────────
          4. Trip Recording Information
      ───────────────────────────────────────────────────────────── */}
      <View style={[styles.sectionHeader, { marginTop: 22 }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          4. Trip Recording Information
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          How DriveLedger processes trips with zero cloud connectivity.
        </Text>
      </View>

      <View style={styles.groupContainer}>
        {/* How It Works Card */}
        <View
          style={[
            styles.detailCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.rowTitle, { color: colors.text }]}>
            How GPS Trip Recording Works
          </Text>

          <View style={[styles.infoList, { marginTop: 8 }]}>
            <View style={styles.infoListItem}>
              <Text style={{ fontSize: 16 }}>🔒</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoListHead, { color: colors.text }]}>
                  100% Offline & Private
                </Text>
                <Text style={[styles.infoListSub, { color: colors.textSecondary }]}>
                  Satellite coordinates are queried locally from hardware sensors and stored in your private SQLite database. Zero remote telemetry.
                </Text>
              </View>
            </View>

            <View style={styles.infoListItem}>
              <Text style={{ fontSize: 16 }}>📐</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoListHead, { color: colors.text }]}>
                  Haversine & Speed Band Analytics
                </Text>
                <Text style={[styles.infoListSub, { color: colors.textSecondary }]}>
                  Accurately calculates true ground path distance, instantaneous velocity, and trip efficiency metrics without mobile data.
                </Text>
              </View>
            </View>

            <View style={styles.infoListItem}>
              <Text style={{ fontSize: 16 }}>🚗</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoListHead, { color: colors.text }]}>
                  Active Garage Synchronization
                </Text>
                <Text style={[styles.infoListSub, { color: colors.textSecondary }]}>
                  Every completed trip reconciles automatically with your active vehicle's odometer and maintenance profiles.
                </Text>
              </View>
            </View>
          </View>

          {/* Interactive Walkthrough Button */}
          <TouchableOpacity
            style={[
              styles.walkthroughBtn,
              { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
            ]}
            onPress={handleShowGpsWalkthrough}
            activeOpacity={0.7}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Circle cx="12" cy="12" r="10" stroke={colors.accent} strokeWidth={1.8} />
              <Path
                d="M12 16V12M12 8H12.01"
                stroke={colors.accent}
                strokeWidth={2}
                strokeLinecap="round"
              />
            </Svg>
            <Text style={[styles.walkthroughBtnText, { color: colors.accent }]}>
              Open GPS Trip Recording Walkthrough
            </Text>
          </TouchableOpacity>
        </View>
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
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  groupContainer: {
    gap: 10,
  },
  statusRow: {
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
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    gap: 5,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
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
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  primaryActionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  secondaryActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  explainCallout: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  explainCalloutTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  explainCalloutBody: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  detailCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  detailCardHeader: {
    marginBottom: 8,
  },
  behaviourList: {
    gap: 8,
    marginTop: 4,
  },
  behaviourItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  behaviourDot: {
    fontSize: 10,
    marginTop: 3,
  },
  behaviourText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  batteryExplainText: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  oemStepBox: {
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    gap: 3,
  },
  oemStepTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  oemStepLine: {
    fontSize: 11,
    lineHeight: 16,
  },
  infoList: {
    gap: 12,
  },
  infoListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoListHead: {
    fontSize: 13,
    fontWeight: '700',
  },
  infoListSub: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  walkthroughBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 14,
    gap: 6,
  },
  walkthroughBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
