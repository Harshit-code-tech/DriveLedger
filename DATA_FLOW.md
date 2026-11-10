# DriveLedger — Data Flow Reference

> Last updated: 2026-11-09

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
User taps Delete on Records screen
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
        └─► Fleet Comparison & Charts (Insights Tab / Screen):
                └─► Uses targeted SQL aggregates (fuelRepo.getVehicleFuelAggregates,
                    serviceRepo.getVehicleServiceAggregates, expenseRepo.getVehicleExpenseAggregates)
                    instead of loading full entity rows across all vehicles.
```

---

## Backup Export Flow

```
User taps "Download Encrypted Backup" in Manage → Data & Backup
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

---

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

## Insights Tab Data Flow

```
Insights screen mounts / comes into focus
        │
        ├─► useFuelStore state (entries, stats) — from store (no extra DB call)
        ├─► useServiceStore state (records)
        ├─► useExpenseStore state (expenses)
        │
        └─► useMemo computations (all in-memory, no DB reads):
                ├─ filterRecordsByTimeRange(entries, timeRange)   [utils/insightsHelpers.ts]
                ├─ aggregateCostBreakdown(filteredEntries, filteredServices, filteredExpenses)
                │     └─ uses EXPENSE_CHART_BUCKET map from expenseCategories.ts
                ├─ computeMileageStats(filteredEntries, fuelType)  [engine/mileageEngine.ts]
                ├─ buildShareSummary / computeCostPerKm           [utils/shareSummary.ts]
                └─ computeSixMonthStatistics(entries, services, expenses, vehicle)
                      [components/insights/insightsHelpers.ts]

Insights screen section rendering:
        ├─► InsightsOverview    — entry-point card with cross-tab navigation
        ├─► SpendingScreen      — donut chart, monthly bar, ₹100 breakdown
        ├─► EfficiencyScreen    — mileage trend curve, bi-fuel, partial-fill handling
        ├─► StatisticsScreen    — 6-month Quick Numbers with strict scope disclaimer
        └─► FleetScreen         — fleet efficiency comparison (2+ vehicles only)
                └─► useCrossVehicleStats(vehicles)
                      └─► direct DB reads (fuelRepo, serviceRepo, expenseRepo) per vehicle
                          (synchronous; bounded by number of vehicles)
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
        ├─► Generic colours → colors.background, colors.text, colors.primary, …
        │
        └─► Section palettes (domain-specific):
                ├─► useHomeColors()      [src/components/home/homeTheme.ts]
                ├─► useInsightsColors()  [src/components/insights/insightsTheme.ts]
                ├─► useManageColors()    [src/components/manage/manageTheme.ts]
                ├─► useRecordColors()    [src/components/records/recordTheme.ts]
                └─► useDocumentColors() [src/components/documents/documentTheme.ts]
```

Each section theme is a typed colour palette struct derived from the base `useThemeColors()` result, ensuring consistent dark/light mode without prop-drilling raw hex strings.

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
        │       ├─► insightsHelpers.estimateFuelLevel() updates depleted level based on km driven & mileage
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

---

## APK Download Flow

### Web (GitHub Pages landing page)

```
User opens index.html on mobile browser
        │
        ├─► Static buttons already link to GitHub releases page (fallback)
        │
        └─► fetchLatestRelease()  [js/script.js — runs on DOMContentLoaded]
                │
                ├─► GET https://api.github.com/repos/Harshit-code-tech/DriveLedger/releases/latest
                ├─► Find .apk asset in data.assets[]
                │
                └─► APK asset found?
                        ├─► Update .download-apk-btn href = browser_download_url (direct APK URL)
                        ├─► Set download="DriveLedger.apk" attribute on each button
                        │       └─► Forces browser to DOWNLOAD the file vs. navigating to it
                        │           (critical: mobile Chrome/Android follows redirects in-tab
                        │            without download attribute; with it, triggers Save dialog)
                        └─► Update terminal-card "Download APK" link similarly
```

### In-App (Android)

```
User taps "Check for Updates" in Manage → App Information
        │
        ▼
checkForAppUpdate()  [updateChecker.ts]
        │
        ├─► GET https://api.github.com/repos/.../releases/latest
        │       headers: { Accept: 'application/vnd.github.v3+json', User-Agent: 'DriveLedger-App' }
        │
        ├─► parseGitHubRelease(data, currentVersion)  [releaseParser.ts]
        │       ├─► isNewerVersion(currentVersion, tag_name)  [version.ts]
        │       └─► downloadUrl = apkAsset.browser_download_url || release.html_url
        │
        └─► hasUpdate === true?
                └─► Alert.alert("Update Available!", releaseNotes + safety rules, buttons)
                        └─► User taps "Download APK":
                                └─► Linking.openURL(downloadUrl)
                                        └─► Android routes URL to native download manager
                                            or system browser — triggers real file download
                                        NOTE: NOT WebBrowser.openBrowserAsync() — that opens
                                        a Chrome Custom Tab/WebView which follows the GitHub
                                        redirect and shows the APK in-browser instead of
                                        downloading it to the device
```

---

## Smart Insights Flow

```
SmartInsightsCard → REMOVED (replaced by InsightsOverview + screen-level analytics)

New flow in Insights tab:
insightsEngine.deriveInsights(data)   [still used internally in some screens]
        │
        ├─► Mileage trend analysis (rolling average vs. historical baseline)
        ├─► Cost anomaly detection (spike vs. monthly average)
        ├─► Service interval adherence (days + km since last service vs. profile)
        └─► Returns typed Insight[]
                (pure — no DB reads, no side effects, no async)

The Insights tab now renders dedicated analytical screens (Spending, Efficiency,
Statistics, Fleet) that provide deeper interactive analysis than the former
SmartInsightsCard widget.
```

---

## Notification & Reminder Reconciliation Flow

```
App foregrounds  OR  serviceStore / documentStore mutation completes
        │
        ▼
notificationService.reconcileReminders(vehicles, serviceRecords, documents)
  [notificationService.ts]
        │
        ├─► reminderRules.computeDueReminders(records, rules)
        │       ├─► Service: km-based (odometer delta vs. interval) + date-based
        │       └─► Documents: 30-day advance warning + overdue
        │
        ├─► expo-notifications.getAllScheduledNotificationsAsync()
        │       (read existing scheduled notification identifiers)
        │
        ├─► Diff: stale (records deleted / intervals changed) vs. new triggers
        │
        ├─► expo-notifications.cancelScheduledNotificationAsync(id)
        │       for each stale notification
        │
        └─► expo-notifications.scheduleNotificationAsync({ trigger, content })
                for each new trigger only
                (idempotent — re-mounting a screen does not duplicate reminders)
```

---

## Manage Tab — Section Navigation Flow

```
User opens Manage tab
        │
        ▼
manage.tsx loads ManageOverview
        │
        ├─► ManageOverview renders 5 section cards + quick actions
        │
        └─► User taps a section card:
                onSelectSection(section) → activeSection state update
                        │
                        ├─► activeSection === 'vehicles'     → ManageVehiclesScreen
                        ├─► activeSection === 'preferences'  → ManagePreferencesScreen
                        ├─► activeSection === 'trip_tracking' → ManageGpsScreen (ManageTripTrackingScreen)
                        │     (aliases: 'gps_tracking', 'gps_notifications' → same screen)
                        ├─► activeSection === 'notifications' → ManageNotificationsScreen
                        ├─► activeSection === 'data_backup'  → ManageDataBackupScreen
                        └─► activeSection === 'app_info'     → ManageAppInfoScreen

Android hardware back button: BackHandler listener returns to overview (activeSection = null)
Deep link support: ?section=<name> param pre-opens a specific section on mount

Section key aliases handled for backward compatibility:
  gps_notifications → maps to trip_tracking (ManageGpsScreen)
  gps_tracking      → maps to trip_tracking (ManageGpsScreen)
```
