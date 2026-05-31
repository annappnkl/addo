import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors, Radius, FontWeight } from './tokens';

interface PreviewChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function PreviewChip({ label, selected, onPress }: PreviewChipProps) {
  return (
    <TouchableOpacity
      style={[styles.base, selected ? styles.selected : styles.unselected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.text, selected ? styles.textSelected : styles.textUnselected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unselected: {
    backgroundColor: Colors.surface,
    borderColor: Colors.borderChip,
  },
  selected: {
    backgroundColor: Colors.accentLight,
    borderColor: Colors.accent,
  },
  text: {
    fontSize: 12,
    fontWeight: FontWeight.regular,
  },
  textUnselected: {
    color: Colors.textOn,
  },
  textSelected: {
    color: Colors.accent,
  },
});
