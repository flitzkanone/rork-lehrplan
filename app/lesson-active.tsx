import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Minus, Circle, CheckCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/context/AppContext';
import type { ParticipationRating } from '@/types';

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
  const { data, rateStudent, endSession } = useApp();
  const session = data.activeSession;

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

  const handleRate = useCallback(
    (studentId: string, rating: ParticipationRating) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      rateStudent(studentId, rating);
    },
    [rateStudent]
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
              return (
                <View key={student.id} style={styles.studentRow}>
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
                      {student.note ? (
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
  studentNote: {
    fontSize: 12,
    color: Colors.textSecondary,
    maxWidth: 120,
    marginTop: 1,
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
});
