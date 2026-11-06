/**
 * ManageOverview
 *
 * Section 5: Main Manage overview screen
 * - Active Vehicle Overview (Prominent automotive context, globally synced)
 * - 5 Management Sections (Vehicles, Preferences, GPS & Notifications, Data & Backup, App Info)
 * - App Version footer (dynamically derived from project configuration)
 */

import type { Vehicle } from "@/types/vehicle";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import type { ManageSection } from "./ManageHeaderBar";
import type { ManagePalette } from "./manageTheme";
import { CarSvg } from "./VehicleSvgIcon";

interface ManageOverviewProps {
  vehiclesCount: number;
  currencySymbol: string;
  distanceUnit: string;
  gpsTrackingProfileLabel: string;
  notificationsEnabled: boolean;
  onSelectSection: (section: ManageSection) => void;
  colors: ManagePalette;
  selectedVehicle?: Vehicle | null;
  onAddVehicle?: () => void;
  onBackupData?: () => void;
  onExportCsv?: () => void;
  onToggleTheme?: () => void;
}

export const ManageOverview: React.FC<ManageOverviewProps> = ({
  vehiclesCount,
  currencySymbol,
  distanceUnit,
  gpsTrackingProfileLabel,
  notificationsEnabled,
  onSelectSection,
  colors,
  onAddVehicle,
  onBackupData,
  onExportCsv,
  onToggleTheme,
}) => {
  const router = useRouter();
  const appVersion = Constants.expoConfig?.version || "1.0.0";

  const handleAddVehicle = () => {
    if (onAddVehicle) {
      onAddVehicle();
    } else {
      router.push("/add-vehicle");
    }
  };

  const handleBackupData = () => {
    if (onBackupData) {
      onBackupData();
    } else {
      onSelectSection("data_backup");
    }
  };

  const handleExportCsv = () => {
    if (onExportCsv) {
      onExportCsv();
    } else {
      onSelectSection("data_backup");
    }
  };

  const handleToggleTheme = () => {
    if (onToggleTheme) {
      onToggleTheme();
    } else {
      onSelectSection("preferences");
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Quick Actions ── */}
      <Text style={[styles.sectionsHeader, { color: colors.textSecondary }]}>
        QUICK ACTIONS
      </Text>

      <View style={styles.quickActionsContainer}>
        {/* Row 1: Add Vehicle & Backup Data */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={[
              styles.quickActionCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={handleAddVehicle}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Add Vehicle"
            accessibilityHint="Open the vehicle registration screen"
          >
            <View style={styles.quickActionTopRow}>
              <View
                style={[
                  styles.quickActionIconBox,
                  { backgroundColor: "rgba(57, 131, 199, 0.12)" },
                ]}
              >
                <CarSvg size={22} color={colors.accent} strokeWidth={1.8} />
              </View>
              <View
                style={[
                  styles.arrowPill,
                  { backgroundColor: colors.surfaceSecondary },
                ]}
              >
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M12 5V19M5 12H19"
                    stroke={colors.accent}
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
            </View>

            <View style={styles.quickActionTextContainer}>
              <Text
                style={[styles.quickActionTitle, { color: colors.text }]}
                numberOfLines={1}
              >
                Add Vehicle
              </Text>
              <Text
                style={[
                  styles.quickActionSubtitle,
                  { color: colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                New car or bike
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.quickActionCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={handleBackupData}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Backup Data"
            accessibilityHint="Create an encrypted database backup"
          >
            <View style={styles.quickActionTopRow}>
              <View
                style={[
                  styles.quickActionIconBox,
                  { backgroundColor: "rgba(57, 131, 199, 0.12)" },
                ]}
              >
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M21 15V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V15"
                    stroke={colors.accent}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Path
                    d="M7 10L12 15L17 10"
                    stroke={colors.accent}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Path
                    d="M12 15V3"
                    stroke={colors.accent}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <View
                style={[
                  styles.arrowPill,
                  { backgroundColor: colors.surfaceSecondary },
                ]}
              >
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M7 17L17 7M17 7H7M17 7V17"
                    stroke={colors.textTertiary}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
            </View>

            <View style={styles.quickActionTextContainer}>
              <Text
                style={[styles.quickActionTitle, { color: colors.text }]}
                numberOfLines={1}
              >
                Backup Data
              </Text>
              <Text
                style={[
                  styles.quickActionSubtitle,
                  { color: colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                AES-256 .dlbak
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Row 2: Export CSV & Theme Toggle */}
        <View style={[styles.quickActionsRow, { marginTop: 10 }]}>
          <TouchableOpacity
            style={[
              styles.quickActionCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={handleExportCsv}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Export CSV"
            accessibilityHint="Export logs and records to CSV spreadsheet"
          >
            <View style={styles.quickActionTopRow}>
              <View
                style={[
                  styles.quickActionIconBox,
                  { backgroundColor: "rgba(57, 131, 199, 0.12)" },
                ]}
              >
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z"
                    stroke={colors.accent}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Path
                    d="M14 2V8H20"
                    stroke={colors.accent}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Path
                    d="M8 13H16M8 17H13"
                    stroke={colors.accent}
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
              <View
                style={[
                  styles.arrowPill,
                  { backgroundColor: colors.surfaceSecondary },
                ]}
              >
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M7 17L17 7M17 7H7M17 7V17"
                    stroke={colors.textTertiary}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
            </View>

            <View style={styles.quickActionTextContainer}>
              <Text
                style={[styles.quickActionTitle, { color: colors.text }]}
                numberOfLines={1}
              >
                Export CSV
              </Text>
              <Text
                style={[
                  styles.quickActionSubtitle,
                  { color: colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                Spreadsheet report
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.quickActionCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={handleToggleTheme}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={
              colors.isDark ? "Switch to Light Mode" : "Switch to Dark Mode"
            }
            accessibilityHint="Toggles between dark and light appearance"
          >
            <View style={styles.quickActionTopRow}>
              <View
                style={[
                  styles.quickActionIconBox,
                  { backgroundColor: "rgba(57, 131, 199, 0.12)" },
                ]}
              >
                {colors.isDark ? (
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Circle
                      cx={12}
                      cy={12}
                      r={5}
                      stroke={colors.accent}
                      strokeWidth={1.8}
                    />
                    <Path
                      d="M12 1V3M12 21V23M4.22 4.22L5.64 5.64M18.36 18.36L19.78 19.78M1 12H3M21 12H23M4.22 19.78L5.64 18.36M18.36 5.64L19.78 4.22"
                      stroke={colors.accent}
                      strokeWidth={1.8}
                      strokeLinecap="round"
                    />
                  </Svg>
                ) : (
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
                      stroke={colors.accent}
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                )}
              </View>
              <View
                style={[
                  styles.arrowPill,
                  { backgroundColor: colors.surfaceSecondary },
                ]}
              >
                <Text style={{ fontSize: 11 }}>
                  {colors.isDark ? "☀️" : "🌙"}
                </Text>
              </View>
            </View>

            <View style={styles.quickActionTextContainer}>
              <Text
                style={[styles.quickActionTitle, { color: colors.text }]}
                numberOfLines={1}
              >
                {colors.isDark ? "Light Mode" : "Dark Mode"}
              </Text>
              <Text
                style={[
                  styles.quickActionSubtitle,
                  { color: colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                {colors.isDark ? "Switch to light" : "Switch to dark"}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── C. Management Sections ── */}
      <Text style={[styles.sectionsHeader, { color: colors.textSecondary }]}>
        MANAGEMENT SECTIONS
      </Text>

      <View style={styles.sectionsList}>
        {/* 1. Vehicles */}
        <TouchableOpacity
          style={[
            styles.sectionRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={() => onSelectSection("vehicles")}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Vehicles section"
        >
          <View
            style={[
              styles.sectionIconBox,
              { backgroundColor: colors.surfaceSecondary },
            ]}
          >
            <CarSvg size={22} color={colors.accent} strokeWidth={1.8} />
          </View>

          <View style={styles.sectionInfo}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Vehicles
              </Text>
              <View
                style={[
                  styles.contextBadge,
                  { backgroundColor: colors.surfaceSecondary },
                ]}
              >
                <Text
                  style={[
                    styles.contextBadgeText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {vehiclesCount}
                </Text>
              </View>
            </View>
            <Text
              style={[styles.sectionDesc, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              Manage your registered vehicles
            </Text>
          </View>

          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
              d="M9 18L15 12L9 6"
              stroke={colors.textTertiary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>

        {/* 2. Preferences */}
        <TouchableOpacity
          style={[
            styles.sectionRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={() => onSelectSection("preferences")}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Preferences section"
        >
          <View
            style={[
              styles.sectionIconBox,
              { backgroundColor: colors.surfaceSecondary },
            ]}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path
                d="M4 21V14M4 10V3M12 21V12M12 8V3M20 21V16M20 12V3M1 14H7M9 8H15M17 16H23"
                stroke={colors.accent}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>

          <View style={styles.sectionInfo}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Preferences
              </Text>
              <View
                style={[
                  styles.contextBadge,
                  { backgroundColor: colors.surfaceSecondary },
                ]}
              >
                <Text
                  style={[
                    styles.contextBadgeText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {currencySymbol} · {distanceUnit}
                </Text>
              </View>
            </View>
            <Text
              style={[styles.sectionDesc, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              Units, appearance and app behaviour
            </Text>
          </View>

          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
              d="M9 18L15 12L9 6"
              stroke={colors.textTertiary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>

        {/* 3. Trip Tracking */}
        <TouchableOpacity
          style={[
            styles.sectionRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={() => onSelectSection("trip_tracking")}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Trip Tracking section"
        >
          <View
            style={[
              styles.sectionIconBox,
              { backgroundColor: colors.surfaceSecondary },
            ]}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path
                d="M3 11L21 3L13 21L11 13L3 11Z"
                stroke={colors.accent}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>

          <View style={styles.sectionInfo}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Trip Tracking
              </Text>
              <View
                style={[
                  styles.contextBadge,
                  { backgroundColor: colors.surfaceSecondary },
                ]}
              >
                <Text
                  style={[
                    styles.contextBadgeText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {gpsTrackingProfileLabel}
                </Text>
              </View>
            </View>
            <Text
              style={[styles.sectionDesc, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              Route telemetry, location access and recording profiles
            </Text>
          </View>

          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
              d="M9 18L15 12L9 6"
              stroke={colors.textTertiary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>

        {/* 4. Reminders & Alerts */}
        <TouchableOpacity
          style={[
            styles.sectionRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={() => onSelectSection("notifications")}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Reminders and Alerts section"
        >
          <View
            style={[
              styles.sectionIconBox,
              { backgroundColor: colors.surfaceSecondary },
            ]}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path
                d="M18 8A6 6 0 0 0 6 8C6 15 3 17 3 17H21S18 15 18 8Z"
                stroke={colors.accent}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d="M13.73 21A2 2 0 0 1 10.27 21"
                stroke={colors.accent}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Circle cx="18" cy="4" r="2" fill={colors.accent} />
            </Svg>
          </View>

          <View style={styles.sectionInfo}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Reminders & Alerts
              </Text>
              <View
                style={[
                  styles.contextBadge,
                  { backgroundColor: colors.surfaceSecondary },
                ]}
              >
                <Text
                  style={[
                    styles.contextBadgeText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {notificationsEnabled ? "Alerts ON" : "Off"}
                </Text>
              </View>
            </View>
            <Text
              style={[styles.sectionDesc, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              Document expiry, service, and maintenance alerts
            </Text>
          </View>

          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
              d="M9 18L15 12L9 6"
              stroke={colors.textTertiary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>

        {/* 4. Data & Backup */}
        <TouchableOpacity
          style={[
            styles.sectionRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={() => onSelectSection("data_backup")}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Data and Backup section"
        >
          <View
            style={[
              styles.sectionIconBox,
              { backgroundColor: colors.surfaceSecondary },
            ]}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 22S20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z"
                stroke={colors.accent}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d="M9 12L11 14L15 10"
                stroke={colors.accent}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>

          <View style={styles.sectionInfo}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Data & Backup
            </Text>
            <Text
              style={[styles.sectionDesc, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              Backup, restore and export your data
            </Text>
          </View>

          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
              d="M9 18L15 12L9 6"
              stroke={colors.textTertiary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </TouchableOpacity>

        {/* 5. App Information */}
        <TouchableOpacity
          style={[
            styles.sectionRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          onPress={() => onSelectSection("app_info")}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="App Information section"
        >
          <View
            style={[
              styles.sectionIconBox,
              { backgroundColor: colors.surfaceSecondary },
            ]}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Circle
                cx="12"
                cy="12"
                r="10"
                stroke={colors.accent}
                strokeWidth={1.8}
              />
              <Path
                d="M12 16V12M12 8H12.01"
                stroke={colors.accent}
                strokeWidth={2}
                strokeLinecap="round"
              />
            </Svg>
          </View>

          <View style={styles.sectionInfo}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                App Information
              </Text>
              <View
                style={[
                  styles.contextBadge,
                  { backgroundColor: colors.surfaceSecondary },
                ]}
              >
                <Text
                  style={[
                    styles.contextBadgeText,
                    { color: colors.textSecondary },
                  ]}
                >
                  v{appVersion}
                </Text>
              </View>
            </View>
            <Text
              style={[styles.sectionDesc, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              Version, updates and onboarding
            </Text>
          </View>

          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
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

      {/* ── D. App Version Row ── */}
      <View style={styles.versionFooter}>
        <Text style={[styles.versionText, { color: colors.textTertiary }]}>
          DriveLedger v{appVersion} · Offline & Private · SQLite
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
  quickActionsContainer: {
    marginBottom: 24,
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  quickActionCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 13,
    minHeight: 102,
    justifyContent: "space-between",
  },
  quickActionTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quickActionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowPill: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionTextContainer: {
    marginTop: 10,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  quickActionSubtitle: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },
  sectionsHeader: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  sectionsList: {
    gap: 10,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  sectionIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionInfo: {
    flex: 1,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginRight: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  contextBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  contextBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  sectionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  versionFooter: {
    marginTop: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  versionText: {
    fontSize: 11,
    fontWeight: "500",
  },
});
