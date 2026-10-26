/**
 * Settings Screen
 *
 * Sections:
 * 1. Preferences — currency, distance unit, fuel unit, pressure unit, default vehicle
 * 2. Your Vehicles — view, edit, archive active vehicles
 * 3. Archived Vehicles — restore or permanently remove
 * 4. Data — backup (export .dlbak file) & restore (pick .dlbak file)
 * 5. About — version info, update check, data safety guide
 */

import { BackupPasswordModal } from '@/components/BackupPasswordModal';
import { OperationProgressModal } from '@/components/OperationProgressModal';
import { OptionPicker } from '@/components/OptionPicker';
import { RestorePasswordModal } from '@/components/RestorePasswordModal';
import { SettingsRow } from '@/components/SettingsRow';
import { FUEL_TYPE_SHORT_LABELS } from '@/constants/fuelTypes';
import { Sizing, Spacing, Typography } from '@/constants/theme';
import {
  exportCsvFile,
  exportToFile,
  pickAndVerifyBackup,
  restoreFromValidated,
} from '@/engine/backupEngine';
import { useThemeColors } from '@/hooks/useThemeColors';
import { refreshReminders } from '@/services/notificationService';
import { checkForAppUpdate, showDataSafetyGuide } from '@/services/updateChecker';
import {
  CURRENCY_OPTIONS, DISTANCE_OPTIONS,
  DOC_LEAD_DAYS_OPTIONS,
  FUEL_VOLUME_OPTIONS, PRESSURE_OPTIONS,
  usePreferencesStore,
  type CurrencyCode, type DistanceUnit, type FuelVolumeUnit, type PressureUnit,
} from '@/stores/preferencesStore';
import { useVehicleStore } from '@/stores/vehicleStore';
import type { Vehicle } from '@/types/vehicle';
import { syncWidgetState } from '@/widgets/widgetDataService';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';


// OptionPicker — see src/components/OptionPicker.tsx
// SettingsRow  — see src/components/SettingsRow.tsx

/** Sentinel value for "no explicit default — use the first-added vehicle". */
const FIRST_VEHICLE_OPTION = '__first__';

// ─── Main Screen ──────────────────────────────────────────────────────────


export default function SettingsScreen() {
  const colors = useThemeColors();
  const router = useRouter();

  // Vehicle store
  const vehicles = useVehicleStore((s) => s.vehicles);
  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);
  const selectVehicle = useVehicleStore((s) => s.selectVehicle);
  const loadVehicles = useVehicleStore((s) => s.loadVehicles);
  const loadArchivedVehicles = useVehicleStore((s) => s.loadArchivedVehicles);
  const archivedVehicles = useVehicleStore((s) => s.archivedVehicles);
  const archiveVehicle = useVehicleStore((s) => s.archiveVehicle);
  const restoreVehicle = useVehicleStore((s) => s.restoreVehicle);

  // Preferences store
  const currency = usePreferencesStore((s) => s.currency);
  const distanceUnit = usePreferencesStore((s) => s.distanceUnit);
  const fuelVolumeUnit = usePreferencesStore((s) => s.fuelVolumeUnit);
  const pressureUnit = usePreferencesStore((s) => s.pressureUnit);
  const defaultVehicleId = usePreferencesStore((s) => s.defaultVehicleId);
  const notificationsEnabled = usePreferencesStore((s) => s.notificationsEnabled);
  const notifyDocumentExpiry = usePreferencesStore((s) => s.notifyDocumentExpiry);
  const notifyServiceDue = usePreferencesStore((s) => s.notifyServiceDue);
  const notifyMaintenanceTargets = usePreferencesStore((s) => s.notifyMaintenanceTargets);
  const docExpiryLeadDays = usePreferencesStore((s) => s.docExpiryLeadDays);

  const setCurrency = usePreferencesStore((s) => s.setCurrency);
  const setDistanceUnit = usePreferencesStore((s) => s.setDistanceUnit);
  const setFuelVolumeUnit = usePreferencesStore((s) => s.setFuelVolumeUnit);
  const setPressureUnit = usePreferencesStore((s) => s.setPressureUnit);
  const setDefaultVehicleId = usePreferencesStore((s) => s.setDefaultVehicleId);
  const setNotificationsEnabled = usePreferencesStore((s) => s.setNotificationsEnabled);
  const setNotifyDocumentExpiry = usePreferencesStore((s) => s.setNotifyDocumentExpiry);
  const setNotifyServiceDue = usePreferencesStore((s) => s.setNotifyServiceDue);
  const setNotifyMaintenanceTargets = usePreferencesStore((s) => s.setNotifyMaintenanceTargets);
  const setDocExpiryLeadDays = usePreferencesStore((s) => s.setDocExpiryLeadDays);

  // Local UI state
  const [showArchived, setShowArchived] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

  // Operation progress overlay — shared by backup / restore / export flows
  const [operationModal, setOperationModal] = useState<{
    title: string;
    subtitle: string;
  } | null>(null);

  // Backup modal visibility (state lives inside BackupPasswordModal)
  const [exportModalVisible, setExportModalVisible] = useState(false);

  // Restore modal + pending encrypted file content (state lives inside RestorePasswordModal)
  const [importPasswordModalVisible, setImportPasswordModalVisible] = useState(false);
  const [pendingFileContent, setPendingFileContent] = useState<string | null>(null);

  // Option picker visibility
  const [pickerCurrency, setPickerCurrency] = useState(false);
  const [pickerDistance, setPickerDistance] = useState(false);
  const [pickerFuel, setPickerFuel] = useState(false);
  const [pickerPressure, setPickerPressure] = useState(false);
  const [pickerVehicle, setPickerVehicle] = useState(false);
  const [pickerDocLeadDays, setPickerDocLeadDays] = useState(false);

  // Load vehicles + archived list on every focus
  useFocusEffect(
    useCallback(() => {
      loadVehicles();
      loadArchivedVehicles();
    }, [])
  );

  // ── Derived display labels ──
  const currencyLabel = CURRENCY_OPTIONS.find((o) => o.value === currency)?.symbol ?? currency;
  const defaultVehicleLabel = vehicles.find((v) => v.id === defaultVehicleId)?.nickname ?? 'First Added';

  // ── Vehicle picker options ──
  const vehiclePickerOptions = [
    { value: FIRST_VEHICLE_OPTION, label: 'First Added (auto)' },
    ...vehicles.map((v) => ({ value: v.id, label: `${v.nickname} · ${v.registration_number}` })),
  ];

  // ── Export — opens BackupPasswordModal; actual export triggered by onSubmit callback ──
  const handleBackup = () => setExportModalVisible(true);

  // Called by BackupPasswordModal.onSubmit with the validated password
  const submitExport = async (password: string) => {
    setExportModalVisible(false);
    setOperationModal({
      title: 'Backup in Progress',
      subtitle: 'Encrypting your database with AES-256-GCM. Please wait...',
    });
    // Allow UI thread to paint the progress modal
    await new Promise((resolve) => setTimeout(resolve, 80));

    try {
      const result = await exportToFile(password);
      setOperationModal(null);
      if (result.success) {
        Alert.alert('🎉 Backup Created!', result.message);
      } else {
        Alert.alert('😨 Backup Failed', result.message);
      }
    } catch (e) {
      setOperationModal(null);
      Alert.alert(
        '😨 Backup Failed',
        e instanceof Error ? e.message : 'An unexpected error occurred while creating backup.'
      );
    }
  };

  // ── CSV export — creates and exports a real .csv file ──
  const handleExportCsv = async () => {
    setOperationModal({
      title: 'Export in Progress',
      subtitle: 'Generating your ledger spreadsheet file. Please wait...',
    });
    await new Promise((resolve) => setTimeout(resolve, 80));

    try {
      const result = await exportCsvFile();
      setOperationModal(null);
      if (result.success) {
        Alert.alert('🎉 CSV Exported!', result.message);
      } else {
        Alert.alert('😨 Export Failed', result.message);
      }
    } catch (e) {
      setOperationModal(null);
      Alert.alert(
        '😨 Export Failed',
        e instanceof Error ? e.message : 'An unexpected error occurred during CSV export.'
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

  // ── Import — pick + verify + confirm + restore ──
  const handleImport = async () => {
    try {
      const verified = await pickAndVerifyBackup();

      if (!verified.success && !verified.requiresPassword) {
        if (verified.message !== 'No file selected.') {
          Alert.alert('🚫 Cannot Restore', verified.message);
        }
        return;
      }

      if (verified.requiresPassword && verified.pickedFileContent) {
        // Open RestorePasswordModal; verification happens inside it
        setPendingFileContent(verified.pickedFileContent);
        setImportPasswordModalVisible(true);
        return;
      }

      if (verified.backup) {
        confirmAndRestore(verified.backup);
      }
    } catch (e) {
      Alert.alert(
        '🚫 Cannot Restore',
        e instanceof Error ? e.message : 'Could not read the selected backup file.'
      );
    }
  };

  // Called by RestorePasswordModal.onSuccess after successful password verification
  const confirmAndRestore = (backup: any) => {
    const tripCount = backup.data.trips?.length ?? 0;
    const tripInfo = tripCount > 0 ? `\n🗺️ ${tripCount} trip history record(s)` : '';

    Alert.alert(
      '⚠️ Replace All Data?',
      `This will PERMANENTLY WIPE your current data and restore from the selected backup.\n\nBackup contains:\n🚗 ${backup.data.vehicles.length} vehicle(s)\n⛽ ${backup.data.fuel_entries.length} fuel entries\n🔧 ${backup.data.service_records.length} service records\n💸 ${backup.data.expenses.length} expenses\n📄 ${backup.data.documents.length} documents${tripInfo}\n\nThere is NO UNDO. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Restore!',
          style: 'destructive',
          onPress: async () => {
            setOperationModal({
              title: 'Restore in Progress',
              subtitle: 'Writing records to database and reconciling reminders. Please do not close the app...',
            });
            await new Promise((resolve) => setTimeout(resolve, 80));

            try {
              const result = restoreFromValidated(backup);
              setOperationModal(null);
              if (result.success && result.counts) {
                loadVehicles();
                const restoredTrips = result.counts.trips ? `\n🗺️ ${result.counts.trips} trip(s)` : '';
                Alert.alert(
                  '🎉 Data Restored!',
                  `Everything's back!\n\n🚗 ${result.counts.vehicles} vehicle(s)\n⛽ ${result.counts.fuel_entries} fuel entries\n🔧 ${result.counts.service_records} service records\n💸 ${result.counts.expenses} expenses\n📄 ${result.counts.documents} documents${restoredTrips}\n\nWelcome back! 😄`
                );
              } else {
                Alert.alert('😨 Restore Failed', result.message);
              }
            } catch (e) {
              setOperationModal(null);
              Alert.alert(
                '😨 Restore Failed',
                e instanceof Error ? e.message : 'An unexpected error occurred while restoring data.'
              );
            }
          },
        },
      ]
    );
  };

  // ── Archive vehicle ──
  const handleArchive = (vehicle: Vehicle) => {
    Alert.alert(
      'Archive This Ride? 🏎️',
      `"${vehicle.nickname}" will take a break from your active list.\n\nAll its history stays safe. You can bring it back anytime!`,
      [
        { text: 'Keep It Active', style: 'cancel' },
        {
          text: 'Archive It',
          style: 'destructive',
          // archiveVehicle automatically refreshes archivedVehicles via store
          onPress: () => archiveVehicle(vehicle.id),
        },
      ]
    );
  };

  // ── Restore archived vehicle ──
  const handleRestoreVehicle = (vehicle: Vehicle) => {
    Alert.alert(
      'Welcome Back! 🎉',
      `"${vehicle.nickname}" is ready to roll again!`,
      [
        { text: 'Nah, Keep Archived', style: 'cancel' },
        {
          text: 'Restore It!',
          // restoreVehicle calls loadVehicles() + loadArchivedVehicles() internally
          onPress: () => restoreVehicle(vehicle.id),
        },
      ]
    );
  };



  return (
    <>
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.content}>

          {/* ── Preferences ── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Preferences</Text>

          <SettingsRow
            emoji="💰"
            title="Currency"
            subtitle="How costs and prices are displayed"
            rightText={currencyLabel}
            colors={colors}
            onPress={() => setPickerCurrency(true)}
          />
          <SettingsRow
            emoji="📏"
            title="Distance Unit"
            subtitle="Odometer and trip distance display"
            rightText={distanceUnit === 'km' ? 'km' : 'mi'}
            colors={colors}
            onPress={() => setPickerDistance(true)}
          />
          <SettingsRow
            emoji="⛽"
            title="Fuel Volume Unit"
            subtitle="How fuel quantity is displayed"
            rightText={fuelVolumeUnit === 'litres' ? 'L' : 'gal'}
            colors={colors}
            onPress={() => setPickerFuel(true)}
          />
          <SettingsRow
            emoji="🔴"
            title="Tyre Pressure Unit"
            subtitle="Recommended tyre pressure display"
            rightText={pressureUnit}
            colors={colors}
            onPress={() => setPickerPressure(true)}
          />
          <SettingsRow
            emoji="🚗"
            title="Default Vehicle"
            subtitle="Which vehicle opens on launch"
            rightText={defaultVehicleLabel}
            colors={colors}
            onPress={() => setPickerVehicle(true)}
          />

          {/* ── Notifications & Reminders ── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Notifications & Reminders</Text>

          <View style={[styles.settingSwitchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flex: 1, marginRight: Spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 18 }}>🔔</Text>
                <Text style={[Typography.body, { color: colors.text, fontWeight: '600' }]}>Enable Reminders</Text>
              </View>
              <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: 2, marginLeft: 26 }]}>
                Local Android push notifications for upcoming dues
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={(val) => {
                setNotificationsEnabled(val);
                refreshReminders();
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          {notificationsEnabled && (
            <>
              <View style={[styles.settingSwitchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={{ flex: 1, marginRight: Spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 18 }}>📄</Text>
                    <Text style={[Typography.body, { color: colors.text, fontWeight: '600' }]}>Document Expiry Alerts</Text>
                  </View>
                  <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: 2, marginLeft: 26 }]}>
                    PUC, Insurance & FASTag fine avoidance warnings
                  </Text>
                </View>
                <Switch
                  value={notifyDocumentExpiry}
                  onValueChange={(val) => {
                    setNotifyDocumentExpiry(val);
                    refreshReminders();
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.dropdownSettingRow,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                onPress={() => setPickerDocLeadDays(true)}
                activeOpacity={0.7}
              >
                <View style={styles.dropdownSettingLeft}>
                  <Text style={styles.dropdownSettingEmoji}>📅</Text>
                  <View style={{ flex: 1, marginRight: Spacing.sm }}>
                    <Text style={[Typography.body, { color: colors.text, fontWeight: '600' }]}>
                      Document Notice Window
                    </Text>
                    <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                      Lead time before renewal warnings begin
                    </Text>
                  </View>
                </View>

                {/* Enclosed Dropdown Trigger */}
                <View
                  style={[
                    styles.enclosedDropdownTrigger,
                    {
                      backgroundColor: colors.primaryLight ?? (colors.primary + '18'),
                      borderColor: colors.primary + '40',
                    },
                  ]}
                >
                  <Text style={[styles.enclosedDropdownText, { color: colors.primary }]}>
                    {docExpiryLeadDays} days
                  </Text>
                  <Text style={[styles.enclosedDropdownArrow, { color: colors.primary }]}>
                    ▼
                  </Text>
                </View>
              </TouchableOpacity>

              <View style={[styles.settingSwitchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={{ flex: 1, marginRight: Spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 18 }}>🔧</Text>
                    <Text style={[Typography.body, { color: colors.text, fontWeight: '600' }]}>Service Due Reminders</Text>
                  </View>
                  <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: 2, marginLeft: 26 }]}>
                    Odometer and calendar-based service intervals
                  </Text>
                </View>
                <Switch
                  value={notifyServiceDue}
                  onValueChange={(val) => {
                    setNotifyServiceDue(val);
                    refreshReminders();
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={[styles.settingSwitchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={{ flex: 1, marginRight: Spacing.md }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 18 }}>🎯</Text>
                    <Text style={[Typography.body, { color: colors.text, fontWeight: '600' }]}>Maintenance Target Warnings</Text>
                  </View>
                  <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: 2, marginLeft: 26 }]}>
                    User-defined targets (Engine oil, brakes, tyres)
                  </Text>
                </View>
                <Switch
                  value={notifyMaintenanceTargets}
                  onValueChange={(val) => {
                    setNotifyMaintenanceTargets(val);
                    refreshReminders();
                  }}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </>
          )}

          {/* ── Active Vehicles ── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Your Vehicles ({vehicles.length})
          </Text>

          {vehicles.map((v) => (
            <View
              key={v.id}
              style={[styles.vehicleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.vehicleInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[Typography.body, { color: colors.text, fontWeight: '700' }]}>
                    {v.nickname}
                  </Text>
                  {(v.id === defaultVehicleId || (!defaultVehicleId && vehicles[0]?.id === v.id)) && (
                    <View style={{ backgroundColor: colors.primary + '20', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary }}>
                        DEFAULT
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
                  {v.registration_number} · {FUEL_TYPE_SHORT_LABELS[v.fuel_type as keyof typeof FUEL_TYPE_SHORT_LABELS] || v.fuel_type}
                </Text>
                {(v.front_tyre_pressure || v.rear_tyre_pressure) && (
                  <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
                    🚨 Tyre: {v.front_tyre_pressure ? `F ${v.front_tyre_pressure} ${pressureUnit}` : ''}
                    {v.front_tyre_pressure && v.rear_tyre_pressure ? '  ·  ' : ''}
                    {v.rear_tyre_pressure ? `R ${v.rear_tyre_pressure} ${pressureUnit}` : ''}
                  </Text>
                )}
              </View>

              <View style={styles.vehicleActions}>
                <TouchableOpacity
                  style={[styles.vehicleAction, { borderColor: colors.primary }]}
                  onPress={() => router.push({ pathname: '/edit-vehicle', params: { id: v.id } })}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.vehicleActionText, { color: colors.primary }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.vehicleAction, { borderColor: colors.border }]}
                  onPress={() => handleArchive(v)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.vehicleActionText, { color: colors.textSecondary }]}>Archive</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.addVehicleButton, { borderColor: colors.primary }]}
            onPress={() => router.push('/add-vehicle')}
            activeOpacity={0.7}
          >
            <Text style={[Typography.body, { color: colors.primary, fontWeight: '600' }]}>
              + Add Another Vehicle
            </Text>
          </TouchableOpacity>

          {/* ── Archived Vehicles ── */}
          {archivedVehicles.length > 0 && (
            <>
              <TouchableOpacity
                style={styles.archivedToggle}
                onPress={() => setShowArchived(!showArchived)}
                activeOpacity={0.7}
              >
                <Text style={[Typography.bodySmall, { color: colors.textSecondary, fontWeight: '600' }]}>
                  {showArchived ? '▲' : '▼'}  Archived Vehicles ({archivedVehicles.length})
                </Text>
              </TouchableOpacity>

              {showArchived && archivedVehicles.map((v) => (
                <View
                  key={v.id}
                  style={[styles.vehicleCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: 0.65 }]}
                >
                  <View style={styles.vehicleInfo}>
                    <Text style={[Typography.body, { color: colors.text, fontWeight: '700' }]}>{v.nickname}</Text>
                    <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
                      {v.registration_number} · Archived
                    </Text>
                    <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
                      All history is preserved.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.vehicleAction, { borderColor: colors.success }]}
                    onPress={() => handleRestoreVehicle(v)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.vehicleActionText, { color: colors.success }]}>Restore</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          {/* ── Data & Backup ── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Data & Backup</Text>

          {/* Export */}
          <TouchableOpacity
            style={[styles.dataRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleBackup}
            activeOpacity={0.75}
            disabled={!!operationModal}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 20 }}>💾</Text>
                <Text style={[Typography.body, { color: colors.text, fontWeight: '600' }]}>Download Backup</Text>
              </View>
              <Text style={[Typography.bodySmall, { color: colors.textSecondary, marginTop: 2, marginLeft: 28 }]}>
                Saves an encrypted .dlbak file - password protected with AES-256-GCM
              </Text>
            </View>
            <Text style={{ color: colors.primary, fontSize: 20 }}>⬇️</Text>
          </TouchableOpacity>

          {/* CSV Export */}
          <TouchableOpacity
            style={[styles.dataRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleExportCsv}
            activeOpacity={0.75}
            disabled={!!operationModal}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 20 }}>📊</Text>
                <Text style={[Typography.body, { color: colors.text, fontWeight: '600' }]}>Export as CSV</Text>
              </View>
              <Text style={[Typography.bodySmall, { color: colors.textSecondary, marginTop: 2, marginLeft: 28 }]}>
                Creates and saves a .csv file of your complete fuel, service & expense ledger
              </Text>
            </View>
            <Text style={{ color: colors.primary, fontSize: 20 }}>📄</Text>
          </TouchableOpacity>

          {/* Import */}
          <TouchableOpacity
            style={[styles.dataRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleImport}
            activeOpacity={0.75}
            disabled={!!operationModal}
          >
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 20 }}>📥</Text>
                <Text style={[Typography.body, { color: colors.text, fontWeight: '600' }]}>Restore from Backup</Text>
              </View>
              <Text style={[Typography.bodySmall, { color: colors.textSecondary, marginTop: 2, marginLeft: 28 }]}>
                Browse & pick a .dlbak file - decrypted with your password
              </Text>
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 18 }}>📂</Text>
          </TouchableOpacity>


          {/* ── Help & Guidance ── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Help & Guidance</Text>
          <SettingsRow
            emoji="✨"
            title="Replay App Walkthrough"
            subtitle="Learn about weighted mileage, targets & features"
            colors={colors}
            onPress={() => router.push({ pathname: '/onboarding', params: { mode: 'replay' } })}
          />
          <SettingsRow
            emoji="🛡️"
            title="Update & Data Safety Guide"
            subtitle="How to update without losing your records"
            colors={colors}
            onPress={showDataSafetyGuide}
          />
          <SettingsRow
            emoji="🔄"
            title="Check for Updates"
            subtitle="Check GitHub Releases for a new APK version"
            colors={colors}
            onPress={handleCheckUpdate}
          />

          {/* ── About ── */}
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>About</Text>
          <SettingsRow
            emoji="ℹ️"
            title="DriveLedger  v1.0.0"
            subtitle="Offline · Private · No account needed"
            colors={colors}
            onPress={() =>
              Alert.alert(
                'DriveLedger v1.0.0 🚗',
                'Fuel, mileage, services, documents - all tracked, all offline, zero drama.\n\nNo account. No cloud. Your data stays on your phone, where it belongs. 🔐',
                [{ text: 'Love it! ❤️' }]
              )
            }
          />

          <View style={{ height: Spacing.section }} />
        </View>
      </ScrollView>

      {/* Restore modal removed — now uses file picker flow directly */}

      {/* ── Preference Pickers ── */}
      <OptionPicker<CurrencyCode>
        visible={pickerCurrency}
        title="Currency"
        options={CURRENCY_OPTIONS}
        selected={currency}
        onSelect={setCurrency}
        onClose={() => setPickerCurrency(false)}
        colors={colors}
      />
      <OptionPicker<DistanceUnit>
        visible={pickerDistance}
        title="Distance Unit"
        options={DISTANCE_OPTIONS}
        selected={distanceUnit}
        onSelect={setDistanceUnit}
        onClose={() => setPickerDistance(false)}
        colors={colors}
      />
      <OptionPicker<FuelVolumeUnit>
        visible={pickerFuel}
        title="Fuel Volume Unit"
        options={FUEL_VOLUME_OPTIONS}
        selected={fuelVolumeUnit}
        onSelect={setFuelVolumeUnit}
        onClose={() => setPickerFuel(false)}
        colors={colors}
      />
      <OptionPicker<PressureUnit>
        visible={pickerPressure}
        title="Tyre Pressure Unit"
        options={PRESSURE_OPTIONS}
        selected={pressureUnit}
        onSelect={setPressureUnit}
        onClose={() => setPickerPressure(false)}
        colors={colors}
      />

      {/* Vehicle picker — vehicle IDs are plain strings, so the shared OptionPicker works;
          the FIRST_VEHICLE_OPTION sentinel maps to a null preference. */}
      <OptionPicker<string>
        visible={pickerVehicle}
        title="Default Vehicle"
        options={vehiclePickerOptions}
        selected={defaultVehicleId ?? FIRST_VEHICLE_OPTION}
        onSelect={async (id) => {
          const newDefaultId = id === FIRST_VEHICLE_OPTION ? null : id;
          await setDefaultVehicleId(newDefaultId);
          // Set as active vehicle immediately so the app and screens switch to it
          if (newDefaultId) {
            selectVehicle(newDefaultId);
          } else if (vehicles[0]) {
            selectVehicle(vehicles[0].id);
          }
          if (Platform.OS === 'android') {
            syncWidgetState().catch(() => { });
          }
        }}
        onClose={() => setPickerVehicle(false)}
        colors={colors}
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
        colors={colors}
      />


      {/* ── Checking for Updates ── */}
      <OperationProgressModal
        visible={isCheckingUpdate}
        title="Checking for Updates"
        subtitle="Connecting to GitHub Releases to check for the latest APK build..."
        colors={colors}
      />

      {/* ── Backup Password Modal ── */}
      <BackupPasswordModal
        visible={exportModalVisible}
        onClose={() => setExportModalVisible(false)}
        onSubmit={submitExport}
        colors={colors}
      />

      {/* ── Restore Password Modal ── */}
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
        colors={colors}
      />

      {/* ── Operation Progress Modal (Backup / Restore / Export in progress) ── */}
      <OperationProgressModal
        visible={!!operationModal}
        title={operationModal?.title ?? ''}
        subtitle={operationModal?.subtitle ?? ''}
        colors={colors}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: Spacing.section },
  sectionTitle: {
    fontSize: 12, fontWeight: '600', textTransform: 'uppercase',
    letterSpacing: 1, marginTop: Spacing.xxl, marginBottom: Spacing.sm, marginLeft: Spacing.xs,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.lg,
    borderRadius: Sizing.radiusMd, borderWidth: 1, marginBottom: Spacing.sm,
    minHeight: Sizing.primaryButton,
  },
  rowEmoji: { fontSize: 22, marginRight: Spacing.md, width: 32, textAlign: 'center' },
  rowText: { flex: 1 },
  vehicleCard: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.lg,
    borderRadius: Sizing.radiusMd, borderWidth: 1, marginBottom: Spacing.sm,
  },
  vehicleInfo: { flex: 1 },
  vehicleActions: { flexDirection: 'row', gap: Spacing.sm, marginLeft: Spacing.sm },
  vehicleAction: {
    borderWidth: 1.5, borderRadius: Sizing.radiusMd,
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    justifyContent: 'center', alignItems: 'center',
  },
  vehicleActionText: { fontSize: 13, fontWeight: '600' },
  addVehicleButton: {
    padding: Spacing.lg, borderRadius: Sizing.radiusMd,
    borderWidth: 2, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    minHeight: Sizing.primaryButton, marginBottom: Spacing.sm,
  },
  archivedToggle: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, marginBottom: Spacing.sm },
  // ── Data rows (export / import cards) ──
  dataRow: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.lg,
    borderRadius: Sizing.radiusMd, borderWidth: 1, marginBottom: Spacing.sm,
    minHeight: Sizing.primaryButton,
  },
  // ── Modal (kept for vehicle picker overlay etc.) ──
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalContent: {
    borderTopLeftRadius: Sizing.radiusXl, borderTopRightRadius: Sizing.radiusXl,
    padding: Spacing.xxl, paddingBottom: Spacing.section,
    maxHeight: '85%',
  },
  centerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  checkingModalCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: Sizing.radiusLg,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  checkingIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  checkingModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  checkingModalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  // ── Password Modal Styles ──
  passwordModalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Sizing.radiusLg,
    borderWidth: 1,
    padding: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  passwordModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  passwordModalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  passwordWarningBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: Sizing.radiusSm,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  passwordWarningText: {
    fontSize: 11,
    color: '#D97706',
    lineHeight: 15,
  },
  passwordErrorText: {
    fontSize: 12,
    color: '#EF4444',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  passwordInput: {
    borderWidth: 1,
    borderRadius: Sizing.radiusMd,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: Spacing.sm,
  },
  passwordButtonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  passwordCancelBtn: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordSubmitBtn: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Sizing.radiusMd,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  passwordInputFlexible: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
  },
  eyeToggleButton: {
    padding: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  eyeToggleText: {
    fontSize: 18,
  },
  settingSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  dropdownSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  dropdownSettingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownSettingEmoji: {
    fontSize: 20,
    marginRight: Spacing.md,
    width: 26,
    textAlign: 'center',
  },
  enclosedDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
  },
  enclosedDropdownText: {
    fontSize: 13,
    fontWeight: '700',
  },
  enclosedDropdownArrow: {
    fontSize: 10,
    fontWeight: '800',
  },
});
