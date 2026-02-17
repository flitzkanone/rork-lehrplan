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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import {
  TIME_SLOTS,
  PLACEHOLDER_ENTRIES,
  DAYS,
  BREAK_AFTER_PERIODS,
  ACCENT_COLORS,
} from '@/mocks/schedule';
import type { ScheduleEntry } from '@/mocks/schedule';

const SCREEN_WIDTH = Dimensions.get('window').width;
const TIME_COL_WIDTH = 52;
const ROW_HEIGHT = 66;
const BREAK_HEIGHT = 14;
const HEADER_HEIGHT = 54;
const DAY_COL_WIDTH = Math.max(78, Math.floor((SCREEN_WIDTH - TIME_COL_WIDTH) / 4.3));
const TOTAL_GRID_WIDTH = DAY_COL_WIDTH * 5;

const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function getAccentColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  return ACCENT_COLORS[Math.abs(hash) % ACCENT_COLORS.length];
}

function getYPosition(period: number): number {
  let y = 0;
  for (let p = 0; p < period; p++) {
    y += ROW_HEIGHT;
    if (BREAK_AFTER_PERIODS.includes(p)) {
      y += BREAK_HEIGHT;
    }
  }
  return y;
}

function getCardHeight(periodStart: number, periodEnd: number): number {
  return getYPosition(periodEnd) + ROW_HEIGHT - getYPosition(periodStart);
}

function getTotalGridHeight(): number {
  const lastSlot = TIME_SLOTS[TIME_SLOTS.length - 1];
  return getYPosition(lastSlot.period) + ROW_HEIGHT;
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

const LessonCard = React.memo(({ entry, top, height }: { entry: ScheduleEntry; top: number; height: number }) => {
  const accentColor = getAccentColor(entry.className);
  return (
    <View
      style={[
        styles.lessonCard,
        {
          position: 'absolute' as const,
          top: top + 2,
          height: height - 4,
          left: 2,
          width: DAY_COL_WIDTH - 4,
        },
      ]}
    >
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      <View style={styles.cardContent}>
        <Text style={styles.cardClass} numberOfLines={1}>{entry.className}</Text>
        <Text style={styles.cardSubject} numberOfLines={1}>{entry.subject}</Text>
        <Text style={styles.cardRoom} numberOfLines={1}>{entry.room}</Text>
      </View>
    </View>
  );
});

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const timeScrollRef = useRef<ScrollView>(null);
  const [gridAreaHeight, setGridAreaHeight] = useState<number>(0);

  const today = useMemo(() => new Date(), []);

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
    (date: Date): boolean => {
      return (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
      );
    },
    [today]
  );

  const entriesByDay = useMemo(() => {
    const map: Record<number, ScheduleEntry[]> = {};
    for (let i = 0; i < 5; i++) {
      map[i] = PLACEHOLDER_ENTRIES.filter((e) => e.dayIndex === i);
    }
    return map;
  }, []);

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

  const totalGridHeight = getTotalGridHeight();

  const renderTimeColumn = useMemo(() => {
    return (
      <View style={{ height: totalGridHeight }}>
        {TIME_SLOTS.map((slot) => {
          const top = getYPosition(slot.period);
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
              <Text style={styles.timeStart}>{slot.startTime}</Text>
              <Text style={styles.timePeriod}>{slot.period}</Text>
              <Text style={styles.timeEnd}>{slot.endTime}</Text>
            </View>
          );
        })}
        {BREAK_AFTER_PERIODS.map((period) => {
          const top = getYPosition(period) + ROW_HEIGHT;
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
  }, [totalGridHeight]);

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
          {TIME_SLOTS.map((slot) => {
            const top = getYPosition(slot.period);
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
          {BREAK_AFTER_PERIODS.map((period) => {
            const top = getYPosition(period) + ROW_HEIGHT;
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
            const top = getYPosition(entry.periodStart);
            const height = getCardHeight(entry.periodStart, entry.periodEnd);
            return <LessonCard key={entry.id} entry={entry} top={top} height={height} />;
          })}
        </View>
      );
    },
    [entriesByDay, isToday, weekData.dates, totalGridHeight]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Stundenplan</Text>
        <View style={styles.weekNav}>
          <TouchableOpacity
            onPress={handlePrevWeek}
            style={styles.weekBtn}
            activeOpacity={0.5}
            testID="schedule-prev-week"
          >
            <ChevronLeft size={18} color={Colors.text} strokeWidth={2.2} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleTodayPress}
            activeOpacity={0.6}
            style={styles.weekLabelBtn}
            testID="schedule-today"
          >
            <Text style={styles.weekLabel}>KW {weekData.weekNumber}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleNextWeek}
            style={styles.weekBtn}
            activeOpacity={0.5}
            testID="schedule-next-week"
          >
            <ChevronRight size={18} color={Colors.text} strokeWidth={2.2} />
          </TouchableOpacity>
        </View>
      </View>

      <View
        style={styles.gridWrapper}
        onLayout={(e) => setGridAreaHeight(e.nativeEvent.layout.height)}
      >
        <View style={styles.gridRow}>
          <View style={styles.timeColumnOuter}>
            <View style={[styles.cornerCell, { height: HEADER_HEIGHT }]}>
              <Text style={styles.cornerWeek}>KW {weekData.weekNumber}</Text>
              <Text style={styles.cornerMonth}>{weekData.month}</Text>
            </View>
            <ScrollView
              ref={timeScrollRef}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              style={gridAreaHeight > 0 ? { height: gridAreaHeight - HEADER_HEIGHT } : undefined}
            >
              {renderTimeColumn}
            </ScrollView>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            bounces={false}
            style={styles.gridHorizontal}
          >
            <View style={{ width: TOTAL_GRID_WIDTH }}>
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
                        {DAYS[idx]}.
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
          </ScrollView>
        </View>
      </View>
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weekBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekLabelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  weekLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    letterSpacing: 0.2,
  },
  gridWrapper: {
    flex: 1,
    backgroundColor: Colors.inputBg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
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
  cornerWeek: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  cornerMonth: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 1,
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
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.3,
  },
  dayNameToday: {
    color: Colors.primary,
    fontWeight: '700' as const,
  },
  dayDate: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 1,
  },
  dayDateToday: {
    color: Colors.primary,
    fontWeight: '800' as const,
  },
  gridHorizontal: {
    flex: 1,
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
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.divider,
  },
  timeStart: {
    fontSize: 9,
    fontWeight: '500' as const,
    color: Colors.textLight,
    letterSpacing: 0.2,
  },
  timePeriod: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    marginVertical: 1,
  },
  timeEnd: {
    fontSize: 9,
    fontWeight: '500' as const,
    color: Colors.textLight,
    letterSpacing: 0.2,
  },
  breakGap: {
    backgroundColor: 'transparent',
  },
  lessonCard: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: Colors.cardBorder,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0,0,0,0.08)',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1,
        shadowRadius: 3,
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  accentBar: {
    width: 3.5,
  },
  cardContent: {
    flex: 1,
    paddingHorizontal: 5,
    paddingVertical: 4,
    justifyContent: 'center',
  },
  cardClass: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: 0.1,
  },
  cardSubject: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  cardRoom: {
    fontSize: 10,
    fontWeight: '400' as const,
    color: Colors.textLight,
    marginTop: 1,
  },
});
