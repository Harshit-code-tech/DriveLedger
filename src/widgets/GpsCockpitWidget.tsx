"use no memo";
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

// ─── Car Silhouette SVG (white hatchback side-profile) ───────────────────────
const CAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 56" width="90" height="42">
  <path d="M8 36 Q8 28 16 26 L30 16 Q38 10 52 10 L72 10 Q84 10 90 16 L102 26 Q112 28 114 36 L114 40 Q114 43 111 43 L100 43 Q98 50 90 50 Q82 50 80 43 L40 43 Q38 50 30 50 Q22 50 20 43 L9 43 Q8 43 8 40 Z" fill="#E2E8F0" stroke="#94A3B8" stroke-width="1.2"/>
  <path d="M54 12 L36 26 L82 26 L76 12 Z" fill="#7DD3FC" fill-opacity="0.55" stroke="#94A3B8" stroke-width="0.8"/>
  <path d="M92 16 L84 26 L102 26 L98 18 Z" fill="#7DD3FC" fill-opacity="0.45" stroke="#94A3B8" stroke-width="0.8"/>
  <circle cx="90" cy="46" r="9" fill="#1E293B" stroke="#475569" stroke-width="1.5"/>
  <circle cx="90" cy="46" r="4.5" fill="#334155"/>
  <circle cx="30" cy="46" r="9" fill="#1E293B" stroke="#475569" stroke-width="1.5"/>
  <circle cx="30" cy="46" r="4.5" fill="#334155"/>
  <rect x="108" y="32" width="6" height="5" rx="2" fill="#FDE68A" fill-opacity="0.9"/>
  <rect x="8" y="32" width="5" height="5" rx="2" fill="#FCA5A5" fill-opacity="0.8"/>
  <path d="M36 26 L36 40" stroke="#94A3B8" stroke-width="0.7" stroke-dasharray="2,2"/>
  <path d="M64 26 L64 40" stroke="#94A3B8" stroke-width="0.7" stroke-dasharray="2,2"/>
  <path d="M84 26 L84 40" stroke="#94A3B8" stroke-width="0.7" stroke-dasharray="2,2"/>
</svg>`;

// ─── Two-Wheeler Silhouette SVG (Motorcycle / Scooter side-profile) ───────────
const BIKE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 75" width="90" height="42">
  <defs>
    <linearGradient id="bikeRed" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FDA4AF"/>
      <stop offset="50%" stop-color="#E11D48"/>
      <stop offset="100%" stop-color="#881337"/>
    </linearGradient>

    <linearGradient id="bikeGold" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#92400E"/>
      <stop offset="50%" stop-color="#FDE68A"/>
      <stop offset="100%" stop-color="#D97706"/>
    </linearGradient>

    <linearGradient id="bikeBeam" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#38BDF8" stop-opacity=".25"/>
      <stop offset="100%" stop-color="#38BDF8" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Wheels and tires -->
  <g fill="#0B0F19" stroke="#475569" stroke-width="1.5">
    <circle cx="34" cy="51" r="15"/>
    <circle cx="125" cy="51" r="15"/>
  </g>

  <!-- Alloy rims -->
  <g fill="#1E293B" stroke="#FBBF24" stroke-width="1.2">
    <circle cx="34" cy="51" r="11"/>
    <circle cx="125" cy="51" r="11"/>
  </g>

  <!-- Alloy spokes -->
  <g stroke="#FBBF24" stroke-width=".8">
    <path d="M34 51L44 51 M34 51L41.1 43.9
             M34 51L34 41 M34 51L26.9 43.9
             M34 51L24 51 M34 51L26.9 58.1
             M34 51L34 61 M34 51L41.1 58.1"/>
    <path d="M125 51L135 51 M125 51L132.1 43.9
             M125 51L125 41 M125 51L117.9 43.9
             M125 51L115 51 M125 51L117.9 58.1
             M125 51L125 61 M125 51L132.1 58.1"/>
  </g>

  <!-- Wheel hubs -->
  <g fill="#334155" stroke="#CBD5E1" stroke-width=".8">
    <circle cx="34" cy="51" r="4"/>
    <circle cx="125" cy="51" r="4"/>
    <circle cx="34" cy="51" r="1.5" fill="#0F172A"/>
    <circle cx="125" cy="51" r="1.5" fill="#0F172A"/>
  </g>

  <!-- Rear swingarm and frame -->
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M34 50L57 44L77 48L54 53Z"
          fill="#1E293B" stroke="#64748B" stroke-width="1.2"/>
    <path d="M52 47L67 33L90 35L76 48"
          stroke="#64748B" stroke-width="2"/>
    <path d="M55 46L65 34"
          stroke="url(#bikeGold)" stroke-width="3"/>
    <path d="M62 35L70 45L81 43L90 35"
          stroke="#475569" stroke-width="1.6"/>
  </g>

  <!-- Exhaust -->
  <path d="M49 51L31 43L25 37L28 35L38 42L52 47Z"
        fill="#0F172A" stroke="#94A3B8" stroke-width="1"/>
  <path d="M25 37L28 35"
        stroke="#FB7185" stroke-width="1.5"/>

  <!-- Fuel tank and bodywork -->
  <path d="M99 24Q87 19 76 25L56 31L43 29L39 33
           Q60 40 77 36L94 34L105 29Z"
        fill="url(#bikeRed)" stroke="#881337" stroke-width=".8"/>

  <!-- Tank highlight -->
  <path d="M97 25Q85 22 76 27L59 32"
        fill="none" stroke="#FDA4AF" stroke-width="1.2"
        stroke-linecap="round"/>

  <!-- Rear seat and tail -->
  <path d="M56 29Q47 28 39 29L22 24L18 25
           L38 33L59 34L69 31Z"
        fill="#090D16" stroke="#334155" stroke-width=".8"/>

  <path d="M22 24L18 25L25 29L32 30L28 26Z"
        fill="#E11D48"/>

  <!-- Front fairing -->
  <path d="M96 31L87 41L78 39L87 32Z"
        fill="#1E293B" stroke="#64748B" stroke-width=".8"/>
  <path d="M88 34L82 39"
        stroke="#FB7185" stroke-width="1.2"/>

  <!-- Engine block -->
  <path d="M70 37L85 36L88 44L81 49L68 47Z"
        fill="#1E293B" stroke="#64748B" stroke-width="1"/>

  <!-- Engine cooling fins -->
  <g stroke="#94A3B8" stroke-width=".8">
    <path d="M71 39H84"/>
    <path d="M70 42H83"/>
    <path d="M70 45H81"/>
  </g>

  <!-- Crankcase -->
  <circle cx="75" cy="47" r="4"
          fill="#334155" stroke="#94A3B8" stroke-width="1"/>
  <circle cx="75" cy="47" r="1.5" fill="#0F172A"/>

  <!-- Front suspension -->
  <path d="M125 51L105 18"
        stroke="url(#bikeGold)" stroke-width="3"
        stroke-linecap="round" fill="none"/>

  <path d="M125 51L116 34"
        stroke="#CBD5E1" stroke-width="2"
        stroke-linecap="round" fill="none"/>

  <!-- Handlebars -->
  <path d="M105 18L100 14L94 15"
        stroke="#CBD5E1" stroke-width="2"
        stroke-linecap="round" fill="none"/>

  <path d="M100 14L94 15"
        stroke="#06B6D4" stroke-width="2.5"
        stroke-linecap="round" fill="none"/>

  <!-- Headlight housing -->
  <path d="M106 22L112 24L108 28L101 26Z"
        fill="#0F172A" stroke="#64748B" stroke-width=".8"/>

  <!-- LED headlight -->
  <path d="M109 24L116 26L110 28Z"
        fill="#67E8F9"/>

  <!-- Headlight beam -->
  <path d="M115 25L159 17L159 37L115 28Z"
        fill="url(#bikeBeam)"/>

  <!-- Front mudguard -->
  <path d="M113 43Q120 34 137 40"
        fill="none" stroke="#FB7185"
        stroke-width="2.2" stroke-linecap="round"/>

  <!-- Rear brake detail -->
  <circle cx="34" cy="51" r="7"
          fill="none" stroke="#94A3B8" stroke-width=".8"
          stroke-dasharray="3 2"/>

  <!-- Front brake detail -->
  <circle cx="125" cy="51" r="7"
          fill="none" stroke="#94A3B8" stroke-width=".8"
          stroke-dasharray="3 2"/>

  <!-- Rear monoshock -->
  <path d="M48 44L57 37"
        stroke="#FBBF24" stroke-width="2.4"
        stroke-linecap="round" fill="none"/>

  <path d="M48 44L57 37"
        stroke="#0F172A" stroke-width=".8"
        stroke-dasharray="1.5 1.5" fill="none"/>
</svg>
`;

// ─── Telemetry Icon SVGs ─────────────────────────────────────────────────────
const SPEEDO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none">
  <circle cx="12" cy="13" r="9" stroke="#10B981" stroke-width="1.8"/>
  <path d="M12 13 L7 8" stroke="#10B981" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M5 13 Q5 8 8 6" stroke="#10B981" stroke-width="1.4" stroke-linecap="round" fill="none"/>
  <path d="M19 13 Q19 8 16 6" stroke="#10B981" stroke-width="1.4" stroke-linecap="round" fill="none"/>
  <circle cx="12" cy="13" r="1.5" fill="#10B981"/>
</svg>`;

const ROAD_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none">
  <path d="M4 20 L12 4 L20 20" stroke="#06B6D4" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M7.5 13 L16.5 13" stroke="#06B6D4" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M5.5 17.5 L18.5 17.5" stroke="#06B6D4" stroke-width="1.4" stroke-linecap="round"/>
  <line x1="12" y1="4" x2="12" y2="20" stroke="#06B6D4" stroke-width="1.2" stroke-dasharray="2,2.5" stroke-linecap="round"/>
</svg>`;

const CLOCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none">
  <circle cx="12" cy="12" r="9" stroke="#94A3B8" stroke-width="1.8"/>
  <path d="M12 7 L12 12 L15.5 14.5" stroke="#94A3B8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const PAUSE_CLOCK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none">
  <circle cx="12" cy="12" r="9" stroke="#F59E0B" stroke-width="1.8"/>
  <path d="M12 7 L12 12 L15.5 14.5" stroke="#F59E0B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// ─── CNG Tank SVG ─────────────────────────────────────────────────────────────

const CNG_TANK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 26" width="18" height="24">
  <rect x="7" y="0.5" width="6" height="2.5" rx="1" fill="#D97706" stroke="#B45309" stroke-width="0.5"/>
  <rect x="8.5" y="3" width="3" height="2" fill="#475569"/>
  <rect x="3" y="5" width="14" height="20.5" rx="5.5" fill="#059669"/>
  <rect x="4.5" y="6.5" width="2" height="17.5" rx="1" fill="#FFFFFF" fill-opacity="0.35"/>
  <line x1="3" y1="9.5" x2="17" y2="9.5" stroke="#000000" stroke-opacity="0.15" stroke-width="0.8"/>
  <text x="10" y="17.5" font-size="5" font-family="sans-serif" font-weight="900" fill="#FFFFFF" text-anchor="middle">CNG</text>
</svg>`;




// ─── Data Shape ──────────────────────────────────────────────────────────────

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

// ─── Cyber-OLED Color Palette ─────────────────────────────────────────────────

const C = {
  bg: '#0B1120',
  surface: '#162032',
  surfaceMid: '#1E293B',
  surfaceLight: '#334155',
  border: '#334155',
  text: '#F8FAFC',
  textSub: '#94A3B8',
  textDim: '#64748B',

  cyan: '#06B6D4',
  cyanBg: '#083344',
  cyanBorder: '#0E7490',
  cyanText: '#67E8F9',

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

  indigo: '#6366F1',
  indigoBg: '#1E1B4B',
  indigoBorder: '#4F46E5',
  indigoText: '#A5B4FC',
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fuelBadge(fuelType: string): { label: string; bg: string; color: string; border: string } {
  switch (fuelType) {
    case 'electric':
      return { label: 'Electric', bg: '#082f49', color: '#7DD3FC', border: '#0369A1' };
    case 'hybrid':
      return { label: 'Hybrid', bg: C.greenBg, color: C.greenText, border: C.greenBorder };
    case 'cng':
      return { label: 'CNG', bg: C.greenBg, color: C.greenText, border: C.greenBorder };
    case 'diesel':
      return { label: 'Diesel', bg: '#1C1917', color: '#D6D3D1', border: '#57534E' };
    case 'petrol':
    default:
      return { label: 'Petrol', bg: '#1C1400', color: '#FDE68A', border: '#92400E' };
  }
}

function getGpsBadge(quality: GpsCockpitWidgetData['gpsQuality'], accuracy: number | null) {
  const acc = accuracy ? ` (${Math.round(accuracy)} m)` : '';
  switch (quality) {
    case 'good':
      return { text: `GPS Lock${acc}`, color: C.greenText, bg: C.greenBg, border: C.greenBorder };
    case 'fair':
      return { text: `GPS Fair${acc}`, color: C.amberText, bg: C.amberBg, border: C.amberBorder };
    case 'poor':
      return { text: `GPS Weak${acc}`, color: C.redText, bg: C.redBg, border: C.redBorder };
    default:
      return { text: 'Acquiring GPS', color: C.textSub, bg: C.surfaceMid, border: C.border };
  }
}

function speedLabel(kmh: number): string {
  if (kmh > 75) return 'Express';
  if (kmh > 35) return 'Cruising';
  if (kmh > 5) return 'City';
  return 'Idle';
}

// ─── Shared Sub-Components ───────────────────────────────────────────────────

/** Vehicle identity block: car SVG + name + reg badge + fuel badge */
function VehicleIdentity({ d, size }: { d: GpsCockpitWidgetData; size: 'normal' | 'compact' }) {
  const fuel = fuelBadge(d.fuelType);
  const nameSize = size === 'compact' ? 11 : 13;
  const regSize = size === 'compact' ? 9 : 10;

  return (
    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: size === 'compact' ? 4 : 6 }}>
      {size === 'normal' && (
        <SvgWidget
          svg={d.vehicleType === 'two_wheeler' ? BIKE_SVG : CAR_SVG}
          style={{ width: 64, height: 30 }}
        />
      )}
      <FlexWidget style={{ justifyContent: 'center', flexGap: 2 }}>
        <TextWidget
          text={d.vehicleName}
          style={{ fontSize: nameSize, fontWeight: 'bold', color: C.text }}
          truncate="END"
          maxLines={1}
        />
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 4 }}>
          <FlexWidget
            style={{
              backgroundColor: C.surfaceMid,
              borderColor: C.border,
              borderWidth: 1,
              paddingHorizontal: 5,
              paddingVertical: 1,
              borderRadius: 4,
            }}
          >
            <TextWidget text={d.regNumber} style={{ fontSize: regSize, color: C.textSub, fontWeight: '600' }} />
          </FlexWidget>
          <FlexWidget
            style={{
              backgroundColor: fuel.bg,
              borderColor: fuel.border,
              borderWidth: 1,
              paddingHorizontal: 5,
              paddingVertical: 1,
              borderRadius: 4,
            }}
          >
            <TextWidget text={fuel.label} style={{ fontSize: regSize, color: fuel.color, fontWeight: '600' }} />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}

/** 3-column telematics bar with SVG icons */
function TelematicsBar({
  speedKmh, distanceKm, formattedElapsed, sampleCount, isPaused,
}: {
  speedKmh: number; distanceKm: number; formattedElapsed: string; sampleCount: number; isPaused: boolean;
}) {
  const distColor = isPaused ? C.amberText : C.cyanText;
  const distLabel = isPaused ? 'FROZEN' : 'DISTANCE';
  const distSub = isPaused ? 'No Drift' : `${sampleCount} pts`;
  const speedVal = isPaused ? '0' : String(speedKmh);
  const speedSub = isPaused ? 'Stopped' : speedLabel(speedKmh);
  const speedColor = isPaused ? C.textDim : C.greenText;
  const timeColor = isPaused ? C.amberText : C.text;
  const timeSub = isPaused ? 'Pit-Stop' : 'active';
  const timeSubColor = isPaused ? C.amberText : C.greenText;

  return (
    <FlexWidget
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: C.surface,
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderColor: isPaused ? C.amberBorder : C.border,
        borderWidth: 1,
        width: 'match_parent',
      }}
    >
      <FlexWidget style={{ flex: 1, alignItems: 'center', flexGap: 1 }}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 3 }}>
          <SvgWidget svg={SPEEDO_SVG} style={{ width: 13, height: 13 }} />
          <TextWidget text="SPEED" style={{ fontSize: 8, fontWeight: 'bold', color: C.textDim }} />
        </FlexWidget>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end', flexGap: 1 }}>
          <TextWidget text={speedVal} style={{ fontSize: 22, fontWeight: 'bold', color: speedColor }} />
          <TextWidget text="km/h" style={{ fontSize: 8, color: C.textSub, marginBottom: 3 }} />
        </FlexWidget>
        <TextWidget text={speedSub} style={{ fontSize: 8, color: C.textSub }} />
      </FlexWidget>

      <FlexWidget style={{ width: 1, height: 34, backgroundColor: C.surfaceLight }} />

      <FlexWidget style={{ flex: 1.2, alignItems: 'center', flexGap: 1 }}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 3 }}>
          <SvgWidget svg={ROAD_SVG} style={{ width: 13, height: 13 }} />
          <TextWidget text={distLabel} style={{ fontSize: 8, fontWeight: 'bold', color: C.textDim }} />
        </FlexWidget>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end', flexGap: 1 }}>
          <TextWidget text={distanceKm.toFixed(2)} style={{ fontSize: 22, fontWeight: 'bold', color: distColor }} />
          <TextWidget text="km" style={{ fontSize: 8, fontWeight: 'bold', color: distColor, marginBottom: 3 }} />
        </FlexWidget>
        <TextWidget text={distSub} style={{ fontSize: 8, color: C.textSub }} />
      </FlexWidget>

      <FlexWidget style={{ width: 1, height: 34, backgroundColor: C.surfaceLight }} />

      <FlexWidget style={{ flex: 1, alignItems: 'center', flexGap: 1 }}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 3 }}>
          <SvgWidget svg={isPaused ? PAUSE_CLOCK_SVG : CLOCK_SVG} style={{ width: 13, height: 13 }} />
          <TextWidget text="ELAPSED" style={{ fontSize: 8, fontWeight: 'bold', color: C.textDim }} />
        </FlexWidget>
        <TextWidget text={formattedElapsed} style={{ fontSize: 20, fontWeight: 'bold', color: timeColor }} />
        <TextWidget text={timeSub} style={{ fontSize: 8, color: timeSubColor }} />
      </FlexWidget>
    </FlexWidget>
  );
}

// ─── Main 4×2 Widget Component ───────────────────────────────────────────────

/**
 * GpsCockpitWidget — 4×2 Telematics Cockpit Home Screen Widget
 *
 * Automatically adapts across 3 operational states:
 * - Idle / Pre-Flight Launcher
 * - Active Driving Cockpit HUD
 * - Paused / Pit-Stop Mode
 */
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
          alignItems: 'stretch',
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
          alignItems: 'stretch',
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
          clickAction="RESUME_GPS_TRIP"
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
          alignItems: 'stretch',
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
          clickAction="START_GPS_TRIP"
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
        clickAction="START_GPS_TRIP"
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
          maxWidth: 105,
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
          maxWidth: 105,
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
        clickAction="RESUME_GPS_TRIP"
      >
        <TextWidget text="▶" style={{ fontSize: 13, color: C.greenText }} />
      </FlexWidget>
    </FlexWidget>
  );
}
