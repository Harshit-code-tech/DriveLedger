/**
 * DocumentEmptyState
 *
 * Section 13: Empty and Error States
 * Actionable, informative empty state for both Active documents
 * and Renewal History views.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Spacing } from '@/constants/theme';
import type { DocumentPalette } from './documentTheme';
import type { DocumentTab } from './DocumentNavigation';

interface DocumentEmptyStateProps {
  activeTab: DocumentTab;
  onAddDocument: () => void;
  colors: DocumentPalette;
}

export const DocumentEmptyState = React.memo(function DocumentEmptyState({
  activeTab,
  onAddDocument,
  colors,
}: DocumentEmptyStateProps) {
  const isHistory = activeTab === 'history';

  return (
    <View style={styles.container}>
      <View style={[styles.iconWrap, { backgroundColor: colors.surfaceSecondary }]}>
        <Text style={styles.icon}>{isHistory ? '📜' : '📄'}</Text>
      </View>

      <Text style={[styles.title, { color: colors.text }]}>
        {isHistory ? 'No Renewal History Yet' : 'No Documents Added'}
      </Text>

      <Text style={[styles.description, { color: colors.textSecondary }]}>
        {isHistory
          ? 'When you renew insurance, PUC, or other vehicle certificates, superseded versions are safely archived here for legal, tax, and claim records.'
          : 'Keep your Registration Certificate (RC), Insurance, PUC, and FASTag securely stored offline for quick roadside compliance.'}
      </Text>

      {!isHistory && (
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.accent }]}
          onPress={onAddDocument}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Add vehicle document"
        >
          <Text style={styles.addButtonText}>+ Add First Document</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl * 1.5,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: Spacing.lg,
  },
  addButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: 11,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

