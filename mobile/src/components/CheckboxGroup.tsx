import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppColors } from "@/src/theme";

interface Option<T extends string> {
  label: string;
  value: T;
  disabled?: boolean;
}

export function CheckboxGroup<T extends string>({
  colors,
  options,
  selected,
  onChange,
}: {
  colors: AppColors;
  options: Option<T>[];
  selected: T[];
  onChange: (selected: T[]) => void;
}) {
  const row = (label: string, checked: boolean, onPress: () => void, key: string, disabled = false) => (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      key={key}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.65 }]}
    >
      <View style={[
        styles.checkbox,
        {
          backgroundColor: checked ? colors.blue : "transparent",
          borderColor: disabled ? colors.line : checked ? colors.blue : colors.muted,
        },
      ]}>
        {checked ? <SymbolView name="checkmark" tintColor="#FFFFFF" size={12} /> : null}
      </View>
      <Text style={[styles.text, { color: disabled ? colors.muted : colors.ink }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.group}>
      {row("All", selected.length === 0, () => onChange([]), "all")}
      {options.map((option) => row(
        option.label,
        selected.includes(option.value),
        () => onChange(selected.includes(option.value)
          ? selected.filter((value) => value !== option.value)
          : [...selected, option.value]),
        option.value,
        option.disabled,
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 3 },
  row: { alignItems: "center", flexDirection: "row", minHeight: 35 },
  checkbox: {
    alignItems: "center",
    borderRadius: 4,
    borderWidth: 1.5,
    height: 19,
    justifyContent: "center",
    width: 19,
  },
  text: { fontSize: 14, marginLeft: 9 },
});
