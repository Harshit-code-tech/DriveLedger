# DriveLedger — Architecture Guide

> Last updated: 2026-10-16

---

## Overview

DriveLedger is an offline-first vehicle tracking mobile app built with **Expo SDK 58 / React Native 0.88**. All data is stored locally on the device using **expo-sqlite**. There is no backend server; cloud sync is planned for v2.0 using UUID primary keys chosen specifically for this reason.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 58, React Native 0.88 |
| Navigation | Expo Router 4 (file-based) |
| State | Zustand 5 |
| Persistence | expo-sqlite 15 (synchronous API) |
| Crypto | expo-crypto (HMAC-SHA256, AES-256-GCM) |
| Language | TypeScript 5.3 (strict mode) |
| Tests | Jest + jest-expo preset |
| Platform | Android (primary), iOS (secondary), Web (landing page only) |

---

## Directory Structure

```
DriveLedger/
├── app/                        # Expo Router screens (file-based routing)
│   ├── (tabs)/                 # Bottom-tab screens
│   │   ├── index.tsx           # Home / Vehicle Dashboard
│   │   ├── stats.tsx           # Analytics & Reports (857 lines → being split)
│   │   ├── history.tsx         # Fuel entry history
│   │   └── settings.tsx        # Preferences, backup, vehicles
│   ├── add-fuel.tsx            # Add fuel entry modal
│   ├── add-service.tsx         # Add service record modal
│   ├── add-expense.tsx         # Add expense modal
│   └── _layout.tsx             # Root layout (DB init, font loading)
│
├── src/
│   ├── components/             # Reusable UI components
│   │   ├── charts/             # Chart components (BarChart, MileageTrendChart, etc.)
│   │   ├── OptionPicker.tsx    # Generic bottom-sheet option picker
│   │   ├── SettingsRow.tsx     # Settings list row
│   │   └── ...
│   ├── constants/              # App-wide enumerations and mappings
│   │   ├── fuelTypes.ts        # FuelType enum, unit labels
│   │   ├── expenseCategories.ts # Categories + EXPENSE_CHART_BUCKET map
│   │   └── theme.ts            # Spacing, Typography, Sizing tokens
│   ├── database/
│   │   ├── connection.ts       # SQLite connection singleton
│   │   ├── schema.ts           # CREATE TABLE + migrations
│   │   └── repositories/       # One file per table (fuelRepo, vehicleRepo, …)
│   ├── engine/                 # Pure business logic (no UI, no DB)
│   │   ├── mileageEngine.ts    # Tank-to-tank mileage calculation
│   │   ├── speedBandAnalysisEngine.ts # Non-overlapping speed-band classification & aggregation
│   │   ├── distanceEngine.ts   # GPS coordinate filtering and distance accumulation
│   │   ├── validationEngine.ts # Input validation rules
│   │   ├── backupEngine.ts     # Backup/restore orchestration (re-exports from backup/)
│   │   └── backup/             # Backup sub-modules
│   │       ├── types.ts        # Interfaces (BackupData, BackupResult, …)
│   │       └── schema.ts       # Pure row validators + validateSchema()
│   ├── hooks/                  # Custom React hooks
│   │   ├── useThemeColors.ts   # Dark/light theme colour accessor
│   │   └── useCrossVehicleStats.ts  # Multi-vehicle fleet comparison data
│   ├── services/               # Side-effectful services (PDF, CSV, update check)
│   │   ├── reportService.ts    # PDF report generation
│   │   └── updateChecker.ts    # GitHub release polling
│   ├── stores/                 # Zustand stores
│   │   ├── fuelStore.ts        # Fuel entry CRUD + mileage orchestration
│   │   ├── vehicleStore.ts     # Vehicle CRUD + selection
│   │   ├── preferencesStore.ts # User preferences (currency, units, etc.)
│   │   ├── storeRegistry.ts    # Cross-store callback registry (avoids circular imports)
│   │   └── ...
│   ├── types/                  # TypeScript type definitions per domain
│   └── utils/                  # Pure utility functions
│       ├── statsHelpers.ts     # filterRecordsByTimeRange, aggregateCostBreakdown, …
│       ├── format.ts           # formatCurrency, formatMileage, formatOdometer
│       ├── date.ts             # nowISO, dateInputToISO, …
│       └── ...
│
├── widgets/                    # Android home screen widget
├── docs/                       # Architecture, audit, and guidelines docs
└── index.html                  # Web landing page (static, no build step)
```

---

## Data Flow

```
User Action (UI)
      │
      ▼
Zustand Store Action  (fuelStore.addFuelEntry, vehicleStore.selectVehicle, …)
      │
      ├─► Repository (fuelRepo, vehicleRepo, …)  ──►  SQLite Database
      │
      └─► Engine (mileageEngine, validationEngine)  ──  pure calculation
              │
              └─► Repository (persist calculated mileage back to DB)
```

The screens **never** write to the database directly. All mutations go through store actions.

---

## Store Architecture

### fuelStore
- Holds `entries`, `stats`, `partialEstimates`, `isLoading`
- `loadEntries(vehicleId, fuelType?)` — call with `selectedVehicle.fuel_type` to avoid an internal vehicle lookup
- `addFuelEntry(input, vehicle)` — returns `{ entry, warning }`
- `deleteFuelEntry(entryId, vehicle)` — recalculates all downstream mileage

### vehicleStore
- Holds `vehicles`, `selectedVehicle`, `isLoading`, `error`
- Registers itself with `storeRegistry` on first `loadVehicles()` call
- All `syncWidgetState()` calls are guarded by `Platform.OS === 'android'`

### storeRegistry
- Tiny singleton that lets `fuelStore` trigger `vehicleStore.loadVehicles()` after a delete without creating a circular import
- Not a general-purpose event bus — only the vehicle refresh pattern is registered here

### preferencesStore
- Persisted to AsyncStorage via Zustand's persist middleware
- Exposes `getPreferences()` for use outside React components (e.g. inside vehicleStore)

---

## Mileage Calculation

Tank-to-tank method:

1. Fill-ups are stored in chronological order.
2. When a new full-tank fill-up is saved, `calculateMileageForEntry` divides the distance driven (odometer delta) by the fuel consumed (previous fill to this fill) to get `km/L` or `km/kg`.
3. Partial fills are estimated via `calculatePartialEstimate` using distance divided by fuel added in the current fill (representing replenishment).
4. `computeMileageStats` derives running average, best, worst, monthly average over all entries.

See [`mileage_calculation_guide.md`](./mileage_calculation_guide.md) for full details.

---

## GPS Speed & Efficiency Analysis

The Speed & Efficiency Analysis section (`SpeedEfficiencySection.tsx`) appears on completed GPS Trip Details (`TripDetailModal.tsx`) placed immediately after sensor diagnostics and before the Recorded Point Timeline.

### Speed-Band Boundaries & Relative Efficiency
- `0–<20 km/h` (`band_0_20`): Stop & Go crawling (ICE: 0.60x, EV: 1.20x)
- `20–<30 km/h` (`band_20_30`): City traffic (ICE: 0.80x, EV: 1.15x)
- `30–<50 km/h` (`band_30_50`): Moderate suburban cruising (ICE: 1.05x, EV: 1.10x)
- `50–<80 km/h` (`band_50_80`): Optimal cruising sweet spot (ICE: 1.25x, EV: 0.95x)
- `80+ km/h` (`band_80_plus`): High-speed aerodynamic drag dominant (ICE: 0.85x, EV: 0.75x)

Boundaries are non-overlapping: exact 20, 30, 50, and 80 km/h are strictly assigned to upper bands ($s \ge \text{min} \land (s < \text{max} \lor \text{max is null})$).

### Speed & Efficiency Section & Toggle Modes
- Displayed immediately upon ending a GPS trip in [`TripReviewModal`](file:///home/hghosh/Desktop/CODING/DriveLedger/src/components/TripReviewModal.tsx) and on completed trip details in [`TripDetailModal`](file:///home/hghosh/Desktop/CODING/DriveLedger/src/components/TripDetailModal.tsx).
- 3-way segmented toggle:
  1. **Distance**: Shows distance in km per speed band with proportional bar sharing total analyzed distance.
  2. **Time %**: Shows percentage of active moving duration per speed band with proportional bar sharing total analyzed duration.
  3. **Mileage**: Shows estimated average mileage (in `km/L`, `km/kg`, or `km/kWh`) provided at each particular speed range, calculated from the vehicle's baseline/running average scaled by aerodynamic and powertrain efficiency factors. Highlights the optimal sweet-spot band.

### Calculation Rules & Robustness
1. **Analysed Distance & Duration**: Estimated from consecutive accepted GPS points sorted chronologically.
2. **Missing Speeds**: Unknown, null, or negative speeds are NEVER treated as 0 km/h; unanalysed intervals are omitted from speed bands.
3. **Rejected Samples**: Ignored completely.
4. **Pause Boundaries**: Intervals that intersect or cross pause windows (`p.paused_at < t_curr && t_prev < p.resumed_at`) contribute 0 active moving time and 0 distance.
5. **Signal Gaps (>120s)**: Excluded from speed-band metrics and flagged in data quality notices.
6. **Strict Proportions**: In Distance mode, bar lengths represent each band's share of total *analysed distance*. In Time % mode, bar lengths represent each band's share of total *analysed duration*. Both modes share identical denominators between bar widths and displayed values.

### Vehicle Average Mileage Display
- Displayed below the speed-band bars in a dedicated summary row (never inside an individual speed-band bar).
- Derived authoritatively from the vehicle's existing tank-to-tank fuel records via `computeMileageStats(entries, fuelType).runningAverage`.
- If fewer than two qualifying full fills exist, displays the neutral message: `Add a valid fuel record interval to calculate the vehicle average.` (never `0 km/L`, `NaN`, or fabricated estimates).

### Post-Trip Fuel Prompt
- Triggered immediately after a GPS trip is successfully finalized and persisted (`finishGpsTrip` / `TripReviewModal`).
- Dialog title: `Trip completed!`, message: `Would you like to add fuel for this vehicle now?`.
- **Add Fuel**: Opens `/add-fuel` preselecting the trip's vehicle ID and pre-filling the odometer reading automatically from the trip's finalized/calculated end odometer. Normal navigation to `/add-fuel` (from tab bar, dashboard button, or widget) remains unaffected.
- **Not Now**: Dismisses dialog and preserves normal post-completion flow.
- Dismissing or cancelling fuel entry never rolls back, alters, or loses the saved trip.
- **Headless Deferral**: When a trip is finished via widget or background tasks (`finishGpsTripCoordinator`), the prompt (including trip end odometer) is stored in `AsyncStorage` and deferred until the app is foregrounded, ensuring headless tasks never trigger UI dialogs.
- Deduplication prevents duplicate dialogs across re-renders, app resume, or navigation events.

---

## Backup Security Model

Every `.dlbak` file (v3 format) is protected with authenticated encryption:
1. **Key Derivation**: **PBKDF2-HMAC-SHA256** with 100,000 iterations and a cryptographically secure 16-byte salt derived per backup from the user's password.
2. **Authenticated Encryption**: **AES-256-GCM** with a unique 12-byte IV and a 16-byte authentication tag that cryptographically verifies ciphertext integrity and envelope metadata (app ID, version, timestamp).

On restore:
1. PBKDF2 key re-derivation from salt and user password.
2. AES-256-GCM decryption with hardware-accelerated WebCrypto / SubtleCrypto.
3. Strict schema validation (row-level field checks via `src/engine/backup/schema.ts`).
4. Atomic SQL transaction (`withTransactionSync`) ensuring zero partial state on failure.
5. Post-commit asynchronous attachment restoration and reminder reconciliation.

---

## Performance & Optimization Architecture

- **Data Invalidation**: `dataRevisionTracker` maintains monotonic per-dataset revision counters, preventing unnecessary re-queries on tab focus or store transitions.
- **Evidence-Based Indexing**: Partial composite SQLite indexes (`idx_fuel_entries_active_date`, `idx_service_records_active_date`, etc.) cover `(vehicle_id, date DESC, id DESC) WHERE deleted_at IS NULL`, eliminating temporary B-tree sorting in query plans.
- **History Virtualization**: `FlatList` cursor-based pagination with search and date pushdowns bounds memory and query duration.
- **Report Snapshot Caching**: `ReportExportModal` caches a single-session snapshot of vehicle data across multiple export/share formats, eliminating redundant synchronous table scans.
- **Observability**: `perfObserver` provides zero-cost in-memory diagnostic telemetry for queries, GPS batches, widget evaluations, and notification reconciliation.

---

## Adding a New Expense Category

1. Add the category to `EXPENSE_CATEGORIES` in [`src/constants/expenseCategories.ts`](../src/constants/expenseCategories.ts).
2. Add its chart bucket to `EXPENSE_CHART_BUCKET` in the same file.

`aggregateCostBreakdown` in `statsHelpers.ts` will automatically handle the new category with no further changes.

---

## Testing

```bash
npm test          # Run all tests (Jest)
npm test -- --watch   # Watch mode
npm test -- --coverage  # Coverage report
```

Test files live at `__tests__/` alongside the module they test.
Pure business logic (engine, utils) is tested without mocking.
Store tests mock the repository layer.
