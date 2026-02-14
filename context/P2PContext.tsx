import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import type {
  P2PSettings,
  P2PSyncState,
  P2PDevice,
  P2PSyncStatus,
  P2PMessage,
  P2PSyncPacket,
  AppData,
  P2PPairingSession,
  P2PQRCodeData,
  P2PQRValidationResult,
  FirstSyncChoice,
  FirstSyncRequest,
} from '@/types';
import {
  loadP2PSettings,
  saveP2PSettings,
  loadPairedDevices,
  loadVectorClock,
  saveVectorClock,
  generatePairingCode,
  deriveSharedSecret,
  createMessage,
  parseMessage,
  createSyncPacket,
  parseSyncPacket,
  incrementVectorClock,
  mergeVectorClocks,
  compareVectorClocks,
  mergeAppData,
  addPairedDevice,
  removePairedDevice,
  updateLastSync,
  logP2PAction,
  createPairingSession,
  encodeQRData,
  validateQRCodeData,
  deriveSessionSharedSecret,
  isPairingSessionExpired,
  getRemainingSessionTime,
  generateEphemeralKeyPair,
} from '@/utils/p2p';

const HEARTBEAT_INTERVAL = 5000;
const CONNECTION_TIMEOUT = 15000;

export const [P2PProvider, useP2P] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<P2PSettings | null>(null);
  const settingsRef = useRef<P2PSettings | null>(null);
  const [syncState, setSyncState] = useState<P2PSyncState>({
    status: 'idle',
    role: null,
    currentPeer: null,
    pairedDevices: [],
    discoveredDevices: [],
    vectorClock: {},
    lastSyncTimestamp: null,
    pendingChanges: 0,
    error: null,
    firstSync: {
      isFirstSync: false,
      pendingRequest: null,
      awaitingChoice: false,
      selectedChoice: null,
      remoteDataStats: null,
    },
  });
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pendingPairRequest, setPendingPairRequest] = useState<P2PDevice | null>(null);
  const [pairingSession, setPairingSession] = useState<P2PPairingSession | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [sessionExpiryTimer, setSessionExpiryTimer] = useState<number>(0);

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentAppDataRef = useRef<AppData | null>(null);
  const sessionExpiryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncStateRef = useRef(syncState);
  const pendingPairRequestRef = useRef<P2PDevice | null>(null);

  useEffect(() => {
    syncStateRef.current = syncState;
  }, [syncState]);

  useEffect(() => {
    pendingPairRequestRef.current = pendingPairRequest;
  }, [pendingPairRequest]);

  const settingsQuery = useQuery({
    queryKey: ['p2pSettings'],
    queryFn: loadP2PSettings,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const pairedDevicesQuery = useQuery({
    queryKey: ['p2pPairedDevices'],
    queryFn: loadPairedDevices,
  });

  const vectorClockQuery = useQuery({
    queryKey: ['p2pVectorClock'],
    queryFn: loadVectorClock,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setSettings(settingsQuery.data);
      settingsRef.current = settingsQuery.data;
      console.log('[P2P] Settings loaded via query:', settingsQuery.data.deviceId);
    }
  }, [settingsQuery.data]);

  useEffect(() => {
    if (pairedDevicesQuery.data) {
      setSyncState((prev) => ({
        ...prev,
        pairedDevices: pairedDevicesQuery.data || [],
      }));
    }
  }, [pairedDevicesQuery.data]);

  useEffect(() => {
    if (vectorClockQuery.data) {
      setSyncState((prev) => ({
        ...prev,
        vectorClock: vectorClockQuery.data || {},
      }));
    }
  }, [vectorClockQuery.data]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (newSettings: Partial<P2PSettings>) => {
      const current = settingsRef.current;
      if (!current) return null;
      const updated = { ...current, ...newSettings };
      await saveP2PSettings(updated);
      return updated;
    },
    onSuccess: (updated) => {
      if (updated) {
        setSettings(updated);
        settingsRef.current = updated;
        queryClient.setQueryData(['p2pSettings'], updated);
      }
    },
  });

  const setStatus = useCallback((status: P2PSyncStatus, error?: string) => {
    setSyncState((prev) => ({
      ...prev,
      status,
      error: error || null,
    }));
    logP2PAction('Status', `${status}${error ? ` - ${error}` : ''}`);
  }, []);

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    if (sessionExpiryIntervalRef.current) {
      clearInterval(sessionExpiryIntervalRef.current);
      sessionExpiryIntervalRef.current = null;
    }
  }, []);

  const sendMessage = useCallback(
    (message: P2PMessage) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify(message));
          logP2PAction('Send', `${message.type} to peer`);
          return true;
        } catch (error) {
          logP2PAction('Send', `Failed to send ${message.type}: ${error}`);
          return false;
        }
      }
      logP2PAction('Send', `Cannot send ${message.type} - WebSocket not open`);
      return false;
    },
    []
  );

  const ensureSettings = useCallback(async (): Promise<P2PSettings> => {
    if (settingsRef.current) {
      console.log('[P2P] Settings available from ref:', settingsRef.current.deviceId);
      return settingsRef.current;
    }

    console.log('[P2P] Settings not in ref, loading from storage...');
    const loaded = await loadP2PSettings();
    settingsRef.current = loaded;
    setSettings(loaded);
    queryClient.setQueryData(['p2pSettings'], loaded);
    console.log('[P2P] Settings loaded successfully:', loaded.deviceId);
    return loaded;
  }, [queryClient]);

  const handleMessage = useCallback(
    async (messageStr: string) => {
      const message = parseMessage(messageStr);
      if (!message) return;

      const s = settingsRef.current;
      const currentSyncState = syncStateRef.current;
      const currentPendingPairRequest = pendingPairRequestRef.current;

      logP2PAction('Receive', `${message.type} from ${message.senderId}`);

      try {
      switch (message.type) {
        case 'pair_request': {
          const payload = JSON.parse(message.payload);
          const device: P2PDevice = {
            id: payload.deviceId,
            name: payload.deviceName,
            ipAddress: '',
            port: 0,
            publicKey: payload.publicKey,
            lastSeen: new Date().toISOString(),
            isPaired: false,
            isOnline: true,
          };
          setPendingPairRequest(device);
          setStatus('pairing');
          break;
        }

        case 'pair_accept': {
          const payload = JSON.parse(message.payload);
          if (s && currentPendingPairRequest) {
            const sharedSecret = deriveSharedSecret(s.privateKey, payload.publicKey);
            const paired = await addPairedDevice(
              { ...currentPendingPairRequest, publicKey: payload.publicKey },
              sharedSecret
            );
            setSyncState((prev) => ({
              ...prev,
              pairedDevices: [...prev.pairedDevices.filter((d) => d.id !== paired.id), paired],
            }));
            queryClient.invalidateQueries({ queryKey: ['p2pPairedDevices'] });
            setStatus('connected');
            setPendingPairRequest(null);
            setPairingCode(null);

            if (Platform.OS !== 'web') {
              Alert.alert('Gekoppelt', `Erfolgreich mit ${payload.deviceName} gekoppelt.`);
            }
          }
          break;
        }

        case 'pair_reject': {
          setStatus('idle');
          setPendingPairRequest(null);
          setPairingCode(null);
          if (Platform.OS !== 'web') {
            Alert.alert('Abgelehnt', 'Die Kopplungsanfrage wurde abgelehnt.');
          }
          break;
        }

        case 'sync_request': {
          if (s && currentAppDataRef.current) {
            const pairedDevice = currentSyncState.pairedDevices.find(
              (d) => d.id === message.senderId
            );
            if (pairedDevice) {
              const packet = createSyncPacket(
                currentAppDataRef.current,
                s.deviceId,
                currentSyncState.vectorClock,
                pairedDevice.sharedSecret
              );
              const response = createMessage(
                'sync_data',
                s.deviceId,
                packet,
                s.privateKey
              );
              sendMessage(response);
            }
          }
          break;
        }

        case 'sync_data': {
          const packet = JSON.parse(message.payload) as P2PSyncPacket;
          const pairedDevice = currentSyncState.pairedDevices.find(
            (d) => d.id === message.senderId
          );

          if (pairedDevice && currentAppDataRef.current && s) {
            const remoteData = parseSyncPacket(packet, pairedDevice.sharedSecret);
            if (remoteData) {
              const comparison = compareVectorClocks(
                currentSyncState.vectorClock,
                packet.vectorClock
              );

              let mergedData: AppData;
              if (comparison === 'before') {
                mergedData = remoteData;
              } else if (comparison === 'after') {
                mergedData = currentAppDataRef.current;
              } else {
                mergedData = mergeAppData(
                  currentAppDataRef.current,
                  remoteData,
                  currentSyncState.lastSyncTimestamp || new Date().toISOString(),
                  packet.timestamp,
                  s.conflictResolution === 'manual' ? 'merge' : s.conflictResolution
                );
              }

              const newClock = mergeVectorClocks(currentSyncState.vectorClock, packet.vectorClock);
              const updatedClock = incrementVectorClock(newClock, s.deviceId);

              await saveVectorClock(updatedClock);
              await updateLastSync(pairedDevice.id);

              setSyncState((prev) => ({
                ...prev,
                vectorClock: updatedClock,
                lastSyncTimestamp: new Date().toISOString(),
              }));

              queryClient.setQueryData(['syncedData'], mergedData);
              queryClient.invalidateQueries({ queryKey: ['p2pPairedDevices'] });

              const ack = createMessage(
                'sync_ack',
                s.deviceId,
                { success: true, timestamp: new Date().toISOString() },
                s.privateKey
              );
              sendMessage(ack);
              setStatus('connected');

              logP2PAction('Sync', 'Data synchronized successfully');
            }
          }
          break;
        }

        case 'sync_ack': {
          setStatus('connected');
          logP2PAction('Sync', 'Sync acknowledged by peer');
          break;
        }

        case 'first_sync_request': {
          const payload = JSON.parse(message.payload) as FirstSyncRequest;
          logP2PAction('First Sync', `Received first sync request from ${payload.deviceName}`);
          
          setSyncState((prev) => ({
            ...prev,
            firstSync: {
              ...prev.firstSync,
              isFirstSync: true,
              pendingRequest: payload,
              awaitingChoice: true,
              remoteDataStats: payload.dataStats,
            },
          }));
          break;
        }

        case 'first_sync_choice': {
          const payload = JSON.parse(message.payload) as { choice: FirstSyncChoice };
          logP2PAction('First Sync', `Peer chose: ${payload.choice}`);
          
          if (payload.choice === 'remote' && s && currentAppDataRef.current) {
            const pairedDevice = currentSyncState.pairedDevices.find(
              (d) => d.id === message.senderId
            );
            if (pairedDevice) {
              const newClock = incrementVectorClock({}, s.deviceId);
              const packet = createSyncPacket(
                currentAppDataRef.current,
                s.deviceId,
                newClock,
                pairedDevice.sharedSecret
              );
              const response = createMessage(
                'first_sync_data',
                s.deviceId,
                { packet, isFullReplace: true },
                s.privateKey
              );
              sendMessage(response);
              logP2PAction('First Sync', 'Sent full dataset to peer');
            }
          } else if (payload.choice === 'local' && s) {
            logP2PAction('First Sync', 'Peer will keep their data, requesting their data');
            const requestMsg = createMessage(
              'sync_request',
              s.deviceId,
              { timestamp: new Date().toISOString(), isFirstSync: true },
              s.privateKey
            );
            sendMessage(requestMsg);
          }
          
          setSyncState((prev) => ({
            ...prev,
            firstSync: {
              ...prev.firstSync,
              awaitingChoice: false,
              selectedChoice: payload.choice === 'local' ? 'remote' : 'local',
            },
          }));
          break;
        }

        case 'first_sync_data': {
          const payload = JSON.parse(message.payload) as { packet: P2PSyncPacket; isFullReplace: boolean };
          const pairedDevice = currentSyncState.pairedDevices.find(
            (d) => d.id === message.senderId
          );

          if (pairedDevice && s) {
            const remoteData = parseSyncPacket(payload.packet, pairedDevice.sharedSecret);
            if (remoteData && payload.isFullReplace) {
              logP2PAction('First Sync', 'Received full dataset, replacing local data');
              
              const newClock = { ...payload.packet.vectorClock };
              newClock[s.deviceId] = (newClock[s.deviceId] || 0) + 1;
              
              await saveVectorClock(newClock);
              await updateLastSync(pairedDevice.id);

              setSyncState((prev) => ({
                ...prev,
                vectorClock: newClock,
                lastSyncTimestamp: new Date().toISOString(),
                firstSync: {
                  isFirstSync: false,
                  pendingRequest: null,
                  awaitingChoice: false,
                  selectedChoice: null,
                  remoteDataStats: null,
                },
              }));

              queryClient.setQueryData(['syncedData'], remoteData);
              queryClient.setQueryData(['firstSyncComplete'], { data: remoteData, replace: true });
              queryClient.invalidateQueries({ queryKey: ['p2pPairedDevices'] });

              const ack = createMessage(
                'first_sync_ack',
                s.deviceId,
                { success: true, timestamp: new Date().toISOString() },
                s.privateKey
              );
              sendMessage(ack);
              setStatus('connected');
              
              if (Platform.OS !== 'web') {
                Alert.alert('Synchronisation abgeschlossen', 'Die Daten wurden erfolgreich übernommen.');
              }
            }
          }
          break;
        }

        case 'first_sync_ack': {
          logP2PAction('First Sync', 'First sync acknowledged by peer');
          setSyncState((prev) => ({
            ...prev,
            lastSyncTimestamp: new Date().toISOString(),
            firstSync: {
              isFirstSync: false,
              pendingRequest: null,
              awaitingChoice: false,
              selectedChoice: null,
              remoteDataStats: null,
            },
          }));
          setStatus('connected');
          
          if (Platform.OS !== 'web') {
            Alert.alert('Synchronisation abgeschlossen', 'Die Daten wurden erfolgreich synchronisiert.');
          }
          break;
        }

        case 'heartbeat': {
          break;
        }

        case 'disconnect': {
          cleanup();
          setStatus('idle');
          setSyncState((prev) => ({ ...prev, currentPeer: null, role: null }));
          break;
        }
      }
      } catch (error) {
        logP2PAction('Error', `Failed to handle message ${message.type}: ${error}`);
      }
    },
    [sendMessage, setStatus, cleanup, queryClient]
  );

  const generateQRPairingSession = useCallback(
    async (port: number = 8765): Promise<P2PPairingSession | null> => {
      let currentSettings: P2PSettings;
      try {
        currentSettings = await ensureSettings();
      } catch (error) {
        console.log('[P2P] Failed to ensure settings for QR pairing:', error);
        setStatus('error', 'Einstellungen konnten nicht geladen werden. Bitte starten Sie die App neu.');
        return null;
      }

      cleanup();
      setStatus('discovering');

      try {
        logP2PAction('QR Pairing', `Creating QR pairing session on port ${port}`);
        
        const session = createPairingSession(currentSettings, port);
        setPairingSession(session);
        
        const encodedQR = encodeQRData(session.qrData);
        setQrCodeData(encodedQR);
        
        const code = generatePairingCode();
        setPairingCode(code);

        setSyncState((prev) => ({
          ...prev,
          role: 'host',
        }));

        if (sessionExpiryIntervalRef.current) {
          clearInterval(sessionExpiryIntervalRef.current);
        }
        
        sessionExpiryIntervalRef.current = setInterval(() => {
          if (session && isPairingSessionExpired(session)) {
            logP2PAction('QR Pairing', 'Session expired');
            setPairingSession((prev) => prev ? { ...prev, status: 'expired' } : null);
            setStatus('idle');
            if (sessionExpiryIntervalRef.current) {
              clearInterval(sessionExpiryIntervalRef.current);
              sessionExpiryIntervalRef.current = null;
            }
          } else if (session) {
            setSessionExpiryTimer(getRemainingSessionTime(session));
          }
        }, 1000);

        setSessionExpiryTimer(getRemainingSessionTime(session));
        setStatus('pairing');
        
        logP2PAction('QR Pairing', `Session created: ${session.sessionId}`);
        return session;
      } catch (error) {
        logP2PAction('QR Pairing', `Failed to create session: ${error}`);
        setStatus('error', 'QR-Kopplung konnte nicht gestartet werden');
        return null;
      }
    },
    [ensureSettings, cleanup, setStatus]
  );

  const startHosting = useCallback(
    async (port: number = 8765): Promise<boolean> => {
      try {
        await ensureSettings();
      } catch (error) {
        console.log('[P2P] Failed to ensure settings for hosting:', error);
        setStatus('error', 'Einstellungen konnten nicht geladen werden. Bitte starten Sie die App neu.');
        return false;
      }

      cleanup();
      setStatus('discovering');

      try {
        logP2PAction('Host', `Starting host mode on port ${port}`);
        const code = generatePairingCode();
        setPairingCode(code);

        setSyncState((prev) => ({
          ...prev,
          role: 'host',
        }));

        setStatus('pairing');
        return true;
      } catch (error) {
        logP2PAction('Host', `Failed to start: ${error}`);
        setStatus('error', 'Hosting konnte nicht gestartet werden');
        return false;
      }
    },
    [ensureSettings, cleanup, setStatus]
  );

  const connectToPeer = useCallback(
    async (ipAddress: string, port: number): Promise<boolean> => {
      try {
        await ensureSettings();
      } catch (error) {
        console.log('[P2P] Failed to ensure settings for connection:', error);
        setStatus('error', 'Einstellungen konnten nicht geladen werden.');
        return false;
      }

      cleanup();
      setStatus('connecting');

      try {
        logP2PAction('Connect', `Connecting to ${ipAddress}:${port}`);

        const ws = new WebSocket(`ws://${ipAddress}:${port}`);
        wsRef.current = ws;

        connectionTimeoutRef.current = setTimeout(() => {
          if (syncStateRef.current.status === 'connecting') {
            cleanup();
            setStatus('error', 'Verbindung fehlgeschlagen');
          }
        }, CONNECTION_TIMEOUT);

        ws.onopen = () => {
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
          }
          logP2PAction('Connect', 'WebSocket connected');
          setSyncState((prev) => ({
            ...prev,
            role: 'client',
          }));
          setStatus('connected');

          heartbeatRef.current = setInterval(() => {
            const s = settingsRef.current;
            if (s) {
              const heartbeat = createMessage(
                'heartbeat',
                s.deviceId,
                { timestamp: Date.now() },
                s.privateKey
              );
              sendMessage(heartbeat);
            }
          }, HEARTBEAT_INTERVAL);
        };

        ws.onmessage = (event) => {
          handleMessage(event.data);
        };

        ws.onclose = () => {
          logP2PAction('Connect', 'WebSocket closed');
          cleanup();
          setStatus('idle');
          setSyncState((prev) => ({ ...prev, currentPeer: null, role: null }));
        };

        ws.onerror = (error) => {
          logP2PAction('Connect', `WebSocket error: ${error}`);
          cleanup();
          setStatus('error', 'Verbindungsfehler');
        };

        return true;
      } catch (error) {
        logP2PAction('Connect', `Failed: ${error}`);
        setStatus('error', 'Verbindung fehlgeschlagen');
        return false;
      }
    },
    [ensureSettings, cleanup, setStatus, sendMessage, handleMessage]
  );

  const sendPairRequest = useCallback(
    async (device: P2PDevice, code: string): Promise<boolean> => {
      const s = settingsRef.current;
      if (!s) return false;

      setPendingPairRequest(device);
      const message = createMessage(
        'pair_request',
        s.deviceId,
        {
          deviceId: s.deviceId,
          deviceName: s.deviceName,
          publicKey: s.publicKey,
          pairingCode: code,
        },
        s.privateKey
      );

      return sendMessage(message);
    },
    [sendMessage]
  );

  const acceptPairRequest = useCallback(
    async (device: P2PDevice): Promise<boolean> => {
      const s = settingsRef.current;
      if (!s) return false;

      const sharedSecret = deriveSharedSecret(s.privateKey, device.publicKey);
      const paired = await addPairedDevice(device, sharedSecret);

      setSyncState((prev) => ({
        ...prev,
        pairedDevices: [...prev.pairedDevices.filter((d) => d.id !== paired.id), paired],
      }));
      queryClient.invalidateQueries({ queryKey: ['p2pPairedDevices'] });

      const message = createMessage(
        'pair_accept',
        s.deviceId,
        {
          deviceId: s.deviceId,
          deviceName: s.deviceName,
          publicKey: s.publicKey,
        },
        s.privateKey
      );

      setPendingPairRequest(null);
      setStatus('connected');
      return sendMessage(message);
    },
    [sendMessage, setStatus, queryClient]
  );

  const rejectPairRequest = useCallback(async (): Promise<void> => {
    const s = settingsRef.current;
    if (!s) return;

    const message = createMessage(
      'pair_reject',
      s.deviceId,
      {},
      s.privateKey
    );
    sendMessage(message);
    setPendingPairRequest(null);
    setStatus('idle');
  }, [sendMessage, setStatus]);

  const requestSync = useCallback(async (): Promise<boolean> => {
    const s = settingsRef.current;
    if (!s || syncStateRef.current.status !== 'connected') return false;

    setStatus('syncing');
    const message = createMessage(
      'sync_request',
      s.deviceId,
      { timestamp: new Date().toISOString() },
      s.privateKey
    );

    return sendMessage(message);
  }, [setStatus, sendMessage]);

  const sendSyncData = useCallback(
    async (data: AppData): Promise<boolean> => {
      const s = settingsRef.current;
      const currentSync = syncStateRef.current;
      if (!s || !currentSync.currentPeer) return false;

      const pairedDevice = currentSync.pairedDevices.find(
        (d) => d.id === currentSync.currentPeer?.id
      );
      if (!pairedDevice) return false;

      setStatus('syncing');
      currentAppDataRef.current = data;

      const newClock = incrementVectorClock(currentSync.vectorClock, s.deviceId);
      await saveVectorClock(newClock);

      const packet = createSyncPacket(data, s.deviceId, newClock, pairedDevice.sharedSecret);
      const message = createMessage('sync_data', s.deviceId, packet, s.privateKey);

      setSyncState((prev) => ({ ...prev, vectorClock: newClock }));
      return sendMessage(message);
    },
    [setStatus, sendMessage]
  );

  const disconnect = useCallback(() => {
    const s = settingsRef.current;
    if (s && wsRef.current) {
      const message = createMessage(
        'disconnect',
        s.deviceId,
        {},
        s.privateKey
      );
      sendMessage(message);
    }
    cleanup();
    setStatus('idle');
    setSyncState((prev) => ({ ...prev, currentPeer: null, role: null }));
  }, [sendMessage, cleanup, setStatus]);

  const unpairDevice = useCallback(
    async (deviceId: string): Promise<void> => {
      await removePairedDevice(deviceId);
      setSyncState((prev) => ({
        ...prev,
        pairedDevices: prev.pairedDevices.filter((d) => d.id !== deviceId),
      }));
      queryClient.invalidateQueries({ queryKey: ['p2pPairedDevices'] });
      logP2PAction('Unpair', `Device ${deviceId} unpaired`);
    },
    [queryClient]
  );

  const updateSettings = useCallback(
    async (newSettings: Partial<P2PSettings>) => {
      await updateSettingsMutation.mutateAsync(newSettings);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const setCurrentAppData = useCallback((data: AppData) => {
    currentAppDataRef.current = data;
  }, []);

  const validateAndConnectFromQR = useCallback(
    async (scannedData: string): Promise<{ success: boolean; error?: string }> => {
      let currentSettings: P2PSettings;
      try {
        currentSettings = await ensureSettings();
      } catch (error) {
        console.log('[P2P] Failed to ensure settings for QR validation:', error);
        return { success: false, error: 'Einstellungen konnten nicht initialisiert werden. Bitte starten Sie die App neu.' };
      }

      logP2PAction('QR Scan', `Validating scanned QR code, settings deviceId: ${currentSettings.deviceId}`);
      
      const validationResult: P2PQRValidationResult = validateQRCodeData(scannedData);
      const settingsToUse = currentSettings;
      
      if (!validationResult.isValid || !validationResult.data) {
        logP2PAction('QR Scan', `Validation failed: ${validationResult.error}`);
        return { success: false, error: validationResult.error };
      }

      const qrData: P2PQRCodeData = validationResult.data;
      
      logP2PAction('QR Scan', `Valid QR code from ${qrData.deviceName} (${qrData.deviceId})`);
      
      cleanup();
      setStatus('connecting');

      try {
        const clientEphemeralKeys = generateEphemeralKeyPair();
        
        const sessionSharedSecret = deriveSessionSharedSecret(
          clientEphemeralKeys.privateKey,
          qrData.publicKey
        );
        
        logP2PAction('QR Scan', `Session secret derived (${sessionSharedSecret.substring(0, 8)}...)`);
        logP2PAction('QR Scan', `Connecting to ${qrData.ipAddress}:${qrData.port}`);
        
        const ws = new WebSocket(`ws://${qrData.ipAddress}:${qrData.port}`);
        wsRef.current = ws;

        connectionTimeoutRef.current = setTimeout(() => {
          if (syncStateRef.current.status === 'connecting') {
            cleanup();
            setStatus('error', 'Verbindung fehlgeschlagen - Zeitüberschreitung');
          }
        }, CONNECTION_TIMEOUT);

        ws.onopen = () => {
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
          }
          logP2PAction('QR Connect', 'WebSocket connected, sending ephemeral public key');
          
          setSyncState((prev) => ({
            ...prev,
            role: 'client',
          }));

          const connectMessage = createMessage(
            'pair_request',
            settingsToUse.deviceId,
            {
              sessionId: qrData.sessionId,
              deviceId: settingsToUse.deviceId,
              deviceName: settingsToUse.deviceName,
              ephemeralPublicKey: clientEphemeralKeys.publicKey,
              publicKey: settingsToUse.publicKey,
              timestamp: new Date().toISOString(),
            },
            settingsToUse.privateKey
          );
          
          ws.send(JSON.stringify(connectMessage));
          logP2PAction('QR Connect', 'Sent ephemeral public key to host');
          
          setStatus('pairing');

          heartbeatRef.current = setInterval(() => {
            const heartbeat = createMessage(
              'heartbeat',
              settingsToUse.deviceId,
              { timestamp: Date.now() },
              settingsToUse.privateKey
            );
            sendMessage(heartbeat);
          }, HEARTBEAT_INTERVAL);
        };

        ws.onmessage = (event) => {
          handleMessage(event.data);
        };

        ws.onclose = () => {
          logP2PAction('QR Connect', 'WebSocket closed');
          cleanup();
          setStatus('idle');
          setSyncState((prev) => ({ ...prev, currentPeer: null, role: null }));
        };

        ws.onerror = (error) => {
          logP2PAction('QR Connect', `WebSocket error: ${error}`);
          cleanup();
          setStatus('error', 'Verbindungsfehler');
        };

        return { success: true };
      } catch (error) {
        logP2PAction('QR Connect', `Failed: ${error}`);
        cleanup();
        setStatus('error', 'Verbindung fehlgeschlagen');
        return { success: false, error: 'Verbindung zum Gerät fehlgeschlagen' };
      }
    },
    [ensureSettings, cleanup, setStatus, sendMessage, handleMessage]
  );

  const handlePeerEphemeralKey = useCallback(
    async (peerDeviceId: string, peerDeviceName: string, peerEphemeralPublicKey: string, peerPublicKey: string): Promise<boolean> => {
      const s = settingsRef.current;
      if (!s || !pairingSession) {
        logP2PAction('QR Pairing', 'No active pairing session');
        return false;
      }

      if (isPairingSessionExpired(pairingSession)) {
        logP2PAction('QR Pairing', 'Pairing session has expired');
        setStatus('error', 'Kopplungssitzung abgelaufen');
        return false;
      }

      logP2PAction('QR Pairing', `Received ephemeral key from ${peerDeviceName}`);

      const sessionSharedSecret = deriveSessionSharedSecret(
        pairingSession.ephemeralKeys.privateKey,
        peerEphemeralPublicKey
      );

      const permanentSharedSecret = deriveSharedSecret(s.privateKey, peerPublicKey);
      
      logP2PAction('QR Pairing', `Session secret: ${sessionSharedSecret.substring(0, 8)}..., Permanent secret: ${permanentSharedSecret.substring(0, 8)}...`);

      const device: P2PDevice = {
        id: peerDeviceId,
        name: peerDeviceName,
        ipAddress: '',
        port: 0,
        publicKey: peerPublicKey,
        lastSeen: new Date().toISOString(),
        isPaired: false,
        isOnline: true,
      };

      setPendingPairRequest(device);
      
      setPairingSession((prev) => prev ? {
        ...prev,
        status: 'connected',
        peerPublicKey: peerEphemeralPublicKey,
        peerDeviceId,
        peerDeviceName,
      } : null);

      logP2PAction('QR Pairing', `Peer connected: ${peerDeviceName} (${peerDeviceId})`);
      
      return true;
    },
    [pairingSession, setStatus]
  );

  const cancelQRPairingSession = useCallback(() => {
    if (sessionExpiryIntervalRef.current) {
      clearInterval(sessionExpiryIntervalRef.current);
      sessionExpiryIntervalRef.current = null;
    }
    setPairingSession(null);
    setQrCodeData(null);
    setSessionExpiryTimer(0);
    setPairingCode(null);
    setStatus('idle');
    setSyncState((prev) => ({ ...prev, role: null }));
    logP2PAction('QR Pairing', 'Session cancelled');
  }, [setStatus]);

  const stopHosting = useCallback(() => {
    cleanup();
    setPairingCode(null);
    setPairingSession(null);
    setQrCodeData(null);
    setSessionExpiryTimer(0);
    setStatus('idle');
    setSyncState((prev) => ({ ...prev, role: null }));
    logP2PAction('Host', 'Stopped hosting');
  }, [cleanup, setStatus]);

  const getDataStats = useCallback(() => {
    const data = currentAppDataRef.current;
    if (!data) {
      return {
        classesCount: 0,
        studentsCount: 0,
        participationsCount: 0,
        lastModified: null,
      };
    }
    const studentsCount = data.classes.reduce((acc, c) => acc + c.students.length, 0);
    const lastParticipation = data.participations.length > 0
      ? [...data.participations].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date
      : null;
    return {
      classesCount: data.classes.length,
      studentsCount,
      participationsCount: data.participations.length,
      lastModified: lastParticipation,
    };
  }, []);

  const initiateFirstSync = useCallback(
    async (targetDeviceId: string): Promise<boolean> => {
      const s = settingsRef.current;
      if (!s) return false;

      const currentSync = syncStateRef.current;
      const pairedDevice = currentSync.pairedDevices.find((d) => d.id === targetDeviceId);
      if (!pairedDevice) {
        logP2PAction('First Sync', 'Target device not found in paired devices');
        return false;
      }

      logP2PAction('First Sync', `Initiating first sync with ${pairedDevice.name}`);
      
      const dataStats = getDataStats();
      const request: FirstSyncRequest = {
        deviceId: s.deviceId,
        deviceName: s.deviceName,
        dataStats,
      };

      setSyncState((prev) => ({
        ...prev,
        firstSync: {
          ...prev.firstSync,
          isFirstSync: true,
          awaitingChoice: true,
        },
      }));

      const message = createMessage(
        'first_sync_request',
        s.deviceId,
        request,
        s.privateKey
      );

      return sendMessage(message);
    },
    [getDataStats, sendMessage]
  );

  const makeFirstSyncChoice = useCallback(
    async (choice: FirstSyncChoice): Promise<boolean> => {
      const s = settingsRef.current;
      if (!s) return false;

      logP2PAction('First Sync', `User chose: ${choice}`);
      
      setSyncState((prev) => ({
        ...prev,
        firstSync: {
          ...prev.firstSync,
          selectedChoice: choice,
          awaitingChoice: false,
        },
      }));

      const message = createMessage(
        'first_sync_choice',
        s.deviceId,
        { choice },
        s.privateKey
      );

      const sent = sendMessage(message);

      if (choice === 'local' && currentAppDataRef.current) {
        const currentSync = syncStateRef.current;
        const pairedDevice = currentSync.pairedDevices.find(
          (d) => d.id === currentSync.firstSync.pendingRequest?.deviceId
        );
        if (pairedDevice) {
          logP2PAction('First Sync', 'Sending local data as authoritative');
          const newClock = incrementVectorClock({}, s.deviceId);
          const packet = createSyncPacket(
            currentAppDataRef.current,
            s.deviceId,
            newClock,
            pairedDevice.sharedSecret
          );
          const dataMsg = createMessage(
            'first_sync_data',
            s.deviceId,
            { packet, isFullReplace: true },
            s.privateKey
          );
          sendMessage(dataMsg);
        }
      }

      return sent;
    },
    [sendMessage]
  );

  const cancelFirstSync = useCallback(() => {
    logP2PAction('First Sync', 'Cancelled by user');
    setSyncState((prev) => ({
      ...prev,
      firstSync: {
        isFirstSync: false,
        pendingRequest: null,
        awaitingChoice: false,
        selectedChoice: null,
        remoteDataStats: null,
      },
    }));
  }, []);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    settings,
    syncState,
    pairingCode,
    pendingPairRequest,
    pairingSession,
    qrCodeData,
    sessionExpiryTimer,
    isLoading: settingsQuery.isLoading || pairedDevicesQuery.isLoading,
    startHosting,
    stopHosting,
    connectToPeer,
    sendPairRequest,
    acceptPairRequest,
    rejectPairRequest,
    requestSync,
    sendSyncData,
    disconnect,
    unpairDevice,
    updateSettings,
    setCurrentAppData,
    generateQRPairingSession,
    validateAndConnectFromQR,
    handlePeerEphemeralKey,
    cancelQRPairingSession,
    initiateFirstSync,
    makeFirstSyncChoice,
    cancelFirstSync,
    getDataStats,
  };
});
