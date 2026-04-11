import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { supabase } from '../../src/db/supabase';
import { CURRENT_TOS_VERSION, CURRENT_PRIVACY_VERSION } from '../../src/constants/legal';

export default function AppLayout() {
  const [consentChecked, setConsentChecked] = useState(false);

  useEffect(() => {
    checkConsent();
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

  return <Stack screenOptions={{ headerShown: false }} />;
}
