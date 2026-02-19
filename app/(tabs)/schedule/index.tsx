import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Platform,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Switch,
  Animated,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Plus, Settings2, X, Trash2, Check, Clock, Calendar, CalendarDays, BookOpen, StickyNote, RefreshCw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/context/AppContext';


import {
  DAYS,
  SCHEDULE_COLORS,
  generateTimeSlots,
} from '@/mocks/schedule';
import type { ScheduleTimeSlot } from '@/mocks/schedule';
import type { ScheduleEntry, ScheduleTimeSettings, OneTimeEvent, SubstitutionEntry } from '@/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const TIME_COL_WIDTH = 38;
const DAY_COL_WIDTH = Math.floor((SCREEN_WIDTH - TIME_COL_WIDTH) / 5);
const TOTAL_GRID_WIDTH = DAY_COL_WIDTH * 5;
const DEFAULT_ROW_HEIGHT = 52;
const DEFAULT_BREAK_HEIGHT = 6;
const HEADER_HEIGHT = 44;

const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const EVENT_COLORS = [
  '#EF4444',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#F97316',
  '#10B981',
  '#3B82F6',
];

function getYPosition(period: number, breakAfterPeriods: number[], rowHeight: number, breakHeight: number): number {
  let y = 0;
  for (let p = 0; p < period; p++) {
    y += rowHeight;
    if (breakAfterPeriods.includes(p)) {
      y += breakHeight;
    }
  }
  return y;
}

function getCardHeight(periodStart: number, periodEnd: number, breakAfterPeriods: number[], rowHeight: number, breakHeight: number): number {
  return getYPosition(periodEnd, breakAfterPeriods, rowHeight, breakHeight) + rowHeight - getYPosition(periodStart, breakAfterPeriods, rowHeight, breakHeight);
}

function getTotalGridHeight(maxPeriods: number, breakAfterPeriods: number[], rowHeight: number, breakHeight: number): number {
  return getYPosition(maxPeriods - 1, breakAfterPeriods, rowHeight, breakHeight) + rowHeight;
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const LessonCard = React.memo(({
  entry,
  top,
  height,
  onLongPress,
}: {
  entry: ScheduleEntry;
  top: number;
  height: number;
  onLongPress: () => void;
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={[
        styles.lessonCard,
        {
          position: 'absolute' as const,
          top: top + 1,
          height: height - 2,
          left: 1,
          width: DAY_COL_WIDTH - 2,
        },
      ]}
    >
      <View style={[styles.accentBar, { backgroundColor: entry.color }]} />
      <View style={styles.cardContent}>
        <Text style={styles.cardClass} numberOfLines={1}>{entry.className}</Text>
        <Text style={styles.cardSubject} numberOfLines={1}>{entry.subject}</Text>
        {height > 40 && (
          <Text style={styles.cardRoom} numberOfLines={1}>{entry.room}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
});

const SubstitutionCard = React.memo(({
  sub,
  top,
  height,
  onLongPress,
}: {
  sub: SubstitutionEntry;
  top: number;
  height: number;
  onLongPress: () => void;
}) => {
  const hasSubject = !!sub.subject;
  const hasClass = !!sub.className;
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={[
        styles.substitutionCard,
        {
          position: 'absolute' as const,
          top: top + 1,
          height: height - 2,
          left: 1,
          width: DAY_COL_WIDTH - 2,
          backgroundColor: sub.color + '18',
        },
      ]}
    >
      <View style={[styles.accentBar, { backgroundColor: sub.color }]} />
      <View style={styles.cardContent}>
        {hasClass ? (
          <Text style={styles.cardClass} numberOfLines={1}>{sub.className}</Text>
        ) : null}
        {hasSubject ? (
          <Text style={styles.cardSubject} numberOfLines={1}>{sub.subject}</Text>
        ) : (
          <Text style={[styles.cardClass, { fontSize: height > 60 ? 9 : 8 }]} numberOfLines={2}>
            {hasClass ? 'VERTRETUNG' : 'BETREUUNG'}
          </Text>
        )}
        {height > 40 && sub.room ? (
          <Text style={styles.cardRoom} numberOfLines={1}>{sub.room}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

const EventCard = React.memo(({
  event,
  top,
  height,
  onLongPress,
}: {
  event: OneTimeEvent;
  top: number;
  height: number;
  onLongPress: () => void;
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={[
        styles.eventCard,
        {
          position: 'absolute' as const,
          top: top + 1,
          height: height - 2,
          left: 1,
          width: DAY_COL_WIDTH - 2,
          borderColor: event.color,
        },
      ]}
    >
      <View style={[styles.accentBar, { backgroundColor: event.color }]} />
      <View style={styles.cardContent}>
        <View style={styles.eventIconRow}>
          <CalendarDays size={7} color={event.color} strokeWidth={2.5} />
          <Text style={[styles.cardClass, { color: event.color }]} numberOfLines={1}>{event.title}</Text>
        </View>
        {height > 30 && event.room ? (
          <Text style={styles.cardRoom} numberOfLines={1}>{event.room}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
});

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const {
    scheduleEntries,
    scheduleTimeSettings,
    addScheduleEntry,
    addScheduleEntries,
    deleteScheduleEntry,
    saveScheduleTimeSettings,
    oneTimeEvents,
    addOneTimeEvent,
    deleteOneTimeEvent,
    substitutions,
    addSubstitution,
    deleteSubstitution,
    data,
  } = useApp();



  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [gridAreaHeight, setGridAreaHeight] = useState<number>(0);
  const panX = useRef(new Animated.Value(0)).current;
  const isAnimatingRef = useRef<boolean>(false);

  const [showActionSheet, setShowActionSheet] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEventModal, setShowEventModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showSubModal, setShowSubModal] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'entry' | 'event' | 'substitution'>('entry');

  const [newSubject, setNewSubject] = useState<string>('');
  const [newClassName, setNewClassName] = useState<string>('');
  const [newRoom, setNewRoom] = useState<string>('');
  const [newColor, setNewColor] = useState<string>(SCHEDULE_COLORS[0]);
  const [newDayIndices, setNewDayIndices] = useState<number[]>([]);
  const [newPeriods, setNewPeriods] = useState<number[]>([]);

  const [eventTitle, setEventTitle] = useState<string>('');
  const [eventDate, setEventDate] = useState<string>('');
  const [eventIsAllDay, setEventIsAllDay] = useState<boolean>(false);
  const [eventAllDayStart, setEventAllDayStart] = useState<string>('08:00');
  const [eventAllDayEnd, setEventAllDayEnd] = useState<string>('15:30');
  const [eventPeriods, setEventPeriods] = useState<number[]>([]);
  const [eventRoom, setEventRoom] = useState<string>('');
  const [eventColor, setEventColor] = useState<string>(EVENT_COLORS[0]);
  const [eventNotes, setEventNotes] = useState<string>('');

  const [subSubject, setSubSubject] = useState<string>('');
  const [subClassName, setSubClassName] = useState<string>('');
  const [subRoom, setSubRoom] = useState<string>('');
  const [subDate, setSubDate] = useState<string>('');
  const [subPeriods, setSubPeriods] = useState<number[]>([]);
  const [subColor, setSubColor] = useState<string>('#94A3B8');

  const [tempStartTime, setTempStartTime] = useState<string>(scheduleTimeSettings.lessonStartTime);
  const [tempDuration, setTempDuration] = useState<string>(String(scheduleTimeSettings.lessonDuration));
  const [tempMaxPeriods, setTempMaxPeriods] = useState<string>(String(scheduleTimeSettings.maxPeriods));
  const [tempBreakAfter, setTempBreakAfter] = useState<number[]>(scheduleTimeSettings.breakAfterPeriods);
  const [tempBreakDurations, setTempBreakDurations] = useState<Record<number, number>>(scheduleTimeSettings.breakDurations);



  const today = useMemo(() => new Date(), []);

  const timeSlots = useMemo<ScheduleTimeSlot[]>(
    () => generateTimeSlots(scheduleTimeSettings),
    [scheduleTimeSettings]
  );

  const breakAfterPeriods = scheduleTimeSettings.breakAfterPeriods;

  const { dynamicRowHeight, dynamicBreakHeight } = useMemo(() => {
    if (gridAreaHeight <= 0) return { dynamicRowHeight: DEFAULT_ROW_HEIGHT, dynamicBreakHeight: DEFAULT_BREAK_HEIGHT };
    const available = gridAreaHeight - HEADER_HEIGHT;
    const numBreaks = breakAfterPeriods.filter((p) => p < scheduleTimeSettings.maxPeriods).length;
    const breakRatio = 0.12;
    const rowH = available / (scheduleTimeSettings.maxPeriods + breakRatio * numBreaks);
    const breakH = rowH * breakRatio;
    return { dynamicRowHeight: Math.max(28, rowH), dynamicBreakHeight: Math.max(2, breakH) };
  }, [gridAreaHeight, breakAfterPeriods, scheduleTimeSettings.maxPeriods]);

  const totalGridHeight = getTotalGridHeight(scheduleTimeSettings.maxPeriods, breakAfterPeriods, dynamicRowHeight, dynamicBreakHeight);

  const weekData = useMemo(() => {
    const base = new Date(today);
    const dayOfWeek = base.getDay();
    const monday = new Date(base);
    monday.setDate(base.getDate() - ((dayOfWeek + 6) % 7) + weekOffset * 7);

    const dates: Date[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d);
    }

    return {
      dates,
      weekNumber: getISOWeekNumber(monday),
      month: MONTH_NAMES[monday.getMonth()],
    };
  }, [weekOffset, today]);

  const isToday = useCallback(
    (date: Date): boolean =>
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear(),
    [today]
  );

  const animateWeekChange = useCallback((direction: 1 | -1) => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const slideOut = direction === 1 ? -SCREEN_WIDTH : SCREEN_WIDTH;
    Animated.timing(panX, {
      toValue: slideOut,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setWeekOffset((prev) => prev + direction);
      panX.setValue(-slideOut);
      Animated.timing(panX, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        isAnimatingRef.current = false;
      });
    });
  }, [panX]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        !isAnimatingRef.current && Math.abs(gs.dx) > Math.abs(gs.dy) && Math.abs(gs.dx) > 10,
      onPanResponderMove: (_, gs) => {
        if (!isAnimatingRef.current) {
          panX.setValue(gs.dx);
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (isAnimatingRef.current) return;
        const threshold = SCREEN_WIDTH * 0.2;
        if (gs.dx > threshold || (gs.dx > 0 && gs.vx > 0.5)) {
          isAnimatingRef.current = true;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          Animated.timing(panX, {
            toValue: SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setWeekOffset((prev) => prev - 1);
            panX.setValue(-SCREEN_WIDTH);
            Animated.timing(panX, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              isAnimatingRef.current = false;
            });
          });
        } else if (gs.dx < -threshold || (gs.dx < 0 && gs.vx < -0.5)) {
          isAnimatingRef.current = true;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          Animated.timing(panX, {
            toValue: -SCREEN_WIDTH,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setWeekOffset((prev) => prev + 1);
            panX.setValue(SCREEN_WIDTH);
            Animated.timing(panX, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }).start(() => {
              isAnimatingRef.current = false;
            });
          });
        } else {
          Animated.spring(panX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 10,
          }).start();
        }
      },
    })
  ).current;

  const subsForWeek = useMemo(() => {
    const map: Record<number, SubstitutionEntry[]> = {};
    for (let i = 0; i < 5; i++) {
      const dateStr = formatDateStr(weekData.dates[i]);
      map[i] = substitutions.filter((s) => s.date === dateStr);
    }
    return map;
  }, [substitutions, weekData.dates]);

  const eventsForWeek = useMemo(() => {
    const map: Record<number, OneTimeEvent[]> = {};
    for (let i = 0; i < 5; i++) {
      const dateStr = formatDateStr(weekData.dates[i]);
      map[i] = oneTimeEvents.filter((e) => e.date === dateStr);
    }
    return map;
  }, [oneTimeEvents, weekData.dates]);

  const entriesByDay = useMemo(() => {
    const map: Record<number, ScheduleEntry[]> = {};
    for (let i = 0; i < 5; i++) {
      const dayEvents = eventsForWeek[i] || [];
      const daySubs = subsForWeek[i] || [];
      const allDayEvent = dayEvents.find((e) => e.isAllDay);

      if (allDayEvent) {
        map[i] = [];
      } else {
        const blockedPeriods = new Set<number>();
        dayEvents.forEach((evt) => {
          evt.periods.forEach((p) => blockedPeriods.add(p));
        });

        const hiddenIds = new Set<string>();
        daySubs.forEach((sub) => {
          sub.hiddenRegularEntries.forEach((id) => hiddenIds.add(id));
        });

        map[i] = scheduleEntries
          .filter((e) => e.dayIndex === i)
          .filter((e) => !hiddenIds.has(e.id))
          .filter((e) => {
            for (let p = e.periodStart; p <= e.periodEnd; p++) {
              if (blockedPeriods.has(p)) return false;
            }
            return true;
          });
      }
    }
    return map;
  }, [scheduleEntries, eventsForWeek, subsForWeek]);

  const handlePrevWeek = useCallback(() => {
    animateWeekChange(-1);
  }, [animateWeekChange]);

  const handleNextWeek = useCallback(() => {
    animateWeekChange(1);
  }, [animateWeekChange]);

  const handleTodayPress = useCallback(() => {
    if (isAnimatingRef.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (weekOffset === 0) return;
    isAnimatingRef.current = true;
    const slideDir = weekOffset > 0 ? -SCREEN_WIDTH : SCREEN_WIDTH;
    Animated.timing(panX, {
      toValue: slideDir,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setWeekOffset(0);
      panX.setValue(-slideDir);
      Animated.timing(panX, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        isAnimatingRef.current = false;
      });
    });
  }, [weekOffset, panX]);

  const handleDeleteEntry = useCallback(
    (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setDeleteType('entry');
      setShowDeleteConfirm(id);
    },
    []
  );

  const handleDeleteEvent = useCallback(
    (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setDeleteType('event');
      setShowDeleteConfirm(id);
    },
    []
  );

  const handleDeleteSub = useCallback(
    (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setDeleteType('substitution');
      setShowDeleteConfirm(id);
    },
    []
  );

  const confirmDelete = useCallback(() => {
    if (showDeleteConfirm) {
      if (deleteType === 'entry') {
        deleteScheduleEntry(showDeleteConfirm);
      } else if (deleteType === 'event') {
        deleteOneTimeEvent(showDeleteConfirm);
      } else {
        deleteSubstitution(showDeleteConfirm);
      }
      setShowDeleteConfirm(null);
    }
  }, [showDeleteConfirm, deleteType, deleteScheduleEntry, deleteOneTimeEvent, deleteSubstitution]);

  const resetAddForm = useCallback(() => {
    setNewSubject('');
    setNewClassName('');
    setNewRoom('');
    setNewColor(SCHEDULE_COLORS[0]);
    setNewDayIndices([]);
    setNewPeriods([]);
  }, []);

  const resetSubForm = useCallback(() => {
    setSubSubject('');
    setSubClassName('');
    setSubRoom('');
    setSubDate('');
    setSubPeriods([]);
    setSubColor('#94A3B8');
  }, []);

  const resetEventForm = useCallback(() => {
    setEventTitle('');
    setEventDate('');
    setEventIsAllDay(false);
    setEventAllDayStart('08:00');
    setEventAllDayEnd('15:30');
    setEventPeriods([]);
    setEventRoom('');
    setEventColor(EVENT_COLORS[0]);
    setEventNotes('');
  }, []);

  const handlePlusPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowActionSheet(true);
  }, []);

  const handleChooseRegular = useCallback(() => {
    setShowActionSheet(false);
    resetAddForm();
    setShowAddModal(true);
  }, [resetAddForm]);

  const handleChooseEvent = useCallback(() => {
    setShowActionSheet(false);
    resetEventForm();
    const todayStr = formatDateStr(today);
    setEventDate(todayStr);
    setShowEventModal(true);
  }, [resetEventForm, today]);

  const handleChooseSubstitution = useCallback(() => {
    setShowActionSheet(false);
    resetSubForm();
    setSubDate(formatDateStr(today));
    setShowSubModal(true);
  }, [resetSubForm, today]);

  const handleTogglePeriod = useCallback((period: number) => {
    Haptics.selectionAsync();
    setNewPeriods((prev) => {
      if (prev.includes(period)) {
        return prev.filter((p) => p !== period);
      }
      return [...prev, period].sort((a, b) => a - b);
    });
  }, []);

  const handleToggleEventPeriod = useCallback((period: number) => {
    Haptics.selectionAsync();
    setEventPeriods((prev) => {
      if (prev.includes(period)) {
        return prev.filter((p) => p !== period);
      }
      return [...prev, period].sort((a, b) => a - b);
    });
  }, []);

  const handleToggleSubPeriod = useCallback((period: number) => {
    Haptics.selectionAsync();
    setSubPeriods((prev) => {
      if (prev.includes(period)) {
        return prev.filter((p) => p !== period);
      }
      return [...prev, period].sort((a, b) => a - b);
    });
  }, []);

  const handleToggleDayIndex = useCallback((idx: number) => {
    Haptics.selectionAsync();
    setNewDayIndices((prev) => {
      if (prev.includes(idx)) {
        return prev.filter((d) => d !== idx);
      }
      return [...prev, idx].sort((a, b) => a - b);
    });
  }, []);

  const handleAddEntry = useCallback(() => {
    if (!newSubject.trim()) {
      Alert.alert('Fehler', 'Bitte wählen Sie ein Fach.');
      return;
    }
    if (!newClassName.trim()) {
      Alert.alert('Fehler', 'Bitte geben Sie einen Klassennamen ein.');
      return;
    }
    if (newDayIndices.length === 0) {
      Alert.alert('Fehler', 'Bitte wählen Sie mindestens einen Wochentag.');
      return;
    }
    if (newPeriods.length === 0) {
      Alert.alert('Fehler', 'Bitte wählen Sie mindestens eine Stunde.');
      return;
    }

    const sortedPeriods = [...newPeriods].sort((a, b) => a - b);
    let isContiguous = true;
    for (let i = 1; i < sortedPeriods.length; i++) {
      if (sortedPeriods[i] !== sortedPeriods[i - 1] + 1) {
        isContiguous = false;
        break;
      }
    }

    if (!isContiguous) {
      Alert.alert('Fehler', 'Die ausgewählten Stunden müssen zusammenhängend sein.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const entriesToAdd = newDayIndices.map((dayIdx) => ({
      dayIndex: dayIdx,
      periodStart: sortedPeriods[0],
      periodEnd: sortedPeriods[sortedPeriods.length - 1],
      className: newClassName.trim(),
      subject: newSubject.trim(),
      room: newRoom.trim(),
      color: newColor,
    }));
    addScheduleEntries(entriesToAdd);

    setShowAddModal(false);
    resetAddForm();
  }, [newSubject, newClassName, newRoom, newColor, newDayIndices, newPeriods, addScheduleEntry, resetAddForm]);

  const handleAddSubstitution = useCallback(() => {
    if (!subRoom.trim()) {
      Alert.alert('Fehler', 'Bitte geben Sie einen Raum ein.');
      return;
    }
    if (!subDate) {
      Alert.alert('Fehler', 'Bitte wählen Sie ein Datum.');
      return;
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(subDate)) {
      Alert.alert('Fehler', 'Bitte geben Sie ein gültiges Datum ein (JJJJ-MM-TT).');
      return;
    }
    if (subPeriods.length === 0) {
      Alert.alert('Fehler', 'Bitte wählen Sie mindestens eine Stunde.');
      return;
    }

    const subDateObj = new Date(subDate + 'T00:00:00');
    const dayOfWeek = (subDateObj.getDay() + 6) % 7;
    const subPeriodsSet = new Set(subPeriods);

    const conflicting = scheduleEntries.filter((e) => {
      if (e.dayIndex !== dayOfWeek) return false;
      for (let p = e.periodStart; p <= e.periodEnd; p++) {
        if (subPeriodsSet.has(p)) return true;
      }
      return false;
    });

    const doSave = (hiddenIds: string[]) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      addSubstitution({
        date: subDate,
        periods: subPeriods,
        subject: subSubject.trim() || undefined,
        className: subClassName.trim() || undefined,
        room: subRoom.trim(),
        color: subColor,
        hiddenRegularEntries: hiddenIds,
      });
      setShowSubModal(false);
      resetSubForm();
    };

    if (conflicting.length > 0) {
      const names = conflicting.map((c) => `${c.className} (${c.subject})`).join(', ');
      Alert.alert(
        'Überschneidung',
        `Diese Vertretung überschneidet sich mit: ${names}. Sollen die regulären Stunden für diesen Tag ausgeblendet werden?`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Nein, beibehalten', onPress: () => doSave([]) },
          { text: 'Ja, ausblenden', style: 'destructive', onPress: () => doSave(conflicting.map((c) => c.id)) },
        ]
      );
    } else {
      doSave([]);
    }
  }, [subRoom, subDate, subPeriods, subSubject, subClassName, subColor, scheduleEntries, addSubstitution, resetSubForm]);

  const handleAddEvent = useCallback(() => {
    if (!eventTitle.trim()) {
      Alert.alert('Fehler', 'Bitte geben Sie einen Titel ein.');
      return;
    }
    if (!eventDate) {
      Alert.alert('Fehler', 'Bitte wählen Sie ein Datum.');
      return;
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(eventDate)) {
      Alert.alert('Fehler', 'Bitte geben Sie ein gültiges Datum ein (JJJJ-MM-TT).');
      return;
    }
    if (!eventIsAllDay && eventPeriods.length === 0) {
      Alert.alert('Fehler', 'Bitte wählen Sie Stunden oder „Ganztägig".');
      return;
    }
    if (eventIsAllDay) {
      const timeRegex = /^\d{2}:\d{2}$/;
      if (!timeRegex.test(eventAllDayStart) || !timeRegex.test(eventAllDayEnd)) {
        Alert.alert('Fehler', 'Bitte geben Sie gültige Zeiten ein (HH:MM).');
        return;
      }
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const periods = eventIsAllDay
      ? Array.from({ length: scheduleTimeSettings.maxPeriods }, (_, i) => i)
      : eventPeriods;

    addOneTimeEvent({
      title: eventTitle.trim(),
      date: eventDate,
      isAllDay: eventIsAllDay,
      allDayStartTime: eventIsAllDay ? eventAllDayStart : undefined,
      allDayEndTime: eventIsAllDay ? eventAllDayEnd : undefined,
      periods,
      room: eventRoom.trim(),
      color: eventColor,
      notes: eventNotes.trim(),
    });

    setShowEventModal(false);
    resetEventForm();
  }, [eventTitle, eventDate, eventIsAllDay, eventAllDayStart, eventAllDayEnd, eventPeriods, eventRoom, eventColor, eventNotes, scheduleTimeSettings.maxPeriods, addOneTimeEvent, resetEventForm]);

  const handleOpenSettings = useCallback(() => {
    setTempStartTime(scheduleTimeSettings.lessonStartTime);
    setTempDuration(String(scheduleTimeSettings.lessonDuration));
    setTempMaxPeriods(String(scheduleTimeSettings.maxPeriods));
    setTempBreakAfter([...scheduleTimeSettings.breakAfterPeriods]);
    setTempBreakDurations({ ...scheduleTimeSettings.breakDurations });
    setShowSettingsModal(true);
  }, [scheduleTimeSettings]);

  const handleSaveSettings = useCallback(() => {
    const dur = parseInt(tempDuration, 10);
    const maxP = parseInt(tempMaxPeriods, 10);
    if (isNaN(dur) || dur < 10 || dur > 120) {
      Alert.alert('Fehler', 'Stundendauer muss zwischen 10 und 120 Minuten liegen.');
      return;
    }
    if (isNaN(maxP) || maxP < 1 || maxP > 14) {
      Alert.alert('Fehler', 'Anzahl der Stunden muss zwischen 1 und 14 liegen.');
      return;
    }
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(tempStartTime)) {
      Alert.alert('Fehler', 'Bitte geben Sie eine gültige Startzeit ein (HH:MM).');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newSettings: ScheduleTimeSettings = {
      lessonStartTime: tempStartTime,
      lessonDuration: dur,
      maxPeriods: maxP,
      breakAfterPeriods: tempBreakAfter,
      breakDurations: tempBreakDurations,
    };
    saveScheduleTimeSettings(newSettings);
    setShowSettingsModal(false);
  }, [tempStartTime, tempDuration, tempMaxPeriods, tempBreakAfter, tempBreakDurations, saveScheduleTimeSettings]);

  const handleToggleBreakAfter = useCallback((period: number) => {
    setTempBreakAfter((prev) => {
      if (prev.includes(period)) {
        return prev.filter((p) => p !== period);
      }
      return [...prev, period].sort((a, b) => a - b);
    });
  }, []);

  const handleBreakDurationChange = useCallback((period: number, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) {
      setTempBreakDurations((prev) => ({ ...prev, [period]: num }));
    }
  }, []);

  const subjectOptions = useMemo(() => {
    return data.profile.subjects.length > 0 ? data.profile.subjects : [];
  }, [data.profile.subjects]);

  const renderTimeColumn = useMemo(() => {
    return (
      <View style={{ height: totalGridHeight }}>
        {timeSlots.map((slot) => {
          const top = getYPosition(slot.period, breakAfterPeriods, dynamicRowHeight, dynamicBreakHeight);
          return (
            <View
              key={slot.period}
              style={[
                styles.timeCell,
                {
                  position: 'absolute' as const,
                  top,
                  height: dynamicRowHeight,
                  width: TIME_COL_WIDTH,
                },
              ]}
            >
              <Text style={styles.timePeriod}>{slot.period + 1}</Text>
              <Text style={styles.timeStart}>{slot.startTime}</Text>
            </View>
          );
        })}
        {breakAfterPeriods.map((period) => {
          if (period >= scheduleTimeSettings.maxPeriods) return null;
          const top = getYPosition(period, breakAfterPeriods, dynamicRowHeight, dynamicBreakHeight) + dynamicRowHeight;
          return (
            <View
              key={`break-${period}`}
              style={[
                styles.breakGap,
                {
                  position: 'absolute' as const,
                  top,
                  height: dynamicBreakHeight,
                  width: TIME_COL_WIDTH,
                },
              ]}
            />
          );
        })}
      </View>
    );
  }, [totalGridHeight, timeSlots, breakAfterPeriods, scheduleTimeSettings.maxPeriods, dynamicRowHeight, dynamicBreakHeight]);

  const renderDayColumn = useCallback(
    (dayIndex: number) => {
      const entries = entriesByDay[dayIndex] || [];
      const dayEvents = eventsForWeek[dayIndex] || [];
      const isTodayCol = isToday(weekData.dates[dayIndex]);

      return (
        <View
          key={dayIndex}
          style={[
            styles.dayColumn,
            { width: DAY_COL_WIDTH, height: totalGridHeight },
            isTodayCol && styles.dayColumnToday,
          ]}
        >
          {timeSlots.map((slot) => {
            const top = getYPosition(slot.period, breakAfterPeriods, dynamicRowHeight, dynamicBreakHeight);
            return (
              <View
                key={slot.period}
                style={[
                  styles.gridCell,
                  {
                    position: 'absolute' as const,
                    top,
                    height: dynamicRowHeight,
                    width: DAY_COL_WIDTH,
                  },
                ]}
              />
            );
          })}
          {breakAfterPeriods.map((period) => {
            if (period >= scheduleTimeSettings.maxPeriods) return null;
            const top = getYPosition(period, breakAfterPeriods, dynamicRowHeight, dynamicBreakHeight) + dynamicRowHeight;
            return (
              <View
                key={`break-${period}`}
                style={{
                  position: 'absolute' as const,
                  top,
                  height: dynamicBreakHeight,
                  width: DAY_COL_WIDTH,
                  backgroundColor: isTodayCol ? 'rgba(22,23,26,0.02)' : 'transparent',
                }}
              />
            );
          })}
          {entries.map((entry) => {
            const top = getYPosition(entry.periodStart, breakAfterPeriods, dynamicRowHeight, dynamicBreakHeight);
            const height = getCardHeight(entry.periodStart, entry.periodEnd, breakAfterPeriods, dynamicRowHeight, dynamicBreakHeight);
            return (
              <LessonCard
                key={entry.id}
                entry={entry}
                top={top}
                height={height}
                onLongPress={() => handleDeleteEntry(entry.id)}
              />
            );
          })}
          {dayEvents.map((evt) => {
            if (evt.isAllDay) {
              const top = 0;
              const height = totalGridHeight;
              return (
                <EventCard
                  key={evt.id}
                  event={evt}
                  top={top}
                  height={height}
                  onLongPress={() => handleDeleteEvent(evt.id)}
                />
              );
            }
            const sortedPeriods = [...evt.periods].sort((a, b) => a - b);
            if (sortedPeriods.length === 0) return null;
            const pStart = sortedPeriods[0];
            const pEnd = sortedPeriods[sortedPeriods.length - 1];
            const top = getYPosition(pStart, breakAfterPeriods, dynamicRowHeight, dynamicBreakHeight);
            const height = getCardHeight(pStart, pEnd, breakAfterPeriods, dynamicRowHeight, dynamicBreakHeight);
            return (
              <EventCard
                key={evt.id}
                event={evt}
                top={top}
                height={height}
                onLongPress={() => handleDeleteEvent(evt.id)}
              />
            );
          })}
          {(subsForWeek[dayIndex] || []).map((sub) => {
            const sortedPeriods = [...sub.periods].sort((a, b) => a - b);
            if (sortedPeriods.length === 0) return null;
            const pStart = sortedPeriods[0];
            const pEnd = sortedPeriods[sortedPeriods.length - 1];
            const top = getYPosition(pStart, breakAfterPeriods, dynamicRowHeight, dynamicBreakHeight);
            const height = getCardHeight(pStart, pEnd, breakAfterPeriods, dynamicRowHeight, dynamicBreakHeight);
            return (
              <SubstitutionCard
                key={sub.id}
                sub={sub}
                top={top}
                height={height}
                onLongPress={() => handleDeleteSub(sub.id)}
              />
            );
          })}
        </View>
      );
    },
    [entriesByDay, eventsForWeek, subsForWeek, isToday, weekData.dates, totalGridHeight, timeSlots, breakAfterPeriods, scheduleTimeSettings.maxPeriods, dynamicRowHeight, dynamicBreakHeight, handleDeleteEntry, handleDeleteEvent, handleDeleteSub]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Stundenplan</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleOpenSettings}
            style={styles.headerBtn}
            activeOpacity={0.5}
            testID="schedule-settings"
          >
            <Settings2 size={18} color={Colors.text} strokeWidth={1.8} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handlePlusPress}
            style={styles.headerBtnPrimary}
            activeOpacity={0.5}
            testID="schedule-add"
          >
            <Plus size={18} color={Colors.white} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.weekNavRow}>
        <TouchableOpacity onPress={handlePrevWeek} style={styles.weekBtn} activeOpacity={0.5}>
          <ChevronLeft size={16} color={Colors.text} strokeWidth={2.2} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleTodayPress} activeOpacity={0.6} style={styles.weekLabelBtn}>
          <Text style={styles.weekLabel}>KW {weekData.weekNumber} · {weekData.month}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleNextWeek} style={styles.weekBtn} activeOpacity={0.5}>
          <ChevronRight size={16} color={Colors.text} strokeWidth={2.2} />
        </TouchableOpacity>
      </View>

      <View
        style={styles.gridWrapper}
        onLayout={(e) => setGridAreaHeight(e.nativeEvent.layout.height)}
        {...panResponder.panHandlers}
      >
        <View style={styles.gridRow}>
          <View style={styles.timeColumnOuter}>
            <View style={[styles.cornerCell, { height: HEADER_HEIGHT }]} />
            <View style={{ flex: 1, overflow: 'hidden' as const }}>
              {renderTimeColumn}
            </View>
          </View>

          <Animated.View style={{ flex: 1, width: TOTAL_GRID_WIDTH, transform: [{ translateX: panX }] }}>
            <View style={[styles.dayHeaderRow, { height: HEADER_HEIGHT }]}>
              {weekData.dates.map((date, idx) => {
                const isTodayCol = isToday(date);
                return (
                  <View
                    key={idx}
                    style={[
                      styles.dayHeader,
                      { width: DAY_COL_WIDTH },
                      isTodayCol && styles.dayHeaderToday,
                    ]}
                  >
                    <Text style={[styles.dayName, isTodayCol && styles.dayNameToday]}>
                      {DAYS[idx]}
                    </Text>
                    <Text style={[styles.dayDate, isTodayCol && styles.dayDateToday]}>
                      {date.getDate()}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View style={{ flex: 1, overflow: 'hidden' as const }}>
              <View style={[styles.gridBody, { height: totalGridHeight }]}>
                {[0, 1, 2, 3, 4].map((dayIndex) => renderDayColumn(dayIndex))}
              </View>
            </View>
          </Animated.View>
        </View>
      </View>

      {/* Action Sheet */}
      <Modal visible={showActionSheet} transparent animationType="fade">
        <TouchableOpacity
          style={styles.actionSheetOverlay}
          activeOpacity={1}
          onPress={() => setShowActionSheet(false)}
        >
          <View style={styles.actionSheetContent}>
            <View style={styles.actionSheetHandle} />
            <Text style={styles.actionSheetTitle}>Neuen Eintrag erstellen</Text>

            <TouchableOpacity
              style={styles.actionSheetOption}
              activeOpacity={0.6}
              onPress={handleChooseRegular}
            >
              <View style={[styles.actionSheetIcon, { backgroundColor: Colors.primaryLight }]}>
                <BookOpen size={20} color={Colors.text} strokeWidth={1.8} />
              </View>
              <View style={styles.actionSheetOptionText}>
                <Text style={styles.actionSheetOptionTitle}>Reguläre Stunde</Text>
                <Text style={styles.actionSheetOptionDesc}>Wöchentlich wiederkehrende Unterrichtsstunde</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetOption}
              activeOpacity={0.6}
              onPress={handleChooseEvent}
            >
              <View style={[styles.actionSheetIcon, { backgroundColor: '#FEF3C7' }]}>
                <Calendar size={20} color="#D97706" strokeWidth={1.8} />
              </View>
              <View style={styles.actionSheetOptionText}>
                <Text style={styles.actionSheetOptionTitle}>Einmaliges Ereignis</Text>
                <Text style={styles.actionSheetOptionDesc}>Ausflug, Konferenz, Fortbildung etc.</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetOption}
              activeOpacity={0.6}
              onPress={handleChooseSubstitution}
            >
              <View style={[styles.actionSheetIcon, { backgroundColor: '#E2E8F0' }]}>
                <RefreshCw size={20} color="#475569" strokeWidth={1.8} />
              </View>
              <View style={styles.actionSheetOptionText}>
                <Text style={styles.actionSheetOptionTitle}>Vertretung</Text>
                <Text style={styles.actionSheetOptionDesc}>Vertretungs- oder Betreuungsstunde</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetCancel}
              activeOpacity={0.6}
              onPress={() => setShowActionSheet(false)}
            >
              <Text style={styles.actionSheetCancelText}>Abbrechen</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Delete Confirmation */}
      <Modal visible={showDeleteConfirm !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Eintrag löschen</Text>
              <TouchableOpacity onPress={() => setShowDeleteConfirm(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
              </TouchableOpacity>
            </View>
            <Text style={styles.deleteText}>Möchten Sie diesen Eintrag wirklich löschen?</Text>
            <View style={styles.deleteActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowDeleteConfirm(null)} activeOpacity={0.7}>
                <Text style={styles.cancelBtnText}>Abbrechen</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtnConfirm} onPress={confirmDelete} activeOpacity={0.7}>
                <Trash2 size={14} color={Colors.white} strokeWidth={1.7} />
                <Text style={styles.deleteBtnConfirmText}>Löschen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Regular Lesson Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, styles.addModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Neue Stunde</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.addFormScroll}>
              <Text style={styles.fieldLabel}>Fach</Text>
              {subjectOptions.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                  {subjectOptions.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.chip, newSubject === s && styles.chipActive]}
                      onPress={() => { Haptics.selectionAsync(); setNewSubject(s); }}
                    >
                      <Text style={[styles.chipText, newSubject === s && styles.chipTextActive]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <TextInput
                  style={styles.input}
                  value={newSubject}
                  onChangeText={setNewSubject}
                  placeholder="z.B. Ma, De, En"
                  placeholderTextColor={Colors.textLight}
                />
              )}

              <Text style={styles.fieldLabel}>Klasse</Text>
              <TextInput
                style={styles.input}
                value={newClassName}
                onChangeText={setNewClassName}
                placeholder="z.B. 9a"
                placeholderTextColor={Colors.textLight}
              />

              <Text style={styles.fieldLabel}>Raum</Text>
              <TextInput
                style={styles.input}
                value={newRoom}
                onChangeText={setNewRoom}
                placeholder="z.B. R208"
                placeholderTextColor={Colors.textLight}
              />

              <Text style={styles.fieldLabel}>Farbe</Text>
              <View style={styles.colorRow}>
                {SCHEDULE_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.colorDot, { backgroundColor: c }, newColor === c && styles.colorDotActive]}
                    onPress={() => { Haptics.selectionAsync(); setNewColor(c); }}
                  >
                    {newColor === c && <Check size={12} color={Colors.white} strokeWidth={3} />}
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Wochentage</Text>
              <View style={styles.dayPickerRow}>
                {DAYS.map((d, idx) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.dayChip, newDayIndices.includes(idx) && styles.dayChipActive]}
                    onPress={() => handleToggleDayIndex(idx)}
                  >
                    <Text style={[styles.dayChipText, newDayIndices.includes(idx) && styles.dayChipTextActive]}>{d}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Stunden</Text>
              <View style={styles.periodGrid}>
                {timeSlots.map((slot) => {
                  const sel = newPeriods.includes(slot.period);
                  return (
                    <TouchableOpacity
                      key={slot.period}
                      style={[styles.periodBtn, sel && styles.periodBtnActive]}
                      onPress={() => handleTogglePeriod(slot.period)}
                    >
                      <Text style={[styles.periodBtnNum, sel && styles.periodBtnNumActive]}>{slot.period + 1}</Text>
                      <Text style={[styles.periodBtnTime, sel && styles.periodBtnTimeActive]}>{slot.startTime}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={handleAddEntry} activeOpacity={0.7}>
              <Text style={styles.saveBtnText}>Hinzufügen</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add One-Time Event Modal */}
      <Modal visible={showEventModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, styles.addModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Einmaliges Ereignis</Text>
              <TouchableOpacity onPress={() => setShowEventModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.addFormScroll}>
              <Text style={styles.fieldLabel}>Titel</Text>
              <TextInput
                style={styles.input}
                value={eventTitle}
                onChangeText={setEventTitle}
                placeholder="z.B. Wandertag, Konferenz"
                placeholderTextColor={Colors.textLight}
              />

              <Text style={styles.fieldLabel}>Datum</Text>
              <View style={styles.timeInputRow}>
                <Calendar size={16} color={Colors.textSecondary} strokeWidth={1.7} />
                <TextInput
                  style={[styles.input, styles.timeInput]}
                  value={eventDate}
                  onChangeText={setEventDate}
                  placeholder="JJJJ-MM-TT"
                  placeholderTextColor={Colors.textLight}
                  maxLength={10}
                />
              </View>

              <View style={styles.allDayRow}>
                <Text style={styles.fieldLabel}>Ganztägig</Text>
                <Switch
                  value={eventIsAllDay}
                  onValueChange={(val) => {
                    Haptics.selectionAsync();
                    setEventIsAllDay(val);
                  }}
                  trackColor={{ false: Colors.inputBg, true: Colors.text }}
                  thumbColor={Colors.white}
                />
              </View>

              {eventIsAllDay ? (
                <View>
                  <Text style={styles.fieldLabel}>Startzeit</Text>
                  <View style={styles.timeInputRow}>
                    <Clock size={16} color={Colors.textSecondary} strokeWidth={1.7} />
                    <TextInput
                      style={[styles.input, styles.timeInput]}
                      value={eventAllDayStart}
                      onChangeText={setEventAllDayStart}
                      placeholder="08:00"
                      placeholderTextColor={Colors.textLight}
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                    />
                  </View>
                  <Text style={styles.fieldLabel}>Endzeit</Text>
                  <View style={styles.timeInputRow}>
                    <Clock size={16} color={Colors.textSecondary} strokeWidth={1.7} />
                    <TextInput
                      style={[styles.input, styles.timeInput]}
                      value={eventAllDayEnd}
                      onChangeText={setEventAllDayEnd}
                      placeholder="15:30"
                      placeholderTextColor={Colors.textLight}
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                    />
                  </View>
                </View>
              ) : (
                <View>
                  <Text style={styles.fieldLabel}>Stunden</Text>
                  <View style={styles.periodGrid}>
                    {timeSlots.map((slot) => {
                      const sel = eventPeriods.includes(slot.period);
                      return (
                        <TouchableOpacity
                          key={slot.period}
                          style={[styles.periodBtn, sel && styles.periodBtnActive]}
                          onPress={() => handleToggleEventPeriod(slot.period)}
                        >
                          <Text style={[styles.periodBtnNum, sel && styles.periodBtnNumActive]}>{slot.period + 1}</Text>
                          <Text style={[styles.periodBtnTime, sel && styles.periodBtnTimeActive]}>{slot.startTime}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              <Text style={styles.fieldLabel}>Raum / Ort</Text>
              <TextInput
                style={styles.input}
                value={eventRoom}
                onChangeText={setEventRoom}
                placeholder="z.B. Aula, Museum"
                placeholderTextColor={Colors.textLight}
              />

              <Text style={styles.fieldLabel}>Farbe</Text>
              <View style={styles.colorRow}>
                {EVENT_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.colorDot, { backgroundColor: c }, eventColor === c && styles.colorDotActive]}
                    onPress={() => { Haptics.selectionAsync(); setEventColor(c); }}
                  >
                    {eventColor === c && <Check size={12} color={Colors.white} strokeWidth={3} />}
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Notizen</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={eventNotes}
                onChangeText={setEventNotes}
                placeholder="Details zum Ereignis..."
                placeholderTextColor={Colors.textLight}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={handleAddEvent} activeOpacity={0.7}>
              <Text style={styles.saveBtnText}>Hinzufügen</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add Substitution Modal */}
      <Modal visible={showSubModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, styles.addModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Vertretung</Text>
              <TouchableOpacity onPress={() => setShowSubModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.addFormScroll}>
              <Text style={styles.fieldLabel}>Fach (Optional)</Text>
              {subjectOptions.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                  <TouchableOpacity
                    style={[styles.chip, !subSubject && styles.chipActive]}
                    onPress={() => { Haptics.selectionAsync(); setSubSubject(''); }}
                  >
                    <Text style={[styles.chipText, !subSubject && styles.chipTextActive]}>Keine</Text>
                  </TouchableOpacity>
                  {subjectOptions.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.chip, subSubject === s && styles.chipActive]}
                      onPress={() => { Haptics.selectionAsync(); setSubSubject(s); }}
                    >
                      <Text style={[styles.chipText, subSubject === s && styles.chipTextActive]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <TextInput
                  style={styles.input}
                  value={subSubject}
                  onChangeText={setSubSubject}
                  placeholder="Leer lassen für Betreuung"
                  placeholderTextColor={Colors.textLight}
                />
              )}

              <Text style={styles.fieldLabel}>Klasse (Optional)</Text>
              <TextInput
                style={styles.input}
                value={subClassName}
                onChangeText={setSubClassName}
                placeholder="z.B. 9a"
                placeholderTextColor={Colors.textLight}
              />

              <Text style={styles.fieldLabel}>Raum *</Text>
              <TextInput
                style={styles.input}
                value={subRoom}
                onChangeText={setSubRoom}
                placeholder="z.B. R208, Sporthalle"
                placeholderTextColor={Colors.textLight}
              />

              <Text style={styles.fieldLabel}>Datum</Text>
              <View style={styles.timeInputRow}>
                <Calendar size={16} color={Colors.textSecondary} strokeWidth={1.7} />
                <TextInput
                  style={[styles.input, styles.timeInput]}
                  value={subDate}
                  onChangeText={setSubDate}
                  placeholder="JJJJ-MM-TT"
                  placeholderTextColor={Colors.textLight}
                  maxLength={10}
                />
              </View>

              <Text style={styles.fieldLabel}>Stunden</Text>
              <View style={styles.periodGrid}>
                {timeSlots.map((slot) => {
                  const sel = subPeriods.includes(slot.period);
                  return (
                    <TouchableOpacity
                      key={slot.period}
                      style={[styles.periodBtn, sel && styles.periodBtnActive]}
                      onPress={() => handleToggleSubPeriod(slot.period)}
                    >
                      <Text style={[styles.periodBtnNum, sel && styles.periodBtnNumActive]}>{slot.period + 1}</Text>
                      <Text style={[styles.periodBtnTime, sel && styles.periodBtnTimeActive]}>{slot.startTime}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Farbe</Text>
              <View style={styles.colorRow}>
                {['#94A3B8', '#64748B', '#475569', ...SCHEDULE_COLORS].map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.colorDot, { backgroundColor: c }, subColor === c && styles.colorDotActive]}
                    onPress={() => { Haptics.selectionAsync(); setSubColor(c); }}
                  >
                    {subColor === c && <Check size={12} color={Colors.white} strokeWidth={3} />}
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={handleAddSubstitution} activeOpacity={0.7}>
              <Text style={styles.saveBtnText}>Hinzufügen</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Time Settings Modal */}
      <Modal visible={showSettingsModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, styles.settingsModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Raster-Einstellungen</Text>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.addFormScroll}>
              <Text style={styles.fieldLabel}>Unterrichtsbeginn</Text>
              <View style={styles.timeInputRow}>
                <Clock size={16} color={Colors.textSecondary} strokeWidth={1.7} />
                <TextInput
                  style={[styles.input, styles.timeInput]}
                  value={tempStartTime}
                  onChangeText={setTempStartTime}
                  placeholder="08:00"
                  placeholderTextColor={Colors.textLight}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                />
              </View>

              <Text style={styles.fieldLabel}>Stundendauer (Minuten)</Text>
              <TextInput
                style={styles.input}
                value={tempDuration}
                onChangeText={setTempDuration}
                placeholder="45"
                placeholderTextColor={Colors.textLight}
                keyboardType="number-pad"
                maxLength={3}
              />

              <Text style={styles.fieldLabel}>Anzahl Stunden</Text>
              <TextInput
                style={styles.input}
                value={tempMaxPeriods}
                onChangeText={setTempMaxPeriods}
                placeholder="9"
                placeholderTextColor={Colors.textLight}
                keyboardType="number-pad"
                maxLength={2}
              />

              <Text style={styles.fieldLabel}>Pausen nach Stunde</Text>
              <View style={styles.periodGrid}>
                {Array.from({ length: parseInt(tempMaxPeriods, 10) || 9 }, (_, i) => {
                  const sel = tempBreakAfter.includes(i);
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.periodBtn, sel && styles.periodBtnActive]}
                      onPress={() => handleToggleBreakAfter(i)}
                    >
                      <Text style={[styles.periodBtnNum, sel && styles.periodBtnNumActive]}>{i + 1}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {tempBreakAfter.length > 0 && (
                <>
                  <Text style={styles.fieldLabel}>Pausendauer (Minuten)</Text>
                  {tempBreakAfter.map((period) => (
                    <View key={period} style={styles.breakDurRow}>
                      <Text style={styles.breakDurLabel}>Nach Std. {period + 1}:</Text>
                      <TextInput
                        style={[styles.input, styles.breakDurInput]}
                        value={String(tempBreakDurations[period] ?? 10)}
                        onChangeText={(v) => handleBreakDurationChange(period, v)}
                        keyboardType="number-pad"
                        maxLength={3}
                      />
                      <Text style={styles.breakDurUnit}>Min</Text>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSettings} activeOpacity={0.7}>
              <Text style={styles.saveBtnText}>Speichern</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnPrimary: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 4,
  },
  weekBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekLabelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  weekLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    letterSpacing: 0.2,
  },
  gridWrapper: {
    flex: 1,
    backgroundColor: Colors.inputBg,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    overflow: 'hidden',
  },
  gridRow: {
    flex: 1,
    flexDirection: 'row',
  },
  timeColumnOuter: {
    width: TIME_COL_WIDTH,
    backgroundColor: Colors.background,
    borderRightWidth: 0.5,
    borderRightColor: Colors.divider,
    zIndex: 2,
  },
  cornerCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.divider,
    backgroundColor: Colors.background,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.divider,
  },
  dayHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 0.5,
    borderLeftColor: Colors.divider,
  },
  dayHeaderToday: {
    backgroundColor: Colors.primaryLight,
  },
  dayName: {
    fontSize: 10,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.3,
  },
  dayNameToday: {
    color: Colors.primary,
    fontWeight: '700' as const,
  },
  dayDate: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 1,
  },
  dayDateToday: {
    color: Colors.primary,
    fontWeight: '800' as const,
  },
  gridBody: {
    flexDirection: 'row',
  },
  dayColumn: {
    borderLeftWidth: 0.5,
    borderLeftColor: Colors.divider,
  },
  dayColumnToday: {
    backgroundColor: 'rgba(22,23,26,0.015)',
  },
  gridCell: {
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.divider,
  },
  timeCell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.divider,
  },
  timeStart: {
    fontSize: 7,
    fontWeight: '500' as const,
    color: Colors.textLight,
    letterSpacing: 0.1,
  },
  timePeriod: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  breakGap: {
    backgroundColor: 'transparent',
  },
  lessonCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: Colors.cardBorder,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0,0,0,0.06)',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1,
        shadowRadius: 2,
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderStyle: 'dashed' as const,
  },
  substitutionCard: {
    flexDirection: 'row',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: '#1E293B',
  },
  eventIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  accentBar: {
    width: 3,
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: 3,
    paddingVertical: 2,
    justifyContent: 'center',
  },
  cardClass: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: 0.1,
  },
  cardSubject: {
    fontSize: 9,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  cardRoom: {
    fontSize: 8,
    fontWeight: '400' as const,
    color: Colors.textLight,
  },
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  actionSheetContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  actionSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.divider,
    alignSelf: 'center',
    marginBottom: 16,
  },
  actionSheetTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  actionSheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.divider,
  },
  actionSheetIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSheetOptionText: {
    flex: 1,
  },
  actionSheetOptionTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  actionSheetOptionDesc: {
    fontSize: 12,
    fontWeight: '400' as const,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  actionSheetCancel: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
  },
  actionSheetCancelText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  addModalContent: {
    maxHeight: '85%' as unknown as number,
  },
  settingsModalContent: {
    maxHeight: '80%' as unknown as number,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  addFormScroll: {
    flexGrow: 0,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 14,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  notesInput: {
    minHeight: 72,
    paddingTop: 12,
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeInput: {
    flex: 1,
  },
  allDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  chipRow: {
    flexDirection: 'row',
    maxHeight: 38,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.inputBg,
    marginRight: 6,
  },
  chipActive: {
    backgroundColor: Colors.text,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: Colors.white,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotActive: {
    borderWidth: 2.5,
    borderColor: Colors.text,
  },
  dayPickerRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dayChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
  },
  dayChipActive: {
    backgroundColor: Colors.text,
  },
  dayChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  dayChipTextActive: {
    color: Colors.white,
  },
  periodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  periodBtn: {
    width: 56,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
  },
  periodBtnActive: {
    backgroundColor: Colors.text,
  },
  periodBtnNum: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  periodBtnNumActive: {
    color: Colors.white,
  },
  periodBtnTime: {
    fontSize: 9,
    fontWeight: '500' as const,
    color: Colors.textLight,
    marginTop: 1,
  },
  periodBtnTimeActive: {
    color: 'rgba(255,255,255,0.7)',
  },
  saveBtn: {
    backgroundColor: Colors.text,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
    letterSpacing: 0.2,
  },
  deleteText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  deleteActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  deleteBtnConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.negative,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  deleteBtnConfirmText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  breakDurRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  breakDurLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
    width: 90,
  },
  breakDurInput: {
    flex: 1,
    paddingVertical: 8,
    textAlign: 'center' as const,
  },
  breakDurUnit: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
});
