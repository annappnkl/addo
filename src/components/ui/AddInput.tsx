import { TextInput, TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Colors, Radius, FontWeight } from './tokens';

interface AddInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  actionLabel?: string;
  submitting?: boolean;
}

export function AddInput({
  value,
  onChangeText,
  onSubmit,
  placeholder,
  actionLabel = 'Add',
  submitting = false,
}: AddInputProps) {
  const canSubmit = value.trim().length > 0 && !submitting;
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textSecondary}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        // @ts-ignore — web-only: suppress browser default focus outline
        outlineWidth={0}
      />
      <TouchableOpacity
        style={[styles.submit, { opacity: canSubmit ? 1 : 0.35 }]}
        onPress={onSubmit}
        disabled={!canSubmit}
        activeOpacity={0.85}
      >
        <Text style={styles.submitText}>{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderInput,
    height: 43,
    paddingLeft: 24,
    paddingRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.textOn,
    backgroundColor: 'transparent',
  },
  submit: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
  },
  submitText: {
    fontSize: 13,
    fontWeight: FontWeight.semibold,
    color: '#FFFFFF',
  },
});
