import { useState } from 'react';
import { TextInput, StyleSheet, type TextInputProps } from 'react-native';
import { Colors, Radius, FontSize, FontWeight } from './tokens';

type PillInputProps = Omit<TextInputProps, 'style'>;

/** Transparent pill-shaped input — used inline inside rows */
export function PillInput(props: PillInputProps) {
  return (
    <TextInput
      style={styles.pill}
      placeholderTextColor={Colors.textMuted}
      {...props}
    />
  );
}

type FieldInputProps = Omit<TextInputProps, 'style'>;

/** Bordered rectangle input — used in forms/edit panels */
export function FieldInput(props: FieldInputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      style={[styles.field, focused && styles.fieldFocused]}
      placeholderTextColor={Colors.textMuted}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  pill: {
    flex: 1,
    fontSize: FontSize.subheading,
    fontWeight: FontWeight.regular,
    color: Colors.taskName,
    backgroundColor: 'transparent',
    paddingVertical: 0,
    paddingHorizontal: 0,
    // @ts-ignore — web only
    outlineWidth: 0,
  },
  field: {
    fontSize: FontSize.body,
    fontWeight: FontWeight.regular,
    color: Colors.textPrimary,
    backgroundColor: Colors.inputBg,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.borderInput,
    paddingHorizontal: 12,
    paddingVertical: 10,
    // @ts-ignore — web only
    outlineWidth: 0,
  },
  fieldFocused: {
    borderColor: Colors.accent,
    backgroundColor: Colors.surface,
  },
});
