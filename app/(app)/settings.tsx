import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../src/components/ui';

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>
      <View style={styles.list}>
        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push('/(app)/areas')}
          activeOpacity={0.7}
        >
          <Text style={styles.rowLabel}>Areas</Text>
          <Feather name="chevron-right" size={20} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderSubtle,
  },
  rowLabel: { fontSize: 16, color: Colors.textPrimary },
});
