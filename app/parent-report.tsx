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
import { X, FileText, Share2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Colors from '@/constants/colors';
import { useApp } from '@/context/AppContext';

export default function ParentReportScreen() {
  const router = useRouter();
  const { classId, studentId } = useLocalSearchParams<{ classId: string; studentId: string }>();
  const { data } = useApp();

  const [isExporting, setIsExporting] = useState<boolean>(false);

  const currentClass = data.classes.find((c) => c.id === classId);
  const student = currentClass?.students.find((s) => s.id === studentId);

  const stats = useMemo(() => {
    if (!student) return null;

    const participations = data.participations.filter((p) => p.studentId === student.id);
    const homework = (data.homeworkEntries || []).filter((h) => h.studentId === student.id);
    const behavior = (data.behaviorEntries || []).filter((b) => b.studentId === student.id);
    const presentations = (data.presentationGrades || []).filter((p) => p.studentId === student.id);

    const bySubject: Record<string, { positive: number; neutral: number; negative: number; total: number }> = {};
    for (const p of participations) {
      if (!bySubject[p.subject]) {
        bySubject[p.subject] = { positive: 0, neutral: 0, negative: 0, total: 0 };
      }
      bySubject[p.subject].total++;
      if (p.rating === '+') bySubject[p.subject].positive++;
      else if (p.rating === 'o') bySubject[p.subject].neutral++;
      else bySubject[p.subject].negative++;
    }

    const totalHomework = homework.length;
    const homeworkDone = homework.filter((h) => h.status === 'done' || h.status === 'late').length;
    const homeworkQuote = totalHomework > 0 ? Math.round((homeworkDone / totalHomework) * 100) : 0;

    const praiseCount = behavior.filter((b) => b.type === 'praise').length;
    const reprimandCount = behavior.filter((b) => b.type === 'reprimand').length;

    return {
      bySubject,
      totalHomework,
      homeworkDone,
      homeworkQuote,
      praiseCount,
      reprimandCount,
      behavior,
      presentations,
    };
  }, [student, data.participations, data.homeworkEntries, data.behaviorEntries, data.presentationGrades]);

  const generateHTML = useCallback(() => {
    if (!student || !currentClass || !stats) return '';

    const now = new Date();
    const dateStr = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const subjectRows = Object.entries(stats.bySubject)
      .map(([subject, s]) => {
        const trend = s.positive - s.negative;
        const trendStr = trend > 0 ? `+${trend}` : String(trend);
        const trendColor = trend > 0 ? '#059669' : trend < 0 ? '#DC2626' : '#94979E';
        return `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #E5E5E5;font-weight:500;">${subject}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #E5E5E5;text-align:center;">${s.positive}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #E5E5E5;text-align:center;">${s.neutral}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #E5E5E5;text-align:center;color:#DC2626;">${s.negative}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #E5E5E5;text-align:center;font-weight:600;color:${trendColor};">${trendStr}</td>
          </tr>`;
      })
      .join('');

    const presentationRows = stats.presentations
      .map((p) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #E5E5E5;">${p.subject}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #E5E5E5;">${p.topic}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #E5E5E5;text-align:center;font-weight:600;">${p.calculatedGrade.toFixed(1)}</td>
        </tr>`)
      .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page { margin: 20mm; size: A4; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #16171A; margin: 0; padding: 0; line-height: 1.5; }
    .logo-placeholder { width: 80px; height: 80px; border: 2px dashed #E5E5E5; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #A9ABB3; font-size: 10px; text-align: center; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid #16171A; }
    .header-left h1 { margin: 0 0 4px; font-size: 24px; font-weight: 700; }
    .header-left p { margin: 0; font-size: 13px; color: #6E7078; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #16171A; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 1.5px solid #E5E5E5; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; border-bottom: 2px solid #16171A; color: #6E7078; }
    .stat-grid { display: flex; gap: 16px; flex-wrap: wrap; }
    .stat-box { background: #F4F4F6; padding: 16px; border-radius: 10px; min-width: 120px; flex: 1; }
    .stat-box .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6E7078; margin-bottom: 6px; }
    .stat-box .value { font-size: 28px; font-weight: 700; }
    .behavior-note { background: #F8F9FA; padding: 10px 14px; border-radius: 8px; margin-bottom: 6px; font-size: 12px; border-left: 3px solid; }
    .praise { border-left-color: #059669; }
    .reprimand { border-left-color: #DC2626; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #E5E5E5; display: flex; justify-content: space-between; font-size: 10px; color: #A9ABB3; }
    .signature-line { margin-top: 48px; display: flex; gap: 60px; }
    .signature-line div { flex: 1; padding-top: 8px; border-top: 1px solid #16171A; font-size: 11px; color: #6E7078; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>Elternsprechtag-Bericht</h1>
      <p>${student.firstName} ${student.lastName} | Klasse ${currentClass.name}</p>
      <p>${data.profile.school || 'Schule'} | ${dateStr}</p>
    </div>
    <div class="logo-placeholder">Schul-<br/>Logo</div>
  </div>

  <div class="section">
    <div class="section-title">Mitarbeit nach Fach</div>
    <table>
      <thead><tr><th>Fach</th><th style="text-align:center;">+ Positiv</th><th style="text-align:center;">○ Neutral</th><th style="text-align:center;">− Negativ</th><th style="text-align:center;">Trend</th></tr></thead>
      <tbody>${subjectRows || '<tr><td colspan="5" style="padding:12px;color:#A9ABB3;">Keine Mitarbeitsdaten vorhanden.</td></tr>'}</tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Übersicht</div>
    <div class="stat-grid">
      <div class="stat-box">
        <div class="label">Hausaufgaben-Quote</div>
        <div class="value" style="color:${stats.homeworkQuote >= 80 ? '#059669' : stats.homeworkQuote >= 50 ? '#D97706' : '#DC2626'};">${stats.homeworkQuote}%</div>
      </div>
      <div class="stat-box">
        <div class="label">Lob</div>
        <div class="value" style="color:#059669;">${stats.praiseCount}</div>
      </div>
      <div class="stat-box">
        <div class="label">Tadel</div>
        <div class="value" style="color:#DC2626;">${stats.reprimandCount}</div>
      </div>
    </div>
  </div>

  ${stats.presentations.length > 0 ? `
  <div class="section">
    <div class="section-title">Referate</div>
    <table>
      <thead><tr><th>Fach</th><th>Thema</th><th style="text-align:center;">Note</th></tr></thead>
      <tbody>${presentationRows}</tbody>
    </table>
  </div>` : ''}

  ${stats.behavior.length > 0 ? `
  <div class="section">
    <div class="section-title">Verhaltensnotizen</div>
    ${stats.behavior.slice(0, 10).map((b) => `
      <div class="behavior-note ${b.type}">
        <strong>${b.type === 'praise' ? 'Lob' : 'Tadel'}</strong> — ${new Date(b.date).toLocaleDateString('de-DE')}${b.note ? ': ' + b.note : ''}
      </div>
    `).join('')}
  </div>` : ''}

  <div class="signature-line">
    <div>Lehrkraft: ${data.profile.name || '_______________'}</div>
    <div>Erziehungsberechtigte/r: _______________</div>
  </div>

  <div class="footer">
    <span>Vertraulich — Nur für den internen Gebrauch</span>
    <span>Erstellt am ${dateStr}</span>
  </div>
</body>
</html>`;
  }, [student, currentClass, stats, data.profile]);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const html = generateHTML();
      if (!html) {
        Alert.alert('Fehler', 'Bericht konnte nicht erstellt werden.');
        return;
      }

      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Elternsprechtag-Bericht',
            UTI: 'com.adobe.pdf',
          });
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('[ParentReport] Export error:', error);
      Alert.alert('Fehler', 'Export fehlgeschlagen.');
    } finally {
      setIsExporting(false);
    }
  }, [generateHTML]);

  if (!student || !currentClass || !stats) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Schüler nicht gefunden.</Text>
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
            <Text style={styles.title}>Elternsprechtag</Text>
            <Text style={styles.subtitle}>
              {student.firstName} {student.lastName}
            </Text>
          </View>
          <TouchableOpacity style={styles.headerCloseBtn} onPress={() => router.back()}>
            <X size={18} color={Colors.text} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <FileText size={20} color={Colors.primary} strokeWidth={1.8} />
              <Text style={styles.previewTitle}>DIN-A4 PDF-Bericht</Text>
            </View>
            <Text style={styles.previewDesc}>
              Professioneller Bericht mit Mitarbeit, Hausaufgaben-Quote, Verhalten und Referatsnoten.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>VORSCHAU</Text>

          <View style={styles.dataCard}>
            <Text style={styles.dataTitle}>Mitarbeit</Text>
            {Object.entries(stats.bySubject).map(([subject, s]) => (
              <View key={subject} style={styles.dataRow}>
                <Text style={styles.dataLabel}>{subject}</Text>
                <View style={styles.dataValues}>
                  <Text style={[styles.dataValue, { color: '#059669' }]}>+{s.positive}</Text>
                  <Text style={[styles.dataValue, { color: '#94979E' }]}>○{s.neutral}</Text>
                  <Text style={[styles.dataValue, { color: '#DC2626' }]}>−{s.negative}</Text>
                </View>
              </View>
            ))}
            {Object.keys(stats.bySubject).length === 0 && (
              <Text style={styles.noData}>Keine Mitarbeitsdaten</Text>
            )}
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: '#ECFDF5' }]}>
              <Text style={styles.statLabel}>HA-Quote</Text>
              <Text style={[styles.statValue, { color: '#059669' }]}>{stats.homeworkQuote}%</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: '#ECFDF5' }]}>
              <Text style={styles.statLabel}>Lob</Text>
              <Text style={[styles.statValue, { color: '#059669' }]}>{stats.praiseCount}</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: '#FEF2F2' }]}>
              <Text style={styles.statLabel}>Tadel</Text>
              <Text style={[styles.statValue, { color: '#DC2626' }]}>{stats.reprimandCount}</Text>
            </View>
          </View>

          {stats.presentations.length > 0 && (
            <View style={styles.dataCard}>
              <Text style={styles.dataTitle}>Referate</Text>
              {stats.presentations.map((p) => (
                <View key={p.id} style={styles.dataRow}>
                  <Text style={styles.dataLabel}>{p.topic}</Text>
                  <Text style={[styles.dataValue, { fontWeight: '700' as const }]}>{p.calculatedGrade.toFixed(1)}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.exportBtn, isExporting && styles.exportBtnDisabled]}
            onPress={handleExport}
            activeOpacity={0.7}
            disabled={isExporting}
          >
            <Share2 size={17} color={Colors.white} strokeWidth={2} />
            <Text style={styles.exportBtnText}>
              {isExporting ? 'Wird erstellt...' : 'PDF exportieren'}
            </Text>
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
  previewCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
      default: {},
    }),
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  previewDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textLight,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  dataCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  dataTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 10,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  dataLabel: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  dataValues: {
    flexDirection: 'row',
    gap: 12,
  },
  dataValue: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  noData: {
    fontSize: 13,
    color: Colors.textLight,
    paddingVertical: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700' as const,
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
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
  },
  exportBtnDisabled: {
    opacity: 0.5,
  },
  exportBtnText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
});
