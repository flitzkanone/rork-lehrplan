import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Filter, TrendingUp, TrendingDown, Minus, Plus, Circle, Check, X, Clock, ThumbsUp, ThumbsDown } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/context/AppContext';
import { StatisticsScreenSkeleton } from '@/components/SkeletonLoader';
import type { Student } from '@/types';

function StatBadge({ count, type }: { count: number; type: '+' | 'o' | '-' }) {
  const config = {
    '+': {
      bg: Colors.positiveLight,
      color: Colors.positive,
      borderColor: 'rgba(34,164,93,0.15)',
      icon: <Plus size={11} color={Colors.positive} strokeWidth={2.8} />,
      label: 'Gut',
    },
    'o': {
      bg: Colors.neutralLight,
      color: Colors.neutral,
      borderColor: 'rgba(148,151,158,0.15)',
      icon: <Circle size={10} color={Colors.neutral} strokeWidth={2.8} />,
      label: 'Neutral',
    },
    '-': {
      bg: Colors.negativeLight,
      color: Colors.negative,
      borderColor: 'rgba(204,59,42,0.15)',
      icon: <Minus size={11} color={Colors.negative} strokeWidth={2.8} />,
      label: 'Schlecht',
    },
  };

  const c = config[type];

  return (
    <View style={[statBadgeStyles.badge, { backgroundColor: c.bg, borderColor: c.borderColor }]}>
      <View style={[statBadgeStyles.iconWrap, { backgroundColor: c.borderColor }]}>
        {c.icon}
      </View>
      <Text style={[statBadgeStyles.count, { color: c.color }]}>{count}</Text>
    </View>
  );
}

const statBadgeStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    paddingRight: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  iconWrap: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
});

function MiniProgressBar({ positive, neutral, negative, total }: { positive: number; neutral: number; negative: number; total: number }) {
  if (total === 0) return <View style={barStyles.empty}><Text style={barStyles.emptyText}>Keine Daten</Text></View>;

  return (
    <View style={barStyles.container}>
      <View style={barStyles.statsRow}>
        <StatBadge count={positive} type="+" />
        <StatBadge count={neutral} type="o" />
        <StatBadge count={negative} type="-" />
      </View>
      <View style={barStyles.barBg}>
        {positive > 0 && <View style={[barStyles.segment, { flex: positive, backgroundColor: Colors.positive, borderTopLeftRadius: 3, borderBottomLeftRadius: 3 }]} />}
        {neutral > 0 && <View style={[barStyles.segment, { flex: neutral, backgroundColor: Colors.neutral }]} />}
        {negative > 0 && <View style={[barStyles.segment, { flex: negative, backgroundColor: Colors.negative, borderTopRightRadius: 3, borderBottomRightRadius: 3 }]} />}
      </View>
    </View>
  );
}

function HomeworkBar({ done, late, missing, total }: { done: number; late: number; missing: number; total: number }) {
  if (total === 0) return null;

  return (
    <View style={barStyles.container}>
      <View style={barStyles.statsRow}>
        <View style={[hwBadgeStyles.badge, { backgroundColor: '#F0FDF4', borderColor: 'rgba(22,163,74,0.15)' }]}>
          <View style={[hwBadgeStyles.iconWrap, { backgroundColor: 'rgba(22,163,74,0.15)' }]}>
            <Check size={11} color="#16A34A" strokeWidth={2.8} />
          </View>
          <Text style={[hwBadgeStyles.count, { color: '#16A34A' }]}>{done}</Text>
        </View>
        <View style={[hwBadgeStyles.badge, { backgroundColor: Colors.warningLight, borderColor: 'rgba(217,119,6,0.15)' }]}>
          <View style={[hwBadgeStyles.iconWrap, { backgroundColor: 'rgba(217,119,6,0.15)' }]}>
            <Clock size={10} color="#D97706" strokeWidth={2.8} />
          </View>
          <Text style={[hwBadgeStyles.count, { color: '#D97706' }]}>{late}</Text>
        </View>
        <View style={[hwBadgeStyles.badge, { backgroundColor: Colors.negativeLight, borderColor: 'rgba(204,59,42,0.15)' }]}>
          <View style={[hwBadgeStyles.iconWrap, { backgroundColor: 'rgba(204,59,42,0.15)' }]}>
            <X size={11} color={Colors.negative} strokeWidth={2.8} />
          </View>
          <Text style={[hwBadgeStyles.count, { color: Colors.negative }]}>{missing}</Text>
        </View>
      </View>
      <View style={barStyles.barBg}>
        {done > 0 && <View style={[barStyles.segment, { flex: done, backgroundColor: '#16A34A', borderTopLeftRadius: 3, borderBottomLeftRadius: 3 }]} />}
        {late > 0 && <View style={[barStyles.segment, { flex: late, backgroundColor: '#D97706' }]} />}
        {missing > 0 && <View style={[barStyles.segment, { flex: missing, backgroundColor: Colors.negative, borderTopRightRadius: 3, borderBottomRightRadius: 3 }]} />}
      </View>
    </View>
  );
}

const hwBadgeStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    paddingRight: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  iconWrap: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    fontSize: 13,
    fontWeight: '700' as const,
  },
});

const barStyles = StyleSheet.create({
  container: { gap: 8 },
  statsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  barBg: { height: 6, borderRadius: 3, backgroundColor: Colors.inputBg, flexDirection: 'row', overflow: 'hidden' },
  segment: { height: 6 },
  empty: { paddingVertical: 4 },
  emptyText: { fontSize: 12, color: Colors.textLight },
});

export default function StatisticsScreen() {
  const { data, isLoading } = useApp();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState<string>('');
  const [filterSubject, setFilterSubject] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState<boolean>(false);

  const allStudentsWithClass = useMemo(() => {
    const result: { student: Student; classId: string; className: string }[] = [];
    for (const cls of data.classes) {
      for (const s of cls.students) {
        result.push({ student: s, classId: cls.id, className: cls.name });
      }
    }
    return result.sort((a, b) => a.student.lastName.localeCompare(b.student.lastName));
  }, [data.classes]);

  const filtered = useMemo(() => {
    let items = allStudentsWithClass;
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (i) =>
          i.student.firstName.toLowerCase().includes(q) ||
          i.student.lastName.toLowerCase().includes(q) ||
          i.className.toLowerCase().includes(q)
      );
    }
    return items;
  }, [allStudentsWithClass, search]);

  const getStudentStats = useCallback(
    (studentId: string) => {
      let entries = data.participations.filter((p) => p.studentId === studentId);
      if (filterSubject) {
        entries = entries.filter((p) => p.subject === filterSubject);
      }
      const positive = entries.filter((e) => e.rating === '+').length;
      const neutral = entries.filter((e) => e.rating === 'o').length;
      const negative = entries.filter((e) => e.rating === '-').length;
      return { positive, neutral, negative, total: entries.length };
    },
    [data.participations, filterSubject]
  );

  const getHomeworkStats = useCallback(
    (studentId: string) => {
      const hwEntries = (data.homeworkEntries || []).filter((h) => h.studentId === studentId);
      let filtered = hwEntries;
      if (filterSubject) {
        filtered = filtered.filter((h) => h.subject === filterSubject);
      }
      const done = filtered.filter((h) => h.status === 'done').length;
      const late = filtered.filter((h) => h.status === 'late').length;
      const missing = filtered.filter((h) => h.status === 'missing').length;
      return { done, late, missing, total: filtered.length };
    },
    [data.homeworkEntries, filterSubject]
  );

  if (isLoading) {
    return <StatisticsScreenSkeleton />;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.titleWrap, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.screenTitle}>Statistik</Text>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={15} color={Colors.textLight} strokeWidth={1.7} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Suchen..."
            placeholderTextColor={Colors.textLight}
          />
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, showFilters && styles.filterBtnActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Filter size={15} color={showFilters ? Colors.white : Colors.textSecondary} strokeWidth={1.7} />
        </TouchableOpacity>
      </View>

      {showFilters && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
          <TouchableOpacity
            style={[styles.filterChip, !filterSubject && styles.filterChipActive]}
            onPress={() => setFilterSubject(null)}
          >
            <Text style={[styles.filterChipText, !filterSubject && styles.filterChipTextActive]}>Alle</Text>
          </TouchableOpacity>
          {data.profile.subjects.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.filterChip, filterSubject === s && styles.filterChipActive]}
              onPress={() => setFilterSubject(s)}
            >
              <Text style={[styles.filterChipText, filterSubject === s && styles.filterChipTextActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Keine Ergebnisse</Text>
            <Text style={styles.emptySubtitle}>Passen Sie Ihre Suche oder Filter an.</Text>
          </View>
        ) : (
          filtered.map((item) => {
            const stats = getStudentStats(item.student.id);
            const hwStats = getHomeworkStats(item.student.id);
            const trend = stats.total > 0 ? stats.positive - stats.negative : 0;
            return (
              <View key={`${item.classId}-${item.student.id}`} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardLeft}>
                    <View style={[
                      styles.avatar,
                      trend > 0 && styles.avatarPositive,
                      trend < 0 && styles.avatarNegative,
                    ]}>
                      <Text style={[
                        styles.avatarText,
                        trend > 0 && { color: Colors.positive },
                        trend < 0 && { color: Colors.negative },
                      ]}>
                        {(item.student.firstName || '?')[0]}{(item.student.lastName || '?')[0]}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.studentName}>
                        {item.student.lastName}{item.student.lastName ? ', ' : ''}{item.student.firstName}
                      </Text>
                      <Text style={styles.className}>{item.className}</Text>
                    </View>
                  </View>
                  {stats.total > 0 && (
                    <View style={[styles.trendBadge, {
                      backgroundColor: trend > 0 ? Colors.positiveLight : trend < 0 ? Colors.negativeLight : Colors.neutralLight,
                      borderWidth: 1,
                      borderColor: trend > 0 ? 'rgba(34,164,93,0.2)' : trend < 0 ? 'rgba(204,59,42,0.2)' : 'rgba(148,151,158,0.2)',
                    }]}>
                      {trend > 0 ? (
                        <TrendingUp size={13} color={Colors.positive} strokeWidth={2} />
                      ) : trend < 0 ? (
                        <TrendingDown size={13} color={Colors.negative} strokeWidth={2} />
                      ) : (
                        <Minus size={13} color={Colors.neutral} strokeWidth={2} />
                      )}
                    </View>
                  )}
                </View>

                <View style={styles.sectionLabel}>
                  <View style={styles.sectionLabelRow}>
                    <ThumbsUp size={12} color={Colors.textSecondary} strokeWidth={2} />
                    <Text style={styles.sectionLabelText}>Mitarbeit</Text>
                  </View>
                  {stats.total > 0 && (
                    <Text style={styles.totalCount}>{stats.total} Bewertungen</Text>
                  )}
                </View>
                <MiniProgressBar {...stats} />

                <View style={styles.sectionDivider} />

                <View style={styles.sectionLabel}>
                  <View style={styles.sectionLabelRow}>
                    <ThumbsDown size={12} color={Colors.textSecondary} strokeWidth={2} />
                    <Text style={styles.sectionLabelText}>Hausaufgaben</Text>
                  </View>
                  {hwStats.total > 0 && (
                    <Text style={styles.totalCount}>{hwStats.total} Einträge</Text>
                  )}
                </View>
                <HomeworkBar {...hwStats} />
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  titleWrap: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  screenTitle: {
    fontSize: 30,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: {
    backgroundColor: Colors.primary,
  },
  filterRow: {
    maxHeight: 42,
  },
  filterRowContent: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: Colors.inputBg,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 20,
    gap: 10,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.divider,
    ...Platform.select({
      ios: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8 },
      android: { elevation: 1 },
      default: {},
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPositive: {
    backgroundColor: Colors.positiveLight,
    borderWidth: 1.5,
    borderColor: Colors.positive,
  },
  avatarNegative: {
    backgroundColor: Colors.negativeLight,
    borderWidth: 1.5,
    borderColor: Colors.negative,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  className: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  trendBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sectionLabelText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  totalCount: {
    fontSize: 11,
    color: Colors.textLight,
    fontWeight: '500' as const,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: 2,
  },
});
