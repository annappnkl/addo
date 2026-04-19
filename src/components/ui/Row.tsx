import { View, Text, StyleSheet, type ViewProps } from 'react-native';
import { Colors, FontSize, FontWeight } from './tokens';

/** Flat divider row — base container for list items */
export function ListRow({ style, children, ...rest }: ViewProps) {
  return (
    <View style={[styles.row, style]} {...rest}>
      {children}
    </View>
  );
}

interface ItemNameProps {
  children: string;
  muted?: boolean;
}

/** Primary task/item name text */
export function ItemName({ children, muted }: ItemNameProps) {
  return (
    <Text style={[styles.name, muted && styles.nameMuted]} numberOfLines={1}>
      {children}
    </Text>
  );
}

interface ItemMetaProps {
  children: string;
}

/** Secondary metadata text (duration, time, etc.) */
export function ItemMeta({ children }: ItemMetaProps) {
  return <Text style={styles.meta}>{children}</Text>;
}

interface SectionHeaderProps {
  label: string;
}

/** Uppercase section label */
export function SectionHeader({ label }: SectionHeaderProps) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.borderSubtle,
  },
  name: {
    flex: 1,
    fontSize: FontSize.taskName,
    fontWeight: FontWeight.regular,
    color: Colors.taskName,
  },
  nameMuted: {
    color: Colors.textMuted,
  },
  meta: {
    fontSize: FontSize.taskDuration,
    fontWeight: FontWeight.light,
    color: Colors.textMuted,
    flexShrink: 0,
  },
  sectionHeader: {
    fontSize: FontSize.label,
    fontWeight: FontWeight.medium,
    color: Colors.textMuted,
  },
});
