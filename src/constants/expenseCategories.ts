/**
 * Expense Categories
 *
 * Non-fuel vehicle expense categories.
 * Fuel is tracked separately in the fuel_entries table.
 *
 * Matches the charter's expense category list.
 */

export interface ExpenseCategoryItem {
  id: string;
  name: string;
  icon: string;
}

export const EXPENSE_CATEGORIES: ExpenseCategoryItem[] = [
  { id: 'insurance', name: 'Insurance', icon: '🛡️' },
  { id: 'repair', name: 'Repair', icon: '🔧' },
  { id: 'tyres', name: 'Tyres', icon: '🛞' },
  { id: 'parking', name: 'Parking', icon: '🅿️' },
  { id: 'cleaning', name: 'Cleaning', icon: '🧽' },
  { id: 'fine', name: 'Fine / Challan', icon: '📋' },
  { id: 'accessories', name: 'Accessories', icon: '🎒' },
  { id: 'toll', name: 'Toll', icon: '🛣️' },
  { id: 'other', name: 'Other', icon: '📝' },
];

/** Array of category names for simple lookups */
export const EXPENSE_CATEGORY_LIST = EXPENSE_CATEGORIES.map((c) => c.name);

/**
 * Cost-breakdown chart bucket for each expense category id.
 *
 * Used by aggregateCostBreakdown() in statsHelpers.ts.
 * Centralised here so adding a new category only requires one file change:
 *   1. Add the category to EXPENSE_CATEGORIES above.
 *   2. Map it to the appropriate bucket below.
 *
 * Buckets:
 *   'insurance' — Insurance, fines, road tax, challans
 *   'repairs'   — Repairs and tyres
 *   'daily'     — Tolls, parking, cleaning, accessories
 *   'other'     — Everything else
 */
export type ExpenseChartBucket = 'insurance' | 'repairs' | 'daily' | 'other';

export const EXPENSE_CHART_BUCKET: Record<string, ExpenseChartBucket> = {
  insurance:   'insurance',
  fine:        'insurance',
  repair:      'repairs',
  tyres:       'repairs',
  toll:        'daily',
  parking:     'daily',
  cleaning:    'daily',
  accessories: 'daily',
  other:       'other',
};
