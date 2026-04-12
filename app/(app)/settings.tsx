import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

const C = {
  Bg: '#FFFFFF',
  TextPrimary: '#1A1A1A',
  TextSecondary: '#6B7280',
} as const;

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.comingSoon}>Coming soon.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.Bg },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: C.TextPrimary },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  comingSoon: { fontSize: 15, color: C.TextSecondary, textAlign: 'center' },
});
