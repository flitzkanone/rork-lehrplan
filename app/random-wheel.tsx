import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RotateCcw, X, Shuffle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/context/AppContext';
import type { Student } from '@/types';

const WHEEL_COLORS = [
  '#2563EB', '#059669', '#D97706', '#DC2626',
  '#7C3AED', '#0891B2', '#CA8A04', '#BE185D',
  '#4F46E5', '#0D9488', '#EA580C', '#9333EA',
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const WHEEL_SIZE = Math.min(SCREEN_WIDTH - 80, 320);

export default function RandomWheelScreen() {
  const router = useRouter();
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const { data, incrementCallCount, resetCallCounts } = useApp();

  const currentClass = data.classes.find((c) => c.id === classId);
  const students = currentClass?.students || [];

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const currentRotation = useRef(0);

  const weightedStudents = useMemo(() => {
    return students.map((student) => {
      const callRecord = data.callCounts.find(
        (c) => c.studentId === student.id && c.classId === classId
      );
      const calls = callRecord?.count || 0;
      const weight = 1 / (calls + 1);
      return { student, calls, weight };
    });
  }, [students, data.callCounts, classId]);

  const selectWeightedRandom = useCallback((): Student | null => {
    if (weightedStudents.length === 0) return null;
    const totalWeight = weightedStudents.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;
    for (const ws of weightedStudents) {
      random -= ws.weight;
      if (random <= 0) return ws.student;
    }
    return weightedStudents[weightedStudents.length - 1].student;
  }, [weightedStudents]);

  const spin = useCallback(() => {
    if (isSpinning || students.length === 0) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsSpinning(true);
    setSelectedStudent(null);

    const winner = selectWeightedRandom();
    if (!winner) {
      setIsSpinning(false);
      return;
    }

    const winnerIndex = students.findIndex((s) => s.id === winner.id);
    const sliceAngle = 360 / students.length;
    const targetAngle = 360 - (winnerIndex * sliceAngle + sliceAngle / 2);
    const spins = 4 + Math.floor(Math.random() * 3);
    const finalRotation = currentRotation.current + spins * 360 + targetAngle - (currentRotation.current % 360);

    Animated.timing(rotationAnim, {
      toValue: finalRotation,
      duration: 3500,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: true,
    }).start(() => {
      currentRotation.current = finalRotation;
      setSelectedStudent(winner);
      setIsSpinning(false);

      if (classId) {
        incrementCallCount(winner.id, classId);
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.08, duration: 150, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    });

    const hapticInterval = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, 120);
    setTimeout(() => clearInterval(hapticInterval), 3000);
  }, [isSpinning, students, selectWeightedRandom, rotationAnim, scaleAnim, classId, incrementCallCount]);

  const handleReset = useCallback(() => {
    if (classId) {
      resetCallCounts(classId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [classId, resetCallCounts]);

  const spinRotation = rotationAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  if (!currentClass || students.length === 0) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={styles.emptyContainer} edges={['top']}>
          <Text style={styles.emptyText}>Keine Schüler in dieser Klasse.</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Text style={styles.closeBtnText}>Zurück</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Zufallsrad</Text>
            <Text style={styles.subtitle}>{currentClass.name}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
              <RotateCcw size={14} color={Colors.textSecondary} strokeWidth={1.8} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerCloseBtn} onPress={() => router.back()}>
              <X size={18} color={Colors.text} strokeWidth={1.8} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.wheelContainer}>
          <View style={styles.pointer} />
          <Animated.View
            style={[
              styles.wheel,
              {
                width: WHEEL_SIZE,
                height: WHEEL_SIZE,
                borderRadius: WHEEL_SIZE / 2,
                transform: [{ rotate: spinRotation }, { scale: scaleAnim }],
              },
            ]}
          >
            {students.map((student, index) => {
              const angle = (index * 360) / students.length;
              const color = WHEEL_COLORS[index % WHEEL_COLORS.length];
              return (
                <View
                  key={student.id}
                  style={[
                    styles.wheelSlice,
                    {
                      transform: [
                        { rotate: `${angle}deg` },
                        { translateY: -(WHEEL_SIZE / 2 - 45) },
                      ],
                    },
                  ]}
                >
                  <View style={[styles.sliceDot, { backgroundColor: color }]} />
                  <Text
                    style={[styles.sliceText, students.length > 15 && { fontSize: 8 }]}
                    numberOfLines={1}
                  >
                    {student.firstName} {student.lastName.charAt(0)}.
                  </Text>
                </View>
              );
            })}
            <View style={styles.wheelCenter}>
              <Shuffle size={20} color={Colors.white} strokeWidth={2} />
            </View>
          </Animated.View>
        </View>

        {selectedStudent && (
          <Animated.View style={[styles.resultCard, { transform: [{ scale: scaleAnim }] }]}>
            <View style={styles.resultAvatar}>
              <Text style={styles.resultAvatarText}>
                {selectedStudent.firstName[0]}{selectedStudent.lastName[0]}
              </Text>
            </View>
            <Text style={styles.resultName}>
              {selectedStudent.firstName} {selectedStudent.lastName}
            </Text>
            <Text style={styles.resultCallCount}>
              Aufrufe: {(data.callCounts.find(
                (c) => c.studentId === selectedStudent.id && c.classId === classId
              )?.count || 0)}
            </Text>
          </Animated.View>
        )}

        <TouchableOpacity
          style={[styles.spinBtn, isSpinning && styles.spinBtnDisabled]}
          onPress={spin}
          disabled={isSpinning}
          activeOpacity={0.7}
        >
          <Shuffle size={18} color={Colors.white} strokeWidth={2.2} />
          <Text style={styles.spinBtnText}>
            {isSpinning ? 'Dreht...' : 'Drehen'}
          </Text>
        </TouchableOpacity>

        <View style={styles.statsContainer}>
          <Text style={styles.statsTitle}>Aufruf-Statistik</Text>
          {weightedStudents
            .sort((a, b) => a.calls - b.calls)
            .slice(0, 5)
            .map((ws) => (
              <View key={ws.student.id} style={styles.statsRow}>
                <Text style={styles.statsName} numberOfLines={1}>
                  {ws.student.firstName} {ws.student.lastName.charAt(0)}.
                </Text>
                <View style={styles.statsBarWrap}>
                  <View
                    style={[
                      styles.statsBar,
                      {
                        flex: Math.max(ws.calls, 0.2),
                        backgroundColor: ws.calls === 0 ? '#059669' : Colors.primary,
                      },
                    ]}
                  />
                  <View style={{ flex: Math.max((weightedStudents[weightedStudents.length - 1]?.calls || 1) - ws.calls, 0) }} />
                </View>
                <Text style={styles.statsCount}>{ws.calls}x</Text>
              </View>
            ))}
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  closeBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.primary,
    borderRadius: 12,
  },
  closeBtnText: {
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
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  resetBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  pointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Colors.primary,
    zIndex: 10,
    marginBottom: -8,
  },
  wheel: {
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.primary,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
      android: { elevation: 8 },
      default: {},
    }),
  },
  wheelSlice: {
    position: 'absolute',
    alignItems: 'center',
    width: 80,
  },
  sliceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 2,
  },
  sliceText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center',
  },
  wheelCenter: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  resultCard: {
    alignItems: 'center',
    marginHorizontal: 20,
    padding: 20,
    backgroundColor: Colors.white,
    borderRadius: 20,
    marginBottom: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 },
      android: { elevation: 4 },
      default: {},
    }),
  },
  resultAvatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  resultAvatarText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  resultName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  resultCallCount: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  spinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 20,
  },
  spinBtnDisabled: {
    opacity: 0.4,
  },
  spinBtnText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  statsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  statsTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textLight,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  statsName: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500' as const,
    width: 80,
  },
  statsBarWrap: {
    flex: 1,
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.inputBg,
    overflow: 'hidden',
  },
  statsBar: {
    height: 6,
    borderRadius: 3,
  },
  statsCount: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    width: 30,
    textAlign: 'right' as const,
  },
});
