# DriveLedger — Architecture Guide

> Last updated: 2026-10-16

---

## Overview

DriveLedger is an offline-first vehicle tracking mobile app built with **Expo SDK 57 / React Native 0.86**. All data is stored locally on the device using **expo-sqlite**. There is no backend server; cloud sync is planned for v2.0 using UUID primary keys chosen specifically for this reason.

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 57, React Native 0.86 |
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
3. Partial fills are estimated via `calculatePartialEstimate` using distance divided by fuel added in the previous fill.
4. `computeMileageStats` derives running average, best, worst, monthly average over all entries.

See [`mileage_calculation_guide.md`](./mileage_calculation_guide.md) for full details.

---

## Backup Security Model

Every `.dlbak` file is:
1. Signed with **HMAC-SHA256** (using a bundle-compiled key) — proves the file came from DriveLedger and was not tampered with.
2. Encrypted with **AES-256-GCM** — protects user data at rest.

On restore:
1. AES decryption
2. HMAC verification (constant-time comparison prevents timing attacks)
3. Schema validation (row-level field checks via `src/engine/backup/schema.ts`)
4. Atomic SQL transaction (ROLLBACK on any failure)

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
