"use no memo";
import React from 'react';
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

// ─── Satellite Vector SVG Icon ────────────────────────────────────────────────
const SATELLITE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
  <path fill="#38BDF8" d="M12 2a1 1 0 0 1 1 1v1.07A8.003 8.003 0 0 1 20.93 11H22a1 1 0 0 1 0 2h-1.07A8.003 8.003 0 0 1 13 20.93V22a1 1 0 0 1-2 0v-1.07A8.003 8.003 0 0 1 3.07 13H2a1 1 0 0 1 0-2h1.07A8.003 8.003 0 0 1 11 4.07V3a1 1 0 0 1 1-1zm0 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/>
</svg>`;

// ─── Data Shape ──────────────────────────────────────────────────────────────

export type GpsTripWidgetStatus = 'idle' | 'recording' | 'paused' | 'interrupted';

export interface GpsTripWidgetData {
  vehicleId?: string;
  vehicleName: string;
  regNumber: string;
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
}

export const DEFAULT_GPS_WIDGET_DATA: GpsTripWidgetData = {
  vehicleId: '',
  vehicleName: 'DriveLedger',
  regNumber: '',
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
 * GpsTripWidget — Android Home Screen GPS Tracker Widget
 *
 * Distinct widget from VehicleGlanceWidget.
 * Shows honest trip state:
 * - Idle: Vehicle name, last trip summary, Start Trip action
 * - Recording: Live distance snapshot, duration, status badge, Open Active Tracker
 * - Paused: Paused badge, persisted metrics, Resume in App
 * - Interrupted: Clear interruption notice, Recover action
 */
export function GpsTripWidget(props: GpsTripWidgetData) {
  const d: GpsTripWidgetData = {
    ...DEFAULT_GPS_WIDGET_DATA,
    ...props,
  };

  const badge = getStatusBadgeTheme(d.status);
  const isTracking = d.status === 'recording' || d.status === 'paused';
  const isInterrupted = d.status === 'interrupted';

  // Deep link targets:
  // - If tracking: open the active GPS tracker HUD modal
  // - If interrupted: open review/recovery modal
  // - If idle: open vehicle trip history to validate and start
  const targetAction = isTracking
    ? 'active_trip'
    : isInterrupted
    ? 'active_trip'
    : 'start_trip';

  const rootUri = d.vehicleId
    ? `driveledger://?vehicleId=${d.vehicleId}&action=${targetAction}`
    : `driveledger://?action=${targetAction}`;

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
      clickAction="OPEN_URI"
      clickActionData={{ uri: rootUri }}
    >
      {/* ── Row 1: Header ── */}
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
            text={d.vehicleName}
            style={{ fontSize: 14, fontWeight: 'bold', color: COLORS.text }}
            truncate="END"
            maxLines={1}
          />
        </FlexWidget>

        {/* Right: Status Badge & optional vehicle switcher */}
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 5 }}>
          {d.status !== 'recording' && (d.vehicleCount ?? 0) > 1 && (
            <FlexWidget
              style={{
                backgroundColor: COLORS.surfaceMid,
                borderRadius: 6,
                paddingHorizontal: 6,
                paddingVertical: 3,
                borderColor: COLORS.border,
                borderWidth: 1,
              }}
              clickAction="SWITCH_VEHICLE"
            >
              <TextWidget
                text="⇄"
                style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.textSub }}
              />
            </FlexWidget>
          )}

          <FlexWidget
            style={{
              backgroundColor: badge.bg,
              borderRadius: 8,
              paddingHorizontal: 8,
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

      {/* ── Row 2: Central Metric Display ── */}
      {isTracking ? (
        /* Recording / Paused: Live distance & duration snapshot */
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
        >
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 4 }}>
            <TextWidget
              text={d.currentDistanceKm.toFixed(2)}
              style={{ fontSize: 26, fontWeight: 'bold', color: COLORS.sky }}
            />
            <TextWidget
              text="km"
              style={{ fontSize: 14, fontWeight: 'bold', color: COLORS.textSub }}
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
              text={`⏱️ ${d.currentDurationFormatted || '0m'}`}
              style={{ fontSize: 11, color: COLORS.textSub }}
            />
            <TextWidget
              text={
                d.gpsQuality === 'good'
                  ? '📶 GPS Good'
                  : d.gpsQuality === 'fair'
                  ? '📶 GPS Fair'
                  : '📶 GPS Active'
              }
              style={{ fontSize: 10, color: COLORS.textDim }}
            />
          </FlexWidget>
        </FlexWidget>
      ) : isInterrupted ? (
        /* Interrupted session warning */
        <FlexWidget
          style={{
            backgroundColor: COLORS.redBg,
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderColor: COLORS.redBorder,
            borderWidth: 1,
          }}
        >
          <TextWidget
            text="⚠️ Interrupted Session"
            style={{ fontSize: 12, fontWeight: 'bold', color: COLORS.redText }}
          />
          <TextWidget
            text="App closed unexpectedly. Tap below to review & recover collected data."
            style={{ fontSize: 10, color: COLORS.textSub, marginTop: 2 }}
            maxLines={2}
            truncate="END"
          />
        </FlexWidget>
      ) : (
        /* Idle: Last Trip Summary or Ready Prompt */
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

      {/* ── Row 3: Action Button ── */}
      <FlexWidget
        style={{
          width: 'match_parent',
          backgroundColor: isTracking
            ? COLORS.sky
            : isInterrupted
            ? COLORS.red
            : COLORS.surfaceMid,
          borderRadius: 10,
          paddingVertical: 7,
          alignItems: 'center',
          justifyContent: 'center',
          borderColor: isTracking || isInterrupted ? COLORS.bg : COLORS.border,
          borderWidth: 1,
        }}
        clickAction="OPEN_URI"
        clickActionData={{ uri: rootUri }}
      >
        <TextWidget
          text={
            isTracking
              ? 'Open Live Tracker →'
              : isInterrupted
              ? 'Review & Recover →'
              : '📍 Start GPS Trip'
          }
          style={{
            fontSize: 11,
            fontWeight: 'bold',
            color: isTracking || isInterrupted ? '#0F172A' : COLORS.text,
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
