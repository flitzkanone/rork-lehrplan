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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Plus, Trash2, Edit3, X, StickyNote } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useApp } from '@/context/AppContext';
import type { Student } from '@/types';

export default function ClassDetailScreen() {
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const { data, addStudent, updateStudent, deleteStudent } = useApp();
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const currentClass = data.classes.find((c) => c.id === classId);

  const resetForm = () => {
    setFirstName('');
    setLastName('');
    setNote('');
  };

  const handleAddStudent = useCallback(() => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Fehler', 'Vor- und Nachname sind erforderlich.');
      return;
    }
    if (!classId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addStudent(classId, firstName.trim(), lastName.trim(), note.trim());
    resetForm();
    setShowAddModal(false);
  }, [firstName, lastName, note, classId, addStudent]);

  const handleEditStudent = useCallback(() => {
    if (!editingStudent || !classId) return;
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Fehler', 'Vor- und Nachname sind erforderlich.');
      return;
    }
    updateStudent(classId, editingStudent.id, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      note: note.trim(),
    });
    setShowEditModal(false);
    setEditingStudent(null);
    resetForm();
  }, [editingStudent, firstName, lastName, note, classId, updateStudent]);

  const handleDeleteStudent = useCallback(
    (student: Student) => {
      if (!classId) return;
      Alert.alert(
        'Schüler löschen?',
        `${student.firstName} ${student.lastName} wirklich löschen?`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Löschen',
            style: 'destructive',
            onPress: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              deleteStudent(classId, student.id);
            },
          },
        ]
      );
    },
    [classId, deleteStudent]
  );

  const openEdit = (student: Student) => {
    setEditingStudent(student);
    setFirstName(student.firstName);
    setLastName(student.lastName);
    setNote(student.note);
    setShowEditModal(true);
  };

  if (!currentClass) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Klasse nicht gefunden.</Text>
      </View>
    );
  }

  const sortedStudents = [...currentClass.students].sort((a, b) =>
    a.lastName.localeCompare(b.lastName)
  );

  const renderStudent = ({ item }: { item: Student }) => (
    <View style={styles.studentCard}>
      <View style={styles.studentLeft}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(item.firstName || '?')[0]}{(item.lastName || '?')[0]}
          </Text>
        </View>
        <View style={styles.studentInfo}>
          <Text style={styles.studentName}>
            {item.lastName}, {item.firstName}
          </Text>
          {item.note ? (
            <View style={styles.noteRow}>
              <StickyNote size={10} color={Colors.textLight} strokeWidth={1.5} />
              <Text style={styles.noteText} numberOfLines={1}>{item.note}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.studentActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(item)}>
          <Edit3 size={14} color={Colors.textSecondary} strokeWidth={1.7} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleDeleteStudent(item)}>
          <Trash2 size={14} color={Colors.negative} strokeWidth={1.7} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFormModal = (visible: boolean, onClose: () => void, onSubmit: () => void, title: string, btnText: string) => (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
            </TouchableOpacity>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Vorname</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Vorname"
              placeholderTextColor={Colors.textLight}
              autoFocus
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nachname</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Nachname"
              placeholderTextColor={Colors.textLight}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Notiz</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={note}
              onChangeText={setNote}
              placeholder="Optionale Notiz"
              placeholderTextColor={Colors.textLight}
              multiline
              numberOfLines={3}
            />
          </View>
          <TouchableOpacity style={styles.submitBtn} onPress={onSubmit} activeOpacity={0.7}>
            <Text style={styles.submitBtnText}>{btnText}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: currentClass.name,
          headerRight: () => (
            <Text style={styles.headerStudentCount}>{sortedStudents.length} Schüler</Text>
          ),
        }} 
      />
      <FlatList
        data={sortedStudents}
        keyExtractor={(item) => item.id}
        renderItem={renderStudent}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Keine Schüler</Text>
            <Text style={styles.emptySubtitle}>{"Fügen Sie Schüler mit \u201e+\u201c hinzu."}</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          resetForm();
          setShowAddModal(true);
        }}
        activeOpacity={0.7}
      >
        <Plus size={22} color={Colors.white} strokeWidth={2.5} />
      </TouchableOpacity>

      {renderFormModal(showAddModal, () => setShowAddModal(false), handleAddStudent, 'Schüler hinzufügen', 'Hinzufügen')}
      {renderFormModal(showEditModal, () => { setShowEditModal(false); setEditingStudent(null); }, handleEditStudent, 'Schüler bearbeiten', 'Speichern')}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 100,
    flexGrow: 1,
  },
  headerStudentCount: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginRight: 4,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 14,
    ...Platform.select({
      ios: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8 },
      android: { elevation: 1 },
      default: {},
    }),
  },
  studentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  studentInfo: {
    flex: 1,
    gap: 2,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  noteText: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
  },
  studentActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    height: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
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
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textLight,
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  inputMultiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
});
