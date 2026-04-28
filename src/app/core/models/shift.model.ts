/**
 * Shift Timing models — shared between Restaurant and MenuItem level.
 * Synced with the AWS backend shift_utils.py structure.
 */

export type DayAbbr = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export const ALL_DAYS: DayAbbr[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
export const DAY_LABELS: Record<DayAbbr, string> = {
  MON: 'Mo', TUE: 'Tu', WED: 'We', THU: 'Th', FRI: 'Fr', SAT: 'Sa', SUN: 'Su'
};

export interface ShiftEntry {
  /** Human-readable label, e.g. "Lunch" */
  label: string;
  /** 24-hour HH:MM, e.g. "11:00" */
  start: string;
  /** 24-hour HH:MM, e.g. "15:00" */
  end: string;
}

export interface ShiftSchedule {
  /** Which days this schedule applies to. Absent or [] = every day. */
  days?: DayAbbr[];
  shifts: ShiftEntry[];
}

/** Creates a blank ShiftEntry */
export function emptyShiftEntry(): ShiftEntry {
  return { label: '', start: '', end: '' };
}

/** Creates a blank ShiftSchedule */
export function emptyShiftSchedule(): ShiftSchedule {
  return { days: [], shifts: [emptyShiftEntry()] };
}
