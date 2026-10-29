# DriveLedger — Data Flow Reference

> Last updated: 2026-10-16

---

## Overview

DriveLedger is **fully offline**. All data flows are local — between the UI, Zustand stores, business-logic engines, and the SQLite database. There is no network layer for data.

---

## Add Fuel Entry Flow

```
User fills AddFuelScreen form
        │
        ▼
validateFuelEntry(input, prevOdometer, tankCapacity, fuelType)
  [validationEngine.ts]
        │  errors? → show inline field errors, block submit
        │  warnings only? → show confirmation dialog, allow proceed
        ▼
useFuelStore.addFuelEntry(input, vehicle)
  [fuelStore.ts]
        │
        ├─1─► fuelRepo.createFuelEntry(input)          → INSERT INTO fuel_entries
        │
        ├─2─► fuelRepo.getFuelEntriesByVehicleChronological(vehicleId)
        │              (re-read to get the inserted row's position in order)
        │
        ├─3─► mileageEngine.calculateMileageForEntry(entries, index, fuelType)
        │              → computes km/L or km/kg using tank-to-tank method
        │
        ├─4─► fuelRepo.updateFuelEntryMileage(entryId, value, unit)  → UPDATE
        │
        ├─5─► vehicleRepo.updateVehicleOdometer(vehicleId, highestOdometer)
        │
        ├─6─► set({ entries, stats, partialEstimates })   (Zustand state update)
        │
        └─7─► storeRegistry.refreshVehicles()
                → vehicleStore.loadVehicles()
                → UI re-renders Home screen with new odometer reading
```

---

## Delete Fuel Entry Flow

```
User taps Delete on HistoryScreen
        │
        ▼
useFuelStore.deleteFuelEntry(entryId, vehicle)
        │
        ├─1─► fuelRepo.softDeleteFuelEntry(entryId)      → UPDATE deleted_at
        │
        ├─2─► fuelRepo.getFuelEntriesByVehicleChronological(vehicleId)
        │
        ├─3─► mileageEngine.recalculateDownstreamMileage(entries, startIndex, fuelType)
        │              (only recalculates affected downstream entries in memory)
        │
        ├─4─► fuelRepo.updateFuelEntryMileage(id, …) for entries whose mileage changed
        │
        ├─5─► vehicleRepo.updateVehicleOdometer(vehicleId, latestOdometer)
        │
        ├─6─► set({ entries, stats, partialEstimates })
        │
        └─7─► storeRegistry.refreshVehicles()
```

---

## Load Screen Data Flow (Targeted Revision-Based Invalidation)

```
Screen comes into focus (useFocusEffect)
        │
        ├─► check dataRevisionTracker.getRevision(dataset, vehicleId)
        │       │
        │       ├─► Revision unchanged & vehicle unchanged?
        │       │       └─► SKIP SQLite read (use existing in-memory store state)
        │       │
        │       └─► Revision bumped or vehicle changed?
        │               ├─► fuel: fuelRepo.getFuelEntriesByVehicle(vehicleId)
        │               ├─► services: serviceRepo.getServiceRecordsByVehicle(vehicleId)
        │               ├─► expenses: expenseRepo.getExpensesByVehicle(vehicleId)
        │               └─► update screen's last-loaded revision ref
        │
        └─► Fleet Comparison & Charts (Stats Screen):
                └─► Uses targeted SQL aggregates (fuelRepo.getVehicleFuelAggregates,
                    serviceRepo.getVehicleServiceAggregates, expenseRepo.getVehicleExpenseAggregates)
                    instead of loading full entity rows across all vehicles.
```

---

## Backup Export Flow

```
User taps "Backup Data" in Settings
        │
        ▼
backupEngine.exportToFile()
        │
        ├─1─► createBackup()
        │       └─► SQLite SELECT * from all tables (in a READ TRANSACTION)
        │       └─► Bounded attachments collection (<=15MB per file)
        │
        ├─2─► deriveKey(password, salt)
        │       └─► PBKDF2-HMAC-SHA256 (100,000 iterations, 16-byte random salt)
        │
        ├─3─► encryptBackupV3(JSON.stringify(backup), password, metadata)
        │       └─► AES-256-GCM (12-byte IV, 16-byte auth tag verifying payload & metadata)
        │
        ├─4─► Write encrypted .dlbak to app's private cache/document directory
        │
        ├─5─► Directory.pickDirectoryAsync()   ← OS folder picker (SAF)
        │       │  cancelled? → share via OS share sheet (fallback)
        │       ▼
        └─6─► Directory.createFile(filename) → write encrypted content
```

---

## Backup Restore Flow

```
User taps "Restore Data" → picks a .dlbak file
        │
        ▼
backupEngine.pickAndVerifyBackup()
        │
        ├─1─► File.pickFileAsync()              ← OS file picker
        ├─2─► pickedFile.text()                 ← read raw content
        ├─3─► JSON.parse(rawContent)            ← parse envelope
        ├─4─► app_id & version check            (com.driveledger.app, v3 envelope)
        ├─5─► decryptBackupV3(envelope, password)
        │       └─► PBKDF2 key re-derivation + AES-256-GCM authenticated decryption
        └─6─► validateSchema()                  (row-level field checks)
                    │
                    ▼  { success: true, backup }
        │
        ▼ (after user confirms)
backupEngine.restoreFromValidated(backup)
        │
        ├─► BEGIN TRANSACTION
        ├─► DELETE FROM documents, expenses, service_records, fuel_entries, vehicles
        ├─► INSERT vehicles, fuel_entries, service_records, expenses, documents
        ├─► UPDATE superseded_by links (documents)
        └─► COMMIT  (or ROLLBACK on any error — existing data is NOT touched)
```

## Background GPS Persistence Flow

```
Location task receives a batch
        │
        ├─► read active trip and latest accepted location summary
        ├─► filter samples and calculate incremental distance in memory
        ├─► BEGIN TRANSACTION
        │       ├─► insert accepted locations
        │       └─► update trip counters, distance, and diagnostics
        ├─► COMMIT
        └─► notify listeners and GPS widget only after commit
```

If the transaction fails, no live update is published and the next callback
starts from a new persisted anchor.

---

## Stats Screen Data Flow

```
StatsScreen mounts
        │
        ├─► useFuelStore state (entries, stats) — from store (no extra DB call)
        ├─► useServiceStore state (records)
        ├─► useExpenseStore state (expenses)
        │
        └─► useMemo computations (all in-memory, no DB reads):
                ├─ filterRecordsByTimeRange(entries, timeRange)
                ├─ aggregateCostBreakdown(filteredEntries, filteredServices, filteredExpenses)
                │     └─ uses EXPENSE_CHART_BUCKET map from expenseCategories.ts
                ├─ timeScopedMileageStats (hoisted above early return — Rules of Hooks)
                └─ monthlyCostData (delegates to getMonthlyTotalSpend / getMonthlySpendHistory)

        Fleet Comparison (2+ vehicles only):
        ├─► useCrossVehicleStats(vehicles)
        │     └─► direct DB reads (fuelRepo, serviceRepo, expenseRepo) per vehicle
        │         (synchronous; bounded by number of vehicles)
        └─► renders CrossVehicleComparisonCard
```

---

## Theme / Colour Flow

```
System (OS dark mode setting)
        │
        ▼
useColorScheme()  [react-native]
        │
        ▼
useThemeColors()  [src/hooks/useThemeColors.ts]
        │
        ▼
colors.background, colors.text, colors.primary, …
        │
        ▼
Passed as prop or referenced inline in StyleSheet.create()
```

---

## Mileage Calculation Detail

```
Chronological entries (oldest → newest): E0, E1, E2, E3

E0 = first fill (no previous → no mileage calculated)
E1 = full tank, 500 km from E0
     mileage(E1) = (odometer[E1] - odometer[E0]) / fuel[E1]

E2 = partial fill (is_full_tank = 0)
     calculated_mileage = NULL (partial fills do not anchor a calculation)
     partialEstimate(E2) = (odometer[E2] - odometer[E1]) / fuel[E2]
                           (estimated from current fill replenishment, shown with ~ prefix)

E3 = full tank, 300 km from E1
     mileage(E3) = (odometer[E3] - odometer[E1]) / (fuel[E2] + fuel[E3])
                   (all fuel since last full fill is counted)
```

See [`mileage_calculation_guide.md`](./mileage_calculation_guide.md) for full comparison of partial fill formulas, edge cases, EV kWh, and CNG kg.

---

## GPS Trip Completion & Post-Trip Fuel Prompt Flow

```
User completes GPS Trip in TripReviewModal (or widget/background stop)
        │
        ├─► tripStore.finishGpsTrip(tripId, endOdometer, purpose, notes)
        │       ├─► tripRepo.updateTripStatus(tripId, 'completed', distance, duration, endOdo)
        │       ├─► vehicleRepo.updateVehicleOdometer(vehicleId, endOdometer)
        │       ├─► statsHelpers.estimateFuelLevel() updates depleted level based on km driven & mileage
        │       ├─► dataRevisionTracker.bumpRevision('trips', vehicleId)
        │       └─► dataRevisionTracker.bumpRevision('vehicles')
        │
        └─► showPostTripFuelPrompt() [postTripFuelPromptService.ts]
                ├─ User taps "Add Fuel":
                │     └─► router.push('/add-fuel?vehicleId=...&odometer=...')
                │           └─ Pre-fills verified odometer from GPS trip
                └─ User taps "Not Now" / dismisses:
                      └─► Preserves normal post-completion flow without altering trip
```

---

## GPS Speed & Efficiency Analysis Flow

```
Trip Detail Modal / Trip Review Modal opens (visible = true)
        │
        ├─► tripRepo.getTripLocations(tripId)
        │
        ├─► speedBandAnalysisEngine.analyzeTripSpeedBands(locations, options)
        │       ├─► Filters invalid coordinates & rejected points (O(N) check)
        │       ├─► Filters pause intervals & signal gaps (>120s)
        │       ├─► O(1) classifies intervals into speed bands (0-20, 20-30, 30-50, 50-80, 80+)
        │       ├─► Computes distance % and time % using identical shared denominators
        │       └─► Derives speed band mileage: Baseline × Band Efficiency Factor
        │
        └─► renders memoized SpeedEfficiencySection.tsx
                └─ 3-way toggle: Distance (km) | Time % | Estimated Mileage
```

