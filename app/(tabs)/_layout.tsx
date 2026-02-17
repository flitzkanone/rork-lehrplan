import React from 'react';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { BookOpen, CalendarDays, Users, BarChart3, Settings } from 'lucide-react-native';
import Colors from '@/constants/colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textLight,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.divider,
          borderTopWidth: 0.5,
          elevation: 0,
          shadowColor: 'transparent',
          ...(Platform.OS === 'web' ? {} : {
            shadowOffset: { width: 0, height: -1 },
            shadowOpacity: 0.03,
            shadowRadius: 4,
          }),
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600' as const,
          letterSpacing: 0.3,
          marginTop: -2,
        },
        tabBarIconStyle: {
          marginBottom: -2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="(lesson)"
        options={{
          title: 'Unterricht',
          tabBarIcon: ({ color, size }) => <BookOpen size={size - 3} color={color} strokeWidth={1.7} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Stundenplan',
          tabBarIcon: ({ color, size }) => <CalendarDays size={size - 3} color={color} strokeWidth={1.7} />,
        }}
      />
      <Tabs.Screen
        name="classes"
        options={{
          title: 'Klassen',
          tabBarIcon: ({ color, size }) => <Users size={size - 3} color={color} strokeWidth={1.7} />,
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          title: 'Statistik',
          tabBarIcon: ({ color, size }) => <BarChart3 size={size - 3} color={color} strokeWidth={1.7} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <Settings size={size - 3} color={color} strokeWidth={1.7} />,
        }}
      />
    </Tabs>
  );
}
