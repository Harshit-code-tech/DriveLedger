/**
 * RecordCategoryChips
 *
 * Section 4.2: Record Category Filters
 * Horizontally scrollable filter chips for quickly narrowing visible records.
 */

import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { RecordCategory } from './recordTypes';
import type { RecordPalette } from './recordTheme';

interface RecordCategoryChipsProps {
  selectedCategory: RecordCategory;
  onSelectCategory: (category: RecordCategory) => void;
  isEV?: boolean;
  colors: RecordPalette;
  counts?: {
    all: number;
    fuel: number;
    service: number;
    expenses: number;
    trips: number;
  };
}

export const RecordCategoryChips = React.memo(function RecordCategoryChips({
  selectedCategory,
  onSelectCategory,
  isEV = false,
  colors,
  counts,
}: RecordCategoryChipsProps) {
  const categories: { key: RecordCategory; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'fuel', label: isEV ? 'Charging' : 'Fuel' },
    { key: 'service', label: 'Service' },
    { key: 'trips', label: 'Trips' },
    { key: 'expenses', label: 'Expenses' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.key;
          const count = counts ? counts[cat.key] : undefined;
          const countLabel = count !== undefined ? ` (${count})` : '';

          return (
            <TouchableOpacity
              key={cat.key}
              onPress={() => onSelectCategory(cat.key)}
              activeOpacity={0.75}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? colors.accent : colors.surface,
                  borderColor: isSelected ? colors.accent : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: isSelected ? '#FFFFFF' : colors.textSecondary,
                    fontWeight: isSelected ? '700' : '500',
                  },
                ]}
              >
                {cat.label}
                {countLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
    letterSpacing: -0.1,
  },
});

