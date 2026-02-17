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

export const PLACEHOLDER_ENTRIES: ScheduleEntry[] = [
  { id: '1', dayIndex: 0, periodStart: 1, periodEnd: 2, className: '9a', subject: 'Ma', room: 'R317', color: '#3B82F6' },
  { id: '2', dayIndex: 0, periodStart: 3, periodEnd: 3, className: '7b', subject: 'Bi', room: 'R319', color: '#10B981' },
  { id: '3', dayIndex: 0, periodStart: 5, periodEnd: 5, className: '10c', subject: 'En', room: 'R111', color: '#F59E0B' },
  { id: '4', dayIndex: 0, periodStart: 6, periodEnd: 6, className: '8a', subject: 'De', room: 'R111', color: '#EF4444' },

  { id: '5', dayIndex: 1, periodStart: 0, periodEnd: 0, className: '8a', subject: 'De', room: 'R111', color: '#EF4444' },
  { id: '6', dayIndex: 1, periodStart: 1, periodEnd: 2, className: '10c', subject: 'Ma', room: 'R317', color: '#F59E0B' },
  { id: '7', dayIndex: 1, periodStart: 3, periodEnd: 3, className: '7b', subject: 'EVA', room: 'R111', color: '#10B981' },
  { id: '8', dayIndex: 1, periodStart: 7, periodEnd: 8, className: '9a', subject: 'NaWi', room: 'R208', color: '#3B82F6' },

  { id: '9', dayIndex: 2, periodStart: 1, periodEnd: 2, className: '9a', subject: 'NaWi', room: 'R208', color: '#3B82F6' },
  { id: '10', dayIndex: 2, periodStart: 3, periodEnd: 4, className: '7b', subject: 'E_WP', room: 'R111', color: '#10B981' },
  { id: '11', dayIndex: 2, periodStart: 5, periodEnd: 5, className: '10c', subject: 'En', room: 'R317', color: '#F59E0B' },
  { id: '12', dayIndex: 2, periodStart: 7, periodEnd: 8, className: '8a', subject: 'WAK', room: 'R319', color: '#EF4444' },

  { id: '13', dayIndex: 3, periodStart: 2, periodEnd: 2, className: '7b', subject: 'Gewi', room: 'R111', color: '#10B981' },
  { id: '14', dayIndex: 3, periodStart: 3, periodEnd: 4, className: '9a', subject: 'Gewi', room: 'R111', color: '#3B82F6' },
  { id: '15', dayIndex: 3, periodStart: 5, periodEnd: 5, className: '10c', subject: 'Ma', room: 'R111', color: '#F59E0B' },

  { id: '16', dayIndex: 4, periodStart: 1, periodEnd: 2, className: '10c', subject: 'Ph', room: 'R317', color: '#F59E0B' },
  { id: '17', dayIndex: 4, periodStart: 3, periodEnd: 4, className: '9a', subject: 'Ch', room: 'R208', color: '#3B82F6' },
  { id: '18', dayIndex: 4, periodStart: 5, periodEnd: 5, className: '8a', subject: 'Ch', room: 'R208', color: '#EF4444' },
  { id: '19', dayIndex: 4, periodStart: 7, periodEnd: 8, className: '7b', subject: 'Bk', room: 'R115', color: '#10B981' },
];
