import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Tabs, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../src/db/supabase';
import { CURRENT_TOS_VERSION, CURRENT_PRIVACY_VERSION } from '../../src/constants/legal';

const C = {
  Accent: '#F97316',
  TextSecondary: '#6B7280',
  Surface: '#FFFFFF',
} as const;

export default function AppLayout() {
  const [consentChecked, setConsentChecked] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    void checkConsent();
  }, []);

  async function checkConsent() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace('/(auth)/sign-in');
      return;
    }

    const { data } = await supabase
      .from('user_profiles')
      .select('accepted_tos_version, accepted_privacy_version')
      .eq('user_id', user.id)
      .maybeSingle();

    const needsConsent =
      !data ||
      (data.accepted_tos_version ?? 0) < CURRENT_TOS_VERSION ||
      (data.accepted_privacy_version ?? 0) < CURRENT_PRIVACY_VERSION;

    if (needsConsent) {
      router.replace('/(auth)/consent');
      return;
    }

    setConsentChecked(true);
  }

  if (!consentChecked) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.Accent,
        tabBarInactiveTintColor: C.TextSecondary,
        tabBarLabelStyle: { fontSize: 11 },
        tabBarStyle: {
          backgroundColor: C.Surface,
          borderTopWidth: 0,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
          // Shadow via elevation on Android, boxShadow on web, shadow* on iOS
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.04,
              shadowRadius: 8,
            },
            android: { elevation: 8 },
            web: {
              boxShadow: '0 -2px 8px rgba(0,0,0,0.04)',
            } as object,
          }),
        },
      }}
    >
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color }) => <Feather name="check-square" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="session"
        options={{
          title: 'Session',
          tabBarIcon: ({ color }) => <Feather name="play-circle" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="quests"
        options={{
          title: 'Quests',
          tabBarIcon: ({ color }) => <Feather name="star" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Feather name="settings" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
