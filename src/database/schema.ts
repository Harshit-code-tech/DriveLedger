/**
 * Database Schema — Table Definitions
 *
 * Contains all CREATE TABLE statements for DriveLedger's SQLite database.
 * Matches the charter's database design exactly.
 *
 * KEY DESIGN DECISIONS:
 * 1. All primary keys are UUID TEXT, not auto-increment INTEGER.
 *    → Prevents ID collisions when cloud sync arrives in v2.0.
 *
 * 2. All tables have `deleted_at` for soft delete.
 *    → Accidental deletions are recoverable.
 *    → Needed for proper sync conflict resolution in v2.0.
 *
 * 3. All timestamps are ISO 8601 TEXT strings.
 *    → SQLite has no native DATE type.
 *    → ISO 8601 strings sort correctly in alphabetical order.
 *    → Maps cleanly to PostgreSQL timestamps for v2.0 Supabase sync.
 *
 * 4. `vehicles.is_archived` is separate from `deleted_at`.
 *    → Archiving hides a vehicle without orphaning its history.
 *    → `deleted_at` on vehicles is reserved for v2.0 sync tombstoning.
 *
 * 5. `fuel_entries.total_cost` is stored (denormalized) for query speed.
 *    → Must be updated if fuel_amount or price_per_unit is edited.
 *
 * 6. `vehicles.current_odometer` is denormalized for performance.
 *    → Updated atomically with each fuel entry save.
 *
 * NOTE: Tyre pressure fields are included in the schema (as specified
 * in the charter) but are deferred to v1.5 — no UI or logic in v1.0.
 */

import type * as SQLite from 'expo-sqlite';

// ─── Table Creation ──────────────────────────────────────────────────

const CREATE_VEHICLES_TABLE = `
  CREATE TABLE IF NOT EXISTS vehicles (
    id                   TEXT PRIMARY KEY NOT NULL,
    nickname             TEXT NOT NULL,
    vehicle_type         TEXT NOT NULL CHECK (vehicle_type IN ('car', 'two_wheeler', 'three_wheeler', 'other')),
    manufacturer         TEXT,
    model                TEXT,
    variant              TEXT,
    year                 INTEGER,
    color                TEXT,
    registration_number  TEXT NOT NULL,
    fuel_type            TEXT NOT NULL CHECK (fuel_type IN (
                           'petrol', 'diesel', 'cng', 'lpg', 'electric', 'hybrid',
                           'hybrid_cng_petrol', 'hybrid_cng_diesel',
                           'hybrid_lpg_petrol', 'hybrid_lpg_diesel'
                         )),
    tank_capacity        REAL,
    secondary_tank_capacity REAL,
    current_odometer     REAL,
    front_tyre_pressure  REAL,
    rear_tyre_pressure   REAL,
    service_interval_km  REAL,
    service_interval_months REAL DEFAULT 12,
    purchase_date        TEXT,
    notes                TEXT,
    is_archived          INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL,
    deleted_at           TEXT
  );
`;

const CREATE_FUEL_ENTRIES_TABLE = `
  CREATE TABLE IF NOT EXISTS fuel_entries (
    id                   TEXT PRIMARY KEY NOT NULL,
    vehicle_id           TEXT NOT NULL REFERENCES vehicles(id),
    date                 TEXT NOT NULL,
    odometer             REAL NOT NULL,
    fuel_amount          REAL NOT NULL CHECK (fuel_amount > 0),
    fuel_unit            TEXT NOT NULL CHECK (fuel_unit IN ('litres', 'kg', 'kWh')),
    price_per_unit       REAL NOT NULL CHECK (price_per_unit > 0),
    total_cost           REAL NOT NULL,
    fuel_station         TEXT,
    is_full_tank         INTEGER NOT NULL DEFAULT 1 CHECK (is_full_tank IN (0, 1)),
    calculated_mileage   REAL,
    mileage_unit         TEXT CHECK (mileage_unit IN ('km_per_litre', 'km_per_kg', 'km_per_kwh')),
    receipt_photo_uri    TEXT,
    notes                TEXT,
    fuel_system          TEXT DEFAULT 'primary' CHECK (fuel_system IN ('primary', 'secondary')),
    battery_start_percent REAL,
    battery_end_percent   REAL,
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL,
    deleted_at           TEXT
  );
`;

const CREATE_SERVICE_RECORDS_TABLE = `
  CREATE TABLE IF NOT EXISTS service_records (
    id                   TEXT PRIMARY KEY NOT NULL,
    vehicle_id           TEXT NOT NULL REFERENCES vehicles(id),
    date                 TEXT NOT NULL,
    odometer             REAL,
    service_type         TEXT NOT NULL,
    cost                 REAL,
    work_done            TEXT,
    garage_name          TEXT,
    next_due_km          REAL,
    next_due_date        TEXT,
    notes                TEXT,
    receipt_photo_uri    TEXT,
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL,
    deleted_at           TEXT
  );
`;

const CREATE_MAINTENANCE_COMPONENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS maintenance_components (
    id                   TEXT PRIMARY KEY NOT NULL,
    service_record_id    TEXT NOT NULL REFERENCES service_records(id),
    vehicle_id           TEXT NOT NULL REFERENCES vehicles(id),
    component_name       TEXT NOT NULL,
    action               TEXT DEFAULT 'replaced',
    brand                TEXT,
    cost                 REAL,
    next_due_km          REAL,
    next_due_date        TEXT,
    notes                TEXT,
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL,
    deleted_at           TEXT
  );
`;

const CREATE_EXPENSES_TABLE = `
  CREATE TABLE IF NOT EXISTS expenses (
    id                   TEXT PRIMARY KEY NOT NULL,
    vehicle_id           TEXT NOT NULL REFERENCES vehicles(id),
    date                 TEXT NOT NULL,
    category             TEXT NOT NULL,
    amount               REAL NOT NULL CHECK (amount > 0),
    description          TEXT,
    receipt_photo_uri    TEXT,
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL,
    deleted_at           TEXT
  );
`;

const CREATE_DOCUMENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS documents (
    id                   TEXT PRIMARY KEY NOT NULL,
    vehicle_id           TEXT NOT NULL REFERENCES vehicles(id),
    type                 TEXT NOT NULL CHECK (type IN ('RC', 'Insurance', 'PUC', 'FASTag', 'Warranty')),
    document_number      TEXT,
    insurer_name         TEXT,
    issue_date           TEXT,
    expiry_date          TEXT,
    file_uri             TEXT,
    superseded_by        TEXT REFERENCES documents(id),
    notes                TEXT,
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL,
    deleted_at           TEXT
  );
`;

const CREATE_MAINTENANCE_PROFILES_TABLE = `
  CREATE TABLE IF NOT EXISTS maintenance_profiles (
    id                   TEXT PRIMARY KEY NOT NULL,
    vehicle_id           TEXT NOT NULL REFERENCES vehicles(id),
    component_name       TEXT NOT NULL,
    interval_km          REAL,
    interval_months      REAL,
    target_odometer      REAL,
    target_date          TEXT,
    notes                TEXT,
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL,
    deleted_at           TEXT
  );
`;

const CREATE_TRIPS_TABLE = `
  CREATE TABLE IF NOT EXISTS trips (
    id                   TEXT PRIMARY KEY NOT NULL,
    vehicle_id           TEXT NOT NULL REFERENCES vehicles(id),
    trip_type            TEXT NOT NULL CHECK (trip_type IN ('gps', 'manual')),
    status               TEXT NOT NULL CHECK (status IN ('recording', 'paused', 'completed', 'interrupted', 'discarded')),
    start_time           TEXT NOT NULL,
    end_time             TEXT,
    start_odometer       REAL,
    end_odometer         REAL,
    distance_km          REAL NOT NULL DEFAULT 0,
    duration_seconds     REAL NOT NULL DEFAULT 0,
    purpose              TEXT,
    notes                TEXT,
    sample_count         INTEGER DEFAULT 0,
    quality_warning      TEXT,
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL,
    deleted_at           TEXT
  );
`;

const CREATE_TRIP_LOCATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS trip_locations (
    id                   TEXT PRIMARY KEY NOT NULL,
    trip_id              TEXT NOT NULL REFERENCES trips(id),
    latitude             REAL NOT NULL,
    longitude            REAL NOT NULL,
    accuracy             REAL,
    altitude             REAL,
    speed                REAL,
    heading              REAL,
    timestamp            INTEGER NOT NULL,
    is_rejected          INTEGER NOT NULL DEFAULT 0,
    rejection_reason     TEXT,
    created_at           TEXT NOT NULL
  );
`;

// ─── Indexes ─────────────────────────────────────────────────────────
/**
 * WHY indexes?
 * - fuel_entries are queried by vehicle_id + date constantly (dashboard, history).
 * - Without indexes, SQLite does a full table scan every time.
 * - These are the most common query patterns from the charter's UI flows.
 */

const CREATE_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_fuel_entries_vehicle_date
    ON fuel_entries(vehicle_id, date);

  CREATE INDEX IF NOT EXISTS idx_fuel_entries_vehicle_deleted
    ON fuel_entries(vehicle_id, deleted_at);

  CREATE INDEX IF NOT EXISTS idx_service_records_vehicle_date
    ON service_records(vehicle_id, date);

  CREATE INDEX IF NOT EXISTS idx_expenses_vehicle_date
    ON expenses(vehicle_id, date);

  CREATE INDEX IF NOT EXISTS idx_documents_vehicle_type
    ON documents(vehicle_id, type);

  CREATE INDEX IF NOT EXISTS idx_documents_expiry
    ON documents(expiry_date);

  CREATE INDEX IF NOT EXISTS idx_maint_components_service
    ON maintenance_components(service_record_id);

  CREATE INDEX IF NOT EXISTS idx_maint_components_vehicle_name
    ON maintenance_components(vehicle_id, component_name);

  CREATE INDEX IF NOT EXISTS idx_maint_profiles_vehicle
    ON maintenance_profiles(vehicle_id);

  CREATE INDEX IF NOT EXISTS idx_trips_vehicle_date
    ON trips(vehicle_id, start_time);

  CREATE INDEX IF NOT EXISTS idx_trip_locations_trip
    ON trip_locations(trip_id, timestamp);
`;

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Migrates the vehicles table if it was created under an older schema version
 * where the fuel_type CHECK constraint did not include the new hybrid types.
 *
 * In SQLite, column CHECK constraints cannot be altered or dropped directly.
 * Standard SQLite table recreation procedure is used:
 * 1. PRAGMA foreign_keys = OFF
 * 2. Create vehicles_new with updated CHECK constraint
 * 3. Copy all existing rows from vehicles to vehicles_new
 * 4. Drop vehicles
 * 5. Rename vehicles_new to vehicles
 * 6. PRAGMA foreign_keys = ON
 */
export function migrateVehiclesTableIfNeeded(db: SQLite.SQLiteDatabase): void {
  try {
    const tableInfo = db.getFirstSync<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'vehicles'"
    );

    if (!tableInfo?.sql) {
      // Table doesn't exist yet, will be created cleanly by CREATE_VEHICLES_TABLE
      return;
    }

    // If the schema already contains 'hybrid_cng_petrol', it is up to date
    if (tableInfo.sql.includes('hybrid_cng_petrol')) {
      return;
    }

    // Migration required!
    db.execSync('PRAGMA foreign_keys = OFF;');
    db.execSync('BEGIN TRANSACTION;');

    db.execSync(`
      CREATE TABLE vehicles_new (
        id                   TEXT PRIMARY KEY NOT NULL,
        nickname             TEXT NOT NULL,
        vehicle_type         TEXT NOT NULL CHECK (vehicle_type IN ('car', 'two_wheeler', 'three_wheeler', 'other')),
        manufacturer         TEXT,
        model                TEXT,
        variant              TEXT,
        year                 INTEGER,
        color                TEXT,
        registration_number  TEXT NOT NULL,
        fuel_type            TEXT NOT NULL CHECK (fuel_type IN (
                               'petrol', 'diesel', 'cng', 'lpg', 'electric', 'hybrid',
                               'hybrid_cng_petrol', 'hybrid_cng_diesel',
                               'hybrid_lpg_petrol', 'hybrid_lpg_diesel'
                             )),
        tank_capacity        REAL,
        secondary_tank_capacity REAL,
        current_odometer     REAL,
        front_tyre_pressure  REAL,
        rear_tyre_pressure   REAL,
        service_interval_km  REAL,
        service_interval_months REAL DEFAULT 12,
        purchase_date        TEXT,
        notes                TEXT,
        is_archived          INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
        created_at           TEXT NOT NULL,
        updated_at           TEXT NOT NULL,
        deleted_at           TEXT
      );
    `);

    // Determine if secondary_tank_capacity / service_interval_months already exists in current vehicles table
    const columns = db.getAllSync<{ name: string }>('PRAGMA table_info(vehicles);');
    const colSet = new Set(columns.map((c) => c.name));
    const secTankExpr = colSet.has('secondary_tank_capacity') ? 'secondary_tank_capacity' : 'NULL';
    const srvMonthsExpr = colSet.has('service_interval_months') ? 'service_interval_months' : '12';

    db.execSync(`
      INSERT INTO vehicles_new (
        id, nickname, vehicle_type, manufacturer, model, variant, year, color,
        registration_number, fuel_type, tank_capacity, secondary_tank_capacity,
        current_odometer, front_tyre_pressure, rear_tyre_pressure,
        service_interval_km, service_interval_months, purchase_date, notes, is_archived, created_at, updated_at, deleted_at
      )
      SELECT
        id, nickname, vehicle_type, manufacturer, model, variant, year, color,
        registration_number, fuel_type, tank_capacity, ${secTankExpr},
        current_odometer, front_tyre_pressure, rear_tyre_pressure,
        service_interval_km, ${srvMonthsExpr}, purchase_date, notes, is_archived, created_at, updated_at, deleted_at
      FROM vehicles;
    `);

    db.execSync('DROP TABLE vehicles;');
    db.execSync('ALTER TABLE vehicles_new RENAME TO vehicles;');

    db.execSync('COMMIT;');
    db.execSync('PRAGMA foreign_keys = ON;');
  } catch (err) {
    try {
      db.execSync('ROLLBACK;');
    } catch {
      // Ignore if no transaction was open
    }
    try {
      db.execSync('PRAGMA foreign_keys = ON;');
    } catch {
      // Ignore
    }
    console.error('[Database] Failed to migrate vehicles table constraint:', err);
    throw err;
  }
}

/**
 * Creates all tables and indexes if they don't already exist.
 * Called once during database initialization in connection.ts.
 *
 * @param db - The SQLite database instance
 */
export function createTables(db: SQLite.SQLiteDatabase): void {
  // Migrate existing tables before table creation/alteration
  migrateVehiclesTableIfNeeded(db);

  db.execSync(CREATE_VEHICLES_TABLE);
  db.execSync(CREATE_FUEL_ENTRIES_TABLE);
  db.execSync(CREATE_SERVICE_RECORDS_TABLE);
  db.execSync(CREATE_MAINTENANCE_COMPONENTS_TABLE);
  db.execSync(CREATE_EXPENSES_TABLE);
  db.execSync(CREATE_DOCUMENTS_TABLE);
  db.execSync(CREATE_MAINTENANCE_PROFILES_TABLE);
  db.execSync(CREATE_TRIPS_TABLE);
  db.execSync(CREATE_TRIP_LOCATIONS_TABLE);
  db.execSync(CREATE_INDEXES);

  // ── Migrations ──────────────────────────────────────────────────
  // ADD COLUMN migrations are idempotent (SQLite ignores if column already exists
  // via try/catch). Each migration targets a specific schema version bump.

  // v1.1 — Dual-tank support for hybrid vehicles
  try {
    db.execSync(
      `ALTER TABLE vehicles ADD COLUMN secondary_tank_capacity REAL`
    );
  } catch {
    // Column already exists on fresh installs — safe to ignore
  }

  // v1.2 — Multi-fuel, Bi-fuel systems and EV battery percentage support
  try {
    db.execSync(
      `ALTER TABLE fuel_entries ADD COLUMN fuel_system TEXT DEFAULT 'primary'`
    );
  } catch {
    // Column already exists
  }
  try {
    db.execSync(
      `ALTER TABLE fuel_entries ADD COLUMN battery_start_percent REAL`
    );
  } catch {
    // Column already exists
  }
  try {
    db.execSync(
      `ALTER TABLE fuel_entries ADD COLUMN battery_end_percent REAL`
    );
  } catch {
    // Column already exists
  }

  // v1.3 — Dual-dimension service interval in months (e.g. 12 months for 1 year)
  try {
    db.execSync(
      `ALTER TABLE vehicles ADD COLUMN service_interval_months REAL DEFAULT 12`
    );
  } catch {
    // Column already exists
  }

  // v1.4 — Attachments for service records & expenses
  try {
    db.execSync(
      `ALTER TABLE service_records ADD COLUMN receipt_photo_uri TEXT`
    );
  } catch {
    // Column already exists
  }
  try {
    db.execSync(
      `ALTER TABLE expenses ADD COLUMN receipt_photo_uri TEXT`
    );
  } catch {
    // Column already exists
  }
}
