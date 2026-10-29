/**
 * Add / Edit Fuel Entry — Modal Form
 *
 * THE CORE USER FLOW. This is the 3-tap dream from the charter:
 *   Tap [+ Add Fuel] → Fill 3 fields → Save → See mileage
 *
 * EDIT MODE: If opened with ?id=<entryId>, loads existing entry for editing.
 *
 * REQUIRED FIELDS (minimum viable entry):
 *   1. Odometer reading
 *   2. Fuel amount (litres/kg/kWh)
 *   3. Price per unit
 *
 * AUTO-FILLED:
 *   - Date → today (editable)
 *   - Fuel unit → from vehicle's fuel_type
 *   - Full tank → yes (toggle)
 *   - Odometer → smart default from last entry
 *
 * VALIDATION:
 *   - Uses validationEngine for error/warning checks
 *   - Warnings show a confirmation dialog, don't block save
 *   - Errors block save entirely
 */

import { CngTankIcon } from '@/components/CngTankIcon';
import { FormHeader } from '@/components/FormHeader';
import { NoVehicleState } from '@/components/NoVehicleState';
import { VehicleContextHeader } from '@/components/VehicleContextHeader';
import {
  FUEL_TYPE_TO_DEFAULT_UNIT,
  FuelType,
  FuelUnit,
  MILEAGE_UNIT_LABELS,
  getFuelSystemLabel,
  getFuelUnitForSystem,
  isHybridFuel,
} from '@/constants/fuelTypes';
import { Sizing, Spacing, Typography } from '@/constants/theme';
import * as fuelRepo from '@/database/repositories/fuelRepo';
import { hasWarningsOnly, validateFuelEntry } from '@/engine/validationEngine';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useFuelStore } from '@/stores/fuelStore';
import { getCurrencySymbol } from '@/stores/preferencesStore';
import { useVehicleStore } from '@/stores/vehicleStore';
import { todayISO } from '@/utils/date';
import { displayToISO, formatDateInput, isoToDisplay, validateDateDisplay } from '@/utils/dateInput';
import { formatMileage } from '@/utils/format';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const QUICK_AMOUNTS = [200, 500, 1000, 1500, 2000, 2500] as const;

export default function AddFuelScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; vehicleId?: string; odometer?: string }>();

  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);
  const selectVehicle = useVehicleStore((s) => s.selectVehicle);
  const loadVehicles = useVehicleStore((s) => s.loadVehicles);
  const addFuelEntry = useFuelStore((s) => s.addFuelEntry);
  const updateFuelEntry = useFuelStore((s) => s.updateFuelEntry);

  useEffect(() => {
    if (params.vehicleId && params.vehicleId !== selectedVehicle?.id) {
      selectVehicle(params.vehicleId);
    }
  }, [params.vehicleId]);

  useEffect(() => {
    if (!params.id && params.odometer && !odometer) {
      setOdometer(String(params.odometer));
    }
  }, [params.id, params.odometer]);

  const isEditMode = !!params.id;

  // Form state
  const [date, setDate] = useState(todayISO());
  const [dateDisplay, setDateDisplay] = useState('');
  const [odometer, setOdometer] = useState(!params.id && params.odometer ? String(params.odometer) : '');
  const [fuelAmount, setFuelAmount] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [totalCostInput, setTotalCostInput] = useState('');
  const [lastEdited, setLastEdited] = useState<'fuelAmount' | 'totalCost'>('fuelAmount');
  const [fuelStation, setFuelStation] = useState('');
  const [isFullTank, setIsFullTank] = useState(true);
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [fuelSystem, setFuelSystem] = useState<'primary' | 'secondary'>('primary');
  const [batteryStartPercent, setBatteryStartPercent] = useState('');
  const [batteryEndPercent, setBatteryEndPercent] = useState('');

  // Previously used stations (loaded once per form open)
  const knownStations = useMemo(() => fuelRepo.getFrequentFuelStations(), []);
  const stationSuggestions = useMemo(() => {
    const query = fuelStation.trim().toLowerCase();
    return knownStations
      .filter((s) => s.toLowerCase() !== query && (!query || s.toLowerCase().includes(query)))
      .slice(0, 5);
  }, [knownStations, fuelStation]);

  // Initialize date display
  useEffect(() => {
    setDateDisplay(isoToDisplay(date));
  }, []);

  // Load existing entry for edit mode
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
        setLastEdited('fuelAmount');
        setFuelStation(existing.fuel_station || '');
        setIsFullTank(existing.is_full_tank === 1);
        setNotes(existing.notes || '');
        setPhotoUri(existing.receipt_photo_uri || null);
        if (existing.fuel_system === 'secondary' || existing.fuel_system === 'primary') {
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

  // Smart pre-fill for new entry: remember previous price per unit & fuel station
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
  }, [isEditMode, selectedVehicle?.id]);

  // Pre-fill odometer if passed from post-GPS trip completion redirect
  useEffect(() => {
    if (!isEditMode && params.odometer) {
      setOdometer(String(params.odometer));
    }
  }, [isEditMode, params.odometer]);

  // ── Derived fuel & EV properties (Declared before early return to obey Rules of Hooks) ──
  const isHybrid = selectedVehicle ? isHybridFuel(selectedVehicle.fuel_type as FuelType) : false;
  const isEV = selectedVehicle ? selectedVehicle.fuel_type === FuelType.ELECTRIC : false;
  const fuelUnit = selectedVehicle
    ? (isHybrid
        ? getFuelUnitForSystem(selectedVehicle.fuel_type as FuelType, fuelSystem)
        : (FUEL_TYPE_TO_DEFAULT_UNIT[selectedVehicle.fuel_type as FuelType] ?? FuelUnit.LITRES))
    : FuelUnit.LITRES;
  const fuelUnitLabel = fuelUnit === FuelUnit.LITRES ? 'L' : fuelUnit === FuelUnit.KG ? 'kg' : 'kWh';
  const currencySymbol = getCurrencySymbol();

  const evEstimatedKwh = useMemo(() => {
    if (!isEV || !selectedVehicle) return null;
    const startP = parseFloat(batteryStartPercent);
    const endP = parseFloat(batteryEndPercent);
    const capacity = selectedVehicle.tank_capacity;
    if (!isNaN(startP) && !isNaN(endP) && endP > startP && capacity && capacity > 0) {
      return ((endP - startP) / 100) * capacity;
    }
    return null;
  }, [isEV, batteryStartPercent, batteryEndPercent, selectedVehicle?.tank_capacity]);

  const computedSummary = useMemo(() => {
    const qty = parseFloat(fuelAmount);
    const price = parseFloat(pricePerUnit);
    const total = parseFloat(totalCostInput);

    if (!isNaN(qty) && qty > 0 && !isNaN(price) && price > 0) {
      const calcTotal = (qty * price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `✓ ${qty} ${fuelUnitLabel} × ${currencySymbol}${price.toFixed(2)} = ${currencySymbol}${calcTotal}`;
    }
    if (!isNaN(total) && total > 0 && !isNaN(price) && price > 0) {
      const calcQty = (total / price).toFixed(2);
      return `✓ ${currencySymbol}${total} ÷ ${currencySymbol}${price.toFixed(2)} = ${calcQty} ${fuelUnitLabel}`;
    }
    return null;
  }, [fuelAmount, pricePerUnit, totalCostInput, fuelUnitLabel, currencySymbol]);

  // ── 2-Way Calculation Handlers ──
  const handleFuelAmountChange = (text: string) => {
    setFuelAmount(text);
    setLastEdited('fuelAmount');

    const qty = parseFloat(text);
    const price = parseFloat(pricePerUnit);
    if (!isNaN(qty) && qty > 0 && !isNaN(price) && price > 0) {
      setTotalCostInput((qty * price).toFixed(2));
    } else if (!text) {
      setTotalCostInput('');
    }
  };

  const handleTotalCostChange = (text: string) => {
    setTotalCostInput(text);
    setLastEdited('totalCost');

    const total = parseFloat(text);
    const price = parseFloat(pricePerUnit);
    if (!isNaN(total) && total > 0 && !isNaN(price) && price > 0) {
      setFuelAmount((total / price).toFixed(2));
    } else if (!text) {
      setFuelAmount('');
    }
  };

  const handlePricePerUnitChange = (text: string) => {
    setPricePerUnit(text);

    const price = parseFloat(text);
    if (!isNaN(price) && price > 0) {
      if (lastEdited === 'totalCost') {
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
    setLastEdited('totalCost');

    const price = parseFloat(pricePerUnit);
    if (!isNaN(price) && price > 0) {
      setFuelAmount((amount / price).toFixed(2));
    }
  };

  const handleApplyEvKwh = () => {
    if (evEstimatedKwh != null) {
      const qtyStr = evEstimatedKwh.toFixed(1);
      setFuelAmount(qtyStr);
      setLastEdited('fuelAmount');
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

  // ── Photo Picker ──
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('📸 Hold up!', 'We need access to your photo library to grab that receipt pic. Allow it in settings — promise we\'re only here for the receipt! 🧾');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('📷 Cheese! (Almost)', 'Camera access is needed to snap that receipt. Allow it in settings and we\'ll be ready to shoot! 📸');
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
    Alert.alert('Attach Receipt 🧾', 'How do you want to add it?', [
      { text: 'Camera', onPress: takePhoto },
      { text: 'Gallery', onPress: pickImage },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  if (!selectedVehicle) {
    return <NoVehicleState />;
  }

  const handleSave = () => {
    const odoVal = parseFloat(odometer);
    let amountVal = parseFloat(fuelAmount);
    let priceVal = parseFloat(pricePerUnit);
    const costVal = parseFloat(totalCostInput);

    // Auto-calculate missing value if 2 out of 3 fields are supplied:
    if ((isNaN(amountVal) || amountVal <= 0) && !isNaN(costVal) && costVal > 0 && !isNaN(priceVal) && priceVal > 0) {
      amountVal = Number((costVal / priceVal).toFixed(2));
      setFuelAmount(amountVal.toString());
    } else if ((isNaN(priceVal) || priceVal <= 0) && !isNaN(costVal) && costVal > 0 && !isNaN(amountVal) && amountVal > 0) {
      priceVal = Number((costVal / amountVal).toFixed(2));
      setPricePerUnit(priceVal.toString());
    }

    // Basic field presence checks
    if (!odometer || isNaN(odoVal)) {
      setErrors(['Enter a valid odometer reading.']);
      return;
    }
    if (isNaN(amountVal) || amountVal <= 0) {
      setErrors([isEV ? `Enter the energy charged in ${fuelUnitLabel} or total amount paid.` : `Enter the fuel quantity in ${fuelUnitLabel} or total amount paid.`]);
      return;
    }
    if (isNaN(priceVal) || priceVal <= 0) {
      setErrors([isEV ? `Enter the electricity rate per ${fuelUnitLabel}.` : `Enter the price per ${fuelUnitLabel}.`]);
      return;
    }

    const dateVal = validateDateDisplay(dateDisplay);
    if (!dateVal.isValid) {
      setErrors([dateVal.error || 'Enter a valid date in DD/MM/YYYY format.']);
      return;
    }
    const isoDate = displayToISO(dateDisplay);
    if (!isoDate) {
      setErrors(['Enter a valid date in DD/MM/YYYY format.']);
      return;
    }

    if (isEditMode && params.id) {
      doUpdate(params.id, odoVal, amountVal, priceVal, isoDate);
    } else {
      // Get the previous entry BEFORE this date for date-aware validation.
      // This prevents false "odometer must be higher" errors when logging past entries.
      const lastEntry = fuelRepo.getFuelEntryBeforeDate(selectedVehicle.id, isoDate);
      const previousOdometer = lastEntry?.odometer ?? null;

      // Run validation engine
      const validation = validateFuelEntry(
        {
          odometer: odoVal,
          fuel_amount: amountVal,
          fuel_unit: fuelUnit,
          price_per_unit: priceVal,
          date: isoDate,
          fuel_system: isHybrid ? fuelSystem : 'primary',
          battery_start_percent: isEV && batteryStartPercent ? parseFloat(batteryStartPercent) : undefined,
          battery_end_percent: isEV && batteryEndPercent ? parseFloat(batteryEndPercent) : undefined,
        },
        previousOdometer,
        selectedVehicle.tank_capacity,
        selectedVehicle.fuel_type as FuelType,
        selectedVehicle.secondary_tank_capacity
      );

      if (!validation.isValid) {
        setErrors(validation.issues.filter((i) => i.severity === 'error').map((i) => i.message));
        return;
      }

      // If warnings exist, show confirmation
      if (hasWarningsOnly(validation)) {
        const warningMessages = validation.issues.map((i) => i.message).join('\n');
        Alert.alert(
          'Heads Up! 👀',
          warningMessages + '\n\nStill want to save it?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Save Anyway', onPress: () => doSave(odoVal, amountVal, priceVal, isoDate) },
          ]
        );
        return;
      }

      doSave(odoVal, amountVal, priceVal, isoDate);
    }
  };

  const doUpdate = (entryId: string, odoVal: number, amountVal: number, priceVal: number, entryDate: string) => {
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
        fuel_system: isHybrid ? fuelSystem : 'primary',
        battery_start_percent: isEV && batteryStartPercent ? parseFloat(batteryStartPercent) : null,
        battery_end_percent: isEV && batteryEndPercent ? parseFloat(batteryEndPercent) : null,
      },
      selectedVehicle
    );

    Alert.alert(
      '✅ Entry Updated!',
      isEV
        ? 'Charge session updated. Your efficiency is recalculating in the background... 🔄'
        : 'Fuel entry updated. Your mileage is recalculating in the background... 🔄',
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  const doSave = (odoVal: number, amountVal: number, priceVal: number, entryDate: string) => {
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
        fuel_system: isHybrid ? fuelSystem : 'primary',
        battery_start_percent: isEV && batteryStartPercent ? parseFloat(batteryStartPercent) : undefined,
        battery_end_percent: isEV && batteryEndPercent ? parseFloat(batteryEndPercent) : undefined,
      },
      selectedVehicle
    );

    // Refresh vehicle store to get updated odometer
    loadVehicles();

    // Show mileage result if calculated
    if (entry.calculated_mileage && entry.mileage_unit) {
      const mileageText = formatMileage(
        entry.calculated_mileage,
        MILEAGE_UNIT_LABELS[entry.mileage_unit]
      );
      const warningText = warning ? `\n\n⚠️ ${warning.message}` : '';
      Alert.alert(
        isEV ? '⚡ Charged Up!' : '⛽ Fuelled Up!',
        `${isEV ? 'Efficiency' : 'Mileage'}: ${mileageText}${warningText}`,
        [{ text: isEV ? "Let's roll! ⚡" : "Let's ride! 🚗", onPress: () => router.back() }]
      );
    } else {
      router.back();
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'android' ? 'height' : 'padding'}
    >
      {/* ── Header ── */}
      <FormHeader title={isEditMode ? (isEV ? 'Edit Charge Session ⚡' : 'Edit Fuel') : (isEV ? 'Add Charge Session ⚡' : 'Add Fuel')} />

      {/* ── Vehicle Context ── */}
      <VehicleContextHeader label="Recording for" />

      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        {/* ── Bi-Fuel Dual-Tank Selector ── */}
        {isHybrid && (
          <View style={[styles.dualTankContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.dualTankHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[Typography.body, { fontWeight: '700', color: colors.text }]}>
                  Refueling Tank
                </Text>
                <View style={[styles.biFuelPill, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[Typography.caption, { color: colors.primary, fontWeight: '700', fontSize: 10 }]}>
                    Bi-Fuel
                  </Text>
                </View>
              </View>
              <Text style={[Typography.caption, { color: colors.textTertiary }]}>Select one</Text>
            </View>
            <Text style={[Typography.caption, { color: colors.textSecondary, marginBottom: Spacing.sm }]}>
              Which tank did you refill? Fuel volume and mileage track independently.
            </Text>

            <View style={styles.dualTankRow}>
              {/* Primary Tank (Gas / CNG / LPG) */}
              <TouchableOpacity
                style={[
                  styles.tankOptionCard,
                  {
                    backgroundColor: fuelSystem === 'primary' ? colors.primaryLight + '35' : colors.background,
                    borderColor: fuelSystem === 'primary' ? colors.primary : colors.border,
                    borderWidth: fuelSystem === 'primary' ? 2 : 1,
                  },
                ]}
                onPress={() => setFuelSystem('primary')}
                activeOpacity={0.7}
              >
                <View style={styles.tankOptionTop}>
                  <CngTankIcon size={24} color={fuelSystem === 'primary' ? colors.primary : '#64748B'} />
                  {fuelSystem === 'primary' ? (
                    <View style={[styles.activeIndicator, { backgroundColor: colors.primary }]}>
                      <Text style={styles.activeIndicatorText}>ACTIVE</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[Typography.bodySmall, { fontWeight: '700', color: fuelSystem === 'primary' ? colors.primary : colors.text, marginTop: 4 }]}>
                  {getFuelSystemLabel(selectedVehicle.fuel_type as FuelType, 'primary')}
                </Text>
                <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
                  Unit: kg (₹/kg)
                </Text>
                {selectedVehicle.tank_capacity ? (
                  <Text style={[Typography.caption, { color: colors.textSecondary, fontWeight: '600', marginTop: 3 }]}>
                    Cap: {selectedVehicle.tank_capacity} kg
                  </Text>
                ) : null}
              </TouchableOpacity>

              {/* Secondary Tank (Liquid / Petrol / Diesel) */}
              <TouchableOpacity
                style={[
                  styles.tankOptionCard,
                  {
                    backgroundColor: fuelSystem === 'secondary' ? '#FEF3C750' : colors.background,
                    borderColor: fuelSystem === 'secondary' ? '#B45309' : colors.border,
                    borderWidth: fuelSystem === 'secondary' ? 2 : 1,
                  },
                ]}
                onPress={() => setFuelSystem('secondary')}
                activeOpacity={0.7}
              >
                <View style={styles.tankOptionTop}>
                  <Text style={{ fontSize: 20 }}>⛽</Text>
                  {fuelSystem === 'secondary' ? (
                    <View style={[styles.activeIndicator, { backgroundColor: '#B45309' }]}>
                      <Text style={styles.activeIndicatorText}>ACTIVE</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[Typography.bodySmall, { fontWeight: '700', color: fuelSystem === 'secondary' ? '#B45309' : colors.text, marginTop: 4 }]}>
                  {getFuelSystemLabel(selectedVehicle.fuel_type as FuelType, 'secondary')}
                </Text>
                <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
                  Unit: Litres (₹/L)
                </Text>
                {selectedVehicle.secondary_tank_capacity ? (
                  <Text style={[Typography.caption, { color: colors.textSecondary, fontWeight: '600', marginTop: 3 }]}>
                    Cap: {selectedVehicle.secondary_tank_capacity} L
                  </Text>
                ) : null}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── EV Battery Helper ── */}
        {isEV && (
          <View style={[styles.evCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.evCardHeader}>
              <Text style={[Typography.body, { fontWeight: '700', color: colors.text }]}>
                ⚡ Battery % to kWh Calculator
              </Text>
              <Text style={[Typography.caption, { color: colors.textTertiary }]}>Optional</Text>
            </View>
            <Text style={[Typography.caption, { color: colors.textSecondary, marginBottom: Spacing.sm }]}>
              {selectedVehicle.tank_capacity
                ? `Battery capacity: ${selectedVehicle.tank_capacity} kWh. Enter start & end % to calculate units.`
                : 'Enter start & end battery percentage to auto-calculate kWh.'}
            </Text>
            <View style={styles.evInputsRow}>
              <View style={{ flex: 1 }}>
                <Text style={[Typography.caption, { color: colors.textTertiary }]}>Start %</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border, marginTop: 4 }]}
                  placeholder="e.g., 20"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="numeric"
                  maxLength={3}
                  value={batteryStartPercent}
                  onChangeText={setBatteryStartPercent}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[Typography.caption, { color: colors.textTertiary }]}>End %</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border, marginTop: 4 }]}
                  placeholder="e.g., 90"
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
                style={[styles.applyKwhButton, { backgroundColor: colors.primaryLight }]}
                onPress={handleApplyEvKwh}
                activeOpacity={0.7}
              >
                <Text style={[Typography.caption, { color: colors.primary, fontWeight: '700' }]}>
                  👉 Apply {evEstimatedKwh.toFixed(1)} kWh ({Math.round(parseFloat(batteryEndPercent) - parseFloat(batteryStartPercent))}% charge)
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Date ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Date (DD/MM/YYYY)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="DD/MM/YYYY"
          placeholderTextColor={colors.textTertiary}
          value={dateDisplay}
          onChangeText={handleDateChange}
          keyboardType="number-pad"
          maxLength={10}
        />

        {/* ── Odometer ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Odometer (km) *</Text>
        <TextInput
          style={[styles.input, styles.inputLarge, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g., 12500"
          placeholderTextColor={colors.textTertiary}
          value={odometer}
          onChangeText={setOdometer}
          keyboardType="numeric"
          autoFocus={!isEditMode && !params.odometer}
        />

        {/* ── 2-Way Fuel & Cost Calculator Card ── */}
        <View style={[styles.calcContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.calcHeader}>
            <Text style={[Typography.body, { fontWeight: '700', color: colors.text }]}>
              {isEV ? '⚡ Charge & Cost Calculator' : '⛽ Fuel & Cost Calculator'}
            </Text>
            <View style={[styles.autoCalcBadge, { backgroundColor: colors.primaryLight }]}>
              <Text style={[Typography.caption, { color: colors.primary, fontWeight: '700', fontSize: 11 }]}>
                2-Way Auto Calc ⇄
              </Text>
            </View>
          </View>
          <Text style={[Typography.caption, { color: colors.textSecondary, marginBottom: Spacing.md }]}>
            {isEV
              ? 'Enter either Amount Paid or Energy (kWh) — the other calculates instantly.'
              : 'Enter either Amount Paid or Quantity — the other calculates instantly.'}
          </Text>

          {/* Price Per Unit (Rate) */}
          <Text style={[styles.inputLabelSmall, { color: colors.textSecondary }]}>
            {isEV ? `Electricity Rate per kWh (${currencySymbol}) *` : `Price per ${fuelUnitLabel} (${currencySymbol}) *`}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
            placeholder={`e.g., ${isEV ? '8' : fuelUnit === FuelUnit.KG ? '85' : '105'}`}
            placeholderTextColor={colors.textTertiary}
            value={pricePerUnit}
            onChangeText={handlePricePerUnitChange}
            keyboardType="decimal-pad"
          />
          {isEV && (
            <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: 4 }]}>
              💡 In India: Home AC ~{currencySymbol}4–{currencySymbol}9/unit · Public AC ~{currencySymbol}10–{currencySymbol}16/unit · Fast DC ~{currencySymbol}18–{currencySymbol}25/unit
            </Text>
          )}

          {/* Quick Amount Chips & Total Amount Paid */}
          <View style={{ marginTop: Spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={[styles.inputLabelSmall, { color: colors.textSecondary, marginBottom: 0 }]}>
                Total Amount Paid ({currencySymbol})
              </Text>
              <Text style={[Typography.caption, { color: colors.textTertiary }]}>
                Preset or custom
              </Text>
            </View>

            {/* Quick Amount Buttons */}
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
                        backgroundColor: isSelected ? colors.primary : colors.background,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => handleQuickAmountSelect(amt)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        Typography.caption,
                        {
                          color: isSelected ? colors.textOnPrimary : colors.text,
                          fontWeight: isSelected ? '700' : '600',
                        },
                      ]}
                    >
                      {currencySymbol}{amt.toLocaleString('en-IN')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TextInput
              style={[
                styles.input,
                styles.inputLarge,
                { backgroundColor: colors.background, color: colors.text, borderColor: colors.border, marginTop: 8 },
              ]}
              placeholder="e.g., 1000"
              placeholderTextColor={colors.textTertiary}
              value={totalCostInput}
              onChangeText={handleTotalCostChange}
              keyboardType="decimal-pad"
            />
          </View>

          {/* Fuel Quantity / Energy Charged */}
          <View style={{ marginTop: Spacing.md }}>
            <Text style={[styles.inputLabelSmall, { color: colors.textSecondary }]}>
              {isEV ? `Energy Charged (${fuelUnitLabel}) *` : `Fuel Quantity (${fuelUnitLabel}) *`}
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.inputLarge,
                { backgroundColor: colors.background, color: colors.text, borderColor: colors.border },
              ]}
              placeholder={`e.g., ${isEV ? '25' : fuelUnit === FuelUnit.KG ? '8.5' : '30'}`}
              placeholderTextColor={colors.textTertiary}
              value={fuelAmount}
              onChangeText={handleFuelAmountChange}
              keyboardType="decimal-pad"
            />
          </View>

          {/* Live Dynamic Calculation Hint */}
          {computedSummary ? (
            <View style={[styles.calcSummaryBox, { backgroundColor: colors.primaryLight + '35', borderColor: colors.primary + '55' }]}>
              <Text style={[Typography.caption, { color: colors.primary, fontWeight: '700' }]}>
                {computedSummary}
              </Text>
            </View>
          ) : null}
        </View>

        {/* ── Full Tank Toggle ── */}
        {!isEV && (
          <View style={[styles.toggleRow, { borderColor: colors.border }]}>
            <View style={{ flex: 1, marginRight: Spacing.lg }}>
              <Text style={[Typography.body, { color: colors.text }]}>Full Tank Fill?</Text>
              <Text style={[Typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                Turn ON if you filled the tank to the brim. Gives accurate mileage.{`\n`}Partial fills show an estimated (~) mileage.
              </Text>
            </View>
            <Switch
              value={isFullTank}
              onValueChange={setIsFullTank}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={isFullTank ? colors.primary : colors.textTertiary}
            />
          </View>
        )}

        {/* ── Optional Fields ── */}
        <Text style={[styles.label, { color: colors.textSecondary, marginTop: Spacing.xxl }]}>
          {isEV ? 'Charging Location / Network (optional)' : 'Fuel Station (optional)'}
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder={isEV ? 'e.g., Home AC, Jio-bp, Tata Power EZ, ChargeZone' : 'e.g., HP Pump, Bandra'}
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
                style={[styles.suggestionChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Text style={[Typography.caption, { color: colors.primary }]}>{isEV ? '⚡' : '⛽'} {station}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ── Receipt Photo (M-06) ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Receipt Photo (optional)</Text>
        {photoUri ? (
          <View style={styles.photoContainer}>
            <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
            <View style={styles.photoActions}>
              <TouchableOpacity
                style={[styles.photoActionButton, { backgroundColor: colors.primary }]}
                onPress={handlePickPhoto}
              >
                <Text style={[Typography.caption, { color: colors.textOnPrimary }]}>Change</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.photoActionButton, { backgroundColor: colors.danger }]}
                onPress={() => setPhotoUri(null)}
              >
                <Text style={[Typography.caption, { color: '#FFFFFF' }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.photoButton, { borderColor: colors.primary, backgroundColor: colors.surface }]}
            onPress={handlePickPhoto}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 24 }}>🧾</Text>
            <Text style={[Typography.bodySmall, { color: colors.primary, marginTop: Spacing.xs }]}>
              Attach Receipt Photo
            </Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.label, { color: colors.textSecondary }]}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="Any notes..."
          placeholderTextColor={colors.textTertiary}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />

        {/* ── Errors ── */}
        {errors.length > 0 && (
          <View style={[styles.errorBox, { backgroundColor: colors.dangerLight }]}>
            {errors.map((e, i) => (
              <Text key={i} style={[Typography.bodySmall, { color: colors.danger }]}>
                ❌ {e}
              </Text>
            ))}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Save Button ── */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.accent }]}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          <Text style={[Typography.button, { color: '#1A1C1E', fontSize: 18 }]}>
            {isEditMode ? (isEV ? 'Update Charge ⚡' : 'Update Entry ✏️') : (isEV ? 'Save Charge ⚡' : 'Save Fuel Entry ⛽')}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.section,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  headerButton: { width: 60 },
  form: { padding: Spacing.xxl },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
    marginTop: Spacing.lg,
  },
  subLabel: {
    fontSize: 12,
    marginBottom: Spacing.sm,
  },
  input: {
    height: Sizing.primaryButton,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
  },
  inputLarge: {
    height: 60,
    fontSize: 22,
    fontWeight: '600',
  },
  inputMultiline: {
    height: 80,
    paddingTop: Spacing.md,
    textAlignVertical: 'top',
  },
  inputLabelSmall: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  calcContainer: {
    borderRadius: Sizing.radiusMd,
    borderWidth: 1.5,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  calcHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  autoCalcBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: Sizing.radiusSm,
  },
  quickAmountsRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingVertical: 4,
  },
  quickAmountChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calcSummaryBox: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    alignItems: 'center',
  },
  totalCostCard: {
    borderRadius: Sizing.radiusMd,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    marginTop: Spacing.md,
    borderBottomWidth: 1,
  },
  errorBox: {
    borderRadius: Sizing.radiusMd,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    gap: Spacing.xs,
  },
  bottomBar: {
    padding: Spacing.lg,
  },
  saveButton: {
    height: Sizing.primaryButton,
    borderRadius: Sizing.radiusMd,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ── Bi-Fuel Dual Tank Selector ──
  dualTankContainer: {
    borderRadius: Sizing.radiusMd,
    borderWidth: 1.5,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  dualTankHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  biFuelPill: {
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: Sizing.radiusSm,
  },
  dualTankRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 4,
  },
  tankOptionCard: {
    flex: 1,
    padding: Spacing.sm,
    borderRadius: Sizing.radiusMd,
  },
  tankOptionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activeIndicator: {
    paddingVertical: 1,
    paddingHorizontal: 5,
    borderRadius: 4,
  },
  activeIndicatorText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  // ── EV Card ──
  evCard: {
    borderRadius: Sizing.radiusMd,
    borderWidth: 1.5,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  evCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  evInputsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  applyKwhButton: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Sizing.radiusSm,
    alignItems: 'center',
  },
  // ── Photo ──
  photoButton: {
    borderRadius: Sizing.radiusMd,
    borderWidth: 2,
    borderStyle: 'dashed',
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  photoContainer: {
    borderRadius: Sizing.radiusMd,
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: 150,
    borderRadius: Sizing.radiusMd,
  },
  photoActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  photoActionButton: {
    flex: 1,
    height: 36,
    borderRadius: Sizing.radiusMd,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ── Station suggestions ──
  suggestionRow: {
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  suggestionChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
  },
});
