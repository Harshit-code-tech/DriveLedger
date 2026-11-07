/**
 * Add / Edit Expense — Modal Form
 *
 * Logs non-fuel vehicle running costs: tolls, parking, fastag, insurance, repairs, etc.
 * Uses predefined expense categories for one-tap selection.
 *
 * Styled in the Refined Technical Automotive Cockpit design:
 * - Standardized FormHeader with circular back button and quick save action
 * - Vehicle context card showing active vehicle & current baseline
 * - Hero amount meter with quick preset chips (₹50, ₹100, ₹200, ₹500, ₹1k, ₹2k)
 * - Category chips with category icons
 * - DD/MM/YYYY date input with auto-formatting & "Set Today" shortcut
 * - Full receipt/invoice attachment linking (Camera, Gallery, PDF) with preview drawer
 * - Pinned 52dp Automotive Orange save button
 * - 100% offline
 */

import { CategoryIcon } from "@/components/CategoryIcon";
import { FormHeader } from "@/components/FormHeader";
import { NoVehicleState } from "@/components/NoVehicleState";
import { EXPENSE_CATEGORIES } from "@/constants/expenseCategories";
import { VehicleType } from "@/constants/fuelTypes";
import { Sizing, Spacing, Typography } from "@/constants/theme";
import * as expenseRepo from "@/database/repositories/expenseRepo";
import { validateExpense } from "@/engine/validationEngine";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useExpenseStore } from "@/stores/expenseStore";
import { getCurrencySymbol } from "@/stores/preferencesStore";
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
import { useEffect, useState } from "react";
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

const COMMON_AMOUNT_PRESETS = [50, 100, 200, 500, 1000, 2000];

export default function AddExpenseScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; vehicleId?: string }>();
  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);
  const selectVehicle = useVehicleStore((s) => s.selectVehicle);
  const addExpense = useExpenseStore((s) => s.addExpense);
  const editExpense = useExpenseStore((s) => s.editExpense);

  useEffect(() => {
    if (params.vehicleId && params.vehicleId !== selectedVehicle?.id) {
      selectVehicle(params.vehicleId);
    }
  }, [params.vehicleId]);

  const isEditMode = !!params.id;
  const currencySymbol = getCurrencySymbol();

  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dateDisplay, setDateDisplay] = useState("");
  const [date, setDate] = useState(todayISO());
  const [receiptPhotoUri, setReceiptPhotoUri] = useState<string | null>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Initialize date display
  useEffect(() => {
    setDateDisplay(isoToDisplay(date));
  }, []);

  // Load existing expense for edit mode
  useEffect(() => {
    if (isEditMode && params.id) {
      const existing = expenseRepo.getExpenseById(params.id);
      if (existing) {
        setCategory(existing.category);
        setAmount(existing.amount.toString());
        setDescription(existing.description || "");
        setDate(existing.date);
        setDateDisplay(isoToDisplay(existing.date));
        setReceiptPhotoUri(existing.receipt_photo_uri || null);
      }
    }
  }, [params.id]);

  if (!selectedVehicle) {
    return <NoVehicleState />;
  }

  const isTwoWheeler = selectedVehicle.vehicle_type === VehicleType.TWO_WHEELER;

  const handleDateChange = (text: string) => {
    const formatted = formatDateInput(text, dateDisplay);
    setDateDisplay(formatted);
    const parsed = displayToISO(formatted);
    if (parsed) {
      setDate(parsed);
    }
  };

  const handleSetToday = () => {
    const today = todayISO();
    setDate(today);
    setDateDisplay(isoToDisplay(today));
  };

  const handleSetYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yestISO = d.toISOString().split("T")[0];
    setDate(yestISO);
    setDateDisplay(isoToDisplay(yestISO));
  };

  const handleQuickAmountSelect = (val: number) => {
    setAmount(String(val));
    setError("");
  };

  const handleQuickAmountAdd = (delta: number) => {
    const current = parseFloat(amount) || 0;
    setAmount(String(Math.round(current + delta)));
    setError("");
  };

  // Attachment Handlers
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Camera Permission",
        "Camera access is required to photograph your receipt.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets && result.assets[0]) {
      const savedUri = await copyToPermanentStorage(result.assets[0].uri);
      setReceiptPhotoUri(savedUri);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Gallery Permission",
        "Gallery access is required to attach your receipt.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets[0]) {
      const savedUri = await copyToPermanentStorage(result.assets[0].uri);
      setReceiptPhotoUri(savedUri);
    }
  };

  const pickPDF = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: false,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const savedUri = await copyToPermanentStorage(
          result.assets[0].uri,
          result.assets[0].name,
        );
        setReceiptPhotoUri(savedUri);
      }
    } catch (e) {
      Alert.alert(
        "Attachment Error",
        e instanceof Error ? e.message : "Could not attach PDF.",
      );
    }
  };

  const handlePickReceipt = () => {
    Alert.alert("Attach Receipt or Bill 🧾", "Select file source:", [
      { text: "📷 Camera", onPress: takePhoto },
      { text: "🖼️ Gallery", onPress: pickImage },
      { text: "📄 PDF Bill", onPress: pickPDF },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleViewReceipt = async () => {
    if (!receiptPhotoUri) return;
    if (isPdfAttachment(receiptPhotoUri)) {
      const res = await openAttachment(
        receiptPhotoUri,
        "Expense Receipt / Bill",
      );
      if (!res.success && res.message) {
        Alert.alert("View Document", res.message);
      }
    } else {
      setViewerUri(receiptPhotoUri);
    }
  };

  const handleSave = () => {
    if (!category) {
      setError("Please select an expense category.");
      return;
    }
    const amountVal = parseFloat(amount);
    if (!amount || isNaN(amountVal) || amountVal <= 0) {
      setError("Please enter a valid amount greater than 0.");
      return;
    }

    const dateVal = validateDateDisplay(dateDisplay);
    if (!dateVal.isValid) {
      setError(dateVal.error || "Enter a valid date in DD/MM/YYYY format.");
      return;
    }

    const isoDate = displayToISO(dateDisplay);
    if (!isoDate) {
      setError("Enter a valid date in DD/MM/YYYY format.");
      return;
    }

    const validation = validateExpense({ amount: amountVal, date: isoDate });
    if (!validation.isValid) {
      setError(validation.issues[0].message);
      return;
    }

    setError("");

    if (isEditMode && params.id) {
      editExpense(params.id, {
        category,
        amount: amountVal,
        date: isoDate,
        description: description.trim() || null,
        receipt_photo_uri: receiptPhotoUri || null,
      });
      router.back();
    } else {
      addExpense({
        vehicle_id: selectedVehicle.id,
        date: isoDate,
        category,
        amount: amountVal,
        description: description.trim() || undefined,
        receipt_photo_uri: receiptPhotoUri || undefined,
      });
      router.back();
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "android" ? "height" : "padding"}
    >
      {/* ── FormHeader ── */}
      <FormHeader
        title={isEditMode ? "Edit Running Cost" : "Track Running Cost"}
        subtitle={selectedVehicle.nickname}
      />

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

        {/* ── Hero Amount Card ── */}
        <View
          style={[
            styles.heroAmountCard,
            {
              backgroundColor: colors.surface,
              borderColor: amount ? colors.primary : colors.border,
              ...Sizing.cardShadow,
            },
          ]}
        >
          <Text style={[styles.heroCardLabel, { color: colors.textSecondary }]}>
            TOTAL EXPENSE AMOUNT *
          </Text>

          <View style={styles.heroAmountRow}>
            <Text style={[styles.currencySymbol, { color: colors.primary }]}>
              {currencySymbol}
            </Text>
            <TextInput
              style={[
                styles.heroAmountInput,
                { color: colors.text, fontVariant: ["tabular-nums"] },
              ]}
              placeholder="0.00"
              placeholderTextColor={colors.textTertiary}
              value={amount}
              onChangeText={(text) => {
                setAmount(text);
                setError("");
              }}
              keyboardType="decimal-pad"
              autoFocus={!isEditMode}
            />
          </View>

          {/* Quick Preset Amount Chips */}
          <View style={styles.quickAmountRow}>
            {COMMON_AMOUNT_PRESETS.map((val) => (
              <TouchableOpacity
                key={val}
                style={[
                  styles.quickAmountChip,
                  {
                    backgroundColor:
                      amount === String(val)
                        ? colors.surfaceSecondary
                        : colors.background,
                    borderColor:
                      amount === String(val)
                        ? colors.primary
                        : colors.borderLight,
                  },
                ]}
                onPress={() => handleQuickAmountSelect(val)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.quickAmountText,
                    {
                      color:
                        amount === String(val)
                          ? colors.primary
                          : colors.textSecondary,
                      fontWeight: amount === String(val) ? "800" : "600",
                    },
                  ]}
                >
                  {currencySymbol}
                  {val}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[
                styles.quickAmountChip,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.borderLight,
                },
              ]}
              onPress={() => handleQuickAmountAdd(500)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.quickAmountText,
                  { color: colors.primary, fontWeight: "700" },
                ]}
              >
                +{currencySymbol}500
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Category Selection ── */}
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          EXPENSE CATEGORY *
        </Text>
        <View style={styles.chipGrid}>
          {EXPENSE_CATEGORIES.map((cat) => {
            const isSelected = category === cat.name;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => {
                  setCategory(cat.name);
                  setError("");
                }}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: isSelected
                      ? colors.surfaceSecondary
                      : colors.surface,
                    borderColor: isSelected
                      ? colors.primary
                      : colors.borderLight,
                  },
                ]}
                activeOpacity={0.7}
              >
                <CategoryIcon icon={cat.icon} size={18} />
                <Text
                  style={[
                    styles.categoryChipText,
                    {
                      color: isSelected ? colors.primary : colors.text,
                      fontWeight: isSelected ? "800" : "600",
                    },
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Date Input with Quick Shortcuts ── */}
        <View style={styles.dateSectionHeader}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.textSecondary, marginBottom: 0 },
            ]}
          >
            DATE (DD/MM/YYYY) *
          </Text>
          <View style={styles.dateShortcutsRow}>
            <TouchableOpacity
              style={[
                styles.dateShortcutChip,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.borderLight,
                },
              ]}
              onPress={handleSetToday}
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
              onPress={handleSetYesterday}
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
          value={dateDisplay}
          onChangeText={handleDateChange}
          keyboardType="number-pad"
          maxLength={10}
        />

        {/* ── Description / Details ── */}
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.textSecondary, marginTop: Spacing.md },
          ]}
        >
          DESCRIPTION (OPTIONAL)
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
          placeholder="What was this cost for? (e.g., Expressway toll, Monthly parking, Ceramic wash)"
          placeholderTextColor={colors.textTertiary}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />

        {/* ── Receipt / Bill Attachment ── */}
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.textSecondary, marginTop: Spacing.md },
          ]}
        >
          RECEIPT OR BILL ATTACHMENT 🧾
        </Text>

        {receiptPhotoUri ? (
          <View
            style={[
              styles.attachmentContainer,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderLight,
              },
            ]}
          >
            {isPdfAttachment(receiptPhotoUri) ? (
              <TouchableOpacity
                style={styles.attachmentPreviewRow}
                onPress={handleViewReceipt}
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
                    PDF Bill / Invoice
                  </Text>
                  <Text
                    style={[
                      styles.attachmentSubtitle,
                      { color: colors.textTertiary },
                    ]}
                    numberOfLines={1}
                  >
                    {receiptPhotoUri.split("/").pop()} (tap to view)
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.attachmentPreviewRow}
                onPress={handleViewReceipt}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: receiptPhotoUri }}
                  style={styles.imageThumbnail}
                  resizeMode="cover"
                />
                <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <Text
                    style={[styles.attachmentTitle, { color: colors.text }]}
                  >
                    Receipt Photo
                  </Text>
                  <Text
                    style={[
                      styles.attachmentSubtitle,
                      { color: colors.textTertiary },
                    ]}
                    numberOfLines={1}
                  >
                    {receiptPhotoUri.split("/").pop()} (tap to view)
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
                onPress={handleViewReceipt}
                activeOpacity={0.8}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  {isPdfAttachment(receiptPhotoUri)
                    ? "View PDF 📄"
                    : "View Image 👁️"}
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
                onPress={handlePickReceipt}
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
                onPress={() => setReceiptPhotoUri(null)}
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
            onPress={handlePickReceipt}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 26 }}>📎</Text>
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
              Attach Bill / Receipt (Camera, Gallery, or PDF)
            </Text>
            <Text
              style={[
                Typography.caption,
                { color: colors.textTertiary, marginTop: 2 },
              ]}
            >
              Saved locally on-device and bundled in encrypted backups
            </Text>
          </TouchableOpacity>
        )}

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
            isEditMode ? "Update Running Cost" : "Save Running Cost"
          }
        >
          <Text
            style={[
              Typography.button,
              { color: "#FFFFFF", fontWeight: "800", fontSize: 16 },
            ]}
          >
            {isEditMode ? "Update Running Cost ✏️" : "Save Running Cost 💰"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Fullscreen Receipt Viewer Modal ── */}
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
  heroAmountCard: {
    padding: Spacing.lg,
    borderRadius: Sizing.radiusLg,
    borderWidth: 1.5,
    marginBottom: Spacing.md,
  },
  heroCardLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  heroAmountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: "900",
  },
  heroAmountInput: {
    flex: 1,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: -0.5,
    paddingVertical: 4,
  },
  quickAmountRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  quickAmountChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
  },
  quickAmountText: {
    fontSize: 12,
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
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 12,
  },
  dateSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  dateShortcutsRow: {
    flexDirection: "row",
    gap: 6,
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
  input: {
    height: 48,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
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
