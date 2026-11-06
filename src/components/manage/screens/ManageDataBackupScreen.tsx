/**
 * ManageDataBackupScreen
 *
 * Section 9: Data & Backup screen
 * - Download Encrypted Backup (.dlbak with AES-256-GCM)
 * - Export Spreadsheet Ledger (CSV)
 * - Restore from Backup (.dlbak with password verification)
 * - 100% offline data integrity notice
 */

import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { ManagePalette } from '../manageTheme';

interface ManageDataBackupScreenProps {
  onBackup: () => void;
  onExportCsv: () => void;
  onRestore: () => void;
  isOperating: boolean;
  colors: ManagePalette;
}

export const ManageDataBackupScreen: React.FC<ManageDataBackupScreenProps> = ({
  onBackup,
  onExportCsv,
  onRestore,
  isOperating,
  colors,
}) => {
  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Data & Local Storage
        </Text>
        <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
          Your ledger is stored locally on this device in SQLite. Create encrypted backups to keep your history safe.
        </Text>
      </View>

      <View style={styles.rowsGroup}>
        {/* 1. Download Backup */}
        <TouchableOpacity
          style={[
            styles.actionCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={onBackup}
          activeOpacity={0.7}
          disabled={isOperating}
          accessibilityRole="button"
          accessibilityLabel="Download Encrypted Backup"
        >
          <View style={[styles.iconBox, { backgroundColor: 'rgba(57, 131, 199, 0.12)' }]}>
            <Text style={{ fontSize: 20 }}>💾</Text>
          </View>

          <View style={styles.cardContent}>
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                Download Encrypted Backup
              </Text>
              <View
                style={[
                  styles.formatBadge,
                  { backgroundColor: colors.surfaceSecondary },
                ]}
              >
                <Text style={[styles.formatBadgeText, { color: colors.accent }]}>
                  .dlbak
                </Text>
              </View>
            </View>
            <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
              Exports your complete database protected with AES-256-GCM and your chosen password.
            </Text>
          </View>

          <View style={[styles.arrowBox, { backgroundColor: colors.surfaceSecondary }]}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 5V19M12 19L5 12M12 19L19 12"
                stroke={colors.accent}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </TouchableOpacity>

        {/* 2. Export as CSV */}
        <TouchableOpacity
          style={[
            styles.actionCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={onExportCsv}
          activeOpacity={0.7}
          disabled={isOperating}
          accessibilityRole="button"
          accessibilityLabel="Export as CSV spreadsheet"
        >
          <View style={[styles.iconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
            <Text style={{ fontSize: 20 }}>📊</Text>
          </View>

          <View style={styles.cardContent}>
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                Export as CSV Spreadsheet
              </Text>
              <View
                style={[
                  styles.formatBadge,
                  { backgroundColor: colors.surfaceSecondary },
                ]}
              >
                <Text style={[styles.formatBadgeText, { color: colors.statusNormal }]}>
                  .csv
                </Text>
              </View>
            </View>
            <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
              Generates a universal spreadsheet file of your fuel entries, service records, and expenses.
            </Text>
          </View>

          <View style={[styles.arrowBox, { backgroundColor: colors.surfaceSecondary }]}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path
                d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z"
                stroke={colors.statusNormal}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </TouchableOpacity>

        {/* 3. Restore from Backup */}
        <TouchableOpacity
          style={[
            styles.actionCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={onRestore}
          activeOpacity={0.7}
          disabled={isOperating}
          accessibilityRole="button"
          accessibilityLabel="Restore from Backup file"
        >
          <View style={[styles.iconBox, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
            <Text style={{ fontSize: 20 }}>📥</Text>
          </View>

          <View style={styles.cardContent}>
            <View style={styles.cardTitleRow}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                Restore from Backup
              </Text>
              <View
                style={[
                  styles.formatBadge,
                  { backgroundColor: colors.surfaceSecondary },
                ]}
              >
                <Text style={[styles.formatBadgeText, { color: colors.statusWarning }]}>
                  Decrypt
                </Text>
              </View>
            </View>
            <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
              Browse and select a .dlbak file. Decrypted with your password and validates schema before applying.
            </Text>
          </View>

          <View style={[styles.arrowBox, { backgroundColor: colors.surfaceSecondary }]}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 19V5M12 5L5 12M12 5L19 12"
                stroke={colors.statusWarning}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Security & Privacy Notice ── */}
      <View
        style={[
          styles.noticeBox,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.noticeHeader}>
          <Text style={{ fontSize: 16 }}>🛡️</Text>
          <Text style={[styles.noticeTitle, { color: colors.text }]}>
            Offline & Private by Design
          </Text>
        </View>
        <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
          DriveLedger operates 100% on your device. There is no cloud sync, telemetry, or remote servers. Backups are encrypted locally with PBKDF2-HMAC-SHA256 (100,000 iterations) and AES-256-GCM.
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
    marginBottom: 20,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  formatBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  formatBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  cardSubtitle: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  arrowBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
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
  noticeText: {
    fontSize: 11,
    lineHeight: 16,
  },
});
