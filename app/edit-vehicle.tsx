/**
 * Edit Vehicle Screen
 *
 * Allows the user to edit all details of an existing vehicle.
 * Opened as a modal from Settings → vehicle card → "Edit".
 *
 * Pre-fills all fields from the existing vehicle record.
 * Smart tank UI: EV shows battery kWh, hybrid shows two tank fields.
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVehicleStore } from '@/stores/vehicleStore';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Typography, Spacing, Sizing } from '@/constants/theme';
import {
  FuelType,
  VehicleType,
  FUEL_TYPE_LABELS,
  VEHICLE_TYPE_LABELS,
  isHybridFuel,
  isElectricFuel,
  getTankCapacityLabel,
  getSecondaryTankLabel,
} from '@/constants/fuelTypes';

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

export default function EditVehicleScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const vehicles = useVehicleStore((s) => s.vehicles);
  const editVehicle = useVehicleStore((s) => s.editVehicle);
  const loadVehicles = useVehicleStore((s) => s.loadVehicles);

  // Find the vehicle being edited (also check all vehicles including archived via store reload)
  const vehicle = vehicles.find((v) => v.id === id);

  // Pre-fill all state from vehicle record
  const [nickname, setNickname] = useState(vehicle?.nickname ?? '');
  const [vehicleType, setVehicleType] = useState<VehicleType>((vehicle?.vehicle_type as VehicleType) ?? VehicleType.CAR);
  const [fuelType, setFuelType] = useState<FuelType>((vehicle?.fuel_type as FuelType) ?? FuelType.PETROL);
  const [registration, setRegistration] = useState(vehicle?.registration_number ?? '');
  const [manufacturer, setManufacturer] = useState(vehicle?.manufacturer ?? '');
  const [model, setModel] = useState(vehicle?.model ?? '');
  const [year, setYear] = useState(vehicle?.year ? String(vehicle.year) : '');
  const [color, setColor] = useState(vehicle?.color ?? '');
  const [frontTyrePressure, setFrontTyrePressure] = useState(
    vehicle?.front_tyre_pressure ? String(vehicle.front_tyre_pressure) : ''
  );
  const [rearTyrePressure, setRearTyrePressure] = useState(
    vehicle?.rear_tyre_pressure ? String(vehicle.rear_tyre_pressure) : ''
  );
  const [tankCapacity, setTankCapacity] = useState(
    vehicle?.tank_capacity ? String(vehicle.tank_capacity) : ''
  );
  const [secondaryTankCapacity, setSecondaryTankCapacity] = useState(
    (vehicle as any)?.secondary_tank_capacity ? String((vehicle as any).secondary_tank_capacity) : ''
  );
  const [serviceIntervalKm, setServiceIntervalKm] = useState(
    vehicle?.service_interval_km ? String(vehicle.service_interval_km) : ''
  );
  const [error, setError] = useState('');

  const isEV = isElectricFuel(fuelType);
  const isHybrid = isHybridFuel(fuelType);

  if (!vehicle) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={[Typography.body, { color: colors.textSecondary }]}>Vehicle not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: Spacing.xl }}>
          <Text style={[Typography.body, { color: colors.primary }]}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleFuelTypeChange = (ft: FuelType) => {
    setFuelType(ft);
    setTankCapacity('');
    setSecondaryTankCapacity('');
  };

  const handleSave = () => {
    if (!nickname.trim()) { setError('Vehicle name is required.'); return; }
    if (!registration.trim()) { setError('Registration number is required.'); return; }
    setError('');

    const updated = editVehicle(vehicle.id, {
      nickname: nickname.trim(),
      vehicle_type: vehicleType,
      fuel_type: fuelType,
      registration_number: registration.trim().toUpperCase(),
      manufacturer: manufacturer.trim() || null,
      model: model.trim() || null,
      year: year ? parseInt(year, 10) : null,
      color: color.trim() || null,
      front_tyre_pressure: frontTyrePressure ? parseFloat(frontTyrePressure) : null,
      rear_tyre_pressure: rearTyrePressure ? parseFloat(rearTyrePressure) : null,
      tank_capacity: tankCapacity ? parseFloat(tankCapacity) : null,
      secondary_tank_capacity: isHybrid && secondaryTankCapacity ? parseFloat(secondaryTankCapacity) : null,
      service_interval_km: serviceIntervalKm ? parseFloat(serviceIntervalKm) : null,
    });

    if (updated) {
      loadVehicles();
      router.back();
    } else {
      Alert.alert('Hmm...', 'Could not save the changes. Give it another shot - your car deserves better!');
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
        <Text style={[Typography.h2, { color: colors.text, marginBottom: Spacing.xs }]}>
          Edit Vehicle
        </Text>
        <Text style={[Typography.bodySmall, { color: colors.textTertiary, marginBottom: Spacing.xxl }]}>
          {vehicle.registration_number}
        </Text>

        {/* ── Vehicle Name ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Vehicle Name *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g., Alto, Baba's Activa"
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
              <Text style={[styles.chipText, { color: vehicleType === vt ? colors.textOnPrimary : colors.text }]}>
                {VEHICLE_TYPE_LABELS[vt]}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Fuel Type ── */}
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
              <Text style={[styles.chipText, { color: fuelType === ft ? '#1A1C1E' : colors.text }]}>
                {FUEL_TYPE_LABELS[ft]}
              </Text>
            </Pressable>
          ))}
        </View>
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
              <Text style={[styles.chipText, { color: fuelType === ft ? '#FFFFFF' : colors.text }]}>
                {FUEL_TYPE_LABELS[ft]}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Registration ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Registration Number *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g., MH 02 AB 1234"
          placeholderTextColor={colors.textTertiary}
          value={registration}
          onChangeText={setRegistration}
          autoCapitalize="characters"
        />

        {error ? (
          <Text style={[Typography.bodySmall, { color: colors.danger, marginTop: Spacing.sm }]}>{error}</Text>
        ) : null}

        {/* ── Optional Details ── */}
        <Text style={[styles.sectionDivider, { color: colors.textSecondary, borderColor: colors.border }]}>
          More Details
        </Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Manufacturer</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g., Maruti, Honda, Tata"
          placeholderTextColor={colors.textTertiary}
          value={manufacturer}
          onChangeText={setManufacturer}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>Model</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g., Swift, City, Nexon"
          placeholderTextColor={colors.textTertiary}
          value={model}
          onChangeText={setModel}
        />

        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Year</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g., 2021"
              placeholderTextColor={colors.textTertiary}
              value={year}
              onChangeText={setYear}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Color</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g., Red"
              placeholderTextColor={colors.textTertiary}
              value={color}
              onChangeText={setColor}
            />
          </View>
        </View>

        {/* ── Tyre Pressure ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Tyre Pressure (PSI)</Text>
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

        {/* ── Primary Tank / Battery ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {getTankCapacityLabel(fuelType)}
        </Text>
        {isEV && (
          <Text style={[Typography.caption, { color: colors.textTertiary, marginBottom: Spacing.sm }]}>
            ⚡ Battery pack capacity in kWh (no fuel tank on EVs).
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

        {/* ── Secondary Tank (Hybrid only) ── */}
        {isHybrid && (
          <>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              {getSecondaryTankLabel(fuelType)}
            </Text>
            <Text style={[Typography.caption, { color: colors.textTertiary, marginBottom: Spacing.sm }]}>
              🔁 Liquid fallback tank alongside the gas tank.
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

        {/* ── Service Interval ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Service Interval (km)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g., 10000"
          placeholderTextColor={colors.textTertiary}
          value={serviceIntervalKm}
          onChangeText={setServiceIntervalKm}
          keyboardType="numeric"
        />
        <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
          Used to compute km-until-next-service on the dashboard.
        </Text>
      </ScrollView>

      {/* ── Save Button ── */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, Spacing.xxxl) }]}>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          <Text style={[Typography.button, { color: colors.textOnPrimary }]}>Save Changes</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, flexDirection: 'row' },
  headerButton: { paddingVertical: Spacing.sm },
  formContent: { padding: Spacing.xxl, paddingTop: Spacing.section, paddingBottom: 120 },
  sectionDivider: {
    fontSize: 13, fontWeight: '700', marginTop: Spacing.xxl, marginBottom: Spacing.sm,
    paddingBottom: Spacing.sm, borderBottomWidth: 1,
  },
  label: {
    fontSize: 13, fontWeight: '600', textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: Spacing.sm, marginTop: Spacing.xl,
  },
  subLabel: {
    fontSize: 11, fontWeight: '600', textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: Spacing.sm, marginTop: Spacing.md,
  },
  input: {
    height: Sizing.primaryButton, borderRadius: Sizing.radiusMd,
    borderWidth: 1.5, paddingHorizontal: Spacing.lg, fontSize: 16,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderRadius: Sizing.radiusFull, borderWidth: 1.5,
    minHeight: Sizing.touchTarget, justifyContent: 'center',
  },
  chipText: { fontSize: 14, fontWeight: '600' },
  twoCol: { flexDirection: 'row', gap: Spacing.md },
  pressureRow: { flexDirection: 'row', gap: Spacing.md },
  pressureField: { flex: 1 },
  pressureFieldLabel: { fontSize: 12, fontWeight: '500', marginBottom: Spacing.xs },
  bottomBar: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  primaryButton: {
    height: Sizing.primaryButton, borderRadius: Sizing.radiusMd,
    justifyContent: 'center', alignItems: 'center', marginHorizontal: Spacing.lg,
  },
});
