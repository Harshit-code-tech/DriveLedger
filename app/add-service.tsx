/**
 * Add / Edit Service Record — Modal Form
 *
 * Logs vehicle servicing events: oil change, tyre rotation, etc.
 * Uses predefined service templates for one-tap selection.
 *
 * P1 EXTENSIONS:
 * - Parts-level maintenance tracking: tracks replaced/serviced components
 *   (Engine Oil, Brake Pads, Filters, Tyres, Battery, etc. + custom)
 *   with optional brand, component cost, and individual next-due targets.
 * - Receipt / Invoice attachment linking (Images & PDFs) with permanent storage.
 *
 * EDIT MODE: If opened with ?id=<recordId>, loads existing record & components for editing.
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
  Image,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useVehicleStore } from '@/stores/vehicleStore';
import { useServiceStore } from '@/stores/serviceStore';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Typography, Spacing, Sizing } from '@/constants/theme';
import { SERVICE_TEMPLATES } from '@/constants/serviceTemplates';
import { CategoryIcon } from '@/components/CategoryIcon';
import { TyreIcon } from '@/components/TyreIcon';
import { todayISO } from '@/utils/date';
import { displayToISO, isoToDisplay, formatDateInput, validateDateDisplay } from '@/utils/dateInput';
import { FormHeader } from '@/components/FormHeader';
import { NoVehicleState } from '@/components/NoVehicleState';
import { VehicleContextHeader } from '@/components/VehicleContextHeader';
import * as serviceRepo from '@/database/repositories/serviceRepo';
import * as maintCompRepo from '@/database/repositories/maintenanceComponentRepo';
import { getCurrencySymbol } from '@/stores/preferencesStore';
import {
  copyToPermanentStorage,
  openAttachment,
  isPdfAttachment,
} from '@/utils/attachmentStorage';
import { CreateMaintenanceComponentInput, MaintenanceAction } from '@/types/service';

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
  { name: 'Engine Oil', icon: '🛢️' },
  { name: 'Oil Filter', icon: '⚙️' },
  { name: 'Air Filter', icon: '💨' },
  { name: 'Brake Pads', icon: '🛑' },
  { name: 'Spark Plugs', icon: '⚡' },
  { name: 'Battery', icon: '🔋' },
  { name: 'Tyres', icon: '🛞' },
  { name: 'Coolant', icon: '🧪' },
  { name: 'Timing Belt', icon: '🔄' },
];

function renderComponentIcon(name: string, size = 18, isSelected = false) {
  if (name.toLowerCase().includes('tyre') || name.toLowerCase().includes('tire')) {
    return (
      <TyreIcon
        size={size}
        tyreColor={isSelected ? '#0F172A' : '#334155'}
        rimColor={isSelected ? '#E2E8F0' : '#94A3B8'}
      />
    );
  }
  const match = COMMON_COMPONENTS.find((c) => c.name.toLowerCase() === name.toLowerCase());
  const emoji = match?.icon || '⚙️';
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
  const [receiptPhotoUri, setReceiptPhotoUri] = useState<string | null>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  // Components tracking state
  const [components, setComponents] = useState<FormComponentItem[]>([]);
  const [customPartName, setCustomPartName] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);

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
        setReceiptPhotoUri(existing.receipt_photo_uri || null);
      }

      const existingComps = maintCompRepo.getMaintenanceComponentsByService(params.id);
      if (existingComps && existingComps.length > 0) {
        setComponents(
          existingComps.map((c) => ({
            id: c.id,
            component_name: c.component_name,
            action: (c.action as MaintenanceAction) || 'replaced',
            brand: c.brand || '',
            cost: c.cost != null ? c.cost.toString() : '',
            next_due_km: c.next_due_km != null ? c.next_due_km.toString() : '',
            next_due_date_display: c.next_due_date ? isoToDisplay(c.next_due_date) : '',
            notes: c.notes || '',
          }))
        );
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

  // Component Management
  const addComponentByName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (components.some((c) => c.component_name.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert('Component Added', `"${trimmed}" is already in this service record.`);
      return;
    }
    const newItem: FormComponentItem = {
      id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      component_name: trimmed,
      action: 'replaced',
      brand: '',
      cost: '',
      next_due_km: '',
      next_due_date_display: '',
      notes: '',
    };
    setComponents((prev) => [...prev, newItem]);
    setCustomPartName('');
    setShowAddCustom(false);
  };

  const removeComponent = (index: number) => {
    setComponents((prev) => prev.filter((_, i) => i !== index));
  };

  const updateComponentField = (index: number, field: keyof FormComponentItem, value: string) => {
    setComponents((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Receipt / Attachment Handlers
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera Permission', 'Camera access is required to photograph your receipt.');
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
    if (status !== 'granted') {
      Alert.alert('Gallery Permission', 'Gallery access is required to attach your receipt.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
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
        type: 'application/pdf',
        copyToCacheDirectory: false,
      });
      if (!result.canceled && result.assets && result.assets[0]) {
        const savedUri = await copyToPermanentStorage(result.assets[0].uri, result.assets[0].name);
        setReceiptPhotoUri(savedUri);
      }
    } catch (e) {
      Alert.alert('Attachment Error', e instanceof Error ? e.message : 'Could not attach PDF.');
    }
  };

  const handlePickReceipt = () => {
    Alert.alert('Attach Receipt or Invoice 🧾', 'Select file source:', [
      { text: '📷 Camera', onPress: takePhoto },
      { text: '🖼️ Gallery', onPress: pickImage },
      { text: '📄 PDF Invoice', onPress: pickPDF },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleViewReceipt = async () => {
    if (!receiptPhotoUri) return;
    if (isPdfAttachment(receiptPhotoUri)) {
      const res = await openAttachment(receiptPhotoUri, 'Service Invoice / Receipt');
      if (!res.success && res.message) {
        Alert.alert('View Document', res.message);
      }
    } else {
      setViewerUri(receiptPhotoUri);
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

    // Validate components
    const componentInputs: CreateMaintenanceComponentInput[] = [];
    const baseOdo = odometer ? parseFloat(odometer) : selectedVehicle.current_odometer;

    for (const comp of components) {
      // Validate cost
      let parsedCompCost: number | undefined = undefined;
      if (comp.cost && comp.cost.trim()) {
        const pCost = parseFloat(comp.cost.trim());
        if (isNaN(pCost) || pCost < 0) {
          setError(`Invalid cost for component "${comp.component_name}". Must be 0 or greater.`);
          return;
        }
        parsedCompCost = pCost;
      }

      // Validate next due km
      let compNextKm: number | undefined = undefined;
      if (comp.next_due_km.trim()) {
        const pKm = parseFloat(comp.next_due_km.trim());
        if (isNaN(pKm) || pKm <= 0) {
          setError(`Invalid next due km for "${comp.component_name}". Must be greater than 0.`);
          return;
        }
        if (baseOdo && pKm <= baseOdo) {
          setError(`Next due km for "${comp.component_name}" (${pKm} km) cannot be less than or equal to the odometer reading (${baseOdo} km).`);
          return;
        }
        compNextKm = pKm;
      }

      // Validate next due date
      let compNextDate: string | undefined = undefined;
      if (comp.next_due_date_display.trim()) {
        const cDateVal = validateDateDisplay(comp.next_due_date_display);
        if (!cDateVal.isValid) {
          setError(cDateVal.error || `Invalid next due date for "${comp.component_name}". Use DD/MM/YYYY format.`);
          return;
        }
        const parsedDate = displayToISO(comp.next_due_date_display);
        if (!parsedDate) {
          setError(`Invalid date format for "${comp.component_name}".`);
          return;
        }
        if (parsedDate < isoDate) {
          setError(`Next due date for "${comp.component_name}" cannot be before the service date.`);
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

    setError('');

    try {
      if (isEditMode && params.id) {
        editRecord(
          params.id,
          {
            service_type: serviceType.trim(),
            date: isoDate,
            cost: cost ? parseFloat(cost) : null,
            odometer: odometer ? parseFloat(odometer) : null,
            garage_name: garageName || null,
            work_done: workDone || null,
            notes: notes || null,
            next_due_km: nextDueKmVal,
            next_due_date: nextDueDateVal,
            receipt_photo_uri: receiptPhotoUri || null,
          },
          componentInputs
        );
        Alert.alert('✅ Service Updated!', 'Your maintenance record and component history have been updated.', [
          { text: 'Done', onPress: () => router.back() },
        ]);
      } else {
        addRecord(
          {
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
            receipt_photo_uri: receiptPhotoUri || undefined,
          },
          componentInputs
        );
        router.back();
      }
    } catch (saveError) {
      console.error('[AddService.handleSave] Failed to save service record:', saveError);
      const errMsg = saveError instanceof Error ? saveError.message : 'Unknown database error occurred.';
      setError(`Failed to save service: ${errMsg}`);
      Alert.alert('Save Failed', `Could not save service record:\n${errMsg}`);
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
        <Text style={[styles.label, { color: colors.textSecondary }]}>Date (DD/MM/YYYY) *</Text>
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
        <Text style={[styles.label, { color: colors.textSecondary }]}>Total Service Cost ({getCurrencySymbol()})</Text>
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
        <Text style={[styles.label, { color: colors.textSecondary }]}>Work Done Description</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="Describe what was done..."
          placeholderTextColor={colors.textTertiary}
          value={workDone}
          onChangeText={setWorkDone}
          multiline
          numberOfLines={3}
        />

        {/* ══════════════════════════════════════════════════════════ */}
        {/* ── Feature 4: Parts-Level Maintenance Tracking ────────── */}
        {/* ══════════════════════════════════════════════════════════ */}
        <View style={[styles.sectionDivider, { borderColor: colors.border }]} />
        <View style={styles.sectionHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Parts & Components Serviced 🔧</Text>
            <Text style={[Typography.caption, { color: colors.textSecondary }]}>
              Track individual replacement wear, brands & next-due targets
            </Text>
          </View>
        </View>

        {/* Quick-add component chips */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Quick Add Parts</Text>
        <View style={styles.chipGrid}>
          {COMMON_COMPONENTS.map((comp) => {
            const isAdded = components.some(
              (c) => c.component_name.toLowerCase() === comp.name.toLowerCase()
            );
            return (
              <Pressable
                key={comp.name}
                onPress={() => addComponentByName(comp.name)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isAdded ? colors.primary + '22' : colors.surface,
                    borderColor: isAdded ? colors.primary : colors.border,
                  },
                ]}
              >
                {renderComponentIcon(comp.name, 16, isAdded)}
                <Text
                  style={[
                    styles.chipText,
                    { color: isAdded ? colors.primary : colors.text },
                  ]}
                >
                  {comp.name} {isAdded ? '✓' : '+'}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setShowAddCustom(!showAddCustom)}
            style={[
              styles.chip,
              {
                backgroundColor: showAddCustom ? colors.primary : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={styles.chipEmoji}>➕</Text>
            <Text
              style={[
                styles.chipText,
                { color: showAddCustom ? colors.textOnPrimary : colors.text },
              ]}
            >
              Custom Part
            </Text>
          </Pressable>
        </View>

        {showAddCustom && (
          <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
            <TextInput
              style={[styles.input, { flex: 1, backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g., Transmission Fluid, Wiper Blades"
              placeholderTextColor={colors.textTertiary}
              value={customPartName}
              onChangeText={setCustomPartName}
            />
            <TouchableOpacity
              style={[styles.addPartButton, { backgroundColor: colors.primary }]}
              onPress={() => addComponentByName(customPartName)}
            >
              <Text style={{ color: colors.textOnPrimary, fontWeight: '700' }}>Add</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Added components cards */}
        {components.length > 0 ? (
          <View style={{ marginTop: Spacing.md, gap: Spacing.md }}>
            {components.map((comp, idx) => (
              <View
                key={comp.id || idx}
                style={[
                  styles.componentCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={styles.componentCardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 }}>
                    {renderComponentIcon(comp.component_name, 20)}
                    <Text style={[Typography.body, { fontWeight: '700', color: colors.text }]}>
                      {comp.component_name}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => removeComponent(idx)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={{ color: colors.danger, fontSize: 13, fontWeight: '600' }}>Remove ✕</Text>
                  </TouchableOpacity>
                </View>

                {/* Action selector with heading */}
                <View style={styles.compFieldBlock}>
                  <Text style={[styles.compFieldLabel, { color: colors.textSecondary }]}>
                    Action Taken
                  </Text>
                  <View style={styles.actionRow}>
                    {(['replaced', 'inspected', 'topped_up', 'cleaned'] as MaintenanceAction[]).map((act) => (
                      <TouchableOpacity
                        key={act}
                        onPress={() => updateComponentField(idx, 'action', act)}
                        style={[
                          styles.actionChip,
                          {
                            backgroundColor: comp.action === act ? colors.primary : colors.surface,
                            borderColor: comp.action === act ? colors.primary : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: '600',
                            color: comp.action === act ? colors.textOnPrimary : colors.textSecondary,
                            textTransform: 'capitalize',
                          }}
                        >
                          {act.replace('_', ' ')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Brand & Specification with clear heading above the box */}
                <View style={styles.compFieldBlock}>
                  <Text style={[styles.compFieldLabel, { color: colors.textSecondary }]}>
                    Brand / Specification
                  </Text>
                  <TextInput
                    style={[styles.compInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                    placeholder="e.g. Shell Helix Ultra 5W-40, Bosch, Brembo"
                    placeholderTextColor={colors.textTertiary}
                    value={comp.brand}
                    onChangeText={(val) => updateComponentField(idx, 'brand', val)}
                    autoCapitalize="words"
                  />
                </View>

                {/* Part Cost & Next Due Odometer with headings above */}
                <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                  <View style={[{ flex: 1 }, styles.compFieldBlock]}>
                    <Text style={[styles.compFieldLabel, { color: colors.textSecondary }]}>
                      Part Cost ({getCurrencySymbol()})
                    </Text>
                    <TextInput
                      style={[styles.compInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                      placeholder="0.00"
                      placeholderTextColor={colors.textTertiary}
                      value={comp.cost}
                      onChangeText={(val) => updateComponentField(idx, 'cost', val)}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={[{ flex: 1 }, styles.compFieldBlock]}>
                    <Text style={[styles.compFieldLabel, { color: colors.textSecondary }]}>
                      Next Due (km)
                    </Text>
                    <TextInput
                      style={[styles.compInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                      placeholder="e.g. 35000"
                      placeholderTextColor={colors.textTertiary}
                      value={comp.next_due_km}
                      onChangeText={(val) => updateComponentField(idx, 'next_due_km', val)}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* Next Due Date & Component Notes with headings above */}
                <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                  <View style={[{ flex: 1 }, styles.compFieldBlock]}>
                    <Text style={[styles.compFieldLabel, { color: colors.textSecondary }]}>
                      Next Due Date
                    </Text>
                    <TextInput
                      style={[styles.compInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                      placeholder="DD/MM/YYYY"
                      placeholderTextColor={colors.textTertiary}
                      value={comp.next_due_date_display}
                      onChangeText={(val) =>
                        updateComponentField(idx, 'next_due_date_display', formatDateInput(val, comp.next_due_date_display))
                      }
                      keyboardType="number-pad"
                      maxLength={10}
                    />
                  </View>
                  <View style={[{ flex: 1 }, styles.compFieldBlock]}>
                    <Text style={[styles.compFieldLabel, { color: colors.textSecondary }]}>
                      Notes (Optional)
                    </Text>
                    <TextInput
                      style={[styles.compInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                      placeholder="e.g. Front pair"
                      placeholderTextColor={colors.textTertiary}
                      value={comp.notes}
                      onChangeText={(val) => updateComponentField(idx, 'notes', val)}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: Spacing.xs, fontStyle: 'italic' }]}>
            No parts attached to this service record yet. Tap parts above to track component life.
          </Text>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* ── Feature 5: Invoice / Receipt Attachment ────────────── */}
        {/* ══════════════════════════════════════════════════════════ */}
        <View style={[styles.sectionDivider, { borderColor: colors.border }]} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Service Receipt / Bill 🧾</Text>
        <Text style={[Typography.caption, { color: colors.textSecondary, marginBottom: Spacing.sm }]}>
          Store your garage invoice safely offline in application storage
        </Text>

        {receiptPhotoUri ? (
          <View style={[styles.attachmentContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {isPdfAttachment(receiptPhotoUri) ? (
              <TouchableOpacity
                style={styles.pdfBadge}
                onPress={handleViewReceipt}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 32 }}>📄</Text>
                <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <Text style={[Typography.bodySmall, { fontWeight: '700', color: colors.text }]}>PDF Invoice</Text>
                  <Text style={[Typography.caption, { color: colors.textTertiary }]} numberOfLines={1}>
                    {receiptPhotoUri.split('/').pop()} (tap to view)
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.imageBadge}
                onPress={handleViewReceipt}
                activeOpacity={0.8}
              >
                <Image source={{ uri: receiptPhotoUri }} style={styles.imageThumbnail} resizeMode="cover" />
                <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                  <Text style={[Typography.bodySmall, { fontWeight: '700', color: colors.text }]}>Receipt Photo</Text>
                  <Text style={[Typography.caption, { color: colors.textTertiary }]} numberOfLines={1}>
                    {receiptPhotoUri.split('/').pop()} (tap to view)
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            <View style={styles.attachmentActions}>
              <TouchableOpacity
                style={[styles.attachBtn, { backgroundColor: colors.primary }]}
                onPress={handleViewReceipt}
                activeOpacity={0.8}
              >
                <Text style={{ color: colors.textOnPrimary, fontSize: 12, fontWeight: '700' }}>
                  {isPdfAttachment(receiptPhotoUri) ? 'View Document 📄' : 'View Photo 👁️'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.attachBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
                onPress={handlePickReceipt}
              >
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: '600' }}>Change</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.attachBtn, { backgroundColor: colors.danger + '20' }]}
                onPress={() => setReceiptPhotoUri(null)}
              >
                <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '700' }}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.attachPlaceholder, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={handlePickReceipt}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 24 }}>📎</Text>
            <Text style={[Typography.bodySmall, { color: colors.primary, fontWeight: '600', marginTop: Spacing.xs }]}>
              Attach Invoice (Camera, Gallery, or PDF)
            </Text>
            <Text style={[Typography.caption, { color: colors.textTertiary }]}>
              Will be saved locally and included in backups
            </Text>
          </TouchableOpacity>
        )}

        {/* ── Overall Service Next Due (optional) ── */}
        <View style={[styles.sectionDivider, { borderColor: colors.border }]} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Overall Next Service Target</Text>
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

        {/* ── Notes ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Notes</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="Any notes..."
          placeholderTextColor={colors.textTertiary}
          value={notes}
          onChangeText={setNotes}
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
  container: { flex: 1 },
  form: { padding: Spacing.xxl },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.lg,
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1.5,
    minHeight: Sizing.touchTarget,
  },
  chipEmoji: { fontSize: 16 },
  chipText: { fontSize: 13, fontWeight: '600' },
  input: {
    height: Sizing.primaryButton,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.lg,
    fontSize: 16,
  },
  inputMultiline: { height: 80, paddingTop: Spacing.md, textAlignVertical: 'top' },
  bottomBar: { padding: Spacing.lg },
  saveButton: {
    height: Sizing.primaryButton,
    borderRadius: Sizing.radiusMd,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionDivider: {
    borderTopWidth: 1,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  addPartButton: {
    height: Sizing.primaryButton,
    paddingHorizontal: Spacing.lg,
    borderRadius: Sizing.radiusMd,
    justifyContent: 'center',
    alignItems: 'center',
  },
  componentCard: {
    borderWidth: 1.5,
    borderRadius: Sizing.radiusMd,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  componentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  actionChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Sizing.radiusFull,
    borderWidth: 1,
  },
  compFieldBlock: {
    gap: 4,
  },
  compFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  compInput: {
    height: 42,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 13,
  },
  smallInput: {
    height: 40,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 13,
  },
  attachmentContainer: {
    borderWidth: 1.5,
    borderRadius: Sizing.radiusMd,
    padding: Spacing.md,
    marginTop: Spacing.xs,
  },
  pdfBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageThumbnail: {
    width: 48,
    height: 48,
    borderRadius: Sizing.radiusSm,
  },
  attachmentActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  attachBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Sizing.radiusSm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachPlaceholder: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: Sizing.radiusMd,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 56,
    right: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
  },
  modalCloseText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalImage: {
    width: '95%',
    height: '80%',
    borderRadius: 12,
  },
});
