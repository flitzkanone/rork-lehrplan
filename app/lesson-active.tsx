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
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Minus, Circle, CheckCircle, Users, ThumbsUp, ThumbsDown, HandHelping, EyeOff, Volume2, FileX, BookOpen, Check, X, Clock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/context/AppContext';
import type { ParticipationRating, ParticipationReason, HomeworkStatus } from '@/types';

interface ReasonOption {
  reason: ParticipationReason;
  label: string;
  icon: React.ReactNode;
}

const POSITIVE_REASONS: ReasonOption[] = [
  { reason: 'good_participation', label: 'Gute Mitarbeit', icon: <ThumbsUp size={18} color={Colors.text} strokeWidth={1.8} /> },
  { reason: 'group_work', label: 'Gruppenarbeit', icon: <Users size={18} color={Colors.text} strokeWidth={1.8} /> },
  { reason: 'helpful', label: 'Hilfsbereit', icon: <HandHelping size={18} color={Colors.text} strokeWidth={1.8} /> },
];

const NEGATIVE_REASONS: ReasonOption[] = [
  { reason: 'unfocused', label: 'Unkonzentriert', icon: <EyeOff size={18} color={Colors.negative} strokeWidth={1.8} /> },
  { reason: 'disruptive', label: 'Ablenkend', icon: <Volume2 size={18} color={Colors.negative} strokeWidth={1.8} /> },
  { reason: 'unprepared', label: 'Unvorbereitet', icon: <FileX size={18} color={Colors.negative} strokeWidth={1.8} /> },
];

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
  const [pressed, setPressed] = useState(false);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.88, duration: 50, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  const pressedColors: Record<ParticipationRating, { bg: string; activeBg: string; border: string }> = {
    '+': { bg: '#BBF7D0', activeBg: '#15803D', border: '#15803D' },
    'o': { bg: '#E2E2E5', activeBg: '#6B6B70', border: '#6B6B70' },
    '-': { bg: '#FECACA', activeBg: '#B91C1C', border: '#B91C1C' },
  };

  const config: Record<ParticipationRating, { bg: string; activeBg: string; border: string; icon: React.ReactNode; label: string }> = {
    '+': {
      bg: Colors.positiveLight,
      activeBg: Colors.positive,
      border: Colors.positive,
      icon: <Check size={16} color={active ? '#FFFFFF' : Colors.positive} strokeWidth={2.5} />,
      label: '+',
    },
    'o': {
      bg: Colors.neutralLight,
      activeBg: Colors.neutral,
      border: Colors.neutral,
      icon: <Circle size={13} color={active ? '#FFFFFF' : Colors.neutral} strokeWidth={2.5} />,
      label: 'o',
    },
    '-': {
      bg: Colors.negativeLight,
      activeBg: Colors.negative,
      border: Colors.negative,
      icon: <X size={16} color={active ? '#FFFFFF' : Colors.negative} strokeWidth={2.5} />,
      label: '-',
    },
  };

  const c = config[type];
  const pc = pressedColors[type];

  const bgColor = pressed
    ? (active ? pc.activeBg : pc.bg)
    : (active ? c.activeBg : c.bg);
  const borderColor = pressed
    ? pc.border
    : (active ? c.border : 'transparent');

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        style={[
          styles.ratingBtn,
          {
            backgroundColor: bgColor,
            borderColor: borderColor,
          },
        ]}
        onPress={handlePress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
      >
        {c.icon}
      </Pressable>
    </Animated.View>
  );
}

function HomeworkButton({
  status,
  active,
  onPress,
}: {
  status: HomeworkStatus;
  active: boolean;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [pressed, setPressed] = useState(false);

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.88, duration: 50, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  const pressedColors: Record<HomeworkStatus, { bg: string; activeBg: string; border: string }> = {
    'done': { bg: '#BBF7D0', activeBg: '#15803D', border: '#15803D' },
    'missing': { bg: '#FECACA', activeBg: '#B91C1C', border: '#B91C1C' },
    'late': { bg: '#FDE68A', activeBg: '#B45309', border: '#B45309' },
  };

  const config: Record<HomeworkStatus, { bg: string; activeBg: string; border: string; icon: React.ReactNode }> = {
    'done': {
      bg: '#F0FDF4',
      activeBg: '#16A34A',
      border: '#16A34A',
      icon: <Check size={16} color={active ? '#FFFFFF' : '#16A34A'} strokeWidth={2.5} />,
    },
    'missing': {
      bg: Colors.negativeLight,
      activeBg: Colors.negative,
      border: Colors.negative,
      icon: <X size={16} color={active ? '#FFFFFF' : Colors.negative} strokeWidth={2.5} />,
    },
    'late': {
      bg: Colors.warningLight,
      activeBg: '#D97706',
      border: '#D97706',
      icon: <Clock size={14} color={active ? '#FFFFFF' : '#D97706'} strokeWidth={2.5} />,
    },
  };

  const c = config[status];
  const pc = pressedColors[status];

  const bgColor = pressed
    ? (active ? pc.activeBg : pc.bg)
    : (active ? c.activeBg : c.bg);
  const borderColor = pressed
    ? pc.border
    : (active ? c.border : 'transparent');

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        style={[
          styles.homeworkBtn,
          {
            backgroundColor: bgColor,
            borderColor: borderColor,
          },
        ]}
        onPress={handlePress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
      >
        {c.icon}
      </Pressable>
    </Animated.View>
  );
}

function ReasonMenu({
  visible,
  reasons,
  isNegative,
  onSelect,
  onClose,
}: {
  visible: boolean;
  reasons: ReasonOption[];
  isNegative: boolean;
  onSelect: (reason: ParticipationReason) => void;
  onClose: () => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
    }
  }, [visible, fadeAnim, scaleAnim]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.reasonMenu,
        isNegative ? styles.reasonMenuNegative : styles.reasonMenuPositive,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {reasons.map((item) => (
        <TouchableOpacity
          key={item.reason}
          style={[
            styles.reasonChip,
            isNegative ? styles.reasonChipNegative : styles.reasonChipPositive,
          ]}
          onPress={() => onSelect(item.reason)}
          activeOpacity={0.6}
        >
          {item.icon}
          <Text style={[styles.reasonChipLabel, isNegative && styles.reasonChipLabelNegative]} numberOfLines={1}>
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </Animated.View>
  );
}

function getReasonLabel(reason: ParticipationReason): string | null {
  if (!reason) return null;
  const all = [...POSITIVE_REASONS, ...NEGATIVE_REASONS];
  return all.find((r) => r.reason === reason)?.label ?? null;
}

function getHomeworkLabel(status: HomeworkStatus): string {
  switch (status) {
    case 'done': return 'Abgegeben';
    case 'late': return 'Verspätet';
    case 'missing': return 'Nicht abgegeben';
  }
}

export default function LessonActiveScreen() {
  const router = useRouter();
  const { data, rateStudent, rateHomework, endSession } = useApp();
  const session = data.activeSession;
  const [openMenuStudentId, setOpenMenuStudentId] = useState<string | null>(null);
  const [openMenuType, setOpenMenuType] = useState<'+' | '-' | null>(null);
  const [homeworkMode, setHomeworkMode] = useState<boolean>(false);

  const currentClass = data.classes.find((c) => c.id === session?.classId);

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

  const handleEnterHomeworkMode = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setHomeworkMode(true);
    setOpenMenuStudentId(null);
    setOpenMenuType(null);
  }, []);

  const handleExitHomeworkMode = useCallback(() => {
    if (!session || !currentClass) {
      setHomeworkMode(false);
      return;
    }

    const homework = session.homework ?? {};
    const unratedStudents = currentClass.students.filter((s) => !homework[s.id]);

    if (unratedStudents.length > 0) {
      Alert.alert(
        'Hausaufgaben beenden?',
        `${unratedStudents.length} Schüler wurden nicht bewertet. Alle unbewerteten Schüler erhalten ein ✕ (nicht abgegeben).`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Beenden',
            style: 'destructive',
            onPress: () => {
              unratedStudents.forEach((s) => {
                rateHomework(s.id, 'missing');
              });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setHomeworkMode(false);
            },
          },
        ]
      );
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setHomeworkMode(false);
    }
  }, [session, currentClass, rateHomework]);

  const handleHomeworkRate = useCallback(
    (studentId: string, status: HomeworkStatus) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const currentStatus = session?.homework?.[studentId];
      if (currentStatus === status) {
        return;
      }
      rateHomework(studentId, status);
    },
    [rateHomework, session]
  );

  const handleRatingPress = useCallback(
    (studentId: string, type: ParticipationRating) => {
      if (type === 'o') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        rateStudent(studentId, 'o', null);
        setOpenMenuStudentId(null);
        setOpenMenuType(null);
        return;
      }

      if (openMenuStudentId === studentId && openMenuType === type) {
        setOpenMenuStudentId(null);
        setOpenMenuType(null);
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setOpenMenuStudentId(studentId);
      setOpenMenuType(type);
    },
    [openMenuStudentId, openMenuType, rateStudent]
  );

  const handleReasonSelect = useCallback(
    (studentId: string, rating: ParticipationRating, reason: ParticipationReason) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      rateStudent(studentId, rating, reason);
      setOpenMenuStudentId(null);
      setOpenMenuType(null);
    },
    [rateStudent]
  );

  const handleCloseMenu = useCallback(() => {
    setOpenMenuStudentId(null);
    setOpenMenuType(null);
  }, []);

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

  const homeworkRated = Object.keys(session.homework ?? {}).length;
  const homeworkProgress = totalCount > 0 ? homeworkRated / totalCount : 0;

  return (
    <View style={styles.root}>
      {openMenuStudentId && !homeworkMode && (
        <Pressable style={styles.backdropOverlay} onPress={handleCloseMenu} />
      )}
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>{currentClass.name}</Text>
              <Text style={styles.headerSubject}>{session.subject}</Text>
            </View>

            {homeworkMode ? (
              <TouchableOpacity style={styles.homeworkEndBtn} onPress={handleExitHomeworkMode} activeOpacity={0.55}>
                <BookOpen size={14} color={Colors.negative} strokeWidth={1.8} />
                <Text style={styles.homeworkEndBtnText}>HA beenden</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.headerActions}>
                <TouchableOpacity style={styles.homeworkToggleBtn} onPress={handleEnterHomeworkMode} activeOpacity={0.55}>
                  <BookOpen size={14} color={Colors.text} strokeWidth={1.8} />
                  <Text style={styles.homeworkToggleBtnText}>Hausaufgaben</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.endBtn} onPress={handleEndLesson} activeOpacity={0.55}>
                  <CheckCircle size={15} color={Colors.primary} strokeWidth={1.8} />
                  <Text style={styles.endBtnText}>Beenden</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {homeworkMode ? (
            <View style={styles.progressWrap}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, styles.homeworkProgressFill, { flex: homeworkProgress }]} />
                {homeworkProgress < 1 && <View style={{ flex: 1 - homeworkProgress }} />}
              </View>
              <Text style={styles.progressText}>{homeworkRated}/{totalCount}</Text>
            </View>
          ) : (
            <View style={styles.progressWrap}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { flex: progress }]} />
                {progress < 1 && <View style={{ flex: 1 - progress }} />}
              </View>
              <Text style={styles.progressText}>{ratedCount}/{totalCount}</Text>
            </View>
          )}

          {homeworkMode && (
            <View style={styles.homeworkLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#16A34A' }]} />
                <Text style={styles.legendText}>Abgegeben</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#D97706' }]} />
                <Text style={styles.legendText}>Verspätet</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: Colors.negative }]} />
                <Text style={styles.legendText}>Fehlt</Text>
              </View>
            </View>
          )}
        </View>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {currentClass.students
            .sort((a, b) => a.lastName.localeCompare(b.lastName))
            .map((student) => {
              if (homeworkMode) {
                const hwStatus = session.homework?.[student.id] as HomeworkStatus | undefined;
                const hwLabel = hwStatus ? getHomeworkLabel(hwStatus) : null;

                return (
                  <View key={student.id} style={styles.studentCard}>
                    <View style={styles.studentRow}>
                      <View style={styles.studentInfo}>
                        <View style={[
                          styles.studentAvatar,
                          hwStatus === 'done' && styles.avatarHomeworkDone,
                          hwStatus === 'late' && styles.avatarHomeworkLate,
                          hwStatus === 'missing' && styles.avatarHomeworkMissing,
                        ]}>
                          <Text style={[
                            styles.avatarText,
                            hwStatus === 'done' && { color: '#16A34A' },
                            hwStatus === 'late' && { color: '#D97706' },
                            hwStatus === 'missing' && styles.avatarTextNegative,
                          ]}>
                            {(student.firstName || '?')[0]}{(student.lastName || '?')[0]}
                          </Text>
                        </View>
                        <View style={styles.studentTextWrap}>
                          <Text style={styles.studentName}>
                            {student.lastName}{student.lastName ? ', ' : ''}{student.firstName}
                          </Text>
                          {hwLabel ? (
                            <View style={styles.reasonBadgeRow}>
                              <View style={[
                                styles.reasonBadge,
                                hwStatus === 'done' && { backgroundColor: '#F0FDF4' },
                                hwStatus === 'late' && { backgroundColor: Colors.warningLight },
                                hwStatus === 'missing' && styles.reasonBadgeNeg,
                              ]}>
                                <Text style={[
                                  styles.reasonBadgeText,
                                  hwStatus === 'done' && { color: '#16A34A' },
                                  hwStatus === 'late' && { color: '#D97706' },
                                  hwStatus === 'missing' && styles.reasonBadgeTextNeg,
                                ]}>
                                  {hwLabel}
                                </Text>
                              </View>
                            </View>
                          ) : null}
                        </View>
                      </View>
                      <View style={styles.ratingRow}>
                        <HomeworkButton
                          status="done"
                          active={hwStatus === 'done'}
                          onPress={() => handleHomeworkRate(student.id, 'done')}
                        />
                        <HomeworkButton
                          status="late"
                          active={hwStatus === 'late'}
                          onPress={() => handleHomeworkRate(student.id, 'late')}
                        />
                        <HomeworkButton
                          status="missing"
                          active={hwStatus === 'missing'}
                          onPress={() => handleHomeworkRate(student.id, 'missing')}
                        />
                      </View>
                    </View>
                  </View>
                );
              }

              const currentRating = session.ratings[student.id] as ParticipationRating | undefined;
              const currentReason = session.reasons?.[student.id] ?? null;
              const reasonLabel = getReasonLabel(currentReason);
              const isMenuOpen = openMenuStudentId === student.id;
              const menuIsPositive = isMenuOpen && openMenuType === '+';
              const menuIsNegative = isMenuOpen && openMenuType === '-';

              return (
                <View key={student.id} style={styles.studentCard}>
                  <View style={styles.studentRow}>
                    <View style={styles.studentInfo}>
                      <View style={[
                        styles.studentAvatar,
                        currentRating === '+' && styles.avatarPositive,
                        currentRating === '-' && styles.avatarNegative,
                      ]}>
                        <Text style={[
                          styles.avatarText,
                          currentRating === '+' && styles.avatarTextPositive,
                          currentRating === '-' && styles.avatarTextNegative,
                        ]}>
                          {(student.firstName || '?')[0]}{(student.lastName || '?')[0]}
                        </Text>
                      </View>
                      <View style={styles.studentTextWrap}>
                        <Text style={styles.studentName}>
                          {student.lastName}{student.lastName ? ', ' : ''}{student.firstName}
                        </Text>
                        {reasonLabel ? (
                          <View style={styles.reasonBadgeRow}>
                            <View style={[
                              styles.reasonBadge,
                              currentRating === '-' ? styles.reasonBadgeNeg : styles.reasonBadgePos,
                            ]}>
                              <Text style={[
                                styles.reasonBadgeText,
                                currentRating === '-' ? styles.reasonBadgeTextNeg : styles.reasonBadgeTextPos,
                              ]}>
                                {reasonLabel}
                              </Text>
                            </View>
                          </View>
                        ) : student.note ? (
                          <Text style={styles.studentNote} numberOfLines={1}>
                            {student.note}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.ratingRow}>
                      <RatingButton
                        type="+"
                        active={currentRating === '+'}
                        onPress={() => handleRatingPress(student.id, '+')}
                      />
                      <RatingButton
                        type="o"
                        active={currentRating === 'o'}
                        onPress={() => handleRatingPress(student.id, 'o')}
                      />
                      <RatingButton
                        type="-"
                        active={currentRating === '-'}
                        onPress={() => handleRatingPress(student.id, '-')}
                      />
                    </View>
                  </View>

                  <ReasonMenu
                    visible={menuIsPositive}
                    reasons={POSITIVE_REASONS}
                    isNegative={false}
                    onSelect={(reason) => handleReasonSelect(student.id, '+', reason)}
                    onClose={handleCloseMenu}
                  />
                  <ReasonMenu
                    visible={menuIsNegative}
                    reasons={NEGATIVE_REASONS}
                    isNegative={true}
                    onSelect={(reason) => handleReasonSelect(student.id, '-', reason)}
                    onClose={handleCloseMenu}
                  />
                </View>
              );
            })}
        </ScrollView>
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
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
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
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.divider,
    zIndex: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.4,
  },
  headerSubject: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  homeworkToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  homeworkToggleBtnText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  homeworkEndBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.negativeLight,
    borderWidth: 1,
    borderColor: '#F0D4D0',
  },
  homeworkEndBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.negative,
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
  homeworkProgressFill: {
    backgroundColor: '#16A34A',
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    minWidth: 32,
    textAlign: 'right' as const,
  },
  homeworkLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 20,
    gap: 8,
  },
  studentCard: {
    position: 'relative' as const,
    zIndex: 1,
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
  avatarHomeworkDone: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#16A34A',
  },
  avatarHomeworkLate: {
    backgroundColor: Colors.warningLight,
    borderWidth: 1.5,
    borderColor: '#D97706',
  },
  avatarHomeworkMissing: {
    backgroundColor: Colors.negativeLight,
    borderWidth: 1.5,
    borderColor: Colors.negative,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  avatarTextPositive: {
    color: Colors.positive,
  },
  avatarTextNegative: {
    color: Colors.negative,
  },
  studentTextWrap: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  studentNote: {
    fontSize: 12,
    color: Colors.textSecondary,
    maxWidth: 120,
    marginTop: 1,
  },
  reasonBadgeRow: {
    flexDirection: 'row',
    marginTop: 3,
  },
  reasonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  reasonBadgePos: {
    backgroundColor: Colors.positiveLight,
  },
  reasonBadgeNeg: {
    backgroundColor: Colors.negativeLight,
  },
  reasonBadgeText: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
  reasonBadgeTextPos: {
    color: Colors.positive,
  },
  reasonBadgeTextNeg: {
    color: Colors.negative,
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
  homeworkBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonMenu: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 6,
    zIndex: 20,
  },
  reasonMenuPositive: {},
  reasonMenuNegative: {},
  reasonChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: 'rgba(0,0,0,0.06)', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 4 },
      android: { elevation: 1 },
      default: {},
    }),
  },
  reasonChipPositive: {
    backgroundColor: Colors.positiveLight,
    borderColor: Colors.positive,
  },
  reasonChipNegative: {
    backgroundColor: Colors.negativeLight,
    borderColor: Colors.negative,
  },
  reasonChipLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  reasonChipLabelNegative: {
    color: Colors.negative,
  },
});
