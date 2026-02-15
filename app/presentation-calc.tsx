import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Save, Settings2, ChevronDown, ChevronUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/context/AppContext';
import type { PresentationCriteria, PresentationWeights } from '@/types';

const CRITERIA_LABELS: Record<keyof PresentationCriteria, string> = {
  content: 'Inhalt',
  language: 'Sprache',
  media: 'Medien',
  timing: 'Zeiteinteilung',
  presence: 'Auftreten',
};

const CRITERIA_DESCRIPTIONS: Record<keyof PresentationCriteria, string> = {
  content: 'Fachliche Korrektheit, Tiefe, Struktur',
  language: 'Ausdruck, Grammatik, Fachbegriffe',
  media: 'Visualisierung, Folienqualität, Anschaulichkeit',
  timing: 'Zeitrahmen eingehalten, gutes Pacing',
  presence: 'Blickkontakt, Körpersprache, Souveränität',
};

const GRADE_COLORS: Record<number, string> = {
  1: '#059669',
  2: '#0891B2',
  3: '#2563EB',
  4: '#D97706',
  5: '#EA580C',
  6: '#DC2626',
};

function getGradeColor(grade: number): string {
  const rounded = Math.round(grade);
  return GRADE_COLORS[Math.min(Math.max(rounded, 1), 6)] || Colors.text;
}

function getGradeLabel(grade: number): string {
  const rounded = Math.round(grade);
  const labels: Record<number, string> = {
    1: 'Sehr gut',
    2: 'Gut',
    3: 'Befriedigend',
    4: 'Ausreichend',
    5: 'Mangelhaft',
    6: 'Ungenügend',
  };
  return labels[Math.min(Math.max(rounded, 1), 6)] || '';
}

export default function PresentationCalcScreen() {
  const router = useRouter();
  const { classId, studentId, subject } = useLocalSearchParams<{
    classId: string;
    studentId: string;
    subject: string;
  }>();
  const { data, addPresentationGrade } = useApp();

  const currentClass = data.classes.find((c) => c.id === classId);
  const student = currentClass?.students.find((s) => s.id === studentId);

  const [topic, setTopic] = useState<string>('');
  const [showWeights, setShowWeights] = useState<boolean>(false);
  const [criteria, setCriteria] = useState<PresentationCriteria>({
    content: 2,
    language: 2,
    media: 2,
    timing: 2,
    presence: 2,
  });
  const [weights, setWeights] = useState<PresentationWeights>({
    content: 20,
    language: 20,
    media: 20,
    timing: 20,
    presence: 20,
  });

  const calculatedGrade = useMemo(() => {
    const totalWeight = weights.content + weights.language + weights.media + weights.timing + weights.presence;
    if (totalWeight === 0) return 0;
    return (
      (criteria.content * weights.content +
        criteria.language * weights.language +
        criteria.media * weights.media +
        criteria.timing * weights.timing +
        criteria.presence * weights.presence) /
      totalWeight
    );
  }, [criteria, weights]);

  const setCriterionGrade = useCallback((key: keyof PresentationCriteria, grade: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCriteria((prev) => ({ ...prev, [key]: grade }));
  }, []);

  const setWeight = useCallback((key: keyof PresentationWeights, value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      setWeights((prev) => ({ ...prev, [key]: num }));
    }
  }, []);

  const handleSave = useCallback(() => {
    if (!classId || !studentId || !subject) return;
    if (!topic.trim()) {
      Alert.alert('Fehler', 'Bitte geben Sie ein Thema ein.');
      return;
    }
    addPresentationGrade(studentId, classId, subject, topic.trim(), criteria, weights);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Gespeichert', `Note: ${calculatedGrade.toFixed(1)} (${getGradeLabel(calculatedGrade)})`, [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }, [classId, studentId, subject, topic, criteria, weights, calculatedGrade, addPresentationGrade, router]);

  if (!student || !currentClass) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Schüler nicht gefunden.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Zurück</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const gradeColor = getGradeColor(calculatedGrade);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Referat-Note</Text>
            <Text style={styles.subtitle}>
              {student.firstName} {student.lastName} · {subject}
            </Text>
          </View>
          <TouchableOpacity style={styles.headerCloseBtn} onPress={() => router.back()}>
            <X size={18} color={Colors.text} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.gradeCard}>
            <Text style={[styles.gradeNumber, { color: gradeColor }]}>
              {calculatedGrade.toFixed(1)}
            </Text>
            <Text style={[styles.gradeLabel, { color: gradeColor }]}>
              {getGradeLabel(calculatedGrade)}
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>THEMA</Text>
            <TextInput
              style={styles.input}
              value={topic}
              onChangeText={setTopic}
              placeholder="z.B. Klimawandel, Französische Revolution"
              placeholderTextColor={Colors.textLight}
            />
          </View>

          <Text style={styles.sectionLabel}>BEWERTUNG</Text>
          {(Object.keys(CRITERIA_LABELS) as (keyof PresentationCriteria)[]).map((key) => (
            <View key={key} style={styles.criterionCard}>
              <View style={styles.criterionHeader}>
                <View>
                  <Text style={styles.criterionTitle}>{CRITERIA_LABELS[key]}</Text>
                  <Text style={styles.criterionDesc}>{CRITERIA_DESCRIPTIONS[key]}</Text>
                </View>
                <Text style={[styles.criterionGrade, { color: getGradeColor(criteria[key]) }]}>
                  {criteria[key]}
                </Text>
              </View>
              <View style={styles.gradeRow}>
                {[1, 2, 3, 4, 5, 6].map((grade) => (
                  <TouchableOpacity
                    key={grade}
                    style={[
                      styles.gradeBtn,
                      criteria[key] === grade && {
                        backgroundColor: getGradeColor(grade),
                        borderColor: getGradeColor(grade),
                      },
                    ]}
                    onPress={() => setCriterionGrade(key, grade)}
                    activeOpacity={0.6}
                  >
                    <Text
                      style={[
                        styles.gradeBtnText,
                        criteria[key] === grade && styles.gradeBtnTextActive,
                      ]}
                    >
                      {grade}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={styles.weightsToggle}
            onPress={() => setShowWeights(!showWeights)}
          >
            <Settings2 size={15} color={Colors.textSecondary} strokeWidth={1.8} />
            <Text style={styles.weightsToggleText}>Gewichtung anpassen</Text>
            {showWeights ? (
              <ChevronUp size={15} color={Colors.textSecondary} strokeWidth={1.8} />
            ) : (
              <ChevronDown size={15} color={Colors.textSecondary} strokeWidth={1.8} />
            )}
          </TouchableOpacity>

          {showWeights && (
            <View style={styles.weightsCard}>
              {(Object.keys(CRITERIA_LABELS) as (keyof PresentationWeights)[]).map((key) => (
                <View key={key} style={styles.weightRow}>
                  <Text style={styles.weightLabel}>{CRITERIA_LABELS[key]}</Text>
                  <View style={styles.weightInputWrap}>
                    <TextInput
                      style={styles.weightInput}
                      value={String(weights[key])}
                      onChangeText={(v) => setWeight(key, v)}
                      keyboardType="numeric"
                      maxLength={3}
                    />
                    <Text style={styles.weightUnit}>%</Text>
                  </View>
                </View>
              ))}
              <Text style={styles.weightTotal}>
                Gesamt: {weights.content + weights.language + weights.media + weights.timing + weights.presence}%
              </Text>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.7}>
            <Save size={17} color={Colors.white} strokeWidth={2} />
            <Text style={styles.saveBtnText}>Note speichern</Text>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 4,
  },
  gradeCard: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: Colors.white,
    borderRadius: 20,
    marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
      android: { elevation: 3 },
      default: {},
    }),
  },
  gradeNumber: {
    fontSize: 48,
    fontWeight: '800' as const,
    letterSpacing: -2,
  },
  gradeLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textLight,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textLight,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  criterionCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  criterionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  criterionTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  criterionDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    maxWidth: 220,
  },
  criterionGrade: {
    fontSize: 22,
    fontWeight: '800' as const,
  },
  gradeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  gradeBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.inputBg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradeBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  gradeBtnTextActive: {
    color: Colors.white,
  },
  weightsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 8,
  },
  weightsToggleText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    flex: 1,
  },
  weightsCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  weightLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  weightInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weightInput: {
    width: 50,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.inputBg,
    textAlign: 'center' as const,
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  weightUnit: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  weightTotal: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textAlign: 'right' as const,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: Colors.divider,
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
