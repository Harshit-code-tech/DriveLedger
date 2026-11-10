/**
 * RecordFilterBar
 *
 * Implements:
 * - Requirement 1: SVG icons for every category filter.
 * - Requirement 5: Below vehicle selection:
 *   - Left: Filter & Sort dropdown (date range + sorting options).
 *   - Right: Hamburger button opening the category selection menu with SVG icons.
 * - Section 4.4: Active condition indicators with "Clear all".
 */

import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Spacing } from '@/constants/theme';
import type { RecordCategory, DateRangeOption, SortOrder } from './recordTypes';
import type { RecordPalette } from './recordTheme';
import {
  CategoryAllIcon,
  CategoryFuelIcon,
  CategoryElectricIcon,
  CategoryServiceIcon,
  CategoryTripIcon,
  CategoryExpenseIcon,
  HamburgerIcon,
  FilterIcon,
} from './RecordSvgIcons';

interface RecordFilterBarProps {
  selectedCategory: RecordCategory;
  onSelectCategory: (category: RecordCategory) => void;
  dateRange: DateRangeOption;
  onChangeDateRange: (range: DateRangeOption) => void;
  sortOrder: SortOrder;
  onChangeSortOrder: (order: SortOrder) => void;
  searchText: string;
  onClearSearchText: () => void;
  onClearCategory: () => void;
  onClearAll: () => void;
  isEV?: boolean;
  colors: RecordPalette;
  counts: {
    all: number;
    fuel: number;
    service: number;
    expenses: number;
    trips: number;
  };
}

const DATE_RANGE_OPTIONS: { key: DateRangeOption; label: string }[] = [
  { key: 'all', label: 'All Time' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: '30days', label: 'Last 30 Days' },
  { key: '3months', label: 'Last 3 Months' },
  { key: 'year', label: 'This Year' },
];

export const RecordFilterBar = React.memo(function RecordFilterBar({
  selectedCategory,
  onSelectCategory,
  dateRange,
  onChangeDateRange,
  sortOrder,
  onChangeSortOrder,
  searchText,
  onClearSearchText,
  onClearCategory,
  onClearAll,
  isEV = false,
  colors,
  counts,
}: RecordFilterBarProps) {
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const activeDateOption =
    DATE_RANGE_OPTIONS.find((o) => o.key === dateRange) || DATE_RANGE_OPTIONS[0];

  const hasActiveFilters =
    selectedCategory !== 'all' ||
    dateRange !== 'all' ||
    searchText.trim().length > 0 ||
    sortOrder !== 'newest';

  // Category definitions with their respective SVG icons (Requirement 1)
  // Memoized so the array reference is stable when counts or isEV haven't changed
  const categories: {
    key: RecordCategory;
    label: string;
    icon: (size: number, color: string) => React.ReactNode;
    count: number;
  }[] = useMemo(() => [
    {
      key: 'all',
      label: 'All Records',
      icon: (size, color) => <CategoryAllIcon size={size} color={color} />,
      count: counts.all,
    },
    {
      key: 'fuel',
      label: isEV ? 'Charging Sessions' : 'Fuel Refills',
      icon: (size, color) =>
        isEV ? (
          <CategoryElectricIcon size={size} color={color} />
        ) : (
          <CategoryFuelIcon size={size} color={color} />
        ),
      count: counts.fuel,
    },
    {
      key: 'service',
      label: 'Service & Maintenance',
      icon: (size, color) => <CategoryServiceIcon size={size} color={color} />,
      count: counts.service,
    },
    {
      key: 'trips',
      label: 'Trips (GPS & Manual)',
      icon: (size, color) => <CategoryTripIcon size={size} color={color} />,
      count: counts.trips,
    },
    {
      key: 'expenses',
      label: 'Running Expenses',
      icon: (size, color) => <CategoryExpenseIcon size={size} color={color} />,
      count: counts.expenses,
    },
  ], [isEV, counts.all, counts.fuel, counts.service, counts.trips, counts.expenses]);

  const currentCategoryObj =
    categories.find((c) => c.key === selectedCategory) || categories[0];

  const categoryShortLabel =
    selectedCategory === 'all'
      ? 'All'
      : selectedCategory === 'fuel'
      ? isEV
        ? 'Charging'
        : 'Fuel'
      : selectedCategory === 'service'
      ? 'Service'
      : selectedCategory === 'trips'
      ? 'Trips'
      : 'Expenses';

  return (
    <View style={styles.container}>
      {/* ── Main Bar: Left Filter Dropdown & Right Hamburger Category ── */}
      <View style={styles.barRow}>
        {/* Left: Filter & Sort Dropdown */}
        <TouchableOpacity
          style={[
            styles.filterBtn,
            {
              backgroundColor: colors.surface,
              borderColor: dateRange !== 'all' || sortOrder !== 'newest' ? colors.accent : colors.borderLight,
            },
          ]}
          onPress={() => setFilterModalVisible(true)}
          activeOpacity={0.75}
        >
          <FilterIcon
            size={16}
            color={dateRange !== 'all' || sortOrder !== 'newest' ? colors.accent : colors.textSecondary}
          />
          <Text
            style={[
              styles.filterBtnText,
              {
                color: dateRange !== 'all' || sortOrder !== 'newest' ? colors.accent : colors.text,
                fontWeight: dateRange !== 'all' || sortOrder !== 'newest' ? '700' : '600',
              },
            ]}
            numberOfLines={1}
          >
            {dateRange === 'all' ? 'Filter & Sort' : activeDateOption.label} ▼
          </Text>
        </TouchableOpacity>

        {/* Right: Hamburger Category Selector */}
        <TouchableOpacity
          style={[
            styles.hamburgerBtn,
            {
              backgroundColor: selectedCategory !== 'all' ? colors.surfaceSecondary : colors.surface,
              borderColor: selectedCategory !== 'all' ? colors.accent : colors.borderLight,
            },
          ]}
          onPress={() => setCategoryModalVisible(true)}
          activeOpacity={0.75}
        >
          <View style={styles.hamburgerCategoryPreview}>
            {currentCategoryObj.icon(16, selectedCategory !== 'all' ? colors.accent : colors.text)}
            <Text
              style={[
                styles.hamburgerBtnText,
                {
                  color: selectedCategory !== 'all' ? colors.accent : colors.text,
                  fontWeight: selectedCategory !== 'all' ? '700' : '600',
                },
              ]}
              numberOfLines={1}
            >
              {categoryShortLabel}
            </Text>
          </View>
          <HamburgerIcon
            size={16}
            color={selectedCategory !== 'all' ? colors.accent : colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* ── Section 4.4: Active Filter Indicators ── */}
      {hasActiveFilters && (
        <View style={styles.activeIndicatorsRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeChipsScroll}
          >
            {selectedCategory !== 'all' && (
              <TouchableOpacity
                style={[styles.indicatorPill, { backgroundColor: colors.surfaceSecondary }]}
                onPress={onClearCategory}
                activeOpacity={0.7}
              >
                {currentCategoryObj.icon(13, colors.accent)}
                <Text style={[styles.indicatorText, { color: colors.text }]}>
                  {categoryShortLabel}
                </Text>
                <Text style={[styles.indicatorClose, { color: colors.accent }]}>✕</Text>
              </TouchableOpacity>
            )}

            {dateRange !== 'all' && (
              <TouchableOpacity
                style={[styles.indicatorPill, { backgroundColor: colors.surfaceSecondary }]}
                onPress={() => onChangeDateRange('all')}
                activeOpacity={0.7}
              >
                <Text style={[styles.indicatorText, { color: colors.text }]}>
                  {activeDateOption.label}
                </Text>
                <Text style={[styles.indicatorClose, { color: colors.accent }]}>✕</Text>
              </TouchableOpacity>
            )}

            {searchText.trim().length > 0 && (
              <TouchableOpacity
                style={[styles.indicatorPill, { backgroundColor: colors.surfaceSecondary }]}
                onPress={onClearSearchText}
                activeOpacity={0.7}
              >
                <Text style={[styles.indicatorText, { color: colors.text }]} numberOfLines={1}>
                  "{searchText.trim()}"
                </Text>
                <Text style={[styles.indicatorClose, { color: colors.accent }]}>✕</Text>
              </TouchableOpacity>
            )}

            {sortOrder !== 'newest' && (
              <TouchableOpacity
                style={[styles.indicatorPill, { backgroundColor: colors.surfaceSecondary }]}
                onPress={() => onChangeSortOrder('newest')}
                activeOpacity={0.7}
              >
                <Text style={[styles.indicatorText, { color: colors.text }]}>
                  Oldest first
                </Text>
                <Text style={[styles.indicatorClose, { color: colors.accent }]}>✕</Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          <TouchableOpacity
            onPress={onClearAll}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.clearAllBtn}
          >
            <Text style={[styles.clearAllText, { color: colors.accent }]}>Clear all</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Hamburger Category Picker Modal (Requirement 1 & 5) ── */}
      {categoryModalVisible && (
        <Modal
          visible={categoryModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setCategoryModalVisible(false)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setCategoryModalVisible(false)}
          >
            <Pressable
              style={[
                styles.modalCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Select Category</Text>
                <TouchableOpacity onPress={() => setCategoryModalVisible(false)} hitSlop={8}>
                  <Text style={[styles.modalClose, { color: colors.textSecondary }]}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalOptions}>
                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      style={[
                        styles.categoryOptionRow,
                        {
                          backgroundColor: isSelected ? colors.surfaceSecondary : 'transparent',
                          borderColor: isSelected ? colors.accent : colors.borderLight,
                        },
                      ]}
                      onPress={() => {
                        onSelectCategory(cat.key);
                        setCategoryModalVisible(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.categoryOptionLeft}>
                        <View
                          style={[
                            styles.categoryIconWrap,
                            { backgroundColor: isSelected ? '#FFFFFF' : colors.surfaceSecondary },
                          ]}
                        >
                          {cat.icon(18, isSelected ? colors.accent : colors.text)}
                        </View>
                        <Text
                          style={[
                            styles.categoryOptionLabel,
                            {
                              color: isSelected ? colors.accent : colors.text,
                              fontWeight: isSelected ? '700' : '600',
                            },
                          ]}
                        >
                          {cat.label}
                        </Text>
                      </View>

                      <View style={styles.categoryOptionRight}>
                        <View
                          style={[
                            styles.countPill,
                            {
                              backgroundColor: isSelected ? colors.accent : colors.surfaceSecondary,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.countPillText,
                              { color: isSelected ? '#FFFFFF' : colors.textSecondary },
                            ]}
                          >
                            {cat.count}
                          </Text>
                        </View>
                        {isSelected && (
                          <Text style={[styles.checkMark, { color: colors.accent }]}>✓</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* ── Filter & Sort Modal (Requirement 5 Left Side) ── */}
      {filterModalVisible && (
        <Modal
          visible={filterModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setFilterModalVisible(false)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setFilterModalVisible(false)}
          >
            <Pressable
              style={[
                styles.modalCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Filter & Sort</Text>
                <TouchableOpacity onPress={() => setFilterModalVisible(false)} hitSlop={8}>
                  <Text style={[styles.modalClose, { color: colors.textSecondary }]}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 360 }}>
                {/* Date Range Section */}
                <View style={styles.filterSection}>
                  <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                    DATE RANGE
                  </Text>
                  {DATE_RANGE_OPTIONS.map((opt) => {
                    const isSelected = dateRange === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[
                          styles.filterOptionItem,
                          {
                            backgroundColor: isSelected ? colors.surfaceSecondary : 'transparent',
                          },
                        ]}
                        onPress={() => onChangeDateRange(opt.key)}
                      >
                        <Text
                          style={[
                            styles.filterOptionLabel,
                            {
                              color: isSelected ? colors.accent : colors.text,
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          {opt.label}
                        </Text>
                        {isSelected && (
                          <Text style={[styles.checkMark, { color: colors.accent }]}>✓</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Sort Order Section */}
                <View style={[styles.filterSection, { borderTopWidth: 1, borderTopColor: colors.borderLight }]}>
                  <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                    SORT ORDER
                  </Text>
                  {[
                    { key: 'newest' as SortOrder, label: 'Newest first (latest on top)' },
                    { key: 'oldest' as SortOrder, label: 'Oldest first (earliest on top)' },
                  ].map((opt) => {
                    const isSelected = sortOrder === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[
                          styles.filterOptionItem,
                          {
                            backgroundColor: isSelected ? colors.surfaceSecondary : 'transparent',
                          },
                        ]}
                        onPress={() => onChangeSortOrder(opt.key)}
                      >
                        <Text
                          style={[
                            styles.filterOptionLabel,
                            {
                              color: isSelected ? colors.accent : colors.text,
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          {opt.label}
                        </Text>
                        {isSelected && (
                          <Text style={[styles.checkMark, { color: colors.accent }]}>✓</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <View style={[styles.modalFooter, { borderTopColor: colors.borderLight }]}>
                <TouchableOpacity
                  style={[styles.applyBtn, { backgroundColor: colors.accent }]}
                  onPress={() => setFilterModalVisible(false)}
                >
                  <Text style={styles.applyBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  filterBtn: {
    flex: 1,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  filterBtnText: {
    fontSize: 13,
    flex: 1,
  },
  hamburgerBtn: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  hamburgerCategoryPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hamburgerBtnText: {
    fontSize: 13,
  },
  activeIndicatorsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 8,
  },
  activeChipsScroll: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  indicatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  indicatorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  indicatorClose: {
    fontSize: 11,
    fontWeight: '700',
  },
  clearAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '700',
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 350,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalClose: {
    fontSize: 16,
    fontWeight: '600',
    padding: 4,
  },
  modalOptions: {
    padding: 12,
    gap: 8,
  },
  categoryOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  categoryOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  categoryIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryOptionLabel: {
    fontSize: 14,
  },
  categoryOptionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  checkMark: {
    fontSize: 15,
    fontWeight: '800',
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  filterOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  filterOptionLabel: {
    fontSize: 13,
  },
  modalFooter: {
    padding: 12,
    borderTopWidth: 1,
  },
  applyBtn: {
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

