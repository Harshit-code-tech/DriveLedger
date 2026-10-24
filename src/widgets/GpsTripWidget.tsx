"use no memo";
import React from 'react';
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

// â”€â”€â”€ SVG Icons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Circular radar icon â€” used in idle/ready state header */
const RADAR_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
  <circle cx="12" cy="12" r="10" fill="none" stroke="#38BDF8" stroke-width="1.5" opacity="0.45"/>
  <circle cx="12" cy="12" r="6" fill="none" stroke="#38BDF8" stroke-width="1.5" opacity="0.7"/>
  <circle cx="12" cy="12" r="2.5" fill="#38BDF8"/>
  <line x1="12" y1="2" x2="12" y2="5.5" stroke="#38BDF8" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="12" y1="18.5" x2="12" y2="22" stroke="#38BDF8" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="2" y1="12" x2="5.5" y2="12" stroke="#38BDF8" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="18.5" y1="12" x2="22" y2="12" stroke="#38BDF8" stroke-width="1.5" stroke-linecap="round"/>
</svg>`;

/** Satellite dish icon â€” used in recording/paused state header */
const SATELLITE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
  <path fill="none" stroke="#38BDF8" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
    d="M4.9 19.1A9 9 0 0 1 4.9 4.9m14.2 0a9 9 0 0 1 0 14.2M7.8 16.2A5 5 0 0 1 7.8 7.8m8.4 0a5 5 0 0 1 0 8.4"/>
  <circle cx="12" cy="12" r="2" fill="#38BDF8"/>
</svg>`;

/** Clock icon for duration label */
const CLOCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14">
  <circle cx="12" cy="12" r="9" fill="none" stroke="#FFFFFF" stroke-width="2"/>
  <polyline points="12,7 12,12 15,15" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" fill="none"/>
</svg>`;

/** Green triangle â€” GPS quality "good" */
const GPS_GOOD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="12" height="12">
  <polygon points="8,2 14,14 2,14" fill="#10B981"/>
</svg>`;

/** Map pin for Start GPS Trip button */
const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15">
  <path fill="#0B1220" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
</svg>`;

// â”€â”€â”€ Data Shape â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // Optional live speed in km/h â€” set by backgroundLocationTask when available
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
  startTimeFormatted: 'â€”',
  hasLastTrip: false,
  lastTripDate: 'â€”',
  lastTripDistanceKm: 0,
  lastTripDurationFormatted: 'â€”',
  gpsQuality: 'none',
  currentSpeedKph: null,
  warningText: null,
  vehicleCount: 1,
  interactionNonce: 'init',
};

// â”€â”€â”€ Design Tokens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const C = {
  // Base
  bg:           '#0A1628',  // deep navy â€” widget outer background
  bgCard:       '#111F36',  // dark slate â€” idle card background

  // Surfaces / Borders
  surfaceMid:   '#1A2D4A',
  border:       '#1A2D4A',
  borderHi:     '#253F63',

  // Text
  text:         '#FFFFFF',
  textSub:      '#8DA5BE',  // muted blue-grey
  textDim:      '#4E6A88',  // dimmed labels

  // Cyan / Sky
  sky:          '#38BDF8',
  skyBg:        '#082040',
  skyBorder:    '#0E4272',

  // Green (recording)
  green:        '#10B981',
  greenText:    '#34D399',
  greenBg:      '#042B1E',
  greenBorder:  '#0D5E42',
  greenBtnBg:   '#051F14',

  // Amber (paused)
  amber:        '#F59E0B',
  amberText:    '#FCD34D',
  amberBg:      '#2D1A00',
  amberBorder:  '#78350F',

  // Red (interrupted)
  red:          '#EF4444',
  redText:      '#FCA5A5',
  redBg:        '#2A0A0A',
  redBorder:    '#7F1D1D',

  // Finish button
  finishBg:     '#141E2E',
  finishBorder: '#243449',
} as const;

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getStatusBadge(status: GpsTripWidgetStatus) {
  switch (status) {
    case 'recording':
      return { bg: C.greenBg, border: C.greenBorder, text: C.greenText, label: 'â— REC' };
    case 'paused':
      return { bg: C.amberBg, border: C.amberBorder, text: C.amberText, label: 'â¸ PAUSED' };
    case 'interrupted':
      return { bg: C.redBg, border: C.redBorder, text: C.redText, label: 'âš  ERR' };
    case 'no_vehicles':
      return { bg: C.surfaceMid, border: C.borderHi, text: C.textDim, label: 'NO CAR' };
    case 'permission_error':
      return { bg: C.amberBg, border: C.amberBorder, text: C.amberText, label: 'âš  PERM' };
    default:
      return { bg: C.surfaceMid, border: C.borderHi, text: C.textSub, label: 'IDLE' };
  }
}

function gpsQualityLabel(q: GpsTripWidgetData['gpsQuality']): string {
  switch (q) {
    case 'fair': return 'â—ˆ GPS Fair';
    case 'poor': return 'â–½ GPS Weak';
    default:     return 'â—‹ GPS Off';
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

// â”€â”€â”€ Widget â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * GpsTripWidget â€” High-Fidelity Android Home Screen GPS Control Panel
 *
 * States: idle | recording | paused | interrupted | no_vehicles | permission_error
 * Actions: START_TRIP | PAUSE_TRIP | RESUME_TRIP | FINISH_TRIP | SWITCH_NEXT_VEHICLE
 * Deep-link tap: driveledger://?action=gps_trip&vehicleId=...
 */
export function GpsTripWidget(props: GpsTripWidgetData) {
  const d: GpsTripWidgetData = { ...DEFAULT_GPS_WIDGET_DATA, ...props };

  const nonce         = d.interactionNonce || 'rnd';
  const statusBadge   = getStatusBadge(d.status);
  const isRecording   = d.status === 'recording';
  const isPaused      = d.status === 'paused';
  const isTracking    = isRecording || isPaused;
  const isInterrupted = d.status === 'interrupted';
  const isNoVehicles  = d.status === 'no_vehicles' || (d.vehicleCount ?? 1) === 0;
  const isPermErr     = d.status === 'permission_error';
  const vehicleCount  = d.vehicleCount ?? 1;

  const displayName = isTracking
    ? d.vehicleName
    : isNoVehicles
    ? 'DriveLedger'
    : d.nextVehicleName || d.vehicleName;

  const speedLabel =
    isRecording && typeof d.currentSpeedKph === 'number' && d.currentSpeedKph > 0
      ? `${Math.round(d.currentSpeedKph)} km/h`
      : null;

  const targetVehicleId = d.vehicleId || d.nextVehicleId || '';
  const targetUri = isInterrupted
    ? `driveledger://?action=recover_trip&vehicleId=${encodeURIComponent(targetVehicleId)}`
    : isPermErr
    ? `driveledger://?action=permissions`
    : `driveledger://?action=gps_trip&vehicleId=${encodeURIComponent(targetVehicleId)}`;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: C.bg,
        borderRadius: 24,
        padding: 12,
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderColor: isTracking ? statusBadge.border : C.border,
        borderWidth: 1,
      }}
    >
      {/* â”€â”€ ROW 1: Header â”€â”€ */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          width: 'match_parent',
          marginBottom: 8,
        }}
      >
        {/* Left: icon + vehicle name (taps open app) */}
        <FlexWidget
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: targetUri }}
        >
          <SvgWidget
            svg={isTracking ? SATELLITE_SVG : RADAR_ICON_SVG}
            style={{ width: 20, height: 20 }}
          />
          <TextWidget
            text={' ' + displayName}
            style={{ fontSize: 15, fontWeight: 'bold', color: C.text }}
            truncate="END"
            maxLines={1}
          />
        </FlexWidget>

        {/* Right: Switcher + Status Badge */}
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          {vehicleCount === 0 ? (
            <FlexWidget
              style={{
                backgroundColor: C.skyBg,
                borderRadius: 20,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderColor: C.skyBorder,
                borderWidth: 1,
                marginRight: 6,
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
                borderRadius: 20,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderColor: C.borderHi,
                borderWidth: 1,
                marginRight: 6,
              }}
            >
              <TextWidget text="â‡„ (1)" style={{ fontSize: 11, fontWeight: '600', color: C.textDim }} />
            </FlexWidget>
          ) : (
            <FlexWidget
              style={{
                backgroundColor: C.surfaceMid,
                borderRadius: 20,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderColor: C.borderHi,
                borderWidth: 1,
                marginRight: 6,
              }}
              clickAction="SWITCH_NEXT_VEHICLE"
              clickActionData={{
                action: 'SWITCH_NEXT_VEHICLE',
                interactionId: `switch_${nonce}`,
                timestamp: Date.now(),
              }}
            >
              <TextWidget
                text={isTracking ? 'â‡„ Next' : 'â‡„ Switch'}
                style={{ fontSize: 11, fontWeight: 'bold', color: isTracking ? C.sky : C.text }}
              />
            </FlexWidget>
          )}

          {/* Status badge */}
          <FlexWidget
            style={{
              backgroundColor: statusBadge.bg,
              borderRadius: 20,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderColor: statusBadge.border,
              borderWidth: 1,
            }}
          >
            <TextWidget
              text={statusBadge.label}
              style={{ fontSize: 11, fontWeight: 'bold', color: statusBadge.text }}
            />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>

      {/* â”€â”€ ROW 2: Central Metric Panel â”€â”€ */}

      {isTracking ? (
        /* RECORDING / PAUSED */
        <FlexWidget
          style={{
            flex: 1,
            width: 'match_parent',
            backgroundColor: isPaused ? C.amberBg : C.greenBg,
            borderRadius: 16,
            borderColor: isPaused ? C.amberBorder : C.greenBorder,
            borderWidth: 1,
            paddingHorizontal: 14,
            paddingVertical: 10,
            flexDirection: 'column',
            justifyContent: 'space-between',
            marginBottom: 9,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: targetUri }}
        >
          {/* Hero distance */}
          <FlexWidget
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'center',
              width: 'match_parent',
            }}
          >
            <TextWidget
              text={(d.currentDistanceKm || 0).toFixed(2)}
              style={{
                fontSize: 36,
                fontWeight: 'bold',
                color: isPaused ? C.amberText : C.greenText,
              }}
            />
            <TextWidget
              text=" km"
              style={{
                fontSize: 20,
                fontWeight: 'bold',
                color: isPaused ? C.amber : C.green,
                marginBottom: 4,
              }}
            />
          </FlexWidget>

          {/* Divider */}
          <FlexWidget
            style={{
              width: 'match_parent',
              height: 1,
              backgroundColor: isPaused ? C.amberBorder : C.greenBorder,
              marginVertical: 4,
            }}
          />

          {/* Duration row: clock + elapsed + start time */}
          <FlexWidget
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: 'match_parent',
            }}
          >
            <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
              <SvgWidget svg={CLOCK_SVG} style={{ width: 14, height: 14 }} />
              <TextWidget
                text={' ' + (d.currentDurationFormatted || '0m')}
                style={{ fontSize: 14, fontWeight: 'bold', color: C.text }}
              />
            </FlexWidget>
            {d.startTimeFormatted && d.startTimeFormatted !== 'â€”' && (
              <TextWidget
                text={'Started ' + d.startTimeFormatted}
                style={{ fontSize: 12, color: isPaused ? C.amber : C.textSub }}
              />
            )}
          </FlexWidget>

          {/* GPS quality + speed row */}
          <FlexWidget
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: 'match_parent',
            }}
          >
            {isPaused ? (
              <TextWidget
                text="â¸ Distance on hold"
                style={{ fontSize: 12, fontWeight: '600', color: C.amberText }}
              />
            ) : (
              <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
                {d.gpsQuality === 'good' && (
                  <SvgWidget svg={GPS_GOOD_SVG} style={{ width: 12, height: 12 }} />
                )}
                <TextWidget
                  text={d.gpsQuality === 'good' ? ' GPS Strong' : gpsQualityLabel(d.gpsQuality)}
                  style={{ fontSize: 12, fontWeight: '600', color: gpsQualityColor(d.gpsQuality) }}
                />
              </FlexWidget>
            )}

            {speedLabel && !isPaused ? (
              <TextWidget
                text={speedLabel}
                style={{ fontSize: 14, fontWeight: 'bold', color: C.sky }}
              />
            ) : (
              d.nextVehicleName && d.nextVehicleName !== d.vehicleName && (
                <TextWidget
                  text={'Next: ' + d.nextVehicleName}
                  style={{ fontSize: 11, color: C.textDim }}
                  truncate="END"
                  maxLines={1}
                />
              )
            )}
          </FlexWidget>
        </FlexWidget>

      ) : isInterrupted ? (
        /* INTERRUPTED */
        <FlexWidget
          style={{
            flex: 1,
            width: 'match_parent',
            backgroundColor: C.redBg,
            borderRadius: 16,
            borderColor: C.redBorder,
            borderWidth: 1,
            paddingHorizontal: 14,
            paddingVertical: 12,
            flexDirection: 'column',
            justifyContent: 'center',
            marginBottom: 9,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: targetUri }}
        >
          <TextWidget
            text="âš  Interrupted Session"
            style={{ fontSize: 14, fontWeight: 'bold', color: C.redText }}
          />
          <TextWidget
            text="App closed unexpectedly during trip."
            style={{ fontSize: 11, color: C.textSub, marginTop: 2 }}
          />
          {d.currentDistanceKm > 0 && (
            <TextWidget
              text={'Recorded: ' + (d.currentDistanceKm || 0).toFixed(2) + ' km Â· ' + d.currentDurationFormatted}
              style={{ fontSize: 11, fontWeight: 'bold', color: C.redText, marginTop: 4 }}
            />
          )}
          <TextWidget
            text="Tap to review & recover in app â†’"
            style={{ fontSize: 11, color: C.red, marginTop: 3 }}
          />
        </FlexWidget>

      ) : isNoVehicles ? (
        /* NO VEHICLES */
        <FlexWidget
          style={{
            flex: 1,
            width: 'match_parent',
            backgroundColor: C.bgCard,
            borderRadius: 16,
            borderColor: C.border,
            borderWidth: 1,
            paddingHorizontal: 14,
            paddingVertical: 12,
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 9,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'driveledger://add-vehicle' }}
        >
          <TextWidget
            text="NO VEHICLES YET"
            style={{ fontSize: 11, fontWeight: 'bold', color: C.textDim }}
          />
          <TextWidget
            text="Register a vehicle to start GPS tracking."
            style={{ fontSize: 12, fontWeight: '600', color: C.textSub, marginTop: 4 }}
            maxLines={2}
            truncate="END"
          />
        </FlexWidget>

      ) : isPermErr ? (
        /* PERMISSION ERROR */
        <FlexWidget
          style={{
            flex: 1,
            width: 'match_parent',
            backgroundColor: C.amberBg,
            borderRadius: 16,
            borderColor: C.amberBorder,
            borderWidth: 1,
            paddingHorizontal: 14,
            paddingVertical: 12,
            flexDirection: 'column',
            justifyContent: 'center',
            marginBottom: 9,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'driveledger://?action=permissions' }}
        >
          <TextWidget
            text="âš  Location Permission Required"
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
        /* IDLE â€” last trip summary or ready prompt */
        <FlexWidget
          style={{
            flex: 1,
            width: 'match_parent',
            backgroundColor: C.bgCard,
            borderRadius: 16,
            borderColor: C.border,
            borderWidth: 1,
            paddingHorizontal: 14,
            paddingVertical: 10,
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 9,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: targetUri }}
        >
          {d.hasLastTrip ? (
            <>
              {/* "LAST TRIP Â· 22 Oct" */}
              <TextWidget
                text={'LAST TRIP Â· ' + d.lastTripDate}
                style={{ fontSize: 11, fontWeight: 'bold', color: C.textDim }}
              />

              {/* "26.4 km Â· 45m" */}
              <FlexWidget
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  justifyContent: 'center',
                  width: 'match_parent',
                }}
              >
                <TextWidget
                  text={(d.lastTripDistanceKm || 0).toFixed(1) + ' km'}
                  style={{ fontSize: 28, fontWeight: 'bold', color: C.text }}
                />
                {d.lastTripDurationFormatted && d.lastTripDurationFormatted !== 'â€”' && (
                  <TextWidget
                    text={' Â· ' + d.lastTripDurationFormatted}
                    style={{ fontSize: 22, fontWeight: 'bold', color: C.textSub }}
                  />
                )}
              </FlexWidget>

              {/* "Ready: Mahindra Scorpio-N" */}
              <TextWidget
                text={'Ready: ' + (d.nextVehicleName || d.vehicleName)}
                style={{ fontSize: 13, fontWeight: 'bold', color: C.sky }}
                truncate="END"
                maxLines={1}
              />
            </>
          ) : (
            <>
              {/* "GPS TRIP TRACKER" */}
              <TextWidget
                text="GPS TRIP TRACKER"
                style={{ fontSize: 11, fontWeight: 'bold', color: C.textDim }}
              />

              {/* "Ready to log your drive" */}
              <TextWidget
                text="Ready to log your drive"
                style={{ fontSize: 17, fontWeight: 'bold', color: C.text }}
              />

              {/* "Selected: <vehicle>" */}
              <TextWidget
                text={'Selected: ' + (d.nextVehicleName || d.vehicleName)}
                style={{ fontSize: 13, fontWeight: 'bold', color: C.sky }}
                truncate="END"
                maxLines={1}
              />
            </>
          )}
        </FlexWidget>
      )}

      {/* â”€â”€ ROW 3: Action Buttons â”€â”€ */}

      {isNoVehicles ? (
        <FlexWidget
          style={{
            width: 'match_parent',
            height: 42,
            backgroundColor: C.skyBg,
            borderRadius: 21,
            borderColor: C.sky,
            borderWidth: 1.5,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'driveledger://add-vehicle' }}
        >
          <TextWidget text="+ Add Vehicle" style={{ fontSize: 13, fontWeight: 'bold', color: C.sky }} />
        </FlexWidget>

      ) : isInterrupted ? (
        <FlexWidget
          style={{
            width: 'match_parent',
            height: 42,
            backgroundColor: C.red,
            borderRadius: 21,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'driveledger://?action=recover_trip&vehicleId=' + encodeURIComponent(targetVehicleId) }}
        >
          <TextWidget
            text="Review & Recover Trip â†’"
            style={{ fontSize: 13, fontWeight: 'bold', color: '#FFFFFF' }}
          />
        </FlexWidget>

      ) : isPermErr ? (
        <FlexWidget
          style={{
            width: 'match_parent',
            height: 42,
            backgroundColor: C.amber,
            borderRadius: 21,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'driveledger://?action=permissions' }}
        >
          <TextWidget
            text="Grant Location Permission â†’"
            style={{ fontSize: 13, fontWeight: 'bold', color: '#0F172A' }}
          />
        </FlexWidget>

      ) : isRecording ? (
        /* RECORDING: [Pause] [Finish] side-by-side */
        <FlexWidget
          style={{ width: 'match_parent', height: 42, flexDirection: 'row', alignItems: 'center' }}
        >
          {/* Pause â€” amber outlined, dark bg */}
          <FlexWidget
            style={{
              flex: 1,
              height: 42,
              backgroundColor: C.greenBtnBg,
              borderRadius: 21,
              borderColor: C.amber,
              borderWidth: 1.5,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 7,
            }}
            clickAction="PAUSE_TRIP"
            clickActionData={{
              action: 'PAUSE_TRIP',
              tripId: d.tripId,
              interactionId: 'pause_' + nonce,
              timestamp: Date.now(),
            }}
          >
            <TextWidget text="â¸  Pause" style={{ fontSize: 14, fontWeight: 'bold', color: C.amberText }} />
          </FlexWidget>

          {/* Finish â€” dark neutral */}
          <FlexWidget
            style={{
              flex: 1,
              height: 42,
              backgroundColor: C.finishBg,
              borderRadius: 21,
              borderColor: C.finishBorder,
              borderWidth: 1.5,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            clickAction="FINISH_TRIP"
            clickActionData={{
              action: 'FINISH_TRIP',
              tripId: d.tripId,
              interactionId: 'finish_' + nonce,
              timestamp: Date.now(),
            }}
          >
            <TextWidget text="â¹  Finish" style={{ fontSize: 14, fontWeight: 'bold', color: C.text }} />
          </FlexWidget>
        </FlexWidget>

      ) : isPaused ? (
        /* PAUSED: [Resume] [Finish] side-by-side */
        <FlexWidget
          style={{ width: 'match_parent', height: 42, flexDirection: 'row', alignItems: 'center' }}
        >
          {/* Resume â€” green outlined */}
          <FlexWidget
            style={{
              flex: 1,
              height: 42,
              backgroundColor: C.greenBg,
              borderRadius: 21,
              borderColor: C.green,
              borderWidth: 1.5,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 7,
            }}
            clickAction="RESUME_TRIP"
            clickActionData={{
              action: 'RESUME_TRIP',
              tripId: d.tripId,
              interactionId: 'resume_' + nonce,
              timestamp: Date.now(),
            }}
          >
            <TextWidget text="â–¶  Resume" style={{ fontSize: 14, fontWeight: 'bold', color: C.greenText }} />
          </FlexWidget>

          {/* Finish â€” dark neutral */}
          <FlexWidget
            style={{
              flex: 1,
              height: 42,
              backgroundColor: C.finishBg,
              borderRadius: 21,
              borderColor: C.finishBorder,
              borderWidth: 1.5,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            clickAction="FINISH_TRIP"
            clickActionData={{
              action: 'FINISH_TRIP',
              tripId: d.tripId,
              interactionId: 'finish_' + nonce,
              timestamp: Date.now(),
            }}
          >
            <TextWidget text="â¹  Finish" style={{ fontSize: 14, fontWeight: 'bold', color: C.text }} />
          </FlexWidget>
        </FlexWidget>

      ) : (
        /* IDLE: Full-width bright cyan "Start GPS Trip" */
        <FlexWidget
          style={{
            width: 'match_parent',
            height: 44,
            backgroundColor: C.sky,
            borderRadius: 22,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          clickAction="START_TRIP"
          clickActionData={{
            action: 'START_TRIP',
            vehicleId: d.nextVehicleId || d.vehicleId,
            interactionId: 'start_' + nonce,
            timestamp: Date.now(),
          }}
        >
          <SvgWidget svg={PIN_SVG} style={{ width: 15, height: 15 }} />
          <TextWidget
            text="  Start GPS Trip"
            style={{ fontSize: 15, fontWeight: 'bold', color: '#0B1220' }}
          />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
