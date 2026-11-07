/**
 * Design System & Theme
 *
 * Centralized design tokens for DriveLedger.
 * All colors, typography, spacing, and sizing come from here.
 *
 * DESIGN PRINCIPLES (from charter):
 * - Body text 16sp minimum. Numbers and stats 20sp+.
 * - Minimum 48dp touch targets. Primary actions get 56dp+.
 * - WCAG AA contrast ratio (4.5:1 minimum).
 * - One-handed operation. Bottom-sheet forms.
 * - Theme: system / light / dark.
 *
 * COLOR PALETTE:
 * - Primary: Deep blue (trustworthy, automotive feel)
 * - Accent: Amber/Orange (fuel, energy, warmth)
 * - Success: Green (good mileage, on-time docs)
 * - Warning: Orange (unusual mileage, expiring soon)
 * - Danger: Red (errors, expired, low mileage)
 */

export const Colors = {
  light: {
    // ── Backgrounds ──
    background: '#F5F8FC',
    surface: '#FFFFFF',
    surfaceSecondary: '#EDF3FA',
    surfaceElevated: '#FFFFFF',
    card: '#FFFFFF',

    // ── Primary (Deep Blue) & Accent (Automotive Orange) ──
    primary: '#3983C7',
    primaryDark: '#183B63',
    primaryLight: '#EDF3FA',
    primaryText: '#FFFFFF',

    accent: '#EA580C',
    accentDark: '#C2410C',
    accentLight: '#FFEDD5',

    // ── Text ──
    text: '#183B63',
    textSecondary: '#536B88',
    textTertiary: '#8A9EB5',
    textOnPrimary: '#FFFFFF',

    // ── Borders & Dividers ──
    border: '#DCE6F1',
    borderLight: '#E8F0F7',
    divider: '#DCE6F1',

    // ── Semantic ──
    success: '#10B981',
    successLight: '#E0F5EE',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    danger: '#EF4444',
    dangerLight: '#FEE2E2',

    statusNormal: '#10B981',
    statusNormalBg: '#E0F5EE',
    statusWarning: '#F59E0B',
    statusWarningBg: '#FEF3C7',
    statusCritical: '#EF4444',
    statusCriticalBg: '#FEE2E2',

    // ── Tab Bar ──
    tabBar: '#FFFFFF',
    tabBarBorder: '#DCE6F1',
    tabIconDefault: '#8A9EB5',
    tabIconSelected: '#3983C7',

    // ── Misc ──
    shadow: 'rgba(24, 59, 99, 0.08)',
    overlay: 'rgba(24, 59, 99, 0.65)',
    shimmer: '#E8F0F7',
  },
  dark: {
    // ── Backgrounds ──
    background: '#0E1A2B',
    surface: '#14253D',
    surfaceSecondary: '#1A2F4C',
    surfaceElevated: '#1E3657',
    card: '#14253D',

    // ── Primary & Accent (Automotive Orange) ──
    primary: '#4FA0E8',
    primaryDark: '#183B63',
    primaryLight: '#1A2F4C',
    primaryText: '#FFFFFF',

    accent: '#F97316',
    accentDark: '#EA580C',
    accentLight: 'rgba(249, 115, 22, 0.15)',

    // ── Text ──
    text: '#F5F8FC',
    textSecondary: '#96B0CC',
    textTertiary: '#607C9A',
    textOnPrimary: '#FFFFFF',

    // ── Borders & Dividers ──
    border: '#1F3858',
    borderLight: '#182E49',
    divider: '#1F3858',

    // ── Semantic ──
    success: '#34D399',
    successLight: 'rgba(52, 211, 153, 0.15)',
    warning: '#FBBF24',
    warningLight: 'rgba(251, 191, 36, 0.15)',
    danger: '#F87171',
    dangerLight: 'rgba(248, 113, 113, 0.15)',

    statusNormal: '#34D399',
    statusNormalBg: 'rgba(52, 211, 153, 0.15)',
    statusWarning: '#FBBF24',
    statusWarningBg: 'rgba(251, 191, 36, 0.15)',
    statusCritical: '#F87171',
    statusCriticalBg: 'rgba(248, 113, 113, 0.15)',

    // ── Tab Bar ──
    tabBar: '#14253D',
    tabBarBorder: '#1F3858',
    tabIconDefault: '#607C9A',
    tabIconSelected: '#4FA0E8',

    // ── Misc ──
    shadow: 'rgba(0, 0, 0, 0.35)',
    overlay: 'rgba(10, 20, 35, 0.8)',
    shimmer: '#1A2F4C',
  },
};

export type ThemeColors = typeof Colors.light;

// ─── Typography ─────────────────────────────────────────────────────

export const Typography = {
  /** Large page titles */
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  /** Section headers */
  h2: {
    fontSize: 22,
    fontWeight: '600' as const,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  /** Card titles */
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  /** Body text — charter mandates 16sp minimum */
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  /** Secondary body text */
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  /** Labels and captions */
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
    letterSpacing: 0.4,
  },
  /** Stat numbers — charter mandates 20sp+ */
  stat: {
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  /** Medium stat numbers */
  statMedium: {
    fontSize: 24,
    fontWeight: '600' as const,
    lineHeight: 30,
  },
  /** Button text */
  button: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
  },
};

// ─── Spacing ────────────────────────────────────────────────────────

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 40,
};

// ─── Sizing ─────────────────────────────────────────────────────────

export const Sizing = {
  /** Minimum touch target — charter mandates 48dp */
  touchTarget: 48,
  /** Primary action button — charter mandates 56dp+ */
  primaryButton: 56,
  /** FAB (Floating Action Button) */
  fab: 64,
  /** Icon sizes */
  iconSm: 18,
  iconMd: 24,
  iconLg: 32,
  /** Border radius */
  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
  radiusXl: 20,
  radiusFull: 999,
  /** Card elevation shadow */
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
};
