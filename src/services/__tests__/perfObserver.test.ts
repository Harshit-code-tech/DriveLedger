import { perfObserver } from '../perfObserver';

describe('PerformanceObserver Service (P2)', () => {
  beforeEach(() => {
    perfObserver.setEnabled(true);
    perfObserver.reset();
  });

  afterEach(() => {
    perfObserver.reset();
  });

  it('records queries and identifies slow queries (>16ms)', () => {
    perfObserver.recordQuery('SELECT fast', 2.5, 10);
    perfObserver.recordQuery('SELECT slow', 25.4, 500);

    const summary = perfObserver.getSummary();
    expect(summary.queries.count).toBe(2);
    expect(summary.queries.slowQueries.length).toBe(1);
    expect(summary.queries.slowQueries[0].operation).toBe('SELECT slow');
    expect(summary.queries.avgDurationMs).toBeCloseTo(13.95, 1);
  });

  it('tracks GPS batch metrics (received, accepted, rejected)', () => {
    perfObserver.recordGpsBatch(10, 8, 2, 4.2);
    perfObserver.recordGpsBatch(5, 5, 0, 2.1);

    const summary = perfObserver.getSummary();
    expect(summary.gps.totalBatches).toBe(2);
    expect(summary.gps.totalReceived).toBe(15);
    expect(summary.gps.totalAccepted).toBe(13);
    expect(summary.gps.totalRejected).toBe(2);
    expect(summary.gps.avgWriteDurationMs).toBeCloseTo(3.15, 1);
  });

  it('tracks widget evaluations and skipped identical updates', () => {
    perfObserver.recordWidgetSync(true); // rendered
    perfObserver.recordWidgetSync(false); // skipped identical
    perfObserver.recordWidgetSync(false); // skipped identical

    const summary = perfObserver.getSummary();
    expect(summary.widgets.totalEvaluations).toBe(3);
    expect(summary.widgets.snapshotsRendered).toBe(1);
    expect(summary.widgets.snapshotsSkippedIdentical).toBe(2);
  });

  it('tracks notification reconciliation metrics', () => {
    perfObserver.recordNotificationReconciliation(3, 15.0);
    perfObserver.recordNotificationReconciliation(0, 5.0);

    const summary = perfObserver.getSummary();
    expect(summary.notifications.totalReconciliations).toBe(2);
    expect(summary.notifications.totalRemindersChanged).toBe(3);
    expect(summary.notifications.avgReconciliationDurationMs).toBe(10);
  });

  it('tracks screen load times by screen name', () => {
    perfObserver.recordScreenLoad('HistoryScreen', 45);
    perfObserver.recordScreenLoad('HistoryScreen', 15);
    perfObserver.recordScreenLoad('DashboardScreen', 20);

    const summary = perfObserver.getSummary();
    expect(summary.screenLoads['HistoryScreen'].count).toBe(2);
    expect(summary.screenLoads['HistoryScreen'].avgDurationMs).toBe(30);
    expect(summary.screenLoads['DashboardScreen'].avgDurationMs).toBe(20);
  });

  it('is a no-op when disabled', () => {
    perfObserver.setEnabled(false);
    perfObserver.recordQuery('SELECT ignored', 10);
    perfObserver.recordGpsBatch(10, 10, 0, 5);

    const summary = perfObserver.getSummary();
    expect(summary.queries.count).toBe(0);
    expect(summary.gps.totalBatches).toBe(0);
  });
});
