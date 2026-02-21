import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import type { AppData, BackupMetadata, BackupSettings, ExternalBackupFile } from '@/types';
import {
  createBackup,
  restoreBackup,
  getAllBackups,
  deleteBackup,
  cleanupOldBackups,
  getLatestValidBackup,
  saveBackupSettings,
  loadBackupSettings,
  getBackupLogs,
  shouldRunScheduledBackup,
  defaultBackupSettings,
  exportBackupToString,
  importBackupFromString,
  scanForExternalBackups,
  importExternalBackup,
  saveBackupToFile,
} from '@/utils/backup';



export const [BackupProvider, useBackup] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<BackupSettings>(defaultBackupSettings);
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);
  const [externalBackups, setExternalBackups] = useState<ExternalBackupFile[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanComplete, setScanComplete] = useState<boolean>(false);
  const currentPinRef = useRef<string>('');
  const getPinFromAppRef = useRef<(() => string) | null>(null);
  const schedulerCheckedRef = useRef<boolean>(false);

  const settingsQuery = useQuery({
    queryKey: ['backupSettings'],
    queryFn: loadBackupSettings,
  });

  const backupsQuery = useQuery({
    queryKey: ['backups'],
    queryFn: getAllBackups,
  });

  const logsQuery = useQuery({
    queryKey: ['backupLogs'],
    queryFn: getBackupLogs,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setSettings(settingsQuery.data);
      setLastBackupDate(settingsQuery.data.lastScheduledBackup);
    }
  }, [settingsQuery.data]);

  const setCurrentPin = useCallback((pin: string) => {
    currentPinRef.current = pin;
    console.log('[BackupContext] PIN set for backup operations');
  }, []);

  const setGetPinFunction = useCallback((fn: () => string) => {
    getPinFromAppRef.current = fn;
    console.log('[BackupContext] GetPin function registered');
  }, []);

  const createBackupMutation = useMutation({
    mutationFn: async (data: AppData) => {
      let pin = currentPinRef.current;
      if (!pin && getPinFromAppRef.current) {
        pin = getPinFromAppRef.current();
        if (pin) {
          currentPinRef.current = pin;
        }
      }
      if (!pin) {
        throw new Error('PIN not available for backup');
      }
      setIsBackingUp(true);
      const metadata = await createBackup(data, pin);
      if (!metadata) {
        throw new Error('Backup creation failed');
      }
      await cleanupOldBackups(settings.maxVersions);
      return metadata;
    },
    onSuccess: (metadata) => {
      setIsBackingUp(false);
      setLastBackupDate(metadata.createdAt);
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      queryClient.invalidateQueries({ queryKey: ['backupLogs'] });
      console.log('[BackupContext] Backup created successfully');
    },
    onError: (error) => {
      setIsBackingUp(false);
      console.log('[BackupContext] Backup creation error:', error);
      if (Platform.OS !== 'web') {
        Alert.alert('Backup fehlgeschlagen', 'Das Backup konnte nicht erstellt werden.');
      }
    },
  });

  const restoreBackupMutation = useMutation({
    mutationFn: async ({ backupId, pin }: { backupId: string; pin: string }) => {
      setIsRestoring(true);
      const data = await restoreBackup(backupId, pin);
      if (!data) {
        throw new Error('Restore failed');
      }
      return data;
    },
    onSuccess: () => {
      setIsRestoring(false);
      queryClient.invalidateQueries({ queryKey: ['backupLogs'] });
      console.log('[BackupContext] Backup restored successfully');
    },
    onError: (error) => {
      setIsRestoring(false);
      console.log('[BackupContext] Restore error:', error);
    },
  });

  const deleteBackupMutation = useMutation({
    mutationFn: deleteBackup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      queryClient.invalidateQueries({ queryKey: ['backupLogs'] });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<BackupSettings>) => {
      const updated = { ...settings, ...newSettings };
      await saveBackupSettings(updated);
      return updated;
    },
    onSuccess: (updated) => {
      setSettings(updated);
      queryClient.setQueryData(['backupSettings'], updated);
    },
  });

  const performManualBackup = useCallback(
    async (data: AppData): Promise<BackupMetadata | null> => {
      try {
        const result = await createBackupMutation.mutateAsync(data);
        return result;
      } catch {
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const performScheduledBackup = useCallback(
    async (data: AppData): Promise<void> => {
      if (!shouldRunScheduledBackup(settings)) {
        console.log('[BackupContext] Scheduled backup not needed');
        return;
      }

      console.log('[BackupContext] Running scheduled backup...');
      try {
        await createBackupMutation.mutateAsync(data);
        const updatedSettings = {
          ...settings,
          lastScheduledBackup: new Date().toISOString(),
        };
        await saveBackupSettings(updatedSettings);
        setSettings(updatedSettings);
        setLastBackupDate(updatedSettings.lastScheduledBackup);
        queryClient.setQueryData(['backupSettings'], updatedSettings);
      } catch (error) {
        console.log('[BackupContext] Scheduled backup failed:', error);
        if (Platform.OS !== 'web') {
          Alert.alert(
            'Automatisches Backup fehlgeschlagen',
            'Das geplante Backup konnte nicht erstellt werden. Bitte erstellen Sie manuell ein Backup.'
          );
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings, queryClient]
  );

  const checkAndRunScheduledBackup = useCallback(
    async (data: AppData) => {
      if (schedulerCheckedRef.current) return;
      schedulerCheckedRef.current = true;
      
      if (settings.autoBackupEnabled && currentPinRef.current) {
        await performScheduledBackup(data);
      }
    },
    [settings.autoBackupEnabled, performScheduledBackup]
  );

  const restoreFromBackup = useCallback(
    async (backupId: string, pin: string): Promise<AppData | null> => {
      try {
        const result = await restoreBackupMutation.mutateAsync({ backupId, pin });
        return result;
      } catch {
        return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const removeBackup = useCallback(
    async (backupId: string): Promise<boolean> => {
      try {
        await deleteBackupMutation.mutateAsync(backupId);
        return true;
      } catch {
        return false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const updateSettings = useCallback(
    async (newSettings: Partial<BackupSettings>) => {
      await updateSettingsMutation.mutateAsync(newSettings);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const exportBackup = useCallback(async (backupId: string): Promise<string | null> => {
    return exportBackupToString(backupId);
  }, []);

  const exportBackupAsFile = useCallback(async (backupId: string): Promise<boolean> => {
    return saveBackupToFile(backupId);
  }, []);

  const importBackup = useCallback(
    async (backupString: string): Promise<BackupMetadata | null> => {
      const metadata = await importBackupFromString(backupString);
      if (metadata) {
        queryClient.invalidateQueries({ queryKey: ['backups'] });
        queryClient.invalidateQueries({ queryKey: ['backupLogs'] });
      }
      return metadata;
    },
    [queryClient]
  );

  const getLatestBackup = useCallback(async (): Promise<BackupMetadata | null> => {
    return getLatestValidBackup();
  }, []);

  const scanExternalBackups = useCallback(async (): Promise<ExternalBackupFile[]> => {
    if (scanComplete) {
      console.log('[BackupContext] Scan already complete, returning cached results');
      return externalBackups;
    }

    setIsScanning(true);
    console.log('[BackupContext] Starting external backup scan...');
    
    try {
      const found = await scanForExternalBackups();
      setExternalBackups(found);
      setScanComplete(true);
      console.log('[BackupContext] External scan complete, found', found.length, 'backups');
      return found;
    } catch (error) {
      console.log('[BackupContext] External scan error:', error);
      setScanComplete(true);
      return [];
    } finally {
      setIsScanning(false);
    }
  }, [scanComplete, externalBackups]);

  const importFromExternal = useCallback(
    async (uri: string): Promise<BackupMetadata | null> => {
      const metadata = await importExternalBackup(uri);
      if (metadata) {
        queryClient.invalidateQueries({ queryKey: ['backups'] });
        queryClient.invalidateQueries({ queryKey: ['backupLogs'] });
      }
      return metadata;
    },
    [queryClient]
  );

  return {
    settings,
    backups: backupsQuery.data || [],
    logs: logsQuery.data || [],
    lastBackupDate,
    isBackingUp,
    isRestoring,
    isLoading: settingsQuery.isLoading || backupsQuery.isLoading,
    externalBackups,
    isScanning,
    scanComplete,
    setCurrentPin,
    setGetPinFunction,
    performManualBackup,
    performScheduledBackup,
    checkAndRunScheduledBackup,
    restoreFromBackup,
    removeBackup,
    updateSettings,
    exportBackup,
    exportBackupAsFile,
    importBackup,
    getLatestBackup,
    scanExternalBackups,
    importFromExternal,
    refetchBackups: () => queryClient.invalidateQueries({ queryKey: ['backups'] }),
  };
});
