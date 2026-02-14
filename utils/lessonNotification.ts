import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { LessonSession, SchoolClass } from '@/types';

const LESSON_NOTIFICATION_ID = 'active-lesson-notification';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') {
    console.log('[LessonNotification] Web platform - skipping permissions');
    return false;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[LessonNotification] Permission not granted');
      return false;
    }

    console.log('[LessonNotification] Permission granted');
    return true;
  } catch (error) {
    console.log('[LessonNotification] Error requesting permissions:', error);
    return false;
  }
}

export async function showLessonNotification(
  session: LessonSession,
  schoolClass: SchoolClass | undefined,
  ratedCount: number,
  totalCount: number
): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('[LessonNotification] Web platform - skipping notification');
    return;
  }

  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('[LessonNotification] No permission to show notification');
      return;
    }

    await Notifications.dismissNotificationAsync(LESSON_NOTIFICATION_ID);

    const className = schoolClass?.name || 'Unbekannte Klasse';
    const progress = totalCount > 0 ? `${ratedCount}/${totalCount} bewertet` : '';

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('lesson-channel', {
        name: 'Aktiver Unterricht',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#007AFF',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: false,
        enableLights: true,
        enableVibrate: false,
        showBadge: true,
      });
    }

    await Notifications.scheduleNotificationAsync({
      identifier: LESSON_NOTIFICATION_ID,
      content: {
        title: `📚 ${className} - ${session.subject}`,
        body: progress ? `Unterricht läuft • ${progress}` : 'Unterricht läuft',
        data: { 
          type: 'lesson-active',
          sessionId: session.id,
          classId: session.classId,
        },
        sound: false,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        sticky: true,
        autoDismiss: false,
        categoryIdentifier: 'lesson-active',
        ...(Platform.OS === 'android' && {
          channelId: 'lesson-channel',
        }),
      },
      trigger: null,
    });

    console.log('[LessonNotification] Notification shown for session:', session.id);
  } catch (error) {
    console.log('[LessonNotification] Error showing notification:', error);
  }
}

export async function updateLessonNotification(
  session: LessonSession,
  schoolClass: SchoolClass | undefined,
  ratedCount: number,
  totalCount: number
): Promise<void> {
  await showLessonNotification(session, schoolClass, ratedCount, totalCount);
}

export async function dismissLessonNotification(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    await Notifications.dismissNotificationAsync(LESSON_NOTIFICATION_ID);
    console.log('[LessonNotification] Notification dismissed');
  } catch (error) {
    console.log('[LessonNotification] Error dismissing notification:', error);
  }
}

export async function setupNotificationCategories(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    await Notifications.setNotificationCategoryAsync('lesson-active', [
      {
        identifier: 'resume',
        buttonTitle: 'Fortsetzen',
        options: {
          opensAppToForeground: true,
        },
      },
      {
        identifier: 'end',
        buttonTitle: 'Beenden',
        options: {
          opensAppToForeground: true,
          isDestructive: true,
        },
      },
    ]);
    console.log('[LessonNotification] Notification categories set up');
  } catch (error) {
    console.log('[LessonNotification] Error setting up categories:', error);
  }
}

export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.EventSubscription {
  return Notifications.addNotificationReceivedListener(callback);
}
