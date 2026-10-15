"use no memo";
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

export interface VehicleGlanceWidgetData {
  vehicleName: string;
  regNumber: string;
  odometer: number;
  fuelEfficiency: string; // e.g. "16.8 km/L" or "22.4 km/kg"
  serviceText: string;    // e.g. "Due in 420 km" or "Overdue (150 km)"
  serviceUrgency: 'ok' | 'due_soon' | 'overdue';
  pucText: string;        // e.g. "PUC: 18 Days Left" or "PUC: Valid"
  statusColor: string;    // '#10B981' | '#F59E0B' | '#EF4444'
}

export const DEFAULT_WIDGET_DATA: VehicleGlanceWidgetData = {
  vehicleName: 'DriveLedger',
  regNumber: 'Vehicle Tracker',
  odometer: 0,
  fuelEfficiency: 'No fill-ups yet',
  serviceText: 'Service OK',
  serviceUrgency: 'ok',
  pucText: 'PUC: Active',
  statusColor: '#10B981',
};

/**
 * VehicleGlanceWidget (4x2 Android Home Screen Widget)
 *
 * Built with react-native-android-widget for native RemoteViews rendering.
 * Provides glanceable vehicle health, current odometer, efficiency,
 * and 1-tap quick action buttons directly on the Android home screen.
 */
export function VehicleGlanceWidget(props: VehicleGlanceWidgetData) {
  const vehicleName = props.vehicleName || DEFAULT_WIDGET_DATA.vehicleName;
  const regNumber = props.regNumber || DEFAULT_WIDGET_DATA.regNumber;
  const odometer = props.odometer ?? DEFAULT_WIDGET_DATA.odometer;
  const fuelEfficiency = props.fuelEfficiency || DEFAULT_WIDGET_DATA.fuelEfficiency;
  const serviceText = props.serviceText || DEFAULT_WIDGET_DATA.serviceText;
  const serviceUrgency = props.serviceUrgency || DEFAULT_WIDGET_DATA.serviceUrgency;
  const pucText = props.pucText || DEFAULT_WIDGET_DATA.pucText;
  const statusColor = props.statusColor || DEFAULT_WIDGET_DATA.statusColor;

  const serviceBg =
    serviceUrgency === 'overdue'
      ? '#450A0A'
      : serviceUrgency === 'due_soon'
        ? '#451A03'
        : '#064E3B';

  const serviceBorder =
    serviceUrgency === 'overdue'
      ? '#DC2626'
      : serviceUrgency === 'due_soon'
        ? '#D97706'
        : '#059669';

  const serviceTextColor =
    serviceUrgency === 'overdue'
      ? '#FCA5A5'
      : serviceUrgency === 'due_soon'
        ? '#FCD34D'
        : '#6EE7B7';

  const odoFormatted = Number(odometer || 0).toLocaleString('en-IN');

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#0F172A',
        borderRadius: 22,
        padding: 14,
        justifyContent: 'space-between',
        borderColor: '#1E293B',
        borderWidth: 1,
      }}
      clickAction="OPEN_APP"
    >
      {/* ── Top Header Row ── */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: 'match_parent',
        }}
      >
        <TextWidget
          text={vehicleName}
          style={{
            fontSize: 16,
            fontWeight: 'bold',
            color: '#FFFFFF',
          }}
          truncate="END"
          maxLines={1}
        />

        <FlexWidget
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            flexGap: 8,
          }}
        >
          <FlexWidget
            style={{
              backgroundColor: '#1E293B',
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 6,
              borderColor: '#334155',
              borderWidth: 1,
            }}
          >
            <TextWidget
              text={regNumber}
              style={{
                fontSize: 10,
                fontWeight: 'bold',
                color: '#E2E8F0',
                letterSpacing: 0.5,
              }}
              truncate="END"
              maxLines={1}
            />
          </FlexWidget>

          {/* Status Indicator Dot */}
          <FlexWidget
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: statusColor,
            }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* ── Center Glanceable Cards ── */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'stretch',
          width: 'match_parent',
          flexGap: 8,
          marginVertical: 4,
        }}
      >
        {/* Left Card: Odometer & Mileage */}
        <FlexWidget
          style={{
            flex: 1,
            backgroundColor: '#162032',
            borderRadius: 12,
            padding: 8,
            justifyContent: 'center',
          }}
        >
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end', flexGap: 3 }}>
            <TextWidget
              text={odoFormatted}
              style={{
                fontSize: 18,
                fontWeight: 'bold',
                color: '#FFFFFF',
              }}
              truncate="END"
              maxLines={1}
            />
            <TextWidget
              text="km"
              style={{
                fontSize: 10,
                color: '#94A3B8',
                marginBottom: 2,
              }}
            />
          </FlexWidget>

          <TextWidget
            text={fuelEfficiency}
            style={{
              fontSize: 10,
              color: '#60A5FA',
              marginTop: 2,
              fontWeight: '600',
            }}
            truncate="END"
            maxLines={1}
          />
        </FlexWidget>

        {/* Right Column: Service & PUC Alerts */}
        <FlexWidget
          style={{
            flex: 1,
            justifyContent: 'space-between',
            flexGap: 4,
          }}
        >
          {/* Service Due alert pill */}
          <FlexWidget
            style={{
              backgroundColor: serviceBg,
              borderColor: serviceBorder,
              borderWidth: 1,
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 4,
              justifyContent: 'center',
            }}
          >
            <TextWidget
              text={serviceText}
              style={{
                fontSize: 10,
                fontWeight: 'bold',
                color: serviceTextColor,
              }}
              truncate="END"
              maxLines={1}
            />
          </FlexWidget>

          {/* PUC / Compliance pill */}
          <FlexWidget
            style={{
              backgroundColor: '#162032',
              borderColor: '#334155',
              borderWidth: 1,
              borderRadius: 8,
              paddingHorizontal: 8,
              paddingVertical: 4,
              justifyContent: 'center',
            }}
          >
            <TextWidget
              text={pucText}
              style={{
                fontSize: 10,
                fontWeight: '600',
                color: '#CBD5E1',
              }}
              truncate="END"
              maxLines={1}
            />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>

      {/* ── Bottom Action Row ── */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          width: 'match_parent',
          flexGap: 8,
        }}
      >
        {/* + Log Fuel */}
        <FlexWidget
          style={{
            flex: 1,
            backgroundColor: '#2563EB',
            borderRadius: 10,
            paddingVertical: 7,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'driveledger://add-fuel' }}
        >
          <TextWidget
            text="+ Log Fuel"
            style={{
              fontSize: 12,
              fontWeight: 'bold',
              color: '#FFFFFF',
            }}
          />
        </FlexWidget>

        {/* Trip Checklist */}
        <FlexWidget
          style={{
            flex: 1,
            backgroundColor: '#334155',
            borderRadius: 10,
            paddingVertical: 7,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'driveledger://checklist' }}
        >
          <TextWidget
            text="Trip Checklist"
            style={{
              fontSize: 12,
              fontWeight: 'bold',
              color: '#F8FAFC',
            }}
          />
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
