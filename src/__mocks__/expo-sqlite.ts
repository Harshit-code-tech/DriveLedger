// @ts-nocheck
import { DatabaseSync } from 'node:sqlite';

class MockSQLiteDatabase {
  private rawDb: DatabaseSync;
  private spCounter = 0;

  constructor() {
    this.rawDb = new DatabaseSync(':memory:');
  }

  execSync(sql: string): void {
    this.rawDb.exec(sql);
  }

  runSync(sql: string, params: any[] = []): { changes: number; lastInsertRowId: number } {
    const stmt = this.rawDb.prepare(sql);
    const result = stmt.run(...params);
    return {
      changes: Number(result.changes),
      lastInsertRowId: Number(result.lastInsertRowid),
    };
  }

  getFirstSync<T = any>(sql: string, params: any[] = []): T | null {
    const stmt = this.rawDb.prepare(sql);
    const row = stmt.get(...params) as T | undefined;
    return row ?? null;
  }

  getAllSync<T = any>(sql: string, params: any[] = []): T[] {
    const stmt = this.rawDb.prepare(sql);
    return stmt.all(...params) as T[];
  }

  withTransactionSync<T>(callback: () => T): T {
    const sp = `sp_${++this.spCounter}`;
    this.rawDb.exec(`SAVEPOINT ${sp};`);
    try {
      const result = callback();
      this.rawDb.exec(`RELEASE SAVEPOINT ${sp};`);
      return result;
    } catch (error) {
      this.rawDb.exec(`ROLLBACK TO SAVEPOINT ${sp};`);
      this.rawDb.exec(`RELEASE SAVEPOINT ${sp};`);
      throw error;
    }
  }

  reset(): void {
    try {
      this.rawDb.close();
    } catch {
      // ignore
    }
    this.rawDb = new DatabaseSync(':memory:');
    this.spCounter = 0;
  }
}

let activeDb: MockSQLiteDatabase | null = null;

export function openDatabaseSync(_dbName: string): any {
  if (!activeDb) {
    activeDb = new MockSQLiteDatabase();
  }
  return activeDb;
}

export function resetMockDatabase(): void {
  if (activeDb) {
    activeDb.reset();
  }
}
