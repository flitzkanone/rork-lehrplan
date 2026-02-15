import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Plus, ExternalLink, Trash2, Link2, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import Colors from '@/constants/colors';
import { useApp } from '@/context/AppContext';

function validateUrl(url: string): { valid: boolean; error?: string } {
  if (!url.trim()) return { valid: false, error: 'URL darf nicht leer sein.' };
  if (!url.startsWith('https://')) return { valid: false, error: 'URL muss mit https:// beginnen.' };
  try {
    new URL(url);
    return { valid: true };
  } catch {
    return { valid: false, error: 'Ungültige URL.' };
  }
}

export default function ResourceManagerScreen() {
  const router = useRouter();
  const { classId, subject } = useLocalSearchParams<{ classId: string; subject: string }>();
  const { data, addResource, deleteResource } = useApp();

  const currentClass = data.classes.find((c) => c.id === classId);

  const [url, setUrl] = useState<string>('');
  const [title, setTitle] = useState<string>('');
  const [urlError, setUrlError] = useState<string>('');

  const resources = useMemo(() => {
    return data.resources.filter((r) => r.classId === classId && r.subject === subject);
  }, [data.resources, classId, subject]);

  const handleAdd = useCallback(() => {
    const validation = validateUrl(url);
    if (!validation.valid) {
      setUrlError(validation.error || 'Ungültige URL');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Fehler', 'Bitte geben Sie einen Titel ein.');
      return;
    }
    if (!classId || !subject) return;

    addResource(classId, subject, url.trim(), title.trim());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setUrl('');
    setTitle('');
    setUrlError('');
  }, [url, title, classId, subject, addResource]);

  const handleOpen = useCallback(async (resourceUrl: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (Platform.OS === 'web') {
        Linking.openURL(resourceUrl);
      } else {
        await WebBrowser.openBrowserAsync(resourceUrl);
      }
    } catch (error) {
      console.log('[ResourceManager] Failed to open URL:', error);
      Linking.openURL(resourceUrl);
    }
  }, []);

  const handleDelete = useCallback(
    (resourceId: string, resourceTitle: string) => {
      Alert.alert('Löschen?', `"${resourceTitle}" wirklich entfernen?`, [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: () => {
            deleteResource(resourceId);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]);
    },
    [deleteResource]
  );

  const getResourceIcon = (resourceUrl: string) => {
    if (resourceUrl.includes('youtube.com') || resourceUrl.includes('youtu.be')) {
      return '▶';
    }
    if (resourceUrl.endsWith('.pdf')) {
      return '📄';
    }
    return '🔗';
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Materialien</Text>
            <Text style={styles.subtitle}>{currentClass?.name || 'Klasse'} · {subject}</Text>
          </View>
          <TouchableOpacity style={styles.headerCloseBtn} onPress={() => router.back()}>
            <X size={18} color={Colors.text} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.addCard}>
            <Text style={styles.addTitle}>Neues Material</Text>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>TITEL</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="z.B. Arbeitsblatt Kapitel 3"
                placeholderTextColor={Colors.textLight}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>URL</Text>
              <View style={styles.urlInputRow}>
                <Link2 size={15} color={Colors.textLight} strokeWidth={1.8} />
                <TextInput
                  style={styles.urlInput}
                  value={url}
                  onChangeText={(v) => { setUrl(v); setUrlError(''); }}
                  placeholder="https://..."
                  placeholderTextColor={Colors.textLight}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </View>
              {urlError ? (
                <View style={styles.errorRow}>
                  <AlertCircle size={12} color={Colors.negative} strokeWidth={2} />
                  <Text style={styles.errorText}>{urlError}</Text>
                </View>
              ) : null}
            </View>
            <TouchableOpacity style={styles.addBtn} onPress={handleAdd} activeOpacity={0.7}>
              <Plus size={16} color={Colors.white} strokeWidth={2.5} />
              <Text style={styles.addBtnText}>Hinzufügen</Text>
            </TouchableOpacity>
          </View>

          {resources.length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>GESPEICHERTE MATERIALIEN</Text>
              {resources.map((resource) => (
                <View key={resource.id} style={styles.resourceCard}>
                  <TouchableOpacity
                    style={styles.resourceMain}
                    onPress={() => handleOpen(resource.url)}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.resourceIcon}>{getResourceIcon(resource.url)}</Text>
                    <View style={styles.resourceInfo}>
                      <Text style={styles.resourceTitle} numberOfLines={1}>{resource.title}</Text>
                      <Text style={styles.resourceUrl} numberOfLines={1}>{resource.url}</Text>
                    </View>
                    <ExternalLink size={15} color={Colors.textSecondary} strokeWidth={1.8} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.resourceDeleteBtn}
                    onPress={() => handleDelete(resource.id, resource.title)}
                  >
                    <Trash2 size={13} color={Colors.negative} strokeWidth={1.8} />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Link2 size={28} color={Colors.textLight} strokeWidth={1.4} />
              <Text style={styles.emptyTitle}>Keine Materialien</Text>
              <Text style={styles.emptySubtitle}>Fügen Sie Links zu Arbeitsblättern, Videos oder PDFs hinzu.</Text>
            </View>
          )}
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
    paddingBottom: 40,
  },
  addCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
      default: {},
    }),
  },
  addTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textLight,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  urlInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: 10,
    paddingHorizontal: 14,
    gap: 8,
  },
  urlInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  errorText: {
    fontSize: 12,
    color: Colors.negative,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 13,
    borderRadius: 12,
  },
  addBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textLight,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 14,
    marginBottom: 6,
    overflow: 'hidden',
  },
  resourceMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  resourceIcon: {
    fontSize: 20,
  },
  resourceInfo: {
    flex: 1,
    gap: 2,
  },
  resourceTitle: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  resourceUrl: {
    fontSize: 11,
    color: Colors.textLight,
  },
  resourceDeleteBtn: {
    width: 40,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
});
