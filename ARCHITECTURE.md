# DriveLedger — Architecture Guide

> Last updated: 2026-11-02

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
| Crypto | expo-crypto + @noble/hashes (PBKDF2-HMAC-SHA256, AES-256-GCM) |
| Language | TypeScript ~6.0 (strict mode) |
| Tests | Jest ~30 + jest-expo preset + ts-jest |
| Platform | Android (primary), iOS (secondary), Web (landing page only) |

---

## Directory Structure

```
DriveLedger/
├── app/                             # Expo Router screens (file-based routing)
│   ├── (tabs)/                      # Bottom-tab screens
│   │   ├── index.tsx                # Home / Vehicle Dashboard (primary screen)
│   │   ├── insights.tsx             # Insights tab (Analytics & Reports)
│   │   ├── records.tsx              # Chronological vehicle records (fuel/service/expense/trip)
│   │   ├── history.tsx              # Backward-compatibility redirect to records
│   │   ├── documents.tsx            # Document vault & expiry tracking
│   │   └── manage.tsx               # Manage hub: vehicles, preferences, GPS, backup, about
│   ├── add-fuel.tsx, add-service.tsx, add-expense.tsx, add-document.tsx
│   ├── add-vehicle.tsx, edit-vehicle.tsx
│   ├── checklist.tsx                # Pre-trip checklist launcher
│   ├── onboarding.tsx               # First-launch onboarding flow
│   └── _layout.tsx                  # Root layout (DB init, font loading, widget registration)
│
├── src/
│   ├── components/                  # Reusable UI components
│   │   ├── charts/                  # BarChart, MileageTrendChart, CostBreakdownDonutChart
│   │   ├── history/                 # History entry cards (fuel, service, expense, document)
│   │   ├── ActiveTripModal.tsx      # Live GPS trip HUD & controls
│   │   ├── FleetComparisonCard.tsx  # Multi-vehicle fleet stats comparison
│   │   ├── MaintenanceProfilesModal.tsx  # Maintenance interval profile picker
│   │   ├── ManualTripModal.tsx      # Manual trip entry form
│   │   ├── MonthlySpendCard.tsx     # Monthly cost breakdown card
│   │   ├── PreTripChecklistModal.tsx  # Pre-trip vehicle checklist dialog
│   │   ├── ReportExportModal.tsx    # PDF/CSV export UI (session-cached)
│   │   ├── SmartInsightsCard.tsx    # Insight cards from insightsEngine
│   │   ├── SpeedEfficiencySection.tsx  # Speed-band efficiency visualizer
│   │   ├── TripDetailModal.tsx      # Completed GPS trip detail view
│   │   ├── TripReviewModal.tsx      # Post-trip review & finalization
│   │   ├── OptionPicker.tsx, SettingsRow.tsx, ...
│   │
│   ├── constants/                   # App-wide enumerations and mappings
│   │   ├── documentTypes.ts, expenseCategories.ts, fuelTypes.ts
│   │   ├── formStyles.ts, serviceTemplates.ts, theme.ts
│   │
│   ├── database/
│   │   ├── connection.ts            # SQLite connection singleton
│   │   ├── safeUpdate.ts            # Safe column-migration helper (ALTER TABLE guard)
│   │   ├── schema.ts                # CREATE TABLE statements + incremental migrations
│   │   └── repositories/            # One file per table domain
│   │       ├── documentRepo.ts, expenseRepo.ts, fuelRepo.ts
│   │       ├── maintenanceComponentRepo.ts, maintenanceProfileRepo.ts
│   │       ├── serviceRepo.ts, tripRepo.ts, vehicleRepo.ts
│   │
│   ├── engine/                      # Pure business logic (no UI, no DB, no side effects)
│   │   ├── backup/
│   │   │   ├── types.ts, schema.ts, crypto.ts, exportBackup.ts, restore.ts
│   │   ├── backupEngine.ts          # Backup/restore orchestration (re-exports from backup/)
│   │   ├── distanceEngine.ts        # GPS coordinate filtering & incremental distance
│   │   ├── insightsEngine.ts        # Smart insights derivation from vehicle history
│   │   ├── mileageEngine.ts         # Tank-to-tank mileage calculation
│   │   ├── odometerReconciliation.ts  # Odometer consistency checks
│   │   ├── speedBandAnalysisEngine.ts  # Speed-band classification & efficiency aggregation
│   │   └── validationEngine.ts      # Input validation rules for all form types
│   │
│   ├── hooks/
│   │   ├── useCrossVehicleStats.ts  # Multi-vehicle fleet comparison data hook
│   │   └── useThemeColors.ts        # Dark/light theme colour accessor
│   │
│   ├── services/                    # Side-effectful services & workflows
│   │   ├── reports/
│   │   │   ├── fuelExpensesCsv.ts, reportActions.ts, reportHtmlHelpers.ts
│   │   │   ├── serviceLedger.ts, vehicleDossier.ts, vehicleHistoryReport.ts
│   │   ├── dataRevisionTracker.ts   # Monotonic revision counters — targeted cache invalidation
│   │   ├── locationPermissionService.ts  # Location permission management
│   │   ├── notificationService.ts   # Service/document reminder scheduling
│   │   ├── perfObserver.ts          # Zero-cost in-memory diagnostic telemetry
│   │   ├── postTripFuelPromptService.ts  # Headless-safe post-trip fuel prompt deferral
│   │   ├── reminderRules.ts, reportService.ts
│   │   ├── tripCoordinatorService.ts  # GPS trip lifecycle coordinator (foreground + headless)
│   │   └── updateChecker.ts         # GitHub release polling + in-app update alerts
│   │
│   ├── stores/                      # Zustand stores
│   │   ├── checklistStore.ts        # Pre-trip checklist state & persistence
│   │   ├── documentStore.ts, expenseStore.ts, fuelStore.ts
│   │   ├── maintenanceProfileStore.ts
│   │   ├── preferencesStore.ts      # User preferences (AsyncStorage persist middleware)
│   │   ├── serviceStore.ts, storeRegistry.ts
│   │   ├── tripStore.ts             # GPS trip lifecycle: start/pause/resume/finish/recover
│   │   └── vehicleStore.ts          # Vehicle CRUD + selection + widget sync
│   │
│   ├── tasks/
│   │   └── backgroundLocationTask.ts  # Expo TaskManager background location handler
│   │
│   ├── types/                       # TypeScript domain types (document, expense, fuel, service, trip, vehicle)
│   ├── utils/
│   │   ├── attachmentStorage.ts, csvExport.ts, date.ts, dateInput.ts
│   │   ├── format.ts, releaseParser.ts, shareSummary.ts
│   │   ├── insightsHelpers.ts, uuid.ts, version.ts
│   │
│   └── widgets/
│       ├── cockpit/                 # GPS Cockpit widget sub-components (helpers, palette, svgs, types)
│       ├── GpsCockpitWidget.tsx     # GPS Cockpit HUD widget 4×2
│       ├── VehicleGlanceWidget.tsx  # Vehicle Quick Glance widget 4×2
│       ├── widgetDataService.tsx    # Widget snapshot builder — reads SQLite only
│       └── widgetTaskHandler.tsx    # Widget tap action dispatcher
│
├── android/                         # Android native project files
├── plugins/                         # Expo config plugins
├── docs/                            # Architecture, refactor plan, and guidelines docs
├── index.html                       # Web landing page (GitHub Pages)
├── css/style.css, js/script.js      # Landing page assets
└── assets/                          # App icon, splash, fonts, images
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
- `deleteFuelEntry(entryId, vehicle)` — recalculates all downstream mileage via `mileageEngine.recalculateDownstreamMileage`

### vehicleStore
- Holds `vehicles`, `selectedVehicle`, `isLoading`, `error`
- Registers itself with `storeRegistry` on first `loadVehicles()` call
- All `syncWidgetState()` calls are guarded by `Platform.OS === 'android'`

### tripStore (largest store)
- Full GPS trip lifecycle: `activeTrip`, `activeTripLocations`, `tripStatus`, pause windows, diagnostics
- Coordinates start/pause/resume/finish/recover across app foreground, widget taps, and background task
- `finishGpsTrip` triggers `postTripFuelPromptService` (deferred when headless)

### checklistStore
- Pre-trip checklist items and completion state per vehicle
- Persisted to SQLite via `maintenanceComponentRepo`

### serviceStore
- Service records CRUD + interval countdown tracking
- Delegates reminder scheduling to `notificationService`

### preferencesStore
- Persisted to AsyncStorage via Zustand's persist middleware
- Exposes `getPreferences()` for use outside React components (e.g., vehicleStore, widgetDataService)

### storeRegistry
- Tiny singleton that lets `fuelStore` trigger `vehicleStore.loadVehicles()` after a delete without creating a circular import
- Not a general-purpose event bus — only the vehicle refresh pattern is registered here

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

- **Render Memoization**: Home screen (`app/(tabs)/index.tsx`) memoizes all 12+ expensive derived values via `useMemo` (fuel level estimates, vehicle-type flags, monthly spend, service status). Pure helper functions (`docExpiryText`, `formatTripTime`) live outside the component body — never re-allocated.
- **Data Invalidation**: `dataRevisionTracker` maintains monotonic per-dataset revision counters, preventing unnecessary re-queries on tab focus or store transitions.
- **Evidence-Based Indexing**: Partial composite SQLite indexes (`idx_fuel_entries_active_date`, `idx_service_records_active_date`, etc.) cover `(vehicle_id, date DESC, id DESC) WHERE deleted_at IS NULL`, eliminating temporary B-tree sorting in query plans.
- **History Virtualization**: `FlatList` cursor-based pagination with search and date pushdowns bounds memory and query duration.
- **Report Snapshot Caching**: `ReportExportModal` caches a single-session snapshot of vehicle data across multiple export/share formats, eliminating redundant synchronous table scans.
- **GPS Batching**: `backgroundLocationTask` batches location updates; incremental distance computed in memory before one atomic SQLite commit per 10-sample buffer.
- **Observability**: `perfObserver` provides zero-cost in-memory diagnostic telemetry for queries, GPS batches, widget evaluations, and notification reconciliation.

---

## Adding a New Expense Category

1. Add the category to `EXPENSE_CATEGORIES` in [`src/constants/expenseCategories.ts`](../src/constants/expenseCategories.ts).
2. Add its chart bucket to `EXPENSE_CHART_BUCKET` in the same file.

`aggregateCostBreakdown` in `insightsHelpers.ts` will automatically handle the new category with no further changes.

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

---

## Android Home-Screen Widgets

| Widget | Size | Purpose |
|--------|------|---------|
| `VehicleGlanceWidget` | 4×2 | Odometer, mileage, monthly spend, tyre pressure, service/document alerts, logging shortcuts |
| `GpsCockpitWidget` | 4×2 | Live GPS speed HUD, trip controls (Pause/Resume/End), active vehicle |
| GPS Strip | 4×1 | Compact row: live speed, distance, timer |

**Design constraints:**
- `widgetDataService` reads SQLite only — never starts or modifies a trip
- `widgetTaskHandler` dispatches taps to `tripCoordinatorService`
- Widget refresh does not depend on mounted React components or Zustand subscriptions

---

## Notification & Reminder System

`notificationService` coordinates:
- Service interval reminders (km-based and date-based) via `reminderRules.ts`
- Document expiry warnings (30-day advance and overdue)
- Scheduling via `expo-notifications` with idempotent reconciliation
- Lazily loaded to maintain Expo Go compatibility (SDK 53+)

---

## Landing Page & APK Distribution

`index.html` is deployed to GitHub Pages via `.github/workflows/deploysite.yaml`.

**APK download (web):** `js/script.js` calls the GitHub Releases API on page load. When a `.apk` asset is found, `.download-apk-btn` hrefs are updated to the direct `browser_download_url` **and** the `download` attribute is set — forcing mobile Chrome/Android to download the file instead of opening it in a browser tab.

**APK download (in-app):** Manage → "Check for Updates" → `updateChecker.ts`. "Download APK" calls `Linking.openURL(apkUrl)` which routes to Android's native download manager (not `WebBrowser.openBrowserAsync` which would open a WebView).
