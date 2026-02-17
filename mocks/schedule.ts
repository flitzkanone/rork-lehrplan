export interface ScheduleTimeSlot {
  period: number;
  startTime: string;
  endTime: string;
}

export interface ScheduleEntry {
  id: string;
  dayIndex: number;
  periodStart: number;
  periodEnd: number;
  className: string;
  subject: string;
  room: string;
}

export const TIME_SLOTS: ScheduleTimeSlot[] = [
  { period: 0, startTime: '08:00', endTime: '08:30' },
  { period: 1, startTime: '08:35', endTime: '09:20' },
  { period: 2, startTime: '09:20', endTime: '10:05' },
  { period: 3, startTime: '10:30', endTime: '11:15' },
  { period: 4, startTime: '11:15', endTime: '12:00' },
  { period: 5, startTime: '12:45', endTime: '13:30' },
  { period: 6, startTime: '13:30', endTime: '14:15' },
  { period: 7, startTime: '14:30', endTime: '15:15' },
  { period: 8, startTime: '15:15', endTime: '16:00' },
];

export const BREAK_AFTER_PERIODS = [2, 4, 6];

export const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr'];

export const ACCENT_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#F97316',
];

export const PLACEHOLDER_ENTRIES: ScheduleEntry[] = [
  { id: '1', dayIndex: 0, periodStart: 1, periodEnd: 2, className: '9a', subject: 'Ma', room: 'R317' },
  { id: '2', dayIndex: 0, periodStart: 3, periodEnd: 3, className: '7b', subject: 'Bi', room: 'R319' },
  { id: '3', dayIndex: 0, periodStart: 5, periodEnd: 5, className: '10c', subject: 'En', room: 'R111' },
  { id: '4', dayIndex: 0, periodStart: 6, periodEnd: 6, className: '8a', subject: 'De', room: 'R111' },

  { id: '5', dayIndex: 1, periodStart: 0, periodEnd: 0, className: '8a', subject: 'De', room: 'R111' },
  { id: '6', dayIndex: 1, periodStart: 1, periodEnd: 2, className: '10c', subject: 'Ma', room: 'R317' },
  { id: '7', dayIndex: 1, periodStart: 3, periodEnd: 3, className: '7b', subject: 'EVA', room: 'R111' },
  { id: '8', dayIndex: 1, periodStart: 7, periodEnd: 8, className: '9a', subject: 'NaWi', room: 'R208' },

  { id: '9', dayIndex: 2, periodStart: 1, periodEnd: 2, className: '9a', subject: 'NaWi', room: 'R208' },
  { id: '10', dayIndex: 2, periodStart: 3, periodEnd: 4, className: '7b', subject: 'E_WP', room: 'R111' },
  { id: '11', dayIndex: 2, periodStart: 5, periodEnd: 5, className: '10c', subject: 'En', room: 'R317' },
  { id: '12', dayIndex: 2, periodStart: 7, periodEnd: 8, className: '8a', subject: 'WAK', room: 'R319' },

  { id: '13', dayIndex: 3, periodStart: 2, periodEnd: 2, className: '7b', subject: 'Gewi', room: 'R111' },
  { id: '14', dayIndex: 3, periodStart: 3, periodEnd: 4, className: '9a', subject: 'Gewi', room: 'R111' },
  { id: '15', dayIndex: 3, periodStart: 5, periodEnd: 5, className: '10c', subject: 'Ma', room: 'R111' },

  { id: '16', dayIndex: 4, periodStart: 1, periodEnd: 2, className: '10c', subject: 'Ph', room: 'R317' },
  { id: '17', dayIndex: 4, periodStart: 3, periodEnd: 4, className: '9a', subject: 'Ch', room: 'R208' },
  { id: '18', dayIndex: 4, periodStart: 5, periodEnd: 5, className: '8a', subject: 'Ch', room: 'R208' },
  { id: '19', dayIndex: 4, periodStart: 7, periodEnd: 8, className: '7b', subject: 'Bk', room: 'R115' },
];
