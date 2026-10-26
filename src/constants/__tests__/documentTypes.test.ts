import {
  DocumentType,
  getDocumentTypesForVehicle,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_ICONS,
} from '../documentTypes';
import { FuelType } from '../fuelTypes';

describe('documentTypes — getDocumentTypesForVehicle', () => {
  test('Electric vehicles exclude PUC and include Battery Warranty', () => {
    const types = getDocumentTypesForVehicle(FuelType.ELECTRIC);
    expect(types).not.toContain(DocumentType.PUC);
    expect(types).not.toContain(DocumentType.CNG_CERTIFICATE);
    expect(types).toContain(DocumentType.BATTERY_WARRANTY);
    expect(types).toContain(DocumentType.RC);
    expect(types).toContain(DocumentType.INSURANCE);
    expect(types).toContain(DocumentType.FASTAG);
  });

  test('CNG and Bi-Fuel vehicles include CNG Cylinder Hydro-Test Certificate and PUC', () => {
    const cngTypes = getDocumentTypesForVehicle(FuelType.CNG);
    expect(cngTypes).toContain(DocumentType.CNG_CERTIFICATE);
    expect(cngTypes).toContain(DocumentType.PUC);
    expect(cngTypes).toContain(DocumentType.RC);

    const biFuelTypes = getDocumentTypesForVehicle(FuelType.HYBRID_CNG_PETROL);
    expect(biFuelTypes).toContain(DocumentType.CNG_CERTIFICATE);
    expect(biFuelTypes).toContain(DocumentType.PUC);
  });

  test('Hybrid vehicles include Battery Warranty and PUC', () => {
    const hybridTypes = getDocumentTypesForVehicle(FuelType.HYBRID);
    expect(hybridTypes).toContain(DocumentType.BATTERY_WARRANTY);
    expect(hybridTypes).toContain(DocumentType.PUC);
    expect(hybridTypes).not.toContain(DocumentType.CNG_CERTIFICATE);
  });

  test('Petrol and Diesel vehicles include standard document set', () => {
    const petrolTypes = getDocumentTypesForVehicle(FuelType.PETROL);
    expect(petrolTypes).toContain(DocumentType.PUC);
    expect(petrolTypes).toContain(DocumentType.RC);
    expect(petrolTypes).toContain(DocumentType.INSURANCE);
    expect(petrolTypes).toContain(DocumentType.FASTAG);
    expect(petrolTypes).not.toContain(DocumentType.CNG_CERTIFICATE);
    expect(petrolTypes).not.toContain(DocumentType.BATTERY_WARRANTY);

    const dieselTypes = getDocumentTypesForVehicle(FuelType.DIESEL);
    expect(dieselTypes).toContain(DocumentType.PUC);
    expect(dieselTypes).not.toContain(DocumentType.CNG_CERTIFICATE);
  });

  test('All document types have labels and icons defined', () => {
    for (const dt of Object.values(DocumentType)) {
      expect(DOCUMENT_TYPE_LABELS[dt]).toBeDefined();
      expect(DOCUMENT_TYPE_LABELS[dt].length).toBeGreaterThan(0);
      expect(DOCUMENT_TYPE_ICONS[dt]).toBeDefined();
    }
  });
});
