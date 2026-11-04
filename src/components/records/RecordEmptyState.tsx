/**
 * RecordEmptyState
 *
 * Section 5: Empty and No-Result States
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { RecordPalette } from './recordTheme';

interface RecordEmptyStateProps {
  isFiltered: boolean;
  onClearFilters: () => void;
  onAddFuel?: () => void;
  onAddService?: () => void;
  onAddExpense?: () => void;
  onAddTrip?: () => void;
  isEV?: boolean;
  colors: RecordPalette;
}

export const RecordEmptyState = React.memo(function RecordEmptyState({
  isFiltered,
  onClearFilters,
  onAddFuel,
  onAddService,
  onAddExpense,
  onAddTrip,
  isEV = false,
  colors,
}: RecordEmptyStateProps) {
  if (isFiltered) {
    return (
      <View style={styles.container}>
        <Text style={styles.icon}>🔍</Text>
        <Text style={[styles.title, { color: colors.text }]}>No records found</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Try changing your search or filters.
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.accent }]}
          onPress={onClearFilters}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Clear filters</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>📋</Text>
      <Text style={[styles.title, { color: colors.text }]}>No records yet</Text>
      <Text style={[styles.description, { color: colors.textSecondary }]}>
        Records logged for this vehicle will appear here in chronological order.
      </Text>

      {/* Quick Logging Shortcuts */}
      <View style={styles.actionGrid}>
        {onAddFuel && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={onAddFuel}
            activeOpacity={0.7}
          >
            <Text style={styles.actionBtnIcon}>{isEV ? '⚡' : '⛽'}</Text>
            <Text style={[styles.actionBtnText, { color: colors.text }]}>
              {isEV ? 'Add Charge' : 'Log Fuel'}
            </Text>
          </TouchableOpacity>
        )}

        {onAddService && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={onAddService}
            activeOpacity={0.7}
          >
            <Text style={styles.actionBtnIcon}>🔧</Text>
            <Text style={[styles.actionBtnText, { color: colors.text }]}>Log Service</Text>
          </TouchableOpacity>
        )}

        {onAddExpense && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={onAddExpense}
            activeOpacity={0.7}
          >
            <Text style={styles.actionBtnIcon}>💰</Text>
            <Text style={[styles.actionBtnText, { color: colors.text }]}>Log Expense</Text>
          </TouchableOpacity>
        )}

        {onAddTrip && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={onAddTrip}
            activeOpacity={0.7}
          >
            <Text style={styles.actionBtnIcon}>🚗</Text>
            <Text style={[styles.actionBtnText, { color: colors.text }]}>Log Trip</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  icon: {
    fontSize: 44,
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  button: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 24,
    justifyContent: 'center',
    maxWidth: 320,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionBtnIcon: {
    fontSize: 16,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

