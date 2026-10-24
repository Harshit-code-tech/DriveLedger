import { widgetTaskHandler } from '../widgetTaskHandler';
import { GPS_WIDGET_NAME, WIDGET_NAME } from '../widgetDataService';
import * as tripCoordinator from '@/services/tripCoordinatorService';
import { resetMockDatabase } from '@/__mocks__/expo-sqlite';
import { getDatabase } from '@/database/connection';
import { createTables } from '@/database/schema';
import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import { FuelType, VehicleType } from '@/constants/fuelTypes';

let asyncStore: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getAllKeys: jest.fn(async () => Object.keys(asyncStore)),
  getItem: jest.fn(async (key: string) => asyncStore[key] ?? null),
  setItem: jest.fn(async (key: string, val: string) => {
    asyncStore[key] = val;
  }),
  removeItem: jest.fn(async (key: string) => {
    delete asyncStore[key];
  }),
  clear: jest.fn(async () => {
    asyncStore = {};
  }),
}));

jest.mock('@/services/tripCoordinatorService', () => ({
  startGpsTripCoordinator: jest.fn().mockResolvedValue({ success: true }),
  pauseGpsTripCoordinator: jest.fn().mockResolvedValue({ success: true }),
  resumeGpsTripCoordinator: jest.fn().mockResolvedValue({ success: true }),
  finishGpsTripCoordinator: jest.fn().mockResolvedValue({ success: true }),
  cycleNextVehicleCoordinator: jest.fn().mockResolvedValue({ success: true }),
  getNextVehicleId: jest.fn(),
  isDuplicateInteraction: jest.fn().mockReturnValue(false),
}));

describe('WidgetTaskHandler GPS Widget Actions', () => {
  const renderWidget = jest.fn();

  beforeEach(() => {
    resetMockDatabase();
    const db = getDatabase();
    createTables(db);
    jest.clearAllMocks();

    vehicleRepo.createVehicle({
      nickname: 'Test Verna',
      vehicle_type: VehicleType.CAR,
      fuel_type: FuelType.PETROL,
      registration_number: 'DL01AA0001',
      current_odometer: 10000,
    });
  });

  it('delegates START_GPS_TRIP to tripCoordinatorService and re-renders widget', async () => {
    await widgetTaskHandler({
      widgetAction: 'WIDGET_CLICK',
      clickAction: 'START_GPS_TRIP',
      widgetInfo: { widgetName: GPS_WIDGET_NAME, widgetId: 101, width: 320, height: 140 },
      renderWidget,
    });

    expect(tripCoordinator.startGpsTripCoordinator).toHaveBeenCalled();
    expect(renderWidget).toHaveBeenCalled();
  });

  it('delegates PAUSE_GPS_TRIP to tripCoordinatorService', async () => {
    await widgetTaskHandler({
      widgetAction: 'WIDGET_CLICK',
      clickAction: 'PAUSE_GPS_TRIP',
      widgetInfo: { widgetName: GPS_WIDGET_NAME, widgetId: 101, width: 320, height: 140 },
      renderWidget,
    });

    expect(tripCoordinator.pauseGpsTripCoordinator).toHaveBeenCalled();
    expect(renderWidget).toHaveBeenCalled();
  });

  it('delegates RESUME_GPS_TRIP to tripCoordinatorService', async () => {
    await widgetTaskHandler({
      widgetAction: 'WIDGET_CLICK',
      clickAction: 'RESUME_GPS_TRIP',
      widgetInfo: { widgetName: GPS_WIDGET_NAME, widgetId: 101, width: 320, height: 140 },
      renderWidget,
    });

    expect(tripCoordinator.resumeGpsTripCoordinator).toHaveBeenCalled();
    expect(renderWidget).toHaveBeenCalled();
  });

  it('delegates FINISH_GPS_TRIP to tripCoordinatorService', async () => {
    await widgetTaskHandler({
      widgetAction: 'WIDGET_CLICK',
      clickAction: 'FINISH_GPS_TRIP',
      widgetInfo: { widgetName: GPS_WIDGET_NAME, widgetId: 101, width: 320, height: 140 },
      renderWidget,
    });

    expect(tripCoordinator.finishGpsTripCoordinator).toHaveBeenCalled();
    expect(renderWidget).toHaveBeenCalled();
  });

  it('delegates SWITCH_VEHICLE to cycleNextVehicleCoordinator', async () => {
    await widgetTaskHandler({
      widgetAction: 'WIDGET_CLICK',
      clickAction: 'SWITCH_VEHICLE',
      widgetInfo: { widgetName: GPS_WIDGET_NAME, widgetId: 101, width: 320, height: 140 },
      renderWidget,
    });

    expect(tripCoordinator.cycleNextVehicleCoordinator).toHaveBeenCalled();
    expect(renderWidget).toHaveBeenCalled();
  });

  it('renders widget on WIDGET_UPDATE and WIDGET_ADDED', async () => {
    await widgetTaskHandler({
      widgetAction: 'WIDGET_UPDATE',
      widgetInfo: { widgetName: GPS_WIDGET_NAME, widgetId: 101, width: 320, height: 140 },
      renderWidget,
    });

    expect(renderWidget).toHaveBeenCalled();
  });
});
