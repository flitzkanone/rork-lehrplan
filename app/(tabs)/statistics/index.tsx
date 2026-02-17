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
import { Search, Filter, TrendingUp, TrendingDown, Minus, Check, X, Clock } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useApp } from '@/context/AppContext';
import { StatisticsScreenSkeleton } from '@/components/SkeletonLoader';
import type { Student } from '@/types';

function MiniProgressBar({ positive, neutral, negative, total }: { positive: number; neutral: number; negative: number; total: number }) {
  if (total === 0) return <View style={barStyles.empty}><Text style={barStyles.emptyText}>Keine Daten</Text></View>;

  return (
    <View style={barStyles.container}>
      <View style={barStyles.barBg}>
        {positive > 0 && <View style={[barStyles.segment, { flex: positive, backgroundColor: Colors.positive }]} />}
        {neutral > 0 && <View style={[barStyles.segment, { flex: neutral, backgroundColor: Colors.neutral }]} />}
        {negative > 0 && <View style={[barStyles.segment, { flex: negative, backgroundColor: Colors.negative }]} />}
      </View>
      <View style={barStyles.legend}>
        <View style={barStyles.legendItem}>
          <View style={[barStyles.legendDot, { backgroundColor: Colors.positive }]} />
          <Text style={barStyles.legendText}>{positive}x +</Text>
        </View>
        <View style={barStyles.legendItem}>
          <View style={[barStyles.legendDot, { backgroundColor: Colors.neutral }]} />
          <Text style={barStyles.legendText}>{neutral}x o</Text>
        </View>
        <View style={barStyles.legendItem}>
          <View style={[barStyles.legendDot, { backgroundColor: Colors.negative }]} />
          <Text style={barStyles.legendText}>{negative}x −</Text>
        </View>
      </View>
    </View>
  );
}

function HomeworkBar({ done, late, missing, total }: { done: number; late: number; missing: number; total: number }) {
  if (total === 0) return null;

  return (
    <View style={barStyles.container}>
      <View style={barStyles.barBg}>
        {done > 0 && <View style={[barStyles.segment, { flex: done, backgroundColor: '#16A34A' }]} />}
        {late > 0 && <View style={[barStyles.segment, { flex: late, backgroundColor: '#D97706' }]} />}
        {missing > 0 && <View style={[barStyles.segment, { flex: missing, backgroundColor: Colors.negative }]} />}
      </View>
      <View style={barStyles.legend}>
        <View style={barStyles.legendItem}>
          <View style={[barStyles.legendDot, { backgroundColor: '#16A34A' }]} />
          <Text style={barStyles.legendText}>{done}x Abgegeben</Text>
        </View>
        <View style={barStyles.legendItem}>
          <View style={[barStyles.legendDot, { backgroundColor: '#D97706' }]} />
          <Text style={barStyles.legendText}>{late}x Verspätet</Text>
        </View>
        <View style={barStyles.legendItem}>
          <View style={[barStyles.legendDot, { backgroundColor: Colors.negative }]} />
          <Text style={barStyles.legendText}>{missing}x Fehlt</Text>
        </View>
      </View>
    </View>
  );
}

const barStyles = StyleSheet.create({
  container: { gap: 6 },
  barBg: { height: 5, borderRadius: 2.5, backgroundColor: Colors.inputBg, flexDirection: 'row', overflow: 'hidden' },
  segment: { height: 5 },
  legend: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '500' as const },
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
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
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
                  <Text style={styles.sectionLabelText}>Mitarbeit</Text>
                </View>
                <MiniProgressBar {...stats} />

                <View style={styles.sectionDivider} />

                <View style={styles.sectionLabel}>
                  <Text style={styles.sectionLabelText}>Hausaufgaben</Text>
                  {hwStats.total > 0 && (
                    <View style={styles.hwSummary}>
                      <View style={styles.hwBadge}>
                        <Check size={10} color="#16A34A" strokeWidth={2.5} />
                        <Text style={[styles.hwBadgeText, { color: '#16A34A' }]}>{hwStats.done}</Text>
                      </View>
                      <View style={styles.hwBadge}>
                        <Clock size={10} color="#D97706" strokeWidth={2.5} />
                        <Text style={[styles.hwBadgeText, { color: '#D97706' }]}>{hwStats.late}</Text>
                      </View>
                      <View style={styles.hwBadge}>
                        <X size={10} color={Colors.negative} strokeWidth={2.5} />
                        <Text style={[styles.hwBadgeText, { color: Colors.negative }]}>{hwStats.missing}</Text>
                      </View>
                    </View>
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
    backgroundColor: Colors.white,
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
    backgroundColor: Colors.white,
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
    backgroundColor: Colors.white,
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
    gap: 8,
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
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  className: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  trendBadge: {
    width: 30,
    height: 30,
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
  sectionLabelText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: 2,
  },
  hwSummary: {
    flexDirection: 'row',
    gap: 8,
  },
  hwBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  hwBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
});
