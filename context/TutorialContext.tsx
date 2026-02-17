import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';

const TUTORIAL_COMPLETED_KEY = 'teacher_app_tutorial_completed';

export const [TutorialProvider, useTutorial] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [showTutorial, setShowTutorial] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);

  const completedQuery = useQuery({
    queryKey: ['tutorialCompleted'],
    queryFn: async () => {
      const val = await AsyncStorage.getItem(TUTORIAL_COMPLETED_KEY);
      return val === 'true';
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      await AsyncStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');
    },
    onSuccess: () => {
      queryClient.setQueryData(['tutorialCompleted'], true);
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      await AsyncStorage.removeItem(TUTORIAL_COMPLETED_KEY);
    },
    onSuccess: () => {
      queryClient.setQueryData(['tutorialCompleted'], false);
    },
  });

  const startTutorial = useCallback(() => {
    setCurrentStep(0);
    setShowTutorial(true);
  }, []);

  const nextStep = useCallback((totalSteps: number) => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setShowTutorial(false);
      setCurrentStep(0);
      completeMutation.mutate();
    }
  }, [currentStep, completeMutation]);

  const skipTutorial = useCallback(() => {
    setShowTutorial(false);
    setCurrentStep(0);
    completeMutation.mutate();
  }, [completeMutation]);

  const replayTutorial = useCallback(() => {
    resetMutation.mutate();
    setCurrentStep(0);
    setShowTutorial(true);
  }, [resetMutation]);

  const triggerFirstTimeTutorial = useCallback(() => {
    if (completedQuery.data === false) {
      startTutorial();
    }
  }, [completedQuery.data, startTutorial]);

  return {
    showTutorial,
    currentStep,
    tutorialCompleted: completedQuery.data ?? false,
    isLoading: completedQuery.isLoading,
    startTutorial,
    nextStep,
    skipTutorial,
    replayTutorial,
    triggerFirstTimeTutorial,
  };
});
