import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors, Radius, FontWeight } from './tokens';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}

export function Chip({ label, selected, onPress, disabled }: ChipProps) {
  return (
    <TouchableOpacity
      style={[
        styles.base,
        selected ? styles.selected : styles.unselected,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <Text style={[styles.text, selected ? styles.textSelected : styles.textUnselected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 12,
    paddingVertical: 6,
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
  disabled: {
    opacity: 0.4,
  },
  text: {
    fontSize: 13,
    fontWeight: FontWeight.medium,
  },
  textUnselected: {
    color: Colors.textOn,
  },
  textSelected: {
    color: Colors.accent,
  },
});
