import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';
import { Platform } from 'react-native';
import { encrypt, decrypt } from './encryption';
import type { AppData, BackupMetadata, BackupFile, BackupLog, BackupSettings, ExternalBackupFile } from '@/types';
import * as Sharing from 'expo-sharing';

const BACKUP_PREFIX = 'teacher_app_backup_';
const BACKUP_SETTINGS_KEY = 'teacher_app_backup_settings';
const BACKUP_LOGS_KEY = 'teacher_app_backup_logs';
const APP_VERSION = '1.0.0';
const MAX_LOGS = 100;

export const defaultBackupSettings: BackupSettings = {
  frequency: 'weekly',
  customDays: [6],
  storageLocation: 'local',
  maxVersions: 5,
  autoBackupEnabled: true,
  lastScheduledBackup: null,
};

function generateBackupId(): string {
  return `backup_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
}

function calculateChecksum(data: string): string {
  return CryptoJS.SHA256(data).toString();
}

export function validateBackupIntegrity(backup: BackupFile): boolean {
  try {
    const dataChecksum = calculateChecksum(backup.encryptedData);
    const isChecksumValid = dataChecksum === backup.metadata.dataChecksum;
    const isVersionValid = backup.metadata.version === '1.0';
    const hasRequiredFields = !!(
      backup.metadata.id &&
      backup.metadata.createdAt &&
      backup.encryptedData
    );
    console.log('[Backup] Integrity check:', { isChecksumValid, isVersionValid, hasRequiredFields });
    return isChecksumValid && isVersionValid && hasRequiredFields;
  } catch (error) {
    console.log('[Backup] Integrity validation error:', error);
    return false;
  }
}

export async function createBackup(data: AppData, pin: string): Promise<BackupMetadata | null> {
  try {
    console.log('[Backup] Creating backup...');
    const dataString = JSON.stringify(data);
    const encryptedData = encrypt(dataString, pin);
    const checksum = calculateChecksum(encryptedData);
    
    const metadata: BackupMetadata = {
      id: generateBackupId(),
      version: '1.0',
      createdAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      dataChecksum: checksum,
      size: encryptedData.length,
      isValid: true,
    };

    const backupFile: BackupFile = {
      metadata,
      encryptedData,
    };

    await AsyncStorage.setItem(
      `${BACKUP_PREFIX}${metadata.id}`,
      JSON.stringify(backupFile)
    );

    console.log('[Backup] Backup created successfully:', metadata.id);
    await logBackupAction('backup', 'success', metadata.id, `Backup created: ${metadata.id}`);
    
    return metadata;
  } catch (error) {
    console.log('[Backup] Create backup error:', error);
    await logBackupAction('backup', 'failed', undefined, `Backup creation failed: ${error}`);
    return null;
  }
}

export async function restoreBackup(backupId: string, pin: string): Promise<AppData | null> {
  try {
    console.log('[Backup] Restoring backup:', backupId);
    const stored = await AsyncStorage.getItem(`${BACKUP_PREFIX}${backupId}`);
    
    if (!stored) {
      console.log('[Backup] Backup not found:', backupId);
      await logBackupAction('restore', 'failed', backupId, 'Backup not found');
      return null;
    }

    const backupFile: BackupFile = JSON.parse(stored);
    
    if (!validateBackupIntegrity(backupFile)) {
      console.log('[Backup] Backup integrity check failed');
      await logBackupAction('restore', 'failed', backupId, 'Integrity check failed');
      return null;
    }

    const decrypted = decrypt(backupFile.encryptedData, pin);
    
    if (!decrypted) {
      console.log('[Backup] Decryption failed - wrong PIN');
      await logBackupAction('restore', 'failed', backupId, 'Decryption failed - invalid PIN');
      return null;
    }

    const data: AppData = JSON.parse(decrypted);
    console.log('[Backup] Backup restored successfully');
    await logBackupAction('restore', 'success', backupId, 'Backup restored successfully');
    
    return data;
  } catch (error) {
    console.log('[Backup] Restore backup error:', error);
    await logBackupAction('restore', 'failed', backupId, `Restore failed: ${error}`);
    return null;
  }
}

export async function getAllBackups(): Promise<BackupMetadata[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const backupKeys = keys.filter(key => key.startsWith(BACKUP_PREFIX));
    
    const backups: BackupMetadata[] = [];
    
    for (const key of backupKeys) {
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        const backupFile: BackupFile = JSON.parse(stored);
        backupFile.metadata.isValid = validateBackupIntegrity(backupFile);
        backups.push(backupFile.metadata);
      }
    }

    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    console.log('[Backup] Found', backups.length, 'backups');
    
    return backups;
  } catch (error) {
    console.log('[Backup] Get all backups error:', error);
    return [];
  }
}

export async function deleteBackup(backupId: string): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(`${BACKUP_PREFIX}${backupId}`);
    console.log('[Backup] Deleted backup:', backupId);
    await logBackupAction('delete', 'success', backupId, 'Backup deleted');
    return true;
  } catch (error) {
    console.log('[Backup] Delete backup error:', error);
    await logBackupAction('delete', 'failed', backupId, `Delete failed: ${error}`);
    return false;
  }
}

export async function cleanupOldBackups(maxVersions: number): Promise<void> {
  try {
    const backups = await getAllBackups();
    
    if (backups.length > maxVersions) {
      const toDelete = backups.slice(maxVersions);
      for (const backup of toDelete) {
        await deleteBackup(backup.id);
      }
      console.log('[Backup] Cleaned up', toDelete.length, 'old backups');
    }
  } catch (error) {
    console.log('[Backup] Cleanup error:', error);
  }
}

export async function getLatestValidBackup(): Promise<BackupMetadata | null> {
  const backups = await getAllBackups();
  return backups.find(b => b.isValid) || null;
}

export async function saveBackupSettings(settings: BackupSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(BACKUP_SETTINGS_KEY, JSON.stringify(settings));
    console.log('[Backup] Settings saved');
  } catch (error) {
    console.log('[Backup] Save settings error:', error);
  }
}

export async function loadBackupSettings(): Promise<BackupSettings> {
  try {
    const stored = await AsyncStorage.getItem(BACKUP_SETTINGS_KEY);
    if (stored) {
      return { ...defaultBackupSettings, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.log('[Backup] Load settings error:', error);
  }
  return defaultBackupSettings;
}

export async function logBackupAction(
  action: BackupLog['action'],
  status: BackupLog['status'],
  backupId?: string,
  details: string = ''
): Promise<void> {
  try {
    const log: BackupLog = {
      id: `log_${Date.now().toString(36)}`,
      timestamp: new Date().toISOString(),
      action,
      status,
      backupId,
      details,
    };

    const stored = await AsyncStorage.getItem(BACKUP_LOGS_KEY);
    const logs: BackupLog[] = stored ? JSON.parse(stored) : [];
    
    logs.unshift(log);
    
    if (logs.length > MAX_LOGS) {
      logs.splice(MAX_LOGS);
    }

    await AsyncStorage.setItem(BACKUP_LOGS_KEY, JSON.stringify(logs));
    console.log('[Backup] Action logged:', action, status, details);
  } catch (error) {
    console.log('[Backup] Log action error:', error);
  }
}

export async function getBackupLogs(): Promise<BackupLog[]> {
  try {
    const stored = await AsyncStorage.getItem(BACKUP_LOGS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.log('[Backup] Get logs error:', error);
    return [];
  }
}

export function shouldRunScheduledBackup(settings: BackupSettings): boolean {
  if (!settings.autoBackupEnabled) {
    return false;
  }

  const now = new Date();
  const dayOfWeek = now.getDay();
  const lastBackup = settings.lastScheduledBackup 
    ? new Date(settings.lastScheduledBackup) 
    : null;

  if (lastBackup) {
    const hoursSinceLastBackup = (now.getTime() - lastBackup.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastBackup < 12) {
      return false;
    }
  }

  switch (settings.frequency) {
    case 'daily':
      if (!lastBackup) return true;
      const daysSinceLastBackup = Math.floor(
        (now.getTime() - lastBackup.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysSinceLastBackup >= 1;
    
    case 'weekly':
      if (!lastBackup) return true;
      const daysSinceWeekly = Math.floor(
        (now.getTime() - lastBackup.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceWeekly >= 7) return true;
      if (dayOfWeek === 6 && daysSinceWeekly >= 6) return true;
      return false;
    
    case 'custom':
      if (settings.customDays.includes(dayOfWeek)) {
        if (!lastBackup) return true;
        const daysSince = Math.floor(
          (now.getTime() - lastBackup.getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysSince >= 1;
      }
      return false;
    
    default:
      return false;
  }
}

export function formatBackupDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatBackupSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function exportBackupToString(backupId: string): Promise<string | null> {
  try {
    const stored = await AsyncStorage.getItem(`${BACKUP_PREFIX}${backupId}`);
    return stored;
  } catch (error) {
    console.log('[Backup] Export error:', error);
    return null;
  }
}

export async function importBackupFromString(backupString: string): Promise<BackupMetadata | null> {
  try {
    const backupFile: BackupFile = JSON.parse(backupString);
    
    if (!validateBackupIntegrity(backupFile)) {
      console.log('[Backup] Import failed - invalid backup');
      return null;
    }

    const newId = generateBackupId();
    backupFile.metadata.id = newId;
    
    await AsyncStorage.setItem(
      `${BACKUP_PREFIX}${newId}`,
      JSON.stringify(backupFile)
    );

    console.log('[Backup] Backup imported:', newId);
    await logBackupAction('backup', 'success', newId, 'Backup imported');
    
    return backupFile.metadata;
  } catch (error) {
    console.log('[Backup] Import error:', error);
    return null;
  }
}

export async function scanForExternalBackups(): Promise<ExternalBackupFile[]> {
  if (Platform.OS === 'web') {
    console.log('[Backup] External backup scanning not supported on web');
    return [];
  }

  const foundBackups: ExternalBackupFile[] = [];

  try {
    const { Directory, File, Paths } = await import('expo-file-system');
    
    const scanDirectory = async (directory: InstanceType<typeof Directory>, depth: number = 0): Promise<void> => {
      if (depth > 3) return;
      
      try {
        if (!directory.exists) return;
        
        const contents = directory.list();
        
        for (const item of contents) {
          if (item instanceof File) {
            if (item.name.endsWith('.teacherbackup') || item.name.endsWith('.json')) {
              try {
                const content = await item.text();
                const parsed = JSON.parse(content);
                
                if (parsed.metadata && parsed.encryptedData && parsed.metadata.version === '1.0') {
                  const isValid = validateBackupIntegrity(parsed as BackupFile);
                  foundBackups.push({
                    uri: item.uri,
                    fileName: item.name,
                    metadata: parsed.metadata,
                    isValid,
                    size: item.size,
                  });
                  console.log('[Backup] Found external backup:', item.name);
                }
              } catch {
                // Not a valid backup file, skip
              }
            }
          } else if (item instanceof Directory && depth < 2) {
            await scanDirectory(item, depth + 1);
          }
        }
      } catch (error) {
        console.log('[Backup] Error scanning directory:', error);
      }
    };

    console.log('[Backup] Starting external backup scan...');
    
    const documentDir = new Directory(Paths.document);
    await scanDirectory(documentDir);
    
    const cacheDir = new Directory(Paths.cache);
    await scanDirectory(cacheDir);

    console.log('[Backup] External scan complete, found', foundBackups.length, 'backups');
    
  } catch (error) {
    console.log('[Backup] External scan error:', error);
  }

  return foundBackups;
}

export async function saveBackupToFile(backupId: string): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(`${BACKUP_PREFIX}${backupId}`);
    if (!stored) {
      console.log('[Backup] Backup not found for file export:', backupId);
      return false;
    }

    if (Platform.OS === 'web') {
      try {
        const blob = new Blob([stored], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_${new Date().toISOString().split('T')[0]}.teacherbackup`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('[Backup] Web download triggered');
        return true;
      } catch (webError) {
        console.log('[Backup] Web download error:', webError);
        return false;
      }
    }

    const { File, Paths } = await import('expo-file-system');
    const fileName = `backup_${new Date().toISOString().split('T')[0]}.teacherbackup`;
    const filePath = `${Paths.cache.uri}/${fileName}`;
    const file = new File(filePath);
    file.create();
    await file.write(stored);
    console.log('[Backup] Backup file created at:', filePath);

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(filePath, {
        mimeType: 'application/json',
        dialogTitle: 'Backup speichern',
        UTI: 'public.json',
      });
      console.log('[Backup] Sharing dialog opened');
      return true;
    } else {
      console.log('[Backup] Sharing not available on this device');
      return false;
    }
  } catch (error) {
    console.log('[Backup] Save to file error:', error);
    return false;
  }
}

export async function importExternalBackup(uri: string): Promise<BackupMetadata | null> {
  if (Platform.OS === 'web') {
    console.log('[Backup] External backup import not supported on web');
    return null;
  }

  try {
    const { File } = await import('expo-file-system');
    const file = new File(uri);
    
    if (!file.exists) {
      console.log('[Backup] External backup file not found:', uri);
      return null;
    }

    const content = await file.text();
    return importBackupFromString(content);
  } catch (error) {
    console.log('[Backup] External import error:', error);
    return null;
  }
}
