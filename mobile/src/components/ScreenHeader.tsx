import { PropsWithChildren } from "react";
import { StyleSheet, Text, useColorScheme, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colorsFor } from "@/src/theme";

interface Props extends PropsWithChildren {
  title: string;
  subtitle?: string;
}

export function ScreenHeader({ title, subtitle, children }: Props) {
  const colors = colorsFor(useColorScheme());
  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.canvas }}>
      <View style={[styles.header, { backgroundColor: colors.panel, borderBottomColor: colors.line }]}>
        <Text selectable style={[styles.title, { color: colors.ink }]}>{title}</Text>
        {subtitle ? <Text selectable style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { borderBottomWidth: StyleSheet.hairlineWidth, gap: 3, paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { fontSize: 12, lineHeight: 16 },
});
