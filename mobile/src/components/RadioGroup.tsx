import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppColors } from "@/src/theme";

interface Option<T extends string> {
  label: string;
  value: T;
  disabled?: boolean;
}

export function RadioGroup<T extends string>({
  colors,
  options,
  value,
  onChange,
}: {
  colors: AppColors;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.group}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled: option.disabled }}
            disabled={option.disabled}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.65 }]}
          >
            <View style={[styles.radio, { borderColor: option.disabled ? colors.line : colors.muted }]}>
              {selected ? <View style={[styles.dot, { backgroundColor: colors.blue }]} /> : null}
            </View>
            <Text style={[styles.text, { color: option.disabled ? colors.muted : colors.ink }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 3 },
  row: { alignItems: "center", flexDirection: "row", minHeight: 35 },
  radio: {
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1.5,
    height: 19,
    justifyContent: "center",
    width: 19,
  },
  dot: { borderRadius: 5, height: 9, width: 9 },
  text: { fontSize: 14, marginLeft: 9 },
});
