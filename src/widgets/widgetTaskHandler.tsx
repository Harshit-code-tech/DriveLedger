"use no memo";
import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { DEFAULT_WIDGET_DATA, VehicleGlanceWidget } from './VehicleGlanceWidget';
import { DEFAULT_GPS_WIDGET_DATA, GpsTripWidget } from './GpsTripWidget';
import {
  cycleWidgetVehicle,
  getCachedWidgetData,
  getWidgetDataSnapshot,
  WIDGET_NAME,
  GPS_WIDGET_NAME,
  getGpsWidgetDataSnapshot,
  getCachedGpsWidgetData,
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
  const { widgetAction, widgetInfo, renderWidget, clickAction, clickActionData } = props;

  // ── Handler for Dedicated GpsTripWidget ──
  if (widgetInfo?.widgetName === GPS_WIDGET_NAME) {
    switch (widgetAction) {
      case 'WIDGET_CLICK': {
        const interactionId = typeof clickActionData?.interactionId === 'string'
          ? clickActionData.interactionId
          : undefined;

        try {
          if (clickAction === 'START_TRIP') {
            const vehicleId = typeof clickActionData?.vehicleId === 'string'
              ? clickActionData.vehicleId
              : undefined;
            await startGpsTripCoordinator(vehicleId, interactionId);
          } else if (clickAction === 'PAUSE_TRIP') {
            const tripId = typeof clickActionData?.tripId === 'string'
              ? clickActionData.tripId
              : undefined;
            await pauseGpsTripCoordinator(tripId, interactionId);
          } else if (clickAction === 'RESUME_TRIP') {
            const tripId = typeof clickActionData?.tripId === 'string'
              ? clickActionData.tripId
              : undefined;
            await resumeGpsTripCoordinator(tripId, interactionId);
          } else if (clickAction === 'FINISH_TRIP') {
            const tripId = typeof clickActionData?.tripId === 'string'
              ? clickActionData.tripId
              : undefined;
            await finishGpsTripCoordinator(tripId, undefined, interactionId);
          } else if (clickAction === 'SWITCH_NEXT_VEHICLE' || clickAction === 'SWITCH_VEHICLE') {
            await cycleNextVehicleCoordinator(interactionId);
          }
        } catch (err) {
          console.warn('[DriveLedger] Error executing widget action:', clickAction, err);
        }

        // Render the resulting snapshot immediately following action execution
        try {
          const data = await getGpsWidgetDataSnapshot();
          renderWidget(<GpsTripWidget {...(data ?? DEFAULT_GPS_WIDGET_DATA)} />);
        } catch (renderErr) {
          console.warn('[DriveLedger] Error re-rendering GPS widget after action:', renderErr);
        }
        break;
      }

      case 'WIDGET_ADDED':
      case 'WIDGET_UPDATE':
      case 'WIDGET_RESIZED': {
        try {
          let data = await getGpsWidgetDataSnapshot();
          if (!data) {
            const cached = await getCachedGpsWidgetData();
            if (cached) data = cached;
          }
          renderWidget(<GpsTripWidget {...(data ?? DEFAULT_GPS_WIDGET_DATA)} />);
        } catch (err) {
          console.warn('[DriveLedger] Error rendering GPS widget in task handler:', err);
          try {
            const cached = await getCachedGpsWidgetData();
            renderWidget(<GpsTripWidget {...(cached ?? DEFAULT_GPS_WIDGET_DATA)} />);
          } catch {
            renderWidget(<GpsTripWidget {...DEFAULT_GPS_WIDGET_DATA} />);
          }
        }
        break;
      }

      case 'WIDGET_DELETED':
        break;
    }
    return;
  }

  // ── Handler for VehicleGlanceWidget (Existing Glance Widget) ──
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
