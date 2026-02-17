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
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Minus, Circle, CheckCircle, Users, ThumbsUp, HandHelping, EyeOff, Volume2, FileX } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/context/AppContext';
import type { ParticipationRating, ParticipationReason, PositiveReason, NegativeReason } from '@/types';

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
      {reasons.map((item, index) => (
        <TouchableOpacity
          key={item.reason}
          style={[
            styles.reasonOption,
            index < reasons.length - 1 && styles.reasonOptionBorder,
          ]}
          onPress={() => onSelect(item.reason)}
          activeOpacity={0.6}
        >
          {item.icon}
          <Text style={[styles.reasonLabel, isNegative && styles.reasonLabelNegative]}>
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

export default function LessonActiveScreen() {
  const router = useRouter();
  const { data, rateStudent, endSession } = useApp();
  const session = data.activeSession;
  const [openMenuStudentId, setOpenMenuStudentId] = useState<string | null>(null);
  const [openMenuType, setOpenMenuType] = useState<'+' | '-' | null>(null);

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

  return (
    <View style={styles.root}>
      {openMenuStudentId && (
        <Pressable style={styles.backdropOverlay} onPress={handleCloseMenu} />
      )}
      <SafeAreaView style={styles.container} edges={['top']}>
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

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {currentClass.students
            .sort((a, b) => a.lastName.localeCompare(b.lastName))
            .map((student) => {
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
  reasonMenu: {
    marginTop: 6,
    borderRadius: 14,
    overflow: 'hidden',
    zIndex: 20,
    ...Platform.select({
      ios: { shadowColor: 'rgba(0,0,0,0.12)', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12 },
      android: { elevation: 4 },
      default: {},
    }),
  },
  reasonMenuPositive: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  reasonMenuNegative: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#F0D4D0',
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  reasonOptionBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.divider,
  },
  reasonLabel: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  reasonLabelNegative: {
    color: Colors.negative,
  },
});
