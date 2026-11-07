/**
 * Add / Edit / Renew Document — Modal Form
 *
 * Adds vehicle documents: RC, Insurance, PUC, FASTag, Warranty, Fitness, etc.
 * Supports document number, insurer/provider name, issue/expiry dates with quick validity presets.
 * Photo and PDF attachment via expo-image-picker and expo-document-picker.
 *
 * RENEWAL MODE: If opened with ?renewFrom=<docId>&renewType=<type>,
 * creates a new document and supersedes the old one.
 *
 * Styled in the Refined Technical Automotive Cockpit design:
 * - Standardized FormHeader with single pinned bottom save action (no header duplicate)
 * - Vehicle context card showing active vehicle & current baseline
 * - Document type selector grid with icons
 * - Dynamic document number and provider inputs
 * - Issue & Expiry date inputs with "Set Today" and dynamic validity presets (+6m, +1y, +3y, +5y)
 * - Regulatory compliance notices (PUC ₹10k fine warning, FASTag KYC notice)
 * - High-contrast attachment preview drawer for Photos & PDFs
 * - Pinned 52dp Automotive Orange save button
 * - 100% offline
 */

import { FormHeader } from "@/components/FormHeader";
import { NoVehicleState } from "@/components/NoVehicleState";
import {
  DOCUMENT_TYPE_ICONS,
  DOCUMENT_TYPE_LABELS,
  DocumentType,
  getDocumentTypesForVehicle,
} from "@/constants/documentTypes";
import { VehicleType } from "@/constants/fuelTypes";
import { Sizing, Spacing, Typography } from "@/constants/theme";
import * as documentRepo from "@/database/repositories/documentRepo";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useDocumentStore } from "@/stores/documentStore";
import { useVehicleStore } from "@/stores/vehicleStore";
import {
  copyToPermanentStorage,
  isPdfAttachment,
  openAttachment,
} from "@/utils/attachmentStorage";
import { todayISO } from "@/utils/date";
import {
  displayToISO,
  formatDateInput,
  isoToDisplay,
  validateDateDisplay,
} from "@/utils/dateInput";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AddDocumentScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id?: string;
    renewFrom?: string;
    renewType?: string;
    vehicleId?: string;
  }>();

  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);
  const selectVehicle = useVehicleStore((s) => s.selectVehicle);
  const addDocument = useDocumentStore((s) => s.addDocument);
  const editDocument = useDocumentStore((s) => s.editDocument);
  const renewDocument = useDocumentStore((s) => s.renewDocument);

  useEffect(() => {
    if (params.vehicleId && params.vehicleId !== selectedVehicle?.id) {
      selectVehicle(params.vehicleId);
    }
  }, [params.vehicleId]);

  const availableDocTypes = useMemo(() => {
    return getDocumentTypesForVehicle(selectedVehicle?.fuel_type);
  }, [selectedVehicle?.fuel_type]);

  const isEditMode = !!params.id;
  const isRenewMode = !!params.renewFrom;

  const [docType, setDocType] = useState<DocumentType | "">("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [insurerName, setInsurerName] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Load existing document for edit mode
  useEffect(() => {
    if (isEditMode && params.id) {
      const existing = documentRepo.getDocumentById(params.id);
      if (existing) {
        setDocType(existing.type as DocumentType);
        setDocumentNumber(existing.document_number || "");
        setInsurerName(existing.insurer_name || "");
        setNotes(existing.notes || "");
        setPhotoUri(existing.file_uri || null);
        if (existing.issue_date) {
          setIssueDate(isoToDisplay(existing.issue_date));
        }
        if (existing.expiry_date) {
          setExpiryDate(isoToDisplay(existing.expiry_date));
        }
      }
    }
  }, [params.id]);

  // Pre-fill type for renewal mode
  useEffect(() => {
    if (isRenewMode && params.renewType) {
      setDocType(params.renewType as DocumentType);
    }
  }, [params.renewType]);

  if (!selectedVehicle) {
    return <NoVehicleState />;
  }

  const isTwoWheeler = selectedVehicle.vehicle_type === VehicleType.TWO_WHEELER;

  const handleIssueDateChange = (text: string) => {
    const formatted = formatDateInput(text, issueDate);
    setIssueDate(formatted);
    setError("");
  };

  const handleExpiryDateChange = (text: string) => {
    const formatted = formatDateInput(text, expiryDate);
    setExpiryDate(formatted);
    setError("");
  };

  const handleSetIssueToday = () => {
    setIssueDate(isoToDisplay(todayISO()));
    setError("");
  };

  const handleSetIssueYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setIssueDate(isoToDisplay(yesterday.toISOString().split("T")[0]));
    setError("");
  };

  const applyPresetMonths = (months: number) => {
    let year = new Date().getFullYear();
    let month = new Date().getMonth();
    let day = new Date().getDate();

    if (issueDate.trim()) {
      const issueVal = validateDateDisplay(issueDate, "Issue date");
      if (issueVal.isValid) {
        const parts = issueDate.trim().split("/");
        day = parseInt(parts[0], 10);
        month = parseInt(parts[1], 10) - 1;
        year = parseInt(parts[2], 10);
      }
    }
    const target = new Date(year, month + months, day);
    const y = target.getFullYear();
    const m = String(target.getMonth() + 1).padStart(2, "0");
    const d = String(target.getDate()).padStart(2, "0");
    setExpiryDate(`${d}/${m}/${y}`);
    setError("");
  };

  const handleDocTypeChange = (dt: DocumentType) => {
    setDocType(dt);
    setError("");
    if (dt === DocumentType.PUC && !expiryDate) {
      const currentYear = new Date().getFullYear();
      const isNewCar =
        selectedVehicle?.year && selectedVehicle.year >= currentYear - 1;
      applyPresetMonths(isNewCar ? 12 : 6);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Needed",
        "Photo library access is needed to attach your document.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      const permanentUri = await copyToPermanentStorage(
        result.assets[0].uri,
        false,
      );
      setPhotoUri(permanentUri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Needed",
        "Camera access is needed to photograph your document.",
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      const permanentUri = await copyToPermanentStorage(
        result.assets[0].uri,
        false,
      );
      setPhotoUri(permanentUri);
    }
  };

  const pickPDF = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: false,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const permanentUri = await copyToPermanentStorage(
          result.assets[0].uri,
          true,
        );
        setPhotoUri(permanentUri);
      }
    } catch (e) {
      Alert.alert(
        "Could Not Attach PDF",
        e instanceof Error ? e.message : "Unknown error",
      );
    }
  };

  const handlePickPhoto = () => {
    Alert.alert("Attach Document 📂", "Select source:", [
      { text: "📷 Camera", onPress: takePhoto },
      { text: "🖼️ Gallery (Image)", onPress: pickImage },
      { text: "📄 Upload PDF", onPress: pickPDF },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleViewAttachment = async () => {
    if (!photoUri) return;
    if (isPdfAttachment(photoUri)) {
      const res = await openAttachment(
        photoUri,
        `${DOCUMENT_TYPE_LABELS[docType as DocumentType] || "Document"}`,
      );
      if (!res.success && res.message) {
        Alert.alert("View Document", res.message);
      }
    } else {
      setViewerUri(photoUri);
    }
  };

  const handleSave = () => {
    if (!docType) {
      setError("Please select a document type.");
      Alert.alert(
        "Document Type Required",
        "Please select a document type from the grid above.",
      );
      return;
    }

    let parsedIssue: string | undefined = undefined;
    if (issueDate.trim()) {
      const issueVal = validateDateDisplay(issueDate, "Issue date");
      if (!issueVal.isValid) {
        const err =
          issueVal.error || "Enter a valid issue date in DD/MM/YYYY format.";
        setError(err);
        Alert.alert("Invalid Issue Date", err);
        return;
      }
      parsedIssue = displayToISO(issueDate) ?? undefined;
    }

    let parsedExpiry: string | undefined = undefined;
    if (expiryDate.trim()) {
      const expiryVal = validateDateDisplay(expiryDate, "Expiry date");
      if (!expiryVal.isValid) {
        const err =
          expiryVal.error || "Enter a valid expiry date in DD/MM/YYYY format.";
        setError(err);
        Alert.alert("Invalid Expiry Date", err);
        return;
      }
      parsedExpiry = displayToISO(expiryDate) ?? undefined;
    }

    if (parsedIssue && parsedExpiry && parsedExpiry < parsedIssue) {
      const err = "Expiry date cannot be earlier than issue date.";
      setError(err);
      Alert.alert("Invalid Date Range", err);
      return;
    }

    setError("");

    if (isRenewMode && params.renewFrom) {
      renewDocument(params.renewFrom, {
        vehicle_id: selectedVehicle.id,
        type: docType,
        document_number: documentNumber.trim() || undefined,
        insurer_name: insurerName.trim() || undefined,
        issue_date: parsedIssue,
        expiry_date: parsedExpiry,
        notes: notes.trim() || undefined,
        file_uri: photoUri || undefined,
      });
      router.back();
    } else if (isEditMode && params.id) {
      editDocument(params.id, {
        type: docType,
        document_number: documentNumber.trim() || null,
        insurer_name: insurerName.trim() || null,
        issue_date: parsedIssue || null,
        expiry_date: parsedExpiry || null,
        notes: notes.trim() || null,
        file_uri: photoUri || null,
      });
      router.back();
    } else {
      addDocument({
        vehicle_id: selectedVehicle.id,
        type: docType,
        document_number: documentNumber.trim() || undefined,
        insurer_name: insurerName.trim() || undefined,
        issue_date: parsedIssue,
        expiry_date: parsedExpiry,
        notes: notes.trim() || undefined,
        file_uri: photoUri || undefined,
      });
      router.back();
    }
  };

  const headerTitle = isRenewMode
    ? `Renew ${DOCUMENT_TYPE_LABELS[docType as DocumentType] || "Document"}`
    : isEditMode
      ? "Edit Document"
      : "Add Document";

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "android" ? "height" : "padding"}
    >
      {/* ── FormHeader (No duplicate save button in header) ── */}
      <FormHeader title={headerTitle} subtitle={selectedVehicle.nickname} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Vehicle Context Card ── */}
        <View
          style={[
            styles.vehicleContextCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View
            style={[
              styles.vehicleIconWrap,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.borderLight,
              },
            ]}
          >
            <Text style={{ fontSize: 18 }}>{isTwoWheeler ? "🏍️" : "🚗"}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <View style={styles.vehicleNameRow}>
              <Text style={[styles.vehicleNickname, { color: colors.text }]}>
                {selectedVehicle.nickname}
              </Text>
              {selectedVehicle.registration_number ? (
                <View
                  style={[
                    styles.regBadge,
                    {
                      backgroundColor: colors.surfaceSecondary,
                      borderColor: colors.borderLight,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.regBadgeText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {selectedVehicle.registration_number}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text
              style={[styles.vehicleSubtext, { color: colors.textSecondary }]}
            >
              Current Odometer:{" "}
              {selectedVehicle.current_odometer !== null &&
              selectedVehicle.current_odometer !== undefined
                ? `${selectedVehicle.current_odometer.toLocaleString("en-IN")} km`
                : "Not set"}
            </Text>
          </View>
        </View>

        {/* ── Renewal Informational Banner ── */}
        {isRenewMode && (
          <View
            style={[
              styles.renewBanner,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.primary,
              },
            ]}
          >
            <Text style={[styles.renewBannerTitle, { color: colors.primary }]}>
              🔄 Document Renewal Mode
            </Text>
            <Text
              style={[styles.renewBannerText, { color: colors.textSecondary }]}
            >
              Saving will link this fresh record as active and archive the
              previous document into historical superseded records.
            </Text>
          </View>
        )}

        {/* ── Document Type Selector Grid ── */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          DOCUMENT TYPE *
        </Text>
        <View style={styles.chipGrid}>
          {availableDocTypes.map((dt) => {
            const isSelected = docType === dt;
            return (
              <TouchableOpacity
                key={dt}
                onPress={() => handleDocTypeChange(dt)}
                style={[
                  styles.docTypeChip,
                  {
                    backgroundColor: isSelected
                      ? colors.surfaceSecondary
                      : colors.surface,
                    borderColor: isSelected
                      ? colors.primary
                      : colors.borderLight,
                    borderWidth: isSelected ? 1.5 : 1,
                  },
                ]}
                activeOpacity={0.7}
              >
                <Text style={styles.chipEmoji}>
                  {DOCUMENT_TYPE_ICONS[dt] || "📄"}
                </Text>
                <Text
                  style={[
                    styles.docTypeChipText,
                    {
                      color: isSelected ? colors.primary : colors.text,
                      fontWeight: isSelected ? "800" : "600",
                    },
                  ]}
                >
                  {DOCUMENT_TYPE_LABELS[dt]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Document Identifier / Number ── */}
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.textSecondary, marginTop: Spacing.sm },
          ]}
        >
          {docType === DocumentType.FASTAG
            ? "FASTAG WALLET / BARCODE ID"
            : docType === DocumentType.PUC
              ? "PUC CERTIFICATE NUMBER"
              : docType === DocumentType.INSURANCE
                ? "POLICY NUMBER"
                : docType === DocumentType.RC
                  ? "REGISTRATION / RC NUMBER"
                  : "DOCUMENT IDENTIFIER / NUMBER"}
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          placeholder={
            docType === DocumentType.FASTAG
              ? "e.g. 34161FA890209..."
              : docType === DocumentType.PUC
                ? "e.g. MH12-PUC-2026-0982"
                : docType === DocumentType.INSURANCE
                  ? "e.g. POL-123456789"
                  : docType === DocumentType.RC
                    ? "e.g. MH 12 AB 1234"
                    : "e.g. DOC-987654321"
          }
          placeholderTextColor={colors.textTertiary}
          value={documentNumber}
          onChangeText={setDocumentNumber}
          autoCapitalize="characters"
        />

        {/* ── Insurer / Provider (Insurance, FASTag, Warranty, Battery Warranty) ── */}
        {(docType === DocumentType.INSURANCE ||
          docType === DocumentType.FASTAG ||
          docType === DocumentType.WARRANTY ||
          docType === DocumentType.BATTERY_WARRANTY) && (
          <>
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.textSecondary, marginTop: Spacing.md },
              ]}
            >
              {docType === DocumentType.FASTAG
                ? "ISSUING BANK / WALLET PROVIDER"
                : docType === DocumentType.INSURANCE
                  ? "INSURANCE COMPANY / PROVIDER"
                  : "WARRANTY ISSUER / DEALERSHIP"}
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder={
                docType === DocumentType.FASTAG
                  ? "e.g. ICICI Bank, Paytm, IDFC FIRST, SBI"
                  : docType === DocumentType.INSURANCE
                    ? "e.g. ICICI Lombard, HDFC ERGO, Bajaj Allianz, Digit"
                    : "e.g. OEM Authorized, GoMechanic, Tata Motors, Maruti"
              }
              placeholderTextColor={colors.textTertiary}
              value={insurerName}
              onChangeText={setInsurerName}
            />
          </>
        )}

        {/* ── Dates Row: Issue & Expiry ── */}
        <View style={styles.dateBlock}>
          {/* Issue Date */}
          <View style={styles.dateHeaderRow}>
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.textSecondary, marginBottom: 0 },
              ]}
            >
              ISSUE DATE (DD/MM/YYYY)
            </Text>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <TouchableOpacity
                style={[
                  styles.dateShortcutChip,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.borderLight,
                  },
                ]}
                onPress={handleSetIssueToday}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.dateShortcutText, { color: colors.primary }]}
                >
                  📅 Today
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.dateShortcutChip,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.borderLight,
                  },
                ]}
                onPress={handleSetIssueYesterday}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dateShortcutText,
                    { color: colors.textSecondary },
                  ]}
                >
                  Yesterday
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                color: colors.text,
                borderColor: colors.border,
                fontVariant: ["tabular-nums"],
              },
            ]}
            placeholder="DD/MM/YYYY"
            placeholderTextColor={colors.textTertiary}
            value={issueDate}
            onChangeText={handleIssueDateChange}
            keyboardType="number-pad"
            maxLength={10}
          />

          {/* Expiry Date */}
          <View style={[styles.dateHeaderRow, { marginTop: Spacing.md }]}>
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.textSecondary, marginBottom: 0 },
              ]}
            >
              EXPIRY DATE (DD/MM/YYYY)
            </Text>
            {expiryDate ? (
              <TouchableOpacity
                style={[
                  styles.dateShortcutChip,
                  {
                    backgroundColor: colors.dangerLight,
                    borderColor: colors.danger + "30",
                  },
                ]}
                onPress={() => setExpiryDate("")}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.dateShortcutText, { color: colors.danger }]}
                >
                  ✕ Clear
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Validity Preset Chips */}
          <View style={styles.presetChipsRow}>
            {(docType === DocumentType.PUC
              ? [6, 12]
              : docType === DocumentType.INSURANCE
                ? [12, 36, 60]
                : docType === DocumentType.RC
                  ? [12, 60, 180]
                  : docType === DocumentType.CNG_CERTIFICATE
                    ? [12, 36]
                    : docType === DocumentType.BATTERY_WARRANTY
                      ? [36, 60, 96]
                      : docType === DocumentType.WARRANTY
                        ? [12, 24, 36, 60]
                        : docType === DocumentType.FITNESS
                          ? [12, 24, 60]
                          : [6, 12, 36, 60]
            ).map((m) => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.presetChip,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.borderLight,
                  },
                ]}
                onPress={() => applyPresetMonths(m)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.presetChipText, { color: colors.primary }]}
                >
                  +{m >= 12 ? `${m / 12}y` : `${m}m`} (
                  {m >= 12
                    ? `${m / 12} Year${m > 12 ? "s" : ""}`
                    : `${m} Months`}
                  )
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                color: colors.text,
                borderColor: colors.border,
                fontVariant: ["tabular-nums"],
              },
            ]}
            placeholder="DD/MM/YYYY"
            placeholderTextColor={colors.textTertiary}
            value={expiryDate}
            onChangeText={handleExpiryDateChange}
            keyboardType="number-pad"
            maxLength={10}
          />
        </View>

        {/* ── Regulatory / Compliance Notice Cards ── */}
        {docType === DocumentType.PUC ? (
          <View
            style={[
              styles.noticeCard,
              {
                backgroundColor: colors.statusCriticalBg,
                borderColor: colors.statusCritical,
              },
            ]}
          >
            <Text
              style={[styles.noticeTitle, { color: colors.statusCritical }]}
            >
              🚨 Mandatory PUC Compliance (₹10,000 Fine)
            </Text>
            <Text style={[styles.noticeText, { color: colors.text }]}>
              Under Section 190(2) of the Motor Vehicles Act, driving with an
              expired PUC carries a ₹10,000 fine and possible 3-month licence
              disqualification. Keep this renewed!
            </Text>
          </View>
        ) : docType === DocumentType.FASTAG ? (
          <View
            style={[
              styles.noticeCard,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.primary,
              },
            ]}
          >
            <Text style={[styles.noticeTitle, { color: colors.primary }]}>
              💳 FASTag KYC & Wallet Status
            </Text>
            <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
              Ensure your tag wallet maintains positive balance and complete
              KYC. Toll booths charge double user fee in cash for blacklisted or
              inactive tags.
            </Text>
          </View>
        ) : docType === DocumentType.CNG_CERTIFICATE ? (
          <View
            style={[
              styles.noticeCard,
              {
                backgroundColor: colors.statusWarningBg,
                borderColor: colors.statusWarning,
              },
            ]}
          >
            <Text style={[styles.noticeTitle, { color: colors.statusWarning }]}>
              ⛽ CNG Cylinder Hydro-Testing (Every 3 Years)
            </Text>
            <Text style={[styles.noticeText, { color: colors.text }]}>
              Under Central Motor Vehicles Rules, CNG cylinders must undergo
              hydrostatic pressure testing every 3 years. Fuel stations inspect
              this certificate before CNG dispensing.
            </Text>
          </View>
        ) : null}

        {/* ── Document Photo or PDF Attachment ── */}
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.textSecondary, marginTop: Spacing.md },
          ]}
        >
          DOCUMENT PHOTO OR PDF ATTACHMENT 📂
        </Text>

        {photoUri ? (
          <View
            style={[
              styles.attachmentContainer,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderLight,
              },
            ]}
          >
            {isPdfAttachment(photoUri) ? (
              <TouchableOpacity
                style={styles.attachmentPreviewRow}
                onPress={handleViewAttachment}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.pdfIconWrap,
                    {
                      backgroundColor: colors.surfaceSecondary,
                      borderColor: colors.borderLight,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 26 }}>📄</Text>
                </View>
                <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <Text
                    style={[styles.attachmentTitle, { color: colors.text }]}
                  >
                    PDF Document File
                  </Text>
                  <Text
                    style={[
                      styles.attachmentSubtitle,
                      { color: colors.textTertiary },
                    ]}
                    numberOfLines={1}
                  >
                    {photoUri.split("/").pop()} (tap to view)
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.attachmentPreviewRow}
                onPress={handleViewAttachment}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: photoUri }}
                  style={styles.imageThumbnail}
                  resizeMode="cover"
                />
                <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <Text
                    style={[styles.attachmentTitle, { color: colors.text }]}
                  >
                    Document Scan Photo
                  </Text>
                  <Text
                    style={[
                      styles.attachmentSubtitle,
                      { color: colors.textTertiary },
                    ]}
                    numberOfLines={1}
                  >
                    {photoUri.split("/").pop()} (tap to preview)
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            <View
              style={[
                styles.attachmentActions,
                { borderTopColor: colors.borderLight },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.attachActionBtn,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.borderLight,
                  },
                ]}
                onPress={handleViewAttachment}
                activeOpacity={0.8}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {isPdfAttachment(photoUri) ? "View PDF 📄" : "View Image 👁️"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.attachActionBtn,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.borderLight,
                  },
                ]}
                onPress={handlePickPhoto}
                activeOpacity={0.8}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  Change
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.attachActionBtn,
                  {
                    backgroundColor: colors.dangerLight,
                    borderColor: colors.danger + "30",
                  },
                ]}
                onPress={() => setPhotoUri(null)}
                activeOpacity={0.8}
              >
                <Text
                  style={{
                    color: colors.danger,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  Remove
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.attachPlaceholder,
              {
                borderColor: colors.borderLight,
                backgroundColor: colors.surface,
              },
            ]}
            onPress={handlePickPhoto}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 26 }}>📷</Text>
            <Text
              style={[
                Typography.bodySmall,
                {
                  color: colors.primary,
                  fontWeight: "700",
                  marginTop: Spacing.xs,
                },
              ]}
            >
              Take Photo, Pick Image, or Upload PDF
            </Text>
            <Text
              style={[
                Typography.caption,
                { color: colors.textTertiary, marginTop: 2 },
              ]}
            >
              Carry a digital copy safely on your device — never worry about
              physical papers!
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Notes ── */}
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.textSecondary, marginTop: Spacing.md },
          ]}
        >
          NOTES (OPTIONAL)
        </Text>
        <TextInput
          style={[
            styles.textArea,
            {
              backgroundColor: colors.surface,
              color: colors.text,
              borderColor: colors.border,
            },
          ]}
          placeholder="Any notes (e.g., zero depreciation add-on, cashless garage network, RSA details)..."
          placeholderTextColor={colors.textTertiary}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />

        {error ? (
          <View
            style={[
              styles.errorBox,
              {
                backgroundColor: colors.dangerLight,
                borderColor: colors.danger,
              },
            ]}
          >
            <Text style={[styles.errorText, { color: colors.danger }]}>
              ⚠️ {error}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      {/* ── Pinned Bottom Bar ── */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.borderLight,
            paddingBottom: Math.max(insets.bottom, Spacing.sm),
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: "#3983C7" }]}
          onPress={handleSave}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={
            isRenewMode
              ? "Save Renewed Document"
              : isEditMode
                ? "Update Document"
                : "Save Document"
          }
        >
          <Text
            style={[
              Typography.button,
              { color: "#FFFFFF", fontWeight: "800", fontSize: 16 },
            ]}
          >
            {isRenewMode
              ? "Save Renewed Document 🔄"
              : isEditMode
                ? "Update Document ✏️"
                : "Save Document 📄"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Fullscreen Image Preview Modal ── */}
      <Modal
        visible={!!viewerUri}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUri(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={() => setViewerUri(null)}
            activeOpacity={0.8}
          >
            <Text style={styles.modalCloseText}>✕ Close</Text>
          </TouchableOpacity>
          {viewerUri && (
            <Image
              source={{ uri: viewerUri }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  vehicleContextCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: Sizing.radiusLg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  vehicleIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  vehicleNickname: {
    fontSize: 16,
    fontWeight: "800",
  },
  regBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  regBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  vehicleSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  renewBanner: {
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  renewBannerTitle: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 2,
  },
  renewBannerText: {
    fontSize: 12,
    lineHeight: 17,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  docTypeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
  },
  chipEmoji: {
    fontSize: 15,
  },
  docTypeChipText: {
    fontSize: 12,
  },
  input: {
    height: 48,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
  },
  dateBlock: {
    marginTop: Spacing.sm,
  },
  dateHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  dateShortcutChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
  },
  dateShortcutText: {
    fontSize: 11,
    fontWeight: "700",
  },
  presetChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: Spacing.xs,
  },
  presetChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  noticeCard: {
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  noticeTitle: {
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 3,
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 17,
  },
  attachmentContainer: {
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  attachmentPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  imageThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  pdfIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  attachmentSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  attachmentActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
  },
  attachActionBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  attachPlaceholder: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: Sizing.radiusMd,
    padding: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  textArea: {
    minHeight: 76,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
    textAlignVertical: "top",
  },
  errorBox: {
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  saveButton: {
    height: 52,
    borderRadius: Sizing.radiusLg,
    alignItems: "center",
    justifyContent: "center",
    ...Sizing.cardShadow,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalClose: {
    position: "absolute",
    top: 56,
    right: 24,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
  },
  modalCloseText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  modalImage: {
    width: "95%",
    height: "80%",
    borderRadius: 12,
  },
});
