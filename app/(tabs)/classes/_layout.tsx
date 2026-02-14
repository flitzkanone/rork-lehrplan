import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import Colors from '@/constants/colors';

export default function ClassesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: Colors.background,
        },
        headerTitleStyle: {
          fontWeight: '600' as const,
          fontSize: 17,
          color: Colors.text,
        },
        headerShadowVisible: false,
        headerTintColor: Colors.primary,
        ...(Platform.OS === 'web' ? {} : {
          headerBackTitleVisible: false,
        }),
      }}
    >
      <Stack.Screen 
        name="index" 
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen 
        name="[classId]" 
        options={{
          headerShown: true,
        }}
      />
    </Stack>
  );
}
