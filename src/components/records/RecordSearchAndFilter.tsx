/**
 * RecordSearchAndFilter
 *
 * Section 4.3: Search and Filter Controls
 * Section 4.4: Active Filter Indicators
 */

import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { DateRangeOption, RecordCategory, SortOrder } from './recordTypes';
import type { RecordPalette } from './recordTheme';

interface RecordSearchAndFilterProps {
  searchText: string;
  onChangeSearchText: (text: string) => void;
  selectedCategory: RecordCategory;
  onClearCategory: () => void;
  dateRange: DateRangeOption;
  onChangeDateRange: (range: DateRangeOption) => void;
  sortOrder: SortOrder;
  onChangeSortOrder: (order: SortOrder) => void;
  onClearAll: () => void;
  isEV?: boolean;
  colors: RecordPalette;
}

const DATE_RANGE_OPTIONS: { key: DateRangeOption; label: string }[] = [
  { key: 'all', label: 'All Time' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: '30days', label: 'Last 30 Days' },
  { key: '3months', label: 'Last 3 Months' },
  { key: 'year', label: 'This Year' },
];

export const RecordSearchAndFilter = React.memo(function RecordSearchAndFilter({
  searchText,
  onChangeSearchText,
  selectedCategory,
  onClearCategory,
  dateRange,
  onChangeDateRange,
  sortOrder,
  onChangeSortOrder,
  onClearAll,
  isEV = false,
  colors,
}: RecordSearchAndFilterProps) {
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);

  const activeDateOption =
    DATE_RANGE_OPTIONS.find((o) => o.key === dateRange) || DATE_RANGE_OPTIONS[0];

  const hasActiveFilters =
    selectedCategory !== 'all' ||
    dateRange !== 'all' ||
    searchText.trim().length > 0 ||
    sortOrder !== 'newest';

  const categoryLabel =
    selectedCategory === 'fuel'
      ? isEV
        ? 'Charging'
        : 'Fuel'
      : selectedCategory === 'service'
      ? 'Service'
      : selectedCategory === 'trips'
      ? 'Trips'
      : selectedCategory === 'expenses'
      ? 'Expenses'
      : '';

  return (
    <View style={styles.container}>
      {/* ── Search Input ── */}
      <View
        style={[
          styles.searchBox,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search records..."
          placeholderTextColor={colors.textTertiary}
          value={searchText}
          onChangeText={onChangeSearchText}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {searchText.length > 0 && (
          <TouchableOpacity
            onPress={() => onChangeSearchText('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.clearSearchBtn}
          >
            <Text style={[styles.clearSearchIcon, { color: colors.textTertiary }]}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Controls Row: Date Range & Sort Dropdowns ── */}
      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={[
            styles.controlChip,
            {
              backgroundColor: colors.surface,
              borderColor: dateRange !== 'all' ? colors.accent : colors.border,
            },
          ]}
          onPress={() => setDateModalVisible(true)}
          activeOpacity={0.75}
        >
          <Text
            style={[
              styles.controlChipText,
              {
                color: dateRange !== 'all' ? colors.accent : colors.text,
                fontWeight: dateRange !== 'all' ? '700' : '500',
              },
            ]}
          >
            {dateRange === 'all' ? 'Date range' : activeDateOption.label} ▼
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.controlChip,
            {
              backgroundColor: colors.surface,
              borderColor: sortOrder !== 'newest' ? colors.accent : colors.border,
            },
          ]}
          onPress={() => setSortModalVisible(true)}
          activeOpacity={0.75}
        >
          <Text
            style={[
              styles.controlChipText,
              {
                color: sortOrder !== 'newest' ? colors.accent : colors.text,
                fontWeight: sortOrder !== 'newest' ? '700' : '500',
              },
            ]}
          >
            {sortOrder === 'newest' ? 'Newest first' : 'Oldest first'} ▼
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Section 4.4: Active Filter Indicators ── */}
      {hasActiveFilters && (
        <View style={styles.activeFiltersRow}>
          <View style={styles.activeChipsContainer}>
            {selectedCategory !== 'all' && (
              <TouchableOpacity
                style={[styles.indicatorPill, { backgroundColor: colors.surfaceSecondary }]}
                onPress={onClearCategory}
                activeOpacity={0.7}
              >
                <Text style={[styles.indicatorText, { color: colors.text }]}>
                  {categoryLabel}
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
                onPress={() => onChangeSearchText('')}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.indicatorText, { color: colors.text }]}
                  numberOfLines={1}
                >
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
          </View>

          <TouchableOpacity
            onPress={onClearAll}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.clearAllBtn}
          >
            <Text style={[styles.clearAllText, { color: colors.accent }]}>
              Clear all
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Date Range Modal ── */}
      {dateModalVisible && (
        <Modal
          visible={dateModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setDateModalVisible(false)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setDateModalVisible(false)}
          >
            <Pressable
              style={[
                styles.modalCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <View
                style={[
                  styles.modalHeader,
                  { borderBottomColor: colors.borderLight },
                ]}
              >
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Filter by Date Range
                </Text>
                <TouchableOpacity
                  onPress={() => setDateModalVisible(false)}
                  hitSlop={8}
                >
                  <Text style={[styles.modalClose, { color: colors.textSecondary }]}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalOptions}>
                {DATE_RANGE_OPTIONS.map((opt) => {
                  const isSelected = dateRange === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[
                        styles.optionRow,
                        {
                          backgroundColor: isSelected
                            ? colors.surfaceSecondary
                            : 'transparent',
                        },
                      ]}
                      onPress={() => {
                        onChangeDateRange(opt.key);
                        setDateModalVisible(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.optionLabel,
                          {
                            color: isSelected ? colors.accent : colors.text,
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {isSelected && (
                        <Text style={[styles.optionCheck, { color: colors.accent }]}>✓</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {/* ── Sort Order Modal ── */}
      {sortModalVisible && (
        <Modal
          visible={sortModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setSortModalVisible(false)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setSortModalVisible(false)}
          >
            <Pressable
              style={[
                styles.modalCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={(e) => e.stopPropagation()}
            >
              <View
                style={[
                  styles.modalHeader,
                  { borderBottomColor: colors.borderLight },
                ]}
              >
                <Text style={[styles.modalTitle, { color: colors.text }]}>Sort Order</Text>
                <TouchableOpacity
                  onPress={() => setSortModalVisible(false)}
                  hitSlop={8}
                >
                  <Text style={[styles.modalClose, { color: colors.textSecondary }]}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalOptions}>
                {[
                  { key: 'newest' as SortOrder, label: 'Newest first' },
                  { key: 'oldest' as SortOrder, label: 'Oldest first' },
                ].map((opt) => {
                  const isSelected = sortOrder === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[
                        styles.optionRow,
                        {
                          backgroundColor: isSelected
                            ? colors.surfaceSecondary
                            : 'transparent',
                        },
                      ]}
                      onPress={() => {
                        onChangeSortOrder(opt.key);
                        setSortModalVisible(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.optionLabel,
                          {
                            color: isSelected ? colors.accent : colors.text,
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {isSelected && (
                        <Text style={[styles.optionCheck, { color: colors.accent }]}>✓</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
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
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  searchIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchIcon: {
    fontSize: 14,
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  controlChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  controlChipText: {
    fontSize: 12,
  },
  activeFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },
  activeChipsContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  indicatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
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
    paddingHorizontal: 6,
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
    maxWidth: 340,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalClose: {
    fontSize: 15,
    fontWeight: '600',
    padding: 4,
  },
  modalOptions: {
    paddingVertical: 6,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  optionLabel: {
    fontSize: 14,
  },
  optionCheck: {
    fontSize: 15,
    fontWeight: '800',
  },
});

