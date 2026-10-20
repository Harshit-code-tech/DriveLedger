/**
 * ReportExportModal Component
 *
 * Professional export modal bottom sheet presenting 3 executive report formats:
 * 1. Verified Vehicle Service Ledger (PDF for resale value & car buyers)
 * 2. Complete Vehicle Dossier (PDF with document compliance & efficiency)
 * 3. Business & Tax Reimbursement Ledger (CSV with UTF-8 BOM for Excel / Sheets)
 *
 * Provides two primary actions per report:
 * - 💾 Save to Device: Prompts user to select destination folder (Downloads, Documents)
 *   via native Storage Access Framework (Android) or Files (iOS). 100% offline local file saving.
 * - 📤 Share: Launches the OS share sheet for WhatsApp, Email, Drive, etc.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Typography, Spacing, Sizing } from '@/constants/theme';
import type { Vehicle } from '@/types/vehicle';
import * as fuelRepo from '@/database/repositories/fuelRepo';
import * as serviceRepo from '@/database/repositories/serviceRepo';
import * as expenseRepo from '@/database/repositories/expenseRepo';
import * as documentRepo from '@/database/repositories/documentRepo';
import * as maintCompRepo from '@/database/repositories/maintenanceComponentRepo';
import { computeMileageStats } from '@/engine/mileageEngine';
import { MILEAGE_UNIT_LABELS } from '@/constants/fuelTypes';
import {
  saveServiceLedgerPdf,
  exportServiceLedgerPdf,
  saveVehicleDossierPdf,
  exportVehicleDossierPdf,
  saveVehicleHistoryReportPdf,
  exportVehicleHistoryReportPdf,
  saveFuelExpensesCsvFile,
  exportFuelExpensesCsvFile,
} from '@/services/reportService';

export interface ReportExportModalProps {
  visible: boolean;
  onClose: () => void;
  vehicle: Vehicle;
}

type ExportActionKey =
  | 'save_history'
  | 'share_history'
  | 'save_service'
  | 'share_service'
  | 'save_dossier'
  | 'share_dossier'
  | 'save_csv'
  | 'share_csv'
  | null;

export function ReportExportModal({ visible, onClose, vehicle }: ReportExportModalProps) {
  const colors = useThemeColors();
  const [activeExport, setActiveExport] = useState<ExportActionKey>(null);

  // ─── 0. Vehicle History Report Handlers (Feature 7) ───────────────

  const handleSaveVehicleHistory = async () => {
    try {
      setActiveExport('save_history');
      const fuelEntries = fuelRepo.getFuelEntriesByVehicle(vehicle.id);
      const serviceRecords = serviceRepo.getServiceRecordsByVehicle(vehicle.id);
      const maintenanceComponents = maintCompRepo.getMaintenanceComponentsByVehicle(vehicle.id);
      const expenses = expenseRepo.getExpensesByVehicle(vehicle.id);
      const documents = documentRepo.getCurrentDocumentsByVehicle(vehicle.id);
      const allDocuments = documentRepo.getAllDocumentsByVehicle(vehicle.id);

      const result = await saveVehicleHistoryReportPdf({
        vehicle,
        fuelEntries,
        serviceRecords,
        maintenanceComponents,
        expenses,
        documents,
        allDocuments,
      });

      if (result.success) {
        Alert.alert('✅ Saved to Device', result.message);
      } else if (!result.cancelled && result.message) {
        Alert.alert('Save Failed', result.message);
      }
    } catch (err) {
      Alert.alert(
        'Save Failed',
        err instanceof Error ? err.message : 'An unexpected error occurred while saving the PDF.'
      );
    } finally {
      setActiveExport(null);
    }
  };

  const handleShareVehicleHistory = async () => {
    try {
      setActiveExport('share_history');
      const fuelEntries = fuelRepo.getFuelEntriesByVehicle(vehicle.id);
      const serviceRecords = serviceRepo.getServiceRecordsByVehicle(vehicle.id);
      const maintenanceComponents = maintCompRepo.getMaintenanceComponentsByVehicle(vehicle.id);
      const expenses = expenseRepo.getExpensesByVehicle(vehicle.id);
      const documents = documentRepo.getCurrentDocumentsByVehicle(vehicle.id);
      const allDocuments = documentRepo.getAllDocumentsByVehicle(vehicle.id);

      const result = await exportVehicleHistoryReportPdf({
        vehicle,
        fuelEntries,
        serviceRecords,
        maintenanceComponents,
        expenses,
        documents,
        allDocuments,
      });

      if (!result.success && !result.cancelled && result.message) {
        Alert.alert('Share Failed', result.message);
      }
    } catch (err) {
      Alert.alert(
        'Share Failed',
        err instanceof Error ? err.message : 'An unexpected error occurred while sharing the PDF.'
      );
    } finally {
      setActiveExport(null);
    }
  };

  // ─── 1. Service Ledger Handlers ────────────────────────────────────

  const handleSaveServiceLedger = async () => {
    try {
      setActiveExport('save_service');
      const serviceRecords = serviceRepo.getServiceRecordsByVehicle(vehicle.id);
      const allExpenses = expenseRepo.getExpensesByVehicle(vehicle.id);
      const repairExpenses = allExpenses.filter(
        (e) => e.category === 'Repair' || e.category === 'Tyres' || e.category === 'Accessories'
      );

      const result = await saveServiceLedgerPdf({
        vehicle,
        serviceRecords,
        repairExpenses,
      });

      if (result.success) {
        Alert.alert('✅ Saved to Device', result.message);
      } else if (!result.cancelled && result.message) {
        Alert.alert('Save Failed', result.message);
      }
    } catch (err) {
      Alert.alert(
        'Save Failed',
        err instanceof Error ? err.message : 'An unexpected error occurred while saving the PDF.'
      );
    } finally {
      setActiveExport(null);
    }
  };

  const handleShareServiceLedger = async () => {
    try {
      setActiveExport('share_service');
      const serviceRecords = serviceRepo.getServiceRecordsByVehicle(vehicle.id);
      const allExpenses = expenseRepo.getExpensesByVehicle(vehicle.id);
      const repairExpenses = allExpenses.filter(
        (e) => e.category === 'Repair' || e.category === 'Tyres' || e.category === 'Accessories'
      );

      const result = await exportServiceLedgerPdf({
        vehicle,
        serviceRecords,
        repairExpenses,
      });

      if (!result.success && !result.cancelled && result.message) {
        Alert.alert('Share Failed', result.message);
      }
    } catch (err) {
      Alert.alert(
        'Share Failed',
        err instanceof Error ? err.message : 'An unexpected error occurred while sharing the PDF.'
      );
    } finally {
      setActiveExport(null);
    }
  };

  // ─── 2. Complete Vehicle Dossier Handlers ──────────────────────────

  const handleSaveVehicleDossier = async () => {
    try {
      setActiveExport('save_dossier');
      const fuelEntries = fuelRepo.getFuelEntriesByVehicle(vehicle.id);
      const serviceRecords = serviceRepo.getServiceRecordsByVehicle(vehicle.id);
      const expenses = expenseRepo.getExpensesByVehicle(vehicle.id);
      const documents = documentRepo.getCurrentDocumentsByVehicle(vehicle.id);

      const mileageStats = computeMileageStats(fuelEntries);
      const avgMileage = mileageStats.runningAverage?.value ?? null;
      const mileageUnit = mileageStats.runningAverage?.unit
        ? MILEAGE_UNIT_LABELS[mileageStats.runningAverage.unit]
        : 'km/L';

      const result = await saveVehicleDossierPdf({
        vehicle,
        fuelEntries,
        serviceRecords,
        expenses,
        documents,
        avgMileage,
        mileageUnit,
      });

      if (result.success) {
        Alert.alert('✅ Saved to Device', result.message);
      } else if (!result.cancelled && result.message) {
        Alert.alert('Save Failed', result.message);
      }
    } catch (err) {
      Alert.alert(
        'Save Failed',
        err instanceof Error ? err.message : 'An unexpected error occurred while saving the PDF.'
      );
    } finally {
      setActiveExport(null);
    }
  };

  const handleShareVehicleDossier = async () => {
    try {
      setActiveExport('share_dossier');
      const fuelEntries = fuelRepo.getFuelEntriesByVehicle(vehicle.id);
      const serviceRecords = serviceRepo.getServiceRecordsByVehicle(vehicle.id);
      const expenses = expenseRepo.getExpensesByVehicle(vehicle.id);
      const documents = documentRepo.getCurrentDocumentsByVehicle(vehicle.id);

      const mileageStats = computeMileageStats(fuelEntries);
      const avgMileage = mileageStats.runningAverage?.value ?? null;
      const mileageUnit = mileageStats.runningAverage?.unit
        ? MILEAGE_UNIT_LABELS[mileageStats.runningAverage.unit]
        : 'km/L';

      const result = await exportVehicleDossierPdf({
        vehicle,
        fuelEntries,
        serviceRecords,
        expenses,
        documents,
        avgMileage,
        mileageUnit,
      });

      if (!result.success && !result.cancelled && result.message) {
        Alert.alert('Share Failed', result.message);
      }
    } catch (err) {
      Alert.alert(
        'Share Failed',
        err instanceof Error ? err.message : 'An unexpected error occurred while sharing the PDF.'
      );
    } finally {
      setActiveExport(null);
    }
  };

  // ─── 3. Business & Tax CSV Handlers ────────────────────────────────

  const handleSaveCsv = async () => {
    try {
      setActiveExport('save_csv');
      const fuelEntries = fuelRepo.getFuelEntriesByVehicle(vehicle.id);
      const expenses = expenseRepo.getExpensesByVehicle(vehicle.id);
      const serviceRecords = serviceRepo.getServiceRecordsByVehicle(vehicle.id);

      const result = await saveFuelExpensesCsvFile(
        vehicle,
        fuelEntries,
        expenses,
        serviceRecords
      );

      if (result.success) {
        Alert.alert('✅ Saved to Device', result.message);
      } else if (!result.cancelled && result.message) {
        Alert.alert('Save Failed', result.message);
      }
    } catch (err) {
      Alert.alert(
        'Save Failed',
        err instanceof Error ? err.message : 'An unexpected error occurred while saving the CSV.'
      );
    } finally {
      setActiveExport(null);
    }
  };

  const handleShareCsv = async () => {
    try {
      setActiveExport('share_csv');
      const fuelEntries = fuelRepo.getFuelEntriesByVehicle(vehicle.id);
      const expenses = expenseRepo.getExpensesByVehicle(vehicle.id);
      const serviceRecords = serviceRepo.getServiceRecordsByVehicle(vehicle.id);

      const result = await exportFuelExpensesCsvFile(
        vehicle,
        fuelEntries,
        expenses,
        serviceRecords
      );

      if (!result.success && !result.cancelled && result.message) {
        Alert.alert('Share Failed', result.message);
      }
    } catch (err) {
      Alert.alert(
        'Share Failed',
        err instanceof Error ? err.message : 'An unexpected error occurred while sharing the CSV.'
      );
    } finally {
      setActiveExport(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.sheetContainer, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerTitleArea}>
              <Text style={[Typography.h3, { color: colors.text }]}>Export Reports</Text>
              <View style={styles.vehicleSubtitleRow}>
                <View style={[styles.regPill, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.regPillText, { color: colors.primary }]}>
                    {vehicle.registration_number}
                  </Text>
                </View>
                <Text style={[Typography.caption, { color: colors.textSecondary }]}>
                  {vehicle.nickname}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              disabled={activeExport !== null}
              style={[styles.closeButton, { backgroundColor: colors.borderLight }]}
              accessibilityRole="button"
              accessibilityLabel="Close export dialog"
            >
              <Text style={[styles.closeButtonText, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Report Options List */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Card 0: Credible Vehicle History Report (Feature 7) */}
            <View style={[styles.reportCard, { borderColor: colors.primary, backgroundColor: colors.card }]}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardTitleGroup}>
                  <Text style={styles.cardEmoji}>📜</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[Typography.body, { fontWeight: '700', color: colors.text }]}>
                      Credible Vehicle History Report
                    </Text>
                    <View style={styles.badgeRow}>
                      <View style={[styles.badgePill, { backgroundColor: '#E0F2FE' }]}>
                        <Text style={[styles.badgeText, { color: '#0369A1' }]}>PDF</Text>
                      </View>
                      <View style={[styles.badgePill, { backgroundColor: '#DCFCE7' }]}>
                        <Text style={[styles.badgeText, { color: '#15803D' }]}>5 Sections</Text>
                      </View>
                      <View style={[styles.badgePill, { backgroundColor: '#FEF3C7' }]}>
                        <Text style={[styles.badgeText, { color: '#B45309' }]}>Provenance</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: Spacing.sm }]}>
                Executive 5-section provenance report: vehicle summary with mandatory truth disclosure, fuel & efficiency ledger with anomaly detection, parts-level maintenance history, category ownership costs with operating cost/km, and active/renewed documents.
              </Text>

              {/* Dual Action Buttons: Save to Device + Share */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  onPress={handleSaveVehicleHistory}
                  disabled={activeExport !== null}
                  activeOpacity={0.8}
                  style={[
                    styles.primarySaveButton,
                    { backgroundColor: colors.primary },
                    activeExport === 'save_history' && { opacity: 0.8 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Save Vehicle History Report PDF to device"
                >
                  {activeExport === 'save_history' ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={[styles.primarySaveButtonText, { marginLeft: Spacing.xs }]}>
                        Saving...
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.primarySaveButtonText}>💾 Save to Device</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleShareVehicleHistory}
                  disabled={activeExport !== null}
                  activeOpacity={0.8}
                  style={[
                    styles.secondaryShareButton,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                    activeExport === 'share_history' && { opacity: 0.8 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Share Vehicle History Report PDF"
                >
                  {activeExport === 'share_history' ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color={colors.text} />
                      <Text style={[styles.secondaryShareButtonText, { color: colors.text, marginLeft: Spacing.xs }]}>
                        Sharing...
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.secondaryShareButtonText, { color: colors.text }]}>📤 Share</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Card 1: Service Ledger (PDF) */}
            <View style={[styles.reportCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardTitleGroup}>
                  <Text style={styles.cardEmoji}>🔧</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[Typography.body, { fontWeight: '700', color: colors.text }]}>
                      Service & Maintenance Ledger
                    </Text>
                    <View style={styles.badgeRow}>
                      <View style={[styles.badgePill, { backgroundColor: '#E0F2FE' }]}>
                        <Text style={[styles.badgeText, { color: '#0369A1' }]}>PDF</Text>
                      </View>
                      <View style={[styles.badgePill, { backgroundColor: '#FEF3C7' }]}>
                        <Text style={[styles.badgeText, { color: '#B45309' }]}>Resale Dossier</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: Spacing.sm }]}>
                Complete dated history of garage visits, part replacements, and service costs. Essential for presenting verified maintenance provenance to buyers, Spinny, or Cars24.
              </Text>

              {/* Dual Action Buttons: Save to Device + Share */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  onPress={handleSaveServiceLedger}
                  disabled={activeExport !== null}
                  activeOpacity={0.8}
                  style={[
                    styles.primarySaveButton,
                    { backgroundColor: colors.primary },
                    activeExport === 'save_service' && { opacity: 0.8 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Save Service Ledger PDF to device"
                >
                  {activeExport === 'save_service' ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={[styles.primarySaveButtonText, { marginLeft: Spacing.xs }]}>
                        Saving...
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.primarySaveButtonText}>💾 Save to Device</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleShareServiceLedger}
                  disabled={activeExport !== null}
                  activeOpacity={0.8}
                  style={[
                    styles.secondaryShareButton,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                    activeExport === 'share_service' && { opacity: 0.8 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Share Service Ledger PDF"
                >
                  {activeExport === 'share_service' ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color={colors.text} />
                      <Text style={[styles.secondaryShareButtonText, { color: colors.text, marginLeft: Spacing.xs }]}>
                        Sharing...
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.secondaryShareButtonText, { color: colors.text }]}>📤 Share</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Card 2: Complete Vehicle Dossier (PDF) */}
            <View style={[styles.reportCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardTitleGroup}>
                  <Text style={styles.cardEmoji}>📋</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[Typography.body, { fontWeight: '700', color: colors.text }]}>
                      Complete Vehicle Dossier
                    </Text>
                    <View style={styles.badgeRow}>
                      <View style={[styles.badgePill, { backgroundColor: '#E0F2FE' }]}>
                        <Text style={[styles.badgeText, { color: '#0369A1' }]}>PDF</Text>
                      </View>
                      <View style={[styles.badgePill, { backgroundColor: '#DCFCE7' }]}>
                        <Text style={[styles.badgeText, { color: '#15803D' }]}>Executive Summary</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: Spacing.sm }]}>
                Comprehensive overview containing active compliance document validity (RC, Insurance, PUC), efficiency milestones, and lifetime cost distribution.
              </Text>

              {/* Dual Action Buttons: Save to Device + Share */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  onPress={handleSaveVehicleDossier}
                  disabled={activeExport !== null}
                  activeOpacity={0.8}
                  style={[
                    styles.primarySaveButton,
                    { backgroundColor: colors.primary },
                    activeExport === 'save_dossier' && { opacity: 0.8 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Save Vehicle Dossier PDF to device"
                >
                  {activeExport === 'save_dossier' ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={[styles.primarySaveButtonText, { marginLeft: Spacing.xs }]}>
                        Saving...
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.primarySaveButtonText}>💾 Save to Device</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleShareVehicleDossier}
                  disabled={activeExport !== null}
                  activeOpacity={0.8}
                  style={[
                    styles.secondaryShareButton,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                    activeExport === 'share_dossier' && { opacity: 0.8 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Share Vehicle Dossier PDF"
                >
                  {activeExport === 'share_dossier' ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color={colors.text} />
                      <Text style={[styles.secondaryShareButtonText, { color: colors.text, marginLeft: Spacing.xs }]}>
                        Sharing...
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.secondaryShareButtonText, { color: colors.text }]}>📤 Share</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Card 3: Fuel & Expense CSV */}
            <View style={[styles.reportCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardTitleGroup}>
                  <Text style={styles.cardEmoji}>📊</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[Typography.body, { fontWeight: '700', color: colors.text }]}>
                      Business & Tax Ledger
                    </Text>
                    <View style={styles.badgeRow}>
                      <View style={[styles.badgePill, { backgroundColor: '#F3E8FF' }]}>
                        <Text style={[styles.badgeText, { color: '#7E22CE' }]}>CSV</Text>
                      </View>
                      <View style={[styles.badgePill, { backgroundColor: '#FEE2E2' }]}>
                        <Text style={[styles.badgeText, { color: '#B91C1C' }]}>Excel / Sheets</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              <Text style={[Typography.caption, { color: colors.textSecondary, marginTop: Spacing.sm }]}>
                RFC 4180 spreadsheet with UTF-8 BOM. Directly formatted for company mileage claims, tax deductions, and accountant audits.
              </Text>

              {/* Dual Action Buttons: Save to Device + Share */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  onPress={handleSaveCsv}
                  disabled={activeExport !== null}
                  activeOpacity={0.8}
                  style={[
                    styles.primarySaveButton,
                    { backgroundColor: colors.primary },
                    activeExport === 'save_csv' && { opacity: 0.8 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Save Business Ledger CSV to device"
                >
                  {activeExport === 'save_csv' ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={[styles.primarySaveButtonText, { marginLeft: Spacing.xs }]}>
                        Saving...
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.primarySaveButtonText}>💾 Save to Device</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleShareCsv}
                  disabled={activeExport !== null}
                  activeOpacity={0.8}
                  style={[
                    styles.secondaryShareButton,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                    activeExport === 'share_csv' && { opacity: 0.8 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Share Business Ledger CSV"
                >
                  {activeExport === 'share_csv' ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color={colors.text} />
                      <Text style={[styles.secondaryShareButtonText, { color: colors.text, marginLeft: Spacing.xs }]}>
                        Sharing...
                      </Text>
                    </View>
                  ) : (
                    <Text style={[styles.secondaryShareButtonText, { color: colors.text }]}>📤 Share</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Security & Offline Footnote */}
            <View style={[styles.privacyBox, { backgroundColor: colors.borderLight }]}>
              <Text style={[styles.privacyText, { color: colors.textSecondary }]}>
                🔒 <Text style={{ fontWeight: '700' }}>100% Offline & Private:</Text> Reports are rendered on your device. No telemetry or vehicle financial logs leave your phone.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitleArea: {
    flex: 1,
  },
  vehicleSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
  },
  regPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  regPillText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  scrollContent: {
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  reportCard: {
    borderWidth: 1,
    borderRadius: Sizing.radiusMd,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  cardEmoji: {
    fontSize: 26,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  primarySaveButton: {
    flex: 1.25,
    paddingVertical: 12,
    borderRadius: Sizing.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primarySaveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  secondaryShareButton: {
    flex: 0.9,
    paddingVertical: 12,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryShareButtonText: {
    fontWeight: '700',
    fontSize: 13,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyBox: {
    padding: Spacing.md,
    borderRadius: Sizing.radiusSm,
    marginTop: Spacing.xs,
  },
  privacyText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
