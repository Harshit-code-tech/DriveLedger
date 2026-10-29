# Mileage Calculation Guide — DriveLedger

This document explains in detail how mileage and fuel efficiency are calculated in DriveLedger.

Source code implementation:
- Core calculation logic: [`src/engine/mileageEngine.ts`](file:///home/hghosh/Desktop/CODING/DriveLedger/src/engine/mileageEngine.ts)
- Store orchestration & persistence: [`src/stores/fuelStore.ts`](file:///home/hghosh/Desktop/CODING/DriveLedger/src/stores/fuelStore.ts)
- Units & types: [`src/constants/fuelTypes.ts`](file:///home/hghosh/Desktop/CODING/DriveLedger/src/constants/fuelTypes.ts)

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
| **2** | Jan 08 | 10,200 km | 8.0 L | Partial | 8.0 L | 200 km | *~25.00 km/L (est.)* | 200 km / 8.0 L (fuel added in current fill) |
| **3** | Jan 15 | 10,350 km | 10.0 L | Partial | 18.0 L | 150 km | *~15.00 km/L (est.)* | 150 km / 10.0 L (fuel added in current fill) |
| **4** | Jan 22 | 10,600 km | 22.0 L | Full Tank | 40.0 L total | 600 km | **15.00 km/L** | **Official Tank-to-Tank** |

#### Explanation of Entry #4 Calculation:
```text
Distance Driven  = 10,600 km - 10,000 km = 600 km
Total Fuel Used  = 8.0 L (Entry 2) + 10.0 L (Entry 3) + 22.0 L (Entry 4) = 40.0 L
Official Mileage = 600 km / 40.0 L = 15.00 km/L
```

---

## 3. Partial Fill Estimates (`~est`)

When you do not fill the tank to 100%, the true starting and ending fuel levels in the tank are unknown. However, DriveLedger provides an immediate operational estimate based on the fuel added in the current fill:

```text
Estimated Mileage = (Current Odometer - Previous Odometer) / Fuel Added in Current Fill
```

### Rationale: Replenishment Model
In day-to-day driving, when a driver visits a fuel station after a commute or completed trip, the quantity of fuel pumped into the tank is typically intended to **replenish** the fuel consumed over the distance driven since the prior log.
- **Example**: If your odometer advanced 10 km (e.g., from 46,100 km to 46,110 km) and you top up 0.45 L of diesel, the replenishment calculation produces:
  $$\frac{46,110 - 46,100 \text{ km}}{0.45 \text{ L}} = \frac{10 \text{ km}}{0.45 \text{ L}} = 22.22 \text{ km/L}$$
- This gives an immediate, realistic, and intuitive estimate of efficiency for that specific leg.

### UI & Engine Rules:
- Flagged with `isEstimate = true` in [`calculatePartialEstimate()`](file:///home/hghosh/Desktop/CODING/DriveLedger/src/engine/mileageEngine.ts#L239-L285).
- Displayed with a `~` prefix and `est.` badge (e.g. `~22.2 km/L est.`).
- These estimates are **never mixed into the vehicle's official running average** (which strictly relies on tank-to-tank full fills).
- When the user eventually performs a full tank fill, the entire interval is precisely reconciled through the tank-to-tank accumulation rule (Rule R4).

---

## 4. Comparison of Partial Fill Formulas (Current vs. Previous Fill Denominator)

DriveLedger evaluated two distinct mathematical models for estimating partial fill mileage when full tank cutoffs are absent:

1. **Formula 1 (Active in DriveLedger — Denominator: Current Fuel Added)**:
   $$\text{Mileage}_{\text{partial}} = \frac{\text{Odometer}_{\text{current}} - \text{Odometer}_{\text{previous}}}{\text{Fuel}_{\text{current}}}$$

2. **Formula 2 (Alternative / Previous Approach — Denominator: Previous Fuel Added)**:
   $$\text{Mileage}_{\text{partial}} = \frac{\text{Odometer}_{\text{current}} - \text{Odometer}_{\text{previous}}}{\text{Fuel}_{\text{previous}}}$$

### 4.1 Side-by-Side Comparison

| Dimension / Scenario | Formula 1: Current Fuel Added (Active) | Formula 2: Previous Fuel Added (Alternative) |
|---|---|---|
| **Underlying Concept** | **Replenishment Model**: Assumes the fuel added *now* replenishes what was consumed over the distance driven since the prior log. | **Batch Depletion Model**: Assumes the distance driven was powered exclusively by the batch of fuel poured into the tank during the *previous* fill. |
| **Mathematical Formula** | $\Delta \text{Distance} / \text{Fuel}_{\text{current}}$ | $\Delta \text{Distance} / \text{Fuel}_{\text{previous}}$ |
| **Scenario A: Post-Trip Top-Up**<br>*(Previous fill: 35 L full tank; drove 10 km trip; added 0.45 L diesel)* | **$10\text{ km} / 0.45\text{ L} = 22.22\text{ km/L}$**<br>✅ **Realistic & Intuitive**: Accurately reflects trip efficiency. | **$10\text{ km} / 35.0\text{ L} = 0.29\text{ km/L}$**<br>❌ **Severe Distortion**: Reports ~0.3 km/L, alarming user with a false vehicle malfunction alarm. |
| **Scenario B: Commuting Routine**<br>*(Regular ₹1,000 / 10 L top-ups every ~180 km)* | **$180\text{ km} / 10\text{ L} = 18.00\text{ km/L}$**<br>✅ Immediate, stable, and accurate per segment. | **$180\text{ km} / 10\text{ L} = 18.00\text{ km/L}$**<br>✅ Produces identical result when fill amounts remain consistent. |
| **Scenario C: Token / Emergency Fill**<br>*(Drove 300 km highway; only added 5 L token fuel due to cash/time)* | **$300\text{ km} / 5\text{ L} = 60.00\text{ km/L}$**<br>⚠️ **Over-estimation**: The 5 L did not power all 300 km (tank level dropped). | **$300\text{ km} / 25\text{ L} = 12.00\text{ km/L}$**<br>✅ Closer to the actual burn rate of the earlier 25 L batch. |
| **User Mental Model** | Matches intuition: *"I just finished a drive and put in fuel to cover it."* | Disconnect: Divides today's odometer advance by fuel pumped days or weeks ago. |
| **Two-Wheeler / Bike Behavior** | Ideal for frequent small top-ups (e.g. ₹200 / 2 L after a 100 km ride = 50 km/L). | Causes massive volatility whenever fill volumes vary between visits. |
| **Impact on Official Statistics** | **0% impact**: Strictly marked `isEstimate: true`. Excluded from running averages. Full tank accumulation reconciles 100% of fuel. | **0% impact**: Strictly marked `isEstimate: true`. Excluded from running averages. |

### 4.2 Detailed Analysis of Formula 1 (Current Fuel Added — Active)

#### Advantages
- **Seamless Post-Trip Integration**: In DriveLedger's post-GPS trip workflow (where ending a trip prompts the user to add fuel with pre-filled odometer), Formula 1 immediately calculates the efficiency of the trip just completed.
- **Eliminates False Alarms**: A driver topping up after a short city trip never sees a disturbing 0.3 km/L or 0.5 km/L reading.
- **Intuitive Financial & Volume Tracking**: Users naturally correlate the amount of fuel pumped today with the driving done since their previous station visit.

#### Trade-offs & Mitigations
- *Trade-off*: When a driver drains half the tank over a long journey and adds only a tiny token fill, Formula 1 overestimates mileage for that single entry.
- *Mitigations in DriveLedger*:
  1. The entry is explicitly badged as an **Estimate** (`~` and `est.`).
  2. The Sanity & Reasonableness Engine ([`checkMileageReasonableness`](file:///home/hghosh/Desktop/CODING/DriveLedger/src/engine/mileageEngine.ts#L451-L480)) triggers a soft warning banner if the value exceeds normal physical thresholds (e.g., > 30 km/L for cars).
  3. The estimate is strictly excluded from vehicle averages.

### 4.3 Detailed Analysis of Formula 2 (Previous Fuel Added)

#### Advantages
- In scenarios where a vehicle is driven for hundreds of kilometers on a large fill before receiving an emergency top-up, Formula 2 divides that long distance by the large earlier fill, dampening the spike.

#### Disadvantages
- **Unacceptable Failure Mode on Short Trips**: Whenever a short trip occurs following a large or full fill, Formula 2 divides a small numerator by a huge denominator. For example, 10 km / 35 L = 0.285 km/L. This creates widespread user confusion and bug reports.
- **One-Cycle Lag**: Mileage estimates reflect the fuel quantity from the *previous* fill rather than the current refuel event, decoupling the user's current driving behavior from the displayed result.

### 4.4 Conclusion

DriveLedger implements **Formula 1 (Denominator = Current Fuel Added)** because it provides actionable, intuitive feedback for post-trip top-ups and daily commuting, while safeguards (estimate badging, reasonableness checks, and strict exclusion from official running averages) prevent data pollution.

---

## 5. Electric Vehicles (EV) — Charge-to-Charge

EVs do not have a full-tank cutoff constraint. Efficiency is calculated directly between consecutive charging sessions:

```text
Efficiency = (Current Odometer - Previous Odometer) / kWh Charged
```

- Function: [`calculateEVEfficiency()`](file:///home/hghosh/Desktop/CODING/DriveLedger/src/engine/mileageEngine.ts#L285-L310)
- Display Unit: `km/kWh`
- The first logged charge serves as the odometer baseline. Every subsequent charge computes efficiency.

---

## 6. Aggregated Statistics

Computed in [`computeMileageStats()`](file:///home/hghosh/Desktop/CODING/DriveLedger/src/engine/mileageEngine.ts#L315-L405):

1. **Last Fill Mileage**: Mileage value from the most recent full tank fill.
2. **Running Average**: Arithmetic mean of all valid calculated mileage entries for the vehicle.
3. **Monthly Average**: Average of calculated entries logged within the current calendar month (`getMonth()` + `getFullYear()`).
4. **Best / Worst**: Highest and lowest single tank-to-tank mileage recorded in history.

---

## 7. Sanity & Reasonableness Thresholds

To prevent typos (like entering an extra 0 in odometer or litres) from going unnoticed, [`checkMileageReasonableness()`](file:///home/hghosh/Desktop/CODING/DriveLedger/src/engine/mileageEngine.ts#L451-L480) evaluates values by vehicle type:

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

## 8. Dynamic Recalculation on Edit or Delete

If an earlier fuel entry is edited or deleted:
1. The odometer and fuel amounts in the chain change.
2. [`recalculateAllMileage()`](file:///home/hghosh/Desktop/CODING/DriveLedger/src/engine/mileageEngine.ts#L403-L440) runs automatically in [`fuelStore.ts`](file:///home/hghosh/Desktop/CODING/DriveLedger/src/stores/fuelStore.ts).
3. The engine iterates forward through all chronological entries and re-evaluates every interval and partial accumulation.
4. Updated mileage values are written back to SQLite and the UI refreshes immediately.
