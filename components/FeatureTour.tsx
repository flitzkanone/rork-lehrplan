import React, { useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, X, PartyPopper } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useTutorial } from '@/context/TutorialContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SpotlightRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius: number;
}

interface TutorialStep {
  spotlight: SpotlightRegion | null;
  bubbleText: string;
  bubblePosition: 'below' | 'above' | 'center';
  arrowDirection: 'up' | 'down' | 'left' | 'none';
}

const TOTAL_STEPS = 5;

export default function FeatureTour() {
  const insets = useSafeAreaInsets();
  const { showTutorial, currentStep, nextStep, skipTutorial } = useTutorial();

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const bubbleScale = useRef(new Animated.Value(0)).current;
  const bubbleTranslateY = useRef(new Animated.Value(20)).current;
  const confettiOpacity = useRef(new Animated.Value(0)).current;
  const confettiScale = useRef(new Animated.Value(0.3)).current;

  const steps = useMemo((): TutorialStep[] => {
    const headerTop = insets.top + 8;
    const plusBtnRight = SCREEN_WIDTH - 16 - 34;
    const weekNavTop = headerTop + 44;
    const timeColLeft = 0;
    const tabBarBottom = 0;
    const tabBarHeight = Platform.OS === 'ios' ? 84 : 56;
    const classesTabX = SCREEN_WIDTH * 0.6 - 30;

    return [
      {
        spotlight: {
          x: plusBtnRight,
          y: headerTop,
          width: 34,
          height: 34,
          borderRadius: 10,
        },
        bubbleText: 'Hier planst du: Reguläre Stunden, einmalige Events oder Vertretungen.',
        bubblePosition: 'below',
        arrowDirection: 'up',
      },
      {
        spotlight: {
          x: SCREEN_WIDTH * 0.2,
          y: weekNavTop,
          width: SCREEN_WIDTH * 0.6,
          height: 38,
          borderRadius: 10,
        },
        bubbleText: 'Woche wechseln: Nutze die Knöpfe oder wische einfach nach links/rechts.',
        bubblePosition: 'below',
        arrowDirection: 'up',
      },
      {
        spotlight: {
          x: timeColLeft,
          y: weekNavTop + 50,
          width: 42,
          height: 200,
          borderRadius: 8,
        },
        bubbleText: 'Dein Tag: Das Raster passt sich automatisch an deine letzte Stunde an.',
        bubblePosition: 'below',
        arrowDirection: 'left',
      },
      {
        spotlight: {
          x: classesTabX,
          y: SCREEN_HEIGHT - tabBarHeight - tabBarBottom,
          width: 60,
          height: tabBarHeight - 10,
          borderRadius: 12,
        },
        bubbleText: 'Klassen verwalten: Bearbeite hier die Klassen, die du beim Planen erstellt hast.',
        bubblePosition: 'above',
        arrowDirection: 'down',
      },
      {
        spotlight: null,
        bubbleText: 'Tipp: Vertretungen erkennst du im Plan sofort am schwarzen Rand.',
        bubblePosition: 'center',
        arrowDirection: 'none',
      },
    ];
  }, [insets.top]);

  useEffect(() => {
    if (showTutorial) {
      overlayOpacity.setValue(0);
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [showTutorial, overlayOpacity]);

  useEffect(() => {
    if (showTutorial) {
      bubbleScale.setValue(0.7);
      bubbleTranslateY.setValue(15);
      Animated.parallel([
        Animated.spring(bubbleScale, {
          toValue: 1,
          tension: 120,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(bubbleTranslateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      if (currentStep === TOTAL_STEPS - 1) {
        confettiOpacity.setValue(0);
        confettiScale.setValue(0.3);
        Animated.sequence([
          Animated.delay(200),
          Animated.parallel([
            Animated.timing(confettiOpacity, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.spring(confettiScale, {
              toValue: 1,
              tension: 80,
              friction: 6,
              useNativeDriver: true,
            }),
          ]),
        ]).start();
      }
    }
  }, [showTutorial, currentStep, bubbleScale, bubbleTranslateY, confettiOpacity, confettiScale]);

  if (!showTutorial) return null;

  const step = steps[currentStep];
  const isLastStep = currentStep === TOTAL_STEPS - 1;
  const spotlight = step.spotlight;

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    nextStep(TOTAL_STEPS);
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    skipTutorial();
  };

  const renderSpotlightOverlay = () => {
    if (!spotlight) {
      return (
        <View style={styles.overlayFull} pointerEvents="none" />
      );
    }

    const padding = 6;
    const sx = spotlight.x - padding;
    const sy = spotlight.y - padding;
    const sw = spotlight.width + padding * 2;
    const sh = spotlight.height + padding * 2;

    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.overlayPiece, { top: 0, left: 0, right: 0, height: sy }]} />
        <View style={[styles.overlayPiece, { top: sy, left: 0, width: sx, height: sh }]} />
        <View style={[styles.overlayPiece, { top: sy, left: sx + sw, right: 0, height: sh }]} />
        <View style={[styles.overlayPiece, { top: sy + sh, left: 0, right: 0, bottom: 0 }]} />
        <View
          style={[
            styles.spotlightBorder,
            {
              top: sy - 2,
              left: sx - 2,
              width: sw + 4,
              height: sh + 4,
              borderRadius: spotlight.borderRadius + padding + 2,
            },
          ]}
        />
      </View>
    );
  };

  const getBubblePosition = (): { top?: number; bottom?: number; left: number; right: number } => {
    if (step.bubblePosition === 'center' || !spotlight) {
      return {
        top: SCREEN_HEIGHT * 0.35,
        left: 24,
        right: 24,
      };
    }

    const padding = 6;
    const sy = spotlight.y - padding;
    const sh = spotlight.height + padding * 2;

    if (step.bubblePosition === 'below') {
      return {
        top: sy + sh + 20,
        left: 24,
        right: 24,
      };
    }

    return {
      bottom: SCREEN_HEIGHT - sy + 20,
      left: 24,
      right: 24,
    };
  };

  const getArrowPosition = () => {
    if (!spotlight || step.arrowDirection === 'none') return null;

    const padding = 6;
    const sx = spotlight.x - padding;
    const sy = spotlight.y - padding;
    const sw = spotlight.width + padding * 2;
    const sh = spotlight.height + padding * 2;

    if (step.arrowDirection === 'up') {
      return {
        left: Math.min(Math.max(sx + sw / 2 - 8, 40), SCREEN_WIDTH - 60),
        top: sy + sh + 4,
      };
    }
    if (step.arrowDirection === 'down') {
      return {
        left: Math.min(Math.max(sx + sw / 2 - 8, 40), SCREEN_WIDTH - 60),
        top: sy - 22,
      };
    }
    if (step.arrowDirection === 'left') {
      return {
        left: sx + sw + 4,
        top: sy + sh / 2 - 8,
      };
    }
    return null;
  };

  const bubblePos = getBubblePosition();
  const arrowPos = getArrowPosition();

  return (
    <Animated.View style={[styles.container, { opacity: overlayOpacity }]}>
      {renderSpotlightOverlay()}

      <TouchableOpacity
        style={[styles.skipBtn, { top: insets.top + 10 }]}
        onPress={handleSkip}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <X size={16} color="rgba(255,255,255,0.8)" strokeWidth={2} />
        <Text style={styles.skipText}>Überspringen</Text>
      </TouchableOpacity>

      <View style={[styles.stepIndicator, { top: insets.top + 14 }]}>
        {steps.map((_, idx) => (
          <View
            key={idx}
            style={[
              styles.stepDot,
              idx === currentStep && styles.stepDotActive,
              idx < currentStep && styles.stepDotCompleted,
            ]}
          />
        ))}
      </View>

      {arrowPos && (
        <View style={[styles.arrowContainer, { left: arrowPos.left, top: arrowPos.top }]}>
          {step.arrowDirection === 'up' && <View style={styles.arrowUp} />}
          {step.arrowDirection === 'down' && <View style={styles.arrowDown} />}
          {step.arrowDirection === 'left' && <View style={styles.arrowLeft} />}
        </View>
      )}

      <Animated.View
        style={[
          styles.bubbleContainer,
          bubblePos,
          {
            transform: [
              { scale: bubbleScale },
              { translateY: bubbleTranslateY },
            ],
          },
        ]}
      >
        <View style={styles.bubble}>
          {isLastStep && (
            <Animated.View
              style={[
                styles.confettiIcon,
                {
                  opacity: confettiOpacity,
                  transform: [{ scale: confettiScale }],
                },
              ]}
            >
              <PartyPopper size={28} color="#F59E0B" strokeWidth={1.8} />
            </Animated.View>
          )}

          <Text style={styles.bubbleText}>{step.bubbleText}</Text>

          {isLastStep && (
            <Text style={styles.finishSubtext}>Viel Erfolg!</Text>
          )}

          <TouchableOpacity
            style={styles.nextBtn}
            onPress={handleNext}
            activeOpacity={0.7}
          >
            <Text style={styles.nextBtnText}>
              {isLastStep ? 'Los geht\'s' : 'Weiter'}
            </Text>
            {!isLastStep && (
              <ChevronRight size={16} color={Colors.white} strokeWidth={2.5} />
            )}
          </TouchableOpacity>

          <Text style={styles.stepCount}>
            {currentStep + 1} / {TOTAL_STEPS}
          </Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  overlayFull: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  overlayPiece: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  spotlightBorder: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  skipBtn: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    zIndex: 10,
  },
  skipText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.2,
  },
  stepIndicator: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    gap: 6,
    zIndex: 10,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  stepDotActive: {
    backgroundColor: '#FFFFFF',
    width: 18,
    borderRadius: 3,
  },
  stepDotCompleted: {
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  arrowContainer: {
    position: 'absolute',
    zIndex: 10,
  },
  arrowUp: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFFFFF',
  },
  arrowDown: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
  },
  arrowLeft: {
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderBottomWidth: 8,
    borderRightWidth: 12,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#FFFFFF',
  },
  bubbleContainer: {
    position: 'absolute',
    zIndex: 10,
  },
  bubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: 'rgba(0,0,0,0.3)',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 1,
        shadowRadius: 24,
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  confettiIcon: {
    alignSelf: 'center',
    marginBottom: 8,
  },
  bubbleText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  finishSubtext: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginTop: 8,
    letterSpacing: -0.3,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.text,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 16,
    gap: 4,
  },
  nextBtnText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.white,
    letterSpacing: 0.2,
  },
  stepCount: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.textLight,
    textAlign: 'center' as const,
    marginTop: 8,
  },
});
