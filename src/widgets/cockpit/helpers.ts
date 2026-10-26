/**
 * Widget Helper Functions
 *
 * Pure, stateless helper functions used across both Full (4×2) and Compact (4×1)
 * GpsCockpitWidget variants. No React imports — safe to call from non-UI contexts.
 *
 * Extracted from GpsCockpitWidget.tsx.
 */

import type { ColorProp } from 'react-native-android-widget/lib/typescript/widgets/utils/style.props';
import { C } from './palette';
import type { GpsCockpitWidgetData } from './types';

export function fuelBadge(fuelType: string): { label: string; bg: ColorProp; color: ColorProp; border: ColorProp } {
  switch (fuelType) {
    case 'electric':
      return { label: 'Electric', bg: '#082f49', color: '#7DD3FC', border: '#0369A1' };
    case 'hybrid':
      return { label: 'Hybrid', bg: C.greenBg, color: C.greenText, border: C.greenBorder };
    case 'cng':
      return { label: 'CNG', bg: C.greenBg, color: C.greenText, border: C.greenBorder };
    case 'diesel':
      return { label: 'Diesel', bg: '#1C1917', color: '#D6D3D1', border: '#57534E' };
    case 'petrol':
    default:
      return { label: 'Petrol', bg: '#1C1400', color: '#FDE68A', border: '#92400E' };
  }
}

export function getGpsBadge(quality: GpsCockpitWidgetData['gpsQuality'], accuracy: number | null) {
  const acc = accuracy ? ` (${Math.round(accuracy)} m)` : '';
  switch (quality) {
    case 'good':
      return { text: `GPS Lock${acc}`, color: C.greenText, bg: C.greenBg, border: C.greenBorder };
    case 'fair':
      return { text: `GPS Fair${acc}`, color: C.amberText, bg: C.amberBg, border: C.amberBorder };
    case 'poor':
      return { text: `GPS Weak${acc}`, color: C.redText, bg: C.redBg, border: C.redBorder };
    default:
      return { text: 'Acquiring GPS', color: C.textSub, bg: C.surfaceMid, border: C.border };
  }
}

export function speedLabel(kmh: number): string {
  if (kmh > 75) return 'Express';
  if (kmh > 35) return 'Cruising';
  if (kmh > 5) return 'City';
  return 'Idle';
}
