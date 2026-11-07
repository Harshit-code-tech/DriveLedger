/**
 * Add / Edit Service Record — Modal Form
 *
 * Logs vehicle servicing events: oil change, periodic inspection, tyre rotation, etc.
 * Uses predefined service templates for one-tap selection.
 *
 * P1 EXTENSIONS:
 * - Parts-level maintenance tracking: tracks replaced/serviced components
 *   (Engine Oil, Brake Pads, Filters, Tyres, Battery, etc. + custom)
 *   with brand, component cost, and individual next-due targets.
 * - Receipt / Invoice attachment linking (Images & PDFs) with permanent storage.
 *
 * Styled in the Refined Technical Automotive Cockpit design:
 * - Standardized FormHeader with single pinned bottom save action (no header duplicate)
 * - Vehicle context card showing active vehicle & current baseline
 * - Hero total cost card with quick increment chips
 * - Odometer section with current baseline and quick presets
 * - DD/MM/YYYY date input with auto-formatting & "Set Today" shortcut
 * - Serviced parts cards with action selector, brand, cost, and next due targets
 * - Offline invoice/receipt attachment drawer with full-screen viewer
 * - Pinned 52dp Automotive Orange save button
 * - 100% offline
 */

import { CategoryIcon } from "@/components/CategoryIcon";
import { FormHeader } from "@/components/FormHeader";
import { NoVehicleState } from "@/components/NoVehicleState";
import { TyreIcon } from "@/components/TyreIcon";
import { VehicleType } from "@/constants/fuelTypes";
import { SERVICE_TEMPLATES } from "@/constants/serviceTemplates";
import { Sizing, Spacing, Typography } from "@/constants/theme";
import * as maintCompRepo from "@/database/repositories/maintenanceComponentRepo";
import * as serviceRepo from "@/database/repositories/serviceRepo";
import { useThemeColors } from "@/hooks/useThemeColors";
import { getCurrencySymbol } from "@/stores/preferencesStore";
import { useServiceStore } from "@/stores/serviceStore";
import { useVehicleStore } from "@/stores/vehicleStore";
import {
  CreateMaintenanceComponentInput,
  MaintenanceAction,
} from "@/types/service";
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

interface FormComponentItem {
  id: string;
  component_name: string;
  action: MaintenanceAction;
  brand: string;
  cost: string;
  next_due_km: string;
  next_due_date_display: string;
  notes: string;
}

const COMMON_COMPONENTS = [
  { name: "Engine Oil", icon: "🛢️" },
  { name: "Oil Filter", icon: "⚙️" },
  { name: "Air Filter", icon: "💨" },
  { name: "Brake Pads", icon: "🛑" },
  { name: "Spark Plugs", icon: "⚡" },
  { name: "Battery", icon: "🔋" },
  { name: "Tyres", icon: "🛞" },
  { name: "Coolant", icon: "🧪" },
  { name: "Timing Belt", icon: "🔄" },
];

const COMMON_COST_PRESETS = [500, 1000, 2500, 5000, 10000];

function renderComponentIcon(name: string, size = 18, isSelected = false) {
  if (
    name.toLowerCase().includes("tyre") ||
    name.toLowerCase().includes("tire")
  ) {
    return (
      <TyreIcon
        size={size}
        tyreColor={isSelected ? "#0F172A" : "#334155"}
        rimColor={isSelected ? "#E2E8F0" : "#94A3B8"}
      />
    );
  }
  const match = COMMON_COMPONENTS.find(
    (c) => c.name.toLowerCase() === name.toLowerCase(),
  );
  const emoji = match?.icon || "⚙️";
  return <CategoryIcon icon={emoji} size={size} />;
}

export default function AddServiceScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; vehicleId?: string }>();
  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);
  const selectVehicle = useVehicleStore((s) => s.selectVehicle);
  const addRecord = useServiceStore((s) => s.addRecord);
  const editRecord = useServiceStore((s) => s.editRecord);

  useEffect(() => {
    if (params.vehicleId && params.vehicleId !== selectedVehicle?.id) {
      selectVehicle(params.vehicleId);
    }
  }, [params.vehicleId]);

  const isEditMode = !!params.id;
  const currencySymbol = getCurrencySymbol();

  const [serviceType, setServiceType] = useState("");
  const [dateDisplay, setDateDisplay] = useState("");
  const [date, setDate] = useState(todayISO());
  const [cost, setCost] = useState("");
  const [odometer, setOdometer] = useState("");
  const [garageName, setGarageName] = useState("");
  const [workDone, setWorkDone] = useState("");
  const [notes, setNotes] = useState("");
  const [nextDueKm, setNextDueKm] = useState("");
  const [nextDueDateDisplay, setNextDueDateDisplay] = useState("");
  const [receiptPhotoUri, setReceiptPhotoUri] = useState<string | null>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  // Components tracking state
  const [components, setComponents] = useState<FormComponentItem[]>([]);
  const [customPartName, setCustomPartName] = useState("");
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [error, setError] = useState("");

  // Initialize date display
  useEffect(() => {
    setDateDisplay(isoToDisplay(date));
  }, []);

  // Load existing record for edit mode
  useEffect(() => {
    if (isEditMode && params.id) {
      const existing = serviceRepo.getServiceRecordById(params.id);
      if (existing) {
        setServiceType(existing.service_type);
        setDate(existing.date);
        setDateDisplay(isoToDisplay(existing.date));
        setCost(existing.cost != null ? existing.cost.toString() : "");
        setOdometer(
          existing.odometer != null ? existing.odometer.toString() : "",
        );
        setGarageName(existing.garage_name || "");
        setWorkDone(existing.work_done || "");
        setNotes(existing.notes || "");
        setNextDueKm(
          existing.next_due_km != null ? existing.next_due_km.toString() : "",
        );
        setNextDueDateDisplay(
          existing.next_due_date ? isoToDisplay(existing.next_due_date) : "",
        );
        setReceiptPhotoUri(existing.receipt_photo_uri || null);
      }

      const existingComps = maintCompRepo.getMaintenanceComponentsByService(
        params.id,
      );
      if (existingComps && existingComps.length > 0) {
        setComponents(
          existingComps.map((c) => ({
            id: c.id,
            component_name: c.component_name,
            action: (c.action as MaintenanceAction) || "replaced",
            brand: c.brand || "",
            cost: c.cost != null ? c.cost.toString() : "",
            next_due_km: c.next_due_km != null ? c.next_due_km.toString() : "",
            next_due_date_display: c.next_due_date
              ? isoToDisplay(c.next_due_date)
              : "",
            notes: c.notes || "",
          })),
        );
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
    setError("");
  };

  const handleSetToday = () => {
    const today = todayISO();
    setDate(today);
    setDateDisplay(isoToDisplay(today));
    setError("");
  };

  const handleSetYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yestISO = d.toISOString().split("T")[0];
    setDate(yestISO);
    setDateDisplay(isoToDisplay(yestISO));
    setError("");
  };

  const handleQuickCostSelect = (val: number) => {
    setCost(String(val));
    setError("");
  };

  const handleQuickCostAdd = (delta: number) => {
    const current = parseFloat(cost) || 0;
    setCost(String(Math.round(current + delta)));
    setError("");
  };

  const handleSetCurrentOdometer = () => {
    if (
      selectedVehicle.current_odometer !== null &&
      selectedVehicle.current_odometer !== undefined
    ) {
      setOdometer(String(selectedVehicle.current_odometer));
      setError("");
    }
  };

  const handleQuickNextDueKm = (delta: number) => {
    const base = parseFloat(odometer) || selectedVehicle.current_odometer || 0;
    setNextDueKm(String(Math.round(base + delta)));
    setError("");
  };

  const handleQuickNextDueDateMonths = (months: number) => {
    const base = new Date();
    base.setMonth(base.getMonth() + months);
    setNextDueDateDisplay(isoToDisplay(base.toISOString().split("T")[0]));
    setError("");
  };

  // Component Management
  const addComponentByName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (
      components.some(
        (c) => c.component_name.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      Alert.alert(
        "Component Added",
        `"${trimmed}" is already in this service record.`,
      );
      return;
    }
    const newItem: FormComponentItem = {
      id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      component_name: trimmed,
      action: "replaced",
      brand: "",
      cost: "",
      next_due_km: "",
      next_due_date_display: "",
      notes: "",
    };
    setComponents((prev) => [...prev, newItem]);
    setCustomPartName("");
    setShowAddCustom(false);
  };

  const removeComponent = (index: number) => {
    setComponents((prev) => prev.filter((_, i) => i !== index));
  };

  const updateComponentField = (
    index: number,
    field: keyof FormComponentItem,
    value: string,
  ) => {
    setComponents((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Receipt / Attachment Handlers
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
    Alert.alert("Attach Receipt or Invoice 🧾", "Select file source:", [
      { text: "📷 Camera", onPress: takePhoto },
      { text: "🖼️ Gallery", onPress: pickImage },
      { text: "📄 PDF Invoice", onPress: pickPDF },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleViewReceipt = async () => {
    if (!receiptPhotoUri) return;
    if (isPdfAttachment(receiptPhotoUri)) {
      const res = await openAttachment(
        receiptPhotoUri,
        "Service Invoice / Receipt",
      );
      if (!res.success && res.message) {
        Alert.alert("View Document", res.message);
      }
    } else {
      setViewerUri(receiptPhotoUri);
    }
  };

  const handleSave = () => {
    if (!serviceType.trim()) {
      setError("Please select or enter a service type.");
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

    if (cost) {
      const parsedCost = parseFloat(cost);
      if (isNaN(parsedCost) || parsedCost < 0) {
        setError("Enter a valid cost amount (0 or greater).");
        return;
      }
    }

    if (odometer) {
      const parsedOdo = parseFloat(odometer);
      if (isNaN(parsedOdo) || parsedOdo < 0) {
        setError("Enter a valid odometer reading.");
        return;
      }
    }

    let nextDueKmVal: number | null = null;
    if (nextDueKm.trim()) {
      nextDueKmVal = parseFloat(nextDueKm);
      if (isNaN(nextDueKmVal) || nextDueKmVal <= 0) {
        setError("Next due km must be a number greater than 0.");
        return;
      }
      const baseOdo = odometer
        ? parseFloat(odometer)
        : selectedVehicle.current_odometer;
      if (baseOdo && nextDueKmVal <= baseOdo) {
        setError(
          "Next due km must be higher than the current odometer reading.",
        );
        return;
      }
    }

    let nextDueDateVal: string | null = null;
    if (nextDueDateDisplay.trim()) {
      const ndv = validateDateDisplay(nextDueDateDisplay);
      nextDueDateVal = ndv.isValid ? displayToISO(nextDueDateDisplay) : null;
      if (!nextDueDateVal) {
        setError(
          ndv.error || "Enter a valid next due date in DD/MM/YYYY format.",
        );
        return;
      }
      if (nextDueDateVal < isoDate) {
        setError("Next due date cannot be before the service date.");
        return;
      }
    }

    // Validate components
    const componentInputs: CreateMaintenanceComponentInput[] = [];
    const baseOdo = odometer
      ? parseFloat(odometer)
      : selectedVehicle.current_odometer;

    for (const comp of components) {
      let parsedCompCost: number | undefined = undefined;
      if (comp.cost && comp.cost.trim()) {
        const pCost = parseFloat(comp.cost.trim());
        if (isNaN(pCost) || pCost < 0) {
          setError(
            `Invalid cost for component "${comp.component_name}". Must be 0 or greater.`,
          );
          return;
        }
        parsedCompCost = pCost;
      }

      let compNextKm: number | undefined = undefined;
      if (comp.next_due_km.trim()) {
        const pKm = parseFloat(comp.next_due_km.trim());
        if (isNaN(pKm) || pKm <= 0) {
          setError(
            `Invalid next due km for "${comp.component_name}". Must be greater than 0.`,
          );
          return;
        }
        if (baseOdo && pKm <= baseOdo) {
          setError(
            `Next due km for "${comp.component_name}" (${pKm} km) cannot be less than or equal to the odometer reading (${baseOdo} km).`,
          );
          return;
        }
        compNextKm = pKm;
      }

      let compNextDate: string | undefined = undefined;
      if (comp.next_due_date_display.trim()) {
        const cDateVal = validateDateDisplay(comp.next_due_date_display);
        if (!cDateVal.isValid) {
          setError(
            cDateVal.error ||
              `Invalid next due date for "${comp.component_name}". Use DD/MM/YYYY format.`,
          );
          return;
        }
        const parsedDate = displayToISO(comp.next_due_date_display);
        if (!parsedDate) {
          setError(`Invalid date format for "${comp.component_name}".`);
          return;
        }
        if (parsedDate < isoDate) {
          setError(
            `Next due date for "${comp.component_name}" cannot be before the service date.`,
          );
          return;
        }
        compNextDate = parsedDate;
      }

      componentInputs.push({
        component_name: comp.component_name.trim(),
        action: comp.action,
        brand: comp.brand.trim() || undefined,
        cost: parsedCompCost,
        next_due_km: compNextKm,
        next_due_date: compNextDate,
        notes: comp.notes.trim() || undefined,
        maintenance_date: isoDate,
        odometer: odometer ? parseFloat(odometer) : undefined,
      });
    }

    setError("");

    try {
      if (isEditMode && params.id) {
        editRecord(
          params.id,
          {
            service_type: serviceType.trim(),
            date: isoDate,
            cost: cost ? parseFloat(cost) : null,
            odometer: odometer ? parseFloat(odometer) : null,
            garage_name: garageName.trim() || null,
            work_done: workDone.trim() || null,
            notes: notes.trim() || null,
            next_due_km: nextDueKmVal,
            next_due_date: nextDueDateVal,
            receipt_photo_uri: receiptPhotoUri || null,
          },
          componentInputs,
        );
        router.back();
      } else {
        addRecord(
          {
            vehicle_id: selectedVehicle.id,
            date: isoDate,
            service_type: serviceType.trim(),
            cost: cost ? parseFloat(cost) : undefined,
            odometer: odometer ? parseFloat(odometer) : undefined,
            garage_name: garageName.trim() || undefined,
            work_done: workDone.trim() || undefined,
            notes: notes.trim() || undefined,
            next_due_km: nextDueKmVal ?? undefined,
            next_due_date: nextDueDateVal ?? undefined,
            receipt_photo_uri: receiptPhotoUri || undefined,
          },
          componentInputs,
        );
        router.back();
      }
    } catch (saveError) {
      console.error(
        "[AddService.handleSave] Failed to save service record:",
        saveError,
      );
      const errMsg =
        saveError instanceof Error
          ? saveError.message
          : "Unknown database error occurred.";
      setError(`Failed to save service: ${errMsg}`);
      Alert.alert("Save Failed", `Could not save service record:\n${errMsg}`);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "android" ? "height" : "padding"}
    >
      {/* ── FormHeader (No duplicate save button in header) ── */}
      <FormHeader
        title={isEditMode ? "Edit Maintenance" : "Record Maintenance"}
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

        {/* ── Hero Service Cost Card ── */}
        <View
          style={[
            styles.heroAmountCard,
            {
              backgroundColor: colors.surface,
              borderColor: cost ? colors.primary : colors.border,
              ...Sizing.cardShadow,
            },
          ]}
        >
          <Text style={[styles.heroCardLabel, { color: colors.textSecondary }]}>
            TOTAL SERVICE COST ({currencySymbol})
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
              value={cost}
              onChangeText={(text) => {
                setCost(text);
                setError("");
              }}
              keyboardType="decimal-pad"
            />
          </View>

          {/* Quick Preset Cost Chips */}
          <View style={styles.quickAmountRow}>
            {COMMON_COST_PRESETS.map((val) => (
              <TouchableOpacity
                key={val}
                style={[
                  styles.quickAmountChip,
                  {
                    backgroundColor:
                      cost === String(val)
                        ? colors.surfaceSecondary
                        : colors.background,
                    borderColor:
                      cost === String(val)
                        ? colors.primary
                        : colors.borderLight,
                  },
                ]}
                onPress={() => handleQuickCostSelect(val)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.quickAmountText,
                    {
                      color:
                        cost === String(val)
                          ? colors.primary
                          : colors.textSecondary,
                      fontWeight: cost === String(val) ? "800" : "600",
                    },
                  ]}
                >
                  {currencySymbol}
                  {val >= 1000 ? `${val / 1000}k` : val}
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
              onPress={() => handleQuickCostAdd(1000)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.quickAmountText,
                  { color: colors.primary, fontWeight: "700" },
                ]}
              >
                +{currencySymbol}1k
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Date Input with Quick Shortcuts ── */}
        <View style={styles.sectionHeaderRow}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.textSecondary, marginBottom: 0 },
            ]}
          >
            SERVICE DATE (DD/MM/YYYY) *
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

        {/* ── Service Type Selection ── */}
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.textSecondary, marginTop: Spacing.md },
          ]}
        >
          SERVICE TYPE *
        </Text>
        <View style={styles.chipGrid}>
          {SERVICE_TEMPLATES.map((template) => {
            const isSelected = serviceType === template.name;
            return (
              <TouchableOpacity
                key={template.id}
                onPress={() => {
                  setServiceType(template.name);
                  setError("");
                }}
                style={[
                  styles.serviceChip,
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
                <CategoryIcon icon={template.icon} size={16} />
                <Text
                  style={[
                    styles.serviceChipText,
                    {
                      color: isSelected ? colors.primary : colors.text,
                      fontWeight: isSelected ? "800" : "600",
                    },
                  ]}
                >
                  {template.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              color: colors.text,
              borderColor: colors.border,
              marginTop: Spacing.xs,
            },
          ]}
          placeholder="Or type a custom service (e.g. 50k Full Inspection)..."
          placeholderTextColor={colors.textTertiary}
          value={serviceType}
          onChangeText={setServiceType}
        />

        {/* ── Odometer Reading at Service ── */}
        <View style={[styles.sectionHeaderRow, { marginTop: Spacing.md }]}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.textSecondary, marginBottom: 0 },
            ]}
          >
            ODOMETER AT SERVICE (KM)
          </Text>
          {selectedVehicle.current_odometer !== null &&
          selectedVehicle.current_odometer !== undefined ? (
            <TouchableOpacity
              style={[
                styles.dateShortcutChip,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.borderLight,
                },
              ]}
              onPress={handleSetCurrentOdometer}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.dateShortcutText, { color: colors.primary }]}
              >
                Current (
                {selectedVehicle.current_odometer.toLocaleString("en-IN")})
              </Text>
            </TouchableOpacity>
          ) : null}
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
          placeholder={
            selectedVehicle.current_odometer
              ? `e.g. ${selectedVehicle.current_odometer}`
              : "e.g. 25000"
          }
          placeholderTextColor={colors.textTertiary}
          value={odometer}
          onChangeText={setOdometer}
          keyboardType="numeric"
        />

        {/* ── Garage / Workshop Name ── */}
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.textSecondary, marginTop: Spacing.md },
          ]}
        >
          GARAGE / WORKSHOP
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
          placeholder="e.g. Authorised Service Center, Bosch Auto Care"
          placeholderTextColor={colors.textTertiary}
          value={garageName}
          onChangeText={setGarageName}
        />

        {/* ── Work Done Description ── */}
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.textSecondary, marginTop: Spacing.md },
          ]}
        >
          WORK DONE DESCRIPTION (OPTIONAL)
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
          placeholder="Detailed work done notes, technicians remarks, warranty items..."
          placeholderTextColor={colors.textTertiary}
          value={workDone}
          onChangeText={setWorkDone}
          multiline
          numberOfLines={3}
        />

        {/* ── Parts-Level Maintenance Tracking ── */}
        <View
          style={[
            styles.partsHeaderCard,
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: colors.borderLight,
            },
          ]}
        >
          <Text style={[styles.partsHeaderTitle, { color: colors.text }]}>
            PARTS & COMPONENTS SERVICED 🔧
          </Text>
          <Text style={[Typography.caption, { color: colors.textSecondary }]}>
            Track replacement wear, brands, part costs & component next-due
            intervals
          </Text>
        </View>

        {/* Quick Add Component Chips */}
        <View style={styles.chipGrid}>
          {COMMON_COMPONENTS.map((comp) => {
            const isAdded = components.some(
              (c) => c.component_name.toLowerCase() === comp.name.toLowerCase(),
            );
            return (
              <TouchableOpacity
                key={comp.name}
                onPress={() => addComponentByName(comp.name)}
                style={[
                  styles.partChip,
                  {
                    backgroundColor: isAdded
                      ? colors.surfaceSecondary
                      : colors.surface,
                    borderColor: isAdded ? colors.primary : colors.borderLight,
                  },
                ]}
                activeOpacity={0.7}
              >
                {renderComponentIcon(comp.name, 16, isAdded)}
                <Text
                  style={[
                    styles.partChipText,
                    { color: isAdded ? colors.primary : colors.text },
                  ]}
                >
                  {comp.name} {isAdded ? "✓" : "+"}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            onPress={() => setShowAddCustom(!showAddCustom)}
            style={[
              styles.partChip,
              {
                backgroundColor: showAddCustom
                  ? colors.primary
                  : colors.surface,
                borderColor: showAddCustom
                  ? colors.primary
                  : colors.borderLight,
              },
            ]}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 13 }}>➕</Text>
            <Text
              style={[
                styles.partChipText,
                { color: showAddCustom ? colors.primaryText : colors.text },
              ]}
            >
              Custom Part
            </Text>
          </TouchableOpacity>
        </View>

        {showAddCustom && (
          <View style={styles.addCustomRow}>
            <TextInput
              style={[
                styles.input,
                {
                  flex: 1,
                  backgroundColor: colors.surface,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="e.g. Wiper Blades, Suspension Bush"
              placeholderTextColor={colors.textTertiary}
              value={customPartName}
              onChangeText={setCustomPartName}
            />
            <TouchableOpacity
              style={[styles.addCustomBtn, { backgroundColor: colors.primary }]}
              onPress={() => addComponentByName(customPartName)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  Typography.button,
                  { color: colors.primaryText, fontSize: 13 },
                ]}
              >
                Add
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Render Added Component Cards */}
        {components.length > 0 ? (
          <View style={styles.componentsList}>
            {components.map((comp, idx) => (
              <View
                key={comp.id || idx}
                style={[
                  styles.componentCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderLight,
                  },
                ]}
              >
                <View style={styles.componentCardHeader}>
                  <View style={styles.compTitleRow}>
                    {renderComponentIcon(comp.component_name, 20)}
                    <Text
                      style={[styles.compTitleText, { color: colors.text }]}
                    >
                      {comp.component_name}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => removeComponent(idx)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        Typography.caption,
                        { color: colors.danger, fontWeight: "700" },
                      ]}
                    >
                      Remove ✕
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Action selector chips */}
                <View style={styles.compFieldBlock}>
                  <Text
                    style={[
                      styles.compFieldLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    ACTION TAKEN
                  </Text>
                  <View style={styles.actionChipsRow}>
                    {(
                      [
                        "replaced",
                        "inspected",
                        "topped_up",
                        "cleaned",
                      ] as MaintenanceAction[]
                    ).map((act) => {
                      const isSelected = comp.action === act;
                      return (
                        <TouchableOpacity
                          key={act}
                          onPress={() =>
                            updateComponentField(idx, "action", act)
                          }
                          style={[
                            styles.actionChip,
                            {
                              backgroundColor: isSelected
                                ? colors.primary
                                : colors.surfaceSecondary,
                              borderColor: isSelected
                                ? colors.primary
                                : colors.borderLight,
                            },
                          ]}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.actionChipText,
                              {
                                color: isSelected
                                  ? colors.primaryText
                                  : colors.textSecondary,
                                fontWeight: isSelected ? "800" : "600",
                              },
                            ]}
                          >
                            {act.replace("_", " ")}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Brand & Specification */}
                <View style={styles.compFieldBlock}>
                  <Text
                    style={[
                      styles.compFieldLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    BRAND / SPECIFICATION
                  </Text>
                  <TextInput
                    style={[
                      styles.compInput,
                      {
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.border,
                      },
                    ]}
                    placeholder="e.g. Shell Helix 5W-40, Bosch, Brembo"
                    placeholderTextColor={colors.textTertiary}
                    value={comp.brand}
                    onChangeText={(val) =>
                      updateComponentField(idx, "brand", val)
                    }
                    autoCapitalize="words"
                  />
                </View>

                {/* Part Cost & Next Due Odometer */}
                <View style={styles.compDoubleRow}>
                  <View style={[{ flex: 1 }, styles.compFieldBlock]}>
                    <Text
                      style={[
                        styles.compFieldLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      PART COST ({currencySymbol})
                    </Text>
                    <TextInput
                      style={[
                        styles.compInput,
                        {
                          backgroundColor: colors.background,
                          color: colors.text,
                          borderColor: colors.border,
                          fontVariant: ["tabular-nums"],
                        },
                      ]}
                      placeholder="0.00"
                      placeholderTextColor={colors.textTertiary}
                      value={comp.cost}
                      onChangeText={(val) =>
                        updateComponentField(idx, "cost", val)
                      }
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[{ flex: 1 }, styles.compFieldBlock]}>
                    <Text
                      style={[
                        styles.compFieldLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      NEXT DUE (KM)
                    </Text>
                    <TextInput
                      style={[
                        styles.compInput,
                        {
                          backgroundColor: colors.background,
                          color: colors.text,
                          borderColor: colors.border,
                          fontVariant: ["tabular-nums"],
                        },
                      ]}
                      placeholder="e.g. 35000"
                      placeholderTextColor={colors.textTertiary}
                      value={comp.next_due_km}
                      onChangeText={(val) =>
                        updateComponentField(idx, "next_due_km", val)
                      }
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* Next Due Date */}
                <View style={styles.compFieldBlock}>
                  <Text
                    style={[
                      styles.compFieldLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    NEXT DUE DATE (DD/MM/YYYY)
                  </Text>
                  <TextInput
                    style={[
                      styles.compInput,
                      {
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.border,
                        fontVariant: ["tabular-nums"],
                      },
                    ]}
                    placeholder="DD/MM/YYYY"
                    placeholderTextColor={colors.textTertiary}
                    value={comp.next_due_date_display}
                    onChangeText={(val) =>
                      updateComponentField(
                        idx,
                        "next_due_date_display",
                        formatDateInput(val, comp.next_due_date_display),
                      )
                    }
                    keyboardType="number-pad"
                    maxLength={10}
                  />
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* ── Invoice / Bill Attachment ── */}
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.textSecondary, marginTop: Spacing.md },
          ]}
        >
          SERVICE INVOICE OR RECEIPT 🧾
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
                    PDF Service Invoice
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
                    Invoice Photo
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
              Attach Garage Invoice (Camera, Gallery, or PDF)
            </Text>
            <Text
              style={[
                Typography.caption,
                { color: colors.textTertiary, marginTop: 2 },
              ]}
            >
              Securely stored offline and preserved in your database backups
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Overall Service Next Due Targets ── */}
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.textSecondary, marginTop: Spacing.md },
          ]}
        >
          OVERALL NEXT SERVICE TARGETS (OPTIONAL)
        </Text>

        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.fieldSubLabel, { color: colors.textSecondary }]}>
            Next Due Odometer (km)
          </Text>
          <View style={styles.dateShortcutsRow}>
            {[5000, 10000].map((delta) => (
              <TouchableOpacity
                key={delta}
                style={[
                  styles.dateShortcutChip,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.borderLight,
                  },
                ]}
                onPress={() => handleQuickNextDueKm(delta)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.dateShortcutText, { color: colors.primary }]}
                >
                  +{delta >= 1000 ? `${delta / 1000}k` : delta} km
                </Text>
              </TouchableOpacity>
            ))}
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
          placeholder="e.g. 25000"
          placeholderTextColor={colors.textTertiary}
          value={nextDueKm}
          onChangeText={setNextDueKm}
          keyboardType="numeric"
        />

        <View style={[styles.sectionHeaderRow, { marginTop: Spacing.md }]}>
          <Text style={[styles.fieldSubLabel, { color: colors.textSecondary }]}>
            Next Due Date (DD/MM/YYYY)
          </Text>
          <View style={styles.dateShortcutsRow}>
            {[6, 12].map((m) => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.dateShortcutChip,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.borderLight,
                  },
                ]}
                onPress={() => handleQuickNextDueDateMonths(m)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.dateShortcutText, { color: colors.primary }]}
                >
                  +{m}m ({m >= 12 ? `${m / 12}y` : `${m}m`})
                </Text>
              </TouchableOpacity>
            ))}
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
          value={nextDueDateDisplay}
          onChangeText={(t) =>
            setNextDueDateDisplay(formatDateInput(t, nextDueDateDisplay))
          }
          keyboardType="number-pad"
          maxLength={10}
        />

        {/* ── Additional Notes ── */}
        <Text
          style={[
            styles.sectionTitle,
            { color: colors.textSecondary, marginTop: Spacing.md },
          ]}
        >
          ADDITIONAL NOTES (OPTIONAL)
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
          placeholder="Any extra service notes or observations..."
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
            isEditMode ? "Update Maintenance Record" : "Save Maintenance Record"
          }
        >
          <Text
            style={[
              Typography.button,
              { color: "#FFFFFF", fontWeight: "800", fontSize: 16 },
            ]}
          >
            {isEditMode
              ? "Update Maintenance ✏️"
              : "Save Maintenance Record 🔧"}
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
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  fieldSubLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
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
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  serviceChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
  },
  serviceChipText: {
    fontSize: 12,
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
  partsHeaderCard: {
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  partsHeaderTitle: {
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 2,
  },
  partChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
  },
  partChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  addCustomRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  addCustomBtn: {
    paddingHorizontal: Spacing.lg,
    borderRadius: Sizing.radiusMd,
    alignItems: "center",
    justifyContent: "center",
  },
  componentsList: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  componentCard: {
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  componentCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: Spacing.xs,
  },
  compTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  compTitleText: {
    fontSize: 15,
    fontWeight: "800",
  },
  compFieldBlock: {
    marginTop: 6,
  },
  compFieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  actionChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  actionChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
  },
  actionChipText: {
    fontSize: 11,
    textTransform: "capitalize",
  },
  compInput: {
    height: 42,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    fontSize: 14,
  },
  compDoubleRow: {
    flexDirection: "row",
    gap: Spacing.sm,
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
