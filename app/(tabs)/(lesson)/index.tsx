import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Play, ChevronRight, BookOpen, Users as UsersIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/context/AppContext';
import { LessonScreenSkeleton } from '@/components/SkeletonLoader';

export default function LessonScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, startSession, isLoading, isAuthenticated } = useApp();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!data.onboardingComplete) {
      router.replace('/onboarding');
      return;
    }
    if (!isAuthenticated) {
      router.replace('/lock');
    }
  }, [isLoading, data.onboardingComplete, isAuthenticated, router]);

  const activeSession = data.activeSession;

  const handleStartLesson = useCallback(() => {
    if (!selectedClassId || !selectedSubject) {
      Alert.alert('Fehler', 'Bitte wählen Sie eine Klasse und ein Fach.');
      return;
    }
    const cls = data.classes.find((c) => c.id === selectedClassId);
    if (!cls || cls.students.length === 0) {
      Alert.alert('Fehler', 'Diese Klasse hat keine Schüler.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startSession(selectedClassId, selectedSubject);
    router.push('/lesson-active');
  }, [selectedClassId, selectedSubject, data.classes, startSession, router]);

  const handleResumeLesson = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/lesson-active');
  }, [router]);

  if (isLoading || !data.onboardingComplete || !isAuthenticated) {
    return <LessonScreenSkeleton />;
  }

  if (data.classes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconCircle}>
          <BookOpen size={26} color={Colors.textLight} strokeWidth={1.4} />
        </View>
        <Text style={styles.emptyTitle}>Keine Klassen vorhanden</Text>
        <Text style={styles.emptySubtitle}>
          Erstellen Sie zuerst eine Klasse im Klassen-Bereich.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]} showsVerticalScrollIndicator={false}>
      <Text style={styles.screenTitle}>Unterricht</Text>

      {activeSession && (
        <TouchableOpacity
          style={styles.resumeCard}
          onPress={handleResumeLesson}
          activeOpacity={0.65}
        >
          <View style={styles.resumeLeft}>
            <View style={styles.resumeDot} />
            <View style={styles.resumeInfo}>
              <Text style={styles.resumeTitle}>Aktiver Unterricht</Text>
              <Text style={styles.resumeSubtitle}>
                {data.classes.find((c) => c.id === activeSession.classId)?.name} · {activeSession.subject}
              </Text>
            </View>
          </View>
          <ChevronRight size={17} color={Colors.textSecondary} strokeWidth={1.8} />
        </TouchableOpacity>
      )}

      <Text style={styles.sectionLabel}>KLASSE</Text>
      <View style={styles.cardGroup}>
        {data.classes.map((cls, index) => (
          <React.Fragment key={cls.id}>
            {index > 0 && <View style={styles.divider} />}
            <TouchableOpacity
              style={styles.listRow}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedClassId(cls.id);
              }}
              activeOpacity={0.55}
            >
              <View style={styles.listRowLeft}>
                <View style={[styles.listRowIcon, selectedClassId === cls.id && styles.listRowIconActive]}>
                  <UsersIcon
                    size={15}
                    color={selectedClassId === cls.id ? Colors.primary : Colors.textSecondary}
                    strokeWidth={1.8}
                  />
                </View>
                <View>
                  <Text style={[
                    styles.listRowTitle,
                    selectedClassId === cls.id && styles.listRowTitleActive,
                  ]}>
                    {cls.name}
                  </Text>
                  <Text style={styles.listRowMeta}>{cls.students.length} Schüler</Text>
                </View>
              </View>
              <View style={[
                styles.radioOuter,
                selectedClassId === cls.id && styles.radioOuterActive,
              ]}>
                {selectedClassId === cls.id && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>

      <Text style={styles.sectionLabel}>FACH</Text>
      <View style={styles.chipWrap}>
        {data.profile.subjects.map((subject) => (
          <TouchableOpacity
            key={subject}
            style={[
              styles.chip,
              selectedSubject === subject && styles.chipActive,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedSubject(subject);
            }}
            activeOpacity={0.55}
          >
            <Text
              style={[
                styles.chipText,
                selectedSubject === subject && styles.chipTextActive,
              ]}
            >
              {subject}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[
          styles.startBtn,
          (!selectedClassId || !selectedSubject) && styles.startBtnDisabled,
        ]}
        onPress={handleStartLesson}
        activeOpacity={0.7}
        disabled={!selectedClassId || !selectedSubject}
      >
        <Play size={17} color={Colors.white} strokeWidth={2.5} />
        <Text style={styles.startBtnText}>Unterricht starten</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  screenTitle: {
    fontSize: 30,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.5,
    marginBottom: 28,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.neutralLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
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
    textAlign: 'center',
    lineHeight: 20,
  },
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: Colors.positive + '25',
    ...Platform.select({
      ios: { shadowColor: Colors.positive, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
      android: { elevation: 2 },
      default: {},
    }),
  },
  resumeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resumeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.positive,
  },
  resumeInfo: {
    gap: 2,
  },
  resumeTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  resumeSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textLight,
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  cardGroup: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    marginBottom: 28,
    ...Platform.select({
      ios: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8 },
      android: { elevation: 1 },
      default: {},
    }),
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  listRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  listRowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.neutralLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listRowIconActive: {
    backgroundColor: Colors.primaryLight,
  },
  listRowTitle: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  listRowTitleActive: {
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  listRowMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  divider: {
    height: 0.5,
    backgroundColor: Colors.divider,
    marginLeft: 62,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 32,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  chipTextActive: {
    color: Colors.white,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
  },
  startBtnDisabled: {
    opacity: 0.25,
  },
  startBtnText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
});
