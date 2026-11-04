/**
 * RecordsHeader
 *
 * Implements:
 * - Requirement 2: Displays the tab name "Records" in the header.
 * - Requirement 4: Workable search integrated directly into the header with search icon.
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Spacing } from '@/constants/theme';
import type { RecordPalette } from './recordTheme';
import { SearchIconSvg } from './RecordSvgIcons';

interface RecordsHeaderProps {
  searchText: string;
  onChangeSearchText: (text: string) => void;
  colors: RecordPalette;
  totalRecordsCount?: number;
}

export const RecordsHeader = React.memo(function RecordsHeader({
  searchText,
  onChangeSearchText,
  colors,
  totalRecordsCount,
}: RecordsHeaderProps) {
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<any>(null);

  // If external text changes from outside and is non-empty, keep searching view open
  useEffect(() => {
    if (searchText && !isSearching) {
      setIsSearching(true);
    }
  }, [searchText]);

  const handleOpenSearch = () => {
    setIsSearching(true);
  };

  const handleCancelSearch = () => {
    setIsSearching(false);
    onChangeSearchText('');
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.borderLight,
        },
      ]}
    >
      {isSearching ? (
        // ── Active Search Bar in Header ──
        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchInputWrap,
              {
                backgroundColor: colors.surface,
                borderColor: colors.accent,
              },
            ]}
          >
            <SearchIconSvg size={16} color={colors.accent} />
            <TextInput
              ref={inputRef}
              autoFocus={true}
              style={[styles.input, { color: colors.text }]}
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
                style={styles.clearBtn}
              >
                <Text style={[styles.clearIcon, { color: colors.textTertiary }]}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={handleCancelSearch}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.cancelBtn}
          >
            <Text style={[styles.cancelText, { color: colors.accent }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // ── Standard Header: Tab Name + Search Trigger ──
        <View style={styles.titleRow}>
          <View style={styles.titleGroup}>
            <Text style={[styles.tabTitle, { color: colors.text }]}>Records</Text>
            {totalRecordsCount !== undefined && (
              <View
                style={[
                  styles.countBadge,
                  { backgroundColor: colors.surfaceSecondary },
                ]}
              >
                <Text style={[styles.countBadgeText, { color: colors.accentDark }]}>
                  {totalRecordsCount}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            onPress={handleOpenSearch}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[
              styles.searchTriggerBtn,
              { backgroundColor: colors.surface, borderColor: colors.borderLight },
            ]}
            activeOpacity={0.7}
          >
            <SearchIconSvg size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleRow: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  searchTriggerBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInputWrap: {
    flex: 1,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 2,
  },
  clearIcon: {
    fontSize: 13,
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
