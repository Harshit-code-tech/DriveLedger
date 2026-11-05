/**
 * DocumentNavigation
 *
 * Section 8: Document Navigation (Active vs. Renewal History)
 * Segmented control enabling switching between active valid documents
 * and archived renewal history, with generous spacing.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Spacing } from '@/constants/theme';
import type { DocumentPalette } from './documentTheme';

export type DocumentTab = 'active' | 'history';

interface DocumentNavigationProps {
  activeTab: DocumentTab;
  onTabChange: (tab: DocumentTab) => void;
  activeCount: number;
  historyCount: number;
  colors: DocumentPalette;
}

export const DocumentNavigation = React.memo(function DocumentNavigation({
  activeTab,
  onTabChange,
  activeCount,
  historyCount,
  colors,
}: DocumentNavigationProps) {
  return (
    <View style={styles.container}>
      <View
        style={[
          styles.segmentedContainer,
          {
            backgroundColor: colors.surfaceSecondary,
            borderColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'active' && {
              backgroundColor: colors.accentDark,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.12,
              shadowRadius: 2,
              elevation: 2,
            },
          ]}
          onPress={() => onTabChange('active')}
          activeOpacity={0.8}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'active' }}
          accessibilityLabel={`Active documents, ${activeCount} records`}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'active' ? '#FFFFFF' : colors.textSecondary,
                fontWeight: activeTab === 'active' ? '700' : '600',
              },
            ]}
          >
            Active ({activeCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'history' && {
              backgroundColor: colors.accentDark,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.12,
              shadowRadius: 2,
              elevation: 2,
            },
          ]}
          onPress={() => onTabChange('history')}
          activeOpacity={0.8}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'history' }}
          accessibilityLabel={`Renewal history, ${historyCount} records`}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'history' ? '#FFFFFF' : colors.textSecondary,
                fontWeight: activeTab === 'history' ? '700' : '600',
              },
            ]}
          >
            Renewal History ({historyCount})
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 2,
    paddingBottom: Spacing.md,
  },
  segmentedContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 12.5,
    letterSpacing: -0.1,
  },
});
