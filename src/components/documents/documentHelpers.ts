/**
 * Document Helpers & Pure Utility Functions
 *
 * Provides status calculation, date evaluation, and filename formatting
 * for Vehicle Documents presentation.
 */

import { daysUntil } from '@/utils/date';
import type { VehicleDocument } from '@/types/document';
import type { DocumentPalette } from './documentTheme';

export type DocumentValidityStatus =
  | 'valid'
  | 'expiring_soon'
  | 'expired'
  | 'no_expiry'
  | 'superseded';

export interface DocumentValidityInfo {
  status: DocumentValidityStatus;
  label: string;
  daysRemaining: number | null;
  textColor: string;
  bgColor: string;
  borderColor: string;
}

/**
 * Extracts a human-readable filename from a file URI or local path.
 */
export function getAttachmentDisplayName(uri?: string | null): string {
  if (!uri) return '';
  const cleanUri = uri.split('?')[0];
  const lastSlash = cleanUri.lastIndexOf('/');
  const rawName = lastSlash !== -1 ? cleanUri.slice(lastSlash + 1) : cleanUri;
  try {
    return decodeURIComponent(rawName);
  } catch {
    return rawName;
  }
}

/**
 * Evaluates document validity based on existing expiration business logic.
 */
export function getDocumentValidityInfo(
  expiryDate: string | null | undefined,
  type: string,
  isSuperseded: boolean,
  colors: DocumentPalette
): DocumentValidityInfo {
  if (isSuperseded) {
    return {
      status: 'superseded',
      label: 'Superseded 🔄',
      daysRemaining: null,
      textColor: colors.textSecondary,
      bgColor: colors.surfaceSecondary,
      borderColor: colors.borderLight,
    };
  }

  if (!expiryDate) {
    return {
      status: 'no_expiry',
      label: 'No Expiry',
      daysRemaining: null,
      textColor: colors.textTertiary,
      bgColor: colors.surfaceSecondary,
      borderColor: colors.borderLight,
    };
  }

  const days = daysUntil(expiryDate);

  if (days < 0) {
    return {
      status: 'expired',
      label: type === 'PUC' ? '🚨 Expired (₹10k Fine)' : 'Expired',
      daysRemaining: days,
      textColor: colors.statusCritical,
      bgColor: colors.statusCriticalBg,
      borderColor: colors.statusCritical,
    };
  }

  if (days <= 7) {
    return {
      status: 'expiring_soon',
      label: type === 'PUC' ? `🚨 ${days}d left (Renew)` : `${days}d left`,
      daysRemaining: days,
      textColor: colors.statusCritical,
      bgColor: colors.statusCriticalBg,
      borderColor: colors.statusCritical,
    };
  }

  if (days <= 15 && type === 'PUC') {
    return {
      status: 'expiring_soon',
      label: `⚠️ ${days}d left`,
      daysRemaining: days,
      textColor: colors.statusWarning,
      bgColor: colors.statusWarningBg,
      borderColor: colors.statusWarning,
    };
  }

  if (days <= 30) {
    return {
      status: 'expiring_soon',
      label: `${days}d left`,
      daysRemaining: days,
      textColor: colors.statusWarning,
      bgColor: colors.statusWarningBg,
      borderColor: colors.statusWarning,
    };
  }

  if (days <= 90) {
    return {
      status: 'valid',
      label: `${days}d left`,
      daysRemaining: days,
      textColor: colors.accent,
      bgColor: colors.surfaceSecondary,
      borderColor: colors.borderLight,
    };
  }

  return {
    status: 'valid',
    label: 'Valid',
    daysRemaining: days,
    textColor: colors.statusNormal,
    bgColor: colors.statusNormalBg,
    borderColor: colors.statusNormal,
  };
}

/**
 * Computes active overview metrics using existing date thresholds.
 */
export function getDocumentOverviewCounts(
  activeDocs: VehicleDocument[],
  supersededDocs: VehicleDocument[]
): {
  totalActive: number;
  expiringSoon: number;
  expired: number;
  valid: number;
  totalSuperseded: number;
} {
  let expiringSoon = 0;
  let expired = 0;
  let valid = 0;

  for (const doc of activeDocs) {
    if (!doc.expiry_date) {
      valid++;
      continue;
    }
    const days = daysUntil(doc.expiry_date);
    if (days < 0) {
      expired++;
    } else if (days <= 30) {
      expiringSoon++;
    } else {
      valid++;
    }
  }

  return {
    totalActive: activeDocs.length,
    expiringSoon,
    expired,
    valid,
    totalSuperseded: supersededDocs.length,
  };
}

/**
 * Pads single-digit counts with leading zero for technical clarity (e.g. 5 -> "05").
 */
export function formatCount(count: number): string {
  return count < 10 ? `0${count}` : `${count}`;
}

