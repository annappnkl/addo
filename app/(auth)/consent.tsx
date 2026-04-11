import { useState } from 'react';
import {
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../../src/db/supabase';
import {
  CURRENT_TOS_VERSION,
  CURRENT_PRIVACY_VERSION,
  TOS_URL,
  PRIVACY_URL,
} from '../../src/constants/legal';

export default function ConsentScreen() {
  const [tosAccepted, setTosAccepted] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);

  async function acceptAndContinue() {
    if (!tosAccepted || !privacyAcknowledged) {
      Alert.alert(
        'One more step',
        'Please tap both buttons to confirm you\'ve read our Terms and Privacy Policy.'
      );
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      router.replace('/(auth)/sign-in');
      return;
    }

    const now = new Date().toISOString();

    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: user.id,
        accepted_tos_version: CURRENT_TOS_VERSION,
        accepted_privacy_version: CURRENT_PRIVACY_VERSION,
        updated_at: now,
      }, { onConflict: 'user_id' });

    setSaving(false);

    if (error) {
      Alert.alert('Something went wrong', 'Could not save your consent. Please try again.');
      return;
    }

    router.replace('/(app)/tasks');
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Before you start</Text>
      <Text style={styles.body}>
        ADDo stores your tasks, sessions, and areas on our servers so they sync across your devices.
        We collect only what you give us — no third-party trackers, no selling your data.{'\n\n'}
        You can download or delete all your data at any time from Settings. Our servers are in the EU.
      </Text>

      <TouchableOpacity
        style={[styles.consentButton, tosAccepted && styles.consentAccepted]}
        onPress={() => setTosAccepted(true)}
      >
        <Text style={[styles.consentText, tosAccepted && styles.consentTextAccepted]}>
          {tosAccepted ? '✓ ' : ''}I've read and accept the{' '}
          <Text
            style={styles.link}
            onPress={() => WebBrowser.openBrowserAsync(TOS_URL)}
          >
            Terms of Service
          </Text>
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.consentButton, privacyAcknowledged && styles.consentAccepted]}
        onPress={() => setPrivacyAcknowledged(true)}
      >
        <Text style={[styles.consentText, privacyAcknowledged && styles.consentTextAccepted]}>
          {privacyAcknowledged ? '✓ ' : ''}I acknowledge the{' '}
          <Text
            style={styles.link}
            onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
          >
            Privacy Policy
          </Text>
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.continueButton,
          (!tosAccepted || !privacyAcknowledged || saving) && styles.continueDisabled,
        ]}
        onPress={acceptAndContinue}
        disabled={saving}
      >
        <Text style={styles.continueText}>
          {saving ? 'Saving…' : 'Continue to ADDo'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
    color: '#1a1a1a',
  },
  body: {
    fontSize: 15,
    lineHeight: 24,
    color: '#444',
    marginBottom: 32,
  },
  consentButton: {
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  consentAccepted: { borderColor: '#1a1a1a', backgroundColor: '#f5f5f5' },
  consentText: { fontSize: 15, color: '#444', lineHeight: 22 },
  consentTextAccepted: { color: '#1a1a1a', fontWeight: '500' },
  link: { textDecorationLine: 'underline', color: '#1a1a1a' },
  continueButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  continueDisabled: { opacity: 0.4 },
  continueText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
