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

import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useVehicleStore } from '@/stores/vehicleStore';
import { useFuelStore } from '@/stores/fuelStore';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Typography, Spacing, Sizing } from '@/constants/theme';
import {
  FuelType,
  FuelUnit,
  FUEL_TYPE_TO_DEFAULT_UNIT,
  MILEAGE_UNIT_LABELS,
  isHybridFuel,
  getFuelSystemLabel,
  getFuelUnitForSystem,
} from '@/constants/fuelTypes';
import { todayISO } from '@/utils/date';
import { displayToISO, isoToDisplay, formatDateInput, validateDateDisplay } from '@/utils/dateInput';
import { formatMileage } from '@/utils/format';
import { getCurrencySymbol } from '@/stores/preferencesStore';
import { validateFuelEntry, hasWarningsOnly } from '@/engine/validationEngine';
import { recalculateAllMileage } from '@/engine/mileageEngine';
import { FormHeader } from '@/components/FormHeader';
import { NoVehicleState } from '@/components/NoVehicleState';
import { VehicleContextHeader } from '@/components/VehicleContextHeader';
import { CngTankIcon } from '@/components/CngTankIcon';
import * as fuelRepo from '@/database/repositories/fuelRepo';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';

export default function AddFuelScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();

  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);
  const loadVehicles = useVehicleStore((s) => s.loadVehicles);
  const addFuelEntry = useFuelStore((s) => s.addFuelEntry);
  const loadEntries = useFuelStore((s) => s.loadEntries);

  const isEditMode = !!params.id;

  // Form state
  const [date, setDate] = useState(todayISO());
  const [dateDisplay, setDateDisplay] = useState('');
  const [odometer, setOdometer] = useState('');
  const [fuelAmount, setFuelAmount] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
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
  }, [params.id]);

  if (!selectedVehicle) {
    return <NoVehicleState />;
  }

  const isHybrid = isHybridFuel(selectedVehicle.fuel_type as FuelType);
  const isEV = selectedVehicle.fuel_type === FuelType.ELECTRIC;
  const fuelUnit = isHybrid
    ? getFuelUnitForSystem(selectedVehicle.fuel_type as FuelType, fuelSystem)
    : (FUEL_TYPE_TO_DEFAULT_UNIT[selectedVehicle.fuel_type as FuelType] ?? FuelUnit.LITRES);
  const fuelUnitLabel = fuelUnit === FuelUnit.LITRES ? 'L' : fuelUnit === FuelUnit.KG ? 'kg' : 'kWh';

  const evEstimatedKwh = useMemo(() => {
    if (!isEV) return null;
    const startP = parseFloat(batteryStartPercent);
    const endP = parseFloat(batteryEndPercent);
    const capacity = selectedVehicle.tank_capacity;
    if (!isNaN(startP) && !isNaN(endP) && endP > startP && capacity && capacity > 0) {
      return ((endP - startP) / 100) * capacity;
    }
    return null;
  }, [isEV, batteryStartPercent, batteryEndPercent, selectedVehicle.tank_capacity]);

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

  const handleSave = () => {
    const odoVal = parseFloat(odometer);
    const amountVal = parseFloat(fuelAmount);
    const priceVal = parseFloat(pricePerUnit);

    // Basic field presence checks
    if (!odometer || isNaN(odoVal)) {
      setErrors(['Enter a valid odometer reading.']);
      return;
    }
    if (!fuelAmount || isNaN(amountVal)) {
      setErrors([`Enter the fuel quantity in ${fuelUnitLabel}.`]);
      return;
    }
    if (!pricePerUnit || isNaN(priceVal)) {
      setErrors([`Enter the price per ${fuelUnitLabel}.`]);
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
    // Update the entry
    fuelRepo.updateFuelEntry(entryId, {
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
    });

    // Recalculate ALL mileage in the chain (edit may affect downstream)
    const chronological = fuelRepo.getFuelEntriesByVehicleChronological(selectedVehicle.id);
    const recalculated = recalculateAllMileage(chronological, selectedVehicle.fuel_type as FuelType);
    for (const { entryId: id, mileage } of recalculated) {
      fuelRepo.updateFuelEntryMileage(
        id,
        mileage?.value ?? null,
        mileage?.unit ?? null
      );
    }

    // Update vehicle odometer to the highest reading
    if (chronological.length > 0) {
      const maxOdometer = Math.max(...chronological.map((e) => e.odometer));
      vehicleRepo.updateVehicleOdometer(selectedVehicle.id, maxOdometer);
      loadVehicles();
    }

    // Reload entries so UI reflects new mileage
    loadEntries(selectedVehicle.id);

    Alert.alert('✅ Entry Updated!', 'Fuel entry updated. Your mileage is recalculating in the background... 🔄', [
      { text: 'OK', onPress: () => router.back() },
    ]);
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
        '⛽ Fuelled Up!',
        `Mileage: ${mileageText}${warningText}`,
        [{ text: 'Let\'s ride! 🚗', onPress: () => router.back() }]
      );
    } else {
      router.back();
    }
  };

  const totalCost = (parseFloat(fuelAmount) || 0) * (parseFloat(pricePerUnit) || 0);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'android' ? 'height' : 'padding'}
    >
      {/* ── Header ── */}
      <FormHeader title={isEditMode ? 'Edit Fuel' : (isEV ? 'Add Charge Session ⚡' : 'Add Fuel')} />

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
                onPress={() => setFuelAmount(evEstimatedKwh.toFixed(1))}
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
          autoFocus={!isEditMode}
        />

        {/* ── Fuel Quantity ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Fuel Quantity ({fuelUnitLabel}) *
        </Text>
        <Text style={[styles.subLabel, { color: colors.textTertiary }]}>
          {isEV ? 'kWh charged this session' : `Quantity added this fill-up in ${fuelUnitLabel}`}
        </Text>
        <TextInput
          style={[styles.input, styles.inputLarge, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder={`e.g., ${isEV ? '25' : fuelUnit === FuelUnit.KG ? '8.5' : '30'}`}
          placeholderTextColor={colors.textTertiary}
          value={fuelAmount}
          onChangeText={setFuelAmount}
          keyboardType="decimal-pad"
        />

        {/* ── Price Per Unit ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Price per {fuelUnitLabel} ({getCurrencySymbol()}) *
        </Text>
        <TextInput
          style={[styles.input, styles.inputLarge, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder={`e.g., ${isEV ? '8' : fuelUnit === FuelUnit.KG ? '85' : '105'}`}
          placeholderTextColor={colors.textTertiary}
          value={pricePerUnit}
          onChangeText={setPricePerUnit}
          keyboardType="decimal-pad"
        />

        {/* ── Total Cost (computed, read-only) ── */}
        {totalCost > 0 && (
          <View style={[styles.totalCostCard, { backgroundColor: colors.primaryLight }]}>
            <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>Total Cost</Text>
            <Text style={[Typography.statMedium, { color: colors.primary }]}>
              {getCurrencySymbol()}{totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
        )}

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
          Fuel Station (optional)
        </Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g., HP Pump, Bandra"
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
                <Text style={[Typography.caption, { color: colors.primary }]}>⛽ {station}</Text>
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
            {isEditMode ? 'Update Entry ✏️' : (isEV ? 'Save Charge ⚡' : 'Save Fuel Entry ⛽')}
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
