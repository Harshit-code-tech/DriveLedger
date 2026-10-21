/**
 * Smart Maintenance Insights Engine (Pure Logic)
 *
 * Evaluates vehicle maintenance health, mileage anomalies, repeated repairs,
 * and cost patterns using locally stored records.
 *
 * DESIGN PRINCIPLES:
 * 1. 100% deterministic, transparent rules (no cloud, no remote AI, no guesswork).
 * 2. Observations, NOT diagnoses: never claims statistical observations prove mechanical failure.
 * 3. Never alarms users on a single isolated reading or insufficient history.
 * 4. Recalculates dynamically when records are created, edited, or deleted.
 */

import type { Vehicle } from '@/types/vehicle';
import type { FuelEntry } from '@/types/fuel';
import type { ServiceRecord, MaintenanceProfile, ProfileDueStatus } from '@/types/service';
import type { Expense } from '@/types/expense';
import { computeMileageStats, type MileageStats } from '@/engine/mileageEngine';
import { daysUntil } from '@/utils/date';

export type InsightSeverity = 'critical' | 'warning' | 'info' | 'positive';

export interface InsightItem {
  id: string;
  type:
    | 'maintenance_due'
    | 'maintenance_overdue'
    | 'component_target'
    | 'repeated_repair'
    | 'mileage_anomaly'
    | 'cost_surge'
    | 'fuel_spending_surge'
    | 'category_concentration'
    | 'data_anomaly'
    | 'all_clear';
  title: string;
  severity: InsightSeverity;
  reason: string;
  details?: {
    date?: string;
    odometer?: number;
    cost?: number;
    distance?: number;
    delta?: number;
    unit?: string;
    componentName?: string;
    count?: number;
  };
  suggestedAction: string;
  actionRoute?: string;
  actionParams?: Record<string, string>;
}

export interface InsightsEvaluationResult {
  insights: InsightItem[];
  hasInsufficientData: boolean;
  activeIssuesCount: number;
  summaryMessage: string;
}

// ─── Rule Checkers ───────────────────────────────────────────────────

/**
 * 1. Checks vehicle-level service due status (km and months).
 */
function checkVehicleServiceDue(
  vehicle: Vehicle,
  latestService: ServiceRecord | null
): InsightItem | null {
  if (!vehicle.service_interval_km && !vehicle.service_interval_months) {
    return null;
  }

  const currentOdo = vehicle.current_odometer ?? 0;
  const lastOdo = latestService?.odometer ?? 0;
  const lastDate = latestService?.date;

  let kmRemaining: number | null = null;
  if (latestService?.next_due_km) {
    kmRemaining = latestService.next_due_km - currentOdo;
  } else if (vehicle.service_interval_km && lastOdo > 0) {
    kmRemaining = lastOdo + vehicle.service_interval_km - currentOdo;
  }

  let daysRemaining: number | null = null;
  if (latestService?.next_due_date) {
    daysRemaining = daysUntil(latestService.next_due_date);
  } else if (vehicle.service_interval_months && lastDate) {
    const d = new Date(lastDate);
    d.setMonth(d.getMonth() + Math.round(vehicle.service_interval_months));
    const targetISO = d.toISOString().split('T')[0];
    daysRemaining = daysUntil(targetISO);
  }

  const isKmOverdue = kmRemaining !== null && kmRemaining <= 0;
  const isTimeOverdue = daysRemaining !== null && daysRemaining <= 0;
  const isKmDueSoon = kmRemaining !== null && kmRemaining <= 1000;
  const isTimeDueSoon = daysRemaining !== null && daysRemaining <= 30;

  if (isKmOverdue || isTimeOverdue) {
    const overdueDetails = [
      kmRemaining !== null && kmRemaining <= 0 ? `${Math.abs(Math.round(kmRemaining))} km` : null,
      daysRemaining !== null && daysRemaining <= 0 ? `${Math.abs(daysRemaining)} days` : null,
    ]
      .filter(Boolean)
      .join(' and ');

    return {
      id: `svc-overdue-${vehicle.id}`,
      type: 'maintenance_overdue',
      title: 'Scheduled Vehicle Service Overdue',
      severity: 'critical',
      reason: `Scheduled maintenance is overdue by ${overdueDetails}. Regular service preserves engine reliability and fuel economy.`,
      details: {
        odometer: currentOdo,
        distance: kmRemaining ? Math.abs(kmRemaining) : undefined,
      },
      suggestedAction: 'Schedule a service appointment and record the completed work.',
      actionRoute: '/add-service',
      actionParams: { vehicleId: vehicle.id },
    };
  }

  if (isKmDueSoon || isTimeDueSoon) {
    const dueDetails = [
      kmRemaining !== null ? `${Math.round(kmRemaining)} km` : null,
      daysRemaining !== null ? `${daysRemaining} days` : null,
    ]
      .filter(Boolean)
      .join(' or ');

    return {
      id: `svc-due-${vehicle.id}`,
      type: 'maintenance_due',
      title: 'Scheduled Service Due Soon',
      severity: 'warning',
      reason: `Vehicle service is approaching within ${dueDetails} based on your configured interval.`,
      details: {
        odometer: currentOdo,
        distance: kmRemaining ?? undefined,
      },
      suggestedAction: 'Plan your next service visit before reaching the target interval.',
      actionRoute: '/add-service',
      actionParams: { vehicleId: vehicle.id },
    };
  }

  return null;
}

/**
 * 2. Checks component-specific maintenance targets / profiles.
 */
function checkComponentProfiles(
  profileStatuses: ProfileDueStatus[]
): InsightItem[] {
  const items: InsightItem[] = [];

  for (const item of profileStatuses) {
    if (item.status === 'overdue') {
      items.push({
        id: `profile-overdue-${item.profile.id}`,
        type: 'component_target',
        title: `${item.profile.component_name} Target Exceeded`,
        severity: 'critical',
        reason: item.subtext,
        details: {
          componentName: item.profile.component_name,
          distance: item.kmRemaining ? Math.abs(item.kmRemaining) : undefined,
        },
        suggestedAction: `Inspect or replace ${item.profile.component_name} to maintain optimal vehicle performance.`,
        actionRoute: '/add-service',
      });
    } else if (item.status === 'due_soon') {
      items.push({
        id: `profile-due-${item.profile.id}`,
        type: 'component_target',
        title: `${item.profile.component_name} Due Soon`,
        severity: 'warning',
        reason: item.subtext,
        details: {
          componentName: item.profile.component_name,
          distance: item.kmRemaining ?? undefined,
        },
        suggestedAction: `Check condition of ${item.profile.component_name} in your upcoming vehicle inspection.`,
        actionRoute: '/add-service',
      });
    }
  }

  return items;
}

/**
 * 3. Detects repeated repairs on the same component within a short span.
 * (e.g., 2+ repairs for same part within 5,000 km or 180 days).
 */
function checkRepeatedRepairs(
  serviceRecords: ServiceRecord[],
  vehicleId: string
): InsightItem[] {
  const items: InsightItem[] = [];
  if (serviceRecords.length < 2) return items;

  // Group by common repair keywords or work_done parts
  const COMMON_PARTS = [
    'Brake Pad',
    'Battery',
    'Clutch',
    'Alternator',
    'Suspension',
    'Starter Motor',
    'Fuel Pump',
    'Tyre',
  ];

  for (const part of COMMON_PARTS) {
    const matches = serviceRecords.filter((s) => {
      const text = `${s.service_type} ${s.work_done ?? ''} ${s.notes ?? ''}`.toLowerCase();
      return text.includes(part.toLowerCase());
    });

    if (matches.length >= 2) {
      // Sort newest first
      matches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const r1 = matches[0];
      const r2 = matches[1];

      const daysApart = Math.abs(
        Math.round((new Date(r1.date).getTime() - new Date(r2.date).getTime()) / (1000 * 60 * 60 * 24))
      );
      const kmApart =
        r1.odometer != null && r2.odometer != null
          ? Math.abs(r1.odometer - r2.odometer)
          : null;

      if ((kmApart !== null && kmApart <= 5000) || daysApart <= 180) {
        const intervalDesc = kmApart !== null ? `${kmApart} km` : `${daysApart} days`;
        items.push({
          id: `repeat-repair-${part}-${vehicleId}`,
          type: 'repeated_repair',
          title: `Repeated Repair: ${part}`,
          reason: `Recorded maintenance notes show ${part} was serviced or replaced twice within ${intervalDesc} (${r2.date} and ${r1.date}).`,
          severity: 'warning',
          details: {
            componentName: part,
            count: matches.length,
            distance: kmApart ?? undefined,
          },
          suggestedAction: `Check if an underlying root cause (e.g. caliper sticking, electrical leak, alignment) is causing premature wear on ${part}.`,
        });
      }
    }
  }

  return items;
}

/**
 * 4. Mileage Anomaly Detection (A2)
 *
 * Compares completed, valid intervals with vehicle baseline.
 * Avoids alarming users on a single isolated reading or partial fills.
 */
function checkMileageAnomaly(
  entries: FuelEntry[],
  mileageStats: MileageStats
): InsightItem | null {
  // Filter to valid completed full-tank entries with calculated mileage
  const fullTankEntries = entries
    .filter((e) => e.is_full_tank === 1 && e.calculated_mileage != null && e.calculated_mileage > 0)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Require at least 4 full-tank entries (minimum 3 completed intervals)
  if (fullTankEntries.length < 4) {
    return null;
  }

  const rawAvg = mileageStats.runningAverage as unknown;
  const baselineAvg =
    typeof rawAvg === 'number'
      ? rawAvg
      : (rawAvg as { value?: number })?.value ?? null;
  if (!baselineAvg || baselineAvg <= 0) return null;

  // Inspect the last 3 completed intervals
  const recentThree = fullTankEntries.slice(-3);
  const recentValues = recentThree.map((e) => e.calculated_mileage!);

  // Check if ALL recent 3 values are > 18% below the baseline average
  const threshold = baselineAvg * 0.82;
  const isSustainedDrop = recentValues.every((v) => v < threshold);

  if (isSustainedDrop) {
    const recentAvg = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    const dropPercent = Math.round(((baselineAvg - recentAvg) / baselineAvg) * 100);
    const unit = recentThree[0].mileage_unit ?? 'km/L';

    return {
      id: `mileage-drop-${recentThree[0].vehicle_id}`,
      type: 'mileage_anomaly',
      title: 'Observed Decrease in Fuel Mileage',
      severity: 'warning',
      reason: `Recorded mileage has averaged ${recentAvg.toFixed(1)} ${unit} across your last three completed fill-ups, approximately ${dropPercent}% below your recorded baseline of ${baselineAvg.toFixed(1)} ${unit}.`,
      details: {
        delta: dropPercent,
        unit,
      },
      suggestedAction:
        'Recorded mileage has decreased across three completed intervals compared with your recent baseline. Review your recent entries and check tyre pressure or driving conditions if the pattern continues.',
      actionRoute: '/(tabs)/history',
    };
  }

  return null;
}

/**
 * 5. Cost Patterns & Spending Surges (A3)
 */
function checkCostPatterns(
  fuelEntries: FuelEntry[],
  serviceRecords: ServiceRecord[],
  expenses: Expense[]
): InsightItem[] {
  const items: InsightItem[] = [];
  const now = new Date();

  // A. Maintenance spending increase in recent 3 months vs prior 3 months
  const nowMs = now.getTime();
  const ms30d = 30 * 24 * 60 * 60 * 1000;
  const ms90d = 90 * 24 * 60 * 60 * 1000;
  const ms180d = 180 * 24 * 60 * 60 * 1000;

  const recentServicesCost = serviceRecords
    .filter((s) => {
      const t = new Date(s.date).getTime();
      return nowMs - t <= ms90d;
    })
    .reduce((sum, s) => sum + (s.cost || 0), 0);

  const priorServicesCost = serviceRecords
    .filter((s) => {
      const t = new Date(s.date).getTime();
      return nowMs - t > ms90d && nowMs - t <= ms180d;
    })
    .reduce((sum, s) => sum + (s.cost || 0), 0);

  if (priorServicesCost > 2000 && recentServicesCost > priorServicesCost * 2) {
    items.push({
      id: 'cost-surge-maintenance',
      type: 'cost_surge',
      title: 'Increased Maintenance Expenditure',
      severity: 'info',
      reason: `Maintenance spending over the last 90 days (₹${Math.round(recentServicesCost).toLocaleString('en-IN')}) is more than double the prior 90-day period (₹${Math.round(priorServicesCost).toLocaleString('en-IN')}).`,
      details: { cost: recentServicesCost },
      suggestedAction: 'Review your recent service history to monitor repair costs and warranty coverage.',
      actionRoute: '/(tabs)/stats',
    });
  }

  // B. Disproportionate Expense Category Concentration (> 60% of non-fuel expenses)
  if (expenses.length >= 3) {
    const totalExp = expenses.reduce((sum, e) => sum + e.amount, 0);
    const byCategory: Record<string, number> = {};
    for (const e of expenses) {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    }

    for (const [cat, amt] of Object.entries(byCategory)) {
      if (totalExp > 3000 && amt / totalExp >= 0.6) {
        items.push({
          id: `cost-cat-${cat}`,
          type: 'category_concentration',
          title: `High Spending in "${cat}"`,
          severity: 'info',
          reason: `${cat} accounts for ${Math.round((amt / totalExp) * 100)}% (₹${Math.round(amt).toLocaleString('en-IN')}) of total non-fuel expenses on record.`,
          details: { cost: amt },
          suggestedAction: 'Inspect itemized expenses to evaluate upcoming recurring costs.',
          actionRoute: '/(tabs)/stats',
        });
        break; // Only report top category
      }
    }
  }

  return items;
}

/**
 * 6. Data Integrity / Odometer Inconsistencies
 */
function checkDataIntegrity(
  fuelEntries: FuelEntry[],
  serviceRecords: ServiceRecord[]
): InsightItem[] {
  const items: InsightItem[] = [];

  // Sort chronological by date
  const sortedFuel = [...fuelEntries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (let i = 1; i < sortedFuel.length; i++) {
    const prev = sortedFuel[i - 1];
    const curr = sortedFuel[i];
    if (curr.odometer < prev.odometer) {
      items.push({
        id: `odo-drop-${curr.id}`,
        type: 'data_anomaly',
        title: 'Odometer Reading Inconsistency',
        severity: 'warning',
        reason: `Fill-up on ${curr.date} has odometer reading ${curr.odometer.toLocaleString('en-IN')} km, which is lower than earlier entry on ${prev.date} (${prev.odometer.toLocaleString('en-IN')} km).`,
        details: {
          odometer: curr.odometer,
        },
        suggestedAction: 'Review and correct the odometer value in your fuel history to ensure accurate mileage metrics.',
        actionRoute: '/(tabs)/history',
      });
      break; // Report the first chronological conflict
    }
  }

  return items;
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Evaluates all smart insights for a vehicle given current database state.
 */
export function evaluateVehicleInsights(params: {
  vehicle: Vehicle;
  fuelEntries: FuelEntry[];
  serviceRecords: ServiceRecord[];
  expenses: Expense[];
  mileageStats: MileageStats;
  profileStatuses?: ProfileDueStatus[];
}): InsightsEvaluationResult {
  const {
    vehicle,
    fuelEntries,
    serviceRecords,
    expenses,
    mileageStats,
    profileStatuses = [],
  } = params;

  const insights: InsightItem[] = [];

  // Check 1: Vehicle service due/overdue
  const svcDue = checkVehicleServiceDue(
    vehicle,
    serviceRecords.length > 0 ? serviceRecords[0] : null
  );
  if (svcDue) insights.push(svcDue);

  // Check 2: Component-specific targets & profiles
  const profileInsights = checkComponentProfiles(profileStatuses);
  insights.push(...profileInsights);

  // Check 3: Repeated repairs
  const repeatedRepairs = checkRepeatedRepairs(serviceRecords, vehicle.id);
  insights.push(...repeatedRepairs);

  // Check 4: Mileage anomaly
  const mileageAnomaly = checkMileageAnomaly(fuelEntries, mileageStats);
  if (mileageAnomaly) insights.push(mileageAnomaly);

  // Check 5: Cost patterns & spending surges
  const costInsights = checkCostPatterns(fuelEntries, serviceRecords, expenses);
  insights.push(...costInsights);

  // Check 6: Data integrity
  const dataAnomalies = checkDataIntegrity(fuelEntries, serviceRecords);
  insights.push(...dataAnomalies);

  // Prioritize critical > warning > info > positive
  const severityOrder: Record<InsightSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
    positive: 3,
  };
  insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const totalRecords = fuelEntries.length + serviceRecords.length + expenses.length;
  const hasInsufficientData = totalRecords < 2;

  // Summary message
  let summaryMessage = '';
  if (hasInsufficientData) {
    summaryMessage =
      'More records are needed to compute mileage trends and cost patterns. Log your next fuel or service entry to unlock deeper insights.';
  } else if (insights.length === 0) {
    summaryMessage =
      'No issues detected across available records. Note: this reflects recorded data patterns, not a mechanical vehicle inspection.';
  } else {
    const criticalCount = insights.filter((i) => i.severity === 'critical').length;
    const warningCount = insights.filter((i) => i.severity === 'warning').length;
    summaryMessage = `${criticalCount + warningCount} active observation${criticalCount + warningCount === 1 ? '' : 's'} require your review.`;
  }

  return {
    insights,
    hasInsufficientData,
    activeIssuesCount: insights.filter(
      (i) => i.severity === 'critical' || i.severity === 'warning'
    ).length,
    summaryMessage,
  };
}

export interface VehicleInsight {
  id: string;
  type: InsightItem['type'];
  title: string;
  severity: InsightSeverity;
  description: string;
  metricValue?: string | number;
  relatedDate?: string;
  costImpact?: number;
  suggestedAction: string;
}

/**
 * Convenient wrapper to generate all proactive vehicle insights directly.
 */
export function generateVehicleInsights(
  vehicle: Vehicle,
  fuelEntries: FuelEntry[],
  serviceRecords: ServiceRecord[],
  expenses: Expense[],
  profiles?: MaintenanceProfile[],
  profileStatuses?: ProfileDueStatus[]
): VehicleInsight[] {
  const mileageStats = computeMileageStats(fuelEntries, vehicle.fuel_type);
  const evaluation = evaluateVehicleInsights({
    vehicle,
    fuelEntries,
    serviceRecords,
    expenses,
    mileageStats,
    profileStatuses,
  });

  return evaluation.insights.map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    severity: item.severity,
    description: item.reason,
    metricValue:
      item.details?.odometer ?? item.details?.distance ?? item.details?.delta,
    relatedDate: item.details?.date,
    costImpact: item.details?.cost,
    suggestedAction: item.suggestedAction,
  }));
}
