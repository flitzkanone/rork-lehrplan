import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Platform,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Plus, Settings2, X, Trash2, Check, Clock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/context/AppContext';
import {
  DAYS,
  SCHEDULE_COLORS,
  generateTimeSlots,
} from '@/mocks/schedule';
import type { ScheduleTimeSlot } from '@/mocks/schedule';
import type { ScheduleEntry, ScheduleTimeSettings } from '@/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const TIME_COL_WIDTH = 38;
const DAY_COL_WIDTH = Math.floor((SCREEN_WIDTH - TIME_COL_WIDTH) / 5);
const TOTAL_GRID_WIDTH = DAY_COL_WIDTH * 5;
const ROW_HEIGHT = 52;
const BREAK_HEIGHT = 6;
const HEADER_HEIGHT = 44;

const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function getYPosition(period: number, breakAfterPeriods: number[]): number {
  let y = 0;
  for (let p = 0; p < period; p++) {
    y += ROW_HEIGHT;
    if (breakAfterPeriods.includes(p)) {
      y += BREAK_HEIGHT;
    }
  }
  return y;
}

function getCardHeight(periodStart: number, periodEnd: number, breakAfterPeriods: number[]): number {
  return getYPosition(periodEnd, breakAfterPeriods) + ROW_HEIGHT - getYPosition(periodStart, breakAfterPeriods);
}

function getTotalGridHeight(maxPeriods: number, breakAfterPeriods: number[]): number {
  return getYPosition(maxPeriods - 1, breakAfterPeriods) + ROW_HEIGHT;
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
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

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const {
    scheduleEntries,
    scheduleTimeSettings,
    addScheduleEntry,
    deleteScheduleEntry,
    saveScheduleTimeSettings,
    data,
  } = useApp();

  const [weekOffset, setWeekOffset] = useState<number>(0);
  const timeScrollRef = useRef<ScrollView>(null);
  const [gridAreaHeight, setGridAreaHeight] = useState<number>(0);

  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const [newSubject, setNewSubject] = useState<string>('');
  const [newClassName, setNewClassName] = useState<string>('');
  const [newRoom, setNewRoom] = useState<string>('');
  const [newColor, setNewColor] = useState<string>(SCHEDULE_COLORS[0]);
  const [newDayIndex, setNewDayIndex] = useState<number>(0);
  const [newPeriods, setNewPeriods] = useState<number[]>([]);

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
  const totalGridHeight = getTotalGridHeight(scheduleTimeSettings.maxPeriods, breakAfterPeriods);

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

  const entriesByDay = useMemo(() => {
    const map: Record<number, ScheduleEntry[]> = {};
    for (let i = 0; i < 5; i++) {
      map[i] = scheduleEntries.filter((e) => e.dayIndex === i);
    }
    return map;
  }, [scheduleEntries]);

  const handlePrevWeek = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWeekOffset((prev) => prev - 1);
  }, []);

  const handleNextWeek = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWeekOffset((prev) => prev + 1);
  }, []);

  const handleTodayPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWeekOffset(0);
  }, []);

  const handleGridScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      timeScrollRef.current?.scrollTo({ y, animated: false });
    },
    []
  );

  const handleDeleteEntry = useCallback(
    (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setShowDeleteConfirm(id);
    },
    []
  );

  const confirmDelete = useCallback(() => {
    if (showDeleteConfirm) {
      deleteScheduleEntry(showDeleteConfirm);
      setShowDeleteConfirm(null);
    }
  }, [showDeleteConfirm, deleteScheduleEntry]);

  const resetAddForm = useCallback(() => {
    setNewSubject('');
    setNewClassName('');
    setNewRoom('');
    setNewColor(SCHEDULE_COLORS[0]);
    setNewDayIndex(0);
    setNewPeriods([]);
  }, []);

  const handleOpenAddModal = useCallback(() => {
    resetAddForm();
    setShowAddModal(true);
  }, [resetAddForm]);

  const handleTogglePeriod = useCallback((period: number) => {
    Haptics.selectionAsync();
    setNewPeriods((prev) => {
      if (prev.includes(period)) {
        return prev.filter((p) => p !== period);
      }
      return [...prev, period].sort((a, b) => a - b);
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
    addScheduleEntry({
      dayIndex: newDayIndex,
      periodStart: sortedPeriods[0],
      periodEnd: sortedPeriods[sortedPeriods.length - 1],
      className: newClassName.trim(),
      subject: newSubject.trim(),
      room: newRoom.trim(),
      color: newColor,
    });

    setShowAddModal(false);
    resetAddForm();
  }, [newSubject, newClassName, newRoom, newColor, newDayIndex, newPeriods, addScheduleEntry, resetAddForm]);

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
          const top = getYPosition(slot.period, breakAfterPeriods);
          return (
            <View
              key={slot.period}
              style={[
                styles.timeCell,
                {
                  position: 'absolute' as const,
                  top,
                  height: ROW_HEIGHT,
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
          const top = getYPosition(period, breakAfterPeriods) + ROW_HEIGHT;
          return (
            <View
              key={`break-${period}`}
              style={[
                styles.breakGap,
                {
                  position: 'absolute' as const,
                  top,
                  height: BREAK_HEIGHT,
                  width: TIME_COL_WIDTH,
                },
              ]}
            />
          );
        })}
      </View>
    );
  }, [totalGridHeight, timeSlots, breakAfterPeriods, scheduleTimeSettings.maxPeriods]);

  const renderDayColumn = useCallback(
    (dayIndex: number) => {
      const entries = entriesByDay[dayIndex] || [];
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
            const top = getYPosition(slot.period, breakAfterPeriods);
            return (
              <View
                key={slot.period}
                style={[
                  styles.gridCell,
                  {
                    position: 'absolute' as const,
                    top,
                    height: ROW_HEIGHT,
                    width: DAY_COL_WIDTH,
                  },
                ]}
              />
            );
          })}
          {breakAfterPeriods.map((period) => {
            if (period >= scheduleTimeSettings.maxPeriods) return null;
            const top = getYPosition(period, breakAfterPeriods) + ROW_HEIGHT;
            return (
              <View
                key={`break-${period}`}
                style={{
                  position: 'absolute' as const,
                  top,
                  height: BREAK_HEIGHT,
                  width: DAY_COL_WIDTH,
                  backgroundColor: isTodayCol ? 'rgba(22,23,26,0.02)' : 'transparent',
                }}
              />
            );
          })}
          {entries.map((entry) => {
            const top = getYPosition(entry.periodStart, breakAfterPeriods);
            const height = getCardHeight(entry.periodStart, entry.periodEnd, breakAfterPeriods);
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
        </View>
      );
    },
    [entriesByDay, isToday, weekData.dates, totalGridHeight, timeSlots, breakAfterPeriods, scheduleTimeSettings.maxPeriods, handleDeleteEntry]
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
            onPress={handleOpenAddModal}
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
      >
        <View style={styles.gridRow}>
          <View style={styles.timeColumnOuter}>
            <View style={[styles.cornerCell, { height: HEADER_HEIGHT }]} />
            <ScrollView
              ref={timeScrollRef}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              style={gridAreaHeight > 0 ? { height: gridAreaHeight - HEADER_HEIGHT } : undefined}
            >
              {renderTimeColumn}
            </ScrollView>
          </View>

          <View style={{ flex: 1, width: TOTAL_GRID_WIDTH }}>
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

            <ScrollView
              onScroll={handleGridScroll}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              style={gridAreaHeight > 0 ? { height: gridAreaHeight - HEADER_HEIGHT } : undefined}
            >
              <View style={[styles.gridBody, { height: totalGridHeight }]}>
                {[0, 1, 2, 3, 4].map((dayIndex) => renderDayColumn(dayIndex))}
              </View>
            </ScrollView>
          </View>
        </View>
      </View>

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

      {/* Add Lesson Modal */}
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

              <Text style={styles.fieldLabel}>Wochentag</Text>
              <View style={styles.dayPickerRow}>
                {DAYS.map((d, idx) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.dayChip, newDayIndex === idx && styles.dayChipActive]}
                    onPress={() => { Haptics.selectionAsync(); setNewDayIndex(idx); }}
                  >
                    <Text style={[styles.dayChipText, newDayIndex === idx && styles.dayChipTextActive]}>{d}</Text>
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
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeInput: {
    flex: 1,
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
