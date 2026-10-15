import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { VehicleGlanceWidget } from './VehicleGlanceWidget';
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
  const { widgetAction, widgetName, renderWidget } = props;

  if (widgetName !== WIDGET_NAME) {
    return;
  }

  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      // Try fresh data snapshot first, fallback to cached storage snapshot
      let data = await getWidgetDataSnapshot();
      if (!data || data.odometer === 0) {
        data = await getCachedWidgetData();
      }
      renderWidget(VehicleGlanceWidget(data));
      break;
    }

    case 'WIDGET_CLICK':
      // Click actions with OPEN_APP and OPEN_URI are handled by native intents
      break;

    case 'WIDGET_DELETED':
      // Widget was removed from home screen
      break;
  }
}
