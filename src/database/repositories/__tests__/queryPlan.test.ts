import { resetMockDatabase } from '@/__mocks__/expo-sqlite';
import { getDatabase } from '@/database/connection';
import { createTables } from '@/database/schema';

describe('Evidence-Based Composite Indexes (P2)', () => {
  let db: any;

  beforeEach(() => {
    resetMockDatabase();
    db = getDatabase();
    createTables(db);
  });

  it('eliminates temp B-tree sorting for paginated active fuel queries', () => {
    const plan = db.getAllSync(`
      EXPLAIN QUERY PLAN
      SELECT * FROM fuel_entries
      WHERE vehicle_id = 'v1' AND deleted_at IS NULL
      ORDER BY date DESC, id DESC
      LIMIT 35
    `);

    const planDetails = plan.map((p: any) => p.detail).join(' ');
    expect(planDetails).toContain('USING INDEX idx_fuel_entries_active_date');
    expect(planDetails).not.toContain('USE TEMP B-TREE');
  });

  it('eliminates temp B-tree sorting for paginated active service queries', () => {
    const plan = db.getAllSync(`
      EXPLAIN QUERY PLAN
      SELECT * FROM service_records
      WHERE vehicle_id = 'v1' AND deleted_at IS NULL
      ORDER BY date DESC, id DESC
      LIMIT 35
    `);

    const planDetails = plan.map((p: any) => p.detail).join(' ');
    expect(planDetails).toContain('USING INDEX idx_service_records_active_date');
    expect(planDetails).not.toContain('USE TEMP B-TREE');
  });

  it('eliminates temp B-tree sorting for paginated active expense queries', () => {
    const plan = db.getAllSync(`
      EXPLAIN QUERY PLAN
      SELECT * FROM expenses
      WHERE vehicle_id = 'v1' AND deleted_at IS NULL
      ORDER BY date DESC, id DESC
      LIMIT 35
    `);

    const planDetails = plan.map((p: any) => p.detail).join(' ');
    expect(planDetails).toContain('USING INDEX idx_expenses_active_date');
    expect(planDetails).not.toContain('USE TEMP B-TREE');
  });

  it('eliminates temp B-tree sorting for paginated active trip queries', () => {
    const plan = db.getAllSync(`
      EXPLAIN QUERY PLAN
      SELECT * FROM trips
      WHERE vehicle_id = 'v1' AND deleted_at IS NULL
      ORDER BY start_time DESC, id DESC
      LIMIT 35
    `);

    const planDetails = plan.map((p: any) => p.detail).join(' ');
    expect(planDetails).toContain('USING INDEX idx_trips_active_time');
    expect(planDetails).not.toContain('USE TEMP B-TREE');
  });

  it('uses index for active documents by vehicle', () => {
    const plan = db.getAllSync(`
      EXPLAIN QUERY PLAN
      SELECT * FROM documents
      WHERE vehicle_id = 'v1' AND deleted_at IS NULL
    `);

    const planDetails = plan.map((p: any) => p.detail).join(' ');
    expect(planDetails).toContain('USING INDEX idx_documents_active_vehicle');
  });
});
