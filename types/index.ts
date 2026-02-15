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

export interface ParticipationEntry {
  id: string;
  studentId: string;
  classId: string;
  subject: string;
  rating: ParticipationRating;
  date: string;
  sessionId: string;
}

export interface LessonSession {
  id: string;
  classId: string;
  subject: string;
  startedAt: string;
  ratings: Record<string, ParticipationRating>;
}

export interface TeacherProfile {
  name: string;
  school: string;
  subjects: string[];
}

export type HomeworkStatus = 'done' | 'forgotten' | 'late';

export interface HomeworkEntry {
  id: string;
  studentId: string;
  classId: string;
  subject: string;
  date: string;
  status: HomeworkStatus;
}

export type BehaviorType = 'praise' | 'reprimand';

export interface BehaviorEntry {
  id: string;
  studentId: string;
  classId: string;
  type: BehaviorType;
  note: string;
  date: string;
}

export interface PresentationCriteria {
  content: number;
  language: number;
  media: number;
  timing: number;
  presence: number;
}

export interface PresentationWeights {
  content: number;
  language: number;
  media: number;
  timing: number;
  presence: number;
}

export interface PresentationGrade {
  id: string;
  studentId: string;
  classId: string;
  subject: string;
  criteria: PresentationCriteria;
  weights: PresentationWeights;
  calculatedGrade: number;
  date: string;
  topic: string;
}

export interface ResourceLink {
  id: string;
  classId: string;
  subject: string;
  url: string;
  title: string;
  createdAt: string;
}

export interface PhaseConfig {
  name: string;
  durationMinutes: number;
}

export interface LessonTimerConfig {
  phases: PhaseConfig[];
  enabled: boolean;
}

export interface StudentCallCount {
  studentId: string;
  classId: string;
  count: number;
}

export interface AppData {
  profile: TeacherProfile;
  classes: SchoolClass[];
  participations: ParticipationEntry[];
  homeworkEntries: HomeworkEntry[];
  behaviorEntries: BehaviorEntry[];
  presentationGrades: PresentationGrade[];
  resources: ResourceLink[];
  callCounts: StudentCallCount[];
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
