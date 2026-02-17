export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  note: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  students: Student[];
  createdAt: string;
}

export type ParticipationRating = '+' | 'o' | '-';

export type PositiveReason = 'good_participation' | 'group_work' | 'helpful';
export type NegativeReason = 'unfocused' | 'disruptive' | 'unprepared';
export type ParticipationReason = PositiveReason | NegativeReason | null;

export interface ParticipationEntry {
  id: string;
  studentId: string;
  classId: string;
  subject: string;
  rating: ParticipationRating;
  reason: ParticipationReason;
  date: string;
  sessionId: string;
}

export type HomeworkStatus = 'done' | 'late' | 'missing';

export interface HomeworkRecord {
  studentId: string;
  status: HomeworkStatus;
}

export interface LessonSession {
  id: string;
  classId: string;
  subject: string;
  startedAt: string;
  ratings: Record<string, ParticipationRating>;
  reasons: Record<string, ParticipationReason>;
  homework: Record<string, HomeworkStatus>;
}

export interface TeacherProfile {
  name: string;
  school: string;
  subjects: string[];
}

export interface AppData {
  profile: TeacherProfile;
  classes: SchoolClass[];
  participations: ParticipationEntry[];
  activeSession: LessonSession | null;
  onboardingComplete: boolean;
  pinHash: string;
}

export type BackupFrequency = 'daily' | 'weekly' | 'custom';
export type BackupStorageLocation = 'local' | 'external';

export interface BackupSettings {
  frequency: BackupFrequency;
  customDays: number[];
  storageLocation: BackupStorageLocation;
  maxVersions: number;
  autoBackupEnabled: boolean;
  lastScheduledBackup: string | null;
}

export interface BackupMetadata {
  id: string;
  version: string;
  createdAt: string;
  appVersion: string;
  dataChecksum: string;
  size: number;
  isValid: boolean;
}

export interface BackupFile {
  metadata: BackupMetadata;
  encryptedData: string;
}

export interface BackupLog {
  id: string;
  timestamp: string;
  action: 'backup' | 'restore' | 'delete' | 'validate';
  status: 'success' | 'failed';
  backupId?: string;
  details: string;
}

export interface BackupState {
  settings: BackupSettings;
  backups: BackupMetadata[];
  logs: BackupLog[];
  lastBackupDate: string | null;
  isBackingUp: boolean;
  isRestoring: boolean;
}

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export interface ExportField {
  key: string;
  label: string;
  enabled: boolean;
}

export interface ExportDateRange {
  startDate: string | null;
  endDate: string | null;
}

export interface ExportOptions {
  format: ExportFormat;
  fields: ExportField[];
  dateRange: ExportDateRange;
  subjectFilter: string | null;
  classFilter: string | null;
  encrypted: boolean;
  password: string;
}

export interface ExportableStudentStats {
  studentId: string;
  firstName: string;
  lastName: string;
  className: string;
  subject: string;
  positive: number;
  neutral: number;
  negative: number;
  total: number;
  trend: number;
  date: string;
}

export type P2PSyncStatus = 'idle' | 'discovering' | 'connecting' | 'pairing' | 'syncing' | 'connected' | 'error';
export type P2PRole = 'host' | 'client';
export type P2PMessageType = 'discovery' | 'pair_request' | 'pair_accept' | 'pair_reject' | 'sync_request' | 'sync_data' | 'sync_ack' | 'heartbeat' | 'disconnect' | 'first_sync_request' | 'first_sync_choice' | 'first_sync_data' | 'first_sync_ack';

export type FirstSyncChoice = 'local' | 'remote';

export interface FirstSyncRequest {
  deviceId: string;
  deviceName: string;
  dataStats: {
    classesCount: number;
    studentsCount: number;
    participationsCount: number;
    lastModified: string | null;
  };
}

export interface FirstSyncState {
  isFirstSync: boolean;
  pendingRequest: FirstSyncRequest | null;
  awaitingChoice: boolean;
  selectedChoice: FirstSyncChoice | null;
  remoteDataStats: FirstSyncRequest['dataStats'] | null;
}

export interface P2PDevice {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  publicKey: string;
  lastSeen: string;
  isPaired: boolean;
  isOnline: boolean;
}

export interface P2PPairedDevice {
  id: string;
  name: string;
  publicKey: string;
  sharedSecret: string;
  pairedAt: string;
  lastSyncAt: string | null;
}

export interface P2PMessage {
  id: string;
  type: P2PMessageType;
  senderId: string;
  timestamp: string;
  payload: string;
  signature: string;
}

export interface P2PSyncPacket {
  version: number;
  deviceId: string;
  timestamp: string;
  dataHash: string;
  encryptedData: string;
  vectorClock: Record<string, number>;
}

export interface P2PSettings {
  enabled: boolean;
  deviceName: string;
  deviceId: string;
  privateKey: string;
  publicKey: string;
  autoSync: boolean;
  syncOnConnect: boolean;
  conflictResolution: 'newest' | 'manual' | 'merge';
  discoveryPort: number;
}

export interface P2PSyncState {
  status: P2PSyncStatus;
  role: P2PRole | null;
  currentPeer: P2PDevice | null;
  pairedDevices: P2PPairedDevice[];
  discoveredDevices: P2PDevice[];
  vectorClock: Record<string, number>;
  lastSyncTimestamp: string | null;
  pendingChanges: number;
  error: string | null;
  firstSync: FirstSyncState;
}

export interface P2PConflict {
  id: string;
  field: string;
  localValue: unknown;
  remoteValue: unknown;
  localTimestamp: string;
  remoteTimestamp: string;
  resolved: boolean;
  resolution: 'local' | 'remote' | null;
}

export interface P2PEphemeralKeyPair {
  privateKey: string;
  publicKey: string;
  createdAt: string;
}

export interface P2PQRCodeData {
  sessionId: string;
  ipAddress: string;
  port: number;
  expiresAt: string;
  publicKey: string;
  appVersion: string;
  deviceId: string;
  deviceName: string;
  checksum: string;
}

export interface P2PPairingSession {
  sessionId: string;
  ephemeralKeys: P2PEphemeralKeyPair;
  qrData: P2PQRCodeData;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'connected' | 'completed' | 'expired' | 'failed';
  peerPublicKey: string | null;
  peerDeviceId: string | null;
  peerDeviceName: string | null;
}

export interface P2PQRValidationResult {
  isValid: boolean;
  error?: string;
  data?: P2PQRCodeData;
}

export interface ExternalBackupFile {
  uri: string;
  fileName: string;
  metadata: BackupMetadata;
  isValid: boolean;
  size: number;
}

export interface ScheduleTimeSettings {
  lessonStartTime: string;
  lessonDuration: number;
  breakAfterPeriods: number[];
  breakDurations: Record<number, number>;
  maxPeriods: number;
}

export interface ScheduleEntry {
  id: string;
  dayIndex: number;
  periodStart: number;
  periodEnd: number;
  className: string;
  subject: string;
  room: string;
  color: string;
}

export interface OneTimeEvent {
  id: string;
  title: string;
  date: string;
  isAllDay: boolean;
  allDayStartTime?: string;
  allDayEndTime?: string;
  periods: number[];
  room: string;
  color: string;
  notes: string;
}

export interface SubstitutionEntry {
  id: string;
  date: string;
  periods: number[];
  subject?: string;
  className?: string;
  room: string;
  color: string;
  hiddenRegularEntries: string[];
}
