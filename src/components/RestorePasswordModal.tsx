/**
 * RestorePasswordModal
 *
 * Password entry dialog shown when a selected backup file requires decryption.
 * Handles verifying the password against the encrypted content via verifyBackupContent,
 * then calls onSuccess with the decrypted backup object.
 * Extracted from app/(tabs)/settings.tsx to keep the screen file lean.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Sizing, Spacing } from '@/constants/theme';
import { verifyBackupContent } from '@/engine/backupEngine';
import type { useThemeColors } from '@/hooks/useThemeColors';

export interface RestorePasswordModalProps {
  visible: boolean;
  /** The raw (encrypted) file content string to decrypt */
  fileContent: string | null;
  onClose: () => void;
  /** Called with the decrypted backup object after successful password verification */
  onSuccess: (backup: any) => void;
  colors: ReturnType<typeof useThemeColors>;
}

export function RestorePasswordModal({
  visible,
  fileContent,
  onClose,
  onSuccess,
  colors,
}: RestorePasswordModalProps) {
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const reset = () => {
    setPassword('');
    setPasswordError(null);
    setShowPassword(false);
    setIsVerifying(false);
  };

  const handleClose = () => {
    if (isVerifying) return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!fileContent) return;
    if (!password) {
      setPasswordError('Please enter your backup password.');
      return;
    }

    setIsVerifying(true);
    setPasswordError(null);
    // Give the UI a moment to show the verifying state
    await new Promise((resolve) => setTimeout(resolve, 80));

    try {
      const verified = await verifyBackupContent(fileContent, password);
      setIsVerifying(false);

      if (!verified.success || !verified.backup) {
        setPasswordError(verified.message || 'Incorrect password or corrupted backup file.');
        return;
      }

      reset();
      onSuccess(verified.backup);
    } catch (e) {
      setIsVerifying(false);
      setPasswordError(
        e instanceof Error ? e.message : 'Incorrect password or corrupted backup file.'
      );
    }
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
            Enter Backup Password 🔓
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            This backup file is encrypted. Please enter the password that was set when it was
            exported.
          </Text>

          {passwordError ? (
            <Text style={styles.errorText}>{passwordError}</Text>
          ) : null}

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
              placeholder="Enter backup password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              value={password}
              editable={!isVerifying}
              onChangeText={(t) => {
                setPassword(t);
                setPasswordError(null);
              }}
            />
            <TouchableOpacity
              style={styles.eyeToggleButton}
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              disabled={isVerifying}
            >
              <Text style={styles.eyeToggleText}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: colors.border }]}
              onPress={handleClose}
              disabled={isVerifying}
            >
              <Text style={[styles.btnText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: colors.primary, opacity: isVerifying ? 0.75 : 1 },
              ]}
              onPress={handleSubmit}
              disabled={isVerifying}
            >
              {isVerifying ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={[styles.btnText, { color: '#FFFFFF' }]}>Verifying...</Text>
                </View>
              ) : (
                <Text style={[styles.btnText, { color: '#FFFFFF' }]}>Unlock</Text>
              )}
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
