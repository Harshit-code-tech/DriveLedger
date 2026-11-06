/**
 * Manage Screen Theme Tokens
 *
 * Visual palette:
 * - Main background: #F5F8FC
 * - Cards and surfaces: #FFFFFF
 * - Primary text / brand: #183B63
 * - Actions and links: #3983C7
 * - Dividers and borders: #DCE6F1
 *
 * Full dark mode support matching DriveLedger automotive system.
 */

import { useColorScheme } from 'react-native';
import { usePreferencesStore } from '@/stores/preferencesStore';

export interface ManagePalette {
  isDark: boolean;
  background: string;
  surface: string;
  surfaceSecondary: string;
  surfaceElevated: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentDark: string;
  divider: string;
  border: string;
  borderLight: string;
  statusNormal: string;
  statusNormalBg: string;
  statusWarning: string;
  statusWarningBg: string;
  statusCritical: string;
  statusCriticalBg: string;
  danger: string;
  overlay: string;
}

export const ManageColors: { light: ManagePalette; dark: ManagePalette } = {
  light: {
    isDark: false,
    background: '#F5F8FC',
    surface: '#FFFFFF',
    surfaceSecondary: '#EDF3FA',
    surfaceElevated: '#FFFFFF',
    text: '#183B63',
    textSecondary: '#536B88',
    textTertiary: '#8A9EB5',
    accent: '#3983C7',
    accentDark: '#183B63',
    divider: '#DCE6F1',
    border: '#DCE6F1',
    borderLight: '#E8F0F7',
    statusNormal: '#10B981',
    statusNormalBg: '#E0F5EE',
    statusWarning: '#F59E0B',
    statusWarningBg: '#FEF3C7',
    statusCritical: '#EF4444',
    statusCriticalBg: '#FEE2E2',
    danger: '#EF4444',
    overlay: 'rgba(24, 59, 99, 0.65)',
  },
  dark: {
    isDark: true,
    background: '#0E1A2B',
    surface: '#14253D',
    surfaceSecondary: '#1A2F4C',
    surfaceElevated: '#1E3657',
    text: '#F5F8FC',
    textSecondary: '#96B0CC',
    textTertiary: '#607C9A',
    accent: '#4FA0E8',
    accentDark: '#183B63',
    divider: '#1F3858',
    border: '#1F3858',
    borderLight: '#182E49',
    statusNormal: '#34D399',
    statusNormalBg: 'rgba(52, 211, 153, 0.15)',
    statusWarning: '#FBBF24',
    statusWarningBg: 'rgba(251, 191, 36, 0.15)',
    statusCritical: '#F87171',
    statusCriticalBg: 'rgba(248, 113, 113, 0.15)',
    danger: '#F87171',
    overlay: 'rgba(10, 20, 35, 0.8)',
  },
};

export function useManageColors(): ManagePalette {
  const systemScheme = useColorScheme();
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const activeScheme = themeMode === 'system' ? systemScheme : themeMode;
  return activeScheme === 'dark' ? ManageColors.dark : ManageColors.light;
}
