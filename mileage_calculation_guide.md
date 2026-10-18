# Mileage Calculation Guide — DriveLedger

This document explains in detail how mileage and fuel efficiency are calculated in DriveLedger.

Source code implementation:
- Core calculation logic: [`src/engine/mileageEngine.ts`](file:///d:/CODE/Project_Idea/DriveLedger/src/engine/mileageEngine.ts)
- Store orchestration & persistence: [`src/stores/fuelStore.ts`](file:///d:/CODE/Project_Idea/DriveLedger/src/stores/fuelStore.ts)
- Units & types: [`src/constants/fuelTypes.ts`](file:///d:/CODE/Project_Idea/DriveLedger/src/constants/fuelTypes.ts)

---

## 1. Overview by Fuel Type

DriveLedger supports multiple vehicle and fuel types, each using an appropriate calculation method:

| Fuel Type | Display Unit | Calculation Method | Rules Applied |
|---|---|---|---|
| **Petrol / Diesel / Hybrid** | `km/L` | Tank-to-Tank (with partial accumulation) | Rules R1 – R9 |
| **CNG / LPG** | `km/kg` | Tank-to-Tank (with partial accumulation) | Rules R1 – R9 |
| **Electric (EV)** | `km/kWh` | Charge-to-Charge | Rules EV-R1 – EV-R3 |

---

## 2. Tank-to-Tank Method (Combustion & Hybrid)

Vehicle fuel level meters and sensors are non-linear and inaccurate at intermediate points. The only reliable measurement point is a **Full Tank** (100% capacity).

### The Core Rules

1. **R1**: Current entry **must** be marked as a Full Tank (`is_full_tank = 1`).
2. **R2**: A previous Full Tank entry **must** exist for the same vehicle in history.
3. **R3**: Partial fills do not produce an official certified mileage by themselves.
4. **R4**: Fuel from all partial fills between two full tanks is **accumulated** and added to the next full tank calculation.
5. **R5**: Calculated mileage is saved directly to the database on the qualifying entry.
6. **R6**: Running average is the arithmetic mean of all stored calculated mileage values.
7. **R7**: If fewer than 2 full-tank entries exist, mileage cannot be calculated yet ("Not enough data").

### Formulas

```text
Distance (km) = Current Odometer - Previous Full Tank Odometer

Fuel Consumed = (Sum of fuel in intermediate partial fills) + Current Full Fill Fuel

Mileage = Distance / Fuel Consumed
```

### Complete Walkthrough Example

| Entry # | Date | Odometer | Fuel Added | Fill Type | Accumulated Fuel | Distance | Calculated Mileage | Notes |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---|
| **1** | Jan 01 | 10,000 km | 30.0 L | Full Tank | - | - | *None* | Starting baseline anchor |
| **2** | Jan 08 | 10,200 km | 8.0 L | Partial | 8.0 L | 200 km | *~6.67 km/L (est.)* | 200 km / 30.0 L (fuel added last fill) |
| **3** | Jan 15 | 10,350 km | 10.0 L | Partial | 18.0 L | 150 km | *~18.75 km/L (est.)* | 150 km / 8.0 L (fuel added last fill) |
| **4** | Jan 22 | 10,600 km | 22.0 L | Full Tank | 40.0 L total | 600 km | **15.00 km/L** | **Official Tank-to-Tank** |

#### Explanation of Entry #4 Calculation:
```text
Distance Driven  = 10,600 km - 10,000 km = 600 km
Total Fuel Used  = 8.0 L (Entry 2) + 10.0 L (Entry 3) + 22.0 L (Entry 4) = 40.0 L
Official Mileage = 600 km / 40.0 L = 15.00 km/L
```

---

## 3. Partial Fill Estimates (`~est`)

When you do not fill the tank to 100%, the true starting and ending fuel levels in the tank are unknown. However, DriveLedger provides an immediate estimate based on the fuel consumed to power that leg:

```text
Estimated Mileage = (Current Odometer - Previous Odometer) / Fuel Added in Previous Fill
```

**Rationale**: The distance driven between the previous fill and this fill was powered by the fuel already loaded in the **previous fill** (rather than what you just topped up). Dividing the interval distance by the previous fill's quantity yields an accurate operational estimate for that driving segment.

- Flagged with `isEstimate = true` in [`calculatePartialEstimate()`](file:///d:/CODE/Project_Idea/DriveLedger/src/engine/mileageEngine.ts#L226-L269).
- Displayed with a `~` prefix and `est.` badge (e.g. `~14.5 km/L est.`).
- These estimates are **not** mixed into the vehicle's official running average (which strictly relies on tank-to-tank full fills).

---

## 4. Electric Vehicles (EV) — Charge-to-Charge

EVs do not have a full-tank cutoff constraint. Efficiency is calculated directly between consecutive charging sessions:

```text
Efficiency = (Current Odometer - Previous Odometer) / kWh Charged
```

- Function: [`calculateEVEfficiency()`](file:///d:/CODE/Project_Idea/DriveLedger/src/engine/mileageEngine.ts#L277-L300)
- Display Unit: `km/kWh`
- The first logged charge serves as the odometer baseline. Every subsequent charge computes efficiency.

---

## 5. Aggregated Statistics

Computed in [`computeMileageStats()`](file:///d:/CODE/Project_Idea/DriveLedger/src/engine/mileageEngine.ts#L305-L395):

1. **Last Fill Mileage**: Mileage value from the most recent full tank fill.
2. **Running Average**: Arithmetic mean of all valid calculated mileage entries for the vehicle.
3. **Monthly Average**: Average of calculated entries logged within the current calendar month (`getMonth()` + `getFullYear()`).
4. **Best / Worst**: Highest and lowest single tank-to-tank mileage recorded in history.

---

## 6. Sanity & Reasonableness Thresholds

To prevent typos (like entering an extra 0 in odometer or litres) from going unnoticed, [`checkMileageReasonableness()`](file:///d:/CODE/Project_Idea/DriveLedger/src/engine/mileageEngine.ts#L451-L480) evaluates values by vehicle type:

| Vehicle Type | Fuel Unit | Normal Expected Range |
|---|---|---|
| **Car** | km/L (Litres) | 4.0 – 30.0 km/L |
| **Car** | km/kg (CNG) | 5.0 – 60.0 km/kg |
| **Car** | km/kWh (EV) | 2.0 – 15.0 km/kWh |
| **Two-Wheeler** | km/L (Litres) | 20.0 – 100.0 km/L |
| **Three-Wheeler** | km/L (Litres) | 10.0 – 60.0 km/L |

If a calculated mileage is outside these boundaries:
- A soft warning banner is shown to prompt the user to double-check their entry.
- The entry is **never blocked** from saving.

---

## 7. Dynamic Recalculation on Edit or Delete

If an earlier fuel entry is edited or deleted:
1. The odometer and fuel amounts in the chain change.
2. [`recalculateAllMileage()`](file:///d:/CODE/Project_Idea/DriveLedger/src/engine/mileageEngine.ts#L403-L440) runs automatically in [`fuelStore.ts`](file:///d:/CODE/Project_Idea/DriveLedger/src/stores/fuelStore.ts#L143-L178).
3. The engine iterates forward through all chronological entries and re-evaluates every interval and partial accumulation.
4. Updated mileage values are written back to SQLite and the UI refreshes immediately.
