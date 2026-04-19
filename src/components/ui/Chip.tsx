import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors, Radius, FontSize, FontWeight } from './tokens';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  variant?: 'standard' | 'fixed';
  disabled?: boolean;
}

export function Chip({ label, selected, onPress, variant = 'standard', disabled }: ChipProps) {
  const isFixed = variant === 'fixed';
  return (
    <TouchableOpacity
      style={[
        styles.base,
        isFixed && styles.fixed,
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
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fixed: {
    width: 64,
    height: 38,
    paddingHorizontal: 0,
    paddingVertical: 0,
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
    fontSize: FontSize.label,
    fontWeight: FontWeight.medium,
  },
  textUnselected: {
    color: Colors.textOn,
  },
  textSelected: {
    color: Colors.accent,
  },
});
