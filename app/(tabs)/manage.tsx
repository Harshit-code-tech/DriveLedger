/**
 * Manage Tab Screen
 *
 * Transformed from Settings to Manage — a focused automotive management hub.
 *
 * Information Architecture:
 * - Manage Overview: Active Vehicle Overview card, 5 organized management section cards, App version footer
 * - 5 Dedicated Management Sections (rendered strictly when active):
 *   1. Vehicles: Manage registered vehicles, active selection, add/edit/archive/restore
 *   2. Preferences: Currency, distance, fuel volume, tyre pressure, default vehicle, system appearance
 *   3. GPS & Notifications: GPS tracking profile, location permissions status, service/doc alerts
 *   4. Data & Backup: AES-256-GCM encrypted backup (.dlbak), CSV export, restore flow
 *   5. App Information: App version, onboarding replay, safety guide, update check, about dialog
 *
 * Architectural Guarantees:
 * - 100% offline-first; no remote dependencies or mock data
 * - Global vehicle selection state preserved and synchronized with all tabs and Android widgets
 * - Lightweight overview; sections mounted on demand (Section 12A)
 * - Android hardware back button smoothly returns from any section to overview
 */

import Constants from "expo-constants";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, BackHandler, Platform, StyleSheet, View } from "react-native";

// Modals & Pickers
import { BackupPasswordModal } from "@/components/BackupPasswordModal";
import { OperationProgressModal } from "@/components/OperationProgressModal";
import { OptionPicker } from "@/components/OptionPicker";
import { RestorePasswordModal } from "@/components/RestorePasswordModal";

// Manage Components & Theme
import {
  ManageHeaderBar,
  type ManageSection,
} from "@/components/manage/ManageHeaderBar";
import { ManageOverview } from "@/components/manage/ManageOverview";
import { useManageColors } from "@/components/manage/manageTheme";
import { ManageAppInfoScreen } from "@/components/manage/screens/ManageAppInfoScreen";
import { ManageDataBackupScreen } from "@/components/manage/screens/ManageDataBackupScreen";
import { ManageGpsScreen } from "@/components/manage/screens/ManageGpsScreen";
import { ManageNotificationsScreen } from "@/components/manage/screens/ManageNotificationsScreen";
import { ManagePreferencesScreen } from "@/components/manage/screens/ManagePreferencesScreen";
import { ManageVehiclesScreen } from "@/components/manage/screens/ManageVehiclesScreen";

// Stores & State
import {
  CURRENCY_OPTIONS,
  DISTANCE_OPTIONS,
  DOC_LEAD_DAYS_OPTIONS,
  FUEL_VOLUME_OPTIONS,
  GPS_TRACKING_PROFILE_OPTIONS,
  PRESSURE_OPTIONS,
  THEME_MODE_OPTIONS,
  usePreferencesStore,
  type CurrencyCode,
  type DistanceUnit,
  type FuelVolumeUnit,
  type GpsTrackingProfile,
  type PressureUnit,
  type ThemeMode,
} from "@/stores/preferencesStore";
import { useVehicleStore } from "@/stores/vehicleStore";
import type { Vehicle } from "@/types/vehicle";

// Services & Engine
import {
  exportCsvFile,
  exportToFile,
  pickAndVerifyBackup,
  restoreFromValidated,
} from "@/engine/backupEngine";
import { refreshReminders } from "@/services/notificationService";
import {
  checkForAppUpdate,
  showDataSafetyGuide,
} from "@/services/updateChecker";
import { syncWidgetState } from "@/widgets/widgetDataService";

/** Sentinel value for "no explicit default — use the first-added vehicle". */
const FIRST_VEHICLE_OPTION = "__first__";

const GPS_PROFILE_SHORT_LABELS: Record<GpsTrackingProfile, string> = {
  high_accuracy: "High Accuracy",
  balanced: "Balanced",
  battery_saver: "Battery Saver",
};

export default function ManageScreen() {
  const colors = useManageColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ section?: ManageSection }>();

  // ── Navigation Section State ──
  const [activeSection, setActiveSection] = useState<ManageSection>("overview");

  useEffect(() => {
    if (params.section) {
      if (
        params.section === "gps_notifications" ||
        params.section === "gps_tracking"
      ) {
        setActiveSection("trip_tracking");
      } else if (
        [
          "overview",
          "vehicles",
          "preferences",
          "trip_tracking",
          "gps_tracking",
          "notifications",
          "data_backup",
          "app_info",
        ].includes(params.section)
      ) {
        setActiveSection(params.section as ManageSection);
      }
    }
  }, [params.section]);

  // Handle Android Hardware Back Button: return to overview if in a sub-section
  useEffect(() => {
    const onHardwareBack = () => {
      if (activeSection !== "overview") {
        setActiveSection("overview");
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onHardwareBack,
    );
    return () => subscription.remove();
  }, [activeSection]);

  // ── Vehicle Store ──
  const vehicles = useVehicleStore((s) => s.vehicles);
  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);
  const selectVehicle = useVehicleStore((s) => s.selectVehicle);
  const loadVehicles = useVehicleStore((s) => s.loadVehicles);
  const loadArchivedVehicles = useVehicleStore((s) => s.loadArchivedVehicles);
  const archivedVehicles = useVehicleStore((s) => s.archivedVehicles);
  const archiveVehicle = useVehicleStore((s) => s.archiveVehicle);
  const restoreVehicle = useVehicleStore((s) => s.restoreVehicle);

  // ── Preferences Store ──
  const currency = usePreferencesStore((s) => s.currency);
  const distanceUnit = usePreferencesStore((s) => s.distanceUnit);
  const fuelVolumeUnit = usePreferencesStore((s) => s.fuelVolumeUnit);
  const pressureUnit = usePreferencesStore((s) => s.pressureUnit);
  const gpsTrackingProfile = usePreferencesStore((s) => s.gpsTrackingProfile);
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const defaultVehicleId = usePreferencesStore((s) => s.defaultVehicleId);
  const notificationsEnabled = usePreferencesStore(
    (s) => s.notificationsEnabled,
  );
  const notifyDocumentExpiry = usePreferencesStore(
    (s) => s.notifyDocumentExpiry,
  );
  const notifyServiceDue = usePreferencesStore((s) => s.notifyServiceDue);
  const notifyMaintenanceTargets = usePreferencesStore(
    (s) => s.notifyMaintenanceTargets,
  );
  const docExpiryLeadDays = usePreferencesStore((s) => s.docExpiryLeadDays);

  const setCurrency = usePreferencesStore((s) => s.setCurrency);
  const setDistanceUnit = usePreferencesStore((s) => s.setDistanceUnit);
  const setFuelVolumeUnit = usePreferencesStore((s) => s.setFuelVolumeUnit);
  const setPressureUnit = usePreferencesStore((s) => s.setPressureUnit);
  const setGpsTrackingProfile = usePreferencesStore(
    (s) => s.setGpsTrackingProfile,
  );
  const setThemeMode = usePreferencesStore((s) => s.setThemeMode);
  const setDefaultVehicleId = usePreferencesStore((s) => s.setDefaultVehicleId);
  const setNotificationsEnabled = usePreferencesStore(
    (s) => s.setNotificationsEnabled,
  );
  const setNotifyDocumentExpiry = usePreferencesStore(
    (s) => s.setNotifyDocumentExpiry,
  );
  const setNotifyServiceDue = usePreferencesStore((s) => s.setNotifyServiceDue);
  const setNotifyMaintenanceTargets = usePreferencesStore(
    (s) => s.setNotifyMaintenanceTargets,
  );
  const setDocExpiryLeadDays = usePreferencesStore(
    (s) => s.setDocExpiryLeadDays,
  );

  // ── Local Operation State ──
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [operationModal, setOperationModal] = useState<{
    title: string;
    subtitle: string;
  } | null>(null);

  // Modals visibility
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [importPasswordModalVisible, setImportPasswordModalVisible] =
    useState(false);
  const [pendingFileContent, setPendingFileContent] = useState<string | null>(
    null,
  );

  // Option pickers visibility
  const [pickerCurrency, setPickerCurrency] = useState(false);
  const [pickerDistance, setPickerDistance] = useState(false);
  const [pickerFuel, setPickerFuel] = useState(false);
  const [pickerPressure, setPickerPressure] = useState(false);
  const [pickerGpsTrackingProfile, setPickerGpsTrackingProfile] =
    useState(false);
  const [pickerVehicle, setPickerVehicle] = useState(false);
  const [pickerThemeMode, setPickerThemeMode] = useState(false);
  const [pickerDocLeadDays, setPickerDocLeadDays] = useState(false);

  // Refresh vehicles on focus
  useFocusEffect(
    useCallback(() => {
      loadVehicles();
      loadArchivedVehicles();
    }, []),
  );

  // ── Derived Labels ──
  const currencyOption = CURRENCY_OPTIONS.find((o) => o.value === currency);
  const currencyLabel = currencyOption
    ? `${currencyOption.symbol} ${currencyOption.value}`
    : currency;
  const currencySymbol = currencyOption?.symbol ?? currency;
  const defaultVehicleLabel =
    vehicles.find((v) => v.id === defaultVehicleId)?.nickname ??
    "First Added (auto)";
  const themeModeLabel =
    THEME_MODE_OPTIONS.find((o) => o.value === themeMode)?.label ??
    "System Default (Auto)";
  const gpsTrackingProfileShortLabel =
    GPS_PROFILE_SHORT_LABELS[gpsTrackingProfile] ?? "High Accuracy";
  const appVersion = Constants.expoConfig?.version || "1.0.0";

  // Vehicle picker options
  const vehiclePickerOptions = [
    { value: FIRST_VEHICLE_OPTION, label: "First Added (auto)" },
    ...vehicles.map((v) => ({
      value: v.id,
      label: `${v.nickname} · ${v.registration_number}`,
    })),
  ];

  // ── Backup Actions ──
  const handleBackup = () => setExportModalVisible(true);

  const submitExport = async (password: string) => {
    setExportModalVisible(false);
    setOperationModal({
      title: "Backup in Progress",
      subtitle: "Encrypting your database with AES-256-GCM. Please wait...",
    });
    await new Promise((resolve) => setTimeout(resolve, 80));

    try {
      const result = await exportToFile(password);
      setOperationModal(null);
      if (result.success) {
        Alert.alert("🎉 Backup Created!", result.message);
      } else {
        Alert.alert("😨 Backup Failed", result.message);
      }
    } catch (e) {
      setOperationModal(null);
      Alert.alert(
        "😨 Backup Failed",
        e instanceof Error
          ? e.message
          : "An unexpected error occurred while creating backup.",
      );
    }
  };

  // ── CSV Export ──
  const handleExportCsv = async () => {
    setOperationModal({
      title: "Export in Progress",
      subtitle: "Generating your ledger spreadsheet file. Please wait...",
    });
    await new Promise((resolve) => setTimeout(resolve, 80));

    try {
      const result = await exportCsvFile();
      setOperationModal(null);
      if (result.success) {
        Alert.alert("🎉 CSV Exported!", result.message);
      } else {
        Alert.alert("😨 Export Failed", result.message);
      }
    } catch (e) {
      setOperationModal(null);
      Alert.alert(
        "😨 Export Failed",
        e instanceof Error
          ? e.message
          : "An unexpected error occurred during CSV export.",
      );
    }
  };

  // ── Check for Updates ──
  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    try {
      await checkForAppUpdate({
        manual: true,
        onBeforeAlert: () => setIsCheckingUpdate(false),
      });
    } catch {
      // Handled internally in checkForAppUpdate
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  // ── Import / Restore ──
  const handleImport = async () => {
    try {
      const verified = await pickAndVerifyBackup();

      if (!verified.success && !verified.requiresPassword) {
        if (verified.message !== "No file selected.") {
          Alert.alert("🚫 Cannot Restore", verified.message);
        }
        return;
      }

      if (verified.requiresPassword && verified.pickedFileContent) {
        setPendingFileContent(verified.pickedFileContent);
        setImportPasswordModalVisible(true);
        return;
      }

      if (verified.backup) {
        confirmAndRestore(verified.backup);
      }
    } catch (e) {
      Alert.alert(
        "🚫 Cannot Restore",
        e instanceof Error
          ? e.message
          : "Could not read the selected backup file.",
      );
    }
  };

  const confirmAndRestore = (backup: any) => {
    const tripCount = backup.data.trips?.length ?? 0;
    const tripInfo =
      tripCount > 0 ? `\n🗺️ ${tripCount} trip history record(s)` : "";

    Alert.alert(
      "⚠️ Replace All Data?",
      `This will PERMANENTLY WIPE your current data and restore from the selected backup.\n\nBackup contains:\n🚗 ${backup.data.vehicles.length} vehicle(s)\n⛽ ${backup.data.fuel_entries.length} fuel entries\n🔧 ${backup.data.service_records.length} service records\n💸 ${backup.data.expenses.length} expenses\n📄 ${backup.data.documents.length} documents${tripInfo}\n\nThere is NO UNDO. Continue?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Restore!",
          style: "destructive",
          onPress: async () => {
            setOperationModal({
              title: "Restore in Progress",
              subtitle:
                "Writing records to database and reconciling reminders. Please do not close the app...",
            });
            await new Promise((resolve) => setTimeout(resolve, 80));

            try {
              const result = restoreFromValidated(backup);
              setOperationModal(null);
              if (result.success && result.counts) {
                loadVehicles();
                const restoredTrips = result.counts.trips
                  ? `\n🗺️ ${result.counts.trips} trip(s)`
                  : "";
                Alert.alert(
                  "🎉 Data Restored!",
                  `Everything's back!\n\n🚗 ${result.counts.vehicles} vehicle(s)\n⛽ ${result.counts.fuel_entries} fuel entries\n🔧 ${result.counts.service_records} service records\n💸 ${result.counts.expenses} expenses\n📄 ${result.counts.documents} documents${restoredTrips}\n\nWelcome back! 😄`,
                );
              } else {
                Alert.alert("😨 Restore Failed", result.message);
              }
            } catch (e) {
              setOperationModal(null);
              Alert.alert(
                "😨 Restore Failed",
                e instanceof Error
                  ? e.message
                  : "An unexpected error occurred while restoring data.",
              );
            }
          },
        },
      ],
    );
  };

  // ── Vehicle Archive / Restore Handlers ──
  const handleArchive = (vehicle: Vehicle) => {
    Alert.alert(
      "Archive This Ride? 🏎️",
      `"${vehicle.nickname}" will take a break from your active list.\n\nAll its history stays safe. You can bring it back anytime!`,
      [
        { text: "Keep It Active", style: "cancel" },
        {
          text: "Archive It",
          style: "destructive",
          onPress: () => archiveVehicle(vehicle.id),
        },
      ],
    );
  };

  const handleRestoreVehicle = (vehicle: Vehicle) => {
    Alert.alert(
      "Welcome Back! 🎉",
      `"${vehicle.nickname}" is ready to roll again!`,
      [
        { text: "Nah, Keep Archived", style: "cancel" },
        {
          text: "Restore It!",
          onPress: () => restoreVehicle(vehicle.id),
        },
      ],
    );
  };

  // ── Toggle Theme Action ──
  const handleToggleTheme = () => {
    if (colors.isDark) {
      setThemeMode("light");
    } else {
      setThemeMode("dark");
    }
  };

  // ── Vehicle Selection Handler ──
  const handleSelectVehicle = (id: string) => {
    selectVehicle(id);
    if (Platform.OS === "android") {
      syncWidgetState().catch(() => {});
    }
  };

  // ── About Dialog ──
  const handleShowAboutDialog = () => {
    Alert.alert(
      `DriveLedger v${appVersion} 🚗`,
      "Fuel, mileage, services, documents — all tracked, all offline, zero drama.\n\nNo account. No cloud. Your data stays on your phone, where it belongs. 🔐",
      [{ text: "Love it! ❤️" }],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Fixed Automotive Header Bar ── */}
      <ManageHeaderBar
        activeSection={activeSection}
        onBack={() => setActiveSection("overview")}
        colors={colors}
      />

      {/* ── On-Demand Section Content ── */}
      {activeSection === "overview" && (
        <ManageOverview
          selectedVehicle={selectedVehicle}
          vehiclesCount={vehicles.length}
          currencySymbol={currencySymbol}
          distanceUnit={distanceUnit}
          gpsTrackingProfileLabel={gpsTrackingProfileShortLabel}
          notificationsEnabled={notificationsEnabled}
          onSelectSection={(sec) => setActiveSection(sec)}
          onAddVehicle={() => router.push("/add-vehicle")}
          onBackupData={handleBackup}
          onExportCsv={handleExportCsv}
          onToggleTheme={handleToggleTheme}
          colors={colors}
        />
      )}

      {activeSection === "vehicles" && (
        <ManageVehiclesScreen
          vehicles={vehicles}
          selectedVehicleId={selectedVehicle?.id ?? null}
          defaultVehicleId={defaultVehicleId}
          archivedVehicles={archivedVehicles}
          pressureUnit={pressureUnit}
          onSelectVehicle={handleSelectVehicle}
          onEditVehicle={(id) =>
            router.push({ pathname: "/edit-vehicle", params: { id } })
          }
          onArchiveVehicle={handleArchive}
          onRestoreVehicle={handleRestoreVehicle}
          onAddVehicle={() => router.push("/add-vehicle")}
          colors={colors}
        />
      )}

      {activeSection === "preferences" && (
        <ManagePreferencesScreen
          currencyLabel={currencyLabel}
          distanceUnit={distanceUnit}
          fuelVolumeUnit={fuelVolumeUnit}
          pressureUnit={pressureUnit}
          defaultVehicleLabel={defaultVehicleLabel}
          themeModeLabel={themeModeLabel}
          onOpenCurrencyPicker={() => setPickerCurrency(true)}
          onOpenDistancePicker={() => setPickerDistance(true)}
          onOpenFuelPicker={() => setPickerFuel(true)}
          onOpenPressurePicker={() => setPickerPressure(true)}
          onOpenDefaultVehiclePicker={() => setPickerVehicle(true)}
          onOpenThemeModePicker={() => setPickerThemeMode(true)}
          colors={colors}
        />
      )}

      {(activeSection === "trip_tracking" ||
        activeSection === "gps_tracking" ||
        activeSection === "gps_notifications") && (
        <ManageGpsScreen
          gpsTrackingProfileLabel={gpsTrackingProfileShortLabel}
          onOpenGpsProfilePicker={() => setPickerGpsTrackingProfile(true)}
          colors={colors}
        />
      )}

      {activeSection === "notifications" && (
        <ManageNotificationsScreen
          notificationsEnabled={notificationsEnabled}
          notifyDocumentExpiry={notifyDocumentExpiry}
          notifyServiceDue={notifyServiceDue}
          notifyMaintenanceTargets={notifyMaintenanceTargets}
          docExpiryLeadDays={docExpiryLeadDays}
          onOpenDocLeadDaysPicker={() => setPickerDocLeadDays(true)}
          onToggleNotifications={(val) => {
            setNotificationsEnabled(val);
            refreshReminders();
          }}
          onToggleDocExpiry={(val) => {
            setNotifyDocumentExpiry(val);
            refreshReminders();
          }}
          onToggleServiceDue={(val) => {
            setNotifyServiceDue(val);
            refreshReminders();
          }}
          onToggleMaintenanceTargets={(val) => {
            setNotifyMaintenanceTargets(val);
            refreshReminders();
          }}
          colors={colors}
        />
      )}

      {activeSection === "data_backup" && (
        <ManageDataBackupScreen
          onBackup={handleBackup}
          onExportCsv={handleExportCsv}
          onRestore={handleImport}
          isOperating={!!operationModal}
          colors={colors}
        />
      )}

      {activeSection === "app_info" && (
        <ManageAppInfoScreen
          appVersion={appVersion}
          onReplayWalkthrough={() =>
            router.push({
              pathname: "/onboarding",
              params: { mode: "replay" },
            })
          }
          onShowDataSafetyGuide={showDataSafetyGuide}
          onCheckForUpdates={handleCheckUpdate}
          onShowAboutDialog={handleShowAboutDialog}
          colors={colors}
        />
      )}

      {/* ── Option Pickers ── */}
      <OptionPicker<CurrencyCode>
        visible={pickerCurrency}
        title="Currency"
        options={CURRENCY_OPTIONS}
        selected={currency}
        onSelect={setCurrency}
        onClose={() => setPickerCurrency(false)}
        colors={colors as any}
      />
      <OptionPicker<DistanceUnit>
        visible={pickerDistance}
        title="Distance Unit"
        options={DISTANCE_OPTIONS}
        selected={distanceUnit}
        onSelect={setDistanceUnit}
        onClose={() => setPickerDistance(false)}
        colors={colors as any}
      />
      <OptionPicker<FuelVolumeUnit>
        visible={pickerFuel}
        title="Fuel Volume Unit"
        options={FUEL_VOLUME_OPTIONS}
        selected={fuelVolumeUnit}
        onSelect={setFuelVolumeUnit}
        onClose={() => setPickerFuel(false)}
        colors={colors as any}
      />
      <OptionPicker<PressureUnit>
        visible={pickerPressure}
        title="Tyre Pressure Unit"
        options={PRESSURE_OPTIONS}
        selected={pressureUnit}
        onSelect={setPressureUnit}
        onClose={() => setPickerPressure(false)}
        colors={colors as any}
      />
      <OptionPicker<GpsTrackingProfile>
        visible={pickerGpsTrackingProfile}
        title="GPS Tracking Profile"
        options={GPS_TRACKING_PROFILE_OPTIONS}
        selected={gpsTrackingProfile}
        onSelect={setGpsTrackingProfile}
        onClose={() => setPickerGpsTrackingProfile(false)}
        colors={colors as any}
      />
      <OptionPicker<string>
        visible={pickerVehicle}
        title="Default Vehicle"
        options={vehiclePickerOptions}
        selected={defaultVehicleId ?? FIRST_VEHICLE_OPTION}
        onSelect={async (id) => {
          const newDefaultId = id === FIRST_VEHICLE_OPTION ? null : id;
          await setDefaultVehicleId(newDefaultId);
          if (newDefaultId) {
            selectVehicle(newDefaultId);
          } else if (vehicles[0]) {
            selectVehicle(vehicles[0].id);
          }
          if (Platform.OS === "android") {
            syncWidgetState().catch(() => {});
          }
        }}
        onClose={() => setPickerVehicle(false)}
        colors={colors as any}
      />
      <OptionPicker<string>
        visible={pickerDocLeadDays}
        title="Document Notice Window"
        options={DOC_LEAD_DAYS_OPTIONS}
        selected={String(docExpiryLeadDays)}
        onSelect={async (daysStr) => {
          await setDocExpiryLeadDays(parseInt(daysStr, 10));
          refreshReminders();
        }}
        onClose={() => setPickerDocLeadDays(false)}
        colors={colors as any}
      />
      <OptionPicker<ThemeMode>
        visible={pickerThemeMode}
        title="App Theme"
        options={THEME_MODE_OPTIONS}
        selected={themeMode}
        onSelect={async (mode) => {
          await setThemeMode(mode);
        }}
        onClose={() => setPickerThemeMode(false)}
        colors={colors as any}
      />

      {/* ── Progress & Verification Modals ── */}
      <OperationProgressModal
        visible={isCheckingUpdate}
        title="Checking for Updates"
        subtitle="Connecting to GitHub Releases to check for the latest APK build..."
        colors={colors as any}
      />
      <BackupPasswordModal
        visible={exportModalVisible}
        onClose={() => setExportModalVisible(false)}
        onSubmit={submitExport}
        colors={colors as any}
      />
      <RestorePasswordModal
        visible={importPasswordModalVisible}
        fileContent={pendingFileContent}
        onClose={() => {
          setImportPasswordModalVisible(false);
          setPendingFileContent(null);
        }}
        onSuccess={(backup) => {
          setImportPasswordModalVisible(false);
          setPendingFileContent(null);
          confirmAndRestore(backup);
        }}
        colors={colors as any}
      />
      <OperationProgressModal
        visible={!!operationModal}
        title={operationModal?.title ?? ""}
        subtitle={operationModal?.subtitle ?? ""}
        colors={colors as any}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
