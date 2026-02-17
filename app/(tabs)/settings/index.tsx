import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { User, School, BookOpen, Lock, ChevronRight, ChevronDown, X, LogOut, Trash2, Save, RotateCcw, Clock, HardDrive, Download, Upload, FileSpreadsheet, FileText, File, Check, Calendar, Eye, Shield, Wifi, Smartphone, Link, Unlink, RefreshCw, Radio, Copy, AlertCircle, Database, ArrowRight, ArrowLeft, Info, FileUp, HelpCircle } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Colors from '@/constants/colors';
import { DelayedInlineBanner, DelayedOverlay } from '@/components/DelayedLoader';
import { SettingsScreenSkeleton } from '@/components/SkeletonLoader';
import { ALL_SUBJECTS } from '@/constants/subjects';
import { useApp } from '@/context/AppContext';
import { useBackup } from '@/context/BackupContext';
import { useP2P } from '@/context/P2PContext';

import { formatBackupDate, formatBackupSize } from '@/utils/backup';
import type { BackupFrequency, BackupMetadata, ExportFormat, ExportField, ExportOptions, ExportableStudentStats, P2PPairedDevice } from '@/types';
import { getDefaultExportFields, generateStatisticsData, exportToFile } from '@/utils/export';


export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { data, updateProfile, updatePin, lock, resetApp, getCurrentPin } = useApp();

  const {
    settings: p2pSettings,
    syncState,
    
    pendingPairRequest,
    
    acceptPairRequest,
    rejectPairRequest,
    requestSync,
    disconnect,
    unpairDevice,
    updateSettings: updateP2PSettings,
    setCurrentAppData,
    initiateFirstSync,
    makeFirstSyncChoice,
    cancelFirstSync,
    getDataStats,
    generateQRPairingSession,
    validateAndConnectFromQR,
    cancelQRPairingSession,
    qrCodeData,
  } = useP2P();
  const {
    settings: backupSettings,
    backups,
    lastBackupDate,
    isBackingUp,
    isRestoring,
    performManualBackup,
    restoreFromBackup,
    removeBackup,
    updateSettings,
    exportBackup,
    importBackup,
    setGetPinFunction,
  } = useBackup();
  const [showNameModal, setShowNameModal] = useState<boolean>(false);
  const [showSchoolModal, setShowSchoolModal] = useState<boolean>(false);
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [showSubjectsModal, setShowSubjectsModal] = useState<boolean>(false);
  const [showBackupSettingsModal, setShowBackupSettingsModal] = useState<boolean>(false);
  const [showBackupListModal, setShowBackupListModal] = useState<boolean>(false);
  const [showRestoreModal, setShowRestoreModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [editValue, setEditValue] = useState<string>('');
  const [newPin, setNewPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [tempSubjects, setTempSubjects] = useState<string[]>([]);
  const [tempFrequency, setTempFrequency] = useState<BackupFrequency>('weekly');
  const [tempMaxVersions, setTempMaxVersions] = useState<number>(5);
  const [tempAutoBackup, setTempAutoBackup] = useState<boolean>(true);
  const [selectedBackup, setSelectedBackup] = useState<BackupMetadata | null>(null);
  const [restorePin, setRestorePin] = useState<string>('');
  const [importData, setImportData] = useState<string>('');
  const [pendingImportBackup, setPendingImportBackup] = useState<BackupMetadata | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx');
  const [exportFields, setExportFields] = useState<ExportField[]>(getDefaultExportFields());
  const [exportDateStart, setExportDateStart] = useState<string>('');
  const [exportDateEnd, setExportDateEnd] = useState<string>('');
  const [exportSubjectFilter, setExportSubjectFilter] = useState<string | null>(null);
  const [exportClassFilter, setExportClassFilter] = useState<string | null>(null);
  const [exportEncrypted, setExportEncrypted] = useState<boolean>(false);
  const [exportPassword, setExportPassword] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [showP2PModal, setShowP2PModal] = useState<boolean>(false);
  const [showPairModal, setShowPairModal] = useState<boolean>(false);
  const [showConnectModal, setShowConnectModal] = useState<boolean>(false);
  const [showPairedDevicesModal, setShowPairedDevicesModal] = useState<boolean>(false);
  const [inputPairingCode, setInputPairingCode] = useState<string>('');
  const [showFirstSyncModal, setShowFirstSyncModal] = useState<boolean>(false);
  const [clientCode, setClientCode] = useState<string>('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    profile: true,
    security: false,
    export: false,
    sync: false,
    backup: false,
  });

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const handleSaveName = () => {
    if (!editValue.trim()) {
      Alert.alert('Fehler', 'Name darf nicht leer sein.');
      return;
    }
    updateProfile({ name: editValue.trim() });
    setShowNameModal(false);
  };

  const handleSaveSchool = () => {
    updateProfile({ school: editValue.trim() });
    setShowSchoolModal(false);
  };

  const handleSavePin = () => {
    if (newPin.length < 4) {
      Alert.alert('Fehler', 'Die PIN muss mindestens 4 Zeichen lang sein.');
      return;
    }
    if (newPin !== confirmPin) {
      Alert.alert('Fehler', 'Die PINs stimmen nicht überein.');
      return;
    }
    updatePin(newPin);
    setShowPinModal(false);
    setNewPin('');
    setConfirmPin('');
    Alert.alert('Erfolg', 'PIN wurde geändert.');
  };

  const handleSaveSubjects = () => {
    if (tempSubjects.length === 0) {
      Alert.alert('Fehler', 'Wählen Sie mindestens ein Fach.');
      return;
    }
    updateProfile({ subjects: tempSubjects });
    setShowSubjectsModal(false);
  };

  const handleManualBackup = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const pin = getCurrentPin();
    if (!pin) {
      Alert.alert('Fehler', 'PIN nicht verfügbar. Bitte sperren und entsperren Sie die App erneut.');
      return;
    }
    
    console.log('[Settings] Starting manual backup with PIN available');
    const result = await performManualBackup(data);
    if (result) {
      Alert.alert('Erfolg', 'Backup wurde erfolgreich erstellt.');
    } else {
      Alert.alert('Fehler', 'Backup konnte nicht erstellt werden.');
    }
  };

  const handleOpenBackupSettings = () => {
    setTempFrequency(backupSettings.frequency);
    setTempMaxVersions(backupSettings.maxVersions);
    setTempAutoBackup(backupSettings.autoBackupEnabled);
    setShowBackupSettingsModal(true);
  };

  const handleSaveBackupSettings = async () => {
    await updateSettings({
      frequency: tempFrequency,
      maxVersions: tempMaxVersions,
      autoBackupEnabled: tempAutoBackup,
    });
    setShowBackupSettingsModal(false);
    Alert.alert('Erfolg', 'Backup-Einstellungen gespeichert.');
  };

  const handleSelectBackupForRestore = (backup: BackupMetadata) => {
    if (!backup.isValid) {
      Alert.alert('Fehler', 'Dieses Backup ist beschädigt und kann nicht wiederhergestellt werden.');
      return;
    }
    setSelectedBackup(backup);
    setRestorePin('');
    setShowBackupListModal(false);
    setShowRestoreModal(true);
  };

  const handleRestore = async () => {
    if (!selectedBackup || restorePin.length < 4) {
      Alert.alert('Fehler', 'Bitte geben Sie Ihre PIN ein.');
      return;
    }

    Alert.alert(
      'Daten wiederherstellen',
      'Ihre aktuellen Daten werden überschrieben. Fortfahren?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Wiederherstellen',
          style: 'destructive',
          onPress: async () => {
            const result = await restoreFromBackup(selectedBackup.id, restorePin);
            if (result) {
              setShowRestoreModal(false);
              Alert.alert('Erfolg', 'Daten wurden wiederhergestellt. Bitte starten Sie die App neu.');
            } else {
              Alert.alert('Fehler', 'Wiederherstellung fehlgeschlagen. Überprüfen Sie Ihre PIN.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteBackup = (backup: BackupMetadata) => {
    Alert.alert(
      'Backup löschen',
      `Möchten Sie das Backup vom ${formatBackupDate(backup.createdAt)} löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: () => removeBackup(backup.id),
        },
      ]
    );
  };

  const handleExportBackup = async (backup: BackupMetadata) => {
    const exported = await exportBackup(backup.id);
    if (exported) {
      await Clipboard.setStringAsync(exported);
      Alert.alert('Exportiert', 'Backup wurde in die Zwischenablage kopiert.');
    } else {
      Alert.alert('Fehler', 'Export fehlgeschlagen.');
    }
  };

  const handleImportBackup = async () => {
    if (!importData.trim()) {
      Alert.alert('Fehler', 'Bitte fügen Sie Backup-Daten ein.');
      return;
    }
    setIsImporting(true);
    const result = await importBackup(importData.trim());
    setIsImporting(false);
    if (result) {
      setPendingImportBackup(result);
      setImportData('');
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
      console.log('[Settings] Selected backup file:', file.name);
      setIsImporting(true);
      
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
      setIsImporting(false);
      if (imported) {
        setPendingImportBackup(imported);
      } else {
        Alert.alert('Fehler', 'Ungültiges Backup-Format.');
      }
    } catch (error) {
      setIsImporting(false);
      console.error('[Settings] File picker error:', error);
      Alert.alert('Fehler', 'Die Datei konnte nicht gelesen werden.');
    }
  };

  const handleRestoreImportedBackup = async () => {
    if (!pendingImportBackup || restorePin.length < 4) {
      Alert.alert('Fehler', 'Bitte geben Sie die PIN des Backups ein.');
      return;
    }

    Alert.alert(
      'Daten wiederherstellen',
      'Ihre aktuellen Daten werden überschrieben. Fortfahren?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Wiederherstellen',
          style: 'destructive',
          onPress: async () => {
            const result = await restoreFromBackup(pendingImportBackup.id, restorePin);
            if (result) {
              setShowImportModal(false);
              setPendingImportBackup(null);
              setRestorePin('');
              Alert.alert('Erfolg', 'Daten wurden wiederhergestellt. Bitte starten Sie die App neu.');
            } else {
              Alert.alert('Fehler', 'Wiederherstellung fehlgeschlagen. Überprüfen Sie Ihre PIN.');
            }
          },
        },
      ]
    );
  };

  const handleCancelImportedBackup = () => {
    setPendingImportBackup(null);
    setRestorePin('');
  };

  const exportOptions = useMemo((): ExportOptions => ({
    format: exportFormat,
    fields: exportFields,
    dateRange: {
      startDate: exportDateStart || null,
      endDate: exportDateEnd || null,
    },
    subjectFilter: exportSubjectFilter,
    classFilter: exportClassFilter,
    encrypted: exportEncrypted,
    password: exportPassword,
  }), [exportFormat, exportFields, exportDateStart, exportDateEnd, exportSubjectFilter, exportClassFilter, exportEncrypted, exportPassword]);

  const previewData = useMemo((): ExportableStudentStats[] => {
    return generateStatisticsData(data, exportOptions);
  }, [data, exportOptions]);

  const handleOpenExportModal = () => {
    setExportFields(getDefaultExportFields());
    setExportFormat('xlsx');
    setExportDateStart('');
    setExportDateEnd('');
    setExportSubjectFilter(null);
    setExportClassFilter(null);
    setExportEncrypted(false);
    setExportPassword('');
    setShowExportModal(true);
  };

  const handleToggleField = (key: string) => {
    setExportFields(prev => prev.map(f => 
      f.key === key ? { ...f, enabled: !f.enabled } : f
    ));
  };

  const handleExport = async () => {
    if (exportEncrypted && exportPassword.length < 4) {
      Alert.alert('Fehler', 'Das Passwort muss mindestens 4 Zeichen lang sein.');
      return;
    }

    const enabledFields = exportFields.filter(f => f.enabled);
    if (enabledFields.length === 0) {
      Alert.alert('Fehler', 'Wählen Sie mindestens ein Feld zum Exportieren.');
      return;
    }

    if (previewData.length === 0) {
      Alert.alert('Fehler', 'Keine Daten zum Exportieren vorhanden.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsExporting(true);

    try {
      const result = await exportToFile(previewData, exportOptions);
      
      if (result.success) {
        setShowExportModal(false);
        Alert.alert(
          'Export erfolgreich',
          `Die Datei wurde erstellt.${result.filePath ? `\n\nDatei: ${result.filePath.split('/').pop()}` : ''}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Fehler', result.error || 'Export fehlgeschlagen.');
      }
    } catch (error) {
      console.error('[Settings] Export error:', error);
      Alert.alert('Fehler', 'Export fehlgeschlagen.');
    } finally {
      setIsExporting(false);
    }
  };

  const formatLabels: Record<ExportFormat, string> = {
    csv: 'CSV',
    xlsx: 'Excel (.xlsx)',
    pdf: 'PDF',
  };

  React.useEffect(() => {
    setCurrentAppData(data);
  }, [data, setCurrentAppData]);

  React.useEffect(() => {
    if (getCurrentPin && setGetPinFunction) {
      setGetPinFunction(getCurrentPin);
    }
  }, [getCurrentPin, setGetPinFunction]);

  React.useEffect(() => {
    if (syncState.firstSync.isFirstSync && syncState.firstSync.awaitingChoice) {
      setShowFirstSyncModal(true);
    }
  }, [syncState.firstSync.isFirstSync, syncState.firstSync.awaitingChoice]);

  const handleFirstSyncChoice = async (choice: 'local' | 'remote') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await makeFirstSyncChoice(choice);
    setShowFirstSyncModal(false);
  };

  const handleCancelFirstSync = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cancelFirstSync();
    setShowFirstSyncModal(false);
  };

  const handleInitiateFirstSync = async (deviceId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const success = await initiateFirstSync(deviceId);
    if (success) {
      setShowFirstSyncModal(true);
    }
  };

  const localDataStats = React.useMemo(() => getDataStats(), [getDataStats]);

  const handleStartHosting = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const session = await generateQRPairingSession();
    if (session) {
      setShowPairModal(true);
    }
  };

  const handleStopHosting = () => {
    cancelQRPairingSession();
    setShowPairModal(false);
  };

  const handleConnectWithCode = async () => {
    const code = clientCode.trim();
    if (!code) {
      Alert.alert('Fehler', 'Bitte geben Sie den Host-Code ein.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const connectResult = await validateAndConnectFromQR(code);
    if (connectResult.success) {
      setShowConnectModal(false);
      setClientCode('');
      Alert.alert('Verbunden', 'Verbindung wurde erfolgreich hergestellt.');
    } else {
      Alert.alert('Fehler', connectResult.error || 'Verbindung fehlgeschlagen');
    }
  };

  

  const handleAcceptPair = async () => {
    if (pendingPairRequest) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await acceptPairRequest(pendingPairRequest);
    }
  };

  const handleRejectPair = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await rejectPairRequest();
  };

  const handleRequestSync = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await requestSync();
  };

  const handleDisconnect = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    disconnect();
  };

  const handleUnpairDevice = (device: P2PPairedDevice) => {
    Alert.alert(
      'Gerät entkoppeln',
      `Möchten Sie "${device.name}" wirklich entkoppeln?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entkoppeln',
          style: 'destructive',
          onPress: () => unpairDevice(device.id),
        },
      ]
    );
  };

  const copyPairingCode = async () => {
    if (qrCodeData) {
      await Clipboard.setStringAsync(qrCodeData);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Kopiert', 'Code wurde in die Zwischenablage kopiert.');
    }
  };

  const getStatusText = () => {
    switch (syncState.status) {
      case 'idle': return 'Bereit';
      case 'discovering': return 'Suche...';
      case 'connecting': return 'Verbinde...';
      case 'pairing': return 'Kopplung...';
      case 'syncing': return 'Synchronisiere...';
      case 'connected': return 'Verbunden';
      case 'error': return syncState.error || 'Fehler';
      default: return 'Unbekannt';
    }
  };

  const getStatusColor = () => {
    switch (syncState.status) {
      case 'connected': return Colors.positive;
      case 'syncing': return Colors.primary;
      case 'error': return Colors.negative;
      default: return Colors.textSecondary;
    }
  };

  const frequencyLabels: Record<BackupFrequency, string> = {
    daily: 'Täglich',
    weekly: 'Wöchentlich (Samstag)',
    custom: 'Benutzerdefiniert',
  };

  const handleLock = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    lock();
  };

  const SettingRow = ({
    icon,
    label,
    value,
    onPress,
    isLast,
  }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    onPress: () => void;
    isLast?: boolean;
  }) => (
    <>
      <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.55}>
        <View style={styles.rowLeft}>
          <View style={styles.rowIcon}>{icon}</View>
          <View style={styles.rowTextWrap}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
          </View>
        </View>
        <ChevronRight size={15} color={Colors.textLight} strokeWidth={1.7} />
      </TouchableOpacity>
      {!isLast && <View style={styles.divider} />}
    </>
  );

  const SectionHeader = ({
    icon,
    title,
    subtitle,
    sectionKey,
    iconBgColor,
  }: {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    sectionKey: string;
    iconBgColor?: string;
  }) => (
    <TouchableOpacity 
      style={styles.sectionHeader} 
      onPress={() => toggleSection(sectionKey)} 
      activeOpacity={0.6}
    >
      <View style={[styles.sectionHeaderIcon, iconBgColor ? { backgroundColor: iconBgColor } : null]}>
        {icon}
      </View>
      <View style={styles.sectionHeaderContent}>
        <Text style={styles.sectionHeaderTitle}>{title}</Text>
        <Text style={styles.sectionHeaderSubtitle}>{subtitle}</Text>
      </View>
      {expandedSections[sectionKey] ? (
        <ChevronDown size={18} color={Colors.textLight} strokeWidth={1.7} />
      ) : (
        <ChevronRight size={18} color={Colors.textLight} strokeWidth={1.7} />
      )}
    </TouchableOpacity>
  );

  if (data.profile.name === '' && !data.onboardingComplete) {
    return <SettingsScreenSkeleton />;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]} showsVerticalScrollIndicator={false}>
      <Text style={styles.screenTitle}>Profil</Text>

      <View style={styles.profileCard}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>
            {data.profile.name ? data.profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?'}
          </Text>
        </View>
        <Text style={styles.profileName}>{data.profile.name || 'Kein Name'}</Text>
        <Text style={styles.profileSchool}>{data.profile.school || 'Keine Schule'}</Text>
      </View>

      <View style={styles.sectionCard}>
        <SectionHeader
          icon={<User size={18} color={Colors.primary} strokeWidth={1.7} />}
          title="Profil & Einstellungen"
          subtitle={data.profile.name || 'Name, Schule, Fächer'}
          sectionKey="profile"
          iconBgColor={Colors.primaryLight}
        />
        {expandedSections.profile && (
          <View style={styles.sectionContent}>
            <SettingRow
              icon={<User size={16} color={Colors.primary} strokeWidth={1.7} />}
              label="Name"
              value={data.profile.name}
              onPress={() => {
                setEditValue(data.profile.name);
                setShowNameModal(true);
              }}
            />
            <SettingRow
              icon={<School size={16} color={Colors.primary} strokeWidth={1.7} />}
              label="Schule"
              value={data.profile.school || 'Nicht angegeben'}
              onPress={() => {
                setEditValue(data.profile.school);
                setShowSchoolModal(true);
              }}
            />
            <SettingRow
              icon={<BookOpen size={16} color={Colors.primary} strokeWidth={1.7} />}
              label="Fächer"
              value={`${data.profile.subjects.length} ausgewählt`}
              onPress={() => {
                setTempSubjects([...data.profile.subjects]);
                setShowSubjectsModal(true);
              }}
              isLast
            />
          </View>
        )}
      </View>

      <View style={styles.sectionCard}>
        <SectionHeader
          icon={<Shield size={18} color="#E67E22" strokeWidth={1.7} />}
          title="Sicherheit"
          subtitle="PIN-Schutz verwalten"
          sectionKey="security"
          iconBgColor="#FEF3E6"
        />
        {expandedSections.security && (
          <View style={styles.sectionContent}>
            <SettingRow
              icon={<Lock size={16} color="#E67E22" strokeWidth={1.7} />}
              label="PIN ändern"
              value="••••"
              onPress={() => {
                setNewPin('');
                setConfirmPin('');
                setShowPinModal(true);
              }}
              isLast
            />
          </View>
        )}
      </View>

      <View style={styles.sectionCard}>
        <SectionHeader
          icon={<FileSpreadsheet size={18} color="#27AE60" strokeWidth={1.7} />}
          title="Daten Export"
          subtitle={`${previewData.length} Einträge verfügbar`}
          sectionKey="export"
          iconBgColor="#E8F8F0"
        />
        {expandedSections.export && (
          <View style={styles.sectionContent}>
            <SettingRow
              icon={<FileSpreadsheet size={16} color="#27AE60" strokeWidth={1.7} />}
              label="Statistik exportieren"
              value="Excel, CSV oder PDF"
              onPress={handleOpenExportModal}
              isLast
            />
          </View>
        )}
      </View>

      <View style={styles.sectionCard}>
        <SectionHeader
          icon={<Wifi size={18} color={syncState.status === 'connected' ? Colors.positive : '#9B59B6'} strokeWidth={1.7} />}
          title="Synchronisation"
          subtitle={syncState.status === 'connected' ? 'Verbunden' : `${syncState.pairedDevices.length} Gerät(e) gekoppelt`}
          sectionKey="sync"
          iconBgColor={syncState.status === 'connected' ? Colors.positiveLight : '#F5EEF8'}
        />
        {expandedSections.sync && (
          <View style={styles.sectionContent}>
            <SettingRow
              icon={<Info size={16} color="#9B59B6" strokeWidth={1.7} />}
              label="Status"
              value={getStatusText()}
              onPress={() => setShowP2PModal(true)}
            />
            <SettingRow
              icon={<Smartphone size={16} color="#9B59B6" strokeWidth={1.7} />}
              label="Gekoppelte Geräte"
              value={`${syncState.pairedDevices.length} Gerät(e)`}
              onPress={() => setShowPairedDevicesModal(true)}
            />
            <SettingRow
              icon={<Link size={16} color="#9B59B6" strokeWidth={1.7} />}
              label="Neues Gerät koppeln"
              value="Als Host starten"
              onPress={handleStartHosting}
            />
            <SettingRow
              icon={<Radio size={16} color="#9B59B6" strokeWidth={1.7} />}
              label="Mit Gerät verbinden"
              value="Code eingeben"
              onPress={() => {
                setClientCode('');
                setShowConnectModal(true);
              }}
              isLast
            />
          </View>
        )}
      </View>

      {syncState.status === 'connected' && (
        <View style={styles.syncStatusCard}>
          <View style={styles.syncStatusHeader}>
            <View style={styles.syncStatusIndicator} />
            <Text style={styles.syncStatusTitle}>Verbunden</Text>
          </View>
          <View style={styles.syncStatusActions}>
            <TouchableOpacity style={styles.syncActionBtn} onPress={handleRequestSync}>
              <RefreshCw size={16} color={Colors.primary} strokeWidth={1.7} />
              <Text style={styles.syncActionBtnText}>Sync</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.syncActionBtn, styles.syncActionBtnDanger]} onPress={handleDisconnect}>
              <Unlink size={16} color={Colors.negative} strokeWidth={1.7} />
              <Text style={[styles.syncActionBtnText, styles.syncActionBtnTextDanger]}>Trennen</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {pendingPairRequest && (
        <View style={styles.pairRequestCard}>
          <View style={styles.pairRequestHeader}>
            <AlertCircle size={20} color={Colors.primary} strokeWidth={1.7} />
            <Text style={styles.pairRequestTitle}>Kopplungsanfrage</Text>
          </View>
          <Text style={styles.pairRequestDevice}>{pendingPairRequest.name}</Text>
          <View style={styles.pairRequestActions}>
            <TouchableOpacity style={styles.pairRejectBtn} onPress={handleRejectPair}>
              <Text style={styles.pairRejectBtnText}>Ablehnen</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.pairAcceptBtn} onPress={handleAcceptPair}>
              <Text style={styles.pairAcceptBtnText}>Akzeptieren</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.sectionCard}>
        <SectionHeader
          icon={<Database size={18} color="#3498DB" strokeWidth={1.7} />}
          title="Backup & Wiederherstellung"
          subtitle={lastBackupDate ? `Letztes: ${formatBackupDate(lastBackupDate)}` : 'Kein Backup'}
          sectionKey="backup"
          iconBgColor="#EBF5FB"
        />
        {expandedSections.backup && (
          <View style={styles.sectionContent}>
            <SettingRow
              icon={<Save size={16} color="#3498DB" strokeWidth={1.7} />}
              label="Manuelles Backup"
              value={lastBackupDate ? `Letztes: ${formatBackupDate(lastBackupDate)}` : 'Kein Backup'}
              onPress={handleManualBackup}
            />
            <SettingRow
              icon={<Clock size={16} color="#3498DB" strokeWidth={1.7} />}
              label="Backup-Einstellungen"
              value={`${frequencyLabels[backupSettings.frequency]}`}
              onPress={handleOpenBackupSettings}
            />
            <SettingRow
              icon={<HardDrive size={16} color="#3498DB" strokeWidth={1.7} />}
              label="Backups verwalten"
              value={`${backups.length} Backup(s)`}
              onPress={() => setShowBackupListModal(true)}
            />
            <SettingRow
              icon={<Upload size={16} color="#3498DB" strokeWidth={1.7} />}
              label="Backup importieren"
              value="Aus Zwischenablage"
              onPress={() => {
                setImportData('');
                setShowImportModal(true);
              }}
              isLast
            />
          </View>
        )}
      </View>

      <DelayedInlineBanner visible={isBackingUp} message="Backup wird erstellt..." />
      <DelayedInlineBanner visible={isRestoring} message="Daten werden wiederhergestellt..." />

      <DelayedOverlay visible={isExporting} message="Export wird erstellt..." />
      <DelayedOverlay visible={syncState.status === 'syncing'} message="Synchronisiere..." />


      <TouchableOpacity style={styles.lockBtn} onPress={handleLock} activeOpacity={0.55}>
        <LogOut size={15} color={Colors.textSecondary} strokeWidth={1.7} />
        <Text style={styles.lockBtnText}>App sperren</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.resetBtn}
        onPress={() =>
          Alert.alert(
            'App zurücksetzen',
            'Alle Daten werden unwiderruflich gelöscht. Fortfahren?',
            [
              { text: 'Abbrechen', style: 'cancel' },
              {
                text: 'Zurücksetzen',
                style: 'destructive',
                onPress: () => resetApp(),
              },
            ]
          )
        }
        activeOpacity={0.55}
      >
        <Trash2 size={15} color={Colors.negative} strokeWidth={1.7} />
        <Text style={styles.resetBtnText}>App zurücksetzen</Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>LehrPlan v1.0.0</Text>

      <Modal visible={showNameModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Name ändern</Text>
              <TouchableOpacity onPress={() => setShowNameModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
              </TouchableOpacity>
            </View>
            <TextInput style={styles.input} value={editValue} onChangeText={setEditValue} placeholder="Name" placeholderTextColor={Colors.textLight} autoFocus />
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveName} activeOpacity={0.7}><Text style={styles.saveBtnText}>Speichern</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showSchoolModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Schule ändern</Text>
              <TouchableOpacity onPress={() => setShowSchoolModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
              </TouchableOpacity>
            </View>
            <TextInput style={styles.input} value={editValue} onChangeText={setEditValue} placeholder="Schule" placeholderTextColor={Colors.textLight} autoFocus />
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSchool} activeOpacity={0.7}><Text style={styles.saveBtnText}>Speichern</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showPinModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>PIN ändern</Text>
              <TouchableOpacity onPress={() => setShowPinModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
              </TouchableOpacity>
            </View>
            <TextInput style={styles.input} value={newPin} onChangeText={setNewPin} placeholder="Neue PIN" placeholderTextColor={Colors.textLight} secureTextEntry keyboardType="number-pad" maxLength={6} />
            <TextInput style={[styles.input, { marginTop: 12 }]} value={confirmPin} onChangeText={setConfirmPin} placeholder="PIN bestätigen" placeholderTextColor={Colors.textLight} secureTextEntry keyboardType="number-pad" maxLength={6} />
            <TouchableOpacity style={[styles.saveBtn, { marginTop: 16 }]} onPress={handleSavePin} activeOpacity={0.7}><Text style={styles.saveBtnText}>Speichern</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showSubjectsModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' as unknown as number }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Fächer bearbeiten</Text>
              <TouchableOpacity onPress={() => setShowSubjectsModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={styles.subjectGrid}>
              {ALL_SUBJECTS.map((subject) => {
                const sel = tempSubjects.includes(subject);
                return (
                  <TouchableOpacity
                    key={subject}
                    style={[styles.subjectChip, sel && styles.subjectChipActive]}
                    onPress={() =>
                      setTempSubjects((prev) =>
                        sel ? prev.filter((s) => s !== subject) : [...prev, subject]
                      )
                    }
                  >
                    <Text style={[styles.subjectChipText, sel && styles.subjectChipTextActive]}>{subject}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSubjects} activeOpacity={0.7}><Text style={styles.saveBtnText}>Speichern</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showBackupSettingsModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Backup-Einstellungen</Text>
              <TouchableOpacity onPress={() => setShowBackupSettingsModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
              </TouchableOpacity>
            </View>

            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Automatisches Backup</Text>
              <TouchableOpacity
                style={[styles.toggleBtn, tempAutoBackup && styles.toggleBtnActive]}
                onPress={() => setTempAutoBackup(!tempAutoBackup)}
              >
                <Text style={[styles.toggleText, tempAutoBackup && styles.toggleTextActive]}>
                  {tempAutoBackup ? 'Ein' : 'Aus'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Häufigkeit</Text>
            </View>
            <View style={styles.frequencyOptions}>
              {(['daily', 'weekly'] as BackupFrequency[]).map((freq) => (
                <TouchableOpacity
                  key={freq}
                  style={[styles.freqChip, tempFrequency === freq && styles.freqChipActive]}
                  onPress={() => setTempFrequency(freq)}
                >
                  <Text style={[styles.freqChipText, tempFrequency === freq && styles.freqChipTextActive]}>
                    {frequencyLabels[freq]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Max. Versionen behalten</Text>
              <View style={styles.counterRow}>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setTempMaxVersions(Math.max(1, tempMaxVersions - 1))}
                >
                  <Text style={styles.counterBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.counterValue}>{tempMaxVersions}</Text>
                <TouchableOpacity
                  style={styles.counterBtn}
                  onPress={() => setTempMaxVersions(Math.min(20, tempMaxVersions + 1))}
                >
                  <Text style={styles.counterBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveBackupSettings} activeOpacity={0.7}>
              <Text style={styles.saveBtnText}>Speichern</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showBackupListModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' as unknown as number }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Backups verwalten</Text>
              <TouchableOpacity onPress={() => setShowBackupListModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 400 }}>
              {backups.length === 0 ? (
                <Text style={styles.emptyText}>Keine Backups vorhanden</Text>
              ) : (
                backups.map((backup) => (
                  <View key={backup.id} style={styles.backupItem}>
                    <View style={styles.backupInfo}>
                      <Text style={styles.backupDate}>{formatBackupDate(backup.createdAt)}</Text>
                      <Text style={styles.backupSize}>
                        {formatBackupSize(backup.size)} {!backup.isValid && '(Beschädigt)'}
                      </Text>
                    </View>
                    <View style={styles.backupActions}>
                      <TouchableOpacity
                        style={styles.backupActionBtn}
                        onPress={() => handleSelectBackupForRestore(backup)}
                      >
                        <RotateCcw size={16} color={Colors.primary} strokeWidth={1.7} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.backupActionBtn}
                        onPress={() => handleExportBackup(backup)}
                      >
                        <Download size={16} color={Colors.textSecondary} strokeWidth={1.7} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.backupActionBtn}
                        onPress={() => handleDeleteBackup(backup)}
                      >
                        <Trash2 size={16} color={Colors.negative} strokeWidth={1.7} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showRestoreModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Backup wiederherstellen</Text>
              <TouchableOpacity onPress={() => setShowRestoreModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
              </TouchableOpacity>
            </View>
            {selectedBackup && (
              <>
                <Text style={styles.restoreInfo}>
                  Backup vom {formatBackupDate(selectedBackup.createdAt)}
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
                <TouchableOpacity style={styles.saveBtn} onPress={handleRestore} activeOpacity={0.7}>
                  <Text style={styles.saveBtnText}>Wiederherstellen</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showImportModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' as unknown as number }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Backup importieren</Text>
              <TouchableOpacity onPress={() => { setShowImportModal(false); setPendingImportBackup(null); setRestorePin(''); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
              </TouchableOpacity>
            </View>

            {pendingImportBackup ? (
              <View>
                <View style={styles.importedBackupCard}>
                  <View style={styles.importedBackupIcon}>
                    <HardDrive size={24} color={Colors.primary} strokeWidth={1.7} />
                  </View>
                  <View style={styles.importedBackupInfo}>
                    <Text style={styles.importedBackupTitle}>Backup ausgewählt</Text>
                    <Text style={styles.importedBackupDate}>{formatBackupDate(pendingImportBackup.createdAt)}</Text>
                    <Text style={styles.importedBackupSize}>{formatBackupSize(pendingImportBackup.size)}</Text>
                  </View>
                  <TouchableOpacity style={styles.importedBackupRemove} onPress={handleCancelImportedBackup}>
                    <X size={18} color={Colors.textSecondary} strokeWidth={1.7} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.restorePinLabel}>PIN des Backups eingeben:</Text>
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
                  style={[styles.saveBtn, isRestoring && styles.saveBtnDisabled]}
                  onPress={handleRestoreImportedBackup}
                  activeOpacity={0.7}
                  disabled={isRestoring}
                >
                  {isRestoring ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={styles.saveBtnText}>Wiederherstellen</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.importHint}>Wählen Sie eine Backup-Datei aus:</Text>
                <TouchableOpacity 
                  style={[styles.filePickerBtn, isImporting && styles.filePickerBtnDisabled]} 
                  onPress={handlePickBackupFile} 
                  activeOpacity={0.7}
                  disabled={isImporting}
                >
                  {isImporting ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <>
                      <FileUp size={20} color={Colors.primary} strokeWidth={1.7} />
                      <Text style={styles.filePickerBtnText}>Backup-Datei auswählen</Text>
                    </>
                  )}
                </TouchableOpacity>

                <View style={styles.importDivider}>
                  <View style={styles.importDividerLine} />
                  <Text style={styles.importDividerText}>oder</Text>
                  <View style={styles.importDividerLine} />
                </View>

                <Text style={styles.importHintSmall}>Backup-Daten einfügen:</Text>
                <TextInput
                  style={[styles.input, styles.importInput]}
                  value={importData}
                  onChangeText={setImportData}
                  placeholder="Backup-Daten hier einfügen..."
                  placeholderTextColor={Colors.textLight}
                  multiline
                  numberOfLines={4}
                />
                <TouchableOpacity 
                  style={[styles.importTextBtn, (!importData.trim() || isImporting) && styles.importTextBtnDisabled]} 
                  onPress={handleImportBackup} 
                  activeOpacity={0.7}
                  disabled={!importData.trim() || isImporting}
                >
                  {isImporting ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <Text style={styles.importTextBtnText}>Text importieren</Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showExportModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%' as unknown as number }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Statistik exportieren</Text>
              <TouchableOpacity onPress={() => setShowExportModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
              <Text style={styles.exportSectionLabel}>FORMAT</Text>
              <View style={styles.formatOptions}>
                {(['xlsx', 'csv', 'pdf'] as ExportFormat[]).map((format) => (
                  <TouchableOpacity
                    key={format}
                    style={[styles.formatChip, exportFormat === format && styles.formatChipActive]}
                    onPress={() => setExportFormat(format)}
                  >
                    {format === 'xlsx' && <FileSpreadsheet size={14} color={exportFormat === format ? Colors.white : Colors.text} strokeWidth={1.7} />}
                    {format === 'csv' && <FileText size={14} color={exportFormat === format ? Colors.white : Colors.text} strokeWidth={1.7} />}
                    {format === 'pdf' && <File size={14} color={exportFormat === format ? Colors.white : Colors.text} strokeWidth={1.7} />}
                    <Text style={[styles.formatChipText, exportFormat === format && styles.formatChipTextActive]}>
                      {formatLabels[format]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.exportSectionLabel}>FELDER AUSWÄHLEN</Text>
              <View style={styles.fieldsGrid}>
                {exportFields.map((field) => (
                  <TouchableOpacity
                    key={field.key}
                    style={[styles.fieldChip, field.enabled && styles.fieldChipActive]}
                    onPress={() => handleToggleField(field.key)}
                  >
                    {field.enabled && <Check size={12} color={Colors.white} strokeWidth={2.5} />}
                    <Text style={[styles.fieldChipText, field.enabled && styles.fieldChipTextActive]}>
                      {field.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.exportSectionLabel}>ZEITRAUM (OPTIONAL)</Text>
              <View style={styles.dateRow}>
                <View style={styles.dateInputWrap}>
                  <Calendar size={14} color={Colors.textLight} strokeWidth={1.7} />
                  <TextInput
                    style={styles.dateInput}
                    value={exportDateStart}
                    onChangeText={setExportDateStart}
                    placeholder="Von (JJJJ-MM-TT)"
                    placeholderTextColor={Colors.textLight}
                  />
                </View>
                <View style={styles.dateInputWrap}>
                  <Calendar size={14} color={Colors.textLight} strokeWidth={1.7} />
                  <TextInput
                    style={styles.dateInput}
                    value={exportDateEnd}
                    onChangeText={setExportDateEnd}
                    placeholder="Bis (JJJJ-MM-TT)"
                    placeholderTextColor={Colors.textLight}
                  />
                </View>
              </View>

              <Text style={styles.exportSectionLabel}>FILTER (OPTIONAL)</Text>
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Fach</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                  <TouchableOpacity
                    style={[styles.filterChipSmall, !exportSubjectFilter && styles.filterChipSmallActive]}
                    onPress={() => setExportSubjectFilter(null)}
                  >
                    <Text style={[styles.filterChipSmallText, !exportSubjectFilter && styles.filterChipSmallTextActive]}>Alle</Text>
                  </TouchableOpacity>
                  {data.profile.subjects.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.filterChipSmall, exportSubjectFilter === s && styles.filterChipSmallActive]}
                      onPress={() => setExportSubjectFilter(s)}
                    >
                      <Text style={[styles.filterChipSmallText, exportSubjectFilter === s && styles.filterChipSmallTextActive]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Klasse</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                  <TouchableOpacity
                    style={[styles.filterChipSmall, !exportClassFilter && styles.filterChipSmallActive]}
                    onPress={() => setExportClassFilter(null)}
                  >
                    <Text style={[styles.filterChipSmallText, !exportClassFilter && styles.filterChipSmallTextActive]}>Alle</Text>
                  </TouchableOpacity>
                  {data.classes.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.filterChipSmall, exportClassFilter === c.id && styles.filterChipSmallActive]}
                      onPress={() => setExportClassFilter(c.id)}
                    >
                      <Text style={[styles.filterChipSmallText, exportClassFilter === c.id && styles.filterChipSmallTextActive]}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {exportFormat === 'csv' && (
                <>
                  <Text style={styles.exportSectionLabel}>SICHERHEIT</Text>
                  <View style={styles.securitySection}>
                    <TouchableOpacity
                      style={[styles.securityToggle, exportEncrypted && styles.securityToggleActive]}
                      onPress={() => setExportEncrypted(!exportEncrypted)}
                    >
                      <Shield size={16} color={exportEncrypted ? Colors.white : Colors.text} strokeWidth={1.7} />
                      <Text style={[styles.securityToggleText, exportEncrypted && styles.securityToggleTextActive]}>
                        Verschlüsselt exportieren
                      </Text>
                    </TouchableOpacity>
                    {exportEncrypted && (
                      <TextInput
                        style={[styles.input, { marginTop: 12 }]}
                        value={exportPassword}
                        onChangeText={setExportPassword}
                        placeholder="Passwort für Verschlüsselung"
                        placeholderTextColor={Colors.textLight}
                        secureTextEntry
                      />
                    )}
                  </View>
                </>
              )}

              <View style={styles.previewInfo}>
                <Eye size={14} color={Colors.textSecondary} strokeWidth={1.7} />
                <Text style={styles.previewInfoText}>
                  {previewData.length} Einträge werden exportiert
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, isExporting && styles.saveBtnDisabled]}
              onPress={handleExport}
              activeOpacity={0.7}
              disabled={isExporting}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <Download size={16} color={Colors.white} strokeWidth={2} />
                  <Text style={styles.saveBtnText}>Exportieren</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showP2PModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Synchronisation</Text>
              <TouchableOpacity onPress={() => setShowP2PModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
              </TouchableOpacity>
            </View>

            <View style={styles.p2pInfoSection}>
              <View style={styles.p2pInfoRow}>
                <Text style={styles.p2pInfoLabel}>Gerätename</Text>
                <Text style={styles.p2pInfoValue}>{p2pSettings?.deviceName || 'Unbekannt'}</Text>
              </View>
              <View style={styles.p2pInfoRow}>
                <Text style={styles.p2pInfoLabel}>Geräte-ID</Text>
                <Text style={styles.p2pInfoValue} numberOfLines={1}>{p2pSettings?.deviceId?.substring(0, 16) || '-'}...</Text>
              </View>
              <View style={styles.p2pInfoRow}>
                <Text style={styles.p2pInfoLabel}>Status</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                  <Text style={[styles.statusBadgeText, { color: getStatusColor() }]}>{getStatusText()}</Text>
                </View>
              </View>
              {syncState.lastSyncTimestamp && (
                <View style={styles.p2pInfoRow}>
                  <Text style={styles.p2pInfoLabel}>Letzte Sync</Text>
                  <Text style={styles.p2pInfoValue}>{new Date(syncState.lastSyncTimestamp).toLocaleString('de-DE')}</Text>
                </View>
              )}
            </View>

            <View style={styles.p2pSettingItem}>
              <Text style={styles.settingLabel}>Konfliktlösung</Text>
              <View style={styles.conflictOptions}>
                {(['newest', 'merge'] as const).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[styles.conflictChip, p2pSettings?.conflictResolution === mode && styles.conflictChipActive]}
                    onPress={() => updateP2PSettings({ conflictResolution: mode })}
                  >
                    <Text style={[styles.conflictChipText, p2pSettings?.conflictResolution === mode && styles.conflictChipTextActive]}>
                      {mode === 'newest' ? 'Neueste' : 'Zusammenführen'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={() => setShowP2PModal(false)} activeOpacity={0.7}>
              <Text style={styles.saveBtnText}>Schließen</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showPairModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gerät koppeln (Host)</Text>
              <TouchableOpacity onPress={handleStopHosting} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
              </TouchableOpacity>
            </View>

            <Text style={styles.pairingHint}>Teilen Sie diesen Code mit dem anderen Gerät:</Text>
            
            <View style={styles.hostCodeDisplayBox}>
              <Text style={styles.hostCodeDisplayText} selectable>{qrCodeData || 'Generiere...'}</Text>
            </View>

            <TouchableOpacity style={styles.copyCodeBtnLarge} onPress={copyPairingCode}>
              <Copy size={18} color={Colors.primary} strokeWidth={1.7} />
              <Text style={styles.copyCodeBtnLargeText}>Vollständigen Code kopieren</Text>
            </TouchableOpacity>

            <View style={styles.hostInstructions}>
              <Text style={styles.hostInstructionsTitle}>Anleitung für das andere Gerät:</Text>
              <Text style={styles.hostInstructionsText}>
                1. Öffnen Sie Profil → Synchronisation{"\n"}
                2. Tippen Sie auf &quot;Mit Gerät verbinden&quot;{"\n"}
                3. Fügen Sie den kopierten Code ein{"\n"}
                4. Tippen Sie auf &quot;Verbinden&quot;
              </Text>
            </View>

            <View style={styles.pairingDivider}>
              <View style={styles.pairingDividerLine} />
              <Text style={styles.pairingDividerText}>oder</Text>
              <View style={styles.pairingDividerLine} />
            </View>

            <Text style={styles.pairingHint}>Code vom anderen Gerät eingeben:</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={inputPairingCode}
              onChangeText={setInputPairingCode}
              placeholder="Code hier einfügen..."
              placeholderTextColor={Colors.textLight}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity
              style={[styles.saveBtn, !inputPairingCode && styles.saveBtnDisabled]}
              onPress={async () => {
                if (inputPairingCode.trim()) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  const result = await validateAndConnectFromQR(inputPairingCode.trim());
                  if (result.success) {
                    setShowPairModal(false);
                    setInputPairingCode('');
                    Alert.alert('Verbunden', 'Verbindung wurde erfolgreich hergestellt.');
                  } else {
                    Alert.alert('Fehler', result.error || 'Verbindung fehlgeschlagen');
                  }
                }
              }}
              activeOpacity={0.7}
              disabled={!inputPairingCode}
            >
              <Text style={styles.saveBtnText}>Verbinden</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showConnectModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Mit Gerät verbinden</Text>
              <TouchableOpacity onPress={() => setShowConnectModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
              </TouchableOpacity>
            </View>

            <Text style={styles.connectHint}>Fügen Sie den Code vom Host-Gerät ein:</Text>
            
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={clientCode}
              onChangeText={setClientCode}
              placeholder="Host-Code hier einfügen..."
              placeholderTextColor={Colors.textLight}
              multiline
              numberOfLines={4}
            />

            <View style={styles.clientInstructions}>
              <Text style={styles.clientInstructionsTitle}>So erhalten Sie den Code:</Text>
              <Text style={styles.clientInstructionsText}>
                1. Öffnen Sie die App auf dem Host-Gerät{"\n"}
                2. Gehen Sie zu Profil → Synchronisation{"\n"}
                3. Tippen Sie auf &quot;Neues Gerät koppeln&quot;{"\n"}
                4. Kopieren Sie den angezeigten Code
              </Text>
            </View>

            <View style={styles.pairingDivider}>
              <View style={styles.pairingDividerLine} />
              <Text style={styles.pairingDividerText}>Ihr Code für den Host</Text>
              <View style={styles.pairingDividerLine} />
            </View>

            <View style={styles.clientCodeDisplay}>
              <Text style={styles.clientCodeLabel}>Falls der Host Ihren Code benötigt:</Text>
              <View style={styles.clientCodeBox}>
                <Text style={styles.clientCodeText}>{p2pSettings?.deviceId?.substring(0, 6).toUpperCase() || '------'}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, syncState.status === 'connecting' && styles.saveBtnDisabled]}
              onPress={handleConnectWithCode}
              activeOpacity={0.7}
              disabled={syncState.status === 'connecting'}
            >
              {syncState.status === 'connecting' ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.saveBtnText}>Verbinden</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showPairedDevicesModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '70%' as unknown as number }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Gekoppelte Geräte</Text>
              <TouchableOpacity onPress={() => setShowPairedDevicesModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 350 }}>
              {syncState.pairedDevices.length === 0 ? (
                <View style={styles.emptyDevices}>
                  <Smartphone size={40} color={Colors.textLight} strokeWidth={1.2} />
                  <Text style={styles.emptyDevicesText}>Keine gekoppelten Geräte</Text>
                  <Text style={styles.emptyDevicesHint}>Koppeln Sie ein Gerät, um Daten zu synchronisieren</Text>
                </View>
              ) : (
                syncState.pairedDevices.map((device) => (
                  <View key={device.id} style={styles.pairedDeviceItem}>
                    <View style={styles.pairedDeviceIcon}>
                      <Smartphone size={18} color={Colors.primary} strokeWidth={1.7} />
                    </View>
                    <View style={styles.pairedDeviceInfo}>
                      <Text style={styles.pairedDeviceName}>{device.name}</Text>
                      <Text style={styles.pairedDeviceDate}>
                        Gekoppelt: {new Date(device.pairedAt).toLocaleDateString('de-DE')}
                        {device.lastSyncAt && ` | Sync: ${new Date(device.lastSyncAt).toLocaleDateString('de-DE')}`}
                      </Text>
                    </View>
                    {!device.lastSyncAt && (
                      <TouchableOpacity
                        style={styles.firstSyncBtn}
                        onPress={() => handleInitiateFirstSync(device.id)}
                      >
                        <RefreshCw size={14} color={Colors.primary} strokeWidth={1.7} />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.unpairBtn}
                      onPress={() => handleUnpairDevice(device)}
                    >
                      <Unlink size={16} color={Colors.negative} strokeWidth={1.7} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showFirstSyncModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Erste Synchronisation</Text>
              <TouchableOpacity onPress={handleCancelFirstSync} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
              </TouchableOpacity>
            </View>

            <Text style={styles.firstSyncDescription}>
              Wählen Sie, welche Daten als Grundlage verwendet werden sollen. Die anderen Daten werden überschrieben.
            </Text>

            <View style={styles.firstSyncOptions}>
              <TouchableOpacity
                style={styles.firstSyncOption}
                onPress={() => handleFirstSyncChoice('local')}
                activeOpacity={0.7}
              >
                <View style={styles.firstSyncOptionHeader}>
                  <View style={[styles.firstSyncOptionIcon, { backgroundColor: Colors.primaryLight }]}>
                    <Smartphone size={20} color={Colors.primary} strokeWidth={1.7} />
                  </View>
                  <Text style={styles.firstSyncOptionTitle}>Dieses Gerät</Text>
                  <ArrowRight size={16} color={Colors.textLight} strokeWidth={1.7} />
                </View>
                <View style={styles.firstSyncStats}>
                  <View style={styles.firstSyncStatRow}>
                    <Database size={12} color={Colors.textSecondary} strokeWidth={1.7} />
                    <Text style={styles.firstSyncStatText}>{localDataStats.classesCount} Klassen</Text>
                  </View>
                  <View style={styles.firstSyncStatRow}>
                    <User size={12} color={Colors.textSecondary} strokeWidth={1.7} />
                    <Text style={styles.firstSyncStatText}>{localDataStats.studentsCount} Schüler</Text>
                  </View>
                  <View style={styles.firstSyncStatRow}>
                    <Check size={12} color={Colors.textSecondary} strokeWidth={1.7} />
                    <Text style={styles.firstSyncStatText}>{localDataStats.participationsCount} Bewertungen</Text>
                  </View>
                </View>
                <Text style={styles.firstSyncOptionHint}>Daten dieses Geräts werden an das andere Gerät gesendet</Text>
              </TouchableOpacity>

              <View style={styles.firstSyncDivider}>
                <View style={styles.firstSyncDividerLine} />
                <Text style={styles.firstSyncDividerText}>oder</Text>
                <View style={styles.firstSyncDividerLine} />
              </View>

              <TouchableOpacity
                style={styles.firstSyncOption}
                onPress={() => handleFirstSyncChoice('remote')}
                activeOpacity={0.7}
              >
                <View style={styles.firstSyncOptionHeader}>
                  <View style={[styles.firstSyncOptionIcon, { backgroundColor: Colors.positiveLight }]}>
                    <Wifi size={20} color={Colors.positive} strokeWidth={1.7} />
                  </View>
                  <Text style={styles.firstSyncOptionTitle}>Anderes Gerät</Text>
                  <ArrowLeft size={16} color={Colors.textLight} strokeWidth={1.7} />
                </View>
                {syncState.firstSync.remoteDataStats ? (
                  <View style={styles.firstSyncStats}>
                    <View style={styles.firstSyncStatRow}>
                      <Database size={12} color={Colors.textSecondary} strokeWidth={1.7} />
                      <Text style={styles.firstSyncStatText}>{syncState.firstSync.remoteDataStats.classesCount} Klassen</Text>
                    </View>
                    <View style={styles.firstSyncStatRow}>
                      <User size={12} color={Colors.textSecondary} strokeWidth={1.7} />
                      <Text style={styles.firstSyncStatText}>{syncState.firstSync.remoteDataStats.studentsCount} Schüler</Text>
                    </View>
                    <View style={styles.firstSyncStatRow}>
                      <Check size={12} color={Colors.textSecondary} strokeWidth={1.7} />
                      <Text style={styles.firstSyncStatText}>{syncState.firstSync.remoteDataStats.participationsCount} Bewertungen</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.firstSyncStats}>
                    <Text style={styles.firstSyncStatText}>Warten auf Daten...</Text>
                  </View>
                )}
                <Text style={styles.firstSyncOptionHint}>Daten des anderen Geräts werden auf dieses Gerät übertragen</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.firstSyncWarning}>
              <AlertCircle size={16} color={Colors.warning} strokeWidth={1.7} />
              <Text style={styles.firstSyncWarningText}>
                Achtung: Die nicht gewählten Daten werden unwiderruflich überschrieben!
              </Text>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 40,
  },
  screenTitle: {
    fontSize: 30,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.5,
    marginBottom: 24,
  },
  profileCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 28,
    ...Platform.select({
      ios: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8 },
      android: { elevation: 1 },
      default: {},
    }),
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  profileAvatarText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  profileSchool: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textLight,
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  section: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    ...Platform.select({
      ios: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8 },
      android: { elevation: 1 },
      default: {},
    }),
  },
  sectionCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8 },
      android: { elevation: 1 },
      default: {},
    }),
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 16,
    gap: 14,
  },
  sectionHeaderIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sectionHeaderContent: {
    flex: 1,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  sectionHeaderSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  sectionContent: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextWrap: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  rowValue: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  divider: {
    height: 0.5,
    backgroundColor: Colors.divider,
    marginLeft: 64,
  },
  lockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    backgroundColor: Colors.white,
    borderRadius: 14,
    marginBottom: 10,
  },
  lockBtnText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    backgroundColor: Colors.negativeLight,
    borderRadius: 14,
  },
  resetBtnText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.negative,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.inputBg,
  },
  toggleBtnActive: {
    backgroundColor: Colors.primary,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  toggleTextActive: {
    color: Colors.white,
  },
  frequencyOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  freqChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.inputBg,
  },
  freqChipActive: {
    backgroundColor: Colors.primary,
  },
  freqChipText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  freqChipTextActive: {
    color: Colors.white,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  counterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnText: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  counterValue: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    minWidth: 30,
    textAlign: 'center' as const,
  },
  backupItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.divider,
  },
  backupInfo: {
    flex: 1,
  },
  backupDate: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  backupSize: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  backupActions: {
    flexDirection: 'row',
    gap: 8,
  },
  backupActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    paddingVertical: 24,
  },
  restoreInfo: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  importHint: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  importHintSmall: {
    fontSize: 13,
    color: Colors.textLight,
    marginTop: 16,
    marginBottom: 8,
  },
  filePickerBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 16,
    borderRadius: 12,
  },
  filePickerBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  filePickerBtnDisabled: {
    opacity: 0.6,
  },
  importedBackupCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.positiveLight,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    gap: 14,
  },
  importedBackupIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.white,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  importedBackupInfo: {
    flex: 1,
  },
  importedBackupTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.positive,
    marginBottom: 2,
  },
  importedBackupDate: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  importedBackupSize: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  importedBackupRemove: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.white,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  restorePinLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
    marginBottom: 10,
  },
  importDivider: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginVertical: 20,
    gap: 12,
  },
  importDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.divider,
  },
  importDividerText: {
    fontSize: 13,
    color: Colors.textLight,
  },
  importTextBtn: {
    backgroundColor: Colors.inputBg,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center' as const,
    marginTop: 12,
  },
  importTextBtnDisabled: {
    opacity: 0.5,
  },
  importTextBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  importInput: {
    height: 100,
    textAlignVertical: 'top' as const,
  },
  exportSectionLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textLight,
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 16,
  },
  formatOptions: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  formatChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.inputBg,
  },
  formatChipActive: {
    backgroundColor: Colors.primary,
  },
  formatChipText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  formatChipTextActive: {
    color: Colors.white,
  },
  fieldsGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  fieldChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.inputBg,
  },
  fieldChipActive: {
    backgroundColor: Colors.primary,
  },
  fieldChipText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  fieldChipTextActive: {
    color: Colors.white,
  },
  dateRow: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  dateInputWrap: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: Colors.inputBg,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  dateInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 13,
    color: Colors.text,
  },
  filterSection: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  filterScroll: {
    flexGrow: 0,
  },
  filterChipSmall: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: Colors.inputBg,
    marginRight: 6,
  },
  filterChipSmallActive: {
    backgroundColor: Colors.primary,
  },
  filterChipSmallText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  filterChipSmallTextActive: {
    color: Colors.white,
  },
  securitySection: {
    marginBottom: 8,
  },
  securityToggle: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.inputBg,
  },
  securityToggleActive: {
    backgroundColor: Colors.primary,
  },
  securityToggleText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  securityToggleTextActive: {
    color: Colors.white,
  },
  previewInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 12,
    marginTop: 8,
    backgroundColor: Colors.inputBg,
    borderRadius: 10,
  },
  previewInfoText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  saveBtnDisabled: {
    opacity: 0.6,
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
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexDirection: 'row' as const,
    gap: 8,
    marginTop: 16,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  subjectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 16,
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
  subjectChipText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  subjectChipTextActive: {
    color: Colors.white,
  },
  syncStatusCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    ...Platform.select({
      ios: { shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8 },
      android: { elevation: 1 },
      default: {},
    }),
  },
  syncStatusHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginBottom: 14,
  },
  syncStatusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.positive,
  },
  syncStatusTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  syncStatusActions: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  syncActionBtn: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
  },
  syncActionBtnDanger: {
    backgroundColor: Colors.negativeLight,
  },
  syncActionBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  syncActionBtnTextDanger: {
    color: Colors.negative,
  },
  pairRequestCard: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  pairRequestHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginBottom: 8,
  },
  pairRequestTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  pairRequestDevice: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text,
    marginBottom: 14,
  },
  pairRequestActions: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  pairRejectBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.white,
    alignItems: 'center' as const,
  },
  pairRejectBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  pairAcceptBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
  },
  pairAcceptBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  p2pInfoSection: {
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  p2pInfoRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 8,
  },
  p2pInfoLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  p2pInfoValue: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
    maxWidth: '60%' as unknown as number,
    textAlign: 'right' as const,
  },
  statusBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  p2pSettingItem: {
    marginBottom: 16,
  },
  conflictOptions: {
    flexDirection: 'row' as const,
    gap: 8,
    marginTop: 10,
  },
  conflictChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.inputBg,
    alignItems: 'center' as const,
  },
  conflictChipActive: {
    backgroundColor: Colors.primary,
  },
  conflictChipText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  conflictChipTextActive: {
    color: Colors.white,
  },
  pairingCodeSection: {
    alignItems: 'center' as const,
    marginBottom: 20,
  },
  pairingHint: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    marginBottom: 16,
  },
  hostCodeDisplayBox: {
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  hostCodeDisplayText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: Colors.text,
    lineHeight: 16,
  },
  copyCodeBtnLarge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  copyCodeBtnLargeText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  hostInstructions: {
    backgroundColor: Colors.inputBg,
    padding: 14,
    borderRadius: 12,
  },
  hostInstructionsTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  hostInstructionsText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  codeInput: {
    height: 80,
    textAlignVertical: 'top' as const,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
  },
  clientInstructions: {
    backgroundColor: Colors.inputBg,
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  clientInstructionsTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  clientInstructionsText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  pairingDivider: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginVertical: 16,
  },
  pairingDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.divider,
  },
  pairingDividerText: {
    fontSize: 12,
    color: Colors.textLight,
    paddingHorizontal: 16,
  },
  connectHint: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  emptyDevices: {
    alignItems: 'center' as const,
    paddingVertical: 40,
  },
  emptyDevicesText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginTop: 16,
  },
  emptyDevicesHint: {
    fontSize: 13,
    color: Colors.textLight,
    marginTop: 6,
    textAlign: 'center' as const,
  },
  pairedDeviceItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.divider,
  },
  pairedDeviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  pairedDeviceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  pairedDeviceName: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  pairedDeviceDate: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  unpairBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.negativeLight,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginLeft: 8,
  },
  firstSyncBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  firstSyncDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
    textAlign: 'center' as const,
  },
  firstSyncOptions: {
    gap: 12,
  },
  firstSyncOption: {
    backgroundColor: Colors.inputBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  firstSyncOptionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginBottom: 12,
  },
  firstSyncOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  firstSyncOptionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  firstSyncStats: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 12,
    marginBottom: 10,
    paddingLeft: 52,
  },
  firstSyncStatRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  firstSyncStatText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  firstSyncOptionHint: {
    fontSize: 12,
    color: Colors.textLight,
    paddingLeft: 52,
  },
  firstSyncDivider: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginVertical: 4,
  },
  firstSyncDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.divider,
  },
  firstSyncDividerText: {
    fontSize: 12,
    color: Colors.textLight,
    paddingHorizontal: 16,
  },
  firstSyncWarning: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    backgroundColor: Colors.warningLight,
    padding: 14,
    borderRadius: 12,
    marginTop: 20,
  },
  firstSyncWarningText: {
    flex: 1,
    fontSize: 13,
    color: Colors.warning,
    lineHeight: 18,
  },
  
  clientCodeDisplay: {
    alignItems: 'center' as const,
  },
  clientCodeLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  clientCodeBox: {
    backgroundColor: Colors.inputBg,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  clientCodeText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  versionText: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: 'center' as const,
    marginTop: 24,
    marginBottom: 8,
  },
});
