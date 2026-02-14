import CryptoJS from 'crypto-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type {
  P2PDevice,
  P2PPairedDevice,
  P2PMessage,
  P2PSyncPacket,
  P2PSettings,
  P2PMessageType,
  AppData,
  P2PEphemeralKeyPair,
  P2PQRCodeData,
  P2PPairingSession,
  P2PQRValidationResult,
} from '@/types';

const P2P_SETTINGS_KEY = 'p2p_sync_settings';
const P2P_PAIRED_DEVICES_KEY = 'p2p_paired_devices';
const P2P_VECTOR_CLOCK_KEY = 'p2p_vector_clock';
const DEFAULT_PORT = 8765;

export function generateDeviceId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  const platform = Platform.OS.substring(0, 3);
  return `${platform}-${timestamp}-${random}`;
}

export function generateKeyPair(): { privateKey: string; publicKey: string } {
  const privateKey = CryptoJS.lib.WordArray.random(32).toString();
  const publicKey = CryptoJS.SHA256(privateKey).toString();
  return { privateKey, publicKey };
}

export function deriveSharedSecret(privateKey: string, peerPublicKey: string): string {
  const combined = privateKey + peerPublicKey;
  return CryptoJS.PBKDF2(combined, 'p2p_shared_secret_salt', {
    keySize: 256 / 32,
    iterations: 5000,
  }).toString();
}

export function encryptForPeer(data: string, sharedSecret: string): string {
  const iv = CryptoJS.lib.WordArray.random(16);
  const encrypted = CryptoJS.AES.encrypt(data, CryptoJS.enc.Hex.parse(sharedSecret), {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return iv.toString() + ':' + encrypted.toString();
}

export function decryptFromPeer(encryptedData: string, sharedSecret: string): string | null {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      console.log('[P2P] Invalid encrypted data format');
      return null;
    }
    const iv = CryptoJS.enc.Hex.parse(parts[0]);
    const encrypted = parts[1];
    const decrypted = CryptoJS.AES.decrypt(encrypted, CryptoJS.enc.Hex.parse(sharedSecret), {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    const result = decrypted.toString(CryptoJS.enc.Utf8);
    if (!result) {
      console.log('[P2P] Decryption resulted in empty string');
      return null;
    }
    return result;
  } catch (error) {
    console.log('[P2P] Decryption failed:', error);
    return null;
  }
}

export function signMessage(message: string, privateKey: string): string {
  const hmac = CryptoJS.HmacSHA256(message, privateKey);
  return hmac.toString();
}

export function verifySignature(message: string, signature: string, publicKey: string, senderPrivateKey?: string): boolean {
  if (senderPrivateKey) {
    const expectedSignature = CryptoJS.HmacSHA256(message, senderPrivateKey).toString();
    return signature === expectedSignature;
  }
  return true;
}

export function createMessage(
  type: P2PMessageType,
  senderId: string,
  payload: unknown,
  privateKey: string
): P2PMessage {
  const id = generateDeviceId();
  const timestamp = new Date().toISOString();
  const payloadStr = JSON.stringify(payload);
  const messageContent = `${id}:${type}:${senderId}:${timestamp}:${payloadStr}`;
  const signature = signMessage(messageContent, privateKey);

  return {
    id,
    type,
    senderId,
    timestamp,
    payload: payloadStr,
    signature,
  };
}

export function parseMessage(messageStr: string): P2PMessage | null {
  try {
    return JSON.parse(messageStr) as P2PMessage;
  } catch {
    console.log('[P2P] Failed to parse message');
    return null;
  }
}

export function computeDataHash(data: AppData): string {
  const sortedData = JSON.stringify(data, Object.keys(data).sort());
  return CryptoJS.SHA256(sortedData).toString();
}

export function createSyncPacket(
  data: AppData,
  deviceId: string,
  vectorClock: Record<string, number>,
  sharedSecret: string
): P2PSyncPacket {
  const timestamp = new Date().toISOString();
  const dataHash = computeDataHash(data);
  const encryptedData = encryptForPeer(JSON.stringify(data), sharedSecret);

  return {
    version: 1,
    deviceId,
    timestamp,
    dataHash,
    encryptedData,
    vectorClock: { ...vectorClock },
  };
}

export function parseSyncPacket(packet: P2PSyncPacket, sharedSecret: string): AppData | null {
  try {
    const decrypted = decryptFromPeer(packet.encryptedData, sharedSecret);
    if (!decrypted) {
      return null;
    }
    const data = JSON.parse(decrypted) as AppData;
    const computedHash = computeDataHash(data);
    if (computedHash !== packet.dataHash) {
      console.log('[P2P] Data hash mismatch - data may be corrupted');
      return null;
    }
    return data;
  } catch (error) {
    console.log('[P2P] Failed to parse sync packet:', error);
    return null;
  }
}

export function incrementVectorClock(
  clock: Record<string, number>,
  deviceId: string
): Record<string, number> {
  return {
    ...clock,
    [deviceId]: (clock[deviceId] || 0) + 1,
  };
}

export function mergeVectorClocks(
  clock1: Record<string, number>,
  clock2: Record<string, number>
): Record<string, number> {
  const merged: Record<string, number> = { ...clock1 };
  for (const [key, value] of Object.entries(clock2)) {
    merged[key] = Math.max(merged[key] || 0, value);
  }
  return merged;
}

export function compareVectorClocks(
  clock1: Record<string, number>,
  clock2: Record<string, number>
): 'equal' | 'before' | 'after' | 'concurrent' {
  let isBefore = false;
  let isAfter = false;

  const allKeys = new Set([...Object.keys(clock1), ...Object.keys(clock2)]);

  for (const key of allKeys) {
    const v1 = clock1[key] || 0;
    const v2 = clock2[key] || 0;

    if (v1 < v2) isBefore = true;
    if (v1 > v2) isAfter = true;
  }

  if (!isBefore && !isAfter) return 'equal';
  if (isBefore && !isAfter) return 'before';
  if (!isBefore && isAfter) return 'after';
  return 'concurrent';
}

export function mergeAppData(
  localData: AppData,
  remoteData: AppData,
  localTimestamp: string,
  remoteTimestamp: string,
  strategy: 'newest' | 'merge'
): AppData {
  if (strategy === 'newest') {
    const localTime = new Date(localTimestamp).getTime();
    const remoteTime = new Date(remoteTimestamp).getTime();
    return remoteTime > localTime ? remoteData : localData;
  }

  const mergedClasses = mergeClasses(localData.classes, remoteData.classes);
  const mergedParticipations = mergeParticipations(
    localData.participations,
    remoteData.participations
  );

  return {
    ...localData,
    classes: mergedClasses,
    participations: mergedParticipations,
  };
}

function mergeClasses(local: AppData['classes'], remote: AppData['classes']): AppData['classes'] {
  const merged = new Map<string, AppData['classes'][0]>();

  for (const cls of local) {
    merged.set(cls.id, cls);
  }

  for (const cls of remote) {
    const existing = merged.get(cls.id);
    if (!existing) {
      merged.set(cls.id, cls);
    } else {
      const localTime = new Date(existing.createdAt).getTime();
      const remoteTime = new Date(cls.createdAt).getTime();
      if (remoteTime > localTime) {
        merged.set(cls.id, {
          ...cls,
          students: mergeStudents(existing.students, cls.students),
        });
      } else {
        merged.set(cls.id, {
          ...existing,
          students: mergeStudents(existing.students, cls.students),
        });
      }
    }
  }

  return Array.from(merged.values());
}

function mergeStudents(
  local: AppData['classes'][0]['students'],
  remote: AppData['classes'][0]['students']
): AppData['classes'][0]['students'] {
  const merged = new Map<string, AppData['classes'][0]['students'][0]>();

  for (const student of local) {
    merged.set(student.id, student);
  }

  for (const student of remote) {
    if (!merged.has(student.id)) {
      merged.set(student.id, student);
    }
  }

  return Array.from(merged.values());
}

function mergeParticipations(
  local: AppData['participations'],
  remote: AppData['participations']
): AppData['participations'] {
  const merged = new Map<string, AppData['participations'][0]>();

  for (const p of local) {
    merged.set(p.id, p);
  }

  for (const p of remote) {
    if (!merged.has(p.id)) {
      merged.set(p.id, p);
    }
  }

  return Array.from(merged.values());
}

export async function loadP2PSettings(): Promise<P2PSettings> {
  try {
    const stored = await AsyncStorage.getItem(P2P_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as P2PSettings;
      if (parsed && parsed.deviceId && parsed.privateKey && parsed.publicKey) {
        console.log('[P2P] Settings loaded from storage:', parsed.deviceId);
        return parsed;
      }
      console.log('[P2P] Stored settings incomplete, creating new ones');
    }
  } catch (error) {
    console.log('[P2P] Failed to load settings from storage:', error);
  }

  try {
    const { privateKey, publicKey } = generateKeyPair();
    const deviceId = generateDeviceId();
    const defaultSettings: P2PSettings = {
      enabled: false,
      deviceName: `Mein Gerät`,
      deviceId,
      privateKey,
      publicKey,
      autoSync: true,
      syncOnConnect: true,
      conflictResolution: 'newest',
      discoveryPort: DEFAULT_PORT,
    };

    await saveP2PSettings(defaultSettings);
    console.log('[P2P] Created new default settings:', deviceId);
    return defaultSettings;
  } catch (error) {
    console.log('[P2P] Failed to create default settings:', error);
    const fallbackId = `dev-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
    const fallbackKey = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    const fallbackSettings: P2PSettings = {
      enabled: false,
      deviceName: 'Mein Gerät',
      deviceId: fallbackId,
      privateKey: fallbackKey,
      publicKey: fallbackKey + '_pub',
      autoSync: true,
      syncOnConnect: true,
      conflictResolution: 'newest',
      discoveryPort: DEFAULT_PORT,
    };
    try {
      await saveP2PSettings(fallbackSettings);
    } catch (saveErr) {
      console.log('[P2P] Could not save fallback settings', saveErr);
    }
    return fallbackSettings;
  }
}

export async function saveP2PSettings(settings: P2PSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(P2P_SETTINGS_KEY, JSON.stringify(settings));
    console.log('[P2P] Settings saved');
  } catch (error) {
    console.log('[P2P] Failed to save settings:', error);
  }
}

export async function loadPairedDevices(): Promise<P2PPairedDevice[]> {
  try {
    const stored = await AsyncStorage.getItem(P2P_PAIRED_DEVICES_KEY);
    if (stored) {
      return JSON.parse(stored) as P2PPairedDevice[];
    }
  } catch (error) {
    console.log('[P2P] Failed to load paired devices:', error);
  }
  return [];
}

export async function savePairedDevices(devices: P2PPairedDevice[]): Promise<void> {
  try {
    await AsyncStorage.setItem(P2P_PAIRED_DEVICES_KEY, JSON.stringify(devices));
    console.log('[P2P] Paired devices saved');
  } catch (error) {
    console.log('[P2P] Failed to save paired devices:', error);
  }
}

export async function loadVectorClock(): Promise<Record<string, number>> {
  try {
    const stored = await AsyncStorage.getItem(P2P_VECTOR_CLOCK_KEY);
    if (stored) {
      return JSON.parse(stored) as Record<string, number>;
    }
  } catch (error) {
    console.log('[P2P] Failed to load vector clock:', error);
  }
  return {};
}

export async function saveVectorClock(clock: Record<string, number>): Promise<void> {
  try {
    await AsyncStorage.setItem(P2P_VECTOR_CLOCK_KEY, JSON.stringify(clock));
  } catch (error) {
    console.log('[P2P] Failed to save vector clock:', error);
  }
}

export function generatePairingCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function formatDeviceName(device: P2PDevice): string {
  return device.name || `Gerät ${device.id.substring(0, 8)}`;
}

export function formatLastSeen(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) {
    return 'Gerade eben';
  } else if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `Vor ${minutes} Min.`;
  } else if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `Vor ${hours} Std.`;
  } else {
    return date.toLocaleDateString('de-DE');
  }
}

export function createDiscoveryPayload(settings: P2PSettings): object {
  return {
    deviceId: settings.deviceId,
    deviceName: settings.deviceName,
    publicKey: settings.publicKey,
    port: settings.discoveryPort,
  };
}

export function createPairRequestPayload(
  settings: P2PSettings,
  pairingCode: string
): object {
  return {
    deviceId: settings.deviceId,
    deviceName: settings.deviceName,
    publicKey: settings.publicKey,
    pairingCode,
  };
}

export function validatePairingCode(code: string): boolean {
  return /^[A-Z0-9]{6}$/.test(code.toUpperCase());
}

export async function addPairedDevice(
  device: P2PDevice,
  sharedSecret: string
): Promise<P2PPairedDevice> {
  const pairedDevice: P2PPairedDevice = {
    id: device.id,
    name: device.name,
    publicKey: device.publicKey,
    sharedSecret,
    pairedAt: new Date().toISOString(),
    lastSyncAt: null,
  };

  const devices = await loadPairedDevices();
  const existingIndex = devices.findIndex((d) => d.id === device.id);

  if (existingIndex >= 0) {
    devices[existingIndex] = pairedDevice;
  } else {
    devices.push(pairedDevice);
  }

  await savePairedDevices(devices);
  return pairedDevice;
}

export async function removePairedDevice(deviceId: string): Promise<void> {
  const devices = await loadPairedDevices();
  const filtered = devices.filter((d) => d.id !== deviceId);
  await savePairedDevices(filtered);
}

export async function updateLastSync(deviceId: string): Promise<void> {
  const devices = await loadPairedDevices();
  const device = devices.find((d) => d.id === deviceId);
  if (device) {
    device.lastSyncAt = new Date().toISOString();
    await savePairedDevices(devices);
  }
}

export function logP2PAction(action: string, details: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[P2P ${timestamp}] ${action}: ${details}`);
}

const QR_EXPIRATION_MINUTES = 5;
const APP_VERSION = '1.0.0';

export function generateEphemeralKeyPair(): P2PEphemeralKeyPair {
  const privateKey = CryptoJS.lib.WordArray.random(32).toString();
  const publicKey = CryptoJS.SHA256(privateKey + Date.now().toString()).toString();
  
  logP2PAction('Ephemeral Keys', 'Generated new ephemeral key pair');
  
  return {
    privateKey,
    publicKey,
    createdAt: new Date().toISOString(),
  };
}

export function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = CryptoJS.lib.WordArray.random(8).toString();
  return `sess-${timestamp}-${random}`;
}

export function getLocalIPAddress(): string {
  if (Platform.OS === 'web') {
    return window.location.hostname || '127.0.0.1';
  }
  return '0.0.0.0';
}

export function computeQRChecksum(data: Omit<P2PQRCodeData, 'checksum'>): string {
  const content = `${data.sessionId}:${data.ipAddress}:${data.port}:${data.expiresAt}:${data.publicKey}:${data.appVersion}:${data.deviceId}`;
  return CryptoJS.SHA256(content).toString().substring(0, 16);
}

export function generateQRCodeData(
  settings: P2PSettings,
  ephemeralKeys: P2PEphemeralKeyPair,
  port: number = DEFAULT_PORT
): P2PQRCodeData {
  const sessionId = generateSessionId();
  const ipAddress = getLocalIPAddress();
  const expiresAt = new Date(Date.now() + QR_EXPIRATION_MINUTES * 60 * 1000).toISOString();
  
  const dataWithoutChecksum = {
    sessionId,
    ipAddress,
    port,
    expiresAt,
    publicKey: ephemeralKeys.publicKey,
    appVersion: APP_VERSION,
    deviceId: settings.deviceId,
    deviceName: settings.deviceName,
  };
  
  const checksum = computeQRChecksum(dataWithoutChecksum);
  
  const qrData: P2PQRCodeData = {
    ...dataWithoutChecksum,
    checksum,
  };
  
  logP2PAction('QR Generate', `Session ${sessionId}, expires at ${expiresAt}`);
  
  return qrData;
}

export function createPairingSession(
  settings: P2PSettings,
  port: number = DEFAULT_PORT
): P2PPairingSession {
  const ephemeralKeys = generateEphemeralKeyPair();
  const qrData = generateQRCodeData(settings, ephemeralKeys, port);
  
  const session: P2PPairingSession = {
    sessionId: qrData.sessionId,
    ephemeralKeys,
    qrData,
    createdAt: new Date().toISOString(),
    expiresAt: qrData.expiresAt,
    status: 'pending',
    peerPublicKey: null,
    peerDeviceId: null,
    peerDeviceName: null,
  };
  
  logP2PAction('Pairing Session', `Created session ${session.sessionId}`);
  
  return session;
}

export function encodeQRData(qrData: P2PQRCodeData): string {
  const jsonStr = JSON.stringify(qrData);
  const base64 = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(jsonStr));
  return `P2P:${base64}`;
}

export function decodeQRData(encodedData: string): P2PQRCodeData | null {
  try {
    if (!encodedData.startsWith('P2P:')) {
      console.log('[P2P] Invalid QR code format - missing P2P prefix');
      return null;
    }
    
    const base64 = encodedData.substring(4);
    const jsonStr = CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(base64));
    const qrData = JSON.parse(jsonStr) as P2PQRCodeData;
    
    return qrData;
  } catch (error) {
    console.log('[P2P] Failed to decode QR data:', error);
    return null;
  }
}

export function validateQRCodeData(encodedData: string): P2PQRValidationResult {
  const qrData = decodeQRData(encodedData);
  
  if (!qrData) {
    return {
      isValid: false,
      error: 'Ungültiger QR-Code. Bitte scannen Sie einen gültigen Kopplungscode.',
    };
  }
  
  if (!qrData.sessionId || !qrData.publicKey || !qrData.deviceId) {
    return {
      isValid: false,
      error: 'Unvollständige QR-Daten. Bitte generieren Sie einen neuen Code.',
    };
  }
  
  const dataWithoutChecksum = {
    sessionId: qrData.sessionId,
    ipAddress: qrData.ipAddress,
    port: qrData.port,
    expiresAt: qrData.expiresAt,
    publicKey: qrData.publicKey,
    appVersion: qrData.appVersion,
    deviceId: qrData.deviceId,
    deviceName: qrData.deviceName,
  };
  const expectedChecksum = computeQRChecksum(dataWithoutChecksum);
  
  if (qrData.checksum !== expectedChecksum) {
    return {
      isValid: false,
      error: 'QR-Code-Integrität konnte nicht verifiziert werden.',
    };
  }
  
  const expiresAt = new Date(qrData.expiresAt).getTime();
  const now = Date.now();
  
  if (now > expiresAt) {
    return {
      isValid: false,
      error: 'QR-Code ist abgelaufen. Bitte generieren Sie einen neuen Code.',
    };
  }
  
  const [major, minor] = qrData.appVersion.split('.').map(Number);
  const [currentMajor, currentMinor] = APP_VERSION.split('.').map(Number);
  
  if (major !== currentMajor) {
    return {
      isValid: false,
      error: `App-Version inkompatibel. Erwartet: ${currentMajor}.x, Erhalten: ${major}.x`,
    };
  }
  
  if (minor > currentMinor + 1 || currentMinor > minor + 1) {
    logP2PAction('QR Validate', `Version mismatch warning: ${qrData.appVersion} vs ${APP_VERSION}`);
  }
  
  logP2PAction('QR Validate', `Valid QR code for session ${qrData.sessionId}`);
  
  return {
    isValid: true,
    data: qrData,
  };
}

export function createPeerConnectionPayload(
  settings: P2PSettings,
  sessionId: string
): object {
  const ephemeralKeys = generateEphemeralKeyPair();
  
  return {
    type: 'peer_connect',
    sessionId,
    deviceId: settings.deviceId,
    deviceName: settings.deviceName,
    ephemeralPublicKey: ephemeralKeys.publicKey,
    timestamp: new Date().toISOString(),
  };
}

export function deriveSessionSharedSecret(
  localEphemeralPrivateKey: string,
  peerEphemeralPublicKey: string
): string {
  const combined = localEphemeralPrivateKey + peerEphemeralPublicKey;
  return CryptoJS.PBKDF2(combined, 'p2p_ephemeral_session_salt', {
    keySize: 256 / 32,
    iterations: 5000,
  }).toString();
}

export function isPairingSessionExpired(session: P2PPairingSession): boolean {
  const expiresAt = new Date(session.expiresAt).getTime();
  return Date.now() > expiresAt;
}

export function getRemainingSessionTime(session: P2PPairingSession): number {
  const expiresAt = new Date(session.expiresAt).getTime();
  const remaining = expiresAt - Date.now();
  return Math.max(0, Math.floor(remaining / 1000));
}
