/**
 * OperationProgressModal
 *
 * A generic full-screen overlay spinner shown during long async operations
 * (backup, restore, CSV export, update check). Blocks interaction and
 * communicates the current operation via title + subtitle text.
 *
 * Extracted from app/(tabs)/settings.tsx to keep the screen file lean.
 * The same visual design is used for both the "Checking for Updates" spinner
 * and the backup/restore/export progress spinners — unified here.
 */

import React from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Sizing, Spacing } from '@/constants/theme';
import type { useThemeColors } from '@/hooks/useThemeColors';

export interface OperationProgressModalProps {
  visible: boolean;
  /** Headline shown below the spinner, e.g. "Backup in Progress" */
  title: string;
  /** Secondary line, e.g. "Encrypting with AES-256-GCM. Please wait..." */
  subtitle: string;
  colors: ReturnType<typeof useThemeColors>;
}

export function OperationProgressModal({
  visible,
  title,
  subtitle,
  colors,
}: OperationProgressModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[styles.iconContainer, { backgroundColor: colors.primary + '18' }]}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: Sizing.radiusLg,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
