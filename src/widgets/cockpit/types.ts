/**
 * Widget Data Types
 *
 * Data contract and default values for GpsCockpitWidget and GpsCockpitCompactWidget.
 * Extracted from GpsCockpitWidget.tsx so consumers can import types without
 * pulling in the full widget render tree.
 */

export interface GpsCockpitWidgetData {
  // Operational state
  recordingState: 'idle' | 'recording' | 'paused';
  tripId?: string;

  // Vehicle Identity
  vehicleId: string;
  vehicleName: string;
  regNumber: string;
  fuelType: string;
  vehicleType?: string;
  vehicleCount: number;

  // Active Telematics
  speedKmh: number;
  distanceKm: number;
  elapsedSeconds: number;
  formattedElapsed: string;
  sampleCount: number;

  // GPS Accuracy & Quality
  gpsQuality: 'good' | 'fair' | 'poor' | 'none';
  accuracyMeters: number | null;
  hasGapWarning: boolean;

  // Recording start time for REC badge (e.g. "18:42")
  tripStartTime?: string | null;

  // Idle Recap
  currentOdometer: number;
  lastTripDistanceKm?: number | null;
  lastTripDuration?: string | null;
  highwayChecklistReady?: boolean;
  checklistSummary?: string;
}

export const DEFAULT_GPS_WIDGET_DATA: GpsCockpitWidgetData = {
  recordingState: 'idle',
  vehicleId: '',
  vehicleName: 'DriveLedger',
  regNumber: '—',
  fuelType: 'petrol',
  vehicleType: 'car',
  vehicleCount: 1,
  speedKmh: 0,
  distanceKm: 0,
  elapsedSeconds: 0,
  formattedElapsed: '00:00',
  sampleCount: 0,
  gpsQuality: 'none',
  accuracyMeters: null,
  hasGapWarning: false,
  tripStartTime: null,
  currentOdometer: 0,
  lastTripDistanceKm: null,
  lastTripDuration: null,
  highwayChecklistReady: true,
  checklistSummary: 'Ready',
};
