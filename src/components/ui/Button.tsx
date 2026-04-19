import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors, Radius, FontSize, FontWeight } from './tokens';

interface ButtonProps {
  label: string;
  onPress: () => void;
  size?: 'default' | 'small';
  disabled?: boolean;
}

export function PrimaryButton({ label, onPress, size = 'default', disabled }: ButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.base, styles.primary, size === 'small' && styles.small, disabled && styles.disabled]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled}
    >
      <Text style={[styles.text, styles.primaryText, size === 'small' && styles.smallText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function SecondaryButton({ label, onPress, size = 'default', disabled }: ButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.base, styles.secondary, size === 'small' && styles.small, disabled && styles.disabled]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled}
    >
      <Text style={[styles.text, styles.secondaryText, size === 'small' && styles.smallText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function GhostButton({ label, onPress, size = 'default', disabled }: ButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.base, styles.ghost, size === 'small' && styles.small, disabled && styles.disabled]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled}
    >
      <Text style={[styles.text, styles.ghostText, size === 'small' && styles.smallText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.btn,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  small: {
    height: 38,
    paddingHorizontal: 16,
  },
  disabled: {
    opacity: 0.4,
  },

  primary: {
    backgroundColor: Colors.accent,
  },
  secondary: {
    backgroundColor: Colors.surfaceAlt,
  },
  ghost: {
    backgroundColor: 'transparent',
  },

  text: {
    fontSize: FontSize.subheading,
    fontWeight: FontWeight.bold,
  },
  smallText: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.semibold,
  },
  primaryText: {
    color: '#FFFFFF',
  },
  secondaryText: {
    color: Colors.textPrimary,
    fontWeight: FontWeight.semibold,
  },
  ghostText: {
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
  },
});
