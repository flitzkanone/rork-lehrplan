import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, X, Clock, Save } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/context/AppContext';
import type { HomeworkStatus } from '@/types';

const STATUS_CONFIG: Record<HomeworkStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  done: { label: 'Erledigt', color: '#059669', bg: '#ECFDF5', icon: <Check size={14} color="#059669" strokeWidth={2.5} /> },
  forgotten: { label: 'Vergessen', color: '#DC2626', bg: '#FEF2F2', icon: <X size={14} color="#DC2626" strokeWidth={2.5} /> },
  late: { label: 'Nachgereicht', color: '#D97706', bg: '#FEF3C7', icon: <Clock size={14} color="#D97706" strokeWidth={2.5} /> },
};

export default function HomeworkCheckScreen() {
  const router = useRouter();
  const { classId, subject } = useLocalSearchParams<{ classId: string; subject: string }>();
  const { data, addHomeworkEntries } = useApp();

  const currentClass = data.classes.find((c) => c.id === classId);
  const students = useMemo(
    () => [...(currentClass?.students || [])].sort((a, b) => a.lastName.localeCompare(b.lastName)),
    [currentClass]
  );

  const [statuses, setStatuses] = useState<Record<string, HomeworkStatus>>(() => {
    const initial: Record<string, HomeworkStatus> = {};
    for (const s of students) {
      initial[s.id] = 'done';
    }
    return initial;
  });

  const toggleStatus = useCallback((studentId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStatuses((prev) => {
      const current = prev[studentId] || 'done';
      const cycle: HomeworkStatus[] = ['done', 'forgotten', 'late'];
      const nextIndex = (cycle.indexOf(current) + 1) % cycle.length;
      return { ...prev, [studentId]: cycle[nextIndex] };
    });
  }, []);

  const handleSave = useCallback(() => {
    if (!classId || !subject) return;
    const entries = students.map((s) => ({
      studentId: s.id,
      status: statuses[s.id] || ('done' as HomeworkStatus),
    }));
    addHomeworkEntries(classId, subject, entries);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Gespeichert', 'Hausaufgaben wurden erfasst.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }, [classId, subject, students, statuses, addHomeworkEntries, router]);

  const getHomeworkQuote = useCallback(
    (studentId: string): string => {
      const entries = data.homeworkEntries.filter((e) => e.studentId === studentId);
      if (entries.length === 0) return '-';
      const done = entries.filter((e) => e.status === 'done' || e.status === 'late').length;
      return `${Math.round((done / entries.length) * 100)}%`;
    },
    [data.homeworkEntries]
  );

  const counts = useMemo(() => {
    let done = 0;
    let forgotten = 0;
    let late = 0;
    for (const s of students) {
      const status = statuses[s.id] || 'done';
      if (status === 'done') done++;
      else if (status === 'forgotten') forgotten++;
      else late++;
    }
    return { done, forgotten, late };
  }, [students, statuses]);

  if (!currentClass) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Klasse nicht gefunden.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Zurück</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Hausaufgaben</Text>
            <Text style={styles.subtitle}>{currentClass.name} · {subject}</Text>
          </View>
          <TouchableOpacity style={styles.headerCloseBtn} onPress={() => router.back()}>
            <X size={18} color={Colors.text} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryChip, { backgroundColor: '#ECFDF5' }]}>
            <View style={[styles.summaryDot, { backgroundColor: '#059669' }]} />
            <Text style={[styles.summaryText, { color: '#059669' }]}>{counts.done}</Text>
          </View>
          <View style={[styles.summaryChip, { backgroundColor: '#FEF2F2' }]}>
            <View style={[styles.summaryDot, { backgroundColor: '#DC2626' }]} />
            <Text style={[styles.summaryText, { color: '#DC2626' }]}>{counts.forgotten}</Text>
          </View>
          <View style={[styles.summaryChip, { backgroundColor: '#FEF3C7' }]}>
            <View style={[styles.summaryDot, { backgroundColor: '#D97706' }]} />
            <Text style={[styles.summaryText, { color: '#D97706' }]}>{counts.late}</Text>
          </View>
        </View>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {students.map((student) => {
            const status = statuses[student.id] || 'done';
            const config = STATUS_CONFIG[status];
            const quote = getHomeworkQuote(student.id);

            return (
              <TouchableOpacity
                key={student.id}
                style={styles.studentRow}
                onPress={() => toggleStatus(student.id)}
                activeOpacity={0.6}
              >
                <View style={styles.studentLeft}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {student.firstName[0]}{student.lastName[0]}
                    </Text>
                  </View>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>
                      {student.lastName}, {student.firstName}
                    </Text>
                    <Text style={styles.quoteText}>Quote: {quote}</Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
                  {config.icon}
                  <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.7}>
            <Save size={17} color={Colors.white} strokeWidth={2} />
            <Text style={styles.saveBtnText}>Speichern</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  backBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 12,
  },
  backBtnText: {
    color: Colors.white,
    fontWeight: '600' as const,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  headerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 20,
    paddingTop: 4,
    gap: 6,
    paddingBottom: 100,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    ...Platform.select({
      ios: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4 },
      android: { elevation: 1 },
      default: {},
    }),
  },
  studentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
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
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  quoteText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    backgroundColor: Colors.background,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
});
