import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Alert,
  Modal,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, Users, ChevronRight, Trash2, X, Search } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/context/AppContext';
import { ClassesScreenSkeleton } from '@/components/SkeletonLoader';
import type { SchoolClass } from '@/types';

export default function ClassesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, addClass, deleteClass, isLoading } = useApp();
  const [showModal, setShowModal] = useState<boolean>(false);
  const [newClassName, setNewClassName] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredClasses = React.useMemo(() => {
    if (!searchQuery.trim()) return data.classes;
    const q = searchQuery.toLowerCase().trim();
    return data.classes.filter((cls) => {
      if (cls.name.toLowerCase().includes(q)) return true;
      return cls.students.some(
        (s) =>
          s.firstName.toLowerCase().includes(q) ||
          s.lastName.toLowerCase().includes(q)
      );
    });
  }, [data.classes, searchQuery]);

  const handleCreate = useCallback(async () => {
    if (!newClassName.trim()) {
      Alert.alert('Fehler', 'Bitte geben Sie einen Klassennamen ein.');
      return;
    }
    setIsCreating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await new Promise<void>((resolve) => setTimeout(resolve, 600));
    addClass(newClassName.trim());
    setNewClassName('');
    setIsCreating(false);
    setShowModal(false);
  }, [newClassName, addClass]);

  const handleDelete = useCallback(
    (cls: SchoolClass) => {
      Alert.alert(
        'Klasse löschen?',
        `Möchten Sie "${cls.name}" wirklich löschen? Alle Schüler und Bewertungen werden entfernt.`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Löschen',
            style: 'destructive',
            onPress: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              deleteClass(cls.id);
            },
          },
        ]
      );
    },
    [deleteClass]
  );

  const renderClass = useCallback(
    ({ item }: { item: SchoolClass }) => (
      <TouchableOpacity
        style={styles.classCard}
        onPress={() => router.push(`/(tabs)/classes/${item.id}` as any)}
        activeOpacity={0.55}
      >
        <View style={styles.classLeft}>
          <View style={styles.classIcon}>
            <Users size={16} color={Colors.primary} strokeWidth={1.8} />
          </View>
          <View>
            <Text style={styles.className}>{item.name}</Text>
            <Text style={styles.classCount}>{item.students.length} Schüler</Text>
          </View>
        </View>
        <View style={styles.classActions}>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Trash2 size={15} color={Colors.textLight} strokeWidth={1.7} />
          </TouchableOpacity>
          <ChevronRight size={17} color={Colors.textLight} strokeWidth={1.7} />
        </View>
      </TouchableOpacity>
    ),
    [router, handleDelete]
  );

  if (isLoading) {
    return <ClassesScreenSkeleton />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredClasses}
        keyExtractor={(item) => item.id}
        renderItem={renderClass}
        contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 16 }]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <Text style={styles.screenTitle}>Klassen</Text>
            <View style={styles.searchContainer}>
              <Search size={16} color={Colors.textLight} strokeWidth={1.8} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Klasse oder Schüler suchen..."
                placeholderTextColor={Colors.textLight}
                testID="search-classes"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={16} color={Colors.textSecondary} strokeWidth={1.8} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Users size={26} color={Colors.textLight} strokeWidth={1.4} />
            </View>
            <Text style={styles.emptyTitle}>Noch keine Klassen</Text>
            <Text style={styles.emptySubtitle}>
              {"Tippen Sie auf \u201e+\u201c, um Ihre erste Klasse zu erstellen."}
            </Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowModal(true)}
        activeOpacity={0.7}
      >
        <Plus size={22} color={Colors.white} strokeWidth={2.5} />
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {isCreating && (
              <View style={styles.creatingOverlay}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            )}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Neue Klasse</Text>
              <TouchableOpacity onPress={() => { if (!isCreating) setShowModal(false); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              value={newClassName}
              onChangeText={setNewClassName}
              placeholder="z.B. 8a, 10b, Q1"
              placeholderTextColor={Colors.textLight}
              autoFocus
              editable={!isCreating}
              testID="input-class-name"
            />
            <TouchableOpacity
              style={[styles.modalBtn, isCreating && styles.modalBtnDisabled]}
              onPress={handleCreate}
              activeOpacity={0.7}
              disabled={isCreating}
            >
              <Text style={styles.modalBtnText}>Erstellen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    flexGrow: 1,
  },
  screenTitle: {
    fontSize: 30,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.divider,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    padding: 0,
  },
  classCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8 },
      android: { elevation: 1 },
      default: {},
    }),
  },
  classLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  classIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  className: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  classCount: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  classActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  deleteBtn: {
    padding: 6,
  },
  separator: {
    height: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
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
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 6 },
      default: {},
    }),
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
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  modalInput: {
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 16,
  },
  modalBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalBtnDisabled: {
    opacity: 0.5,
  },
  creatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.8)',
    zIndex: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
});
