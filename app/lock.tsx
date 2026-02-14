import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fingerprint, Delete, RotateCcw, X } from 'lucide-react-native';
import { DelayedActivityIndicator } from '@/components/DelayedLoader';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import Colors from '@/constants/colors';
import { useApp } from '@/context/AppContext';
import { formatBackupDate } from '@/utils/backup';

const BIOMETRIC_PIN_KEY = 'teacher_app_biometric_pin';

export default function LockScreen() {
  const router = useRouter();
  const { authenticateWithPin, recoveryAvailable, recoverFromBackup, isRecovering, dismissRecovery } = useApp();
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [error, setError] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState<boolean>(false);
  const [recoveryPin, setRecoveryPin] = useState<string>('');
  const [recoveryError, setRecoveryError] = useState<string>('');
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const tryBiometric = useCallback(async () => {
    if (Platform.OS === 'web') return;
    try {
      const storedPin = await SecureStore.getItemAsync(BIOMETRIC_PIN_KEY);
      if (!storedPin) {
        console.log('[Lock] No stored PIN for biometric auth');
        return;
      }

      const LocalAuth = await import('expo-local-authentication');
      const hasHardware = await LocalAuth.hasHardwareAsync();
      const isEnrolled = await LocalAuth.isEnrolledAsync();
      if (hasHardware && isEnrolled) {
        const result = await LocalAuth.authenticateAsync({
          promptMessage: 'Entsperren',
          cancelLabel: 'PIN verwenden',
          disableDeviceFallback: true,
        });
        if (result.success) {
          const authSuccess = await authenticateWithPin(storedPin);
          if (authSuccess) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.replace('/');
          } else {
            console.log('[Lock] Biometric OK but PIN auth failed - PIN may have changed');
            await SecureStore.deleteItemAsync(BIOMETRIC_PIN_KEY);
          }
        }
      }
    } catch (e) {
      console.log('Biometric auth not available:', e);
    }
  }, [router, authenticateWithPin]);

  useEffect(() => {
    tryBiometric();
  }, [tryBiometric]);

  const shakeAnimation = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  useEffect(() => {
    const checkPin = async () => {
      if (isChecking) return;
      if (enteredPin.length >= 4 && enteredPin.length <= 6) {
        setIsChecking(true);
        const pinToCheck = enteredPin;
        const success = await authenticateWithPin(pinToCheck);
        if (success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (Platform.OS !== 'web') {
            SecureStore.setItemAsync(BIOMETRIC_PIN_KEY, pinToCheck).catch((e) =>
              console.log('[Lock] Failed to store PIN for biometric:', e)
            );
          }
          router.replace('/');
          return;
        }
        setIsChecking(false);
        if (pinToCheck.length === 6) {
          setError(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          shakeAnimation();
          setTimeout(() => {
            setEnteredPin('');
            setError(false);
          }, 600);
        }
      }
    };
    if (enteredPin.length >= 4) {
      checkPin();
    }
  }, [enteredPin, authenticateWithPin, router, shakeAnimation, isChecking]);

  const handleDigit = (digit: string) => {
    if (enteredPin.length < 6) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setEnteredPin((prev) => prev + digit);
    }
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEnteredPin((prev) => prev.slice(0, -1));
  };

  const handleRecovery = async () => {
    if (!recoveryAvailable || recoveryPin.length < 4) {
      setRecoveryError('Bitte geben Sie die PIN des Backups ein.');
      return;
    }

    setRecoveryError('');
    const success = await recoverFromBackup(recoveryAvailable.id, recoveryPin);
    
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowRecoveryModal(false);
      router.replace('/');
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setRecoveryError('Wiederherstellung fehlgeschlagen. Überprüfen Sie Ihre PIN.');
    }
  };

  const handleDismissRecovery = () => {
    dismissRecovery();
    setShowRecoveryModal(false);
  };

  const pinLength = 6;
  const showBiometric = Platform.OS !== 'web';

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.container}>
        <View style={styles.top}>
          <Text style={styles.title}>Entsperren</Text>
          <Text style={styles.subtitle}>PIN eingeben</Text>

          <Animated.View
            style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}
          >
            {Array.from({ length: pinLength }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i < enteredPin.length && styles.dotFilled,
                  error && i < enteredPin.length && styles.dotError,
                ]}
              />
            ))}
          </Animated.View>
          {error && <Text style={styles.errorText}>Falsche PIN</Text>}
          <DelayedActivityIndicator visible={isChecking} delay={1000} size="small" />
        </View>

        {recoveryAvailable && (
          <TouchableOpacity
            style={styles.recoveryBanner}
            onPress={() => setShowRecoveryModal(true)}
            activeOpacity={0.7}
          >
            <RotateCcw size={16} color={Colors.primary} strokeWidth={1.7} />
            <Text style={styles.recoveryBannerText}>Backup verfügbar - Tippen zum Wiederherstellen</Text>
          </TouchableOpacity>
        )}

        <View style={styles.keypad}>
          {[
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            [showBiometric ? 'bio' : 'empty', '0', 'del'],
          ].map((row, ri) => (
            <View key={ri} style={styles.keypadRow}>
              {row.map((key) => {
                if (key === 'empty') {
                  return <View key={key} style={styles.keyBtn} />;
                }
                if (key === 'bio') {
                  return (
                    <TouchableOpacity
                      key={key}
                      style={styles.keyBtn}
                      onPress={tryBiometric}
                      activeOpacity={0.5}
                    >
                      <Fingerprint size={22} color={Colors.primary} strokeWidth={1.5} />
                    </TouchableOpacity>
                  );
                }
                if (key === 'del') {
                  return (
                    <TouchableOpacity
                      key={key}
                      style={styles.keyBtn}
                      onPress={handleDelete}
                      activeOpacity={0.5}
                    >
                      <Delete size={22} color={Colors.textSecondary} strokeWidth={1.5} />
                    </TouchableOpacity>
                  );
                }
                return (
                  <TouchableOpacity
                    key={key}
                    style={styles.keyBtn}
                    onPress={() => handleDigit(key)}
                    activeOpacity={0.5}
                  >
                    <Text style={styles.keyText}>{key}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        <Modal visible={showRecoveryModal} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Daten wiederherstellen</Text>
                <TouchableOpacity onPress={() => setShowRecoveryModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <X size={20} color={Colors.textSecondary} strokeWidth={1.7} />
                </TouchableOpacity>
              </View>
              {recoveryAvailable && (
                <>
                  <Text style={styles.recoveryInfo}>
                    Ein Backup vom {formatBackupDate(recoveryAvailable.createdAt)} wurde gefunden.
                  </Text>
                  <Text style={styles.recoveryHint}>
                    Geben Sie die PIN ein, mit der das Backup erstellt wurde:
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={recoveryPin}
                    onChangeText={(text) => {
                      setRecoveryPin(text);
                      setRecoveryError('');
                    }}
                    placeholder="PIN"
                    placeholderTextColor={Colors.textLight}
                    secureTextEntry
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  {recoveryError ? <Text style={styles.recoveryErrorText}>{recoveryError}</Text> : null}
                  <TouchableOpacity
                    style={[styles.recoveryBtn, isRecovering && styles.recoveryBtnDisabled]}
                    onPress={handleRecovery}
                    activeOpacity={0.7}
                    disabled={isRecovering}
                  >
                    {isRecovering ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <Text style={styles.recoveryBtnText}>Wiederherstellen</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dismissBtn}
                    onPress={handleDismissRecovery}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.dismissBtnText}>Nicht wiederherstellen</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
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
    justifyContent: 'space-between',
  },
  top: {
    alignItems: 'center',
    paddingTop: 80,
  },
  title: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 36,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 18,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: Colors.divider,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dotError: {
    backgroundColor: Colors.negative,
    borderColor: Colors.negative,
  },
  errorText: {
    color: Colors.negative,
    fontSize: 14,
    marginTop: 14,
    fontWeight: '500' as const,
  },
  keypad: {
    paddingHorizontal: 52,
    paddingBottom: 24,
    gap: 10,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  keyBtn: {
    flex: 1,
    aspectRatio: 1.6,
    maxHeight: 60,
    borderRadius: 14,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 26,
    fontWeight: '400' as const,
    color: Colors.text,
  },
  recoveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primaryLight,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginHorizontal: 24,
    marginBottom: 16,
  },
  recoveryBannerText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.primary,
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
  recoveryInfo: {
    fontSize: 15,
    color: Colors.text,
    marginBottom: 8,
  },
  recoveryHint: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  recoveryErrorText: {
    color: Colors.negative,
    fontSize: 13,
    marginTop: 8,
  },
  recoveryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  recoveryBtnDisabled: {
    opacity: 0.7,
  },
  recoveryBtnText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  dismissBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  dismissBtnText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
});
