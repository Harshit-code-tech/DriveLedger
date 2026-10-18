/**
 * Expense Store (Zustand)
 *
 * Global state for expense data.
 * Connects the UI layer to the expenseRepo.
 *
 * KEY FEATURES:
 * - CRUD operations for expenses
 * - Monthly total computation for dashboard
 * - Total expense computation for stats
 */

import { create } from 'zustand';
import { Platform } from 'react-native';
import type { Expense, CreateExpenseInput, UpdateExpenseInput } from '@/types/expense';
import * as expenseRepo from '@/database/repositories/expenseRepo';
import { syncWidgetState } from '@/widgets/widgetDataService';

interface ExpenseState {
  /** Expenses for the currently selected vehicle */
  expenses: Expense[];
  /** Loading state */
  isLoading: boolean;

  // ── Actions ──
  /** Load expenses for a vehicle */
  loadExpenses: (vehicleId: string) => void;
  /** Create a new expense */
  addExpense: (input: CreateExpenseInput) => Expense;
  /** Update an existing expense */
  editExpense: (id: string, input: UpdateExpenseInput) => Expense | null;
  /** Delete an expense (soft delete) */
  deleteExpense: (id: string) => void;
}

export const useExpenseStore = create<ExpenseState>((set) => ({
  expenses: [],
  isLoading: true,

  loadExpenses: (vehicleId: string) => {
    const expenses = expenseRepo.getExpensesByVehicle(vehicleId);
    set({ expenses, isLoading: false });
  },

  addExpense: (input: CreateExpenseInput) => {
    const expense = expenseRepo.createExpense(input);
    const expenses = expenseRepo.getExpensesByVehicle(input.vehicle_id);
    set({ expenses });
    if (Platform.OS === 'android') syncWidgetState();
    return expense;
  },

  editExpense: (id: string, input: UpdateExpenseInput) => {
    const updated = expenseRepo.updateExpense(id, input);
    if (updated) {
      const expenses = expenseRepo.getExpensesByVehicle(updated.vehicle_id);
      set({ expenses });
      if (Platform.OS === 'android') syncWidgetState();
    }
    return updated;
  },

  deleteExpense: (id: string) => {
    const expense = expenseRepo.getExpenseById(id);
    expenseRepo.softDeleteExpense(id);
    if (expense) {
      const expenses = expenseRepo.getExpensesByVehicle(expense.vehicle_id);
      set({ expenses });
      if (Platform.OS === 'android') syncWidgetState();
    }
  },
}));

// ─── Computed Helpers ────────────────────────────────────────────────

/**
 * Computes total expenses for the current calendar month.
 */
export function getMonthlyExpenseTotal(expenses: Expense[]): number {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  return expenses
    .filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() === month && d.getFullYear() === year;
    })
    .reduce((sum, e) => sum + e.amount, 0);
}
