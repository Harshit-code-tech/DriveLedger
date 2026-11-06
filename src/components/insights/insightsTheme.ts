/**
 * DriveLedger — Insights Theme Tokens
 *
 * Section 9: Visual Design System
 * Palette:
 * - Main background: #F5F8FC
 * - Cards and surfaces: #FFFFFF
 * - Primary text / primary brand: #183B63 (Automotive Navy)
 * - Actions and links: #3983C7 (Refined Blue)
 * - Dividers and borders: #DCE6F1
 *
 * Full dark mode support preserved.
 */

import { useColorScheme } from 'react-native';
import { usePreferencesStore } from '@/stores/preferencesStore';

export interface InsightsPalette {
  isDark: boolean;
  background: string;
  surface: string;
  surfaceSecondary: string;
  surfaceElevated: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  primary: string;
  primaryLight: string;
  accent: string;
  accentDark: string;
  divider: string;
  border: string;
  borderLight: string;
  // Performance tiers (Section 7D)
  tierGreen: string;
  tierGreenBg: string;
  tierOrange: string;
  tierOrangeBg: string;
  tierYellow: string;
  tierYellowBg: string;
  tierRed: string;
  tierRedBg: string;
  // Feedback states
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  danger: string;
  dangerLight: string;
  overlay: string;
}

export const InsightsColors: { light: InsightsPalette; dark: InsightsPalette } = {
  light: {
    isDark: false,
    background: '#F5F8FC',
    surface: '#FFFFFF',
    surfaceSecondary: '#EDF3FA',
    surfaceElevated: '#FFFFFF',
    text: '#183B63',
    textSecondary: '#536B88',
    textTertiary: '#8A9EB5',
    primary: '#183B63',
    primaryLight: 'rgba(24, 59, 99, 0.08)',
    accent: '#3983C7',
    accentDark: '#183B63',
    divider: '#DCE6F1',
    border: '#DCE6F1',
    borderLight: '#E8F0F7',
    // 4 Performance Tiers (Section 7D)
    tierGreen: '#10B981',
    tierGreenBg: '#E0F5EE',
    tierOrange: '#F59E0B',
    tierOrangeBg: '#FEF3C7',
    tierYellow: '#EAB308',
    tierYellowBg: '#FEF9C3',
    tierRed: '#EF4444',
    tierRedBg: '#FEE2E2',
    success: '#10B981',
    successLight: '#E0F5EE',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    danger: '#EF4444',
    dangerLight: '#FEE2E2',
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
    primary: '#4FA0E8',
    primaryLight: 'rgba(79, 160, 232, 0.15)',
    accent: '#4FA0E8',
    accentDark: '#183B63',
    divider: '#1F3858',
    border: '#1F3858',
    borderLight: '#182E49',
    tierGreen: '#34D399',
    tierGreenBg: 'rgba(52, 211, 153, 0.15)',
    tierOrange: '#FBBF24',
    tierOrangeBg: 'rgba(251, 191, 36, 0.15)',
    tierYellow: '#FACC15',
    tierYellowBg: 'rgba(250, 204, 21, 0.15)',
    tierRed: '#F87171',
    tierRedBg: 'rgba(248, 113, 113, 0.15)',
    success: '#34D399',
    successLight: 'rgba(52, 211, 153, 0.15)',
    warning: '#FBBF24',
    warningLight: 'rgba(251, 191, 36, 0.15)',
    danger: '#F87171',
    dangerLight: 'rgba(248, 113, 113, 0.15)',
    overlay: 'rgba(10, 20, 35, 0.8)',
  },
};

export function useInsightsColors(): InsightsPalette {
  const systemScheme = useColorScheme();
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const activeScheme = themeMode === 'system' ? systemScheme : themeMode;
  return activeScheme === 'dark' ? InsightsColors.dark : InsightsColors.light;
}

