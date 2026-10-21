/**
 * Expense Types
 *
 * TypeScript interface for the `expenses` table.
 * Matches the charter's database schema.
 *
 * NOTE: Fuel expenses are tracked separately in fuel_entries.
 * This table is for non-fuel vehicle expenses only.
 */

// ─── Full Database Row ───────────────────────────────────────────────
export type VehicleExpense = Expense;
export interface Expense {
  /** Primary key — UUID v4 */
  id: string;

  /** FK → vehicles.id */
  vehicle_id: string;

  /** Date of the expense. ISO 8601 string. */
  date: string;

  /** Expense category from the predefined list */
  category: string;

  /** Amount spent. Must be > 0. */
  amount: number;

  /** Free-text description (optional) */
  description: string | null;

  /** URI to receipt photo or invoice document (optional) */
  receipt_photo_uri?: string | null;

  /** ISO 8601 timestamp */
  created_at: string;

  /** ISO 8601 timestamp */
  updated_at: string;

  /** ISO 8601 timestamp — soft delete marker. NULL = not deleted. */
  deleted_at: string | null;
}

// ─── Create Input ────────────────────────────────────────────────────
export interface CreateExpenseInput {
  vehicle_id: string;
  date: string;
  category: string;
  amount: number;

  // Optional
  description?: string;
  receipt_photo_uri?: string;
}

// ─── Update Input ────────────────────────────────────────────────────
export type UpdateExpenseInput = Partial<
  Omit<Expense, 'id' | 'vehicle_id' | 'created_at' | 'updated_at' | 'deleted_at'>
>;

