/**
 * Add / Edit Service Record — Modal Form
 *
 * Logs vehicle servicing events: oil change, tyre rotation, etc.
 * Uses predefined service templates for one-tap selection.
 *
 * EDIT MODE: If opened with ?id=<recordId>, loads existing record for editing.
 *
 * FEATURES:
 * - Editable date field (DD/MM/YYYY)
 * - Service template chips for one-tap selection
 * - Wired to centralized serviceStore
 */

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVehicleStore } from '@/stores/vehicleStore';
import { useServiceStore } from '@/stores/serviceStore';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Typography, Spacing, Sizing } from '@/constants/theme';
import { SERVICE_TEMPLATES } from '@/constants/serviceTemplates';
import { CategoryIcon } from '@/components/CategoryIcon';
import { todayISO } from '@/utils/date';
import { displayToISO, isoToDisplay, formatDateInput, validateDateDisplay } from '@/utils/dateInput';
import { FormHeader } from '@/components/FormHeader';
import { NoVehicleState } from '@/components/NoVehicleState';
import { VehicleContextHeader } from '@/components/VehicleContextHeader';
import * as serviceRepo from '@/database/repositories/serviceRepo';
import { getCurrencySymbol } from '@/stores/preferencesStore';

export default function AddServiceScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);
  const addRecord = useServiceStore((s) => s.addRecord);
  const editRecord = useServiceStore((s) => s.editRecord);

  const isEditMode = !!params.id;

  const [serviceType, setServiceType] = useState('');
  const [dateDisplay, setDateDisplay] = useState('');
  const [date, setDate] = useState(todayISO());
  const [cost, setCost] = useState('');
  const [odometer, setOdometer] = useState('');
  const [garageName, setGarageName] = useState('');
  const [workDone, setWorkDone] = useState('');
  const [notes, setNotes] = useState('');
  const [nextDueKm, setNextDueKm] = useState('');
  const [nextDueDateDisplay, setNextDueDateDisplay] = useState('');
  const [error, setError] = useState('');

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
        setCost(existing.cost != null ? existing.cost.toString() : '');
        setOdometer(existing.odometer != null ? existing.odometer.toString() : '');
        setGarageName(existing.garage_name || '');
        setWorkDone(existing.work_done || '');
        setNotes(existing.notes || '');
        setNextDueKm(existing.next_due_km != null ? existing.next_due_km.toString() : '');
        setNextDueDateDisplay(existing.next_due_date ? isoToDisplay(existing.next_due_date) : '');
      }
    }
  }, [params.id]);

  if (!selectedVehicle) {
    return <NoVehicleState />;
  }

  const handleDateChange = (text: string) => {
    const formatted = formatDateInput(text, dateDisplay);
    setDateDisplay(formatted);
    const parsed = displayToISO(formatted);
    if (parsed) {
      setDate(parsed);
    }
  };

  const handleSave = () => {
    if (!serviceType.trim()) {
      setError('Select or type a service type.');
      return;
    }

    const dateVal = validateDateDisplay(dateDisplay);
    if (!dateVal.isValid) {
      setError(dateVal.error || 'Enter a valid date in DD/MM/YYYY format.');
      return;
    }

    const isoDate = displayToISO(dateDisplay);
    if (!isoDate) {
      setError('Enter a valid date in DD/MM/YYYY format.');
      return;
    }

    if (cost) {
      const parsedCost = parseFloat(cost);
      if (isNaN(parsedCost) || parsedCost < 0) {
        setError('Enter a valid cost amount (0 or greater).');
        return;
      }
    }

    if (odometer) {
      const parsedOdo = parseFloat(odometer);
      if (isNaN(parsedOdo) || parsedOdo < 0) {
        setError('Enter a valid odometer reading.');
        return;
      }
    }

    let nextDueKmVal: number | null = null;
    if (nextDueKm.trim()) {
      nextDueKmVal = parseFloat(nextDueKm);
      if (isNaN(nextDueKmVal) || nextDueKmVal <= 0) {
        setError('Next due km must be a number greater than 0.');
        return;
      }
      const baseOdo = odometer ? parseFloat(odometer) : selectedVehicle.current_odometer;
      if (baseOdo && nextDueKmVal <= baseOdo) {
        setError('Next due km must be higher than the current odometer reading.');
        return;
      }
    }

    let nextDueDateVal: string | null = null;
    if (nextDueDateDisplay.trim()) {
      const ndv = validateDateDisplay(nextDueDateDisplay);
      nextDueDateVal = ndv.isValid ? displayToISO(nextDueDateDisplay) : null;
      if (!nextDueDateVal) {
        setError(ndv.error || 'Enter a valid next due date in DD/MM/YYYY format.');
        return;
      }
      if (nextDueDateVal < isoDate) {
        setError('Next due date cannot be before the service date.');
        return;
      }
    }

    setError('');

    if (isEditMode && params.id) {
      editRecord(params.id, {
        service_type: serviceType.trim(),
        date: isoDate,
        cost: cost ? parseFloat(cost) : null,
        odometer: odometer ? parseFloat(odometer) : null,
        garage_name: garageName || null,
        work_done: workDone || null,
        notes: notes || null,
        next_due_km: nextDueKmVal,
        next_due_date: nextDueDateVal,
      });
      Alert.alert('✅ Service Updated!', 'Your maintenance record is all up to date 🔧', [
        { text: 'Sweet!', onPress: () => router.back() },
      ]);
    } else {
      addRecord({
        vehicle_id: selectedVehicle.id,
        date: isoDate,
        service_type: serviceType.trim(),
        cost: cost ? parseFloat(cost) : undefined,
        odometer: odometer ? parseFloat(odometer) : undefined,
        garage_name: garageName || undefined,
        work_done: workDone || undefined,
        notes: notes || undefined,
        next_due_km: nextDueKmVal ?? undefined,
        next_due_date: nextDueDateVal ?? undefined,
      });
      router.back();
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'android' ? 'height' : 'padding'}
    >
      {/* ── Header ── */}
      <FormHeader title={isEditMode ? 'Edit Maintenance' : 'Record Maintenance'} />

      {/* ── Vehicle Context ── */}
      <VehicleContextHeader label="Recording for" />

      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
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

        {/* ── Service Type (one-tap chips) ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Service Type *</Text>
        <View style={styles.chipGrid}>
          {SERVICE_TEMPLATES.map((template) => (
            <Pressable
              key={template.id}
              onPress={() => setServiceType(template.name)}
              style={[
                styles.chip,
                {
                  backgroundColor: serviceType === template.name ? colors.primary : colors.surface,
                  borderColor: serviceType === template.name ? colors.primary : colors.border,
                },
              ]}
            >
              <CategoryIcon icon={template.icon} size={16} />
              <Text
                style={[
                  styles.chipText,
                  { color: serviceType === template.name ? colors.textOnPrimary : colors.text },
                ]}
              >
                {template.name}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Or type custom ── */}
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border, marginTop: Spacing.sm }]}
          placeholder="Or type a custom service..."
          placeholderTextColor={colors.textTertiary}
          value={serviceType}
          onChangeText={setServiceType}
        />

        {/* ── Cost ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Cost ({getCurrencySymbol()})</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g., 2500"
          placeholderTextColor={colors.textTertiary}
          value={cost}
          onChangeText={setCost}
          keyboardType="numeric"
        />

        {/* ── Odometer ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Odometer (km)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g., 15000"
          placeholderTextColor={colors.textTertiary}
          value={odometer}
          onChangeText={setOdometer}
          keyboardType="numeric"
        />

        {/* ── Garage Name ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Garage / Workshop</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g., Sharma Auto Care"
          placeholderTextColor={colors.textTertiary}
          value={garageName}
          onChangeText={setGarageName}
        />

        {/* ── Work Done ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Work Done</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="Describe what was done..."
          placeholderTextColor={colors.textTertiary}
          value={workDone}
          onChangeText={setWorkDone}
          multiline
          numberOfLines={3}
        />

        {/* ── Notes ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Notes</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="Any notes..."
          placeholderTextColor={colors.textTertiary}
          value={notes}
          onChangeText={setNotes}
        />

        {/* ── Next Due (optional) ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Next Due: Odometer (km)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g., 20000 (optional)"
          placeholderTextColor={colors.textTertiary}
          value={nextDueKm}
          onChangeText={setNextDueKm}
          keyboardType="numeric"
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>Next Due: Date (DD/MM/YYYY)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="DD/MM/YYYY (optional)"
          placeholderTextColor={colors.textTertiary}
          value={nextDueDateDisplay}
          onChangeText={(t) => setNextDueDateDisplay(formatDateInput(t, nextDueDateDisplay))}
          keyboardType="number-pad"
          maxLength={10}
        />

        {error ? (
          <Text style={[Typography.bodySmall, { color: colors.danger, marginTop: Spacing.md }]}>
            ❌ {error}
          </Text>
        ) : null}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ── Save ── */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          <Text style={[Typography.button, { color: colors.textOnPrimary }]}>
            {isEditMode ? 'Update Maintenance ✏️' : 'Save Maintenance Record 🔧'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.section, paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  headerButton: { width: 60 },
  form: { padding: Spacing.xxl },
  label: {
    fontSize: 13, fontWeight: '600', textTransform: 'uppercase',
    letterSpacing: 0.5, marginBottom: Spacing.sm, marginTop: Spacing.lg,
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Sizing.radiusFull, borderWidth: 1.5,
    minHeight: Sizing.touchTarget,
  },
  chipEmoji: { fontSize: 16 },
  chipText: { fontSize: 13, fontWeight: '600' },
  input: {
    height: Sizing.primaryButton, borderRadius: Sizing.radiusMd,
    borderWidth: 1.5, paddingHorizontal: Spacing.lg, fontSize: 16,
  },
  inputMultiline: { height: 80, paddingTop: Spacing.md, textAlignVertical: 'top' },
  bottomBar: { padding: Spacing.lg },
  saveButton: {
    height: Sizing.primaryButton, borderRadius: Sizing.radiusMd,
    justifyContent: 'center', alignItems: 'center',
  },
});
