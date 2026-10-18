/**
 * Add / Edit Expense — Modal Form
 *
 * Logs non-fuel vehicle expenses: insurance, repair, parking, etc.
 * Uses predefined expense categories for one-tap selection.
 *
 * EDIT MODE: If opened with ?id=<expenseId>, loads existing expense for editing.
 *
 * FEATURES:
 * - Editable date field (DD/MM/YYYY)
 * - Category chips for one-tap selection
 * - Wired to centralized expenseStore
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

export default function AddExpenseScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const selectedVehicle = useVehicleStore((s) => s.selectedVehicle);
  const addExpense = useExpenseStore((s) => s.addExpense);
  const editExpense = useExpenseStore((s) => s.editExpense);

  const isEditMode = !!params.id;

  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [dateDisplay, setDateDisplay] = useState('');
  const [date, setDate] = useState(todayISO());
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
});
