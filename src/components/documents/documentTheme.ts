/**
 * DriveLedger — Vehicle Documents Theme Tokens
 *
 * Approved "Original Blue — Refined" Palette:
 * - Main background: #F5F8FC
 * - Cards and surfaces: #FFFFFF
 * - Primary colour: #183B63 (Deep Automotive Navy)
 * - Actions and links: #3983C7 (Refined Blue)
 * - Dividers and subtle borders: #DCE6F1
 *
 * Full dark mode support preserved.
 */

import { useColorScheme } from 'react-native';

export interface DocumentPalette {
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
  overlay: string;
}

export const DocumentColors: { light: DocumentPalette; dark: DocumentPalette } = {
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
    overlay: 'rgba(10, 20, 35, 0.8)',
  },
};

export function useDocumentColors(): DocumentPalette {
  const scheme = useColorScheme();
  return scheme === 'dark' ? DocumentColors.dark : DocumentColors.light;
}

