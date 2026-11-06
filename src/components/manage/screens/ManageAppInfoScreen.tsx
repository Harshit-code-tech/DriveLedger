/**
 * ManageAppInfoScreen
 *
 * Section 10: App Information screen
 * - App version, identity & offline philosophy
 * - Replay Onboarding walkthrough
 * - Update & Data Safety Guide
 * - Check for Updates (GitHub releases API)
 * - About DriveLedger dialog
 */

import React from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import type { ManagePalette } from '../manageTheme';

interface ManageAppInfoScreenProps {
  appVersion: string;
  onReplayWalkthrough: () => void;
  onShowDataSafetyGuide: () => void;
  onCheckForUpdates: () => void;
  onShowAboutDialog: () => void;
  colors: ManagePalette;
}

export const ManageAppInfoScreen: React.FC<ManageAppInfoScreenProps> = ({
  appVersion,
  onReplayWalkthrough,
  onShowDataSafetyGuide,
  onCheckForUpdates,
  onShowAboutDialog,
  colors,
}) => {
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* ── App Identity Card ── */}
      <View
        style={[
          styles.appCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <Image
          source={require('../../../../assets/images/icon.png')}
          style={styles.appIcon}
          resizeMode="contain"
        />

        <View style={styles.appTitleRow}>
          <Text style={[styles.brandDrive, { color: colors.text }]}>Drive</Text>
          <Text style={[styles.brandLedger, { color: colors.text }]}>Ledger</Text>
        </View>

        <View
          style={[
            styles.versionBadge,
            { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.versionBadgeText, { color: colors.accent }]}>
            Version {appVersion}
          </Text>
        </View>

        <Text style={[styles.appPhilosophy, { color: colors.textSecondary }]}>
          Offline-first vehicle telemetry, fuel logging, maintenance intervals, and expense tracking.
        </Text>
      </View>

      {/* ── Actions List ── */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Help & Updates
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          Walkthroughs, update verification, and app documentation.
        </Text>
      </View>

      <View style={styles.rowsGroup}>
        {/* 1. Replay Walkthrough */}
        <TouchableOpacity
          style={[
            styles.infoRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={onReplayWalkthrough}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Replay App Walkthrough"
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={{ fontSize: 18 }}>✨</Text>
          </View>

          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>
              Replay App Walkthrough
            </Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              Learn about tank-to-tank mileage, intervals & telemetry
            </Text>
          </View>

          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M9 18L15 12L9 6"
              stroke={colors.textTertiary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>

        {/* 2. Update & Data Safety Guide */}
        <TouchableOpacity
          style={[
            styles.infoRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={onShowDataSafetyGuide}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Update & Data Safety Guide"
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={{ fontSize: 18 }}>🛡️</Text>
          </View>

          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>
              Update & Data Safety Guide
            </Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              Safe update rules: install over APK, never uninstall
            </Text>
          </View>

          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M9 18L15 12L9 6"
              stroke={colors.textTertiary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>

        {/* 3. Check for Updates */}
        <TouchableOpacity
          style={[
            styles.infoRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={onCheckForUpdates}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Check for Updates on GitHub Releases"
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={{ fontSize: 18 }}>🔄</Text>
          </View>

          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>
              Check for Updates
            </Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              Check GitHub Releases for newer verified APK builds
            </Text>
          </View>

          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M9 18L15 12L9 6"
              stroke={colors.textTertiary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>

        {/* 4. About DriveLedger */}
        <TouchableOpacity
          style={[
            styles.infoRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={onShowAboutDialog}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="About DriveLedger"
        >
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceSecondary }]}>
            <Text style={{ fontSize: 18 }}>ℹ️</Text>
          </View>

          <View style={styles.rowTextCol}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>
              About DriveLedger
            </Text>
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              Zero tracking, zero accounts, your data stays on your phone
            </Text>
          </View>

          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M9 18L15 12L9 6"
              stroke={colors.textTertiary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>
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
  appCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 24,
  },
  appIcon: {
    width: 60,
    height: 60,
    marginBottom: 12,
  },
  appTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  brandDrive: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  brandLedger: {
    fontSize: 22,
    fontWeight: '400',
    letterSpacing: -0.2,
    opacity: 0.85,
  },
  versionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 12,
  },
  versionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  appPhilosophy: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
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
});
