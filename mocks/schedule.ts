import type { ScheduleTimeSettings, ScheduleEntry } from '@/types';

export interface ScheduleTimeSlot {
  period: number;
  startTime: string;
  endTime: string;
}

export const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];

export const SCHEDULE_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#F97316',
  '#14B8A6',
  '#6366F1',
  '#A855F7',
  '#84CC16',
];

export const DEFAULT_TIME_SETTINGS: ScheduleTimeSettings = {
  lessonStartTime: '08:00',
  lessonDuration: 45,
  breakAfterPeriods: [2, 4, 6],
  breakDurations: { 2: 25, 4: 45, 6: 15 },
  maxPeriods: 9,
};

export function generateTimeSlots(settings: ScheduleTimeSettings): ScheduleTimeSlot[] {
  const slots: ScheduleTimeSlot[] = [];
  const [startH, startM] = settings.lessonStartTime.split(':').map(Number);
  let currentMinutes = startH * 60 + startM;

  for (let i = 0; i < settings.maxPeriods; i++) {
    const startTotal = currentMinutes;
    const endTotal = startTotal + settings.lessonDuration;

    const sh = Math.floor(startTotal / 60);
    const sm = startTotal % 60;
    const eh = Math.floor(endTotal / 60);
    const em = endTotal % 60;

    slots.push({
      period: i,
      startTime: `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`,
      endTime: `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`,
    });

    currentMinutes = endTotal;

    if (settings.breakAfterPeriods.includes(i)) {
      const breakDur = settings.breakDurations[i] ?? 10;
      currentMinutes += breakDur;
    }
  }

  return slots;
}

export const PLACEHOLDER_ENTRIES: ScheduleEntry[] = [];
