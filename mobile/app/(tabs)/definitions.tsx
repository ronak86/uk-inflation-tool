import { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, useColorScheme, View } from "react-native";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SegmentedControl } from "@/src/components/SegmentedControl";
import { useAppData } from "@/src/context/AppDataContext";
import { prepareSeries } from "@/src/engine/InflationEngine";
import { colorsFor } from "@/src/theme";
import { IndexFamily } from "@/src/types";

function category(value: boolean, yes: string, no: string) {
  return value ? yes : no;
}

function importLabel(item: ReturnType<typeof prepareSeries>["items"][number]) {
  if (!item.intensity?.import) return "Import: Unclassified";
  const rate = item.intensity.import.total;
  return `Import: ${item.intensity.import.group}${rate == null ? "" : ` (${(rate * 100).toFixed(1)}%)`}`;
}

function energyLabel(item: ReturnType<typeof prepareSeries>["items"][number]) {
  if (!item.intensity?.energy) return "Energy: Unclassified";
  const rate = item.intensity.energy.rate;
  return `Energy: ${item.intensity.energy.group}${rate == null ? "" : ` (${(rate * 100).toFixed(1)}%)`}`;
}

export default function DefinitionsScreen() {
  const colors = colorsFor(useColorScheme());
  const { data } = useAppData();
  const [family, setFamily] = useState<IndexFamily>("CPI");
  const [query, setQuery] = useState("");
  const series = useMemo(() => prepareSeries(data.series[family]), [data, family]);
  const latest = series.months.length - 1;
  const rows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return series.items.filter((item) => item.level === (family === "RPI" ? 3 : 4))
      .filter((item) => !search || `${item.name} ${item.weightCode} ${item.priceCode}`.toLowerCase().includes(search));
  }, [family, query, series]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <ScreenHeader title="Definitions" subtitle={family === "CPIH" ? "Includes CPI-derived energy classifications; OOH and Council Tax are unclassified." : "See how every most-granular basket item is classified."}>
        <View style={styles.controls}>
          <SegmentedControl colors={colors} value={family} onChange={setFamily} options={[
            { label: "CPI", value: "CPI" }, { label: "CPIH", value: "CPIH" }, { label: "RPI", value: "RPI" },
          ]} />
          <TextInput
            autoCorrect={false}
            clearButtonMode="while-editing"
            onChangeText={setQuery}
            placeholder="Search name or ONS code"
            placeholderTextColor={colors.muted}
            selectTextOnFocus={false}
            selectionColor={colors.blue}
            style={[styles.search, { backgroundColor: colors.panelMuted, borderColor: colors.line, color: colors.ink }]}
            value={query}
          />
        </View>
      </ScreenHeader>
      <View style={[styles.heading, { backgroundColor: colors.blue }]}>
        <Text style={styles.headingName}>Basket item</Text>
        <Text style={styles.headingMeta}>Classification</Text>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item) => `${item.weightCode}:${item.priceCode}`}
        renderItem={({ item, index }) => {
          const weight = item.weights[latest];
          return (
            <View style={[styles.row, { backgroundColor: index % 2 ? colors.blueLight : colors.panel, borderBottomColor: colors.line }]}>
              <View style={styles.nameBlock}>
                <Text selectable style={[styles.name, { color: colors.ink }]}>{item.name}</Text>
                <Text selectable style={[styles.codes, { color: colors.muted }]}>{item.weightCode}  |  {item.priceCode}  |  {weight == null ? "n/a" : `${(weight / 10).toFixed(2)}%`}</Text>
              </View>
              <View style={styles.tags}>
                <Tag label={category(item.sectors.services, "Services", "Goods")} />
                <Tag label={category(item.sectors.nonCore, "Non Core", "Core")} />
                {family === "RPI" && item.sectors.housing ? <Tag label="Housing" /> : null}
                {family !== "RPI" && item.sectors.boe ? <Tag label="BoE Services" /> : null}
                {series.classifications?.importIntensity ? <Tag label={importLabel(item)} /> : null}
                {series.classifications?.energyIntensity ? <Tag label={energyLabel(item)} /> : null}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

function Tag({ label }: { label: string }) {
  const colors = colorsFor(useColorScheme());
  return <Text style={[styles.tag, { backgroundColor: colors.panelMuted, color: colors.ink }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  controls: { gap: 8, marginTop: 8 },
  search: { borderRadius: 7, borderWidth: 1, fontSize: 14, height: 38, paddingHorizontal: 11 },
  heading: { alignItems: "center", flexDirection: "row", minHeight: 29, paddingHorizontal: 12 },
  headingName: { color: "#FFFFFF", flex: 1, fontSize: 12, fontWeight: "800" },
  headingMeta: { color: "#FFFFFF", fontSize: 12, fontWeight: "800", width: 158 },
  row: { alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", minHeight: 58, paddingHorizontal: 12, paddingVertical: 7 },
  nameBlock: { flex: 1, paddingRight: 8 },
  name: { fontSize: 12, lineHeight: 16 },
  codes: { fontSize: 10, marginTop: 3 },
  tags: { alignItems: "flex-start", gap: 3, width: 158 },
  tag: { borderRadius: 4, fontSize: 10, overflow: "hidden", paddingHorizontal: 5, paddingVertical: 2 },
});
