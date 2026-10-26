"use no memo";
/**
 * Widget Shared Sub-Components
 *
 * Reusable widget primitive components shared between the Full (4×2) and
 * Compact (4×1) GpsCockpitWidget variants.
 *
 * Extracted from GpsCockpitWidget.tsx.
 */

import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import { CAR_SVG, BIKE_SVG, SPEEDO_SVG, ROAD_SVG, CLOCK_SVG, PAUSE_CLOCK_SVG } from './svgs';
import { C } from './palette';
import { fuelBadge, speedLabel } from './helpers';
import type { GpsCockpitWidgetData } from './types';

/** Vehicle identity block: car SVG + name + reg badge + fuel badge */
export function VehicleIdentity({ d, size }: { d: GpsCockpitWidgetData; size: 'normal' | 'compact' }) {
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
export function TelematicsBar({
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
