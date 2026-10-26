/**
 * Formatting Utilities
 *
 * Display formatters for currency, numbers, mileage, and distance.
 * These are presentation-only — they never modify stored data.
 *
 * WHY centralized formatting?
 * - Consistent display across the entire app.
 * - When settings change (e.g. currency from ₹ to $), all display
 *   updates come from here — no component changes needed.
 *
 * NOTE: formatCurrency and formatOdometer read from preferencesStore
 * at call time, so they always reflect the current user preference.
 * Intl.NumberFormat instances are cached per-currency to avoid
 * expensive re-instantiation on every render.
 */

import { getPreferences, getCurrencySymbol, convertDistance, getDistanceLabel } from '@/stores/preferencesStore';

// ─── Cached Formatters ───────────────────────────────────────────────
// Cache one formatter per currency code so repeated calls are fast.

const currencyFormatterCache: Partial<Record<string, Intl.NumberFormat>> = {};

function getCurrencyFormatter(currencyCode: string): Intl.NumberFormat {
  if (currencyFormatterCache[currencyCode]) {
    return currencyFormatterCache[currencyCode]!;
  }
  // Use en-IN locale for INR (lakhs/crores grouping), en-US for everything else
  const locale = currencyCode === 'INR' ? 'en-IN' : 'en-US';
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    currencyFormatterCache[currencyCode] = formatter;
    return formatter;
  } catch {
    // Fallback: symbol + plain number if Intl doesn't know the currency
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

// Plain number formatter (no currency symbol, Indian grouping)
const NUMBER_FORMATTER_IN = new Intl.NumberFormat('en-IN');
const NUMBER_FORMATTER_US = new Intl.NumberFormat('en-US');

// ─── Currency ────────────────────────────────────────────────────────

/**
 * Formats a number as currency in the user's preferred currency.
 * Reads the current currency preference at call time.
 *
 * @param amount - The numeric amount
 * @returns Formatted string like "₹1,23,456.00" or "$1,234.56"
 */
export function formatCurrency(amount: number): string {
  const { currency } = getPreferences();
  try {
    return getCurrencyFormatter(currency).format(amount);
  } catch {
    // Final fallback
    return `${getCurrencySymbol()} ${amount.toFixed(2)}`;
  }
}

// ─── Mileage ────────────────────────────────────────────────────────

/**
 * Formats a mileage value with its unit for display.
 *
 * @param value - The mileage number (e.g., 18.2)
 * @param unit  - The mileage unit label (e.g., "km/L")
 * @returns Formatted string like "18.2 km/L"
 */
export function formatMileage(value: number, unit: string): string {
  return `${value.toFixed(1)} ${unit}`;
}

// ─── Numbers ────────────────────────────────────────────────────────

/**
 * Formats a number with grouping (no currency symbol).
 * Uses Indian grouping for INR users, US grouping otherwise.
 *
 * @param value - The number to format
 * @returns Formatted string like "1,23,456" (INR) or "1,234,567" (others)
 */
export function formatNumber(value: number): string {
  const { currency } = getPreferences();
  return currency === 'INR'
    ? NUMBER_FORMATTER_IN.format(value)
    : NUMBER_FORMATTER_US.format(value);
}

// ─── Distance / Odometer ────────────────────────────────────────────

/**
 * Formats an odometer value for display.
 * Converts km → miles if user has selected miles in preferences.
 * Always shows as a whole number with grouping.
 *
 * @param km - The odometer reading (always stored in km internally)
 * @returns Formatted string like "1,23,456 km" or "76,719 mi"
 */
export function formatOdometer(km: number): string {
  const converted = convertDistance(km);
  const label = getDistanceLabel();
  return `${formatNumber(Math.round(converted))} ${label}`;
}

