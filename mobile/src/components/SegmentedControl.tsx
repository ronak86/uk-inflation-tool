import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppColors } from "@/src/theme";

interface Option<T extends string> {
  label: string;
  value: T;
}

interface Props<T extends string> {
  colors: AppColors;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  compact?: boolean;
}

export function SegmentedControl<T extends string>({ colors, options, value, onChange, compact }: Props<T>) {
  return (
    <View style={[styles.track, { backgroundColor: colors.panelMuted, borderColor: colors.line }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.option,
              compact && styles.compact,
              selected && { backgroundColor: colors.blue },
              pressed && { opacity: 0.72 },
            ]}
          >
            <Text style={[styles.label, { color: selected ? "#FFFFFF" : colors.ink }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    padding: 3,
  },
  option: {
    alignItems: "center",
    borderRadius: 6,
    flex: 1,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  compact: { minHeight: 34 },
  label: { fontSize: 13, fontWeight: "700" },
});
