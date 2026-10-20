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
