"use no memo";
/**
 * GpsCockpitWidget & GpsCockpitCompactWidget
 *
 * Android home screen widgets for DriveLedger GPS trip tracking.
 *
 * 4×2 Full Widget (GpsCockpitWidget):
 *   Automatically morphs across three operational states:
 *   - Idle / Pre-Flight Launcher
 *   - Active Driving Cockpit HUD (● REC)
 *   - Paused / Pit-Stop Mode
 *
 * 4×1 Compact Widget (GpsCockpitCompactWidget):
 *   A minimal single-row strip with essential live telemetry.
 *
 * Supporting types, SVG assets, helpers, and sub-components live in
 * ./cockpit/ to keep this file focused on layout and state routing.
 */

import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { C } from './cockpit/palette';
import { getGpsBadge } from './cockpit/helpers';
import { VehicleIdentity, TelematicsBar } from './cockpit/subComponents';

// Re-export types and defaults so existing callers don't change their import path.
export type { GpsCockpitWidgetData } from './cockpit/types';
export { DEFAULT_GPS_WIDGET_DATA } from './cockpit/types';

import type { GpsCockpitWidgetData } from './cockpit/types';
import { DEFAULT_GPS_WIDGET_DATA } from './cockpit/types';

// ─── Main 4×2 Widget Component ───────────────────────────────────────────────

/**
 * GpsCockpitWidget — 4×2 Android Home Screen Widget
 *
 * Three state-morphing layouts:
 * - Idle / Pre-Flight Launcher
 * - Active Driving Cockpit HUD (REC)
 * - Paused / Pit-Stop Mode
 */
export function GpsCockpitWidget(props: GpsCockpitWidgetData) {
  const d: GpsCockpitWidgetData = { ...DEFAULT_GPS_WIDGET_DATA, ...props };
  const isRecording = d.recordingState === 'recording';
  const isPaused = d.recordingState === 'paused';
  const outerBorder = isRecording ? C.cyanBorder : isPaused ? C.amberBorder : C.border;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: C.bg,
        borderRadius: 20,
        padding: 12,
        justifyContent: 'space-between',
        borderColor: outerBorder,
        borderWidth: 1.5,
      }}
      clickAction="OPEN_APP"
      clickActionData={{ uri: d.vehicleId ? `driveledger://?vehicleId=${d.vehicleId}` : 'driveledger://' }}
    >
      {isRecording ? renderRecordingView(d) : isPaused ? renderPausedView(d) : renderIdleView(d)}
    </FlexWidget>
  );
}

// ─── State 1: Active Driving Cockpit HUD ────────────────────────────────────

function renderRecordingView(d: GpsCockpitWidgetData) {
  const gpsBadge = getGpsBadge(d.gpsQuality, d.accuracyMeters);
  const recTime = d.tripStartTime ?? '';

  return (
    <FlexWidget style={{ width: 'match_parent', height: 'match_parent', justifyContent: 'space-between' }}>

      {/* ── Row 1: Header ── */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: 'match_parent',
        }}
      >
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 5 }}>
          <FlexWidget
            style={{
              backgroundColor: C.redBg,
              borderColor: C.redBorder,
              borderWidth: 1,
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 6,
              alignItems: 'center',
            }}
          >
            <TextWidget text="● REC" style={{ fontSize: 10, fontWeight: 'bold', color: C.redText }} />
            {recTime ? <TextWidget text={`[${recTime}]`} style={{ fontSize: 8, color: C.redText }} /> : null}
          </FlexWidget>
          {/* No car SVG in recording header — too wide. Show just name+badges. */}
          <VehicleIdentity d={d} size="compact" />
        </FlexWidget>

        <FlexWidget style={{ flexDirection: 'column', alignItems: 'flex-end', flexGap: 4 }}>
          <FlexWidget
            style={{
              backgroundColor: gpsBadge.bg,
              borderColor: gpsBadge.border,
              borderWidth: 1,
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 6,
            }}
          >
            <TextWidget text={gpsBadge.text} style={{ fontSize: 9, fontWeight: 'bold', color: gpsBadge.color }} />
          </FlexWidget>
          <FlexWidget
            style={{
              backgroundColor: C.indigoBg,
              borderColor: C.indigoBorder,
              borderWidth: 1,
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 6,
            }}
            clickAction="OPEN_URI"
            clickActionData={{ uri: 'driveledger://?action=active_trip' }}
          >
            <TextWidget text="📱 Full HUD" style={{ fontSize: 9, fontWeight: 'bold', color: C.indigoText }} />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>

      {/* ── Row 2: Telematics Bar ── */}
      <TelematicsBar
        speedKmh={d.speedKmh}
        distanceKm={d.distanceKm}
        formattedElapsed={d.formattedElapsed}
        sampleCount={d.sampleCount}
        isPaused={false}
      />

      {/* ── Row 3: Action Buttons ── */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          width: 'match_parent',
          flexGap: 8,
        }}
      >
        <FlexWidget
          style={{
            flex: 1,
            backgroundColor: C.amberBg,
            borderColor: C.amberBorder,
            borderWidth: 1,
            borderRadius: 10,
            paddingVertical: 7,
            alignItems: 'center',
            justifyContent: 'center',
            flexGap: 1,
          }}
          clickAction="PAUSE_GPS_TRIP"
        >
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 4 }}>
            <TextWidget text="⏸" style={{ fontSize: 12 }} />
            <TextWidget text="PAUSE TRIP" style={{ fontSize: 11, fontWeight: 'bold', color: C.amberText }} />
          </FlexWidget>
          <TextWidget text="At signal or pit-stop" style={{ fontSize: 8, color: C.amberText }} />
        </FlexWidget>

        <FlexWidget
          style={{
            flex: 1.4,
            backgroundColor: C.redBg,
            borderColor: C.redBorder,
            borderWidth: 1,
            borderRadius: 10,
            paddingVertical: 7,
            alignItems: 'center',
            justifyContent: 'center',
            flexGap: 1,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'driveledger://?action=trip_review' }}
        >
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 4 }}>
            <TextWidget text="🏁" style={{ fontSize: 12 }} />
            <TextWidget text="FINISH & LOG TRIP" style={{ fontSize: 11, fontWeight: 'bold', color: '#FFFFFF' }} />
          </FlexWidget>
          <TextWidget text="Save to Ledger" style={{ fontSize: 8, color: C.redText }} />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}

// ─── State 2: Paused / Pit-Stop Mode ────────────────────────────────────────

function renderPausedView(d: GpsCockpitWidgetData) {
  return (
    <FlexWidget style={{ width: 'match_parent', height: 'match_parent', justifyContent: 'space-between' }}>

      {/* ── Row 1: Header ── */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: 'match_parent',
        }}
      >
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 5 }}>
          <FlexWidget
            style={{
              backgroundColor: C.amberBg,
              borderColor: C.amberBorder,
              borderWidth: 1,
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 6,
            }}
          >
            <TextWidget text="⏸ PAUSED" style={{ fontSize: 10, fontWeight: 'bold', color: C.amberText }} />
          </FlexWidget>
          {/* No car SVG in paused header — too wide */}
          <VehicleIdentity d={d} size="compact" />
        </FlexWidget>

        <FlexWidget
          style={{
            backgroundColor: C.surfaceMid,
            borderColor: C.amberBorder,
            borderWidth: 1,
            paddingHorizontal: 7,
            paddingVertical: 4,
            borderRadius: 6,
            alignItems: 'flex-end',
          }}
        >
          <TextWidget text={`Paused at ${d.distanceKm.toFixed(2)} km`} style={{ fontSize: 9, fontWeight: 'bold', color: C.amberText }} />
          <TextWidget text="● Hold" style={{ fontSize: 8, color: C.amberText }} />
        </FlexWidget>
      </FlexWidget>

      {/* ── Row 2: Frozen Telematics Bar ── */}
      <TelematicsBar
        speedKmh={0}
        distanceKm={d.distanceKm}
        formattedElapsed={d.formattedElapsed}
        sampleCount={d.sampleCount}
        isPaused={true}
      />

      {/* ── Row 3: Resume / Finish Controls ── */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          width: 'match_parent',
          flexGap: 8,
        }}
      >
        <FlexWidget
          style={{
            flex: 1.3,
            backgroundColor: C.greenBg,
            borderColor: C.greenBorder,
            borderWidth: 1,
            borderRadius: 10,
            paddingVertical: 7,
            alignItems: 'center',
            justifyContent: 'center',
            flexGap: 1,
          }}
          clickAction="OPEN_URI"
          clickActionData={{
            uri: d.vehicleId
              ? `driveledger://?action=resume_gps&vehicleId=${d.vehicleId}`
              : 'driveledger://?action=resume_gps',
          }}
        >
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 4 }}>
            <TextWidget text="▶" style={{ fontSize: 12, color: C.greenText }} />
            <TextWidget text="RESUME TRACKING" style={{ fontSize: 11, fontWeight: 'bold', color: C.greenText }} />
          </FlexWidget>
          <TextWidget text="Set baseline anchor" style={{ fontSize: 8, color: C.greenText }} />
        </FlexWidget>

        <FlexWidget
          style={{
            flex: 1,
            backgroundColor: C.surfaceMid,
            borderColor: C.border,
            borderWidth: 1,
            borderRadius: 10,
            paddingVertical: 7,
            alignItems: 'center',
            justifyContent: 'center',
            flexGap: 1,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'driveledger://?action=trip_review' }}
        >
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 4 }}>
            <TextWidget text="🏁" style={{ fontSize: 12 }} />
            <TextWidget text="FINISH & LOG" style={{ fontSize: 11, fontWeight: 'bold', color: C.text }} />
          </FlexWidget>
          <TextWidget text="Complete trip here" style={{ fontSize: 8, color: C.textSub }} />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}

// ─── State 3: Idle / Pre-Flight Launcher ────────────────────────────────────

function renderIdleView(d: GpsCockpitWidgetData) {
  const odoFormatted = Number(d.currentOdometer || 0).toLocaleString('en-IN');
  const lastTripText =
    d.lastTripDistanceKm != null
      ? `${d.lastTripDistanceKm.toFixed(1)} km${d.lastTripDuration ? ` (${d.lastTripDuration})` : ''}`
      : 'No trips logged';

  return (
    <FlexWidget style={{ width: 'match_parent', height: 'match_parent', justifyContent: 'space-between' }}>

      {/* ── Row 1: Header ── */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: 'match_parent',
        }}
      >
        <VehicleIdentity d={d} size="normal" />

        <FlexWidget style={{ flexDirection: 'column', alignItems: 'flex-end', flexGap: 4 }}>
          {d.vehicleCount > 1 && (
            <FlexWidget
              style={{
                backgroundColor: C.indigoBg,
                borderColor: C.indigoBorder,
                borderWidth: 1,
                paddingHorizontal: 7,
                paddingVertical: 2,
                borderRadius: 6,
                flexDirection: 'row',
                alignItems: 'center',
                flexGap: 3,
              }}
              clickAction="SWITCH_VEHICLE"
            >
              <TextWidget text="🔄" style={{ fontSize: 10 }} />
              <TextWidget text="Switch" style={{ fontSize: 10, fontWeight: 'bold', color: C.indigoText }} />
            </FlexWidget>
          )}
          <FlexWidget
            style={{
              backgroundColor: C.greenBg,
              borderColor: C.greenBorder,
              borderWidth: 1,
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 6,
            }}
          >
            <TextWidget text="● 100% Offline" style={{ fontSize: 9, fontWeight: 'bold', color: C.greenText }} />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>

      {/* ── Row 2: Status pills ── */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: C.surface,
          borderRadius: 12,
          paddingHorizontal: 10,
          paddingVertical: 7,
          borderColor: C.border,
          borderWidth: 1,
          width: 'match_parent',
        }}
      >
        <FlexWidget style={{ alignItems: 'flex-start' }}>
          <TextWidget text="ODO" style={{ fontSize: 8, fontWeight: 'bold', color: C.textDim }} />
          <TextWidget text={`${odoFormatted} km`} style={{ fontSize: 13, fontWeight: 'bold', color: C.text, marginTop: 1 }} />
        </FlexWidget>

        <FlexWidget style={{ width: 1, height: 26, backgroundColor: C.surfaceLight }} />

        <FlexWidget style={{ alignItems: 'flex-start' }}>
          <TextWidget text="LAST TRIP" style={{ fontSize: 8, fontWeight: 'bold', color: C.textDim }} />
          <TextWidget
            text={lastTripText}
            style={{ fontSize: 12, fontWeight: '600', color: C.cyanText, marginTop: 1 }}
            truncate="END"
            maxLines={1}
          />
        </FlexWidget>

        <FlexWidget style={{ width: 1, height: 26, backgroundColor: C.surfaceLight }} />

        <FlexWidget style={{ alignItems: 'flex-start' }}>
          <TextWidget text="READINESS" style={{ fontSize: 8, fontWeight: 'bold', color: C.textDim }} />
          <TextWidget
            text={d.checklistSummary ?? 'Ready ✅'}
            style={{ fontSize: 12, fontWeight: 'bold', color: C.greenText, marginTop: 1 }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* ── Row 3: Action Buttons ── */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          width: 'match_parent',
          flexGap: 8,
        }}
      >
        <FlexWidget
          style={{
            flex: 2,
            backgroundColor: C.greenBg,
            borderColor: C.greenBorder,
            borderWidth: 1.5,
            borderRadius: 10,
            paddingVertical: 8,
            alignItems: 'center',
            justifyContent: 'center',
            flexGap: 1,
          }}
          clickAction="OPEN_URI"
          clickActionData={{
            uri: d.vehicleId
              ? `driveledger://?action=start_gps&vehicleId=${d.vehicleId}`
              : 'driveledger://?action=start_gps',
          }}
        >
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 6 }}>
            <TextWidget text="▶" style={{ fontSize: 14, color: C.greenText }} />
            <TextWidget text="START GPS TRIP" style={{ fontSize: 12, fontWeight: 'bold', color: C.greenText }} />
          </FlexWidget>
          <TextWidget text="One-tap background tracking" style={{ fontSize: 8, color: C.greenText }} />
        </FlexWidget>

        <FlexWidget
          style={{
            flex: 1,
            backgroundColor: C.surfaceMid,
            borderColor: C.border,
            borderWidth: 1,
            borderRadius: 10,
            paddingVertical: 8,
            alignItems: 'center',
            justifyContent: 'center',
            flexGap: 1,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'driveledger://?action=trip_checklist' }}
        >
          <TextWidget text="🛣️" style={{ fontSize: 14 }} />
          <TextWidget text="Highway Checklist" style={{ fontSize: 9, fontWeight: '600', color: C.text }} />
          <TextWidget text="Inspect tyres & oil" style={{ fontSize: 8, color: C.textSub }} />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}

// ─── 4×1 Compact Widget Component ───────────────────────────────────────────

/**
 * GpsCockpitCompactWidget — 4×1 Single-Row Home Screen Widget
 *
 * A minimal strip showing essential live telemetry in one row:
 * - Idle: vehicle name | START button | Switch button
 * - Recording: ● REC [time] | speed | distance | elapsed | ⏸
 * - Paused: ⏸ PAUSED | 0 km/h | distance | elapsed | ▶
 */
export function GpsCockpitCompactWidget(props: GpsCockpitWidgetData) {
  const d: GpsCockpitWidgetData = { ...DEFAULT_GPS_WIDGET_DATA, ...props };
  const isRecording = d.recordingState === 'recording';
  const isPaused = d.recordingState === 'paused';
  const outerBorder = isRecording ? C.cyanBorder : isPaused ? C.amberBorder : C.border;

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: C.bg,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderColor: outerBorder,
        borderWidth: 1.5,
      }}
      clickAction="OPEN_APP"
      clickActionData={{ uri: d.vehicleId ? `driveledger://?vehicleId=${d.vehicleId}` : 'driveledger://' }}
    >
      {isRecording ? renderCompactRecording(d) : isPaused ? renderCompactPaused(d) : renderCompactIdle(d)}
    </FlexWidget>
  );
}

function renderCompactIdle(d: GpsCockpitWidgetData) {
  return (
    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: 'match_parent', height: 'match_parent' }}>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 6, flex: 1 }}>
        <FlexWidget style={{ justifyContent: 'center' }}>
          <TextWidget text={d.vehicleName} style={{ fontSize: 13, fontWeight: 'bold', color: C.text }} truncate="END" maxLines={1} />
          <TextWidget text={d.regNumber} style={{ fontSize: 10, color: C.textSub }} />
        </FlexWidget>
      </FlexWidget>

      <FlexWidget
        style={{
          backgroundColor: C.greenBg,
          borderColor: C.greenBorder,
          borderWidth: 1.5,
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 6,
          flexDirection: 'row',
          alignItems: 'center',
          flexGap: 5,
        }}
        clickAction="OPEN_URI"
        clickActionData={{
          uri: d.vehicleId
            ? `driveledger://?action=start_gps&vehicleId=${d.vehicleId}`
            : 'driveledger://?action=start_gps',
        }}
      >
        <TextWidget text="▶" style={{ fontSize: 12, color: C.greenText }} />
        <TextWidget text="START" style={{ fontSize: 12, fontWeight: 'bold', color: C.greenText }} />
      </FlexWidget>

      {d.vehicleCount > 1 && (
        <FlexWidget
          style={{
            backgroundColor: C.indigoBg,
            borderColor: C.indigoBorder,
            borderWidth: 1,
            borderRadius: 10,
            paddingHorizontal: 10,
            paddingVertical: 6,
            marginLeft: 6,
          }}
          clickAction="SWITCH_VEHICLE"
        >
          <TextWidget text="🔄" style={{ fontSize: 14 }} />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

function renderCompactRecording(d: GpsCockpitWidgetData) {
  return (
    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: 'match_parent', height: 'match_parent' }}>
      {/* ── Vehicle Identity & Live Status ── */}
      <FlexWidget
        style={{
          flexDirection: 'column',
          justifyContent: 'center',
          width: 105,
        }}
      >
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 4 }}>
          <FlexWidget
            style={{
              backgroundColor: C.redBg,
              borderColor: C.redBorder,
              borderWidth: 1,
              borderRadius: 6,
              paddingHorizontal: 4,
              paddingVertical: 1,
            }}
          >
            <TextWidget text="● REC" style={{ fontSize: 9, fontWeight: 'bold', color: C.redText }} />
          </FlexWidget>
          <TextWidget
            text={d.vehicleName}
            style={{ fontSize: 11, fontWeight: 'bold', color: C.text }}
            truncate="END"
            maxLines={1}
          />
        </FlexWidget>
        <TextWidget
          text={d.regNumber || (d.tripStartTime ? `[${d.tripStartTime}]` : '')}
          style={{ fontSize: 8, color: C.textSub, marginTop: 1 }}
          truncate="END"
          maxLines={1}
        />
      </FlexWidget>

      <FlexWidget style={{ width: 1, height: 26, backgroundColor: C.surfaceLight, marginHorizontal: 3 }} />

      {/* ── Speed ── */}
      <FlexWidget style={{ alignItems: 'center' }}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end', flexGap: 1 }}>
          <TextWidget text={String(d.speedKmh)} style={{ fontSize: 19, fontWeight: 'bold', color: C.greenText }} />
          <TextWidget text="km/h" style={{ fontSize: 8, color: C.textSub, marginBottom: 2 }} />
        </FlexWidget>
      </FlexWidget>

      <FlexWidget style={{ width: 1, height: 26, backgroundColor: C.surfaceLight, marginHorizontal: 3 }} />

      {/* ── Distance ── */}
      <FlexWidget style={{ alignItems: 'center' }}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end', flexGap: 1 }}>
          <TextWidget text={d.distanceKm.toFixed(1)} style={{ fontSize: 19, fontWeight: 'bold', color: C.cyanText }} />
          <TextWidget text="km" style={{ fontSize: 8, color: C.cyanText, marginBottom: 2 }} />
        </FlexWidget>
      </FlexWidget>

      <FlexWidget style={{ width: 1, height: 26, backgroundColor: C.surfaceLight, marginHorizontal: 3 }} />

      {/* ── Elapsed Duration ── */}
      <FlexWidget style={{ alignItems: 'center' }}>
        <TextWidget text={d.formattedElapsed} style={{ fontSize: 17, fontWeight: 'bold', color: C.text }} />
      </FlexWidget>

      {/* ── Pause Trip Button ── */}
      <FlexWidget
        style={{
          backgroundColor: C.amberBg,
          borderColor: C.amberBorder,
          borderWidth: 1,
          borderRadius: 8,
          paddingHorizontal: 9,
          paddingVertical: 5,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: 4,
        }}
        clickAction="PAUSE_GPS_TRIP"
      >
        <TextWidget text="⏸" style={{ fontSize: 13, color: C.amberText }} />
      </FlexWidget>
    </FlexWidget>
  );
}

function renderCompactPaused(d: GpsCockpitWidgetData) {
  return (
    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: 'match_parent', height: 'match_parent' }}>
      {/* ── Vehicle Identity & Paused Status ── */}
      <FlexWidget
        style={{
          flexDirection: 'column',
          justifyContent: 'center',
          width: 105,
        }}
      >
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 4 }}>
          <FlexWidget
            style={{
              backgroundColor: C.amberBg,
              borderColor: C.amberBorder,
              borderWidth: 1,
              borderRadius: 6,
              paddingHorizontal: 4,
              paddingVertical: 1,
            }}
          >
            <TextWidget text="⏸ PAUSED" style={{ fontSize: 9, fontWeight: 'bold', color: C.amberText }} />
          </FlexWidget>
          <TextWidget
            text={d.vehicleName}
            style={{ fontSize: 11, fontWeight: 'bold', color: C.text }}
            truncate="END"
            maxLines={1}
          />
        </FlexWidget>
        <TextWidget
          text={d.regNumber}
          style={{ fontSize: 8, color: C.textSub, marginTop: 1 }}
          truncate="END"
          maxLines={1}
        />
      </FlexWidget>

      <FlexWidget style={{ width: 1, height: 26, backgroundColor: C.surfaceLight, marginHorizontal: 3 }} />

      {/* ── Speed (Frozen at 0) ── */}
      <FlexWidget style={{ alignItems: 'center' }}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end', flexGap: 1 }}>
          <TextWidget text="0" style={{ fontSize: 19, fontWeight: 'bold', color: C.textDim }} />
          <TextWidget text="km/h" style={{ fontSize: 8, color: C.textDim, marginBottom: 2 }} />
        </FlexWidget>
      </FlexWidget>

      <FlexWidget style={{ width: 1, height: 26, backgroundColor: C.surfaceLight, marginHorizontal: 3 }} />

      {/* ── Distance (Frozen) ── */}
      <FlexWidget style={{ alignItems: 'center' }}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end', flexGap: 1 }}>
          <TextWidget text={d.distanceKm.toFixed(1)} style={{ fontSize: 19, fontWeight: 'bold', color: C.amberText }} />
          <TextWidget text="km" style={{ fontSize: 8, color: C.amberText, marginBottom: 2 }} />
        </FlexWidget>
      </FlexWidget>

      <FlexWidget style={{ width: 1, height: 26, backgroundColor: C.surfaceLight, marginHorizontal: 3 }} />

      {/* ── Elapsed Duration ── */}
      <FlexWidget style={{ alignItems: 'center' }}>
        <TextWidget text={d.formattedElapsed} style={{ fontSize: 17, fontWeight: 'bold', color: C.amberText }} />
      </FlexWidget>

      {/* ── Resume Trip Button ── */}
      <FlexWidget
        style={{
          backgroundColor: C.greenBg,
          borderColor: C.greenBorder,
          borderWidth: 1,
          borderRadius: 8,
          paddingHorizontal: 9,
          paddingVertical: 5,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: 4,
        }}
        clickAction="OPEN_URI"
        clickActionData={{
          uri: d.vehicleId
            ? `driveledger://?action=resume_gps&vehicleId=${d.vehicleId}`
            : 'driveledger://?action=resume_gps',
        }}
      >
        <TextWidget text="▶" style={{ fontSize: 13, color: C.greenText }} />
      </FlexWidget>
    </FlexWidget>
  );
}
