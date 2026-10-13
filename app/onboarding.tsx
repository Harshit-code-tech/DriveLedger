/**
 * Onboarding Screen
 *
 * First-time experience — matches the charter's flow:
 *
 * Install & Open → Welcome Screen →
 * "🚗 Welcome to DriveLedger! Let's add your first vehicle." →
 * Add Vehicle (Name, Fuel Type, Registration) →
 * Vehicle Dashboard
 *
 * DESIGN: Simple, welcoming, not overwhelming.
 * Only asks for the 4 required fields: nickname, vehicle_type, fuel_type, registration_number.
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

// Fuel types grouped for readability
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
  FuelType.HYBRID_CNG_DIESEL,
  FuelType.HYBRID_LPG_PETROL,
  FuelType.HYBRID_LPG_DIESEL,
];

type Step = 'welcome' | 'form';

export default function OnboardingScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const vehicles = useVehicleStore((s) => s.vehicles);
  const addVehicle = useVehicleStore((s) => s.addVehicle);

  const [step, setStep] = useState<Step>('welcome');
  const [nickname, setNickname] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>(VehicleType.CAR);
  const [fuelType, setFuelType] = useState<FuelType>(FuelType.PETROL);
  const [registration, setRegistration] = useState('');
  const [frontTyrePressure, setFrontTyrePressure] = useState('');
  const [rearTyrePressure, setRearTyrePressure] = useState('');
  const [tankCapacity, setTankCapacity] = useState('');
  const [secondaryTankCapacity, setSecondaryTankCapacity] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState('');

  const isEV = isElectricFuel(fuelType);
  const isHybrid = isHybridFuel(fuelType);

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
    });

    router.replace('/(tabs)');
  };

  if (step === 'welcome') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, Spacing.xxxl) }]}>
        <View style={styles.welcomeContent}>
          <Text style={styles.welcomeEmoji}>🚗</Text>
          <Text style={[Typography.h1, { color: colors.text, textAlign: 'center' }]}>
            Welcome to DriveLedger!
          </Text>
          <Text
            style={[
              Typography.body,
              { color: colors.textSecondary, textAlign: 'center', marginTop: Spacing.md },
            ]}
          >
            Track fuel, mileage, and expenses - all offline, all private.
          </Text>
          <Text
            style={[
              Typography.bodySmall,
              { color: colors.textTertiary, textAlign: 'center', marginTop: Spacing.xl },
            ]}
          >
            Let's add your first vehicle.
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={() => setStep('form')}
          activeOpacity={0.85}
        >
          <Text style={[Typography.button, { color: colors.textOnPrimary }]}>
            Get Started
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}
      behavior={Platform.OS === 'android' ? 'height' : 'padding'}
    >

      <ScrollView contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false}>
        <Text style={[Typography.h2, { color: colors.text, marginBottom: Spacing.xxl }]}>
          Add Your Vehicle
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

        {/* ── Dual-Fuel (Bi-Fuel) Types ── */}
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
            Add Vehicle & Start
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
  // ── Welcome ──
  welcomeContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
  welcomeEmoji: {
    fontSize: 80,
    marginBottom: Spacing.xxl,
  },
  // ── Form ──
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
  subLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
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
  // ── Bottom Bar ──
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
