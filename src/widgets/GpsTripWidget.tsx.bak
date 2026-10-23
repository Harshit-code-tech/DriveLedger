"use no memo";
import React from 'react';
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

// ─── Satellite Vector SVG Icon ────────────────────────────────────────────────
const SATELLITE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
  <path fill="#38BDF8" d="M12 2a1 1 0 0 1 1 1v1.07A8.003 8.003 0 0 1 20.93 11H22a1 1 0 0 1 0 2h-1.07A8.003 8.003 0 0 1 13 20.93V22a1 1 0 0 1-2 0v-1.07A8.003 8.003 0 0 1 3.07 13H2a1 1 0 0 1 0-2h1.07A8.003 8.003 0 0 1 11 4.07V3a1 1 0 0 1 1-1zm0 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/>
</svg>`;

// ─── Data Shape ──────────────────────────────────────────────────────────────

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
  warningText: null,
  vehicleCount: 1,
  interactionNonce: 'init',
};

// ─── Colors ──────────────────────────────────────────────────────────────────

const COLORS = {
  bg: '#0F172A',
  surface: '#162032',
  surfaceMid: '#1E293B',
  border: '#334155',
  text: '#F8FAFC',
  textSub: '#94A3B8',
  textDim: '#64748B',
  sky: '#38BDF8',
  skyDark: '#0284C7',
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
} as const;

function getStatusBadgeTheme(status: GpsTripWidgetStatus) {
  switch (status) {
    case 'recording':
      return {
        bg: COLORS.greenBg,
        border: COLORS.greenBorder,
        text: COLORS.greenText,
        label: '● REC',
      };
    case 'paused':
      return {
        bg: COLORS.amberBg,
        border: COLORS.amberBorder,
        text: COLORS.amberText,
        label: '⏸ PAUSED',
      };
    case 'interrupted':
      return {
        bg: COLORS.redBg,
        border: COLORS.redBorder,
        text: COLORS.redText,
        label: '⚠️ NOTICE',
      };
    case 'no_vehicles':
      return {
        bg: COLORS.surfaceMid,
        border: COLORS.border,
        text: COLORS.textDim,
        label: 'NO CAR',
      };
    case 'permission_error':
      return {
        bg: COLORS.amberBg,
        border: COLORS.amberBorder,
        text: COLORS.amberText,
        label: '⚠️ PERM',
      };
    case 'idle':
    default:
      return {
        bg: COLORS.surfaceMid,
        border: COLORS.border,
        text: COLORS.textSub,
        label: 'IDLE',
      };
  }
}

/**
 * GpsTripWidget — Android Home Screen GPS Control Panel
 *
 * Distinct widget from VehicleGlanceWidget.
 * Functions as an interactive trip control panel:
 * - Start trip directly from widget
 * - Pause and Resume ongoing trip with durable distance anchor
 * - Finish trip directly and update home screen
 * - Persistent vehicle switcher across all states (idle, recording, paused, interrupted)
 * - Independent button touch targets (no fall-through container taps)
 */
export function GpsTripWidget(props: GpsTripWidgetData) {
  const d: GpsTripWidgetData = {
    ...DEFAULT_GPS_WIDGET_DATA,
    ...props,
  };

  const nonce = d.interactionNonce || 'rnd';
  const badge = getStatusBadgeTheme(d.status);
  const isTracking = d.status === 'recording' || d.status === 'paused';
  const isRecording = d.status === 'recording';
  const isPaused = d.status === 'paused';
  const isInterrupted = d.status === 'interrupted';
  const isNoVehicles = d.status === 'no_vehicles' || (d.vehicleCount ?? 0) === 0;
  const isPermissionError = d.status === 'permission_error';

  const vehicleCount = d.vehicleCount ?? 1;

  // Header display: if tracking, show active vehicle name; if idle, show selected vehicle name
  const headerVehicleTitle = isTracking
    ? d.vehicleName
    : isNoVehicles
    ? 'No Vehicles'
    : d.nextVehicleName || d.vehicleName;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: COLORS.bg,
        borderRadius: 20,
        padding: 12,
        justifyContent: 'space-between',
        borderColor: COLORS.border,
        borderWidth: 1,
      }}
    >
      {/* ── Row 1: Header (Vehicle Title, Persistent Switcher, Status Badge) ── */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: 'match_parent',
        }}
      >
        {/* Left: Satellite Icon & Vehicle Title */}
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 6, flex: 1 }}>
          <SvgWidget svg={SATELLITE_SVG} style={{ width: 16, height: 16 }} />
          <TextWidget
            text={headerVehicleTitle}
            style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.text }}
            truncate="END"
            maxLines={1}
          />
        </FlexWidget>

        {/* Right: Persistent Switch Vehicle Control & Status Badge */}
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 5 }}>
          {/* VISIBILITY RULE: Vehicle switcher is NEVER conditionally removed across states */}
          {vehicleCount === 0 ? (
            <FlexWidget
              style={{
                backgroundColor: COLORS.surfaceMid,
                borderRadius: 6,
                paddingHorizontal: 6,
                paddingVertical: 3,
                borderColor: COLORS.border,
                borderWidth: 1,
              }}
              clickAction="OPEN_URI"
              clickActionData={{ uri: 'driveledger://add-vehicle' }}
            >
              <TextWidget
                text="+ Add"
                style={{ fontSize: 10, fontWeight: 'bold', color: COLORS.sky }}
              />
            </FlexWidget>
          ) : vehicleCount === 1 ? (
            <FlexWidget
              style={{
                backgroundColor: COLORS.surfaceMid,
                borderRadius: 6,
                paddingHorizontal: 6,
                paddingVertical: 3,
                borderColor: COLORS.border,
                borderWidth: 1,
              }}
            >
              <TextWidget
                text="⇄ (1)"
                style={{ fontSize: 10, fontWeight: '600', color: COLORS.textDim }}
              />
            </FlexWidget>
          ) : (
            <FlexWidget
              style={{
                backgroundColor: isTracking ? '#1E293B' : COLORS.surfaceMid,
                borderRadius: 6,
                paddingHorizontal: 6,
                paddingVertical: 3,
                borderColor: isTracking ? COLORS.skyDark : COLORS.border,
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
                text={isTracking ? '⇄ Next' : '⇄'}
                style={{
                  fontSize: 11,
                  fontWeight: 'bold',
                  color: isTracking ? COLORS.sky : COLORS.textSub,
                }}
              />
            </FlexWidget>
          )}

          {/* Status Badge */}
          <FlexWidget
            style={{
              backgroundColor: badge.bg,
              borderRadius: 8,
              paddingHorizontal: 7,
              paddingVertical: 3,
              borderColor: badge.border,
              borderWidth: 1,
            }}
          >
            <TextWidget
              text={badge.label}
              style={{ fontSize: 10, fontWeight: 'bold', color: badge.text }}
            />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>

      {/* ── Row 2: Central Metric & Status Display ── */}
      {isTracking ? (
        /* Recording / Paused State: Live distance, duration, and quality status */
        <FlexWidget
          style={{
            backgroundColor: COLORS.surface,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderColor: COLORS.border,
            borderWidth: 1,
            justifyContent: 'center',
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'driveledger://?action=active_trip' }}
        >
          <FlexWidget
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 4 }}>
              <TextWidget
                text={d.currentDistanceKm.toFixed(2)}
                style={{
                  fontSize: 26,
                  fontWeight: 'bold',
                  color: isPaused ? COLORS.amberText : COLORS.sky,
                }}
              />
              <TextWidget
                text="km"
                style={{ fontSize: 13, fontWeight: 'bold', color: COLORS.textSub }}
              />
            </FlexWidget>

            <TextWidget
              text={isPaused ? '⏸ Paused' : `⏱️ ${d.currentDurationFormatted || '0m'}`}
              style={{ fontSize: 11, fontWeight: '600', color: isPaused ? COLORS.amberText : COLORS.textSub }}
            />
          </FlexWidget>

          <FlexWidget
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 2,
            }}
          >
            <TextWidget
              text={
                isPaused
                  ? 'Distance on hold'
                  : d.gpsQuality === 'good'
                  ? '📶 GPS Good'
                  : d.gpsQuality === 'fair'
                  ? '📶 GPS Fair'
                  : '📶 GPS Active'
              }
              style={{ fontSize: 10, color: isPaused ? COLORS.amber : COLORS.textDim }}
            />
            {d.nextVehicleName && d.nextVehicleName !== d.vehicleName && (
              <TextWidget
                text={`Next: ${d.nextVehicleName}`}
                style={{ fontSize: 10, color: COLORS.textDim }}
                truncate="END"
                maxLines={1}
              />
            )}
          </FlexWidget>
        </FlexWidget>
      ) : isInterrupted ? (
        /* Interrupted Session Notice */
        <FlexWidget
          style={{
            backgroundColor: COLORS.redBg,
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderColor: COLORS.redBorder,
            borderWidth: 1,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'driveledger://?action=recover_trip' }}
        >
          <TextWidget
            text="⚠️ Interrupted Session"
            style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.redText }}
          />
          <TextWidget
            text="App closed unexpectedly. Tap Review to recover recorded data."
            style={{ fontSize: 10, color: COLORS.textSub, marginTop: 2 }}
            maxLines={2}
            truncate="END"
          />
        </FlexWidget>
      ) : isNoVehicles ? (
        /* No Vehicles Registered Notice */
        <FlexWidget
          style={{
            backgroundColor: COLORS.surface,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderColor: COLORS.border,
            borderWidth: 1,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'driveledger://add-vehicle' }}
        >
          <TextWidget
            text="NO VEHICLES FOUND"
            style={{ fontSize: 10, fontWeight: 'bold', color: COLORS.textDim }}
          />
          <TextWidget
            text="Register a vehicle to start tracking"
            style={{ fontSize: 12, fontWeight: '600', color: COLORS.textSub, marginTop: 2 }}
          />
        </FlexWidget>
      ) : isPermissionError ? (
        /* Location Permission Missing Notice */
        <FlexWidget
          style={{
            backgroundColor: COLORS.amberBg,
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderColor: COLORS.amberBorder,
            borderWidth: 1,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'driveledger://?action=permissions' }}
        >
          <TextWidget
            text="⚠️ Permission Required"
            style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.amberText }}
          />
          <TextWidget
            text="Enable location permission in DriveLedger to track trips."
            style={{ fontSize: 10, color: COLORS.textSub, marginTop: 2 }}
            maxLines={2}
            truncate="END"
          />
        </FlexWidget>
      ) : (
        /* Idle State: Last Trip Summary or Ready Prompt */
        <FlexWidget
          style={{
            backgroundColor: COLORS.surface,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderColor: COLORS.border,
            borderWidth: 1,
          }}
        >
          <TextWidget
            text={d.hasLastTrip ? `LAST TRIP · ${d.lastTripDate}` : 'OFFLINE GPS TRACKER'}
            style={{ fontSize: 10, fontWeight: 'bold', color: COLORS.textDim }}
          />

          <FlexWidget
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              flexGap: 6,
              marginTop: 2,
            }}
          >
            {d.hasLastTrip ? (
              <>
                <TextWidget
                  text={`${d.lastTripDistanceKm.toFixed(1)} km`}
                  style={{ fontSize: 17, fontWeight: 'bold', color: COLORS.text }}
                />
                {d.lastTripDurationFormatted && d.lastTripDurationFormatted !== '—' && (
                  <TextWidget
                    text={`· ${d.lastTripDurationFormatted}`}
                    style={{ fontSize: 12, color: COLORS.textSub }}
                  />
                )}
              </>
            ) : (
              <TextWidget
                text="Ready to log trips"
                style={{ fontSize: 14, fontWeight: '600', color: COLORS.textSub }}
              />
            )}
          </FlexWidget>
        </FlexWidget>
      )}

      {/* ── Row 3: Action Buttons ── */}
      {isNoVehicles ? (
        /* No Vehicles: Add Vehicle Action */
        <FlexWidget
          style={{
            width: 'match_parent',
            backgroundColor: COLORS.surfaceMid,
            borderRadius: 10,
            paddingVertical: 7,
            alignItems: 'center',
            justifyContent: 'center',
            borderColor: COLORS.skyDark,
            borderWidth: 1,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'driveledger://add-vehicle' }}
        >
          <TextWidget
            text="+ Add Vehicle"
            style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.sky }}
          />
        </FlexWidget>
      ) : isInterrupted ? (
        /* Interrupted: Review & Recover Action */
        <FlexWidget
          style={{
            width: 'match_parent',
            backgroundColor: COLORS.red,
            borderRadius: 10,
            paddingVertical: 7,
            alignItems: 'center',
            justifyContent: 'center',
            borderColor: COLORS.redBorder,
            borderWidth: 1,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'driveledger://?action=recover_trip' }}
        >
          <TextWidget
            text="Review & Recover Trip →"
            style={{ fontSize: 11, fontWeight: 'bold', color: '#0F172A' }}
          />
        </FlexWidget>
      ) : isPermissionError ? (
        /* Permission Error: Grant Permission Action */
        <FlexWidget
          style={{
            width: 'match_parent',
            backgroundColor: COLORS.amber,
            borderRadius: 10,
            paddingVertical: 7,
            alignItems: 'center',
            justifyContent: 'center',
            borderColor: COLORS.amberBorder,
            borderWidth: 1,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'driveledger://?action=permissions' }}
        >
          <TextWidget
            text="Grant Location Permission →"
            style={{ fontSize: 11, fontWeight: 'bold', color: '#0F172A' }}
          />
        </FlexWidget>
      ) : isRecording ? (
        /* Recording: Pause & Finish Controls */
        <FlexWidget
          style={{
            width: 'match_parent',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexGap: 8,
          }}
        >
          {/* Pause Button */}
          <FlexWidget
            style={{
              flex: 1,
              backgroundColor: COLORS.amberBg,
              borderRadius: 10,
              paddingVertical: 7,
              alignItems: 'center',
              justifyContent: 'center',
              borderColor: COLORS.amberBorder,
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
            <TextWidget
              text="⏸ Pause"
              style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.amberText }}
            />
          </FlexWidget>

          {/* Finish Button */}
          <FlexWidget
            style={{
              flex: 1,
              backgroundColor: COLORS.surfaceMid,
              borderRadius: 10,
              paddingVertical: 7,
              alignItems: 'center',
              justifyContent: 'center',
              borderColor: COLORS.border,
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
            <TextWidget
              text="⏹ Finish"
              style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.text }}
            />
          </FlexWidget>
        </FlexWidget>
      ) : isPaused ? (
        /* Paused: Resume & Finish Controls */
        <FlexWidget
          style={{
            width: 'match_parent',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexGap: 8,
          }}
        >
          {/* Resume Button */}
          <FlexWidget
            style={{
              flex: 1,
              backgroundColor: COLORS.greenBg,
              borderRadius: 10,
              paddingVertical: 7,
              alignItems: 'center',
              justifyContent: 'center',
              borderColor: COLORS.greenBorder,
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
            <TextWidget
              text="▶ Resume"
              style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.greenText }}
            />
          </FlexWidget>

          {/* Finish Button */}
          <FlexWidget
            style={{
              flex: 1,
              backgroundColor: COLORS.surfaceMid,
              borderRadius: 10,
              paddingVertical: 7,
              alignItems: 'center',
              justifyContent: 'center',
              borderColor: COLORS.border,
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
            <TextWidget
              text="⏹ Finish"
              style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.text }}
            />
          </FlexWidget>
        </FlexWidget>
      ) : (
        /* Idle: Start GPS Trip Button */
        <FlexWidget
          style={{
            width: 'match_parent',
            backgroundColor: COLORS.sky,
            borderRadius: 10,
            paddingVertical: 7,
            alignItems: 'center',
            justifyContent: 'center',
            borderColor: COLORS.skyDark,
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
          <TextWidget
            text="📍 Start GPS Trip"
            style={{ fontSize: 11, fontWeight: 'bold', color: '#0F172A' }}
          />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
