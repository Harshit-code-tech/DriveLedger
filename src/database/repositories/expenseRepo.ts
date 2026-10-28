/**
 * Expense Repository
 *
 * CRUD operations for the `expenses` table.
 * Non-fuel vehicle expenses only (fuel is tracked in fuel_entries).
 */

import { getDatabase } from '../connection';
import { buildSafeUpdate } from '../safeUpdate';
import { generateUUID } from '@/utils/uuid';
import { nowISO } from '@/utils/date';
import type { Expense, CreateExpenseInput, UpdateExpenseInput } from '@/types/expense';

// ─── CREATE ──────────────────────────────────────────────────────────

export function createExpense(input: CreateExpenseInput): Expense {
  const db = getDatabase();
  const now = nowISO();
  const id = generateUUID();

  const expense: Expense = {
    id,
    vehicle_id: input.vehicle_id,
    date: input.date,
    category: input.category,
    amount: input.amount,
    description: input.description ?? null,
    receipt_photo_uri: input.receipt_photo_uri ?? null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  db.runSync(
    `INSERT INTO expenses (
      id, vehicle_id, date, category, amount, description, receipt_photo_uri,
      created_at, updated_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      expense.id, expense.vehicle_id, expense.date, expense.category,
      expense.amount, expense.description, expense.receipt_photo_uri ?? null,
      expense.created_at, expense.updated_at, expense.deleted_at,
    ]
  );

  return expense;
}

// ─── READ ────────────────────────────────────────────────────────────

/**
 * Returns all non-deleted expenses for a vehicle, most recent first.
 */
export function getExpensesByVehicle(vehicleId: string): Expense[] {
  const db = getDatabase();
  return db.getAllSync<Expense>(
    `SELECT * FROM expenses
     WHERE vehicle_id = ? AND deleted_at IS NULL
     ORDER BY date DESC`,
    [vehicleId]
  );
}

/**
 * Returns a single expense by ID.
 */
export function getExpenseById(id: string): Expense | null {
  const db = getDatabase();
  return db.getFirstSync<Expense>(
    'SELECT * FROM expenses WHERE id = ? AND deleted_at IS NULL',
    [id]
  );
}

/**
 * Returns total expenses for a vehicle in a given month.
 * Used for dashboard "total spent this month" card.
 *
 * @param vehicleId - The vehicle UUID
 * @param yearMonth - Format: "2026-07" (YYYY-MM)
 * @returns Total amount spent (0 if no expenses)
 */
export function getMonthlyExpenseTotal(vehicleId: string, yearMonth: string): number {
  const db = getDatabase();
  const result = db.getFirstSync<{ total: number | null }>(
    `SELECT SUM(amount) as total FROM expenses
     WHERE vehicle_id = ? AND deleted_at IS NULL
     AND date LIKE ?`,
    [vehicleId, `${yearMonth}%`]
  );
  return result?.total ?? 0;
}

// ─── UPDATE ──────────────────────────────────────────────────────────

export function updateExpense(id: string, input: UpdateExpenseInput): Expense | null {
  const db = getDatabase();
  const now = nowISO();

  // Whitelist: only these columns can be updated
  const ALLOWED_COLUMNS = new Set([
    'date', 'category', 'amount', 'description', 'receipt_photo_uri',
  ]);

  const { fields, values } = buildSafeUpdate(input as Record<string, unknown>, ALLOWED_COLUMNS);

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  if (fields.length === 1) return getExpenseById(id);

  db.runSync(
    `UPDATE expenses SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  return getExpenseById(id);
}

// ─── DELETE (SOFT) ───────────────────────────────────────────────────

export function softDeleteExpense(id: string): void {
  const db = getDatabase();
  const now = nowISO();
  db.runSync(
    'UPDATE expenses SET deleted_at = ?, updated_at = ? WHERE id = ?',
    [now, now, id]
  );
}

export function restoreExpense(id: string): void {
  const db = getDatabase();
  const now = nowISO();
  db.runSync(
    'UPDATE expenses SET deleted_at = NULL, updated_at = ? WHERE id = ?',
    [now, id]
  );
}

// ─── TARGETED SQL AGGREGATES (P1.1) ──────────────────────────────────

export interface MonthlyExpenseAggregate {
  monthKey: string;
  expenseCost: number;
  expenseCount: number;
}

export interface VehicleExpenseAggregateSummary {
  totalCost: number;
  monthlyAggregates: Record<string, MonthlyExpenseAggregate>;
}

/**
 * Returns aggregated expense totals and monthly breakdown for a vehicle directly from SQLite.
 */
export function getVehicleExpenseAggregates(
  vehicleId: string,
  sinceMonthKey?: string
): VehicleExpenseAggregateSummary {
  const db = getDatabase();
  const totalRow = db.getFirstSync<{ total_cost: number | null }>(
    `SELECT COALESCE(SUM(amount), 0) AS total_cost
     FROM expenses
     WHERE vehicle_id = ? AND deleted_at IS NULL`,
    [vehicleId]
  );

  const monthlyQuery = sinceMonthKey
    ? `SELECT
         SUBSTR(date, 1, 7) AS month_key,
         COALESCE(SUM(amount), 0) AS expense_cost,
         COUNT(*) AS expense_count
       FROM expenses
       WHERE vehicle_id = ? AND deleted_at IS NULL AND SUBSTR(date, 1, 7) >= ?
       GROUP BY SUBSTR(date, 1, 7)`
    : `SELECT
         SUBSTR(date, 1, 7) AS month_key,
         COALESCE(SUM(amount), 0) AS expense_cost,
         COUNT(*) AS expense_count
       FROM expenses
       WHERE vehicle_id = ? AND deleted_at IS NULL
       GROUP BY SUBSTR(date, 1, 7)`;

  const params = sinceMonthKey ? [vehicleId, sinceMonthKey] : [vehicleId];
  const rows = db.getAllSync<{
    month_key: string;
    expense_cost: number;
    expense_count: number;
  }>(monthlyQuery, params);

  const monthlyAggregates: Record<string, MonthlyExpenseAggregate> = {};
  for (const r of rows) {
    monthlyAggregates[r.month_key] = {
      monthKey: r.month_key,
      expenseCost: r.expense_cost,
      expenseCount: r.expense_count,
    };
  }

  return {
    totalCost: totalRow?.total_cost ?? 0,
    monthlyAggregates,
  };
}

// ─── PAGINATION ───────────────────────────────────────────────────────

export interface PaginatedExpenseCursor {
  date: string;
  id: string;
}

export interface PaginatedExpenseOptions {
  limit?: number;
  cursor?: PaginatedExpenseCursor | null;
  startDate?: string | null;
  searchQuery?: string | null;
}

export interface PaginatedExpenseResult {
  items: Expense[];
  nextCursor: PaginatedExpenseCursor | null;
  hasMore: boolean;
  totalCount: number;
}

/**
 * Returns total non-deleted expenses count for a vehicle.
 */
export function getExpenseCount(vehicleId: string): number {
  const db = getDatabase();
  const res = db.getFirstSync<{ count: number }>(
    'SELECT COUNT(*) as count FROM expenses WHERE vehicle_id = ? AND deleted_at IS NULL',
    [vehicleId]
  );
  return res?.count ?? 0;
}

/**
 * Returns cursor-paginated expenses ordered by date DESC, id DESC.
 */
export function getPaginatedExpenses(
  vehicleId: string,
  options: PaginatedExpenseOptions = {}
): PaginatedExpenseResult {
  const db = getDatabase();
  const limit = Math.max(1, Math.min(options.limit ?? 35, 100));
  const conditions: string[] = ['vehicle_id = ?', 'deleted_at IS NULL'];
  const params: (string | number)[] = [vehicleId];

  if (options.startDate) {
    conditions.push('date >= ?');
    params.push(options.startDate);
  }

  if (options.searchQuery && options.searchQuery.trim()) {
    const q = `%${options.searchQuery.trim().toLowerCase()}%`;
    conditions.push(
      "(LOWER(category) LIKE ? OR LOWER(COALESCE(description, '')) LIKE ?)"
    );
    params.push(q, q);
  }

  const countRow = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) as count FROM expenses WHERE ${conditions.join(' AND ')}`,
    params
  );
  const totalCount = countRow?.count ?? 0;

  if (options.cursor) {
    conditions.push('(date < ? OR (date = ? AND id < ?))');
    params.push(options.cursor.date, options.cursor.date, options.cursor.id);
  }

  const query = `
    SELECT * FROM expenses
    WHERE ${conditions.join(' AND ')}
    ORDER BY date DESC, id DESC
    LIMIT ?
  `;
  params.push(limit + 1);

  const rows = db.getAllSync<Expense>(query, params);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const lastItem = items.length > 0 ? items[items.length - 1] : null;

  return {
    items,
    hasMore,
    nextCursor: lastItem ? { date: lastItem.date, id: lastItem.id } : null,
    totalCount,
  };
}

