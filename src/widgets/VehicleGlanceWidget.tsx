import React from 'react';
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';

// ─── Custom CNG Tank Vector Icon (SVG for Android Widget RemoteViews) ─────────
// Authentic compressed natural gas cylinder matching CngTankIcon:
// Brass valve knob (#D97706), steel neck (#475569), high-pressure body (#059669),
// 3D gloss highlight, neck collar weld line, and bold "CNG" mark.
const CNG_TANK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 26" width="20" height="26">
  <rect x="7" y="0.5" width="6" height="2.5" rx="1" fill="#D97706" stroke="#B45309" stroke-width="0.5"/>
  <rect x="8.5" y="3" width="3" height="2" fill="#475569"/>
  <rect x="3" y="5" width="14" height="20.5" rx="5.5" fill="#059669"/>
  <rect x="4.5" y="6.5" width="2" height="17.5" rx="1" fill="#FFFFFF" fill-opacity="0.35"/>
  <line x1="3" y1="9.5" x2="17" y2="9.5" stroke="#000000" stroke-opacity="0.15" stroke-width="0.8"/>
  <text x="10" y="17.5" font-size="5" font-family="sans-serif" font-weight="900" fill="#FFFFFF" text-anchor="middle">CNG</text>
</svg>`;

export function isCngFuel(fuelType: string): boolean {
  return fuelType === 'cng';
}

// ─── Data Shape ──────────────────────────────────────────────────────────────

export interface VehicleGlanceWidgetData {
  // Identity
  vehicleId?: string;
  vehicleName: string;
  regNumber: string;
  fuelType: string;           // 'petrol' | 'diesel' | 'cng' | 'ev' | 'hybrid' etc.

  // Odometer & Mileage
  odometer: number;
  lastFillMileage: string;    // e.g. "16.4 km/L" — most recent calculated mileage
  runningAvgMileage: string;  // e.g. "Avg 15.2 km/L"
  lastFillDate: string;       // e.g. "14 Oct" — date of last fill-up

  // Spend
  monthlySpend: string;       // e.g. "₹4,820 this month"

  // Tyre Pressure
  tyrePressFront: number | null;  // PSI, null if not set
  tyrePressRear: number | null;   // PSI, null if not set

  // Service
  serviceText: string;
  serviceUrgency: 'ok' | 'due_soon' | 'overdue';

  // Documents
  pucText: string;
  pucUrgency: 'ok' | 'due_soon' | 'expired' | 'not_set';
  insuranceText: string;
  insuranceUrgency: 'ok' | 'due_soon' | 'expired' | 'not_set';

  // Overall health dot
  statusColor: `#${string}`;  // '#10B981' | '#F59E0B' | '#EF4444'

  // Number of active vehicles (switch button shown when > 1)
  vehicleCount?: number;
}

export const DEFAULT_WIDGET_DATA: VehicleGlanceWidgetData = {
  vehicleId: '',
  vehicleName: 'DriveLedger',
  regNumber: '—',
  fuelType: 'petrol',
  odometer: 0,
  lastFillMileage: '— km/L',
  runningAvgMileage: 'No fill-ups yet',
  lastFillDate: '—',
  monthlySpend: '₹0 this month',
  tyrePressFront: null,
  tyrePressRear: null,
  serviceText: 'No service data',
  serviceUrgency: 'ok',
  pucText: 'PUC: Not Set',
  pucUrgency: 'not_set',
  insuranceText: 'Ins: Not Set',
  insuranceUrgency: 'not_set',
  statusColor: '#10B981',
};

// ─── Colour Helpers ───────────────────────────────────────────────────────────

const COLORS = {
  bg:           '#0F172A',
  surface:      '#162032',
  surfaceMid:   '#1E293B',
  border:       '#334155',
  text:         '#F8FAFC',
  textSub:      '#94A3B8',
  textDim:      '#64748B',
  blue:         '#3B82F6',
  green:        '#10B981',
  greenBg:      '#064E3B',
  greenBorder:  '#059669',
  greenText:    '#6EE7B7',
  amber:        '#F59E0B',
  amberBg:      '#451A03',
  amberBorder:  '#D97706',
  amberText:    '#FCD34D',
  red:          '#EF4444',
  redBg:        '#450A0A',
  redBorder:    '#DC2626',
  redText:      '#FCA5A5',
  accent:       '#818CF8',  // indigo
} as const;

function urgencyColors(urgency: 'ok' | 'due_soon' | 'overdue' | 'expired' | 'not_set') {
  if (urgency === 'overdue' || urgency === 'expired') {
    return { bg: COLORS.redBg, border: COLORS.redBorder, text: COLORS.redText };
  }
  if (urgency === 'due_soon') {
    return { bg: COLORS.amberBg, border: COLORS.amberBorder, text: COLORS.amberText };
  }
  if (urgency === 'not_set') {
    return { bg: COLORS.surfaceMid, border: COLORS.border, text: COLORS.textDim };
  }
  return { bg: COLORS.greenBg, border: COLORS.greenBorder, text: COLORS.greenText };
}

function fuelIcon(fuelType: string): string {
  switch (fuelType) {
    case 'electric':
      return '⚡';
    case 'hybrid':
      return '🔋';
    case 'hybrid_cng_petrol':
    case 'hybrid_lpg_petrol':
      return '⛽';
    case 'cng':
    case 'lpg':
    case 'petrol':
    case 'diesel':
    default:
      return '⛽';
  }
}

function fuelActionLabel(fuelType: string): string {
  switch (fuelType) {
    case 'electric':
      return '⚡  Charge';
    case 'hybrid':
      return '🔋  Hybrid';
    case 'hybrid_cng_petrol':
    case 'hybrid_lpg_petrol':
      return '⛽  Bi-Fuel';
    case 'cng':
      return 'Log CNG';
    case 'lpg':
      return '⛽  Log LPG';
    case 'diesel':
      return '⛽  Log Diesel';
    default:
      return '⛽  Log Fuel';
  }
}

// ─── Widget Component ─────────────────────────────────────────────────────────

/**
 * VehicleGlanceWidget — 4×2 Android Home Screen Widget
 *
 * Layout (top → bottom):
 *   Row 1 — Header: vehicle name | reg chip | status dot
 *   Row 2 — 3 stat pills: Odometer · Last Mileage · Monthly Spend
 *   Row 3 — Tyre pressure row (hidden if not set) OR service + doc alert pills
 *   Row 4 — Alert pills: Service | PUC | Insurance
 *   Row 5 — Action buttons: + Log Fuel | + Add Service
 */
export function VehicleGlanceWidget(props: VehicleGlanceWidgetData) {
  const d: VehicleGlanceWidgetData = {
    ...DEFAULT_WIDGET_DATA,
    ...props,
  };

  const odoFormatted = Number(d.odometer || 0).toLocaleString('en-IN');
  const svcColors  = urgencyColors(d.serviceUrgency);
  const pucColors  = urgencyColors(d.pucUrgency);
  const insColors  = urgencyColors(d.insuranceUrgency);
  const hasTyres   = d.tyrePressFront !== null || d.tyrePressRear !== null;

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
      clickAction={d.vehicleId ? 'OPEN_URI' : 'OPEN_APP'}
      clickActionData={d.vehicleId ? { uri: `driveledger://?vehicleId=${d.vehicleId}` } : undefined}
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
        {/* Left: fuel icon + vehicle name */}
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 6 }}>
          {d.fuelType === 'cng' ? (
            <SvgWidget
              svg={CNG_TANK_SVG}
              style={{ width: 14, height: 18 }}
            />
          ) : d.fuelType === 'hybrid_cng_petrol' ? (
            <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 3 }}>
              <SvgWidget
                svg={CNG_TANK_SVG}
                style={{ width: 11, height: 15 }}
              />
              <TextWidget
                text="⛽"
                style={{ fontSize: 11 }}
              />
            </FlexWidget>
          ) : (
            <TextWidget
              text={fuelIcon(d.fuelType)}
              style={{ fontSize: 13 }}
            />
          )}
          <TextWidget
            text={d.vehicleName}
            style={{ fontSize: 15, fontWeight: 'bold', color: COLORS.text }}
            truncate="END"
            maxLines={1}
          />
        </FlexWidget>

        {/* Right: reg chip + last fill date + status dot */}
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', flexGap: 6 }}>
          {/* Vehicle switcher */}
          {(d.vehicleCount ?? 1) > 1 && (
            <FlexWidget
              style={{
                backgroundColor: COLORS.accent,
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 6,
              }}
              clickAction="SWITCH_VEHICLE"
            >
              <TextWidget
                text="⇄ Switch"
                style={{ fontSize: 9, fontWeight: 'bold', color: '#FFFFFF' }}
              />
            </FlexWidget>
          )}
          {/* Last fill label */}
          {d.lastFillDate !== '—' && (
            <TextWidget
              text={d.lastFillDate}
              style={{ fontSize: 9, color: COLORS.textDim }}
            />
          )}

          {/* Reg number chip */}
          <FlexWidget
            style={{
              backgroundColor: COLORS.surfaceMid,
              paddingHorizontal: 7,
              paddingVertical: 2,
              borderRadius: 6,
              borderColor: COLORS.border,
              borderWidth: 1,
            }}
          >
            <TextWidget
              text={d.regNumber}
              style={{ fontSize: 9, fontWeight: 'bold', color: '#CBD5E1', letterSpacing: 0.5 }}
              truncate="END"
              maxLines={1}
            />
          </FlexWidget>

          {/* Health dot */}
          <FlexWidget
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: d.statusColor,
            }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* ── Row 2: 3 Stat Pills ── */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          width: 'match_parent',
          flexGap: 6,
          marginTop: 6,
        }}
      >
        {/* Odometer */}
        <FlexWidget
          style={{
            flex: 1,
            backgroundColor: COLORS.surface,
            borderRadius: 10,
            padding: 8,
            alignItems: 'center',
            justifyContent: 'center',
            borderColor: COLORS.border,
            borderWidth: 1,
          }}
        >
          <TextWidget
            text={odoFormatted}
            style={{ fontSize: 16, fontWeight: 'bold', color: COLORS.text }}
            truncate="END"
            maxLines={1}
          />
          <TextWidget
            text="km  odo"
            style={{ fontSize: 8, color: COLORS.textDim, marginTop: 1 }}
          />
        </FlexWidget>

        {/* Last Fill Mileage */}
        <FlexWidget
          style={{
            flex: 1,
            backgroundColor: COLORS.surface,
            borderRadius: 10,
            padding: 8,
            alignItems: 'center',
            justifyContent: 'center',
            borderColor: COLORS.border,
            borderWidth: 1,
          }}
        >
          <TextWidget
            text={d.lastFillMileage}
            style={{ fontSize: 13, fontWeight: 'bold', color: '#60A5FA' }}
            truncate="END"
            maxLines={1}
          />
          <TextWidget
            text={d.runningAvgMileage}
            style={{ fontSize: 8, color: COLORS.textDim, marginTop: 1 }}
            truncate="END"
            maxLines={1}
          />
        </FlexWidget>

        {/* Monthly Spend */}
        <FlexWidget
          style={{
            flex: 1,
            backgroundColor: COLORS.surface,
            borderRadius: 10,
            padding: 8,
            alignItems: 'center',
            justifyContent: 'center',
            borderColor: COLORS.border,
            borderWidth: 1,
          }}
        >
          <TextWidget
            text={d.monthlySpend.split(' ')[0]}
            style={{ fontSize: 13, fontWeight: 'bold', color: '#FBBF24' }}
            truncate="END"
            maxLines={1}
          />
          <TextWidget
            text="this month"
            style={{ fontSize: 8, color: COLORS.textDim, marginTop: 1 }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* ── Row 3: Tyre Pressure OR Alert Row ── */}
      {hasTyres ? (
        <FlexWidget
          style={{
            flexDirection: 'row',
            width: 'match_parent',
            flexGap: 6,
            marginTop: 5,
          }}
        >
          {/* Front tyre */}
          <FlexWidget
            style={{
              flex: 1,
              backgroundColor: COLORS.surfaceMid,
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 5,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderColor: COLORS.border,
              borderWidth: 1,
            }}
          >
            <TextWidget
              text="F Tyre"
              style={{ fontSize: 9, color: COLORS.textSub }}
            />
            <TextWidget
              text={d.tyrePressFront !== null ? `${d.tyrePressFront} PSI` : '— PSI'}
              style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.text }}
            />
          </FlexWidget>

          {/* Rear tyre */}
          <FlexWidget
            style={{
              flex: 1,
              backgroundColor: COLORS.surfaceMid,
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 5,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderColor: COLORS.border,
              borderWidth: 1,
            }}
          >
            <TextWidget
              text="R Tyre"
              style={{ fontSize: 9, color: COLORS.textSub }}
            />
            <TextWidget
              text={d.tyrePressRear !== null ? `${d.tyrePressRear} PSI` : '— PSI'}
              style={{ fontSize: 11, fontWeight: 'bold', color: COLORS.text }}
            />
          </FlexWidget>

          {/* Service pill condensed */}
          <FlexWidget
            style={{
              flex: 1,
              backgroundColor: svcColors.bg,
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 5,
              justifyContent: 'center',
              alignItems: 'center',
              borderColor: svcColors.border,
              borderWidth: 1,
            }}
          >
            <TextWidget
              text={d.serviceText}
              style={{ fontSize: 9, fontWeight: 'bold', color: svcColors.text }}
              truncate="END"
              maxLines={1}
            />
          </FlexWidget>
        </FlexWidget>
      ) : (
        /* No tyre data — show service full width */
        <FlexWidget
          style={{
            width: 'match_parent',
            backgroundColor: svcColors.bg,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 5,
            justifyContent: 'center',
            borderColor: svcColors.border,
            borderWidth: 1,
            marginTop: 5,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: d.vehicleId ? `driveledger://add-service?vehicleId=${d.vehicleId}` : 'driveledger://add-service' }}
        >
          <TextWidget
            text={'🔧 ' + d.serviceText}
            style={{ fontSize: 10, fontWeight: 'bold', color: svcColors.text }}
            truncate="END"
            maxLines={1}
          />
        </FlexWidget>
      )}

      {/* ── Row 4: PUC + Insurance pills ── */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          width: 'match_parent',
          flexGap: 6,
          marginTop: 5,
        }}
      >
        <FlexWidget
          style={{
            flex: 1,
            backgroundColor: pucColors.bg,
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 4,
            justifyContent: 'center',
            borderColor: pucColors.border,
            borderWidth: 1,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: d.vehicleId ? `driveledger://documents?vehicleId=${d.vehicleId}` : 'driveledger://documents' }}
        >
          <TextWidget
            text={d.pucText}
            style={{ fontSize: 9, fontWeight: '600', color: pucColors.text }}
            truncate="END"
            maxLines={1}
          />
        </FlexWidget>

        <FlexWidget
          style={{
            flex: 1,
            backgroundColor: insColors.bg,
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 4,
            justifyContent: 'center',
            borderColor: insColors.border,
            borderWidth: 1,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: d.vehicleId ? `driveledger://documents?vehicleId=${d.vehicleId}` : 'driveledger://documents' }}
        >
          <TextWidget
            text={d.insuranceText}
            style={{ fontSize: 9, fontWeight: '600', color: insColors.text }}
            truncate="END"
            maxLines={1}
          />
        </FlexWidget>
      </FlexWidget>

      {/* ── Row 5: Quick Action Buttons ── */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          width: 'match_parent',
          flexGap: 6,
          marginTop: 6,
        }}
      >
        {/* Vehicle-specific action button: Charge (EV), Log CNG, Hybrid, or Fuel */}
        <FlexWidget
          style={{
            flex: 3,
            backgroundColor:
              d.fuelType === 'electric'
                ? '#0284C7'
                : isCngFuel(d.fuelType)
                ? '#059669'
                : COLORS.blue,
            borderRadius: 10,
            paddingVertical: 7,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            flexGap: 5,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: d.vehicleId ? `driveledger://add-fuel?vehicleId=${d.vehicleId}` : 'driveledger://add-fuel' }}
        >
          {isCngFuel(d.fuelType) && (
            <SvgWidget
              svg={CNG_TANK_SVG}
              style={{ width: 11, height: 14 }}
            />
          )}
          <TextWidget
            text={fuelActionLabel(d.fuelType)}
            style={{ fontSize: 11, fontWeight: 'bold', color: '#FFFFFF' }}
          />
        </FlexWidget>

        {/* + Service */}
        <FlexWidget
          style={{
            flex: 2,
            backgroundColor: COLORS.surfaceMid,
            borderRadius: 10,
            paddingVertical: 7,
            alignItems: 'center',
            justifyContent: 'center',
            borderColor: COLORS.border,
            borderWidth: 1,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: d.vehicleId ? `driveledger://add-service?vehicleId=${d.vehicleId}` : 'driveledger://add-service' }}
        >
          <TextWidget
            text="🔧  Service"
            style={{ fontSize: 11, fontWeight: 'bold', color: '#F8FAFC' }}
          />
        </FlexWidget>

        {/* + Expense */}
        <FlexWidget
          style={{
            flex: 2,
            backgroundColor: COLORS.surfaceMid,
            borderRadius: 10,
            paddingVertical: 7,
            alignItems: 'center',
            justifyContent: 'center',
            borderColor: COLORS.border,
            borderWidth: 1,
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: d.vehicleId ? `driveledger://add-expense?vehicleId=${d.vehicleId}` : 'driveledger://add-expense' }}
        >
          <TextWidget
            text="💰  Expense"
            style={{ fontSize: 11, fontWeight: 'bold', color: '#F8FAFC' }}
          />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
