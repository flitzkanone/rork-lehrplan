import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Modal,
} from 'react-native';
import Colors from '@/constants/colors';

interface DelayedActivityIndicatorProps {
  visible: boolean;
  delay?: number;
  size?: 'small' | 'large';
  color?: string;
}

export function DelayedActivityIndicator({
  visible,
  delay = 1000,
  size = 'small',
  color = Colors.primary,
}: DelayedActivityIndicatorProps) {
  const [show, setShow] = useState<boolean>(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      timerRef.current = setTimeout(() => {
        setShow(true);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }, delay);
    } else {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setShow(false);
      fadeAnim.setValue(0);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible, delay, fadeAnim]);

  if (!show) return null;

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <ActivityIndicator size={size} color={color} />
    </Animated.View>
  );
}

interface DelayedOverlayProps {
  visible: boolean;
  delay?: number;
  message?: string;
}

export function DelayedOverlay({
  visible,
  delay = 1000,
  message,
}: DelayedOverlayProps) {
  const [show, setShow] = useState<boolean>(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      timerRef.current = setTimeout(() => {
        setShow(true);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }, delay);
    } else {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (show) {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start(() => setShow(false));
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible, delay, fadeAnim, show]);

  if (!show && !visible) return null;

  return (
    <Modal visible={show} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[overlayStyles.container, { opacity: fadeAnim }]}>
        <View style={overlayStyles.card}>
          <View style={overlayStyles.spinnerWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
          {message ? (
            <Text style={overlayStyles.message}>{message}</Text>
          ) : null}
        </View>
      </Animated.View>
    </Modal>
  );
}

interface DelayedInlineBannerProps {
  visible: boolean;
  delay?: number;
  message: string;
  color?: string;
}

export function DelayedInlineBanner({
  visible,
  delay = 1000,
  message,
  color = Colors.primary,
}: DelayedInlineBannerProps) {
  const [show, setShow] = useState<boolean>(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      timerRef.current = setTimeout(() => {
        setShow(true);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }, delay);
    } else {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (show) {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start(() => setShow(false));
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible, delay, fadeAnim, show]);

  if (!show && !visible) return null;

  return (
    <Animated.View style={[bannerStyles.container, { opacity: fadeAnim }]}>
      <ActivityIndicator size="small" color={color} />
      <Text style={[bannerStyles.text, { color }]}>{message}</Text>
    </Animated.View>
  );
}

const overlayStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 40,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
    minWidth: 180,
  },
  spinnerWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
});

const bannerStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.inputBg,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginVertical: 8,
  },
  text: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
});
