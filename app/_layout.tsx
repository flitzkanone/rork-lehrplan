import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AppProvider } from "@/context/AppContext";
import { BackupProvider } from "@/context/BackupContext";
import { P2PProvider } from "@/context/P2PContext";
import {
  addNotificationResponseListener,
  setupNotificationCategories,
} from "@/utils/lessonNotification";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const router = useRouter();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    setupNotificationCategories();

    notificationListener.current = addNotificationResponseListener((response) => {
      console.log('[RootLayout] Notification response received:', response);
      const data = response.notification.request.content.data;
      
      if (data?.type === 'lesson-active') {
        const actionId = response.actionIdentifier;
        
        if (actionId === 'resume' || actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          console.log('[RootLayout] Navigating to lesson-active');
          router.push('/lesson-active' as any);
        } else if (actionId === 'end') {
          console.log('[RootLayout] End lesson action - navigating to lesson to end');
          router.push('/lesson-active' as any);
        }
      }
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
    };
  }, [router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
      <Stack.Screen name="lock" options={{ gestureEnabled: false }} />
      <Stack.Screen name="lesson-active" options={{ presentation: "modal", gestureEnabled: false }} />
      <Stack.Screen name="random-wheel" options={{ presentation: "modal" }} />
      <Stack.Screen name="homework-check" options={{ presentation: "modal" }} />
      <Stack.Screen name="presentation-calc" options={{ presentation: "modal" }} />
      <Stack.Screen name="resource-manager" options={{ presentation: "modal" }} />
      <Stack.Screen name="parent-report" options={{ presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ErrorBoundary>
          <AppProvider>
            <BackupProvider>
              <P2PProvider>
                <StatusBar style="dark" />
                <RootLayoutNav />
              </P2PProvider>
            </BackupProvider>
          </AppProvider>
        </ErrorBoundary>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
