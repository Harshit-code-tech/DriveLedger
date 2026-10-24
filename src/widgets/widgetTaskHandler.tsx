"use no memo";
import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { DEFAULT_WIDGET_DATA, VehicleGlanceWidget } from './VehicleGlanceWidget';
import { DEFAULT_GPS_WIDGET_DATA, GpsCockpitWidget, GpsCockpitCompactWidget } from './GpsCockpitWidget';
import {
  cycleWidgetVehicle,
  getCachedWidgetData,
  getWidgetDataSnapshot,
  WIDGET_NAME,
  GPS_WIDGET_NAME,
  GPS_COMPACT_WIDGET_NAME,
  getCachedGpsWidgetData,
  getGpsWidgetDataSnapshot,
} from './widgetDataService';
import {
  startGpsTripCoordinator,
  pauseGpsTripCoordinator,
  resumeGpsTripCoordinator,
  finishGpsTripCoordinator,
  cycleNextVehicleCoordinator,
} from '@/services/tripCoordinatorService';

/**
 * Android Background Headless Widget Task Handler
 *
 * Invoked by Android OS when:
 * - User adds widget to home screen (WIDGET_ADDED)
 * - Scheduled widget update triggers (WIDGET_UPDATE)
 * - User resizes the widget (WIDGET_RESIZED)
 * - User clicks an interactive element (WIDGET_CLICK)
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetAction, widgetInfo, renderWidget, clickAction } = props;

  // ── Handler for GpsCockpitWidget (4×2 Hero) ──
  if (widgetInfo?.widgetName === GPS_WIDGET_NAME) {
    await handleGpsCockpitWidgetAction(props);
    return;
  }

  // ── Handler for GpsCockpitCompactWidget (4×1 Strip) ──
  if (widgetInfo?.widgetName === GPS_COMPACT_WIDGET_NAME) {
    await handleGpsCockpitCompactWidgetAction(props);
    return;
  }

  // ── Handler for VehicleGlanceWidget ──
  if (widgetInfo?.widgetName !== WIDGET_NAME) {
    return;
  }

  switch (widgetAction) {
    case 'WIDGET_CLICK':
      if (clickAction === 'SWITCH_VEHICLE') {
        await cycleWidgetVehicle();
        try {
          const data = await getWidgetDataSnapshot();
          renderWidget(<VehicleGlanceWidget {...(data ?? DEFAULT_WIDGET_DATA)} />);
        } catch (err) {
          console.warn('[DriveLedger] Error re-rendering after switch:', err);
        }
      }
      break;

    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      try {
        // Try fresh SQLite snapshot first, fallback to cached snapshot from storage
        let data = await getWidgetDataSnapshot();
        if (!data || data.odometer === 0) {
          const cached = await getCachedWidgetData();
          if (cached && cached.odometer > 0) {
            data = cached;
          }
        }
        renderWidget(<VehicleGlanceWidget {...(data ?? DEFAULT_WIDGET_DATA)} />);
      } catch (err) {
        console.warn('[DriveLedger] Error rendering widget in task handler:', err);
        try {
          const cached = await getCachedWidgetData();
          renderWidget(<VehicleGlanceWidget {...(cached ?? DEFAULT_WIDGET_DATA)} />);
        } catch {
          renderWidget(<VehicleGlanceWidget {...DEFAULT_WIDGET_DATA} />);
        }
      }
      break;
    }

    case 'WIDGET_DELETED':
      // Widget was removed from home screen
      break;
  }
}

/**
 * Specialized handler for the GpsCockpitWidget.
 * Handles instant GPS trip start, pause, resume, finish, and garage cycling.
 */
async function handleGpsCockpitWidgetAction(props: WidgetTaskHandlerProps) {
  const { widgetAction, renderWidget, clickAction } = props;

  switch (widgetAction) {
    case 'WIDGET_CLICK':
      try {
        if (clickAction === 'START_GPS_TRIP') {
          await startGpsTripCoordinator();
        } else if (clickAction === 'PAUSE_GPS_TRIP') {
          await pauseGpsTripCoordinator();
        } else if (clickAction === 'RESUME_GPS_TRIP') {
          await resumeGpsTripCoordinator();
        } else if (clickAction === 'FINISH_GPS_TRIP') {
          await finishGpsTripCoordinator();
        } else if (clickAction === 'SWITCH_VEHICLE') {
          await cycleNextVehicleCoordinator();
        }

        const data = await getGpsWidgetDataSnapshot();
        renderWidget(<GpsCockpitWidget {...(data ?? DEFAULT_GPS_WIDGET_DATA)} />);
      } catch (err) {
        console.warn('[DriveLedger] Error handling GPS widget click:', err);
      }
      break;

    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      try {
        let data = await getGpsWidgetDataSnapshot();
        if (!data) {
          data = await getCachedGpsWidgetData();
        }
        renderWidget(<GpsCockpitWidget {...(data ?? DEFAULT_GPS_WIDGET_DATA)} />);
      } catch (err) {
        console.warn('[DriveLedger] Error rendering GPS widget:', err);
        try {
          const cached = await getCachedGpsWidgetData();
          renderWidget(<GpsCockpitWidget {...(cached ?? DEFAULT_GPS_WIDGET_DATA)} />);
        } catch {
          renderWidget(<GpsCockpitWidget {...DEFAULT_GPS_WIDGET_DATA} />);
        }
      }
      break;
    }

    case 'WIDGET_DELETED':
      break;
  }
}

/**
 * Specialized handler for the GpsCockpitCompactWidget (4×1 strip).
 * Shares the same GPS coordinator logic as the hero widget.
 */
async function handleGpsCockpitCompactWidgetAction(props: WidgetTaskHandlerProps) {
  const { widgetAction, renderWidget, clickAction } = props;

  switch (widgetAction) {
    case 'WIDGET_CLICK':
      try {
        if (clickAction === 'START_GPS_TRIP') {
          await startGpsTripCoordinator();
        } else if (clickAction === 'PAUSE_GPS_TRIP') {
          await pauseGpsTripCoordinator();
        } else if (clickAction === 'RESUME_GPS_TRIP') {
          await resumeGpsTripCoordinator();
        } else if (clickAction === 'FINISH_GPS_TRIP') {
          await finishGpsTripCoordinator();
        } else if (clickAction === 'SWITCH_VEHICLE') {
          await cycleNextVehicleCoordinator();
        }

        const data = await getGpsWidgetDataSnapshot();
        renderWidget(<GpsCockpitCompactWidget {...(data ?? DEFAULT_GPS_WIDGET_DATA)} />);
      } catch (err) {
        console.warn('[DriveLedger] Error handling GPS compact widget click:', err);
      }
      break;

    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      try {
        let data = await getGpsWidgetDataSnapshot();
        if (!data) {
          data = await getCachedGpsWidgetData();
        }
        renderWidget(<GpsCockpitCompactWidget {...(data ?? DEFAULT_GPS_WIDGET_DATA)} />);
      } catch (err) {
        console.warn('[DriveLedger] Error rendering GPS compact widget:', err);
        try {
          const cached = await getCachedGpsWidgetData();
          renderWidget(<GpsCockpitCompactWidget {...(cached ?? DEFAULT_GPS_WIDGET_DATA)} />);
        } catch {
          renderWidget(<GpsCockpitCompactWidget {...DEFAULT_GPS_WIDGET_DATA} />);
        }
      }
      break;
    }

    case 'WIDGET_DELETED':
      break;
  }
}
