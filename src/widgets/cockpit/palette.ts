/**
 * Widget Color Palette — Cyber-OLED Theme
 *
 * Shared palette object used by GpsCockpitWidget, GpsCockpitCompactWidget,
 * and their sub-components. All colors target an OLED-black dark background
 * with high-contrast accent values appropriate for a car-dashboard aesthetic.
 *
 * Extracted from GpsCockpitWidget.tsx.
 */

export const C = {
  bg: '#0B1120',
  surface: '#162032',
  surfaceMid: '#1E293B',
  surfaceLight: '#334155',
  border: '#334155',
  text: '#F8FAFC',
  textSub: '#94A3B8',
  textDim: '#64748B',

  cyan: '#06B6D4',
  cyanBg: '#083344',
  cyanBorder: '#0E7490',
  cyanText: '#67E8F9',

  green: '#10B981',
  greenBg: '#064E3B',
  greenBorder: '#059669',
  greenText: '#6EE7B7',

  amber: '#F59E0B',
  amberBg: '#451A03',
  amberBorder: '#D97706',
  amberText: '#FCD34D',

  red: '#EF4444',
  redBg: '#450A0A',
  redBorder: '#DC2626',
  redText: '#FCA5A5',

  indigo: '#6366F1',
  indigoBg: '#1E1B4B',
  indigoBorder: '#4F46E5',
  indigoText: '#A5B4FC',
} as const;
