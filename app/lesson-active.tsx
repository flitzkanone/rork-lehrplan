import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  Platform,
  Modal,
  TextInput,
  PanResponder,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus,
  Minus,
  Circle,
  CheckCircle,
  Shuffle,
  ClipboardCheck,
  ThumbsUp,
  ThumbsDown,
  X,
  Link2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/context/AppContext';
import PhaseTimer from '@/components/PhaseTimer';
import type { ParticipationRating, BehaviorType } from '@/types';

function RatingButton({
  type,
  active,
  onPress,
}: {
  type: ParticipationRating;
  active: boolean;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.88, duration: 50, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  const config = {
    '+': { bg: active ? Colors.positive : Colors.positiveLight, icon: <Plus size={15} color={active ? Colors.white : Colors.positive} strokeWidth={2.5} />, border: Colors.positive },
    'o': { bg: active ? Colors.neutral : Colors.neutralLight, icon: <Circle size={13} color={active ? Colors.white : Colors.neutral} strokeWidth={2.5} />, border: Colors.neutral },
    '-': { bg: active ? Colors.negative : Colors.negativeLight, icon: <Minus size={15} color={active ? Colors.white : Colors.negative} strokeWidth={2.5} />, border: Colors.negative },
  };

  const c = config[type];

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.ratingBtn, { backgroundColor: c.bg, borderColor: active ? c.border : 'transparent' }]}
        onPress={handlePress}
        activeOpacity={0.55}
      >
        {c.icon}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function LessonActiveScreen() {
  const router = useRouter();
  const { data, rateStudent, endSession, addBehaviorEntry } = useApp();
  const session = data.activeSession;
  const currentClass = data.classes.find((c) => c.id === session?.classId);

  const [behaviorModal, setBehaviorModal] = useState<{
    visible: boolean;
    studentId: string;
    studentName: string;
  }>({ visible: false, studentId: '', studentName: '' });
  const [behaviorNote, setBehaviorNote] = useState<string>('');

  const longPressTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const handleEndLesson = useCallback(() => {
    Alert.alert(
      'Unterricht beenden?',
      'Alle nicht bewerteten Schüler erhalten eine neutrale Bewertung (o).',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Beenden',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            endSession();
            router.back();
          },
        },
      ]
    );
  }, [endSession, router]);

  const handleRate = useCallback(
    (studentId: string, rating: ParticipationRating) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      rateStudent(studentId, rating);
    },
    [rateStudent]
  );

  const openRandomWheel = useCallback(() => {
    if (!session?.classId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/random-wheel' as any, params: { classId: session.classId } });
  }, [session, router]);

  const openHomeworkCheck = useCallback(() => {
    if (!session?.classId || !session?.subject) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/homework-check' as any,
      params: { classId: session.classId, subject: session.subject },
    });
  }, [session, router]);

  const openResources = useCallback(() => {
    if (!session?.classId || !session?.subject) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/resource-manager' as any,
      params: { classId: session.classId, subject: session.subject },
    });
  }, [session, router]);

  const handleLongPressStart = useCallback((studentId: string, studentName: string) => {
    longPressTimers.current[studentId] = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setBehaviorModal({ visible: true, studentId, studentName });
      setBehaviorNote('');
    }, 600);
  }, []);

  const handleLongPressEnd = useCallback((studentId: string) => {
    if (longPressTimers.current[studentId]) {
      clearTimeout(longPressTimers.current[studentId]);
      delete longPressTimers.current[studentId];
    }
  }, []);

  const handleBehavior = useCallback(
    (type: BehaviorType) => {
      if (!behaviorModal.studentId || !session?.classId) return;
      addBehaviorEntry(behaviorModal.studentId, session.classId, type, behaviorNote.trim());
      Haptics.notificationAsync(
        type === 'praise'
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning
      );
      setBehaviorModal({ visible: false, studentId: '', studentName: '' });
      setBehaviorNote('');
    },
    [behaviorModal, session, behaviorNote, addBehaviorEntry]
  );

  if (!session || !currentClass) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Kein aktiver Unterricht.</Text>
        <TouchableOpacity style={styles.backBtnSimple} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Zurück</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const ratedCount = Object.keys(session.ratings).length;
  const totalCount = currentClass.students.length;
  const progress = totalCount > 0 ? ratedCount / totalCount : 0;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <PhaseTimer />

        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>{currentClass.name}</Text>
              <Text style={styles.headerSubject}>{session.subject}</Text>
            </View>
            <TouchableOpacity style={styles.endBtn} onPress={handleEndLesson} activeOpacity={0.55}>
              <CheckCircle size={15} color={Colors.primary} strokeWidth={1.8} />
              <Text style={styles.endBtnText}>Beenden</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.progressWrap}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { flex: progress }]} />
              {progress < 1 && <View style={{ flex: 1 - progress }} />}
            </View>
            <Text style={styles.progressText}>{ratedCount}/{totalCount}</Text>
          </View>
        </View>

        <View style={styles.toolBar}>
          <TouchableOpacity style={styles.toolBtn} onPress={openRandomWheel} activeOpacity={0.6}>
            <Shuffle size={15} color={Colors.primary} strokeWidth={1.8} />
            <Text style={styles.toolBtnText}>Zufallsrad</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={openHomeworkCheck} activeOpacity={0.6}>
            <ClipboardCheck size={15} color={Colors.primary} strokeWidth={1.8} />
            <Text style={styles.toolBtnText}>Hausaufgaben</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={openResources} activeOpacity={0.6}>
            <Link2 size={15} color={Colors.primary} strokeWidth={1.8} />
            <Text style={styles.toolBtnText}>Material</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {currentClass.students
            .sort((a, b) => a.lastName.localeCompare(b.lastName))
            .map((student) => {
              const currentRating = session.ratings[student.id] as ParticipationRating | undefined;
              const behaviorCount = (data.behaviorEntries || []).filter(
                (b) => b.studentId === student.id && b.classId === session.classId
              );
              const praiseCount = behaviorCount.filter((b) => b.type === 'praise').length;
              const reprimandCount = behaviorCount.filter((b) => b.type === 'reprimand').length;

              return (
                <TouchableOpacity
                  key={student.id}
                  style={styles.studentRow}
                  activeOpacity={1}
                  onPressIn={() => handleLongPressStart(student.id, `${student.firstName} ${student.lastName}`)}
                  onPressOut={() => handleLongPressEnd(student.id)}
                  delayLongPress={600}
                >
                  <View style={styles.studentInfo}>
                    <View style={styles.studentAvatar}>
                      <Text style={styles.avatarText}>
                        {(student.firstName || '?')[0]}{(student.lastName || '?')[0]}
                      </Text>
                    </View>
                    <View style={styles.studentTextWrap}>
                      <Text style={styles.studentName}>
                        {student.lastName}, {student.firstName}
                      </Text>
                      <View style={styles.behaviorIndicators}>
                        {praiseCount > 0 && (
                          <View style={styles.behaviorBadge}>
                            <ThumbsUp size={9} color="#059669" strokeWidth={2.5} />
                            <Text style={[styles.behaviorBadgeText, { color: '#059669' }]}>{praiseCount}</Text>
                          </View>
                        )}
                        {reprimandCount > 0 && (
                          <View style={styles.behaviorBadge}>
                            <ThumbsDown size={9} color="#DC2626" strokeWidth={2.5} />
                            <Text style={[styles.behaviorBadgeText, { color: '#DC2626' }]}>{reprimandCount}</Text>
                          </View>
                        )}
                        {student.note ? (
                          <Text style={styles.studentNote} numberOfLines={1}>
                            {student.note}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                  <View style={styles.ratingRow}>
                    <RatingButton
                      type="+"
                      active={currentRating === '+'}
                      onPress={() => handleRate(student.id, '+')}
                    />
                    <RatingButton
                      type="o"
                      active={currentRating === 'o'}
                      onPress={() => handleRate(student.id, 'o')}
                    />
                    <RatingButton
                      type="-"
                      active={currentRating === '-'}
                      onPress={() => handleRate(student.id, '-')}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
        </ScrollView>

        <Modal visible={behaviorModal.visible} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Lob / Tadel</Text>
                <TouchableOpacity
                  onPress={() => setBehaviorModal({ visible: false, studentId: '', studentName: '' })}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalStudentName}>{behaviorModal.studentName}</Text>
              <TextInput
                style={styles.modalInput}
                value={behaviorNote}
                onChangeText={setBehaviorNote}
                placeholder="Optionale Notiz..."
                placeholderTextColor={Colors.textLight}
                multiline
                numberOfLines={2}
              />
              <View style={styles.behaviorActions}>
                <TouchableOpacity
                  style={[styles.behaviorBtn, { backgroundColor: '#ECFDF5', borderColor: '#059669' }]}
                  onPress={() => handleBehavior('praise')}
                  activeOpacity={0.6}
                >
                  <ThumbsUp size={18} color="#059669" strokeWidth={2} />
                  <Text style={[styles.behaviorBtnText, { color: '#059669' }]}>Lob</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.behaviorBtn, { backgroundColor: '#FEF2F2', borderColor: '#DC2626' }]}
                  onPress={() => handleBehavior('reprimand')}
                  activeOpacity={0.6}
                >
                  <ThumbsDown size={18} color="#DC2626" strokeWidth={2} />
                  <Text style={[styles.behaviorBtnText, { color: '#DC2626' }]}>Tadel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
  backBtnSimple: {
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
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: Colors.white,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.divider,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.4,
  },
  headerSubject: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
  },
  endBtnText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.inputBg,
    overflow: 'hidden',
    flexDirection: 'row' as const,
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    minWidth: 32,
    textAlign: 'right' as const,
  },
  toolBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.white,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.divider,
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
  },
  toolBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 20,
    gap: 8,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    ...Platform.select({
      ios: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 4 },
      android: { elevation: 1 },
      default: {},
    }),
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  studentAvatar: {
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
  studentTextWrap: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  behaviorIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  behaviorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  behaviorBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
  },
  studentNote: {
    fontSize: 12,
    color: Colors.textSecondary,
    maxWidth: 80,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 6,
  },
  ratingBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    padding: 28,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  modalStudentName: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    marginBottom: 20,
    minHeight: 50,
    textAlignVertical: 'top',
  },
  behaviorActions: {
    flexDirection: 'row',
    gap: 12,
  },
  behaviorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  behaviorBtnText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
