import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  AppData,
  SchoolClass,
  Student,
  ParticipationEntry,
  LessonSession,
  TeacherProfile,
  ParticipationRating,
  BackupMetadata,
  HomeworkEntry,
  HomeworkStatus,
  BehaviorEntry,
  BehaviorType,
  PresentationGrade,
  PresentationCriteria,
  PresentationWeights,
  ResourceLink,
  StudentCallCount,
} from '@/types';
import { encrypt, decrypt, hashPin, verifyPin } from '@/utils/encryption';
import { getLatestValidBackup, restoreBackup, logBackupAction } from '@/utils/backup';
import {
  showLessonNotification,
  updateLessonNotification,
  dismissLessonNotification,
  setupNotificationCategories,
} from '@/utils/lessonNotification';

const STORAGE_KEY = 'teacher_app_data_encrypted';
const PIN_HASH_KEY = 'teacher_app_pin_hash';
const RECOVERY_ATTEMPTED_KEY = 'teacher_app_recovery_attempted';
const PRIVACY_ACCEPTED_KEY = 'teacher_app_privacy_accepted';

const defaultData: AppData = {
  profile: { name: '', school: '', subjects: [] },
  classes: [],
  participations: [],
  homeworkEntries: [],
  behaviorEntries: [],
  presentationGrades: [],
  resources: [],
  callCounts: [],
  activeSession: null,
  onboardingComplete: false,
  pinHash: '',
};

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export const [AppProvider, useApp] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [data, setData] = useState<AppData>(defaultData);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [recoveryAvailable, setRecoveryAvailable] = useState<BackupMetadata | null>(null);
  const [isRecovering, setIsRecovering] = useState<boolean>(false);
  const [privacyAccepted, setPrivacyAccepted] = useState<boolean>(false);
  const currentPinRef = useRef<string>('');

  const pinHashQuery = useQuery({
    queryKey: ['pinHash'],
    queryFn: async () => {
      const hash = await AsyncStorage.getItem(PIN_HASH_KEY);
      return hash || '';
    },
  });

  const privacyQuery = useQuery({
    queryKey: ['privacyAccepted'],
    queryFn: async () => {
      const accepted = await AsyncStorage.getItem(PRIVACY_ACCEPTED_KEY);
      return accepted === 'true';
    },
  });

  useEffect(() => {
    if (privacyQuery.data !== undefined) {
      setPrivacyAccepted(privacyQuery.data);
    }
  }, [privacyQuery.data]);

  const checkForRecoveryQuery = useQuery({
    queryKey: ['checkRecovery'],
    queryFn: async () => {
      try {
        const recoveryAttempted = await AsyncStorage.getItem(RECOVERY_ATTEMPTED_KEY);
        if (recoveryAttempted === 'true') {
          console.log('[AppContext] Recovery already attempted this session');
          return null;
        }

        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        const pinHash = await AsyncStorage.getItem(PIN_HASH_KEY);
        
        if (!stored && !pinHash) {
          console.log('[AppContext] No data found, checking for backups...');
          const latestBackup = await getLatestValidBackup();
          if (latestBackup) {
            console.log('[AppContext] Found valid backup for recovery:', latestBackup.id);
            await logBackupAction('validate', 'success', latestBackup.id, 'Backup available for recovery');
            return latestBackup;
          }
        }
        return null;
      } catch (error) {
        console.log('[AppContext] Recovery check error:', error);
        return null;
      }
    },
  });

  useEffect(() => {
    if (checkForRecoveryQuery.data) {
      setRecoveryAvailable(checkForRecoveryQuery.data);
    }
  }, [checkForRecoveryQuery.data]);

  const dataQuery = useQuery({
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ['appData'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (!stored) return defaultData;
      if (!currentPinRef.current) {
        console.log('No PIN available for decryption');
        return defaultData;
      }
      const decrypted = decrypt(stored, currentPinRef.current);
      if (!decrypted) {
        console.log('Failed to decrypt data');
        return defaultData;
      }
      return JSON.parse(decrypted) as AppData;
    },
    enabled: false,
  });

  const saveMutation = useMutation({
    mutationFn: async (newData: AppData) => {
      if (!currentPinRef.current) {
        console.log('[AppContext] No PIN available for encryption');
        return newData;
      }
      try {
        const encrypted = encrypt(JSON.stringify(newData), currentPinRef.current);
        await AsyncStorage.setItem(STORAGE_KEY, encrypted);
      } catch (error) {
        console.error('[AppContext] Failed to save data:', error);
      }
      return newData;
    },
    onSuccess: (newData) => {
      queryClient.setQueryData(['appData'], newData);
    },
  });

  useEffect(() => {
    if (dataQuery.data && isAuthenticated) {
      setData(dataQuery.data);
    }
  }, [dataQuery.data, isAuthenticated]);

  const { mutate: saveToStorage } = saveMutation;

  const save = useCallback(
    (updater: (prev: AppData) => AppData) => {
      setData((prev) => {
        try {
          const next = updater(prev);
          queueMicrotask(() => saveToStorage(next));
          return next;
        } catch (error) {
          console.error('[AppContext] Error in save updater:', error);
          return prev;
        }
      });
    },
    [saveToStorage]
  );

  const completeOnboarding = useCallback(
    async (profile: TeacherProfile, pin: string) => {
      currentPinRef.current = pin;
      const pinHashValue = hashPin(pin);
      await AsyncStorage.setItem(PIN_HASH_KEY, pinHashValue);
      queryClient.setQueryData(['pinHash'], pinHashValue);
      const newData: AppData = {
        ...defaultData,
        profile,
        onboardingComplete: true,
        pinHash: pinHashValue,
      };
      setData(newData);
      const encrypted = encrypt(JSON.stringify(newData), pin);
      await AsyncStorage.setItem(STORAGE_KEY, encrypted);
      setIsAuthenticated(true);
    },
    [queryClient]
  );

  const updateProfile = useCallback(
    (profile: Partial<TeacherProfile>) => {
      save((prev) => ({
        ...prev,
        profile: { ...prev.profile, ...profile },
      }));
    },
    [save]
  );

  const updatePin = useCallback(
    async (newPin: string) => {
      const newPinHash = hashPin(newPin);
      currentPinRef.current = newPin;
      await AsyncStorage.setItem(PIN_HASH_KEY, newPinHash);
      queryClient.setQueryData(['pinHash'], newPinHash);
      save((prev) => ({ ...prev, pinHash: newPinHash }));
    },
    [save, queryClient]
  );

  const addClass = useCallback(
    (name: string) => {
      const newClass: SchoolClass = {
        id: generateId(),
        name,
        students: [],
        createdAt: new Date().toISOString(),
      };
      save((prev) => ({ ...prev, classes: [...prev.classes, newClass] }));
      return newClass;
    },
    [save]
  );

  const deleteClass = useCallback(
    (classId: string) => {
      save((prev) => ({
        ...prev,
        classes: prev.classes.filter((c) => c.id !== classId),
        participations: prev.participations.filter((p) => p.classId !== classId),
      }));
    },
    [save]
  );

  const addStudent = useCallback(
    (classId: string, firstName: string, lastName: string, note: string) => {
      const student: Student = { id: generateId(), firstName, lastName, note };
      save((prev) => ({
        ...prev,
        classes: prev.classes.map((c) =>
          c.id === classId ? { ...c, students: [...c.students, student] } : c
        ),
      }));
      return student;
    },
    [save]
  );

  const updateStudent = useCallback(
    (classId: string, studentId: string, updates: Partial<Student>) => {
      save((prev) => ({
        ...prev,
        classes: prev.classes.map((c) =>
          c.id === classId
            ? {
                ...c,
                students: c.students.map((s) =>
                  s.id === studentId ? { ...s, ...updates } : s
                ),
              }
            : c
        ),
      }));
    },
    [save]
  );

  const deleteStudent = useCallback(
    (classId: string, studentId: string) => {
      save((prev) => ({
        ...prev,
        classes: prev.classes.map((c) =>
          c.id === classId
            ? { ...c, students: c.students.filter((s) => s.id !== studentId) }
            : c
        ),
        participations: prev.participations.filter(
          (p) => p.studentId !== studentId
        ),
      }));
    },
    [save]
  );

  const startSession = useCallback(
    (classId: string, subject: string) => {
      const session: LessonSession = {
        id: generateId(),
        classId,
        subject,
        startedAt: new Date().toISOString(),
        ratings: {},
      };
      save((prev) => {
        const schoolClass = prev.classes.find((c) => c.id === classId);
        const totalStudents = schoolClass?.students.length || 0;
        showLessonNotification(session, schoolClass, 0, totalStudents);
        return { ...prev, activeSession: session };
      });
      return session;
    },
    [save]
  );

  const rateStudent = useCallback(
    (studentId: string, rating: ParticipationRating) => {
      save((prev) => {
        if (!prev.activeSession) return prev;
        const newRatings = { ...prev.activeSession.ratings, [studentId]: rating };
        const schoolClass = prev.classes.find((c) => c.id === prev.activeSession!.classId);
        const totalStudents = schoolClass?.students.length || 0;
        const ratedCount = Object.keys(newRatings).length;
        
        updateLessonNotification(
          { ...prev.activeSession, ratings: newRatings },
          schoolClass,
          ratedCount,
          totalStudents
        );
        
        return {
          ...prev,
          activeSession: {
            ...prev.activeSession,
            ratings: newRatings,
          },
        };
      });
    },
    [save]
  );

  const endSession = useCallback(() => {
    dismissLessonNotification();
    save((prev) => {
      if (!prev.activeSession) return prev;
      const session = prev.activeSession;
      const classObj = prev.classes.find((c) => c.id === session.classId);
      if (!classObj) return { ...prev, activeSession: null };

      const newEntries: ParticipationEntry[] = classObj.students.map((s) => ({
        id: generateId(),
        studentId: s.id,
        classId: session.classId,
        subject: session.subject,
        rating: session.ratings[s.id] || 'o',
        date: session.startedAt,
        sessionId: session.id,
      }));

      return {
        ...prev,
        participations: [...prev.participations, ...newEntries],
        activeSession: null,
      };
    });
  }, [save]);

  const authenticateWithPin = useCallback(
    async (pin: string): Promise<boolean> => {
      const storedHash = pinHashQuery.data || (await AsyncStorage.getItem(PIN_HASH_KEY));
      if (!storedHash) {
        console.log('No stored PIN hash found');
        return false;
      }
      if (!verifyPin(pin, storedHash)) {
        console.log('PIN verification failed');
        return false;
      }
      currentPinRef.current = pin;
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const decrypted = decrypt(stored, pin);
        if (decrypted) {
          try {
            const parsedData = JSON.parse(decrypted) as AppData;
            setData(parsedData);
            queryClient.setQueryData(['appData'], parsedData);
            
            if (parsedData.activeSession) {
              const schoolClass = parsedData.classes.find((c) => c.id === parsedData.activeSession!.classId);
              const ratedCount = Object.keys(parsedData.activeSession.ratings).length;
              const totalStudents = schoolClass?.students.length || 0;
              showLessonNotification(parsedData.activeSession, schoolClass, ratedCount, totalStudents);
            }
          } catch (parseError) {
            console.error('[AppContext] Failed to parse decrypted data:', parseError);
            return false;
          }
        }
      }
      setIsAuthenticated(true);
      setupNotificationCategories();
      return true;
    },
    [pinHashQuery.data, queryClient]
  );

  const authenticate = useCallback(() => {
    setIsAuthenticated(true);
  }, []);

  const lock = useCallback(() => {
    setIsAuthenticated(false);
  }, []);

  const resetApp = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await AsyncStorage.removeItem(PIN_HASH_KEY);
    await AsyncStorage.removeItem(RECOVERY_ATTEMPTED_KEY);
    await AsyncStorage.removeItem(PRIVACY_ACCEPTED_KEY);
    currentPinRef.current = '';
    setData(defaultData);
    setIsAuthenticated(false);
    setRecoveryAvailable(null);
    setPrivacyAccepted(false);
    queryClient.setQueryData(['appData'], defaultData);
    queryClient.setQueryData(['pinHash'], '');
    queryClient.setQueryData(['privacyAccepted'], false);
  }, [queryClient]);

  const recoverFromBackup = useCallback(
    async (backupId: string, pin: string): Promise<boolean> => {
      try {
        setIsRecovering(true);
        console.log('[AppContext] Attempting recovery from backup:', backupId);
        
        const recoveredData = await restoreBackup(backupId, pin);
        
        if (!recoveredData) {
          console.log('[AppContext] Recovery failed - invalid PIN or corrupt backup');
          setIsRecovering(false);
          return false;
        }

        currentPinRef.current = pin;
        const pinHashValue = hashPin(pin);
        await AsyncStorage.setItem(PIN_HASH_KEY, pinHashValue);
        
        const encrypted = encrypt(JSON.stringify(recoveredData), pin);
        await AsyncStorage.setItem(STORAGE_KEY, encrypted);
        await AsyncStorage.setItem(RECOVERY_ATTEMPTED_KEY, 'true');
        
        setData(recoveredData);
        queryClient.setQueryData(['appData'], recoveredData);
        queryClient.setQueryData(['pinHash'], pinHashValue);
        setRecoveryAvailable(null);
        setIsAuthenticated(true);
        setIsRecovering(false);
        
        console.log('[AppContext] Recovery successful');
        await logBackupAction('restore', 'success', backupId, 'Data recovered from backup');
        return true;
      } catch (error) {
        console.log('[AppContext] Recovery error:', error);
        setIsRecovering(false);
        await logBackupAction('restore', 'failed', backupId, `Recovery failed: ${error}`);
        return false;
      }
    },
    [queryClient]
  );

  const dismissRecovery = useCallback(async () => {
    await AsyncStorage.setItem(RECOVERY_ATTEMPTED_KEY, 'true');
    setRecoveryAvailable(null);
  }, []);

  const acceptPrivacy = useCallback(async () => {
    await AsyncStorage.setItem(PRIVACY_ACCEPTED_KEY, 'true');
    setPrivacyAccepted(true);
    queryClient.setQueryData(['privacyAccepted'], true);
  }, [queryClient]);

  const getCurrentPin = useCallback(() => {
    return currentPinRef.current;
  }, []);

  const addHomeworkEntries = useCallback(
    (classId: string, subject: string, entries: { studentId: string; status: HomeworkStatus }[]) => {
      const date = new Date().toISOString();
      save((prev) => {
        const newEntries: HomeworkEntry[] = entries.map((e) => ({
          id: generateId(),
          studentId: e.studentId,
          classId,
          subject,
          date,
          status: e.status,
        }));
        return { ...prev, homeworkEntries: [...prev.homeworkEntries, ...newEntries] };
      });
    },
    [save]
  );

  const addBehaviorEntry = useCallback(
    (studentId: string, classId: string, type: BehaviorType, note: string) => {
      save((prev) => {
        const entry: BehaviorEntry = {
          id: generateId(),
          studentId,
          classId,
          type,
          note,
          date: new Date().toISOString(),
        };
        return { ...prev, behaviorEntries: [...prev.behaviorEntries, entry] };
      });
    },
    [save]
  );

  const addPresentationGrade = useCallback(
    (studentId: string, classId: string, subject: string, topic: string, criteria: PresentationCriteria, weights: PresentationWeights) => {
      const totalWeight = weights.content + weights.language + weights.media + weights.timing + weights.presence;
      const calculatedGrade = totalWeight > 0
        ? (criteria.content * weights.content + criteria.language * weights.language + criteria.media * weights.media + criteria.timing * weights.timing + criteria.presence * weights.presence) / totalWeight
        : 0;
      save((prev) => {
        const grade: PresentationGrade = {
          id: generateId(),
          studentId,
          classId,
          subject,
          criteria,
          weights,
          calculatedGrade: Math.round(calculatedGrade * 10) / 10,
          date: new Date().toISOString(),
          topic,
        };
        return { ...prev, presentationGrades: [...prev.presentationGrades, grade] };
      });
    },
    [save]
  );

  const addResource = useCallback(
    (classId: string, subject: string, url: string, title: string) => {
      save((prev) => {
        const resource: ResourceLink = {
          id: generateId(),
          classId,
          subject,
          url,
          title,
          createdAt: new Date().toISOString(),
        };
        return { ...prev, resources: [...prev.resources, resource] };
      });
    },
    [save]
  );

  const deleteResource = useCallback(
    (resourceId: string) => {
      save((prev) => ({
        ...prev,
        resources: prev.resources.filter((r) => r.id !== resourceId),
      }));
    },
    [save]
  );

  const incrementCallCount = useCallback(
    (studentId: string, classId: string) => {
      save((prev) => {
        const existing = prev.callCounts.find((c) => c.studentId === studentId && c.classId === classId);
        if (existing) {
          return {
            ...prev,
            callCounts: prev.callCounts.map((c) =>
              c.studentId === studentId && c.classId === classId
                ? { ...c, count: c.count + 1 }
                : c
            ),
          };
        }
        return {
          ...prev,
          callCounts: [...prev.callCounts, { studentId, classId, count: 1 }],
        };
      });
    },
    [save]
  );

  const resetCallCounts = useCallback(
    (classId: string) => {
      save((prev) => ({
        ...prev,
        callCounts: prev.callCounts.filter((c) => c.classId !== classId),
      }));
    },
    [save]
  );

  return {
    data,
    isLoading: dataQuery.isLoading || pinHashQuery.isLoading || privacyQuery.isLoading,
    isAuthenticated,
    storedPinHash: pinHashQuery.data || '',
    recoveryAvailable,
    isRecovering,
    privacyAccepted,
    authenticate,
    authenticateWithPin,
    lock,
    completeOnboarding,
    updateProfile,
    updatePin,
    addClass,
    deleteClass,
    addStudent,
    updateStudent,
    deleteStudent,
    startSession,
    rateStudent,
    endSession,
    resetApp,
    recoverFromBackup,
    dismissRecovery,
    acceptPrivacy,
    getCurrentPin,
    addHomeworkEntries,
    addBehaviorEntry,
    addPresentationGrade,
    addResource,
    deleteResource,
    incrementCallCount,
    resetCallCounts,
  };
});
