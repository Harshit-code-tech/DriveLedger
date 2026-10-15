"use no memo";
import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { DEFAULT_WIDGET_DATA, VehicleGlanceWidget } from './VehicleGlanceWidget';
import { getCachedWidgetData, getWidgetDataSnapshot, WIDGET_NAME } from './widgetDataService';

/**
 * Android Background Headless Widget Task Handler
 *
 * Invoked by Android OS when:
 * - User adds widget to home screen (WIDGET_ADDED)
 * - Scheduled widget update triggers (WIDGET_UPDATE)
 * - User resizes the widget (WIDGET_RESIZED)
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetAction, widgetInfo, renderWidget } = props;

  if (widgetInfo?.widgetName !== WIDGET_NAME) {
    return;
  }

  switch (widgetAction) {
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

    case 'WIDGET_CLICK':
      // Click actions with OPEN_APP and OPEN_URI are handled natively by Android
      break;

    case 'WIDGET_DELETED':
      // Widget was removed from home screen
      break;
  }
}
