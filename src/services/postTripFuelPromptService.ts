/**
 * Post-Trip Fuel Prompt Service
 *
 * Coordinates the post-GPS-trip fuel prompt dialog:
 * - Ensures prompt is only displayed AFTER trip is successfully finalized and persisted
 * - Prevents duplicate prompts across rerenders, app resumes, and widget events
 * - Defers prompts initiated from headless background/widget tasks until app foregrounds
 * - Navigates to existing add-fuel flow preselecting the trip vehicle
 * - Dismissing or cancelling never affects the saved trip
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export const PENDING_POST_TRIP_FUEL_PROMPT_KEY = 'driveledger_pending_post_trip_fuel_prompt';

// Deduplication cache: tracks trip IDs that have already shown a prompt in this session
const promptedTripIds = new Set<string>();
let isPromptCurrentlyVisible = false;

export interface PendingPromptData {
  tripId: string;
  vehicleId: string;
  odometer?: number | null;
  timestamp: number;
}

/**
 * Checks if a prompt was already shown for a given trip ID.
 */
export function hasPromptedForTrip(tripId: string): boolean {
  return promptedTripIds.has(tripId);
}

/**
 * Marks a trip ID as having displayed the fuel prompt.
 */
export function markTripPrompted(tripId: string): void {
  promptedTripIds.add(tripId);
}

/**
 * Resets prompt tracking (for testing purposes).
 */
export function resetPromptTrackingForTesting(): void {
  promptedTripIds.clear();
  isPromptCurrentlyVisible = false;
}

/**
 * Resolves the ending odometer reading from trip data (or fallback vehicle odometer).
 * Prioritizes trip.end_odometer, then (start_odometer + distance_km), then vehicle current_odometer.
 */
export function resolveTripEndOdometer(
  trip?: { end_odometer?: number | null; start_odometer?: number | null; distance_km?: number | null } | null,
  vehicleCurrentOdometer?: number | null
): number | null {
  if (!trip) {
    return typeof vehicleCurrentOdometer === 'number' && !isNaN(vehicleCurrentOdometer)
      ? vehicleCurrentOdometer
      : null;
  }
  if (typeof trip.end_odometer === 'number' && !isNaN(trip.end_odometer)) {
    return trip.end_odometer;
  }
  if (
    typeof trip.start_odometer === 'number' &&
    !isNaN(trip.start_odometer) &&
    typeof trip.distance_km === 'number' &&
    !isNaN(trip.distance_km)
  ) {
    return Math.round(trip.start_odometer + trip.distance_km);
  }
  if (typeof vehicleCurrentOdometer === 'number' && !isNaN(vehicleCurrentOdometer)) {
    return vehicleCurrentOdometer;
  }
  return null;
}

/**
 * Stores a pending fuel prompt in AsyncStorage for headless / background trip completion.
 * Never throws.
 */
export async function setPendingPostTripPrompt(
  tripId: string,
  vehicleId: string,
  odometer?: number | null
): Promise<void> {
  try {
    const payload: PendingPromptData = {
      tripId,
      vehicleId,
      odometer: typeof odometer === 'number' && !isNaN(odometer) ? odometer : null,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(PENDING_POST_TRIP_FUEL_PROMPT_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[PostTripPrompt] Failed to persist pending fuel prompt:', err);
  }
}

/**
 * Retrieves and clears any pending fuel prompt deferred from background / widget completion.
 * Prunes entries older than 24 hours.
 */
export async function getAndClearPendingPostTripPrompt(): Promise<PendingPromptData | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_POST_TRIP_FUEL_PROMPT_KEY);
    if (!raw) return null;

    await AsyncStorage.removeItem(PENDING_POST_TRIP_FUEL_PROMPT_KEY);
    const data: PendingPromptData = JSON.parse(raw);

    // Prune stale pending prompts older than 24h
    if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
      return null;
    }

    if (hasPromptedForTrip(data.tripId)) {
      return null;
    }

    return data;
  } catch (err) {
    console.warn('[PostTripPrompt] Error retrieving pending prompt:', err);
    return null;
  }
}

export interface ShowPostTripPromptOptions {
  vehicleId: string;
  tripId?: string;
  odometer?: number | null;
  onAddFuel: (odometer?: number | null) => void;
  onNotNow?: () => void;
}

/**
 * Shows the concise "Trip completed!" fuel dialog.
 * Returns true if the dialog was launched, or false if deduplicated.
 */
export function showPostTripFuelPrompt(options: ShowPostTripPromptOptions): boolean {
  const { vehicleId, tripId, odometer, onAddFuel, onNotNow } = options;

  if (tripId && hasPromptedForTrip(tripId)) {
    return false;
  }

  if (isPromptCurrentlyVisible) {
    return false;
  }

  if (tripId) {
    markTripPrompted(tripId);
  }

  isPromptCurrentlyVisible = true;

  Alert.alert(
    'Trip completed!',
    'Would you like to add fuel for this vehicle now?',
    [
      {
        text: 'Not Now',
        style: 'cancel',
        onPress: () => {
          isPromptCurrentlyVisible = false;
          onNotNow?.();
        },
      },
      {
        text: 'Add Fuel',
        onPress: () => {
          isPromptCurrentlyVisible = false;
          onAddFuel(odometer);
        },
      },
    ],
    {
      cancelable: true,
      onDismiss: () => {
        isPromptCurrentlyVisible = false;
        onNotNow?.();
      },
    }
  );

  return true;
}
