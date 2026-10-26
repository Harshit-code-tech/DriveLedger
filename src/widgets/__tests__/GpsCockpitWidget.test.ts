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
    // In recording state, the widget has cyan border styling (C.cyanBorder = #0E7490)
    expect(tree.props.style.borderColor).toBe('#0E7490');
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

  it('renders two-wheeler bike SVG when vehicle_type is two_wheeler', () => {
    const bikeData: GpsCockpitWidgetData = {
      ...DEFAULT_GPS_WIDGET_DATA,
      recordingState: 'idle',
      vehicleName: 'Activa 6G',
      regNumber: 'MH 12 AB 1234',
      vehicleType: 'two_wheeler',
      fuelType: 'petrol',
    };

    const tree = GpsCockpitWidget(bikeData);
    expect(tree).toBeDefined();
  });

  it('renders GpsCockpitCompactWidget in idle state as FlexWidget with vehicle info', () => {
    const { GpsCockpitCompactWidget } = require('../GpsCockpitWidget');
    const compactIdleData: GpsCockpitWidgetData = {
      ...DEFAULT_GPS_WIDGET_DATA,
      recordingState: 'idle',
      vehicleName: 'Jupiter 125',
      regNumber: 'KA 03 XY 7890',
      vehicleType: 'two_wheeler',
      vehicleCount: 2,
    };

    const tree = GpsCockpitCompactWidget(compactIdleData);
    expect(tree).toBeDefined();
    expect(tree.props.clickAction).toBe('OPEN_APP');
  });

  it('renders GpsCockpitCompactWidget in recording state with vehicle identity and metrics', () => {
    const { GpsCockpitCompactWidget } = require('../GpsCockpitWidget');
    const compactRecData: GpsCockpitWidgetData = {
      ...DEFAULT_GPS_WIDGET_DATA,
      recordingState: 'recording',
      vehicleName: 'Pulsar NS200',
      regNumber: 'DL 08 CC 5555',
      speedKmh: 45,
      distanceKm: 8.2,
      formattedElapsed: '12:40',
      tripStartTime: '18:15',
    };

    const tree = GpsCockpitCompactWidget(compactRecData);
    expect(tree).toBeDefined();
    // In recording state, the compact widget has cyan border styling (C.cyanBorder = #0E7490)
    expect(tree.props.style.borderColor).toBe('#0E7490');
  });

  it('renders GpsCockpitCompactWidget in paused state with frozen metrics and amber border', () => {
    const { GpsCockpitCompactWidget } = require('../GpsCockpitWidget');
    const compactPauseData: GpsCockpitWidgetData = {
      ...DEFAULT_GPS_WIDGET_DATA,
      recordingState: 'paused',
      vehicleName: 'Pulsar NS200',
      regNumber: 'DL 08 CC 5555',
      speedKmh: 0,
      distanceKm: 8.2,
      formattedElapsed: '12:40',
    };

    const tree = GpsCockpitCompactWidget(compactPauseData);
    expect(tree).toBeDefined();
    expect(tree.props.style.borderColor).toBe('#D97706');
  });

  it('wires hero START button with OPEN_URI deep link to avoid Android 12+ FGS restrictions', () => {
    const idleData: GpsCockpitWidgetData = {
      ...DEFAULT_GPS_WIDGET_DATA,
      recordingState: 'idle',
      vehicleId: 'veh-123',
    };

    const tree = GpsCockpitWidget(idleData);
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('driveledger://?action=start_gps&vehicleId=veh-123');
  });

  it('wires compact START button with OPEN_URI deep link', () => {
    const { GpsCockpitCompactWidget } = require('../GpsCockpitWidget');
    const compactIdleData: GpsCockpitWidgetData = {
      ...DEFAULT_GPS_WIDGET_DATA,
      recordingState: 'idle',
      vehicleId: 'veh-456',
    };

    const tree = GpsCockpitCompactWidget(compactIdleData);
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('driveledger://?action=start_gps&vehicleId=veh-456');
  });

  it('wires RESUME button with OPEN_URI deep link', () => {
    const pausedData: GpsCockpitWidgetData = {
      ...DEFAULT_GPS_WIDGET_DATA,
      recordingState: 'paused',
      vehicleId: 'veh-789',
    };

    const tree = GpsCockpitWidget(pausedData);
    const jsonStr = JSON.stringify(tree);
    expect(jsonStr).toContain('driveledger://?action=resume_gps&vehicleId=veh-789');
  });
});
