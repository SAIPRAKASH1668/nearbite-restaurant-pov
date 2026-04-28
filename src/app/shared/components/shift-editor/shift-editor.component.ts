import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ShiftSchedule,
  ShiftEntry,
  DayAbbr,
  ALL_DAYS,
  DAY_LABELS,
  emptyShiftEntry,
  emptyShiftSchedule
} from '../../../core/models/shift.model';

@Component({
  selector: 'app-shift-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './shift-editor.component.html',
  styleUrl: './shift-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShiftEditorComponent {
  @Input() shifts: ShiftSchedule[] = [];
  @Input() emptyLabel = 'available all day';
  @Output() shiftsChange = new EventEmitter<ShiftSchedule[]>();

  readonly allDays = ALL_DAYS;
  readonly dayLabels = DAY_LABELS;

  isDaySelected(scheduleIdx: number, day: DayAbbr): boolean {
    const days = this.shifts[scheduleIdx]?.days ?? [];
    return days.includes(day);
  }

  toggleDay(scheduleIdx: number, day: DayAbbr): void {
    const schedule = this.shifts[scheduleIdx];
    if (!schedule) return;
    const days = schedule.days ? [...schedule.days] : [];
    const idx = days.indexOf(day);
    if (idx >= 0) {
      days.splice(idx, 1);
    } else {
      days.push(day);
    }
    this.shifts[scheduleIdx] = { ...schedule, days };
    this.emit();
  }

  addSchedule(): void {
    this.shifts = [...this.shifts, emptyShiftSchedule()];
    this.emit();
  }

  removeSchedule(scheduleIdx: number): void {
    this.shifts = this.shifts.filter((_, i) => i !== scheduleIdx);
    this.emit();
  }

  addShift(scheduleIdx: number): void {
    const schedule = this.shifts[scheduleIdx];
    if (!schedule) return;
    this.shifts[scheduleIdx] = {
      ...schedule,
      shifts: [...schedule.shifts, emptyShiftEntry()]
    };
    this.emit();
  }

  removeShift(scheduleIdx: number, shiftIdx: number): void {
    const schedule = this.shifts[scheduleIdx];
    if (!schedule) return;
    const shifts = schedule.shifts.filter((_, i) => i !== shiftIdx);
    if (shifts.length === 0) {
      // Remove entire group if last shift removed
      this.removeSchedule(scheduleIdx);
      return;
    }
    this.shifts[scheduleIdx] = { ...schedule, shifts };
    this.emit();
  }

  onFieldChange(): void {
    this.emit();
  }

  private emit(): void {
    this.shiftsChange.emit([...this.shifts]);
  }

  trackByIndex(index: number): number {
    return index;
  }
}
