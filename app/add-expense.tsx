/**
 * Add / Edit Expense — Modal Form
 *
 * Logs non-fuel vehicle expenses: insurance, repair, parking, etc.
 * Uses predefined expense categories for one-tap selection.
 *
 * P1 EXTENSIONS:
 * - Receipt / Invoice attachment linking (Images & PDFs) with permanent storage.
 *
 * EDIT MODE: If opened with ?id=<expenseId>, loads existing expense for editing.
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
import { useExpenseStore } from '@/stores/expenseStore';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Typography, Spacing, Sizing } from '@/constants/theme';
import { EXPENSE_CATEGORIES } from '@/constants/expenseCategories';
import { CategoryIcon } from '@/components/CategoryIcon';
import { todayISO } from '@/utils/date';
import { displayToISO, isoToDisplay, formatDateInput, validateDateDisplay } from '@/utils/dateInput';
import { validateExpense } from '@/engine/validationEngine';
import { FormHeader } from '@/components/FormHeader';
import { NoVehicleState } from '@/components/NoVehicleState';
import { VehicleContextHeader } from '@/components/VehicleContextHeader';
import * as expenseRepo from '@/database/repositories/expenseRepo';
import { getCurrencySymbol } from '@/stores/preferencesStore';
import {
  copyToPermanentStorage,
  openAttachment,
  isPdfAttachment,
} from '@/utils/attachmentStorage';

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

  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [dateDisplay, setDateDisplay] = useState('');
  const [date, setDate] = useState(todayISO());
  const [receiptPhotoUri, setReceiptPhotoUri] = useState<string | null>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [error, setError] = useState('');

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
        setDescription(existing.description || '');
        setDate(existing.date);
        setDateDisplay(isoToDisplay(existing.date));
        setReceiptPhotoUri(existing.receipt_photo_uri || null);
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

  // Attachment Handlers
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
    Alert.alert('Attach Receipt or Bill 🧾', 'Select file source:', [
      { text: '📷 Camera', onPress: takePhoto },
      { text: '🖼️ Gallery', onPress: pickImage },
      { text: '📄 PDF Bill', onPress: pickPDF },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleViewReceipt = async () => {
    if (!receiptPhotoUri) return;
    if (isPdfAttachment(receiptPhotoUri)) {
      const res = await openAttachment(receiptPhotoUri, 'Expense Receipt / Bill');
      if (!res.success && res.message) {
        Alert.alert('View Document', res.message);
      }
    } else {
      setViewerUri(receiptPhotoUri);
    }
  };

  const handleSave = () => {
    if (!category) {
      setError('Select a category.');
      return;
    }
    const amountVal = parseFloat(amount);
    if (!amount || isNaN(amountVal) || amountVal <= 0) {
      setError('Enter a valid amount greater than 0.');
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

    const validation = validateExpense({ amount: amountVal, date: isoDate });
    if (!validation.isValid) {
      setError(validation.issues[0].message);
      return;
    }

    setError('');

    if (isEditMode && params.id) {
      editExpense(params.id, {
        category,
        amount: amountVal,
        date: isoDate,
        description: description || null,
        receipt_photo_uri: receiptPhotoUri || null,
      });
      Alert.alert('✅ Expense Updated!', 'Got it, every rupee counts 💰', [
        { text: 'Cool!', onPress: () => router.back() },
      ]);
    } else {
      addExpense({
        vehicle_id: selectedVehicle.id,
        date: isoDate,
        category,
        amount: amountVal,
        description: description || undefined,
        receipt_photo_uri: receiptPhotoUri || undefined,
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
      <FormHeader title={isEditMode ? 'Edit Running Cost' : 'Track Running Cost'} />

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

        {/* ── Category ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Category *</Text>
        <View style={styles.chipGrid}>
          {EXPENSE_CATEGORIES.map((cat) => (
            <Pressable
              key={cat.id}
              onPress={() => setCategory(cat.name)}
              style={[
                styles.chip,
                {
                  backgroundColor: category === cat.name ? colors.accent : colors.surface,
                  borderColor: category === cat.name ? colors.accent : colors.border,
                },
              ]}
            >
              <CategoryIcon icon={cat.icon} size={16} />
              <Text
                style={[
                  styles.chipText,
                  { color: category === cat.name ? '#1A1C1E' : colors.text },
                ]}
              >
                {cat.name}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Amount ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Amount ({getCurrencySymbol()}) *</Text>
        <TextInput
          style={[styles.input, styles.inputLarge, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g., 5000"
          placeholderTextColor={colors.textTertiary}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
        />

        {/* ── Description ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Description</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="What was this cost for? (e.g., toll, parking, wash)"
          placeholderTextColor={colors.textTertiary}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />

        {/* ── Feature 5: Receipt / Bill Attachment ── */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>Receipt or Bill 🧾</Text>
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
                  <Text style={[Typography.bodySmall, { fontWeight: '700', color: colors.text }]}>PDF Bill / Invoice</Text>
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
              Attach Bill / Receipt (Camera, Gallery, or PDF)
            </Text>
            <Text style={[Typography.caption, { color: colors.textTertiary }]}>
              Saved offline and bundled in safe backups
            </Text>
          </TouchableOpacity>
        )}

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
            {isEditMode ? 'Update Running Cost ✏️' : 'Save Running Cost 💰'}
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
  inputLarge: { height: 60, fontSize: 22, fontWeight: '600' },
  inputMultiline: { height: 80, paddingTop: Spacing.md, textAlignVertical: 'top' },
  bottomBar: { padding: Spacing.lg },
  saveButton: {
    height: Sizing.primaryButton, borderRadius: Sizing.radiusMd,
    justifyContent: 'center', alignItems: 'center',
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
