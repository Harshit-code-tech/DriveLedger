/**
 * Add Vehicle Screen
 *
 * A dedicated form for adding a new vehicle from Settings.
 * Unlike onboarding, this goes directly to the form — no welcome step.
 *
 * Opened as a modal from Settings → "+ Add Another Vehicle".
 *
 * Smart tank UI:
 * - Electric: Shows "Battery Capacity (kWh)" instead of tank
 * - CNG / LPG: Shows capacity in kg
 * - Hybrid variants: Shows TWO tank fields (gas kg + liquid litres)
 * - Petrol / Diesel: Shows capacity in litres
 */

import {
  FUEL_TYPE_LABELS,
  FuelType,
  VEHICLE_TYPE_LABELS,
  VehicleType,
  getSecondaryTankLabel,
  getTankCapacityLabel,
  isElectricFuel,
  isHybridFuel,
} from '@/constants/fuelTypes';
import { Sizing, Spacing, Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useVehicleStore } from '@/stores/vehicleStore';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Fuel types grouped for readability in chip layout
const SINGLE_FUEL_TYPES = [
  FuelType.PETROL,
  FuelType.DIESEL,
  FuelType.CNG,
  FuelType.LPG,
  FuelType.ELECTRIC,
  FuelType.HYBRID,
];
const BI_FUEL_TYPES = [
  FuelType.HYBRID_CNG_PETROL,
  FuelType.HYBRID_LPG_PETROL,
];

export default function AddVehicleScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const addVehicle = useVehicleStore((s) => s.addVehicle);

  const [nickname, setNickname] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>(VehicleType.CAR);
  const [fuelType, setFuelType] = useState<FuelType>(FuelType.PETROL);
  const [registration, setRegistration] = useState('');
  const [frontTyrePressure, setFrontTyrePressure] = useState('');
  const [rearTyrePressure, setRearTyrePressure] = useState('');
  const [tankCapacity, setTankCapacity] = useState('');
  const [secondaryTankCapacity, setSecondaryTankCapacity] = useState('');
  const [serviceIntervalKm, setServiceIntervalKm] = useState('10000');
  const [serviceIntervalMonths, setServiceIntervalMonths] = useState('12');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState('');

  const isEV = isElectricFuel(fuelType);
  const isHybrid = isHybridFuel(fuelType);

  // When switching fuel type, clear tank fields to avoid stale values
  const handleFuelTypeChange = (ft: FuelType) => {
    setFuelType(ft);
    setTankCapacity('');
    setSecondaryTankCapacity('');
  };

  const handleSave = () => {
    if (!nickname.trim()) {
      setError('Give your vehicle a name!');
      return;
    }
    if (!registration.trim()) {
      setError('Registration number is required.');
      return;
    }
    const capacity = parseFloat(tankCapacity);
    if (!tankCapacity.trim() || isNaN(capacity) || capacity <= 0) {
      setError(`${isEV ? 'Battery' : 'Tank'} capacity is required (enter a number greater than 0).`);
      return;
    }
    if (isHybrid && secondaryTankCapacity) {
      const secondary = parseFloat(secondaryTankCapacity);
      if (isNaN(secondary) || secondary <= 0) {
        setError('Secondary tank capacity must be a number greater than 0.');
        return;
      }
    }
    setError('');

    try {
      addVehicle({
        nickname: nickname.trim(),
        vehicle_type: vehicleType,
        fuel_type: fuelType,
        registration_number: registration.trim().toUpperCase(),
        front_tyre_pressure: frontTyrePressure ? parseFloat(frontTyrePressure) : undefined,
        rear_tyre_pressure: rearTyrePressure ? parseFloat(rearTyrePressure) : undefined,
        tank_capacity: tankCapacity ? parseFloat(tankCapacity) : undefined,
        secondary_tank_capacity: (isHybrid && secondaryTankCapacity)
          ? parseFloat(secondaryTankCapacity)
          : undefined,
        service_interval_km: serviceIntervalKm ? parseFloat(serviceIntervalKm) : 10000,
        service_interval_months: serviceIntervalMonths ? parseFloat(serviceIntervalMonths) : 12,
      });

      router.back();
    } catch (err: any) {
      setError(err?.message || 'Failed to save vehicle. Please check inputs and try again.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}
      behavior={Platform.OS === 'android' ? 'height' : 'padding'}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
          <Text style={[Typography.body, { color: colors.primary }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false}>
        <Text style={[Typography.h2, { color: colors.text, marginBottom: Spacing.xxl }]}>
          Add Another Vehicle
        </Text>

        {/* ── Nickname ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Vehicle Name *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder={"e.g., Alto, Baba's Activa"}
          placeholderTextColor={colors.textTertiary}
          value={nickname}
          onChangeText={setNickname}
          autoFocus
        />

        {/* ── Vehicle Type ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Vehicle Type *</Text>
        <View style={styles.chipRow}>
          {Object.values(VehicleType).map((vt) => (
            <Pressable
              key={vt}
              onPress={() => setVehicleType(vt)}
              style={[
                styles.chip,
                {
                  backgroundColor: vehicleType === vt ? colors.primary : colors.surface,
                  borderColor: vehicleType === vt ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: vehicleType === vt ? colors.textOnPrimary : colors.text },
                ]}
              >
                {VEHICLE_TYPE_LABELS[vt]}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Fuel Type: Single Fuels ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Fuel Type *</Text>
        <View style={styles.chipRow}>
          {SINGLE_FUEL_TYPES.map((ft) => (
            <Pressable
              key={ft}
              onPress={() => handleFuelTypeChange(ft)}
              style={[
                styles.chip,
                {
                  backgroundColor: fuelType === ft ? colors.accent : colors.surface,
                  borderColor: fuelType === ft ? colors.accent : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: fuelType === ft ? '#1A1C1E' : colors.text },
                ]}
              >
                {FUEL_TYPE_LABELS[ft]}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Bi-Fuel Types (shown as separate labelled section) ── */}
        <Text style={[styles.subLabel, { color: colors.textTertiary }]}>
          Dual-Fuel / Bi-Fuel (Two Tanks: Gas + Liquid)
        </Text>
        <View style={styles.chipRow}>
          {BI_FUEL_TYPES.map((ft) => (
            <Pressable
              key={ft}
              onPress={() => handleFuelTypeChange(ft)}
              style={[
                styles.chip,
                {
                  backgroundColor: fuelType === ft ? colors.success : colors.surface,
                  borderColor: fuelType === ft ? colors.success : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: fuelType === ft ? '#FFFFFF' : colors.text },
                ]}
              >
                {FUEL_TYPE_LABELS[ft]}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* -- Registration -- */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Registration Number *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g., MH 02 AB 1234"
          placeholderTextColor={colors.textTertiary}
          value={registration}
          onChangeText={setRegistration}
          autoCapitalize="characters"
        />

        {/* -- Primary Tank / Battery -- */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {getTankCapacityLabel(fuelType)} *
        </Text>
        {isEV && (
          <Text style={[Typography.caption, { color: colors.textTertiary, marginBottom: Spacing.sm }]}>
            Electric vehicles use a battery pack, not a fuel tank. Enter capacity in kWh.
          </Text>
        )}
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder={isEV ? 'e.g., 40.5 kWh' : isHybrid ? 'e.g., 8 kg' : 'e.g., 37 litres'}
          placeholderTextColor={colors.textTertiary}
          value={tankCapacity}
          onChangeText={setTankCapacity}
          keyboardType="numeric"
        />

        {/* -- Secondary Tank (Hybrid only) -- */}
        {isHybrid && (
          <>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {getSecondaryTankLabel(fuelType)}
            </Text>
            <Text style={[Typography.caption, { color: colors.textTertiary, marginBottom: Spacing.sm }]}>
              Dual-fuel vehicle: enter your liquid fallback tank capacity.
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g., 35 litres"
              placeholderTextColor={colors.textTertiary}
              value={secondaryTankCapacity}
              onChangeText={setSecondaryTankCapacity}
              keyboardType="numeric"
            />
          </>
        )}

        {/* ── Error ── */}
        {error ? (
          <Text style={[Typography.bodySmall, { color: colors.danger, marginTop: Spacing.sm }]}>
            {error}
          </Text>
        ) : null}

        {/* ── Advanced Details Toggle ── */}
        <TouchableOpacity
          onPress={() => setShowAdvanced(!showAdvanced)}
          style={styles.advancedToggle}
          activeOpacity={0.7}
        >
          <Text style={[Typography.bodySmall, { color: colors.primary, fontWeight: '600' }]}>
            {showAdvanced ? '▲ Hide Details' : '▼ More Details'}
          </Text>
        </TouchableOpacity>

        {showAdvanced && (
          <View>
            {/* -- Tyre Pressure (optional) -- */}
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Recommended Tyre Pressure (PSI)
            </Text>
            <Text style={[Typography.caption, { color: colors.textTertiary, marginBottom: Spacing.sm }]}>
              Check your tyre sidewall or owner's manual.
            </Text>
            <View style={styles.pressureRow}>
              <View style={styles.pressureField}>
                <Text style={[styles.pressureFieldLabel, { color: colors.textTertiary }]}>Front</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  placeholder="e.g., 32"
                  placeholderTextColor={colors.textTertiary}
                  value={frontTyrePressure}
                  onChangeText={setFrontTyrePressure}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.pressureField}>
                <Text style={[styles.pressureFieldLabel, { color: colors.textTertiary }]}>Rear</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
                  placeholder="e.g., 35"
                  placeholderTextColor={colors.textTertiary}
                  value={rearTyrePressure}
                  onChangeText={setRearTyrePressure}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* ── Dual-Dimension Service Intervals (Mileage vs. Time) ── */}
            <Text style={[styles.subLabel, { color: colors.textSecondary, marginTop: Spacing.lg }]}>
              Service Interval (km)
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g., 10000"
              placeholderTextColor={colors.textTertiary}
              value={serviceIntervalKm}
              onChangeText={setServiceIntervalKm}
              keyboardType="numeric"
            />

            <Text style={[styles.subLabel, { color: colors.textSecondary, marginTop: Spacing.md }]}>
              Service Interval (Months)
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g., 12 (1 year)"
              placeholderTextColor={colors.textTertiary}
              value={serviceIntervalMonths}
              onChangeText={setServiceIntervalMonths}
              keyboardType="numeric"
            />

            {/* Quick Month Presets */}
            <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs }}>
              <TouchableOpacity
                onPress={() => setServiceIntervalMonths('6')}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  paddingHorizontal: 6,
                  borderRadius: 6,
                  backgroundColor: serviceIntervalMonths === '6' ? colors.primaryLight : colors.surface,
                  borderWidth: 1,
                  borderColor: serviceIntervalMonths === '6' ? colors.primary : colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: serviceIntervalMonths === '6' ? colors.primary : colors.textSecondary,
                  }}
                >
                  6 Months (City/Bikes)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setServiceIntervalMonths('12')}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  paddingHorizontal: 6,
                  borderRadius: 6,
                  backgroundColor: serviceIntervalMonths === '12' ? colors.primaryLight : colors.surface,
                  borderWidth: 1,
                  borderColor: serviceIntervalMonths === '12' ? colors.primary : colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: serviceIntervalMonths === '12' ? colors.primary : colors.textSecondary,
                  }}
                >
                  12 Months (Standard)
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
              ⏱️ Alerts when kilometers OR time interval is reached, whichever comes first.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ── Save Button (bottom-anchored for thumb reach) ── */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, Spacing.xxxl) }]}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          <Text style={[Typography.button, { color: colors.textOnPrimary }]}>
            Save Vehicle
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
  headerRow: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    flexDirection: 'row',
  },
  headerButton: {
    paddingVertical: Spacing.sm,
  },
  formContent: {
    padding: Spacing.xxl,
    paddingTop: Spacing.section,
    paddingBottom: 120,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xl,
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  input: {
    height: Sizing.primaryButton,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1.5,
    minHeight: Sizing.touchTarget,
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  advancedToggle: {
    marginTop: Spacing.xxl,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  pressureRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  pressureField: {
    flex: 1,
  },
  pressureFieldLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  bottomBar: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  primaryButton: {
    height: Sizing.primaryButton,
    borderRadius: Sizing.radiusMd,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
  },
});
