"use no memo";
import React from 'react';
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const SATELLITE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18">
  <path fill="#38BDF8" d="M12 2a1 1 0 0 1 1 1v1.07A8.003 8.003 0 0 1 20.93 11H22a1 1 0 0 1 0 2h-1.07A8.003 8.003 0 0 1 13 20.93V22a1 1 0 0 1-2 0v-1.07A8.003 8.003 0 0 1 3.07 13H2a1 1 0 0 1 0-2h1.07A8.003 8.003 0 0 1 11 4.07V3a1 1 0 0 1 1-1zm0 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/>
</svg>`;

// ─── Data Shape ───────────────────────────────────────────────────────────────

export type GpsTripWidgetStatus =
  | 'idle'
  | 'recording'
  | 'paused'
  | 'interrupted'
  | 'no_vehicles'
  | 'permission_error';

export interface GpsTripWidgetData {
  /** Active trip vehicle ID (if recording/paused) or selected next-trip vehicle ID (if idle) */
  vehicleId?: string;
  vehicleName: string;
  regNumber: string;

  /** Target vehicle selected for the next trip */
  nextVehicleId?: string;
  nextVehicleName?: string;

  /** Active trip ID if tracking */
  tripId?: string;

  status: GpsTripWidgetStatus;
  statusText: string;

  // Active / current trip metrics (if recording or paused)
  currentDistanceKm: number;
  currentDurationFormatted: string;
  startTimeFormatted: string;

  // Last completed trip info (if idle)
  hasLastTrip: boolean;
  lastTripDate: string;
  lastTripDistanceKm: number;
  lastTripDurationFormatted: string;

  // Accuracy & signal quality
  gpsQuality: 'good' | 'fair' | 'poor' | 'none';

  // Optional live speed in km/h — set by backgroundLocationTask when available
  currentSpeedKph?: number | null;

  // Warnings / notices
  warningText?: string | null;

  // Number of active vehicles
  vehicleCount?: number;

  // Render interaction nonce to facilitate deduplication of OS intent retries
  interactionNonce?: string;
}

export const DEFAULT_GPS_WIDGET_DATA: GpsTripWidgetData = {
  vehicleId: '',
  vehicleName: 'DriveLedger',
  regNumber: '',
  nextVehicleId: '',
  nextVehicleName: 'DriveLedger',
  status: 'idle',
  statusText: 'READY',
  currentDistanceKm: 0,
  currentDurationFormatted: '0m',
  startTimeFormatted: '—',
  hasLastTrip: false,
  lastTripDate: '—',
  lastTripDistanceKm: 0,
  lastTripDurationFormatted: '—',
  gpsQuality: 'none',
  currentSpeedKph: null,
  warningText: null,
  vehicleCount: 1,
  interactionNonce: 'init',
};

// ─── Design Tokens ────────────────────────────────────────────────────────────

const C = {
  bg:          '#0B1120',
  surface:     '#111827',
  surfaceMid:  '#1C2A3A',
  surfaceHi:   '#1E2D40',
  border:      '#243447',
  borderHi:    '#334D66',
  text:        '#F0F6FF',
  textSub:     '#8DA5BE',
  textDim:     '#4D6680',
  sky:         '#38BDF8',
  skyDark:     '#0369A1',
  skyBg:       '#0C2340',
  green:       '#10B981',
  greenDark:   '#059669',
  greenBg:     '#042B1E',
  greenBorder: '#065F46',
  greenText:   '#34D399',
  amber:       '#F59E0B',
  amberDark:   '#B45309',
  amberBg:     '#2D1A00',
  amberBorder: '#92400E',
  amberText:   '#FCD34D',
  red:         '#EF4444',
  redDark:     '#B91C1C',
  redBg:       '#2A0A0A',
  redBorder:   '#7F1D1D',
  redText:     '#FCA5A5',
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusTheme(status: GpsTripWidgetStatus) {
  switch (status) {
    case 'recording':
      return { bg: C.greenBg, border: C.greenBorder, text: C.greenText, label: '● REC' };
    case 'paused':
      return { bg: C.amberBg, border: C.amberBorder, text: C.amberText, label: '⏸ PAUSED' };
    case 'interrupted':
      return { bg: C.redBg,   border: C.redBorder,   text: C.redText,   label: '⚠ ERR' };
    case 'no_vehicles':
      return { bg: C.surfaceMid, border: C.border,   text: C.textDim,   label: 'NO CAR' };
    case 'permission_error':
      return { bg: C.amberBg, border: C.amberBorder, text: C.amberText, label: '⚠ PERM' };
    default:
      return { bg: C.surfaceMid, border: C.borderHi, text: C.textSub,   label: 'IDLE' };
  }
}

function gpsQualityLabel(q: GpsTripWidgetData['gpsQuality']): string {
  switch (q) {
    case 'good': return '▲ GPS Strong';
    case 'fair': return '◈ GPS Fair';
    case 'poor': return '▽ GPS Weak';
    default:     return '○ GPS Off';
  }
}

function gpsQualityColor(q: GpsTripWidgetData['gpsQuality']): string {
  switch (q) {
    case 'good': return C.greenText;
    case 'fair': return C.amberText;
    case 'poor': return C.redText;
    default:     return C.textDim;
  }
}

// ─── Widget ───────────────────────────────────────────────────────────────────

/**
 * GpsTripWidget v2 — Android Home Screen GPS Control Panel
 *
 * States: idle | recording | paused | interrupted | no_vehicles | permission_error
 * Actions: START_TRIP | PAUSE_TRIP | RESUME_TRIP | FINISH_TRIP | SWITCH_NEXT_VEHICLE
 *
 * Metrics shown while tracking: distance (km), elapsed time, trip start time,
 * GPS quality, live speed (km/h when available), next-trip vehicle name.
 */
export function GpsTripWidget(props: GpsTripWidgetData) {
  const d: GpsTripWidgetData = { ...DEFAULT_GPS_WIDGET_DATA, ...props };

  const nonce             = d.interactionNonce || 'rnd';
  const theme             = getStatusTheme(d.status);
  const isTracking        = d.status === 'recording' || d.status === 'paused';
  const isRecording       = d.status === 'recording';
  const isPaused          = d.status === 'paused';
  const isInterrupted     = d.status === 'interrupted';
  const isNoVehicles      = d.status === 'no_vehicles' || (d.vehicleCount ?? 1) === 0;
  const isPermissionError = d.status === 'permission_error';
  const vehicleCount      = d.vehicleCount ?? 1;

  const headerLabel = isTracking
    ? d.vehicleName
    : isNoVehicles
    ? 'DriveLedger'
    : d.nextVehicleName || d.vehicleName;

  const speedStr =
    isRecording && typeof d.currentSpeedKph === 'number' && d.currentSpeedKph > 0
      ? `${Math.round(d.currentSpeedKph)} km/h`
      : null;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: C.bg,
        borderRadius: 20,
        padding: 10,
        justifyContent: 'space-between',
        borderColor: isTracking ? theme.border : C.border,
        borderWidth: 1,
      }}
    >
      {/* ── ROW 1 — Header ── */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: 'match_parent',
          paddingBottom: 6,
        }}
      >
        {/* Satellite icon + vehicle name */}
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 5, flex: 1 }}>
          <SvgWidget svg={SATELLITE_SVG} style={{ width: 16, height: 16 }} />
          <TextWidget
            text={headerLabel}
            style={{ fontSize: 13, fontWeight: 'bold', color: C.text }}
            truncate="END"
            maxLines={1}
          />
        </FlexWidget>

        {/* Vehicle switcher + status badge */}
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 5 }}>

          {/* Switcher — 3 states: 0 vehicles, 1 vehicle, 2+ vehicles */}
          {vehicleCount === 0 ? (
            <FlexWidget
              style={{
                backgroundColor: C.skyBg,
                borderRadius: 6,
                paddingHorizontal: 7,
                paddingVertical: 3,
                borderColor: C.skyDark,
                borderWidth: 1,
              }}
              clickAction="OPEN_URI"
              clickActionData={{ uri: 'driveledger://add-vehicle' }}
            >
              <TextWidget text="+ Add" style={{ fontSize: 10, fontWeight: 'bold', color: C.sky }} />
            </FlexWidget>
          ) : vehicleCount === 1 ? (
            <FlexWidget
              style={{
                backgroundColor: C.surfaceMid,
                borderRadius: 6,
                paddingHorizontal: 7,
                paddingVertical: 3,
                borderColor: C.border,
                borderWidth: 1,
              }}
            >
              <TextWidget text="⇄ 1" style={{ fontSize: 10, fontWeight: '600', color: C.textDim }} />
            </FlexWidget>
          ) : (
            <FlexWidget
              style={{
                backgroundColor: isTracking ? C.surfaceHi : C.surfaceMid,
                borderRadius: 6,
                paddingHorizontal: 7,
                paddingVertical: 3,
                borderColor: isTracking ? C.sky : C.borderHi,
                borderWidth: 1,
              }}
              clickAction="SWITCH_NEXT_VEHICLE"
              clickActionData={{
                action: 'SWITCH_NEXT_VEHICLE',
                interactionId: `switch_${nonce}`,
                timestamp: Date.now(),
              }}
            >
              <TextWidget
                text={isTracking ? '⇄ Next' : '⇄ Switch'}
                style={{ fontSize: 10, fontWeight: 'bold', color: isTracking ? C.sky : C.textSub }}
              />
            </FlexWidget>
          )}

          {/* Status badge */}
          <FlexWidget
            style={{
              backgroundColor: theme.bg,
              borderRadius: 8,
              paddingHorizontal: 7,
              paddingVertical: 3,
              borderColor: theme.border,
              borderWidth: 1,
            }}
          >
            <TextWidget text={theme.label} style={{ fontSize: 10, fontWeight: 'bold', color: theme.text }} />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>

      {/* ── ROW 2 — Central Metric Panel ── */}
      {isTracking ? (
        /* RECORDING / PAUSED — Live metrics */
        <FlexWidget
          style={{
            backgroundColor: isPaused ? C.amberBg : C.greenBg,
            borderRadius: 12,
            paddingHorizontal: 11,
            paddingVertical: 8,
            borderColor: isPaused ? C.amberBorder : C.greenBorder,
            borderWidth: 1,
            flex: 1,
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
          clickAction="OPEN_TRIP_DETAILS"
          clickActionData={{
            action: 'OPEN_TRIP_DETAILS',
            tripId: d.tripId,
            interactionId: `details_${nonce}`,
            timestamp: Date.now(),
          }}
        >
          {/* Distance — primary big number */}
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end', flexGap: 4 }}>
            <TextWidget
              text={d.currentDistanceKm.toFixed(2)}
              style={{ fontSize: 30, fontWeight: 'bold', color: isPaused ? C.amberText : C.greenText }}
            />
            <TextWidget
              text="km"
              style={{ fontSize: 14, fontWeight: '600', color: isPaused ? C.amber : C.green, marginBottom: 3 }}
            />
          </FlexWidget>

          {/* Thin divider */}
          <FlexWidget
            style={{
              width: 'match_parent',
              height: 1,
              backgroundColor: isPaused ? C.amberBorder : C.greenBorder,
              marginVertical: 4,
            }}
          />

          {/* Elapsed time + start time */}
          <FlexWidget
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: 'match_parent',
            }}
          >
            <TextWidget
              text={`⏱ ${d.currentDurationFormatted || '0m'}`}
              style={{ fontSize: 12, fontWeight: '700', color: isPaused ? C.amberText : C.text }}
            />
            {d.startTimeFormatted && d.startTimeFormatted !== '—' && (
              <TextWidget
                text={`Started ${d.startTimeFormatted}`}
                style={{ fontSize: 10, color: isPaused ? C.amber : C.textSub }}
              />
            )}
          </FlexWidget>

          {/* GPS quality + speed / next vehicle */}
          <FlexWidget
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: 'match_parent',
              marginTop: 2,
            }}
          >
            <TextWidget
              text={isPaused ? '⏸ Distance on hold' : gpsQualityLabel(d.gpsQuality)}
              style={{
                fontSize: 10,
                color: isPaused
                  ? C.amber
                  : d.gpsQuality === 'good'
                  ? C.greenText
                  : d.gpsQuality === 'fair'
                  ? C.amberText
                  : d.gpsQuality === 'poor'
                  ? C.redText
                  : C.textDim,
              }}
            />
            {speedStr && !isPaused ? (
              <TextWidget text={speedStr} style={{ fontSize: 10, fontWeight: '700', color: C.sky }} />
            ) : (
              d.nextVehicleName && d.nextVehicleName !== d.vehicleName && (
                <TextWidget
                  text={`Next: ${d.nextVehicleName}`}
                  style={{ fontSize: 10, color: C.textDim }}
                  truncate="END"
                  maxLines={1}
                />
              )
            )}
          </FlexWidget>
        </FlexWidget>

      ) : isInterrupted ? (
        /* INTERRUPTED — Recovery notice */
        <FlexWidget
          style={{
            backgroundColor: C.redBg,
            borderRadius: 12,
            paddingHorizontal: 11,
            paddingVertical: 9,
            borderColor: C.redBorder,
            borderWidth: 1,
            flex: 1,
            justifyContent: 'center',
            marginBottom: 6,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'driveledger://?action=recover_trip' }}
        >
          <TextWidget
            text="⚠ Interrupted Session"
            style={{ fontSize: 13, fontWeight: 'bold', color: C.redText }}
          />
          <TextWidget
            text="App closed unexpectedly."
            style={{ fontSize: 10, color: C.textSub, marginTop: 2 }}
          />
          {d.currentDistanceKm > 0 && (
            <TextWidget
              text={`Recorded: ${d.currentDistanceKm.toFixed(2)} km · ${d.currentDurationFormatted}`}
              style={{ fontSize: 10, fontWeight: '600', color: C.redText, marginTop: 3 }}
            />
          )}
          <TextWidget
            text="Tap to review & recover →"
            style={{ fontSize: 10, color: C.red, marginTop: 3 }}
          />
        </FlexWidget>

      ) : isNoVehicles ? (
        /* NO VEHICLES — Onboarding prompt */
        <FlexWidget
          style={{
            backgroundColor: C.surface,
            borderRadius: 12,
            paddingHorizontal: 11,
            paddingVertical: 9,
            borderColor: C.border,
            borderWidth: 1,
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 6,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'driveledger://add-vehicle' }}
        >
          <TextWidget text="NO VEHICLES YET" style={{ fontSize: 10, fontWeight: 'bold', color: C.textDim }} />
          <TextWidget
            text="Register a vehicle to start GPS tracking."
            style={{ fontSize: 11, fontWeight: '600', color: C.textSub, marginTop: 3 }}
            maxLines={2}
            truncate="END"
          />
        </FlexWidget>

      ) : isPermissionError ? (
        /* PERMISSION ERROR */
        <FlexWidget
          style={{
            backgroundColor: C.amberBg,
            borderRadius: 12,
            paddingHorizontal: 11,
            paddingVertical: 9,
            borderColor: C.amberBorder,
            borderWidth: 1,
            flex: 1,
            justifyContent: 'center',
            marginBottom: 6,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'driveledger://?action=permissions' }}
        >
          <TextWidget
            text="⚠ Location Permission Required"
            style={{ fontSize: 12, fontWeight: 'bold', color: C.amberText }}
          />
          <TextWidget
            text="Enable background location to record trips."
            style={{ fontSize: 10, color: C.textSub, marginTop: 3 }}
            maxLines={2}
            truncate="END"
          />
        </FlexWidget>

      ) : (
        /* IDLE — Last trip summary or ready prompt */
        <FlexWidget
          style={{
            backgroundColor: C.surface,
            borderRadius: 12,
            paddingHorizontal: 11,
            paddingVertical: 8,
            borderColor: C.border,
            borderWidth: 1,
            flex: 1,
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          {d.hasLastTrip ? (
            <>
              <TextWidget
                text={`LAST TRIP · ${d.lastTripDate}`}
                style={{ fontSize: 9, fontWeight: 'bold', color: C.textDim }}
              />
              <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end', flexGap: 6, marginTop: 3 }}>
                <TextWidget
                  text={`${d.lastTripDistanceKm.toFixed(1)} km`}
                  style={{ fontSize: 22, fontWeight: 'bold', color: C.text }}
                />
                {d.lastTripDurationFormatted && d.lastTripDurationFormatted !== '—' && (
                  <TextWidget
                    text={`· ${d.lastTripDurationFormatted}`}
                    style={{ fontSize: 12, color: C.textSub, marginBottom: 2 }}
                  />
                )}
              </FlexWidget>
              <TextWidget
                text={`Ready: ${d.nextVehicleName || d.vehicleName}`}
                style={{ fontSize: 10, color: C.sky, marginTop: 2 }}
                truncate="END"
                maxLines={1}
              />
            </>
          ) : (
            <>
              <TextWidget
                text="GPS TRIP TRACKER"
                style={{ fontSize: 9, fontWeight: 'bold', color: C.textDim }}
              />
              <TextWidget
                text="Ready to log your drive"
                style={{ fontSize: 14, fontWeight: '600', color: C.textSub, marginTop: 4 }}
              />
              <TextWidget
                text={`Vehicle: ${d.nextVehicleName || d.vehicleName}`}
                style={{ fontSize: 10, color: C.sky, marginTop: 4 }}
                truncate="END"
                maxLines={1}
              />
            </>
          )}
        </FlexWidget>
      )}

      {/* ── ROW 3 — Action Buttons ── */}
      {isNoVehicles ? (
        /* Add Vehicle */
        <FlexWidget
          style={{
            width: 'match_parent',
            backgroundColor: C.skyBg,
            borderRadius: 10,
            paddingVertical: 8,
            alignItems: 'center',
            justifyContent: 'center',
            borderColor: C.sky,
            borderWidth: 1,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'driveledger://add-vehicle' }}
        >
          <TextWidget text="+ Add Vehicle" style={{ fontSize: 12, fontWeight: 'bold', color: C.sky }} />
        </FlexWidget>

      ) : isInterrupted ? (
        /* Review & Recover */
        <FlexWidget
          style={{
            width: 'match_parent',
            backgroundColor: C.red,
            borderRadius: 10,
            paddingVertical: 8,
            alignItems: 'center',
            justifyContent: 'center',
            borderColor: C.redBorder,
            borderWidth: 1,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'driveledger://?action=recover_trip' }}
        >
          <TextWidget text="Review & Recover Trip →" style={{ fontSize: 12, fontWeight: 'bold', color: '#0F172A' }} />
        </FlexWidget>

      ) : isPermissionError ? (
        /* Grant Permission */
        <FlexWidget
          style={{
            width: 'match_parent',
            backgroundColor: C.amber,
            borderRadius: 10,
            paddingVertical: 8,
            alignItems: 'center',
            justifyContent: 'center',
            borderColor: C.amberBorder,
            borderWidth: 1,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'driveledger://?action=permissions' }}
        >
          <TextWidget text="Grant Location Permission →" style={{ fontSize: 12, fontWeight: 'bold', color: '#0F172A' }} />
        </FlexWidget>

      ) : isRecording ? (
        /* RECORDING: Pause + Finish */
        <FlexWidget
          style={{
            width: 'match_parent',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexGap: 7,
          }}
        >
          <FlexWidget
            style={{
              flex: 1,
              backgroundColor: C.amberBg,
              borderRadius: 10,
              paddingVertical: 8,
              alignItems: 'center',
              justifyContent: 'center',
              borderColor: C.amberBorder,
              borderWidth: 1,
            }}
            clickAction="PAUSE_TRIP"
            clickActionData={{
              action: 'PAUSE_TRIP',
              tripId: d.tripId,
              interactionId: `pause_${nonce}`,
              timestamp: Date.now(),
            }}
          >
            <TextWidget text="⏸  Pause" style={{ fontSize: 12, fontWeight: 'bold', color: C.amberText }} />
          </FlexWidget>

          <FlexWidget
            style={{
              flex: 1,
              backgroundColor: C.surfaceMid,
              borderRadius: 10,
              paddingVertical: 8,
              alignItems: 'center',
              justifyContent: 'center',
              borderColor: C.borderHi,
              borderWidth: 1,
            }}
            clickAction="FINISH_TRIP"
            clickActionData={{
              action: 'FINISH_TRIP',
              tripId: d.tripId,
              interactionId: `finish_${nonce}`,
              timestamp: Date.now(),
            }}
          >
            <TextWidget text="⏹  Finish" style={{ fontSize: 12, fontWeight: 'bold', color: C.text }} />
          </FlexWidget>
        </FlexWidget>

      ) : isPaused ? (
        /* PAUSED: Resume + Finish */
        <FlexWidget
          style={{
            width: 'match_parent',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexGap: 7,
          }}
        >
          <FlexWidget
            style={{
              flex: 1,
              backgroundColor: C.greenBg,
              borderRadius: 10,
              paddingVertical: 8,
              alignItems: 'center',
              justifyContent: 'center',
              borderColor: C.greenBorder,
              borderWidth: 1,
            }}
            clickAction="RESUME_TRIP"
            clickActionData={{
              action: 'RESUME_TRIP',
              tripId: d.tripId,
              interactionId: `resume_${nonce}`,
              timestamp: Date.now(),
            }}
          >
            <TextWidget text="▶  Resume" style={{ fontSize: 12, fontWeight: 'bold', color: C.greenText }} />
          </FlexWidget>

          <FlexWidget
            style={{
              flex: 1,
              backgroundColor: C.surfaceMid,
              borderRadius: 10,
              paddingVertical: 8,
              alignItems: 'center',
              justifyContent: 'center',
              borderColor: C.borderHi,
              borderWidth: 1,
            }}
            clickAction="FINISH_TRIP"
            clickActionData={{
              action: 'FINISH_TRIP',
              tripId: d.tripId,
              interactionId: `finish_${nonce}`,
              timestamp: Date.now(),
            }}
          >
            <TextWidget text="⏹  Finish" style={{ fontSize: 12, fontWeight: 'bold', color: C.text }} />
          </FlexWidget>
        </FlexWidget>

      ) : (
        /* IDLE: Start GPS Trip */
        <FlexWidget
          style={{
            width: 'match_parent',
            backgroundColor: C.sky,
            borderRadius: 10,
            paddingVertical: 8,
            alignItems: 'center',
            justifyContent: 'center',
            borderColor: C.skyDark,
            borderWidth: 1,
          }}
          clickAction="START_TRIP"
          clickActionData={{
            action: 'START_TRIP',
            vehicleId: d.nextVehicleId || d.vehicleId,
            interactionId: `start_${nonce}`,
            timestamp: Date.now(),
          }}
        >
          <TextWidget text="📍  Start GPS Trip" style={{ fontSize: 12, fontWeight: 'bold', color: '#0B1120' }} />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
