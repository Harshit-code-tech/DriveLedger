/**
 * useThemeColors hook
 *
 * Returns the correct color palette based on the current system theme.
 * Supports 'light', 'dark', and 'system' (auto-detect).
 */

import { useColorScheme } from 'react-native';
import { Colors, type ThemeColors } from '@/constants/theme';
import { usePreferencesStore } from '@/stores/preferencesStore';

/**
 * Returns the active color palette based on user preference or device's color scheme.
 *
 * @returns ThemeColors object (light or dark palette)
 */
export function useThemeColors(): ThemeColors {
  const systemScheme = useColorScheme();
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const activeScheme = themeMode === 'system' ? systemScheme : themeMode;
  return activeScheme === 'dark' ? Colors.dark : Colors.light;
}
