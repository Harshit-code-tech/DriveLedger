/**
 * BackupPasswordModal
 *
 * Password entry dialog shown before creating an encrypted .dlbak backup.
 * Validates minimum length and confirmation match before calling onSubmit.
 * Extracted from app/(tabs)/settings.tsx to keep the screen file lean.
 */

import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Sizing, Spacing } from '@/constants/theme';
import type { useThemeColors } from '@/hooks/useThemeColors';

export interface BackupPasswordModalProps {
  visible: boolean;
  onClose: () => void;
  /** Called after validation passes; receives the chosen password */
  onSubmit: (password: string) => void;
  colors: ReturnType<typeof useThemeColors>;
}

export function BackupPasswordModal({
  visible,
  onClose,
  onSubmit,
  colors,
}: BackupPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const reset = () => {
    setPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = () => {
    if (password.length < 4) {
      setPasswordError('Password must be at least 4 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match. Please re-enter.');
      return;
    }
    const chosen = password;
    reset();
    onSubmit(chosen);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.title, { color: colors.text }]}>
            Set Backup Password 🔒
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Choose a password to encrypt this backup with AES-256-GCM. You will need it to restore
            your data on this or another phone.
          </Text>

          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠️ Important: DriveLedger is 100% offline. There is no cloud backend and forgotten
              passwords cannot be recovered.
            </Text>
          </View>

          {passwordError ? (
            <Text style={styles.errorText}>{passwordError}</Text>
          ) : null}

          {/* Password field */}
          <View
            style={[
              styles.inputContainer,
              {
                borderColor: passwordError ? '#EF4444' : colors.border,
                backgroundColor: colors.card,
              },
            ]}
          >
            <TextInput
              style={[styles.inputFlexible, { color: colors.text }]}
              placeholder="Enter backup password (min 4 chars)"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setPasswordError(null);
              }}
            />
            <TouchableOpacity
              style={styles.eyeToggleButton}
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.eyeToggleText}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          {/* Confirm field */}
          <View
            style={[
              styles.inputContainer,
              {
                borderColor: passwordError ? '#EF4444' : colors.border,
                backgroundColor: colors.card,
              },
            ]}
          >
            <TextInput
              style={[styles.inputFlexible, { color: colors.text }]}
              placeholder="Confirm backup password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              value={confirmPassword}
              onChangeText={(t) => {
                setConfirmPassword(t);
                setPasswordError(null);
              }}
            />
            <TouchableOpacity
              style={styles.eyeToggleButton}
              onPress={() => setShowConfirmPassword((v) => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.eyeToggleText}>{showConfirmPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              onPress={handleClose}
            >
              <Text style={[styles.btnText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary }]}
              onPress={handleSubmit}
            >
              <Text style={[styles.btnText, { color: '#FFFFFF' }]}>Export</Text>
            </TouchableOpacity>
          </View>
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
    maxWidth: 360,
    borderRadius: Sizing.radiusLg,
    borderWidth: 1,
    padding: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
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
    marginBottom: Spacing.md,
  },
  warningBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: Sizing.radiusSm,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  warningText: {
    fontSize: 11,
    color: '#D97706',
    lineHeight: 15,
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Sizing.radiusMd,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  inputFlexible: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
  },
  eyeToggleButton: {
    padding: Spacing.xs,
    marginLeft: Spacing.xs,
  },
  eyeToggleText: {
    fontSize: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtn: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: Sizing.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
