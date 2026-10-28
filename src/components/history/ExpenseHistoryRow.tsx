import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Sizing, Spacing, Typography } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';
import type { Expense } from '@/types/expense';
import { formatDisplayDateLong } from '@/utils/date';
import { formatCurrency } from '@/utils/format';

interface ExpenseHistoryRowProps {
  item: Expense;
  onPress: (expense: Expense) => void;
  onLongPress: (expense: Expense) => void;
}

export const ExpenseHistoryRow = memo(function ExpenseHistoryRow({
  item,
  onPress,
  onLongPress,
}: ExpenseHistoryRowProps) {
  const colors = useThemeColors();

  return (
    <TouchableOpacity
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
      activeOpacity={0.7}
      style={[styles.entryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.entryHeader}>
        <Text style={[Typography.body, { color: colors.text, fontWeight: '600' }]}>
          {item.category}
        </Text>
        <Text style={[Typography.body, { color: colors.accent, fontWeight: '700' }]}>
          {formatCurrency(item.amount)}
        </Text>
      </View>
      <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
        {formatDisplayDateLong(item.date)}
      </Text>
      {item.description ? (
        <Text style={[Typography.bodySmall, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
          {item.description}
        </Text>
      ) : null}

      {item.receipt_photo_uri ? (
        <View style={styles.compTagsContainer}>
          <View
            style={[
              styles.compTagPill,
              { backgroundColor: colors.accent + '18', borderColor: colors.accent + '35' },
            ]}
          >
            <Text style={{ fontSize: 10 }}>🧾</Text>
            <Text style={[styles.compTagText, { color: colors.accent, fontWeight: '700' }]}>
              Receipt
            </Text>
          </View>
        </View>
      ) : null}

      <Text style={[Typography.caption, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
        Tap to edit · Long press to delete
      </Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  entryCard: {
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  compTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: Spacing.sm,
  },
  compTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Sizing.radiusSm,
    borderWidth: 1,
  },
  compTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
