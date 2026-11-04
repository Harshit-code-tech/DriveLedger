/**
 * DriveLedger — Records Theme Tokens
 *
 * Visual palette defined in Section 6 of docs/refurnish/record.md:
 * Light:
 *   Page background: #F2EDE3
 *   Surface: #FFFFFF
 *   Primary text: #282725
 *   Secondary text: #77736D
 *   Accent: #C65B2E
 *   Divider: #D8D0C3
 * Dark:
 *   Page background: #1D1D1B
 *   Surface: #292927
 *   Primary text: #F2EDE3
 *   Secondary text: #AAA49A
 *   Accent: #E07848
 *   Divider: #41403C
 */

import { useColorScheme } from 'react-native';

export interface RecordPalette {
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

export const RecordColors: { light: RecordPalette; dark: RecordPalette } = {
  light: {
    isDark: false,
    background: '#F2EDE3',
    surface: '#FFFFFF',
    surfaceSecondary: '#EBE5D9',
    surfaceElevated: '#FFFFFF',
    text: '#282725',
    textSecondary: '#77736D',
    textTertiary: '#9E9991',
    accent: '#C65B2E',
    accentDark: '#A84820',
    divider: '#D8D0C3',
    border: '#D8D0C3',
    borderLight: '#E8E2D5',
    statusNormal: '#16A34A',
    statusNormalBg: '#DCFCE7',
    statusWarning: '#D97706',
    statusWarningBg: '#FEF3C7',
    statusCritical: '#DC2626',
    statusCriticalBg: '#FEE2E2',
    overlay: 'rgba(29, 29, 27, 0.65)',
  },
  dark: {
    isDark: true,
    background: '#1D1D1B',
    surface: '#292927',
    surfaceSecondary: '#333330',
    surfaceElevated: '#383835',
    text: '#F2EDE3',
    textSecondary: '#AAA49A',
    textTertiary: '#77736D',
    accent: '#E07848',
    accentDark: '#C65B2E',
    divider: '#41403C',
    border: '#41403C',
    borderLight: '#333330',
    statusNormal: '#22C55E',
    statusNormalBg: 'rgba(34, 197, 94, 0.15)',
    statusWarning: '#F59E0B',
    statusWarningBg: 'rgba(245, 158, 11, 0.15)',
    statusCritical: '#EF4444',
    statusCriticalBg: 'rgba(239, 68, 68, 0.15)',
    overlay: 'rgba(0, 0, 0, 0.75)',
  },
};

export function useRecordColors(): RecordPalette {
  const scheme = useColorScheme();
  return scheme === 'dark' ? RecordColors.dark : RecordColors.light;
}
