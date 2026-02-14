import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight, ChevronLeft, Upload, X, AlertTriangle, Smartphone, Copy, Link, Shield, Wifi, Lock, Database, Globe, FolderSearch, HardDrive, Clock, FileArchive, MapPin, FileUp } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { DelayedOverlay } from '@/components/DelayedLoader';
import { ALL_SUBJECTS } from '@/constants/subjects';
import { useApp } from '@/context/AppContext';
import { useBackup } from '@/context/BackupContext';
import { useP2P } from '@/context/P2PContext';
import { getAllBackups, formatBackupDate, formatBackupSize } from '@/utils/backup';
import type { BackupMetadata, ExternalBackupFile } from '@/types';

type Step = 'privacy' | 'profile' | 'pin' | 'subjects';

export default function OnboardingScreen() {
  const router = useRouter();
  const { completeOnboarding, acceptPrivacy } = useApp();
  const { restoreFromBackup, importBackup, scanExternalBackups, importFromExternal, externalBackups, isScanning, scanComplete } = useBackup();
  const { validateAndConnectFromQR, qrCodeData, cancelQRPairingSession } = useP2P();
  const [step, setStep] = useState<Step>('privacy');
  const [name, setName] = useState<string>('');
  const [school, setSchool] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [pinConfirm, setPinConfirm] = useState<string>('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showBackupSelectModal, setShowBackupSelectModal] = useState<boolean>(false);
  const [availableBackups, setAvailableBackups] = useState<BackupMetadata[]>([]);
  const [importData, setImportData] = useState<string>('');
  const [restorePin, setRestorePin] = useState<string>('');
  const [selectedBackup, setSelectedBackup] = useState<BackupMetadata | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [showSetupOptionsModal, setShowSetupOptionsModal] = useState<boolean>(false);
  const [showTextCodeInput, setShowTextCodeInput] = useState<boolean>(false);
  const [showHostCodeModal, setShowHostCodeModal] = useState<boolean>(false);
  const [textCode, setTextCode] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isImportingFile, setIsImportingFile] = useState<boolean>(false);
  const [isCompleting, setIsCompleting] = useState<boolean>(false);
  
  const [hasScannedOnce, setHasScannedOnce] = useState<boolean>(false);
  const [showBackupDiscoveryModal, setShowBackupDiscoveryModal] = useState<boolean>(false);
  const [discoveredBackups, setDiscoveredBackups] = useState<{
    type: 'external' | 'internal';
    backup: ExternalBackupFile | BackupMetadata;
    name: string;
    date: string;
    size: number;
    location?: string;
  }[]>([]);

  const animateTransition = (next: Step) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      setStep(next);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleNext = async () => {
    if (step === 'privacy') {
      acceptPrivacy();
      animateTransition('profile');
    } else if (step === 'profile') {
      if (!name.trim()) {
        Alert.alert('Fehler', 'Bitte geben Sie Ihren Namen ein.');
        return;
      }
      animateTransition('pin');
    } else if (step === 'pin') {
      if (pin.length < 4) {
        Alert.alert('Fehler', 'Die PIN muss mindestens 4 Zeichen lang sein.');
        return;
      }
      if (pin !== pinConfirm) {
        Alert.alert('Fehler', 'Die PINs stimmen nicht überein.');
        return;
      }
      animateTransition('subjects');
    } else if (step === 'subjects') {
      if (selectedSubjects.length === 0) {
        Alert.alert('Fehler', 'Bitte wählen Sie mindestens ein Fach.');
        return;
      }
      setIsCompleting(true);
      try {
        await completeOnboarding({ name: name.trim(), school: school.trim(), subjects: selectedSubjects }, pin);
        setTimeout(() => {
          router.replace('/');
        }, 100);
      } finally {
        setIsCompleting(false);
      }
    }
  };

  const handleBack = () => {
    if (step === 'profile') animateTransition('privacy');
    else if (step === 'pin') animateTransition('profile');
    else if (step === 'subjects') animateTransition('pin');
  };

  const toggleSubject = (subject: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]
    );
  };

  const handleOpenSetupOptions = () => {
    setShowSetupOptionsModal(true);
  };

  useEffect(() => {
    const runBackupScan = async () => {
      if (hasScannedOnce || scanComplete) return;
      
      console.log('[Onboarding] Starting background backup scan...');
      setHasScannedOnce(true);
      
      const [externalFound, internalBackups] = await Promise.all([
        scanExternalBackups(),
        getAllBackups()
      ]);
      
      const allDiscovered: {
        type: 'external' | 'internal';
        backup: ExternalBackupFile | BackupMetadata;
        name: string;
        date: string;
        size: number;
        location?: string;
      }[] = [];
      
      for (const ext of externalFound.filter(b => b.isValid)) {
        allDiscovered.push({
          type: 'external',
          backup: ext,
          name: ext.fileName,
          date: ext.metadata.createdAt,
          size: ext.size,
          location: 'Externer Speicher',
        });
      }
      
      for (const internal of internalBackups.filter(b => b.isValid)) {
        allDiscovered.push({
          type: 'internal',
          backup: internal,
          name: `Backup ${formatBackupDate(internal.createdAt).split(',')[0]}`,
          date: internal.createdAt,
          size: internal.size,
          location: 'App-Speicher',
        });
      }
      
      allDiscovered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      console.log('[Onboarding] Total backups found:', allDiscovered.length);
      
      if (allDiscovered.length > 0) {
        setDiscoveredBackups(allDiscovered);
        setShowBackupDiscoveryModal(true);
      }
    };
    
    runBackupScan();
  }, [hasScannedOnce, scanComplete, scanExternalBackups]);

  const handleOpenImportModal = async () => {
    setShowSetupOptionsModal(false);
    const backups = await getAllBackups();
    setAvailableBackups(backups.filter(b => b.isValid));
    setShowImportModal(true);
  };

  const handleOpenSyncAsClient = () => {
    setShowSetupOptionsModal(false);
    setTextCode('');
    setShowTextCodeInput(true);
  };

  

  const handleCloseHostModal = () => {
    cancelQRPairingSession();
    setShowHostCodeModal(false);
  };

  const copyHostCode = async () => {
    if (qrCodeData) {
      await Clipboard.setStringAsync(qrCodeData);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Kopiert', 'Code wurde in die Zwischenablage kopiert.');
    }
  };

  const handleConnectWithTextCode = async () => {
    const code = textCode.trim();
    if (!code) {
      Alert.alert('Fehler', 'Bitte geben Sie einen Code ein.');
      return;
    }

    Alert.alert(
      'Daten überschreiben?',
      'Durch die Synchronisierung werden alle lokalen Daten mit den Daten des anderen Geräts überschrieben. Möchten Sie fortfahren?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Fortfahren',
          style: 'destructive',
          onPress: async () => {
            setIsConnecting(true);
            const result = await validateAndConnectFromQR(code);
            setIsConnecting(false);
            
            if (result.success) {
              setShowTextCodeInput(false);
              setTextCode('');
              Alert.alert(
                'Verbindung hergestellt',
                'Die Verbindung wurde erfolgreich hergestellt. Bitte wählen Sie auf dem anderen Gerät, welche Daten verwendet werden sollen.',
                [{ text: 'OK' }]
              );
            } else {
              Alert.alert('Fehler', result.error || 'Ungültiger Code');
            }
          },
        },
      ]
    );
  };

  const handleImportFromClipboard = async () => {
    if (!importData.trim()) {
      Alert.alert('Fehler', 'Bitte fügen Sie Backup-Daten ein.');
      return;
    }
    const result = await importBackup(importData.trim());
    if (result) {
      setImportData('');
      const backups = await getAllBackups();
      setAvailableBackups(backups.filter(b => b.isValid));
      Alert.alert('Erfolg', 'Backup wurde importiert. Wählen Sie es nun zur Wiederherstellung aus.');
    } else {
      Alert.alert('Fehler', 'Ungültiges Backup-Format.');
    }
  };

  const handlePickBackupFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }
      
      const file = result.assets[0];
      console.log('[Onboarding] Selected backup file:', file.name);
      setIsImportingFile(true);
      
      let content: string;
      if (Platform.OS === 'web') {
        const response = await fetch(file.uri);
        content = await response.text();
      } else {
        const { File: FSFile } = await import('expo-file-system');
        const fsFile = new FSFile(file.uri);
        content = await fsFile.text();
      }
      const imported = await importBackup(content);
      setIsImportingFile(false);
      if (imported) {
        setSelectedBackup(imported);
        setRestorePin('');
        setShowBackupSelectModal(true);
      } else {
        Alert.alert('Fehler', 'Ungültiges Backup-Format.');
      }
    } catch (error) {
      setIsImportingFile(false);
      console.error('[Onboarding] File picker error:', error);
      Alert.alert('Fehler', 'Die Datei konnte nicht gelesen werden.');
    }
  };

  const handleSelectBackup = (backup: BackupMetadata) => {
    setSelectedBackup(backup);
    setRestorePin('');
    setShowBackupSelectModal(true);
  };

  const handleSelectExternalBackup = async (external: ExternalBackupFile) => {
    setIsRestoring(true);
    const imported = await importFromExternal(external.uri);
    setIsRestoring(false);
    
    if (imported) {
      const backups = await getAllBackups();
      setAvailableBackups(backups.filter(b => b.isValid));
      setSelectedBackup(imported);
      setRestorePin('');
      setShowBackupSelectModal(true);
    } else {
      Alert.alert('Fehler', 'Die Backup-Datei konnte nicht importiert werden.');
    }
  };

  const handleSelectDiscoveredBackup = async (item: typeof discoveredBackups[0]) => {
    setShowBackupDiscoveryModal(false);
    
    if (item.type === 'external') {
      const ext = item.backup as ExternalBackupFile;
      setIsRestoring(true);
      const imported = await importFromExternal(ext.uri);
      setIsRestoring(false);
      
      if (imported) {
        setSelectedBackup(imported);
        setRestorePin('');
        setShowBackupSelectModal(true);
      } else {
        Alert.alert('Fehler', 'Die Backup-Datei konnte nicht importiert werden.');
      }
    } else {
      const internal = item.backup as BackupMetadata;
      setSelectedBackup(internal);
      setRestorePin('');
      setShowBackupSelectModal(true);
    }
  };

  const handleSkipBackupDiscovery = () => {
    setShowBackupDiscoveryModal(false);
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackup || restorePin.length < 4) {
      Alert.alert('Fehler', 'Bitte geben Sie die PIN des Backups ein.');
      return;
    }

    setIsRestoring(true);
    const result = await restoreFromBackup(selectedBackup.id, restorePin);
    setIsRestoring(false);

    if (result) {
      setShowBackupSelectModal(false);
      setShowImportModal(false);
      Alert.alert(
        'Erfolg',
        'Daten wurden wiederhergestellt. Sie können sich jetzt mit Ihrer PIN anmelden.',
        [{ text: 'OK', onPress: () => router.replace('/lock' as any) }]
      );
    } else {
      Alert.alert('Fehler', 'Wiederherstellung fehlgeschlagen. Überprüfen Sie Ihre PIN.');
    }
  };

  const stepIndex = step === 'privacy' ? 0 : step === 'profile' ? 1 : step === 'pin' ? 2 : 3;
  const totalSteps = 4;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.progressRow}>
            {Array.from({ length: totalSteps }).map((_, i) => (
              <View
                key={i}
                style={[styles.progressBar, i <= stepIndex && styles.progressBarActive]}
              />
            ))}
          </View>
          <Text style={styles.stepLabel}>
            Schritt {stepIndex + 1} von {totalSteps}
          </Text>
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
            {step === 'privacy' && (
              <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.privacyIconContainer}>
                  <Shield size={48} color={Colors.primary} strokeWidth={1.5} />
                </View>
                <Text style={styles.title}>Datenschutz & Sicherheit</Text>
                <Text style={styles.subtitle}>
                  Bevor Sie beginnen, möchten wir Sie über wichtige Aspekte dieser App informieren.
                </Text>

                <View style={styles.privacyCard}>
                  <View style={styles.privacyItem}>
                    <View style={styles.privacyItemIcon}>
                      <Shield size={20} color={Colors.primary} strokeWidth={1.7} />
                    </View>
                    <View style={styles.privacyItemContent}>
                      <Text style={styles.privacyItemTitle}>Anonym & Verschlüsselt</Text>
                      <Text style={styles.privacyItemText}>
                        Diese App sammelt keine persönlichen Daten. Alle Ihre Daten werden lokal auf Ihrem Gerät gespeichert und mit Ihrer PIN verschlüsselt.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.privacyDivider} />

                  <View style={styles.privacyItem}>
                    <View style={styles.privacyItemIcon}>
                      <Globe size={20} color={Colors.primary} strokeWidth={1.7} />
                    </View>
                    <View style={styles.privacyItemContent}>
                      <Text style={styles.privacyItemTitle}>Keine externen Server</Text>
                      <Text style={styles.privacyItemText}>
                        Diese App wurde von einer einzelnen Person entwickelt und kommuniziert mit keinen externen Servern. Ihre Daten verlassen niemals Ihr Gerät.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.privacyDivider} />

                  <View style={styles.privacyItem}>
                    <View style={styles.privacyItemIcon}>
                      <Wifi size={20} color={Colors.primary} strokeWidth={1.7} />
                    </View>
                    <View style={styles.privacyItemContent}>
                      <Text style={styles.privacyItemTitle}>Lokale Synchronisation</Text>
                      <Text style={styles.privacyItemText}>
                        Die Synchronisation zwischen mehreren Geräten ist nur innerhalb desselben Netzwerks möglich und ist vollständig verschlüsselt.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.privacyDivider} />

                  <View style={styles.privacyItem}>
                    <View style={styles.privacyItemIcon}>
                      <Database size={20} color={Colors.primary} strokeWidth={1.7} />
                    </View>
                    <View style={styles.privacyItemContent}>
                      <Text style={styles.privacyItemTitle}>Offline-Nutzung</Text>
                      <Text style={styles.privacyItemText}>
                        Die App funktioniert vollständig offline. Eine Internetverbindung ist nicht erforderlich.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.privacyDivider} />

                  <View style={styles.privacyItem}>
                    <View style={styles.privacyItemIcon}>
                      <Lock size={20} color={Colors.primary} strokeWidth={1.7} />
                    </View>
                    <View style={styles.privacyItemContent}>
                      <Text style={styles.privacyItemTitle}>Sichere Backups</Text>
                      <Text style={styles.privacyItemText}>
                        Alle Backups werden verschlüsselt und können nur mit dieser App und Ihrer PIN gelesen werden.
                      </Text>
                    </View>
                  </View>
                </View>
              </ScrollView>
            )}

            {step === 'profile' && (
              <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Text style={styles.title}>Willkommen</Text>
                <Text style={styles.subtitle}>Richten Sie Ihr Profil ein.</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Name</Text>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="Ihr vollständiger Name"
                    placeholderTextColor={Colors.textLight}
                    testID="input-name"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Schule</Text>
                    <Text style={styles.optional}>Optional</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    value={school}
                    onChangeText={setSchool}
                    placeholder="Name der Schule"
                    placeholderTextColor={Colors.textLight}
                    testID="input-school"
                  />
                </View>
              </ScrollView>
            )}

            {step === 'pin' && (
              <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <Text style={styles.title}>Sicherheit</Text>
                <Text style={styles.subtitle}>
                  Schützen Sie Ihre Daten mit einer PIN.
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>PIN (mind. 4 Zeichen)</Text>
                  <TextInput
                    style={styles.input}
                    value={pin}
                    onChangeText={setPin}
                    placeholder="PIN eingeben"
                    placeholderTextColor={Colors.textLight}
                    secureTextEntry
                    keyboardType="number-pad"
                    maxLength={6}
                    testID="input-pin"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>PIN bestätigen</Text>
                  <TextInput
                    style={styles.input}
                    value={pinConfirm}
                    onChangeText={setPinConfirm}
                    placeholder="PIN erneut eingeben"
                    placeholderTextColor={Colors.textLight}
                    secureTextEntry
                    keyboardType="number-pad"
                    maxLength={6}
                    testID="input-pin-confirm"
                  />
                </View>
              </ScrollView>
            )}

            {step === 'subjects' && (
              <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
                <Text style={styles.title}>Ihre Fächer</Text>
                <Text style={styles.subtitle}>
                  Wählen Sie die Fächer, die Sie unterrichten.
                </Text>

                <View style={styles.subjectGrid}>
                  {ALL_SUBJECTS.map((subject) => {
                    const selected = selectedSubjects.includes(subject);
                    return (
                      <TouchableOpacity
                        key={subject}
                        style={[styles.subjectChip, selected && styles.subjectChipActive]}
                        onPress={() => toggleSubject(subject)}
                        activeOpacity={0.55}
                      >
                        <Text
                          style={[styles.subjectText, selected && styles.subjectTextActive]}
                        >
                          {subject}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </Animated.View>
        </KeyboardAvoidingView>

        <View style={styles.footer}>
          {step === 'privacy' ? (
            <View style={styles.backBtn} />
          ) : step === 'profile' ? (
            <TouchableOpacity style={styles.setupOptionsBtn} onPress={handleOpenSetupOptions} activeOpacity={0.55}>
              <Smartphone size={15} color={Colors.textSecondary} strokeWidth={1.8} />
              <Text style={styles.setupOptionsBtnText}>Bereits Eingerichtet</Text>
            </TouchableOpacity>
          ) : step === 'pin' ? (
            <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.55}>
              <ChevronLeft size={17} color={Colors.textSecondary} strokeWidth={1.8} />
              <Text style={styles.backText}>Zurück</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.55}>
              <ChevronLeft size={17} color={Colors.textSecondary} strokeWidth={1.8} />
              <Text style={styles.backText}>Zurück</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.7}>
            <Text style={styles.nextText}>
              {step === 'privacy' ? 'Verstanden' : step === 'subjects' ? 'Fertig' : 'Weiter'}
            </Text>
            <ChevronRight size={17} color={Colors.white} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <Modal visible={showImportModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '80%' as unknown as number }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Backup wiederherstellen</Text>
                <TouchableOpacity onPress={() => setShowImportModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.importModalScroll} showsVerticalScrollIndicator={false}>
                {(isScanning || externalBackups.length > 0) && (
                  <>
                    <View style={styles.sectionHeaderRow}>
                      <FolderSearch size={16} color={Colors.primary} strokeWidth={1.8} />
                      <Text style={styles.sectionLabel}>Gefundene Backup-Dateien</Text>
                      {isScanning && <ActivityIndicator size="small" color={Colors.primary} style={styles.scanningIndicator} />}
                    </View>
                    {isScanning && externalBackups.length === 0 && (
                      <View style={styles.scanningBox}>
                        <Text style={styles.scanningText}>Durchsuche Speicher nach Backups...</Text>
                      </View>
                    )}
                    {externalBackups.filter(b => b.isValid).map((external) => (
                      <TouchableOpacity
                        key={external.uri}
                        style={styles.externalBackupItem}
                        onPress={() => handleSelectExternalBackup(external)}
                        disabled={isRestoring}
                      >
                        <View style={styles.externalBackupIcon}>
                          <HardDrive size={18} color={Colors.primary} strokeWidth={1.7} />
                        </View>
                        <View style={styles.externalBackupInfo}>
                          <Text style={styles.externalBackupName} numberOfLines={1}>{external.fileName}</Text>
                          <Text style={styles.externalBackupMeta}>
                            {formatBackupDate(external.metadata.createdAt)} • {formatBackupSize(external.size)}
                          </Text>
                        </View>
                        <ChevronRight size={16} color={Colors.textLight} strokeWidth={1.7} />
                      </TouchableOpacity>
                    ))}
                    {!isScanning && externalBackups.length === 0 && (
                      <View style={styles.noExternalBox}>
                        <Text style={styles.noExternalText}>Keine Backup-Dateien im Speicher gefunden</Text>
                      </View>
                    )}
                  </>
                )}

                {availableBackups.length > 0 && (
                  <>
                    <Text style={[styles.sectionLabel, styles.sectionLabelMargin]}>App-interne Backups</Text>
                    {availableBackups.map((backup) => (
                      <TouchableOpacity
                        key={backup.id}
                        style={styles.backupItem}
                        onPress={() => handleSelectBackup(backup)}
                      >
                        <Text style={styles.backupDate}>{formatBackupDate(backup.createdAt)}</Text>
                        <ChevronRight size={16} color={Colors.textLight} strokeWidth={1.7} />
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                <Text style={[styles.sectionLabel, styles.sectionLabelMargin]}>Datei auswählen</Text>
                <TouchableOpacity 
                  style={[styles.filePickerBtn, isImportingFile && styles.filePickerBtnDisabled]} 
                  onPress={handlePickBackupFile} 
                  activeOpacity={0.7}
                  disabled={isImportingFile}
                >
                  {isImportingFile ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <>
                      <FileUp size={20} color={Colors.primary} strokeWidth={1.7} />
                      <Text style={styles.filePickerBtnText}>Backup-Datei auswählen</Text>
                    </>
                  )}
                </TouchableOpacity>

                <Text style={[styles.sectionLabel, styles.sectionLabelMargin]}>Oder aus Zwischenablage</Text>
                <TextInput
                  style={[styles.input, styles.importInput]}
                  value={importData}
                  onChangeText={setImportData}
                  placeholder="Backup-Daten einfügen..."
                  placeholderTextColor={Colors.textLight}
                  multiline
                  numberOfLines={3}
                />
                <TouchableOpacity style={styles.importActionBtn} onPress={handleImportFromClipboard} activeOpacity={0.7}>
                  <Text style={styles.importActionText}>Importieren</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal visible={showBackupSelectModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Backup wiederherstellen</Text>
                <TouchableOpacity onPress={() => setShowBackupSelectModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
                </TouchableOpacity>
              </View>
              {selectedBackup && (
                <>
                  <View style={styles.selectedBackupCard}>
                    <View style={styles.selectedBackupIcon}>
                      <HardDrive size={22} color={Colors.primary} strokeWidth={1.7} />
                    </View>
                    <View style={styles.selectedBackupInfo}>
                      <Text style={styles.selectedBackupTitle}>Backup ausgewählt</Text>
                      <Text style={styles.selectedBackupDate}>{formatBackupDate(selectedBackup.createdAt)}</Text>
                      <Text style={styles.selectedBackupSize}>{formatBackupSize(selectedBackup.size)}</Text>
                    </View>
                  </View>
                  <Text style={styles.restoreHint}>
                    Geben Sie die PIN ein, mit der das Backup erstellt wurde:
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={restorePin}
                    onChangeText={setRestorePin}
                    placeholder="PIN eingeben"
                    placeholderTextColor={Colors.textLight}
                    secureTextEntry
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <TouchableOpacity
                    style={[styles.restoreBtn, isRestoring && styles.restoreBtnDisabled]}
                    onPress={handleRestoreBackup}
                    activeOpacity={0.7}
                    disabled={isRestoring}
                  >
                    {isRestoring ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <Text style={styles.restoreBtnText}>Wiederherstellen</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>

        <Modal visible={showSetupOptionsModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Bereits Eingerichtet</Text>
                <TouchableOpacity onPress={() => setShowSetupOptionsModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
                </TouchableOpacity>
              </View>

              <Text style={styles.setupOptionsDescription}>
                Wählen Sie, wie Sie Ihre vorhandenen Daten importieren möchten.
              </Text>

              <View style={styles.warningBox}>
                <AlertTriangle size={18} color={Colors.warning} strokeWidth={1.8} />
                <Text style={styles.warningText}>
                  Hinweis: Alle Optionen überschreiben lokale Daten. Stellen Sie sicher, dass Sie dies möchten.
                </Text>
              </View>

              <TouchableOpacity style={styles.setupOptionCard} onPress={handleOpenImportModal} activeOpacity={0.7}>
                <View style={styles.setupOptionIcon}>
                  <Upload size={24} color={Colors.primary} strokeWidth={1.8} />
                </View>
                <View style={styles.setupOptionContent}>
                  <Text style={styles.setupOptionTitle}>Backup importieren</Text>
                  <Text style={styles.setupOptionHint}>
                    Stellen Sie Daten aus einer verschlüsselten Backup-Datei wieder her.
                  </Text>
                </View>
                <ChevronRight size={18} color={Colors.textLight} strokeWidth={1.7} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.setupOptionCard} onPress={handleOpenSyncAsClient} activeOpacity={0.7}>
                <View style={styles.setupOptionIcon}>
                  <Link size={24} color={Colors.primary} strokeWidth={1.8} />
                </View>
                <View style={styles.setupOptionContent}>
                  <Text style={styles.setupOptionTitle}>Mit Host verbinden</Text>
                  <Text style={styles.setupOptionHint}>
                    Geben Sie den Code vom Host-Gerät ein, um die Daten zu übertragen.
                  </Text>
                </View>
                <ChevronRight size={18} color={Colors.textLight} strokeWidth={1.7} />
              </TouchableOpacity>

              
            </View>
          </View>
        </Modal>

        <Modal visible={showHostCodeModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Host-Code</Text>
                <TouchableOpacity onPress={handleCloseHostModal} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
                </TouchableOpacity>
              </View>

              <Text style={styles.restoreHint}>
                Teilen Sie diesen Code mit dem anderen Gerät. Das andere Gerät muss diesen Code eingeben, um sich zu verbinden.
              </Text>

              <View style={styles.hostCodeBox}>
                <Text style={styles.hostCodeText} selectable>{qrCodeData || 'Generiere...'}</Text>
              </View>

              <TouchableOpacity style={styles.copyCodeBtn} onPress={copyHostCode} activeOpacity={0.7}>
                <Copy size={16} color={Colors.primary} strokeWidth={1.7} />
                <Text style={styles.copyCodeBtnText}>Code kopieren</Text>
              </TouchableOpacity>

              <View style={styles.hostCodeInstructions}>
                <Text style={styles.hostCodeInstructionsTitle}>Anleitung für das andere Gerät:</Text>
                <Text style={styles.hostCodeInstructionsText}>
                  1. Öffnen Sie die App{"\n"}
                  2. Tippen Sie auf &quot;Bereits Eingerichtet&quot;{"\n"}
                  3. Wählen Sie &quot;Mit Host verbinden&quot;{"\n"}
                  4. Geben Sie den obigen Code ein
                </Text>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showBackupDiscoveryModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, styles.discoveryModalContent]}>
              <View style={styles.discoveryHeader}>
                <View style={styles.discoveryIconContainer}>
                  <FileArchive size={32} color={Colors.primary} strokeWidth={1.5} />
                </View>
                <Text style={styles.discoveryTitle}>Backups gefunden</Text>
                <Text style={styles.discoverySubtitle}>
                  Es wurden {discoveredBackups.length} Backup{discoveredBackups.length !== 1 ? 's' : ''} auf diesem Gerät gefunden. Möchten Sie Ihre Daten wiederherstellen?
                </Text>
              </View>

              <View style={styles.discoveryInfoBox}>
                <Shield size={16} color={Colors.primary} strokeWidth={1.7} />
                <Text style={styles.discoveryInfoText}>
                  Backups enthalten Ihre Klassen, Unterrichtsstunden, Statistiken und Einstellungen. Sie sind verschlüsselt und benötigen Ihre PIN zur Wiederherstellung.
                </Text>
              </View>

              <ScrollView style={styles.discoveryList} showsVerticalScrollIndicator={false}>
                {discoveredBackups.map((item, index) => (
                  <TouchableOpacity
                    key={`${item.type}-${index}`}
                    style={styles.discoveryItem}
                    onPress={() => handleSelectDiscoveredBackup(item)}
                    activeOpacity={0.7}
                    disabled={isRestoring}
                  >
                    <View style={styles.discoveryItemIcon}>
                      <HardDrive size={20} color={Colors.primary} strokeWidth={1.7} />
                    </View>
                    <View style={styles.discoveryItemContent}>
                      <Text style={styles.discoveryItemName} numberOfLines={1}>{item.name}</Text>
                      <View style={styles.discoveryItemMeta}>
                        <View style={styles.discoveryMetaRow}>
                          <Clock size={12} color={Colors.textLight} strokeWidth={1.7} />
                          <Text style={styles.discoveryMetaText}>{formatBackupDate(item.date)}</Text>
                        </View>
                        <View style={styles.discoveryMetaRow}>
                          <Database size={12} color={Colors.textLight} strokeWidth={1.7} />
                          <Text style={styles.discoveryMetaText}>{formatBackupSize(item.size)}</Text>
                        </View>
                        {item.location && (
                          <View style={styles.discoveryMetaRow}>
                            <MapPin size={12} color={Colors.textLight} strokeWidth={1.7} />
                            <Text style={styles.discoveryMetaText}>{item.location}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <ChevronRight size={18} color={Colors.textLight} strokeWidth={1.7} />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.discoveryActions}>
                <TouchableOpacity
                  style={styles.skipButton}
                  onPress={handleSkipBackupDiscovery}
                  activeOpacity={0.7}
                >
                  <Text style={styles.skipButtonText}>Später</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={showTextCodeInput} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Code eingeben</Text>
                <TouchableOpacity onPress={() => setShowTextCodeInput(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
                </TouchableOpacity>
              </View>

              <Text style={styles.restoreHint}>
                Geben Sie den Verbindungscode ein, der auf dem Host-Gerät angezeigt wird.
              </Text>

              <View style={styles.textCodeInstructions}>
                <Text style={styles.textCodeInstructionsText}>
                  1. Öffnen Sie die App auf dem anderen Gerät{"\n"}
                  2. Gehen Sie zu Profil → Synchronisation{"\n"}
                  3. Tippen Sie auf &quot;Neues Gerät koppeln&quot;{"\n"}
                  4. Kopieren Sie den angezeigten Code
                </Text>
              </View>

              <TextInput
                style={[styles.input, styles.textCodeInput]}
                value={textCode}
                onChangeText={setTextCode}
                placeholder="Verbindungscode einfügen..."
                placeholderTextColor={Colors.textLight}
                multiline
                numberOfLines={4}
                autoCapitalize="none"
                autoCorrect={false}
                blurOnSubmit
                returnKeyType="go"
                onSubmitEditing={handleConnectWithTextCode}
              />

              <TouchableOpacity
                style={[styles.restoreBtn, isConnecting && styles.restoreBtnDisabled]}
                onPress={handleConnectWithTextCode}
                activeOpacity={0.7}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.restoreBtnText}>Verbinden</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>

      <DelayedOverlay visible={isCompleting} message="Profil wird erstellt..." />
      <DelayedOverlay visible={isRestoring && !showBackupSelectModal} message="Backup wird importiert..." />
      <DelayedOverlay visible={isConnecting && !showTextCodeInput} message="Verbindung wird hergestellt..." />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  progressBar: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.divider,
  },
  progressBarActive: {
    backgroundColor: Colors.primary,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 36,
  },
  inputGroup: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textLight,
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  optional: {
    fontSize: 12,
    color: Colors.textLight,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  subjectChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: Colors.inputBg,
  },
  subjectChipActive: {
    backgroundColor: Colors.primary,
  },
  subjectText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  subjectTextActive: {
    color: Colors.white,
  },
  privacyIconContainer: {
    alignItems: 'center' as const,
    marginBottom: 24,
  },
  privacyCard: {
    backgroundColor: Colors.inputBg,
    borderRadius: 16,
    padding: 4,
  },
  privacyItem: {
    flexDirection: 'row' as const,
    padding: 16,
    gap: 14,
  },
  privacyItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  privacyItemContent: {
    flex: 1,
  },
  privacyItemTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  privacyItemText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  privacyDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginHorizontal: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 0.5,
    borderTopColor: Colors.divider,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  backText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  nextText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  setupOptionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  setupOptionsBtnText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  setupOptionsDescription: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 21,
    marginBottom: 16,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.warningBg || '#FFF8E6',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: Colors.warning || '#C17900',
    lineHeight: 18,
  },
  setupOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    padding: 16,
    borderRadius: 14,
    marginBottom: 12,
    gap: 14,
  },
  setupOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupOptionContent: {
    flex: 1,
  },
  setupOptionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  setupOptionHint: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  textCodeInput: {
    height: 100,
    textAlignVertical: 'top' as const,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
  },
  textCodeInstructions: {
    backgroundColor: Colors.inputBg,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  textCodeInstructionsText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  hostCodeBox: {
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center' as const,
  },
  hostCodeText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: Colors.text,
    textAlign: 'center' as const,
    lineHeight: 18,
  },
  copyCodeBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  copyCodeBtnText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  hostCodeInstructions: {
    backgroundColor: Colors.inputBg,
    padding: 14,
    borderRadius: 12,
  },
  hostCodeInstructionsTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  hostCodeInstructionsText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
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
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textLight,
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 8,
  },
  backupList: {
    maxHeight: 150,
    marginBottom: 16,
  },
  importModalScroll: {
    maxHeight: 450,
  },
  sectionHeaderRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 10,
    marginTop: 4,
  },
  scanningIndicator: {
    marginLeft: 'auto' as const,
  },
  scanningBox: {
    backgroundColor: Colors.inputBg,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    alignItems: 'center' as const,
  },
  scanningText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  noExternalBox: {
    backgroundColor: Colors.inputBg,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  noExternalText: {
    fontSize: 13,
    color: Colors.textLight,
    textAlign: 'center' as const,
  },
  externalBackupItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: Colors.primaryLight,
    borderRadius: 10,
    marginBottom: 8,
    gap: 12,
  },
  externalBackupIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.white,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  externalBackupInfo: {
    flex: 1,
  },
  externalBackupName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  externalBackupMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  sectionLabelMargin: {
    marginTop: 16,
  },
  backupItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: Colors.inputBg,
    borderRadius: 10,
    marginBottom: 8,
  },
  backupDate: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  importInput: {
    height: 80,
    textAlignVertical: 'top' as const,
  },
  importActionBtn: {
    backgroundColor: Colors.inputBg,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  importActionText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  filePickerBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  filePickerBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  filePickerBtnDisabled: {
    opacity: 0.6,
  },
  selectedBackupCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.positiveLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  selectedBackupIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.white,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  selectedBackupInfo: {
    flex: 1,
  },
  selectedBackupTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.positive,
    marginBottom: 2,
  },
  selectedBackupDate: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  selectedBackupSize: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  restoreHint: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  restoreBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  restoreBtnDisabled: {
    opacity: 0.7,
  },
  restoreBtnText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  discoveryModalContent: {
    maxHeight: '85%' as unknown as number,
  },
  discoveryHeader: {
    alignItems: 'center' as const,
    marginBottom: 20,
  },
  discoveryIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
  },
  discoveryTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  discoverySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  discoveryInfoBox: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    backgroundColor: Colors.primaryLight,
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  discoveryInfoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.primary,
    lineHeight: 18,
  },
  discoveryList: {
    maxHeight: 280,
    marginBottom: 16,
  },
  discoveryItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 14,
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    marginBottom: 10,
    gap: 12,
  },
  discoveryItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.white,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  discoveryItemContent: {
    flex: 1,
  },
  discoveryItemName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 6,
  },
  discoveryItemMeta: {
    gap: 4,
  },
  discoveryMetaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  discoveryMetaText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  discoveryActions: {
    alignItems: 'center' as const,
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  skipButtonText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
});
