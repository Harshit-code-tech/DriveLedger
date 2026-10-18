/**
 * Sample Data Generator Service
 *
 * Seeds rich, realistic real-life data for testing all app features:
 * - 4 Diverse Vehicles (Petrol Car, 2-Wheeler Scooter, EV SUV, Bi-Fuel CNG Car)
 * - 30+ Realistic Fuel refills & EV charge sessions with mathematically valid odometers
 * - Sequential tank-to-tank mileage recalculations
 * - Real maintenance & service records (routine, major, and overdue)
 * - Real expenses across categories (Tolls, Detailing, Parking, Repairs, Accessories)
 * - Real vehicle documents with varying expiry states (Expired, 4-days left, KYC due, Valid)
 * - Automatic home screen widget state synchronization
 */

import * as vehicleRepo from '@/database/repositories/vehicleRepo';
import * as fuelRepo from '@/database/repositories/fuelRepo';
import * as serviceRepo from '@/database/repositories/serviceRepo';
import * as expenseRepo from '@/database/repositories/expenseRepo';
import * as documentRepo from '@/database/repositories/documentRepo';
import { recalculateAllMileage } from '@/engine/mileageEngine';
import { syncWidgetState } from '@/widgets/widgetDataService';
import { refreshReminders } from '@/services/notificationService';
import { VehicleType, FuelType } from '@/constants/fuelTypes';
import { DocumentType } from '@/constants/documentTypes';

export interface SeedResult {
  vehiclesCount: number;
  fuelEntriesCount: number;
  serviceRecordsCount: number;
  expensesCount: number;
  documentsCount: number;
}

/** Formats an ISO YYYY-MM-DD date offset by N days from today. */
function offsetDateISO(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
}

export function seedRealLifeData(): SeedResult {
  let fuelCount = 0;
  let serviceCount = 0;
  let expenseCount = 0;
  let documentCount = 0;

  // ═══════════════════════════════════════════════════════════════════════
  // 1. Maruti Swift ZXi — Petrol Hatchback
  // ═══════════════════════════════════════════════════════════════════════
  const swift = vehicleRepo.createVehicle({
    nickname: 'White Swift',
    vehicle_type: VehicleType.CAR,
    fuel_type: FuelType.PETROL,
    registration_number: 'MH 02 DL 4321',
    manufacturer: 'Maruti Suzuki',
    model: 'Swift',
    variant: 'ZXi',
    year: 2022,
    color: 'Arctic White',
    tank_capacity: 37,
    front_tyre_pressure: 32,
    rear_tyre_pressure: 30,
    service_interval_km: 10000,
    service_interval_months: 12,
    purchase_date: offsetDateISO(-450),
    current_odometer: 24850,
    notes: 'Daily driver & weekend highway trips.',
  });

  const swiftFills = [
    { offset: -145, odo: 19500, fuel: 32.5, price: 102.50, full: 1, st: 'Indian Oil - Bandra' },
    { offset: -132, odo: 20020, fuel: 31.0, price: 102.50, full: 1, st: 'HP Auto Care - Andheri' },
    { offset: -119, odo: 20550, fuel: 33.2, price: 103.10, full: 1, st: 'Shell - Powai' },
    { offset: -106, odo: 21080, fuel: 32.0, price: 103.10, full: 1, st: 'Indian Oil - Bandra' },
    { offset: -93,  odo: 21590, fuel: 15.0, price: 103.50, full: 0, st: 'BPCL - Highway' }, // Partial fill
    { offset: -81,  odo: 22150, fuel: 34.1, price: 103.50, full: 1, st: 'Indian Oil - Bandra' },
    { offset: -68,  odo: 22690, fuel: 32.4, price: 104.00, full: 1, st: 'HP Auto Care - Andheri' },
    { offset: -54,  odo: 23220, fuel: 31.8, price: 104.00, full: 1, st: 'Shell - Powai' },
    { offset: -41,  odo: 23760, fuel: 32.9, price: 104.20, full: 1, st: 'Indian Oil - Bandra' },
    { offset: -27,  odo: 24300, fuel: 33.0, price: 104.20, full: 1, st: 'BPCL - Highway' },
    { offset: -12,  odo: 24850, fuel: 33.5, price: 104.50, full: 1, st: 'HP Auto Care - Andheri' },
  ];

  for (const f of swiftFills) {
    fuelRepo.createFuelEntry({
      vehicle_id: swift.id,
      date: offsetDateISO(f.offset),
      odometer: f.odo,
      fuel_amount: f.fuel,
      fuel_unit: 'litres',
      price_per_unit: f.price,
      is_full_tank: f.full,
      fuel_station: f.st,
      fuel_system: 'primary',
    });
    fuelCount++;
  }

  // Recalculate Swift mileage chain
  const swiftEntries = fuelRepo.getFuelEntriesByVehicleChronological(swift.id);
  const swiftRecalc = recalculateAllMileage(swiftEntries, FuelType.PETROL);
  for (const item of swiftRecalc) {
    fuelRepo.updateFuelEntryMileage(
      item.entryId,
      item.mileage?.value ?? null,
      item.mileage?.unit ?? null
    );
  }

  // Services
  serviceRepo.createServiceRecord({
    vehicle_id: swift.id,
    date: offsetDateISO(-135),
    odometer: 20000,
    service_type: 'General Service',
    cost: 5400,
    garage_name: 'Maruti Authorized - Shivam Motors',
    work_done: '0W-20 Synthetic oil, oil filter, tyre rotation, throttle body cleaning',
    next_due_km: 30000,
    next_due_date: offsetDateISO(230),
  });
  serviceCount++;

  serviceRepo.createServiceRecord({
    vehicle_id: swift.id,
    date: offsetDateISO(-310),
    odometer: 10000,
    service_type: 'Periodic Maintenance',
    cost: 2800,
    garage_name: 'Maruti Authorized - Shivam Motors',
    work_done: 'First paid periodic service: engine oil, wash, brake inspection',
    next_due_km: 20000,
  });
  serviceCount++;

  // Expenses
  const swiftExpenses = [
    { offset: -10, cat: 'Toll / Fastag', amt: 1000, desc: 'FASTag monthly auto-topup' },
    { offset: -25, cat: 'Washing / Detailing', amt: 650, desc: 'Foam wash and interior vacuuming' },
    { offset: -60, cat: 'Parking', amt: 180, desc: 'Airport Terminal 2 multi-level parking' },
    { offset: -85, cat: 'Repairs / Parts', amt: 850, desc: 'Bosch Clear Advantage wiper blades pair' },
  ];
  for (const exp of swiftExpenses) {
    expenseRepo.createExpense({
      vehicle_id: swift.id,
      date: offsetDateISO(exp.offset),
      category: exp.cat,
      amount: exp.amt,
      description: exp.desc,
    });
    expenseCount++;
  }

  // Documents
  documentRepo.createDocument({
    vehicle_id: swift.id,
    type: DocumentType.RC,
    document_number: 'MH02DL4321/RC/22',
    insurer_name: 'MH RTO Andheri',
    issue_date: offsetDateISO(-450),
    expiry_date: offsetDateISO(5000),
  });
  documentCount++;

  documentRepo.createDocument({
    vehicle_id: swift.id,
    type: DocumentType.INSURANCE,
    document_number: 'HDFC-ERGO-884920',
    insurer_name: 'HDFC ERGO General Insurance',
    issue_date: offsetDateISO(-210),
    expiry_date: offsetDateISO(155), // Valid
  });
  documentCount++;

  documentRepo.createDocument({
    vehicle_id: swift.id,
    type: DocumentType.PUC,
    document_number: 'PUC-MH-9948210',
    insurer_name: 'Bandra Fuel Station PUC Testing',
    issue_date: offsetDateISO(-176),
    expiry_date: offsetDateISO(4), // ⚠️ Expiring in 4 days! Tests urgent alert & warning
  });
  documentCount++;

  documentRepo.createDocument({
    vehicle_id: swift.id,
    type: DocumentType.FASTAG,
    document_number: 'NETC-ICICI-482910',
    insurer_name: 'ICICI Bank FASTag',
    issue_date: offsetDateISO(-350),
    expiry_date: offsetDateISO(730),
  });
  documentCount++;

  // ═══════════════════════════════════════════════════════════════════════
  // 2. Honda Activa 6G — Petrol Two-Wheeler
  // ═══════════════════════════════════════════════════════════════════════
  const activa = vehicleRepo.createVehicle({
    nickname: 'Activa Daily',
    vehicle_type: VehicleType.TWO_WHEELER,
    fuel_type: FuelType.PETROL,
    registration_number: 'DL 01 AB 7890',
    manufacturer: 'Honda',
    model: 'Activa 6G',
    variant: 'Deluxe',
    year: 2021,
    color: 'Matte Axis Grey',
    tank_capacity: 5.3,
    front_tyre_pressure: 22,
    rear_tyre_pressure: 36,
    service_interval_km: 3000,
    service_interval_months: 6,
    purchase_date: offsetDateISO(-600),
    current_odometer: 13850,
    notes: 'Local errands and market runs.',
  });

  const activaFills = [
    { offset: -110, odo: 12100, fuel: 4.5, price: 96.72, full: 1, st: 'Indian Oil - Connaught Place' },
    { offset: -95,  odo: 12390, fuel: 4.2, price: 96.72, full: 1, st: 'BPCL - Ring Road' },
    { offset: -80,  odo: 12690, fuel: 4.3, price: 96.72, full: 1, st: 'Indian Oil - Connaught Place' },
    { offset: -64,  odo: 12980, fuel: 4.1, price: 97.20, full: 1, st: 'HPCL - Karol Bagh' },
    { offset: -48,  odo: 13270, fuel: 4.2, price: 97.20, full: 1, st: 'Indian Oil - Connaught Place' },
    { offset: -32,  odo: 13560, fuel: 4.1, price: 97.20, full: 1, st: 'BPCL - Ring Road' },
    { offset: -16,  odo: 13850, fuel: 4.2, price: 97.20, full: 1, st: 'Indian Oil - Connaught Place' }, // 16 days ago -> tests fuel nudge!
  ];

  for (const f of activaFills) {
    fuelRepo.createFuelEntry({
      vehicle_id: activa.id,
      date: offsetDateISO(f.offset),
      odometer: f.odo,
      fuel_amount: f.fuel,
      fuel_unit: 'litres',
      price_per_unit: f.price,
      is_full_tank: f.full,
      fuel_station: f.st,
      fuel_system: 'primary',
    });
    fuelCount++;
  }

  const activaEntries = fuelRepo.getFuelEntriesByVehicleChronological(activa.id);
  const activaRecalc = recalculateAllMileage(activaEntries, FuelType.PETROL);
  for (const item of activaRecalc) {
    fuelRepo.updateFuelEntryMileage(
      item.entryId,
      item.mileage?.value ?? null,
      item.mileage?.unit ?? null
    );
  }

  // Activa Overdue Service
  serviceRepo.createServiceRecord({
    vehicle_id: activa.id,
    date: offsetDateISO(-140),
    odometer: 9500,
    service_type: 'Oil Change & Tuneup',
    cost: 850,
    garage_name: 'Honda Wing World Service',
    work_done: 'Engine oil 10W-30, air filter clean, brake cable adjustment',
    next_due_km: 12500, // Current is 13850 -> 🚨 Overdue by 1,350 km!
    next_due_date: offsetDateISO(-20), // 🚨 Overdue by 20 days!
  });
  serviceCount++;

  // Activa Expenses
  expenseRepo.createExpense({
    vehicle_id: activa.id,
    date: offsetDateISO(-30),
    category: 'Tyres',
    amount: 120,
    description: 'Rear tyre tubeless puncture repair',
  });
  expenseCount++;

  expenseRepo.createExpense({
    vehicle_id: activa.id,
    date: offsetDateISO(-60),
    category: 'Accessories',
    amount: 350,
    description: 'Stainless steel footrest & seat cover',
  });
  expenseCount++;

  // Activa Documents
  documentRepo.createDocument({
    vehicle_id: activa.id,
    type: DocumentType.INSURANCE,
    document_number: 'NEW-INDIA-772910',
    insurer_name: 'The New India Assurance',
    issue_date: offsetDateISO(-383),
    expiry_date: offsetDateISO(-18), // 🚨 Expired 18 days ago! Tests expired document status
  });
  documentCount++;

  documentRepo.createDocument({
    vehicle_id: activa.id,
    type: DocumentType.PUC,
    document_number: 'DL-PUC-448201',
    insurer_name: 'Connaught Place Testing Station',
    issue_date: offsetDateISO(-90),
    expiry_date: offsetDateISO(90), // Valid
  });
  documentCount++;

  // ═══════════════════════════════════════════════════════════════════════
  // 3. Tata Nexon EV Max — Electric SUV
  // ═══════════════════════════════════════════════════════════════════════
  const nexon = vehicleRepo.createVehicle({
    nickname: 'Nexon EV',
    vehicle_type: VehicleType.CAR,
    fuel_type: FuelType.ELECTRIC,
    registration_number: 'KA 03 EV 2024',
    manufacturer: 'Tata Motors',
    model: 'Nexon EV Max',
    variant: 'XZ+ Lux',
    year: 2023,
    color: 'Intensi-Teal',
    tank_capacity: 40.5, // 40.5 kWh
    front_tyre_pressure: 34,
    rear_tyre_pressure: 34,
    service_interval_km: 15000,
    service_interval_months: 12,
    purchase_date: offsetDateISO(-300),
    current_odometer: 16420,
    notes: 'Silent highway cruiser & tech commuter.',
  });

  const nexonCharges = [
    { offset: -85, odo: 14200, kwh: 32.0, price: 17.50, st: 'Tata Power EZ Charge - Indiranagar', bStart: 20, bEnd: 100 },
    { offset: -70, odo: 14640, kwh: 31.5, price: 17.50, st: 'Jio-bp Pulse - Koramangala', bStart: 22, bEnd: 100 },
    { offset: -54, odo: 15080, kwh: 30.8, price: 18.00, st: 'Tata Power EZ Charge - Whitefield', bStart: 24, bEnd: 100 },
    { offset: -38, odo: 15530, kwh: 31.2, price: 18.00, st: 'Zeon Charging Hub - Hosur Rd', bStart: 20, bEnd: 100 },
    { offset: -21, odo: 15980, kwh: 30.5, price: 18.00, st: 'Tata Power EZ Charge - Indiranagar', bStart: 25, bEnd: 100 },
    { offset: -5,  odo: 16420, kwh: 31.0, price: 18.50, st: 'Jio-bp Pulse - Koramangala', bStart: 21, bEnd: 100 },
  ];

  for (const c of nexonCharges) {
    fuelRepo.createFuelEntry({
      vehicle_id: nexon.id,
      date: offsetDateISO(c.offset),
      odometer: c.odo,
      fuel_amount: c.kwh,
      fuel_unit: 'kWh',
      price_per_unit: c.price,
      is_full_tank: 1, // EV full session
      fuel_station: c.st,
      fuel_system: 'primary',
      battery_start_percent: c.bStart,
      battery_end_percent: c.bEnd,
    });
    fuelCount++;
  }

  const nexonEntries = fuelRepo.getFuelEntriesByVehicleChronological(nexon.id);
  const nexonRecalc = recalculateAllMileage(nexonEntries, FuelType.ELECTRIC);
  for (const item of nexonRecalc) {
    fuelRepo.updateFuelEntryMileage(
      item.entryId,
      item.mileage?.value ?? null,
      item.mileage?.unit ?? null
    );
  }

  // Nexon Service
  serviceRepo.createServiceRecord({
    vehicle_id: nexon.id,
    date: offsetDateISO(-55),
    odometer: 15000,
    service_type: '15,000 km Scheduled Service',
    cost: 2200,
    garage_name: 'Prerana Motors - Tata Authorized',
    work_done: 'HV battery diagnostic, coolant levels, brake fluid top-up, pollen AC filter',
    next_due_km: 30000,
    next_due_date: offsetDateISO(310),
  });
  serviceCount++;

  // Nexon Expenses
  expenseRepo.createExpense({
    vehicle_id: nexon.id,
    date: offsetDateISO(-100),
    category: 'Other',
    amount: 3500,
    description: 'Home 7.2 kW AC Charger wiring and MCB installation',
  });
  expenseCount++;

  expenseRepo.createExpense({
    vehicle_id: nexon.id,
    date: offsetDateISO(-18),
    category: 'Washing / Detailing',
    amount: 800,
    description: 'Eco waterless wash & ceramic coat topup',
  });
  expenseCount++;

  // Nexon Documents
  documentRepo.createDocument({
    vehicle_id: nexon.id,
    type: DocumentType.INSURANCE,
    document_number: 'BAJAJ-ALLIANZ-EV-9921',
    insurer_name: 'Bajaj Allianz EV Protect',
    issue_date: offsetDateISO(-120),
    expiry_date: offsetDateISO(245),
  });
  documentCount++;

  documentRepo.createDocument({
    vehicle_id: nexon.id,
    type: DocumentType.FASTAG,
    document_number: 'NETC-HDFC-99201',
    insurer_name: 'HDFC Bank FASTag',
    issue_date: offsetDateISO(-350),
    expiry_date: offsetDateISO(12), // ⚠️ FASTag KYC expiring in 12 days!
  });
  documentCount++;

  // ═══════════════════════════════════════════════════════════════════════
  // 4. Maruti Ertiga S-CNG — Bi-Fuel (CNG + Petrol)
  // ═══════════════════════════════════════════════════════════════════════
  const ertiga = vehicleRepo.createVehicle({
    nickname: 'Ertiga CNG',
    vehicle_type: VehicleType.CAR,
    fuel_type: FuelType.HYBRID_CNG_PETROL,
    registration_number: 'GJ 01 Z 5544',
    manufacturer: 'Maruti Suzuki',
    model: 'Ertiga',
    variant: 'VXi CNG',
    year: 2022,
    color: 'Magma Grey',
    tank_capacity: 10, // 10 kg CNG
    secondary_tank_capacity: 45, // 45 L Petrol
    front_tyre_pressure: 33,
    rear_tyre_pressure: 36,
    service_interval_km: 10000,
    service_interval_months: 12,
    purchase_date: offsetDateISO(-500),
    current_odometer: 28600,
    notes: 'Family road trips with dual-fuel efficiency.',
  });

  const ertigaFills = [
    { offset: -70, odo: 26100, amt: 8.8, unit: 'kg' as const, sys: 'primary' as const, price: 76.50, st: 'Adani Total Gas - SG Highway' },
    { offset: -58, odo: 26520, amt: 8.9, unit: 'kg' as const, sys: 'primary' as const, price: 76.50, st: 'Gujarat Gas - Satellite' },
    { offset: -45, odo: 26950, amt: 9.1, unit: 'kg' as const, sys: 'primary' as const, price: 76.50, st: 'Adani Total Gas - SG Highway' },
    { offset: -35, odo: 27500, amt: 22.0, unit: 'litres' as const, sys: 'secondary' as const, price: 97.50, st: 'IOCL Petrol - Bopal' }, // Petrol fill
    { offset: -22, odo: 27940, amt: 9.0, unit: 'kg' as const, sys: 'primary' as const, price: 77.00, st: 'Gujarat Gas - Satellite' },
    { offset: -8,  odo: 28600, amt: 8.8, unit: 'kg' as const, sys: 'primary' as const, price: 77.00, st: 'Adani Total Gas - SG Highway' },
  ];

  for (const f of ertigaFills) {
    fuelRepo.createFuelEntry({
      vehicle_id: ertiga.id,
      date: offsetDateISO(f.offset),
      odometer: f.odo,
      fuel_amount: f.amt,
      fuel_unit: f.unit,
      price_per_unit: f.price,
      is_full_tank: 1,
      fuel_station: f.st,
      fuel_system: f.sys,
    });
    fuelCount++;
  }

  const ertigaEntries = fuelRepo.getFuelEntriesByVehicleChronological(ertiga.id);
  const ertigaRecalc = recalculateAllMileage(ertigaEntries, FuelType.HYBRID_CNG_PETROL);
  for (const item of ertigaRecalc) {
    fuelRepo.updateFuelEntryMileage(
      item.entryId,
      item.mileage?.value ?? null,
      item.mileage?.unit ?? null
    );
  }

  // Ertiga Service
  serviceRepo.createServiceRecord({
    vehicle_id: ertiga.id,
    date: offsetDateISO(-90),
    odometer: 25000,
    service_type: 'CNG Filter & Tuneup',
    cost: 3400,
    garage_name: 'Popular Maruti - Ahmedabad',
    work_done: 'CNG low pressure cartridge filter, spark plug replacement, gas leak check',
    next_due_km: 35000,
    next_due_date: offsetDateISO(275),
  });
  serviceCount++;

  // Ertiga Expense
  expenseRepo.createExpense({
    vehicle_id: ertiga.id,
    date: offsetDateISO(-40),
    category: 'Toll / Fastag',
    amount: 450,
    description: 'Ahmedabad-Vadodara NE1 toll',
  });
  expenseCount++;

  // Ertiga Documents
  documentRepo.createDocument({
    vehicle_id: ertiga.id,
    type: DocumentType.PUC,
    document_number: 'GJ-PUC-882910',
    insurer_name: 'SG Highway PUC Center',
    issue_date: offsetDateISO(-60),
    expiry_date: offsetDateISO(120),
  });
  documentCount++;

  documentRepo.createDocument({
    vehicle_id: ertiga.id,
    type: DocumentType.INSURANCE,
    document_number: 'ICICI-LOMBARD-44910',
    insurer_name: 'ICICI Lombard General Insurance',
    issue_date: offsetDateISO(-320),
    expiry_date: offsetDateISO(45),
  });
  documentCount++;

  // ═══════════════════════════════════════════════════════════════════════
  // Sync Widget and Refresh Notifications
  // ═══════════════════════════════════════════════════════════════════════
  try {
    void syncWidgetState();
    refreshReminders();
  } catch (err) {
    console.debug('[DriveLedger] Post-seed sync skipped:', err);
  }

  return {
    vehiclesCount: 4,
    fuelEntriesCount: fuelCount,
    serviceRecordsCount: serviceCount,
    expensesCount: expenseCount,
    documentsCount: documentCount,
  };
}
