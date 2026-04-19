import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../src/components/ui';

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
  root: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  comingSoon: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
});
