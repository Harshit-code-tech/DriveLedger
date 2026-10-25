# DriveLedger 🚗📊

<div align="center">

![React Native](https://img.shields.io/badge/React_Native-0.88-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Expo](https://img.shields.io/badge/Expo-SDK_58-000020?style=for-the-badge&logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-Offline_First-003B57?style=for-the-badge&logo=sqlite&logoColor=white)
![Tests](https://img.shields.io/badge/Tests-Jest-success?style=for-the-badge&logo=jest&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

**A private, offline-first vehicle ledger and expense tracker designed for car and bike owners.**  
*Track fuel economy, maintenance history, running costs, tyre pressure, and document expiry — all without ads, logins, or tracking.*

[Download Latest APK](https://github.com/JyotikaJayani-08/DriveLedger/releases/latest) • [Key Features](#-key-features) • [Installation](#-getting-started) • [Documentation](#-documentation) • [Building the APK](#-building-the-standalone-apk) • [Data Safety](#-sideload--update-safety-rules)

</div>

---

## 🌟 Overview

**DriveLedger** is built for drivers who want complete control over their vehicle expenses and maintenance history without sacrificing privacy:
- **100% Offline & Private**: All data is stored in a local SQLite database directly on your phone. No logins, no remote analytics, no internet required.
- **Multi-Vehicle Support**: Effortlessly switch between multiple cars, bikes, or scooters with the quick vehicle switcher visible on every screen.
- **Indian Driving Context**: Built-in support for INR (₹), km/L, Indian number formatting (lakhs/crores), and standard Indian documents (PUC, RC, Fitness, Insurance).
- **Direct GitHub Releases In-App Updates**: Check for and download new APK releases directly from inside the app with zero Google Play dependencies.

---

## ✨ Key Features

### 🚗 Multi-Vehicle Context
- Manage multiple cars, motorcycles, and commercial vehicles in one place.
- Instant horizontal vehicle switcher chips appear on Dashboard, History, Stats, Documents, and Entry forms.
- Per-vehicle tank capacity, fuel type (Petrol, Diesel, CNG, EV), and specifications.

### ⛽ Accurate Fuel & Mileage Engine
- True **tank-to-tank calculation** for exact fuel efficiency (km/L, km/kg for CNG/LPG, km/kWh for EV).
- **Partial fills** are accumulated into the next full-tank calculation, and each one also gets a live `~est.` figure: `distance since previous entry ÷ fuel added in the previous fill`.
- Bi-fuel (CNG + Petrol) vehicles track each tank independently.
- Running averages, best/worst, distance between refills, cost-per-km, and sanity warnings for implausible mileage.
- 📖 Full rules and worked examples: [mileage_calculation_guide.md](mileage_calculation_guide.md).

### 🧮 Pay-by-Amount Fuel & EV Charging Entry (2-Way Calculator)
- At the pump or charging station, you often know the money spent, not the exact volume or kWh. Enter **Total Amount Paid** *or* **Quantity / Energy (L / kg / kWh)** — the other calculates instantly from the rate per unit.
- **EV-adaptive UX**: Automatically switches to **Energy Charged (kWh)**, **Electricity Rate (₹/kWh)**, charging locations/networks (Home AC, Tata Power EZ, Jio-bp pulse, ChargeZone), and battery % to kWh calculation.
- Quick-pick chips (₹200 – ₹2,500), live calculation summary (`₹1,000 ÷ ₹105.00 = 9.52 L` or `₹500 ÷ ₹8.00 = 62.50 kWh`), and previous station/rate pre-filled.
- Saving with any two of the three values (amount, quantity, price) auto-fills the third.

### 🛰️ Live GPS Cockpit & Offline Trip Recording
- Real-time speedometer (km/h), live trip distance, elapsed duration, and offline GPS route recorder with background tracking support.
- Vehicle-isolated recording ensures trips started on one vehicle never bleed into another.
- Automatic trip completion modal with odometer sync, trip classification (Personal, Commute, Business), and optional fuel consumption estimation.

### 📱 Android Home-Screen Widgets (3 Variants)
- **DriveLedger Quick Glance (4x2)**: Live odometer, last-fill mileage, monthly spend, tyre pressure, service/document alerts, and 1-tap logging shortcuts.
- **DriveLedger GPS Cockpit (4x2)**: Live cockpit HUD with large digital speedometer, recording controls (Pause/Resume/End), and active vehicle indicator.
- **DriveLedger GPS Strip (4x1)**: Compact, single-row HUD widget designed to live right below your search bar showing live speed, distance, and timer.

### 🔧 Vehicle Maintenance & Service Ledger
- Automotive-centric record keeping: track oil changes, brake pads, filters, battery, tyre rotations, and general checkups.
- Keep tabs on workshop/garage names, parts replaced, labor costs, and odometer intervals.
- Service interval alerts showing exact kilometers until your next scheduled maintenance.

### 📑 Executive PDF Service Ledger & Tax CSV Export
- Export printable, official **Verified Service Ledger** PDF reports for vehicle resale (Spinny, Cars24, private buyers) with offline verified provenance.
- Generate RFC 4180 compliant CSV ledgers with UTF-8 BOM for Microsoft Excel / Google Sheets tax deductions and business reimbursement.

### 💰 Running Costs & Expense Tracker
- Record non-fuel costs: tolls, parking, car washes, state permits, insurance renewals, fines, and accessories.
- Categorized expense tagging with monthly cost breakdown.

### 🚨 Recommended Tyre Pressure Display
- Store factory-recommended tyre pressure (PSI) for both front and rear tyres.
- Quick tyre pressure card on the home dashboard for quick reference at petrol pumps.

### 📄 Document Vault & Expiry Warnings
- Securely store renewal dates for Insurance, PUC (Pollution Under Control), RC (Registration), Fitness Certificate, Road Tax, and Driving License.
- Urgent dashboard alerts when documents are expiring within 30 days or overdue.

### 🔄 In-App GitHub Updates
- Checks the official [GitHub Releases API](https://api.github.com/repos/JyotikaJayani-08/DriveLedger/releases/latest) with one tap in Settings.
- View release notes ("What's New") and download the new `.apk` directly in your browser.

### 💾 1-Tap Offline Backup & Restore (V3 Encryption)
- Export your entire database encrypted with **AES-256-GCM** and password-protected via **PBKDF2-HMAC-SHA256**.
- Attachments (receipt photos and document scans) are bundled directly into the portable `.dlbak` file.
- Atomic restore inside SQLite transactions with automatic rollback if verification fails.

---

## 📱 Tech Stack

- **Framework**: [Expo SDK 58](https://expo.dev) with [React Native 0.88](https://reactnative.dev)
- **Navigation**: [Expo Router v58](https://docs.expo.dev/router/introduction/) (file-based routing)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (Strict Mode)
- **Local Database**: [Expo SQLite v58](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- **Widgets**: [react-native-android-widget](https://github.com/sovmas/react-native-android-widget)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Date & Storage Utilities**: DayJS, Expo FileSystem, Expo WebBrowser
- **Testing**: [Jest](https://jestjs.io/) & [ts-jest](https://kulshekhar.github.io/ts-jest/)

---

## 📚 Documentation

Start here if you want to understand or contribute to the codebase:

| Document | What you will learn |
|---|---|
| 🏛️ **[ARCHITECTURE.md](ARCHITECTURE.md)** | The big picture: tech stack, directory layout, the screen → store → repository/engine layering, how Zustand stores, `storeRegistry`, and `preferencesStore` fit together, the backup security model (HMAC-SHA256 + AES-256-GCM), how to add an expense category, and how to run tests. Read this first. |
| 🔀 **[DATA_FLOW.md](DATA_FLOW.md)** | Step-by-step traces of how data moves: adding and deleting a fuel entry (validation → store → repo → engine → odometer → UI refresh), loading screen data, backup export/restore, the Stats screen, theme/colour flow, and a worked mileage example. Read this when debugging or changing a feature end to end. |
| 🧮 **[mileage_calculation_guide.md](mileage_calculation_guide.md)** | The mileage rules in detail: tank-to-tank (R1–R9), partial-fill accumulation and the `~est.` formula, EV charge-to-charge, aggregated stats, reasonableness thresholds per vehicle type, and recalculation on edit/delete, with a complete worked example table. |

### Project Structure at a Glance

```text
app/        Expo Router screens (tabs, add-fuel, add-service, add-expense, ...)
src/engine/       Pure business logic: mileage, validation, backup
src/stores/       Zustand stores (screens never touch the DB directly)
src/database/     SQLite connection, schema, repositories
src/widgets/      Android home-screen widget
src/components/   Reusable UI components
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [Expo Go](https://expo.dev/go) on your Android device (or an Android emulator)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/JyotikaJayani-08/DriveLedger.git
   cd DriveLedger
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Expo development server:
   ```bash
   npx expo start
   ```

4. Scan the QR code using the **Expo Go** app on your Android device to test immediately.

---

## 📦 Building the Standalone APK

DriveLedger uses **Expo Application Services (EAS)** for building installable Android APKs without requiring Android Studio or local toolchains.

### 1. Configure EAS Build
EAS build profile is configured in `eas.json` to generate standalone APKs:
```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

### 2. Build the APK in Cloud (Recommended)
Run the following command:
```bash
npx eas-cli build -p android --profile preview
```
- Log into your free [Expo account](https://expo.dev).
- Allow EAS to generate your Android Keystore.
- When the build finishes (~5–8 minutes), EAS will print a **direct download link** to your `.apk`.

---

## 🔄 Publishing Releases on GitHub

To distribute updates to your users:

1. In `app.json`, bump the version and version code:
   ```json
   "version": "1.1.0",
   "android": {
     "package": "com.driveledger.app",
     "versionCode": 1
   }
   ```
2. Build the new APK using `npx eas-cli build -p android --profile preview`.
3. Download the generated `.apk` file from the Expo dashboard.
4. Go to **[GitHub Releases](https://github.com/JyotikaJayani-08/DriveLedger/releases)** ➔ **Draft a new release**:
   - Tag version: `v1.1.0`
   - Release title: `DriveLedger v1.1.0`
   - Description: Add release notes (What's New)
   - Attach your downloaded `.apk` file under **Assets**.
5. Click **Publish release**.
6. When users tap **"Check for Updates"** in DriveLedger, the app will automatically fetch the new release and offer to download it!

---

## 🛡️ Sideload & Update Safety Rules

Because DriveLedger is distributed as an APK outside Google Play, keep these rules in mind:

| Rule | Details |
|---|---|
| **1. Never Uninstall Before Updating** | Installing a newer APK directly over the existing one replaces the app binaries while **Android preserves all SQLite data and vehicle logs**. Uninstalling first will delete your data! |
| **2. Export Backup Before Major Updates** | Go to **Settings ➔ Data & Storage ➔ Export JSON Backup** to save a snapshot to Google Drive or Files. |
| **3. Same Keystore Signature** | EAS securely manages your keystore in the cloud. As long as you build with EAS, every update shares the exact same signature. |

---

## 🧪 Running Automated Tests

DriveLedger includes unit tests for the mileage engine (tank-to-tank, partial-fill estimates, EV, bi-fuel), validation, backup schema, statistics, CSV/PDF export, date/format helpers, and version checking:

```bash
npm test                              # run everything
npx jest src/engine/__tests__         # engine only (mileage + validation)
```

Tests live in `__tests__/` folders next to the module they cover. Pure modules (engine, utils) are tested without mocks; store tests mock the repository layer. See [ARCHITECTURE.md](ARCHITECTURE.md#testing) for details.

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
Built with ❤️ for drivers who value their data, privacy, and vehicle maintenance.
</div>
