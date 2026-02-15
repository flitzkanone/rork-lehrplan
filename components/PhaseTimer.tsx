import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Pause, Play, SkipForward } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import type { PhaseConfig } from '@/types';

const DEFAULT_PHASES: PhaseConfig[] = [
  { name: 'Einstieg', durationMinutes: 10 },
  { name: 'Erarbeitung', durationMinutes: 25 },
  { name: 'Sicherung', durationMinutes: 10 },
];

const PHASE_COLORS = ['#2563EB', '#059669', '#D97706'];

interface PhaseTimerProps {
  phases?: PhaseConfig[];
  onPhaseChange?: (phaseIndex: number) => void;
  onComplete?: () => void;
}

export default function PhaseTimer({ phases = DEFAULT_PHASES, onPhaseChange, onComplete }: PhaseTimerProps) {
  const [currentPhase, setCurrentPhase] = useState<number>(0);
  const [secondsLeft, setSecondsLeft] = useState<number>(phases[0].durationMinutes * 60);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSeconds = phases.reduce((sum, p) => sum + p.durationMinutes * 60, 0);
  const elapsedBefore = phases.slice(0, currentPhase).reduce((sum, p) => sum + p.durationMinutes * 60, 0);
  const currentPhaseTotalSeconds = phases[currentPhase]?.durationMinutes * 60 || 1;
  const phaseElapsed = currentPhaseTotalSeconds - secondsLeft;
  const totalElapsed = elapsedBefore + phaseElapsed;
  const globalProgress = totalSeconds > 0 ? totalElapsed / totalSeconds : 0;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: globalProgress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [globalProgress, progressAnim]);

  useEffect(() => {
    if (secondsLeft <= 30 && secondsLeft > 0 && !isPaused) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 400, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [secondsLeft <= 30, isPaused, pulseAnim, secondsLeft]);

  useEffect(() => {
    if (isPaused || isComplete) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPaused, isComplete]);

  useEffect(() => {
    if (secondsLeft === 0 && !isComplete) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      if (currentPhase < phases.length - 1) {
        const nextPhase = currentPhase + 1;
        setCurrentPhase(nextPhase);
        setSecondsLeft(phases[nextPhase].durationMinutes * 60);
        onPhaseChange?.(nextPhase);
      } else {
        setIsComplete(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onComplete?.();
      }
    }
  }, [secondsLeft, currentPhase, phases, isComplete, onPhaseChange, onComplete]);

  const skipPhase = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (currentPhase < phases.length - 1) {
      const nextPhase = currentPhase + 1;
      setCurrentPhase(nextPhase);
      setSecondsLeft(phases[nextPhase].durationMinutes * 60);
      onPhaseChange?.(nextPhase);
    } else {
      setIsComplete(true);
      onComplete?.();
    }
  }, [currentPhase, phases, onPhaseChange, onComplete]);

  const togglePause = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsPaused((p) => !p);
  }, []);

  const formatTime = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const phaseColor = PHASE_COLORS[currentPhase % PHASE_COLORS.length];

  if (isComplete) {
    return (
      <View style={[styles.container, { backgroundColor: '#059669' }]}>
        <View style={styles.innerRow}>
          <Text style={styles.completeText}>Unterricht abgeschlossen</Text>
        </View>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: pulseAnim }] }]}>
      <View style={styles.innerRow}>
        <View style={styles.leftSection}>
          <View style={[styles.phaseDot, { backgroundColor: phaseColor }]} />
          <Text style={styles.phaseName} numberOfLines={1}>{phases[currentPhase]?.name}</Text>
        </View>
        <Text style={[styles.timeText, secondsLeft <= 30 && styles.timeTextUrgent]}>
          {formatTime(secondsLeft)}
        </Text>
        <View style={styles.controls}>
          <TouchableOpacity onPress={togglePause} style={styles.controlBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            {isPaused ? (
              <Play size={12} color="#FFF" strokeWidth={2.5} />
            ) : (
              <Pause size={12} color="#FFF" strokeWidth={2.5} />
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={skipPhase} style={styles.controlBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <SkipForward size={12} color="#FFF" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.progressTrack}>
        {phases.map((phase, i) => {
          const phaseRatio = phase.durationMinutes * 60 / totalSeconds;
          let fillRatio = 0;
          if (i < currentPhase) fillRatio = 1;
          else if (i === currentPhase) fillRatio = phaseElapsed / currentPhaseTotalSeconds;
          return (
            <View key={i} style={[styles.phaseSegment, { flex: phaseRatio }]}>
              <Animated.View
                style={[
                  styles.phaseSegmentFill,
                  {
                    backgroundColor: PHASE_COLORS[i % PHASE_COLORS.length],
                    width: `${fillRatio * 100}%`,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#16171A',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  phaseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  phaseName: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFF',
    maxWidth: 120,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFF',
    fontVariant: ['tabular-nums'] as const,
    marginHorizontal: 12,
  },
  timeTextUrgent: {
    color: '#FCA5A5',
  },
  controls: {
    flexDirection: 'row',
    gap: 8,
  },
  controlBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    flexDirection: 'row',
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    gap: 2,
  },
  phaseSegment: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  phaseSegmentFill: {
    height: 3,
    borderRadius: 1.5,
  },
  completeText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFF',
  },
});
