import { SymbolView } from "expo-symbols";
import { Linking, ScrollView, StyleSheet, Text, useColorScheme, View } from "react-native";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { colorsFor } from "@/src/theme";

const features = [
  "CPI, CPIH and RPI",
  "Month-on-month and year-on-year views",
  "Weights, price changes and contribution estimates",
  "Full basket drill-down and search",
  "Services, goods, core and non-core filters",
  "BoE Services and RPI housing classifications",
  "Calculation error checks",
  "Automatic live ONS data refresh with an offline fallback",
];

export default function AboutScreen() {
  const colors = colorsFor(useColorScheme());
  return (
    <View style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <ScreenHeader title="UK Inflation" subtitle="A native companion for exploring the UK inflation basket." />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.panel, borderColor: colors.line }]}>
          <Text selectable style={[styles.heading, { color: colors.ink }]}>What it does</Text>
          {features.map((feature) => (
            <View key={feature} style={styles.feature}>
              <SymbolView name="checkmark.circle.fill" tintColor={colors.green} size={17} />
              <Text selectable style={[styles.featureText, { color: colors.ink }]}>{feature}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.card, { backgroundColor: colors.panel, borderColor: colors.line }]}>
          <Text selectable style={[styles.heading, { color: colors.ink }]}>Sources and method</Text>
          <Text selectable style={[styles.body, { color: colors.muted }]}>All weights, index values and source series are published by the Office for National Statistics. Contribution calculations follow the ONS Consumer Prices Indices Technical Manual, 2019.</Text>
          <Text onPress={() => Linking.openURL("https://www.ons.gov.uk/")} style={[styles.link, { color: colors.blue }]}>Open the ONS website</Text>
          <Text onPress={() => Linking.openURL("https://www.ons.gov.uk/economy/inflationandpriceindices/methodologies/consumerpricesindicestechnicalmanual2019")} style={[styles.link, { color: colors.blue }]}>Read the technical manual</Text>
        </View>
        <View style={[styles.card, { backgroundColor: colors.panel, borderColor: colors.line }]}>
          <Text selectable style={[styles.heading, { color: colors.ink }]}>Built by Ronak Chitroda</Text>
          <Text selectable style={[styles.body, { color: colors.muted }]}>The calculation workbook and sector definitions were compiled manually, then the tool was developed iteratively with ChatGPT Codex.</Text>
          <Text onPress={() => Linking.openURL("mailto:ronak@chitroda.com?subject=UK%20Inflation%20Tool")} style={[styles.link, { color: colors.blue }]}>ronak@chitroda.com</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: 12, padding: 14, paddingBottom: 36 },
  card: { borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, padding: 15 },
  heading: { fontSize: 17, fontWeight: "800", marginBottom: 10 },
  feature: { alignItems: "center", flexDirection: "row", gap: 8, marginVertical: 5 },
  featureText: { flex: 1, fontSize: 14, lineHeight: 19 },
  body: { fontSize: 14, lineHeight: 20, marginBottom: 9 },
  link: { fontSize: 14, fontWeight: "700", marginTop: 8, textDecorationLine: "underline" },
});
