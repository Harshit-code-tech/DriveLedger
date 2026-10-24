"use no memo";
import React from 'react';
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const SATELLITE_RADAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="22" height="22">
  <circle cx="14" cy="14" r="12" fill="none" stroke="#0284C7" stroke-width="1.2" stroke-dasharray="2 2" opacity="0.6"/>
  <circle cx="14" cy="14" r="7" fill="none" stroke="#38BDF8" stroke-width="1" opacity="0.8"/>
  <path fill="#38BDF8" d="M14 4a1 1 0 0 1 1 1v1.1A8.003 8.003 0 0 1 22.9 14H24a1 1 0 0 1 0 2h-1.1A8.003 8.003 0 0 1 15 22.9V24a1 1 0 0 1-2 0v-1.1A8.003 8.003 0 0 1 5.1 16H4a1 1 0 0 1 0-2h1.1A8.003 8.003 0 0 1 13 6.1V5a1 1 0 0 1 1-1zm0 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/>
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
  bg:          '#0B1220', // deep rich obsidian navy
  card:        '#111827', // dark slate card
  surfaceMid:  '#1E293B', // elevated pill / button background
  border:      '#1E293B', // subtle outer border
  borderHi:    '#334155', // elevated button border
  text:        '#FFFFFF', // bright pure white
  textSub:     '#94A3B8', // muted secondary text
  textDim:     '#64748B', // dimmed labels
  sky:         '#38BDF8', // vibrant electric sky blue
  skyDark:     '#0284C7',
  skyBg:       '#0C2540',
  green:       '#10B981', // vibrant emerald
  greenDark:   '#059669',
  greenBg:     '#042318', // deep emerald card background
  greenBorder: '#0D5E42', // glowing emerald border
  greenText:   '#34D399',
  amber:       '#F59E0B',
  amberDark:   '#D97706',
  amberBg:     '#261400', // deep amber card background
  amberBorder: '#78350F',
  amberText:   '#FCD34D',
  red:         '#EF4444',
  redBg:       '#260A0A',
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
      return { bg: C.surfaceMid, border: C.borderHi, text: C.textDim,   label: 'NO CAR' };
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
 * GpsTripWidget — High-Fidelity Android Home Screen GPS Control Panel
 *
 * States: idle | recording | paused | interrupted | no_vehicles | permission_error
 * Actions: START_TRIP | PAUSE_TRIP | RESUME_TRIP | FINISH_TRIP | SWITCH_NEXT_VEHICLE
 * Deep-link: driveledger://?action=gps_trip&vehicleId=...
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

  const targetVehicleId = d.vehicleId || d.nextVehicleId || '';
  const targetUri = isInterrupted
    ? `driveledger://?action=recover_trip&vehicleId=${encodeURIComponent(targetVehicleId)}`
    : isPermissionError
    ? `driveledger://?action=permissions`
    : `driveledger://?action=gps_trip&vehicleId=${encodeURIComponent(targetVehicleId)}`;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: C.bg,
        borderRadius: 22,
        padding: 10,
        justifyContent: 'space-between',
        borderColor: isTracking ? theme.border : C.border,
        borderWidth: 1,
      }}
    >
      {/* ── ROW 1 — Header (Tapping vehicle title opens GPS Trip screen) ── */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: 'match_parent',
          paddingBottom: 6,
        }}
      >
        {/* Radar Icon + Vehicle Name (Click opens app) */}
        <FlexWidget
          style={{ flexDirection: 'row', alignItems: 'center', flexGap: 6, flex: 1 }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: targetUri }}
        >
          <SvgWidget svg={SATELLITE_RADAR_SVG} style={{ width: 22, height: 22 }} />
          <TextWidget
            text={headerLabel}
            style={{ fontSize: 15, fontWeight: 'bold', color: C.text }}
            truncate="END"
            maxLines={1}
          />
        </FlexWidget>

        {/* Vehicle switcher + status badge */}
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 6 }}>
          {/* Switcher — 3 states: 0 vehicles, 1 vehicle, 2+ vehicles */}
          {vehicleCount === 0 ? (
            <FlexWidget
              style={{
                backgroundColor: C.skyBg,
                borderRadius: 12,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderColor: C.skyDark,
                borderWidth: 1,
              }}
              clickAction="OPEN_URI"
              clickActionData={{ uri: 'driveledger://add-vehicle' }}
            >
              <TextWidget text="+ Add" style={{ fontSize: 11, fontWeight: 'bold', color: C.sky }} />
            </FlexWidget>
          ) : vehicleCount === 1 ? (
            <FlexWidget
              style={{
                backgroundColor: C.surfaceMid,
                borderRadius: 12,
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderColor: C.borderHi,
                borderWidth: 1,
              }}
            >
              <TextWidget text="⇄ (1)" style={{ fontSize: 11, fontWeight: '600', color: C.textDim }} />
            </FlexWidget>
          ) : (
            <FlexWidget
              style={{
                backgroundColor: C.surfaceMid,
                borderRadius: 12,
                paddingHorizontal: 9,
                paddingVertical: 4,
                borderColor: C.borderHi,
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
                style={{ fontSize: 11, fontWeight: 'bold', color: isTracking ? C.sky : C.text }}
              />
            </FlexWidget>
          )}

          {/* Status badge pill */}
          <FlexWidget
            style={{
              backgroundColor: theme.bg,
              borderRadius: 12,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderColor: theme.border,
              borderWidth: 1,
            }}
          >
            <TextWidget text={theme.label} style={{ fontSize: 11, fontWeight: 'bold', color: theme.text }} />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>

      {/* ── ROW 2 — Central Metric Panel (Click opens app to GPS trip window) ── */}
      {isTracking ? (
        /* RECORDING / PAUSED — Live Metrics Panel */
        <FlexWidget
          style={{
            backgroundColor: isPaused ? C.amberBg : C.greenBg,
            borderRadius: 16,
            paddingHorizontal: 12,
            paddingVertical: 9,
            borderColor: isPaused ? C.amberBorder : C.greenBorder,
            borderWidth: 1,
            flex: 1,
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: targetUri }}
        >
          {/* Centered Hero Distance */}
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', flexGap: 4 }}>
            <TextWidget
              text={(d.currentDistanceKm || 0).toFixed(2)}
              style={{ fontSize: 34, fontWeight: 'bold', color: isPaused ? C.amberText : C.greenText }}
            />
            <TextWidget
              text="km"
              style={{ fontSize: 18, fontWeight: 'bold', color: isPaused ? C.amber : C.green, marginBottom: 3 }}
            />
          </FlexWidget>

          {/* Thin divider */}
          <FlexWidget
            style={{
              width: 'match_parent',
              height: 1,
              backgroundColor: isPaused ? C.amberBorder : C.greenBorder,
              marginVertical: 3,
            }}
          />

          {/* Telematics Row 1: Duration & Start Time */}
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
              style={{ fontSize: 13, fontWeight: 'bold', color: isPaused ? C.amberText : C.text }}
            />
            {d.startTimeFormatted && d.startTimeFormatted !== '—' && (
              <TextWidget
                text={`Started ${d.startTimeFormatted}`}
                style={{ fontSize: 12, color: isPaused ? C.amber : C.textSub }}
              />
            )}
          </FlexWidget>

          {/* Telematics Row 2: GPS Quality & Live Speed / Next Vehicle */}
          <FlexWidget
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: 'match_parent',
            }}
          >
            <TextWidget
              text={isPaused ? '⏸ Distance on hold' : gpsQualityLabel(d.gpsQuality)}
              style={{
                fontSize: 12,
                fontWeight: 'bold',
                color: isPaused ? C.amberText : gpsQualityColor(d.gpsQuality),
              }}
            />
            {speedStr && !isPaused ? (
              <TextWidget text={speedStr} style={{ fontSize: 14, fontWeight: 'bold', color: C.sky }} />
            ) : (
              d.nextVehicleName && d.nextVehicleName !== d.vehicleName && (
                <TextWidget
                  text={`Next: ${d.nextVehicleName}`}
                  style={{ fontSize: 11, color: C.textDim }}
                  truncate="END"
                  maxLines={1}
                />
              )
            )}
          </FlexWidget>
        </FlexWidget>

      ) : isInterrupted ? (
        /* INTERRUPTED — Session Recovery Card */
        <FlexWidget
          style={{
            backgroundColor: C.redBg,
            borderRadius: 16,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderColor: C.redBorder,
            borderWidth: 1,
            flex: 1,
            justifyContent: 'center',
            marginBottom: 8,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: targetUri }}
        >
          <TextWidget
            text="⚠ Interrupted Session"
            style={{ fontSize: 14, fontWeight: 'bold', color: C.redText }}
          />
          <TextWidget
            text="App closed unexpectedly during trip."
            style={{ fontSize: 11, color: C.textSub, marginTop: 2 }}
          />
          {d.currentDistanceKm > 0 && (
            <TextWidget
              text={`Recorded: ${(d.currentDistanceKm || 0).toFixed(2)} km · ${d.currentDurationFormatted}`}
              style={{ fontSize: 11, fontWeight: 'bold', color: C.redText, marginTop: 3 }}
            />
          )}
          <TextWidget
            text="Tap to review & recover in app →"
            style={{ fontSize: 11, color: C.red, marginTop: 3 }}
          />
        </FlexWidget>

      ) : isNoVehicles ? (
        /* NO VEHICLES — Onboarding Prompt */
        <FlexWidget
          style={{
            backgroundColor: C.card,
            borderRadius: 16,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderColor: C.border,
            borderWidth: 1,
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 8,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'driveledger://add-vehicle' }}
        >
          <TextWidget text="NO VEHICLES YET" style={{ fontSize: 11, fontWeight: 'bold', color: C.textDim }} />
          <TextWidget
            text="Register a vehicle to start GPS tracking."
            style={{ fontSize: 12, fontWeight: '600', color: C.textSub, marginTop: 3 }}
            maxLines={2}
            truncate="END"
          />
        </FlexWidget>

      ) : isPermissionError ? (
        /* PERMISSION ERROR — Prompt */
        <FlexWidget
          style={{
            backgroundColor: C.amberBg,
            borderRadius: 16,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderColor: C.amberBorder,
            borderWidth: 1,
            flex: 1,
            justifyContent: 'center',
            marginBottom: 8,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'driveledger://?action=permissions' }}
        >
          <TextWidget
            text="⚠ Location Permission Required"
            style={{ fontSize: 13, fontWeight: 'bold', color: C.amberText }}
          />
          <TextWidget
            text="Enable background location in settings."
            style={{ fontSize: 11, color: C.textSub, marginTop: 2 }}
            maxLines={2}
            truncate="END"
          />
        </FlexWidget>

      ) : (
        /* IDLE — Centered Last Trip Summary or Ready Prompt (Exact Preview Match) */
        <FlexWidget
          style={{
            backgroundColor: C.card,
            borderRadius: 16,
            paddingHorizontal: 12,
            paddingVertical: 9,
            borderColor: C.border,
            borderWidth: 1,
            flex: 1,
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: targetUri }}
        >
          {d.hasLastTrip ? (
            <FlexWidget
              style={{
                width: 'match_parent',
                flex: 1,
                justifyContent: 'space-between',
              }}
            >
              {/* Centered Top Label */}
              <FlexWidget style={{ width: 'match_parent', alignItems: 'center' }}>
                <TextWidget
                  text={`LAST TRIP · ${d.lastTripDate}`}
                  style={{ fontSize: 11, fontWeight: 'bold', color: C.textDim }}
                />
              </FlexWidget>

              {/* Centered Big Hero Distance & Time */}
              <FlexWidget style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', flexGap: 6 }}>
                <TextWidget
                  text={`${(d.lastTripDistanceKm || 0).toFixed(1)} km`}
                  style={{ fontSize: 26, fontWeight: 'bold', color: C.text }}
                />
                {d.lastTripDurationFormatted && d.lastTripDurationFormatted !== '—' && (
                  <TextWidget
                    text={`· ${d.lastTripDurationFormatted}`}
                    style={{ fontSize: 20, fontWeight: 'bold', color: C.textSub }}
                  />
                )}
              </FlexWidget>

              {/* Centered Target Vehicle */}
              <FlexWidget style={{ width: 'match_parent', alignItems: 'center' }}>
                <TextWidget
                  text={`Ready: ${d.nextVehicleName || d.vehicleName}`}
                  style={{ fontSize: 12, fontWeight: 'bold', color: C.sky }}
                  truncate="END"
                  maxLines={1}
                />
              </FlexWidget>
            </FlexWidget>
          ) : (
            <FlexWidget
              style={{
                width: 'match_parent',
                flex: 1,
                justifyContent: 'space-between',
              }}
            >
              {/* Centered Top Label */}
              <FlexWidget style={{ width: 'match_parent', alignItems: 'center' }}>
                <TextWidget
                  text="GPS TRIP TRACKER"
                  style={{ fontSize: 11, fontWeight: 'bold', color: C.textDim }}
                />
              </FlexWidget>

              {/* Centered Middle Ready Banner */}
              <FlexWidget style={{ width: 'match_parent', alignItems: 'center', marginVertical: 2 }}>
                <TextWidget
                  text="Ready to log your drive"
                  style={{ fontSize: 16, fontWeight: 'bold', color: C.text }}
                />
              </FlexWidget>

              {/* Centered Selected Vehicle */}
              <FlexWidget style={{ width: 'match_parent', alignItems: 'center' }}>
                <TextWidget
                  text={`Selected: ${d.nextVehicleName || d.vehicleName}`}
                  style={{ fontSize: 12, fontWeight: 'bold', color: C.sky }}
                  truncate="END"
                  maxLines={1}
                />
              </FlexWidget>
            </FlexWidget>
          )}
        </FlexWidget>
      )}

      {/* ── ROW 3 — Action Buttons ── */}
      {isNoVehicles ? (
        /* Add Vehicle Button */
        <FlexWidget
          style={{
            width: 'match_parent',
            backgroundColor: C.skyBg,
            borderRadius: 14,
            paddingVertical: 10,
            alignItems: 'center',
            justifyContent: 'center',
            borderColor: C.sky,
            borderWidth: 1,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'driveledger://add-vehicle' }}
        >
          <TextWidget text="+ Add Vehicle" style={{ fontSize: 13, fontWeight: 'bold', color: C.sky }} />
        </FlexWidget>

      ) : isInterrupted ? (
        /* Review & Recover Button */
        <FlexWidget
          style={{
            width: 'match_parent',
            backgroundColor: C.red,
            borderRadius: 14,
            paddingVertical: 10,
            alignItems: 'center',
            justifyContent: 'center',
            borderColor: C.redBorder,
            borderWidth: 1,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'driveledger://?action=recover_trip' }}
        >
          <TextWidget text="Review & Recover Trip →" style={{ fontSize: 13, fontWeight: 'bold', color: '#0F172A' }} />
        </FlexWidget>

      ) : isPermissionError ? (
        /* Grant Permission Button */
        <FlexWidget
          style={{
            width: 'match_parent',
            backgroundColor: C.amber,
            borderRadius: 14,
            paddingVertical: 10,
            alignItems: 'center',
            justifyContent: 'center',
            borderColor: C.amberBorder,
            borderWidth: 1,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'driveledger://?action=permissions' }}
        >
          <TextWidget text="Grant Location Permission →" style={{ fontSize: 13, fontWeight: 'bold', color: '#0F172A' }} />
        </FlexWidget>

      ) : isRecording ? (
        /* RECORDING: Dual Side-by-Side Buttons [Pause | Finish] */
        <FlexWidget
          style={{
            width: 'match_parent',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexGap: 8,
          }}
        >
          <FlexWidget
            style={{
              flex: 1,
              backgroundColor: C.amberBg,
              borderRadius: 14,
              paddingVertical: 10,
              alignItems: 'center',
              justifyContent: 'center',
              borderColor: C.amberDark,
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
            <TextWidget text="⏸  Pause" style={{ fontSize: 14, fontWeight: 'bold', color: C.amberText }} />
          </FlexWidget>

          <FlexWidget
            style={{
              flex: 1,
              backgroundColor: C.surfaceMid,
              borderRadius: 14,
              paddingVertical: 10,
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
            <TextWidget text="⏹  Finish" style={{ fontSize: 14, fontWeight: 'bold', color: C.text }} />
          </FlexWidget>
        </FlexWidget>

      ) : isPaused ? (
        /* PAUSED: Dual Side-by-Side Buttons [Resume | Finish] */
        <FlexWidget
          style={{
            width: 'match_parent',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexGap: 8,
          }}
        >
          <FlexWidget
            style={{
              flex: 1,
              backgroundColor: C.greenBg,
              borderRadius: 14,
              paddingVertical: 10,
              alignItems: 'center',
              justifyContent: 'center',
              borderColor: C.green,
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
            <TextWidget text="▶  Resume" style={{ fontSize: 14, fontWeight: 'bold', color: C.greenText }} />
          </FlexWidget>

          <FlexWidget
            style={{
              flex: 1,
              backgroundColor: C.surfaceMid,
              borderRadius: 14,
              paddingVertical: 10,
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
            <TextWidget text="⏹  Finish" style={{ fontSize: 14, fontWeight: 'bold', color: C.text }} />
          </FlexWidget>
        </FlexWidget>

      ) : (
        /* IDLE: Full-Width Vibrant Cyan Pill [Start GPS Trip] (Exact Preview Match) */
        <FlexWidget
          style={{
            width: 'match_parent',
            backgroundColor: C.sky,
            borderRadius: 22,
            paddingVertical: 10,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          clickAction="START_TRIP"
          clickActionData={{
            action: 'START_TRIP',
            vehicleId: d.nextVehicleId || d.vehicleId,
            interactionId: `start_${nonce}`,
            timestamp: Date.now(),
          }}
        >
          <TextWidget text="📍  Start GPS Trip" style={{ fontSize: 15, fontWeight: 'bold', color: '#0B1220' }} />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
