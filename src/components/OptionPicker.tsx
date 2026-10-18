/**
 * OptionPicker<T>
 *
 * A generic bottom-sheet modal that presents a list of labelled options
 * for a preference setting. The currently selected option is highlighted
 * with the primary colour and a checkmark.
 *
 * Originally defined inline in app/(tabs)/settings.tsx; extracted so
 * it can be reused by any screen that needs a single-choice picker.
 *
 * USAGE:
 *   <OptionPicker
 *     visible={showCurrencyPicker}
 *     title="Currency"
 *     options={CURRENCY_OPTIONS}
 *     selected={currency}
 *     onSelect={setCurrency}
 *     onClose={() => setShowCurrencyPicker(false)}
 *     colors={colors}
 *   />
 */

import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Typography, Spacing, Sizing } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';

export interface OptionPickerOption<T extends string> {
  value: T;
  label: string;
  /** Optional sub-label, e.g. the currency symbol */
  symbol?: string;
}

export interface OptionPickerProps<T extends string> {
  visible: boolean;
  title: string;
  options: OptionPickerOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  onClose: () => void;
  colors: ReturnType<typeof useThemeColors>;
}

export function OptionPicker<T extends string>({
  visible, title, options, selected, onSelect, onClose, colors,
}: OptionPickerProps<T>) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <Text style={[Typography.h3, { color: colors.text, marginBottom: Spacing.lg }]}>
            {title}
          </Text>
          {options.map((opt) => {
            const isSelected = opt.value === selected;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.option,
                  {
                    backgroundColor: isSelected ? colors.primaryLight ?? colors.surface : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => { onSelect(opt.value); onClose(); }}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      Typography.body,
                      {
                        color: isSelected ? colors.primary : colors.text,
                        fontWeight: isSelected ? '700' : '400',
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {opt.symbol && (
                    <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
                      Symbol: {opt.symbol}
                    </Text>
                  )}
                </View>
                {isSelected && (
                  <Text style={{ color: colors.primary, fontSize: 20, fontWeight: '700' }}>✓</Text>
                )}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[styles.cancelBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={[Typography.button, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Sizing.radiusXl,
    borderTopRightRadius: Sizing.radiusXl,
    padding: Spacing.xxl,
    paddingBottom: Spacing.section,
    maxHeight: '75%',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Sizing.radiusMd,
    borderWidth: 1.5,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    minHeight: Sizing.touchTarget,
  },
  cancelBtn: {
    borderRadius: Sizing.radiusMd,
    borderWidth: 1,
    height: Sizing.primaryButton,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
});
