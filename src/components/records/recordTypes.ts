/**
 * DriveLedger — Records Types
 *
 * Domain types for the Records page redesign defined in docs/refurnish/record.md.
 */

import type { FuelEntry } from '@/types/fuel';
import type { ServiceRecord, MaintenanceComponent } from '@/types/service';
import type { Expense } from '@/types/expense';
import type { Trip } from '@/types/trip';

export type RecordCategory = 'all' | 'fuel' | 'service' | 'expenses' | 'trips';

export type DateRangeOption = 'all' | 'week' | 'month' | '30days' | '3months' | 'year';

export type SortOrder = 'newest' | 'oldest';

export type RecordItemType = 'fuel' | 'service' | 'expense' | 'trip';

export interface RecordItem {
  id: string;
  type: RecordItemType;
  date: string; // ISO date string YYYY-MM-DD
  timestamp: number; // for chronological sorting
  title: string;
  subtitle: string;
  primaryValue: string;
  secondaryValue?: string;
  icon: string;
  raw: FuelEntry | ServiceRecord | Expense | Trip;
  components?: MaintenanceComponent[];
}

export interface RecordSection {
  title: string; // e.g. "NOVEMBER 2026"
  monthKey: string; // e.g. "2026-11"
  data: RecordItem[];
}
