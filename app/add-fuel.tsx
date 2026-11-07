/**
 * Add / Edit Fuel Entry — Modal Form
 *
 * THE CORE USER FLOW. Technical Automotive Cockpit design:
 *   Tap [+ Add Fuel] → Fill 3 fields → Save → See mileage
 *
 * EDIT MODE: If opened with ?id=<entryId>, loads existing entry for editing.
 *
 * REQUIRED FIELDS:
 *   1. Odometer reading
 *   2. Fuel amount (litres/kg/kWh)
 *   3. Price per unit (or Total Cost)
 *
 * AUTO-FILLED:
 *   - Date → today (editable)
 *   - Fuel unit → from vehicle's fuel_type
 *   - Full tank → yes (toggle)
 *   - Rate & Fuel Station → smart default from last entry
 *   - Delta km → real-time distance progression from previous entry
 */

import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Stores & Database
import * as fuelRepo from "@/database/repositories/fuelRepo";
import { hasWarningsOnly, validateFuelEntry } from "@/engine/validationEngine";
import { useFuelStore } from "@/stores/fuelStore";
import { getCurrencySymbol } from "@/stores/preferencesStore";
import { useVehicleStore } from "@/stores/vehicleStore";

// Constants & Theme
import {
  FUEL_TYPE_TO_DEFAULT_UNIT,
  FuelType,
  FuelUnit,
  MILEAGE_UNIT_LABELS,
  getFuelSystemLabel,
  getFuelUnitForSystem,
  isHybridFuel,
} from "@/constants/fuelTypes";
import { Sizing, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/useThemeColors";

// Components & Utils
import { CngTankIcon } from "@/components/CngTankIcon";
import { FormHeader } from "@/components/FormHeader";
import { NoVehicleState } from "@/components/NoVehicleState";
import { todayISO } from "@/utils/date";
import {
  displayToISO,
  formatDateInput,
  isoToDisplay,
  validateDateDisplay,
} from "@/utils/dateInput";
import { formatMileage } from "@/utils/format";

const QUICK_AMOUNTS = [200, 500, 1000, 1500, 2000, 2500] as const;

export default function AddFuelScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id?: string;
    vehicleId?: string;
    odometer?: string;
  }>();

  // ── Vehicle Stores ──
  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);
  const selectVehicle = useVehicleStore((s) => s.selectVehicle);
  const loadVehicles = useVehicleStore((s) => s.loadVehicles);
  const addFuelEntry = useFuelStore((s) => s.addFuelEntry);
  const updateFuelEntry = useFuelStore((s) => s.updateFuelEntry);

  useEffect(() => {
    if (params.vehicleId && params.vehicleId !== selectedVehicle?.id) {
      selectVehicle(params.vehicleId);
    }
  }, [params.vehicleId, selectedVehicle?.id, selectVehicle]);

  const isEditMode = !!params.id;

  // ── Form State ──
  const [date, setDate] = useState(todayISO());
  const [dateDisplay, setDateDisplay] = useState(isoToDisplay(todayISO()));
  const [odometer, setOdometer] = useState(
    !params.id && params.odometer ? String(params.odometer) : "",
  );
  const [fuelAmount, setFuelAmount] = useState("");
  const [pricePerUnit, setPricePerUnit] = useState("");
  const [totalCostInput, setTotalCostInput] = useState("");
  const [lastEdited, setLastEdited] = useState<"fuelAmount" | "totalCost">(
    "fuelAmount",
  );
  const [fuelStation, setFuelStation] = useState("");
  const [isFullTank, setIsFullTank] = useState(true);
  const [notes, setNotes] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [fuelSystem, setFuelSystem] = useState<"primary" | "secondary">(
    "primary",
  );
  const [batteryStartPercent, setBatteryStartPercent] = useState("");
  const [batteryEndPercent, setBatteryEndPercent] = useState("");

  // ── Frequent Stations ──
  const knownStations = useMemo(() => fuelRepo.getFrequentFuelStations(), []);
  const stationSuggestions = useMemo(() => {
    const query = fuelStation.trim().toLowerCase();
    return knownStations
      .filter(
        (s) =>
          s.toLowerCase() !== query &&
          (!query || s.toLowerCase().includes(query)),
      )
      .slice(0, 5);
  }, [knownStations, fuelStation]);

  // ── Previous Odometer Tracking for Realtime Delta ──
  const previousOdometer = useMemo(() => {
    if (!selectedVehicle) return null;
    const isoDate = displayToISO(dateDisplay) || date;
    const lastEntry = fuelRepo.getFuelEntryBeforeDate(
      selectedVehicle.id,
      isoDate,
    );
    if (lastEntry) return lastEntry.odometer;
    if (
      selectedVehicle.current_odometer &&
      selectedVehicle.current_odometer > 0
    ) {
      return selectedVehicle.current_odometer;
    }
    return null;
  }, [selectedVehicle, dateDisplay, date]);

  const odoDelta = useMemo(() => {
    const current = parseFloat(odometer);
    if (isNaN(current) || previousOdometer === null) return null;
    return current - previousOdometer;
  }, [odometer, previousOdometer]);

  // ── Edit Mode Data Preloading ──
  useEffect(() => {
    if (isEditMode && params.id) {
      const existing = fuelRepo.getFuelEntryById(params.id);
      if (existing) {
        setDate(existing.date);
        setDateDisplay(isoToDisplay(existing.date));
        setOdometer(existing.odometer.toString());
        setFuelAmount(existing.fuel_amount.toString());
        setPricePerUnit(existing.price_per_unit.toString());
        setTotalCostInput(existing.total_cost.toFixed(2));
        setLastEdited("fuelAmount");
        setFuelStation(existing.fuel_station || "");
        setIsFullTank(existing.is_full_tank === 1);
        setNotes(existing.notes || "");
        setPhotoUri(existing.receipt_photo_uri || null);
        if (
          existing.fuel_system === "secondary" ||
          existing.fuel_system === "primary"
        ) {
          setFuelSystem(existing.fuel_system);
        }
        if (existing.battery_start_percent != null) {
          setBatteryStartPercent(existing.battery_start_percent.toString());
        }
        if (existing.battery_end_percent != null) {
          setBatteryEndPercent(existing.battery_end_percent.toString());
        }
      }
    }
  }, [isEditMode, params.id]);

  // ── Smart Pre-fill for New Entries ──
  useEffect(() => {
    if (!isEditMode && selectedVehicle) {
      const latest = fuelRepo.getLatestFuelEntry(selectedVehicle.id);
      if (latest) {
        if (latest.price_per_unit > 0) {
          setPricePerUnit(latest.price_per_unit.toString());
        }
        if (latest.fuel_station) {
          setFuelStation(latest.fuel_station);
        }
      }
    }
  }, [isEditMode, selectedVehicle]);

  // ── Odometer passed via query params ──
  useEffect(() => {
    if (!isEditMode && params.odometer && !odometer) {
      setOdometer(String(params.odometer));
    }
  }, [isEditMode, params.odometer, odometer]);

  // ── Derived Fuel & EV Specs ──
  const isHybrid = selectedVehicle
    ? isHybridFuel(selectedVehicle.fuel_type as FuelType)
    : false;
  const isEV = selectedVehicle
    ? selectedVehicle.fuel_type === FuelType.ELECTRIC
    : false;
  const fuelUnit = selectedVehicle
    ? isHybrid
      ? getFuelUnitForSystem(selectedVehicle.fuel_type as FuelType, fuelSystem)
      : (FUEL_TYPE_TO_DEFAULT_UNIT[selectedVehicle.fuel_type as FuelType] ??
        FuelUnit.LITRES)
    : FuelUnit.LITRES;
  const fuelUnitLabel =
    fuelUnit === FuelUnit.LITRES
      ? "L"
      : fuelUnit === FuelUnit.KG
        ? "kg"
        : "kWh";
  const currencySymbol = getCurrencySymbol();

  // ── EV Battery % to kWh Calculation ──
  const evEstimatedKwh = useMemo(() => {
    if (!isEV || !selectedVehicle) return null;
    const startP = parseFloat(batteryStartPercent);
    const endP = parseFloat(batteryEndPercent);
    const capacity = selectedVehicle.tank_capacity;
    if (
      !isNaN(startP) &&
      !isNaN(endP) &&
      endP > startP &&
      capacity &&
      capacity > 0
    ) {
      return ((endP - startP) / 100) * capacity;
    }
    return null;
  }, [isEV, batteryStartPercent, batteryEndPercent, selectedVehicle]);

  // ── Live Calculation Summary ──
  const computedSummary = useMemo(() => {
    const qty = parseFloat(fuelAmount);
    const price = parseFloat(pricePerUnit);
    const total = parseFloat(totalCostInput);

    if (!isNaN(qty) && qty > 0 && !isNaN(price) && price > 0) {
      const calcTotal = (qty * price).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return `✓ ${qty} ${fuelUnitLabel} × ${currencySymbol}${price.toFixed(2)} = ${currencySymbol}${calcTotal}`;
    }
    if (!isNaN(total) && total > 0 && !isNaN(price) && price > 0) {
      const calcQty = (total / price).toFixed(2);
      return `✓ ${currencySymbol}${total} ÷ ${currencySymbol}${price.toFixed(2)} = ${calcQty} ${fuelUnitLabel}`;
    }
    return null;
  }, [fuelAmount, pricePerUnit, totalCostInput, fuelUnitLabel, currencySymbol]);

  // ── 2-Way Input Handlers ──
  const handleFuelAmountChange = (text: string) => {
    setFuelAmount(text);
    setLastEdited("fuelAmount");

    const qty = parseFloat(text);
    const price = parseFloat(pricePerUnit);
    if (!isNaN(qty) && qty > 0 && !isNaN(price) && price > 0) {
      setTotalCostInput((qty * price).toFixed(2));
    } else if (!text) {
      setTotalCostInput("");
    }
  };

  const handleTotalCostChange = (text: string) => {
    setTotalCostInput(text);
    setLastEdited("totalCost");

    const total = parseFloat(text);
    const price = parseFloat(pricePerUnit);
    if (!isNaN(total) && total > 0 && !isNaN(price) && price > 0) {
      setFuelAmount((total / price).toFixed(2));
    } else if (!text) {
      setFuelAmount("");
    }
  };

  const handlePricePerUnitChange = (text: string) => {
    setPricePerUnit(text);

    const price = parseFloat(text);
    if (!isNaN(price) && price > 0) {
      if (lastEdited === "totalCost") {
        const total = parseFloat(totalCostInput);
        if (!isNaN(total) && total > 0) {
          setFuelAmount((total / price).toFixed(2));
        }
      } else {
        const qty = parseFloat(fuelAmount);
        if (!isNaN(qty) && qty > 0) {
          setTotalCostInput((qty * price).toFixed(2));
        }
      }
    }
  };

  const handleQuickAmountSelect = (amount: number) => {
    const text = amount.toString();
    setTotalCostInput(text);
    setLastEdited("totalCost");

    const price = parseFloat(pricePerUnit);
    if (!isNaN(price) && price > 0) {
      setFuelAmount((amount / price).toFixed(2));
    }
  };

  const handleApplyEvKwh = () => {
    if (evEstimatedKwh != null) {
      const qtyStr = evEstimatedKwh.toFixed(1);
      setFuelAmount(qtyStr);
      setLastEdited("fuelAmount");
      const price = parseFloat(pricePerUnit);
      if (!isNaN(price) && price > 0) {
        setTotalCostInput((evEstimatedKwh * price).toFixed(2));
      }
    }
  };

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

  // ── Receipt Photo Pickers ──
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Needed",
        "We need access to your photo library to attach the fuel receipt.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Needed",
        "Camera access is needed to photograph the receipt.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handlePickPhoto = () => {
    Alert.alert("Attach Receipt 🧾", "Choose receipt photo source:", [
      { text: "Take Photo", onPress: takePhoto },
      { text: "Choose from Gallery", onPress: pickImage },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  if (!selectedVehicle) {
    return <NoVehicleState />;
  }

  // ── Validation & Submission ──
  const handleSave = () => {
    const odoVal = parseFloat(odometer);
    let amountVal = parseFloat(fuelAmount);
    let priceVal = parseFloat(pricePerUnit);
    const costVal = parseFloat(totalCostInput);

    // Auto-calculate missing 3rd value if 2 out of 3 supplied:
    if (
      (isNaN(amountVal) || amountVal <= 0) &&
      !isNaN(costVal) &&
      costVal > 0 &&
      !isNaN(priceVal) &&
      priceVal > 0
    ) {
      amountVal = Number((costVal / priceVal).toFixed(2));
      setFuelAmount(amountVal.toString());
    } else if (
      (isNaN(priceVal) || priceVal <= 0) &&
      !isNaN(costVal) &&
      costVal > 0 &&
      !isNaN(amountVal) &&
      amountVal > 0
    ) {
      priceVal = Number((costVal / amountVal).toFixed(2));
      setPricePerUnit(priceVal.toString());
    }

    // Basic required field checks
    if (!odometer || isNaN(odoVal)) {
      setErrors(["Enter a valid odometer reading."]);
      return;
    }
    if (isNaN(amountVal) || amountVal <= 0) {
      setErrors([
        isEV
          ? `Enter energy charged in ${fuelUnitLabel} or total amount paid.`
          : `Enter fuel quantity in ${fuelUnitLabel} or total amount paid.`,
      ]);
      return;
    }
    if (isNaN(priceVal) || priceVal <= 0) {
      setErrors([
        isEV
          ? `Enter electricity rate per ${fuelUnitLabel}.`
          : `Enter price per ${fuelUnitLabel}.`,
      ]);
      return;
    }

    const dateVal = validateDateDisplay(dateDisplay);
    if (!dateVal.isValid) {
      setErrors([dateVal.error || "Enter a valid date in DD/MM/YYYY format."]);
      return;
    }
    const isoDate = displayToISO(dateDisplay);
    if (!isoDate) {
      setErrors(["Enter a valid date in DD/MM/YYYY format."]);
      return;
    }

    if (isEditMode && params.id) {
      doUpdate(params.id, odoVal, amountVal, priceVal, isoDate);
    } else {
      const lastEntry = fuelRepo.getFuelEntryBeforeDate(
        selectedVehicle.id,
        isoDate,
      );
      const prevOdo = lastEntry?.odometer ?? null;

      const validation = validateFuelEntry(
        {
          odometer: odoVal,
          fuel_amount: amountVal,
          fuel_unit: fuelUnit,
          price_per_unit: priceVal,
          date: isoDate,
          fuel_system: isHybrid ? fuelSystem : "primary",
          battery_start_percent:
            isEV && batteryStartPercent
              ? parseFloat(batteryStartPercent)
              : undefined,
          battery_end_percent:
            isEV && batteryEndPercent
              ? parseFloat(batteryEndPercent)
              : undefined,
        },
        prevOdo,
        selectedVehicle.tank_capacity,
        selectedVehicle.fuel_type as FuelType,
        selectedVehicle.secondary_tank_capacity,
      );

      if (!validation.isValid) {
        setErrors(
          validation.issues
            .filter((i) => i.severity === "error")
            .map((i) => i.message),
        );
        return;
      }

      if (hasWarningsOnly(validation)) {
        const warningMessages = validation.issues
          .map((i) => i.message)
          .join("\n");
        Alert.alert(
          "Review Warning 👀",
          warningMessages + "\n\nDo you want to save this entry anyway?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Save Anyway",
              onPress: () => doSave(odoVal, amountVal, priceVal, isoDate),
            },
          ],
        );
        return;
      }

      doSave(odoVal, amountVal, priceVal, isoDate);
    }
  };

  const doUpdate = (
    entryId: string,
    odoVal: number,
    amountVal: number,
    priceVal: number,
    entryDate: string,
  ) => {
    updateFuelEntry(
      entryId,
      {
        date: entryDate,
        odometer: odoVal,
        fuel_amount: amountVal,
        fuel_unit: fuelUnit,
        price_per_unit: priceVal,
        is_full_tank: isFullTank ? 1 : 0,
        fuel_station: fuelStation || null,
        receipt_photo_uri: photoUri || null,
        notes: notes || null,
        fuel_system: isHybrid ? fuelSystem : "primary",
        battery_start_percent:
          isEV && batteryStartPercent ? parseFloat(batteryStartPercent) : null,
        battery_end_percent:
          isEV && batteryEndPercent ? parseFloat(batteryEndPercent) : null,
      },
      selectedVehicle,
    );

    Alert.alert(
      "Entry Updated",
      isEV
        ? "Charge session updated successfully."
        : "Fuel entry updated successfully.",
      [{ text: "OK", onPress: () => router.back() }],
    );
  };

  const doSave = (
    odoVal: number,
    amountVal: number,
    priceVal: number,
    entryDate: string,
  ) => {
    const { entry, warning } = addFuelEntry(
      {
        vehicle_id: selectedVehicle.id,
        date: entryDate,
        odometer: odoVal,
        fuel_amount: amountVal,
        fuel_unit: fuelUnit,
        price_per_unit: priceVal,
        is_full_tank: isFullTank ? 1 : 0,
        fuel_station: fuelStation || undefined,
        receipt_photo_uri: photoUri || undefined,
        notes: notes || undefined,
        fuel_system: isHybrid ? fuelSystem : "primary",
        battery_start_percent:
          isEV && batteryStartPercent
            ? parseFloat(batteryStartPercent)
            : undefined,
        battery_end_percent:
          isEV && batteryEndPercent ? parseFloat(batteryEndPercent) : undefined,
      },
      selectedVehicle,
    );

    loadVehicles();

    if (entry.calculated_mileage && entry.mileage_unit) {
      const mileageText = formatMileage(
        entry.calculated_mileage,
        MILEAGE_UNIT_LABELS[entry.mileage_unit],
      );
      const warningText = warning ? `\n\n⚠️ ${warning.message}` : "";
      Alert.alert(
        isEV ? "⚡ Charge Session Logged" : "⛽ Refill Logged",
        `${isEV ? "Efficiency" : "Calculated Mileage"}: ${mileageText}${warningText}`,
        [{ text: "Done", onPress: () => router.back() }],
      );
    } else {
      router.back();
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "android" ? "height" : "padding"}
    >
      {/* ── Form Header ── */}
      <FormHeader
        title={
          isEditMode
            ? isEV
              ? "Edit Charge Session"
              : "Edit Fuel Refill"
            : isEV
              ? "Log EV Charge"
              : "Log Fuel Refill"
        }
        subtitle={`${selectedVehicle.nickname} · ${selectedVehicle.registration_number}`}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Section 1: Vehicle Context Card ── */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.vehicleRow}>
            <View
              style={[
                styles.vehicleIconWrap,
                { backgroundColor: colors.surfaceSecondary },
              ]}
            >
              <Text style={{ fontSize: 18 }}>
                {isEV ? "⚡" : isHybrid ? "🌿" : "⛽"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text
                  style={[styles.vehicleNickname, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {selectedVehicle.nickname}
                </Text>
                <View
                  style={[
                    styles.badgePill,
                    { backgroundColor: colors.surfaceSecondary },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: colors.accent }]}>
                    {selectedVehicle.fuel_type?.toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text
                style={[styles.vehicleReg, { color: colors.textSecondary }]}
              >
                {selectedVehicle.registration_number}
                {previousOdometer
                  ? ` · Last: ${previousOdometer.toLocaleString("en-IN")} km`
                  : ""}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Section 2: Bi-Fuel Dual-Tank Selector (When Applicable) ── */}
        {isHybrid && (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  Refueling Tank
                </Text>
                <View
                  style={[
                    styles.badgePill,
                    { backgroundColor: colors.primaryLight },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: colors.primary }]}>
                    BI-FUEL
                  </Text>
                </View>
              </View>
              <Text style={[styles.cardHint, { color: colors.textTertiary }]}>
                Select active tank
              </Text>
            </View>
            <Text
              style={[styles.cardSubtitle, { color: colors.textSecondary }]}
            >
              Which tank was refilled? Volumes and consumption are tracked
              independently.
            </Text>

            <View style={styles.dualTankRow}>
              {/* Primary Tank (Gas / CNG / LPG) */}
              <TouchableOpacity
                style={[
                  styles.tankCard,
                  {
                    backgroundColor:
                      fuelSystem === "primary"
                        ? colors.primaryLight
                        : colors.surfaceSecondary,
                    borderColor:
                      fuelSystem === "primary" ? colors.primary : colors.border,
                    borderWidth: fuelSystem === "primary" ? 2 : 1,
                  },
                ]}
                onPress={() => setFuelSystem("primary")}
                activeOpacity={0.7}
              >
                <View style={styles.tankCardHeader}>
                  <CngTankIcon
                    size={22}
                    color={
                      fuelSystem === "primary"
                        ? colors.primary
                        : colors.textSecondary
                    }
                  />
                  {fuelSystem === "primary" && (
                    <View
                      style={[
                        styles.activeIndicator,
                        { backgroundColor: colors.primary },
                      ]}
                    >
                      <Text style={styles.activeIndicatorText}>ACTIVE</Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.tankCardTitle,
                    {
                      color:
                        fuelSystem === "primary" ? colors.primary : colors.text,
                    },
                  ]}
                >
                  {getFuelSystemLabel(
                    selectedVehicle.fuel_type as FuelType,
                    "primary",
                  )}
                </Text>
                <Text
                  style={[styles.tankCardMeta, { color: colors.textSecondary }]}
                >
                  Unit: kg ({currencySymbol}/kg)
                </Text>
                {selectedVehicle.tank_capacity ? (
                  <Text
                    style={[styles.tankCardCap, { color: colors.textTertiary }]}
                  >
                    Cap: {selectedVehicle.tank_capacity} kg
                  </Text>
                ) : null}
              </TouchableOpacity>

              {/* Secondary Tank (Liquid / Petrol / Diesel) */}
              <TouchableOpacity
                style={[
                  styles.tankCard,
                  {
                    backgroundColor:
                      fuelSystem === "secondary"
                        ? colors.primaryLight
                        : colors.surfaceSecondary,
                    borderColor:
                      fuelSystem === "secondary"
                        ? colors.primary
                        : colors.border,
                    borderWidth: fuelSystem === "secondary" ? 2 : 1,
                  },
                ]}
                onPress={() => setFuelSystem("secondary")}
                activeOpacity={0.7}
              >
                <View style={styles.tankCardHeader}>
                  <Text style={{ fontSize: 20 }}>⛽</Text>
                  {fuelSystem === "secondary" && (
                    <View
                      style={[
                        styles.activeIndicator,
                        { backgroundColor: colors.primary },
                      ]}
                    >
                      <Text style={styles.activeIndicatorText}>ACTIVE</Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.tankCardTitle,
                    {
                      color:
                        fuelSystem === "secondary"
                          ? colors.primary
                          : colors.text,
                    },
                  ]}
                >
                  {getFuelSystemLabel(
                    selectedVehicle.fuel_type as FuelType,
                    "secondary",
                  )}
                </Text>
                <Text
                  style={[styles.tankCardMeta, { color: colors.textSecondary }]}
                >
                  Unit: Litres ({currencySymbol}/L)
                </Text>
                {selectedVehicle.secondary_tank_capacity ? (
                  <Text
                    style={[styles.tankCardCap, { color: colors.textTertiary }]}
                  >
                    Cap: {selectedVehicle.secondary_tank_capacity} L
                  </Text>
                ) : null}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Section 3: EV Battery % to kWh Calculator (When EV) ── */}
        {isEV && (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                ⚡ Battery % to kWh Calculator
              </Text>
              <Text style={[styles.cardHint, { color: colors.textTertiary }]}>
                Optional helper
              </Text>
            </View>
            <Text
              style={[styles.cardSubtitle, { color: colors.textSecondary }]}
            >
              {selectedVehicle.tank_capacity
                ? `Battery pack: ${selectedVehicle.tank_capacity} kWh. Enter start & end % to calculate units.`
                : "Enter start & end battery percentage to auto-calculate kWh."}
            </Text>

            <View style={styles.evRow}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.fieldLabel, { color: colors.textSecondary }]}
                >
                  Start %
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.surfaceSecondary,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="e.g. 20"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                  maxLength={3}
                  value={batteryStartPercent}
                  onChangeText={setBatteryStartPercent}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.fieldLabel, { color: colors.textSecondary }]}
                >
                  End %
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.surfaceSecondary,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  placeholder="e.g. 90"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                  maxLength={3}
                  value={batteryEndPercent}
                  onChangeText={setBatteryEndPercent}
                />
              </View>
            </View>

            {evEstimatedKwh != null && (
              <TouchableOpacity
                style={[
                  styles.applyKwhButton,
                  { backgroundColor: colors.primaryLight },
                ]}
                onPress={handleApplyEvKwh}
                activeOpacity={0.7}
              >
                <Text style={[styles.applyKwhText, { color: colors.primary }]}>
                  👉 Apply {evEstimatedKwh.toFixed(1)} kWh (
                  {Math.round(
                    parseFloat(batteryEndPercent) -
                      parseFloat(batteryStartPercent),
                  )}
                  % charge)
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Section 4: Odometer Reading & Date Card ── */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Odometer & Date
            </Text>
            <Text
              style={[styles.requiredBadge, { color: colors.statusCritical }]}
            >
              Required *
            </Text>
          </View>

          {/* Odometer Input */}
          <View style={{ marginTop: Spacing.sm }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text
                style={[styles.fieldLabel, { color: colors.textSecondary }]}
              >
                Current Odometer (km) *
              </Text>
              {odoDelta !== null && (
                <View
                  style={[
                    styles.deltaBadge,
                    {
                      backgroundColor:
                        odoDelta >= 0
                          ? colors.statusNormalBg
                          : colors.statusCriticalBg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.deltaBadgeText,
                      {
                        color:
                          odoDelta >= 0
                            ? colors.statusNormal
                            : colors.statusCritical,
                      },
                    ]}
                  >
                    {odoDelta >= 0
                      ? `+${odoDelta.toLocaleString("en-IN")} km travelled`
                      : `${odoDelta.toLocaleString("en-IN")} km (Lower than last)`}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.inputWithUnitWrap}>
              <TextInput
                style={[
                  styles.odometerInput,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder={
                  previousOdometer
                    ? `e.g. ${previousOdometer + 250}`
                    : "e.g. 14500"
                }
                placeholderTextColor={colors.textTertiary}
                value={odometer}
                onChangeText={setOdometer}
                keyboardType="numeric"
                autoFocus={!isEditMode && !params.odometer}
              />
              <View
                style={[styles.unitBadge, { backgroundColor: colors.surface }]}
              >
                <Text
                  style={[
                    styles.unitBadgeText,
                    { color: colors.textSecondary },
                  ]}
                >
                  KM
                </Text>
              </View>
            </View>
          </View>

          {/* Date Input */}
          <View style={{ marginTop: Spacing.md }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text
                style={[styles.fieldLabel, { color: colors.textSecondary }]}
              >
                Date (DD/MM/YYYY) *
              </Text>
              <TouchableOpacity onPress={handleSetToday} activeOpacity={0.7}>
                <Text style={[styles.todayLink, { color: colors.accent }]}>
                  Set Today
                </Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.surfaceSecondary,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="DD/MM/YYYY"
              placeholderTextColor={colors.textTertiary}
              value={dateDisplay}
              onChangeText={handleDateChange}
              keyboardType="number-pad"
              maxLength={10}
            />
          </View>
        </View>

        {/* ── Section 5: Fuel & Cost 2-Way Calculator (Hero Card) ── */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {isEV ? "⚡ Electricity & Cost" : "⛽ Quantity & Cost"}
            </Text>
            <View
              style={[
                styles.badgePill,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <Text style={[styles.badgeText, { color: colors.primary }]}>
                2-WAY AUTO CALC ⇄
              </Text>
            </View>
          </View>
          <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
            {isEV
              ? "Enter either Amount Paid or Energy (kWh) — the other updates instantly."
              : "Enter either Amount Paid or Volume — the other updates instantly."}
          </Text>

          {/* Rate per Unit */}
          <View style={{ marginTop: Spacing.sm }}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              {isEV
                ? `Electricity Rate (${currencySymbol}/kWh) *`
                : `Price per ${fuelUnitLabel} (${currencySymbol}/${fuelUnitLabel}) *`}
            </Text>
            <View style={styles.inputWithUnitWrap}>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder={`e.g. ${isEV ? "8.5" : fuelUnit === FuelUnit.KG ? "85" : "102"}`}
                placeholderTextColor={colors.textTertiary}
                value={pricePerUnit}
                onChangeText={handlePricePerUnitChange}
                keyboardType="decimal-pad"
              />
              <View
                style={[styles.unitBadge, { backgroundColor: colors.surface }]}
              >
                <Text
                  style={[
                    styles.unitBadgeText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {currencySymbol}/{fuelUnitLabel}
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Amount Chips */}
          <View style={{ marginTop: Spacing.md }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
              }}
            >
              <Text
                style={[
                  styles.fieldLabel,
                  { color: colors.textSecondary, marginBottom: 0 },
                ]}
              >
                Total Amount Paid ({currencySymbol})
              </Text>
              <Text style={[styles.cardHint, { color: colors.textTertiary }]}>
                Quick presets
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickAmountsRow}
              keyboardShouldPersistTaps="handled"
            >
              {QUICK_AMOUNTS.map((amt) => {
                const isSelected = totalCostInput === amt.toString();
                return (
                  <TouchableOpacity
                    key={amt}
                    style={[
                      styles.quickAmountChip,
                      {
                        backgroundColor: isSelected
                          ? colors.accent
                          : colors.surfaceSecondary,
                        borderColor: isSelected ? colors.accent : colors.border,
                      },
                    ]}
                    onPress={() => handleQuickAmountSelect(amt)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.quickAmountText,
                        {
                          color: isSelected ? "#FFFFFF" : colors.text,
                          fontWeight: isSelected ? "700" : "600",
                        },
                      ]}
                    >
                      {currencySymbol}
                      {amt.toLocaleString("en-IN")}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={[styles.inputWithUnitWrap, { marginTop: 8 }]}>
              <TextInput
                style={[
                  styles.odometerInput,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="e.g. 1000"
                placeholderTextColor={colors.textTertiary}
                value={totalCostInput}
                onChangeText={handleTotalCostChange}
                keyboardType="decimal-pad"
              />
              <View
                style={[styles.unitBadge, { backgroundColor: colors.surface }]}
              >
                <Text
                  style={[
                    styles.unitBadgeText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {currencySymbol}
                </Text>
              </View>
            </View>
          </View>

          {/* Volume / Energy Input */}
          <View style={{ marginTop: Spacing.md }}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              {isEV
                ? `Energy Charged (${fuelUnitLabel}) *`
                : `Fuel Quantity (${fuelUnitLabel}) *`}
            </Text>
            <View style={styles.inputWithUnitWrap}>
              <TextInput
                style={[
                  styles.odometerInput,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder={`e.g. ${isEV ? "25" : fuelUnit === FuelUnit.KG ? "8.5" : "30"}`}
                placeholderTextColor={colors.textTertiary}
                value={fuelAmount}
                onChangeText={handleFuelAmountChange}
                keyboardType="decimal-pad"
              />
              <View
                style={[styles.unitBadge, { backgroundColor: colors.surface }]}
              >
                <Text
                  style={[
                    styles.unitBadgeText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {fuelUnitLabel}
                </Text>
              </View>
            </View>
          </View>

          {/* Live Dynamic Calculation Hint */}
          {computedSummary && (
            <View
              style={[
                styles.calcSummaryBox,
                {
                  backgroundColor: colors.primaryLight,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.calcSummaryText, { color: colors.primary }]}>
                {computedSummary}
              </Text>
            </View>
          )}
        </View>

        {/* ── Section 6: Full Tank Toggle (Non-EV) ── */}
        {!isEV && (
          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.toggleRow}>
              <View style={{ flex: 1, marginRight: Spacing.md }}>
                <Text style={[styles.toggleTitle, { color: colors.text }]}>
                  Full Tank Fill?
                </Text>
                <Text
                  style={[
                    styles.toggleSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  Filled to auto-cut/brim? Enables exact tank-to-tank mileage
                  calculation. Partial fills will provide an estimated baseline.
                </Text>
              </View>
              <Switch
                value={isFullTank}
                onValueChange={setIsFullTank}
                trackColor={{ false: colors.border, true: colors.primaryLight }}
                thumbColor={isFullTank ? colors.accent : colors.textTertiary}
              />
            </View>
          </View>
        )}

        {/* ── Section 7: Station & Receipt Card ── */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Location & Receipt
          </Text>
          <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
            Optional reference details for this transaction.
          </Text>

          {/* Station Name */}
          <View style={{ marginTop: Spacing.sm }}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              {isEV ? "Charging Station / Location" : "Fuel Station"}
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: colors.surfaceSecondary,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder={
                isEV
                  ? "e.g. Home AC, Jio-bp, Tata Power EZ"
                  : "e.g. Indian Oil, Bandra"
              }
              placeholderTextColor={colors.textTertiary}
              value={fuelStation}
              onChangeText={setFuelStation}
            />

            {stationSuggestions.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.suggestionRow}
              >
                {stationSuggestions.map((station) => (
                  <TouchableOpacity
                    key={station}
                    activeOpacity={0.7}
                    onPress={() => setFuelStation(station)}
                    style={[
                      styles.suggestionChip,
                      {
                        backgroundColor: colors.surfaceSecondary,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.suggestionChipText,
                        { color: colors.text },
                      ]}
                    >
                      {isEV ? "⚡" : "⛽"} {station}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Receipt Photo */}
          <View style={{ marginTop: Spacing.md }}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              Receipt Photo
            </Text>
            {photoUri ? (
              <View
                style={[styles.photoContainer, { borderColor: colors.border }]}
              >
                <Image
                  source={{ uri: photoUri }}
                  style={styles.photoPreview}
                  resizeMode="cover"
                />
                <View style={styles.photoActionsRow}>
                  <TouchableOpacity
                    style={[
                      styles.photoActionBtn,
                      { backgroundColor: colors.primary },
                    ]}
                    onPress={handlePickPhoto}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.photoActionBtnText}>Change Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.photoActionBtn,
                      { backgroundColor: colors.danger },
                    ]}
                    onPress={() => setPhotoUri(null)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.photoActionBtnText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.photoUploadBtn,
                  {
                    borderColor: colors.accent,
                    backgroundColor: colors.surfaceSecondary,
                  },
                ]}
                onPress={handlePickPhoto}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 20 }}>🧾</Text>
                <Text
                  style={[styles.photoUploadText, { color: colors.accent }]}
                >
                  Attach Bill / Receipt Photo
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Notes */}
          <View style={{ marginTop: Spacing.md }}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
              Notes
            </Text>
            <TextInput
              style={[
                styles.notesInput,
                {
                  backgroundColor: colors.surfaceSecondary,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Any notes (e.g. tyre pressure checked, highway trip fill)..."
              placeholderTextColor={colors.textTertiary}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        {/* ── Validation Error Banner ── */}
        {errors.length > 0 && (
          <View
            style={[
              styles.errorCard,
              {
                backgroundColor: colors.statusCriticalBg,
                borderColor: colors.statusCritical,
              },
            ]}
          >
            {errors.map((err, idx) => (
              <Text
                key={idx}
                style={[styles.errorText, { color: colors.statusCritical }]}
              >
                • {err}
              </Text>
            ))}
          </View>
        )}

        {/* Bottom spacing for floating button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Fixed Bottom Bar Action ── */}
      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, Spacing.md),
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: "#3983C7" }]}
          onPress={handleSave}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={
            isEditMode ? "Update Fuel Entry" : "Save Fuel Entry"
          }
        >
          <Text style={styles.saveButtonText}>
            {isEditMode
              ? isEV
                ? "Update Charge ⚡"
                : "Update Fuel Entry ✏️"
              : isEV
                ? "Save Charge ⚡"
                : "Save Fuel Entry ⛽"}
          </Text>
        </TouchableOpacity>
      </View>
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
    padding: Spacing.md,
    gap: Spacing.md,
  },
  card: {
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    padding: Spacing.md,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: Spacing.xs,
    lineHeight: 16,
  },
  cardHint: {
    fontSize: 11,
    fontWeight: "500",
  },
  requiredBadge: {
    fontSize: 11,
    fontWeight: "600",
  },
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  vehicleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  vehicleIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Sizing.radiusMd,
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleNickname: {
    fontSize: 15,
    fontWeight: "700",
  },
  vehicleReg: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  textInput: {
    height: 48,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
  },
  odometerInput: {
    height: 52,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 20,
    fontWeight: "700",
  },
  notesInput: {
    height: 76,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    fontSize: 14,
    textAlignVertical: "top",
  },
  inputWithUnitWrap: {
    position: "relative",
    justifyContent: "center",
  },
  unitBadge: {
    position: "absolute",
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    borderColor: "transparent",
  },
  unitBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  deltaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Sizing.radiusSm,
  },
  deltaBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  todayLink: {
    fontSize: 12,
    fontWeight: "600",
  },
  quickAmountsRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    paddingVertical: 4,
  },
  quickAmountChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  quickAmountText: {
    fontSize: 12,
  },
  calcSummaryBox: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    alignItems: "center",
  },
  calcSummaryText: {
    fontSize: 13,
    fontWeight: "700",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  toggleSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  dualTankRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  tankCard: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: Sizing.radiusMd,
  },
  tankCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  activeIndicator: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  activeIndicatorText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },
  tankCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },
  tankCardMeta: {
    fontSize: 11,
    marginTop: 1,
  },
  tankCardCap: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: "600",
  },
  evRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  applyKwhButton: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Sizing.radiusSm,
    alignItems: "center",
  },
  applyKwhText: {
    fontSize: 12,
    fontWeight: "700",
  },
  suggestionRow: {
    gap: Spacing.xs,
    paddingTop: Spacing.xs,
  },
  suggestionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
  },
  suggestionChipText: {
    fontSize: 12,
    fontWeight: "500",
  },
  photoUploadBtn: {
    borderRadius: Sizing.radiusMd,
    borderWidth: 1.5,
    borderStyle: "dashed",
    paddingVertical: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: Spacing.sm,
  },
  photoUploadText: {
    fontSize: 13,
    fontWeight: "600",
  },
  photoContainer: {
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    overflow: "hidden",
    padding: Spacing.xs,
  },
  photoPreview: {
    width: "100%",
    height: 140,
    borderRadius: Sizing.radiusSm,
  },
  photoActionsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  photoActionBtn: {
    flex: 1,
    height: 34,
    borderRadius: Sizing.radiusSm,
    alignItems: "center",
    justifyContent: "center",
  },
  photoActionBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  errorCard: {
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    padding: Spacing.md,
    gap: 4,
  },
  errorText: {
    fontSize: 12,
    fontWeight: "600",
  },
  bottomBar: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  saveButton: {
    height: 52,
    borderRadius: Sizing.radiusMd,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3983C7",
    shadowColor: "#3983C7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
});
