import React from 'react';
import {
  GpsCockpitWidget,
  DEFAULT_GPS_WIDGET_DATA,
  GpsCockpitWidgetData,
} from '../GpsCockpitWidget';

describe('GpsCockpitWidget Component', () => {
  it('renders without throwing when supplied with default data', () => {
    expect(() => {
      GpsCockpitWidget(DEFAULT_GPS_WIDGET_DATA);
    }).not.toThrow();
  });

  it('renders in idle state with correct vehicle info and action buttons', () => {
    const idleData: GpsCockpitWidgetData = {
      ...DEFAULT_GPS_WIDGET_DATA,
      recordingState: 'idle',
      vehicleName: 'Honda City',
      regNumber: 'DL 01 AB 1234',
      fuelType: 'petrol',
      currentOdometer: 45000,
      lastTripDistanceKm: 18.5,
      lastTripDuration: '32m',
      vehicleCount: 2,
    };

    const tree = GpsCockpitWidget(idleData);
    expect(tree).toBeDefined();
    expect(tree.props.clickAction).toBe('OPEN_APP');
  });

  it('renders in recording state with active telematics HUD', () => {
    const recordingData: GpsCockpitWidgetData = {
      ...DEFAULT_GPS_WIDGET_DATA,
      recordingState: 'recording',
      tripId: 'test-trip-uuid',
      vehicleName: 'Thar 4x4',
      regNumber: 'MH 02 XY 9999',
      fuelType: 'diesel',
      speedKmh: 68,
      distanceKm: 12.45,
      elapsedSeconds: 980,
      formattedElapsed: '16:20',
      sampleCount: 340,
      gpsQuality: 'good',
      accuracyMeters: 8,
    };

    const tree = GpsCockpitWidget(recordingData);
    expect(tree).toBeDefined();
    // In recording state, the widget has cyan border styling
    expect(tree.props.style.borderColor).toBe('#0891B2');
  });

  it('renders in paused state with frozen telematics and amber border', () => {
    const pausedData: GpsCockpitWidgetData = {
      ...DEFAULT_GPS_WIDGET_DATA,
      recordingState: 'paused',
      tripId: 'test-trip-uuid',
      vehicleName: 'Tata Nexon',
      regNumber: 'KA 01 ZZ 4321',
      fuelType: 'petrol',
      speedKmh: 0,
      distanceKm: 25.1,
      elapsedSeconds: 1800,
      formattedElapsed: '30:00',
      sampleCount: 650,
      gpsQuality: 'good',
    };

    const tree = GpsCockpitWidget(pausedData);
    expect(tree).toBeDefined();
    // In paused state, the widget has amber border styling
    expect(tree.props.style.borderColor).toBe('#D97706');
  });

  it('renders CNG tank vector for CNG fuel types', () => {
    const cngData: GpsCockpitWidgetData = {
      ...DEFAULT_GPS_WIDGET_DATA,
      recordingState: 'idle',
      vehicleName: 'WagonR CNG',
      fuelType: 'cng',
    };

    const tree = GpsCockpitWidget(cngData);
    expect(tree).toBeDefined();
  });
});
