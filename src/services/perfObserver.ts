/**
 * Lightweight Performance Observability Service
 *
 * Provides in-memory, zero-overhead diagnostic tracking for:
 * - SQLite query duration and rows returned
 * - Screen load / focus duration
 * - GPS batches (received, accepted, rejected, SQL write duration)
 * - Widget snapshot diffing and native updates
 * - Notification reconciliation duration and changed reminders
 * - Attachment sizes and compression outcomes
 *
 * Designed to be zero-cost in production (no-op when disabled / !__DEV__).
 * Uses a fixed-size circular buffer for bounded memory.
 */

export interface QueryMetric {
  operation: string;
  durationMs: number;
  rowCount?: number;
  timestamp: number;
}

export interface GpsBatchMetric {
  received: number;
  accepted: number;
  rejected: number;
  durationMs: number;
  timestamp: number;
}

export interface PerfSummary {
  queries: {
    count: number;
    totalDurationMs: number;
    avgDurationMs: number;
    slowQueries: QueryMetric[]; // queries > 16ms
  };
  gps: {
    totalBatches: number;
    totalReceived: number;
    totalAccepted: number;
    totalRejected: number;
    avgWriteDurationMs: number;
  };
  widgets: {
    totalEvaluations: number;
    snapshotsRendered: number;
    snapshotsSkippedIdentical: number;
  };
  notifications: {
    totalReconciliations: number;
    totalRemindersChanged: number;
    avgReconciliationDurationMs: number;
  };
  screenLoads: Record<string, { count: number; avgDurationMs: number }>;
}

const MAX_BUFFER_SIZE = 100;

class PerformanceObserver {
  private enabled: boolean = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
  private queryBuffer: QueryMetric[] = [];
  private gpsBuffer: GpsBatchMetric[] = [];
  private widgetStats = { total: 0, rendered: 0, skipped: 0 };
  private notifStats = { count: 0, changed: 0, totalDurationMs: 0 };
  private screenStats: Record<string, { count: number; totalMs: number }> = {};

  public setEnabled(enable: boolean): void {
    this.enabled = enable;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Tracks an SQLite query or batch operation.
   */
  public recordQuery(operation: string, durationMs: number, rowCount?: number): void {
    if (!this.enabled) return;
    if (this.queryBuffer.length >= MAX_BUFFER_SIZE) {
      this.queryBuffer.shift();
    }
    this.queryBuffer.push({
      operation,
      durationMs: Math.round(durationMs * 100) / 100,
      rowCount,
      timestamp: Date.now(),
    });
  }

  /**
   * Tracks a GPS batch persistence step.
   */
  public recordGpsBatch(
    received: number,
    accepted: number,
    rejected: number,
    durationMs: number
  ): void {
    if (!this.enabled) return;
    if (this.gpsBuffer.length >= MAX_BUFFER_SIZE) {
      this.gpsBuffer.shift();
    }
    this.gpsBuffer.push({
      received,
      accepted,
      rejected,
      durationMs: Math.round(durationMs * 100) / 100,
      timestamp: Date.now(),
    });
  }

  /**
   * Tracks widget snapshot comparison.
   */
  public recordWidgetSync(renderedNativeUpdate: boolean): void {
    if (!this.enabled) return;
    this.widgetStats.total++;
    if (renderedNativeUpdate) {
      this.widgetStats.rendered++;
    } else {
      this.widgetStats.skipped++;
    }
  }

  /**
   * Tracks notification reconciliation cycle.
   */
  public recordNotificationReconciliation(changedCount: number, durationMs: number): void {
    if (!this.enabled) return;
    this.notifStats.count++;
    this.notifStats.changed += changedCount;
    this.notifStats.totalDurationMs += durationMs;
  }

  /**
   * Tracks screen load duration.
   */
  public recordScreenLoad(screenName: string, durationMs: number): void {
    if (!this.enabled) return;
    if (!this.screenStats[screenName]) {
      this.screenStats[screenName] = { count: 0, totalMs: 0 };
    }
    this.screenStats[screenName].count++;
    this.screenStats[screenName].totalMs += durationMs;
  }

  /**
   * Measures the execution time of a synchronous or asynchronous function.
   */
  public async timeAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    onComplete?: (result: T, durationMs: number) => void
  ): Promise<T> {
    if (!this.enabled) return fn();
    const start = performance.now();
    try {
      const result = await fn();
      const durationMs = performance.now() - start;
      if (onComplete) onComplete(result, durationMs);
      return result;
    } catch (err) {
      const durationMs = performance.now() - start;
      this.recordQuery(`${operation} [ERROR]`, durationMs);
      throw err;
    }
  }

  /**
   * Generates a snapshot summary of current performance telemetry.
   */
  public getSummary(): PerfSummary {
    const totalQueryDuration = this.queryBuffer.reduce((sum, q) => sum + q.durationMs, 0);
    const avgQueryDuration =
      this.queryBuffer.length > 0
        ? Math.round((totalQueryDuration / this.queryBuffer.length) * 100) / 100
        : 0;

    const slowQueries = this.queryBuffer.filter((q) => q.durationMs > 16);

    const totalGpsReceived = this.gpsBuffer.reduce((sum, g) => sum + g.received, 0);
    const totalGpsAccepted = this.gpsBuffer.reduce((sum, g) => sum + g.accepted, 0);
    const totalGpsRejected = this.gpsBuffer.reduce((sum, g) => sum + g.rejected, 0);
    const totalGpsDuration = this.gpsBuffer.reduce((sum, g) => sum + g.durationMs, 0);
    const avgGpsDuration =
      this.gpsBuffer.length > 0
        ? Math.round((totalGpsDuration / this.gpsBuffer.length) * 100) / 100
        : 0;

    const screenSummary: Record<string, { count: number; avgDurationMs: number }> = {};
    for (const [name, stats] of Object.entries(this.screenStats)) {
      screenSummary[name] = {
        count: stats.count,
        avgDurationMs: stats.count > 0 ? Math.round((stats.totalMs / stats.count) * 100) / 100 : 0,
      };
    }

    return {
      queries: {
        count: this.queryBuffer.length,
        totalDurationMs: Math.round(totalQueryDuration * 100) / 100,
        avgDurationMs: avgQueryDuration,
        slowQueries,
      },
      gps: {
        totalBatches: this.gpsBuffer.length,
        totalReceived: totalGpsReceived,
        totalAccepted: totalGpsAccepted,
        totalRejected: totalGpsRejected,
        avgWriteDurationMs: avgGpsDuration,
      },
      widgets: {
        totalEvaluations: this.widgetStats.total,
        snapshotsRendered: this.widgetStats.rendered,
        snapshotsSkippedIdentical: this.widgetStats.skipped,
      },
      notifications: {
        totalReconciliations: this.notifStats.count,
        totalRemindersChanged: this.notifStats.changed,
        avgReconciliationDurationMs:
          this.notifStats.count > 0
            ? Math.round((this.notifStats.totalDurationMs / this.notifStats.count) * 100) / 100
            : 0,
      },
      screenLoads: screenSummary,
    };
  }

  /**
   * Resets all collected telemetry metrics.
   */
  public reset(): void {
    this.queryBuffer = [];
    this.gpsBuffer = [];
    this.widgetStats = { total: 0, rendered: 0, skipped: 0 };
    this.notifStats = { count: 0, changed: 0, totalDurationMs: 0 };
    this.screenStats = {};
  }
}

export const perfObserver = new PerformanceObserver();
