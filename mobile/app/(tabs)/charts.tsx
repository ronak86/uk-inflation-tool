import { SymbolView } from "expo-symbols";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ChartRange, chartDecimals, chartUnit, contributionDrivers, historyPoints } from "@/src/charting";
import { SegmentedControl } from "@/src/components/SegmentedControl";
import { TimeSeriesChart } from "@/src/components/TimeSeriesChart";
import { useAppData } from "@/src/context/AppDataContext";
import { InflationEngine, prepareSeries } from "@/src/engine/InflationEngine";
import { colorsFor } from "@/src/theme";
import { FilterState, Horizon, IndexFamily } from "@/src/types";

type ChartView = "drivers" | "headlines";

const noFilters: FilterState = { sector: "all", core: "all", boe: "all", importIntensity: [], energyIntensity: [] };
const monthFormatter = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

function monthLabel(month: string) {
  return monthFormatter.format(new Date(`${month}-01T00:00:00Z`));
}

export default function ChartsScreen() {
  const colors = colorsFor(useColorScheme());
  const { data } = useAppData();
  const [view, setView] = useState<ChartView>("drivers");
  const [family, setFamily] = useState<IndexFamily>("CPI");
  const [horizon, setHorizon] = useState<Horizon>("yoy");
  const [monthOffset, setMonthOffset] = useState(0);
  const [range, setRange] = useState<ChartRange>("5y");

  const engines = useMemo(() => ({
    CPI: new InflationEngine(prepareSeries(data.series.CPI), noFilters),
    CPIH: new InflationEngine(prepareSeries(data.series.CPIH), noFilters),
    RPI: new InflationEngine(prepareSeries(data.series.RPI), noFilters),
  }), [data]);
  const engine = engines[family];
  const monthIndex = Math.max(0, engine.data.months.length - 1 - monthOffset);
  const drivers = useMemo(() => contributionDrivers(engine, monthIndex, horizon), [engine, horizon, monthIndex]);
  const largestDriver = Math.max(1, ...drivers.positive.map((point) => point.value), ...drivers.negative.map((point) => Math.abs(point.value)));
  const headlineLines = useMemo(() => ([
    { name: "CPI", color: colors.blue, points: historyPoints(engines.CPI, engines.CPI.allItems(), horizon, "price", range) },
    { name: "CPIH", color: colors.amber, points: historyPoints(engines.CPIH, engines.CPIH.allItems(), horizon, "price", range) },
    { name: "RPI", color: colors.red, points: historyPoints(engines.RPI, engines.RPI.allItems(), horizon, "price", range) },
  ]), [colors.amber, colors.blue, colors.red, engines, horizon, range]);

  const updateFamily = (next: IndexFamily) => { setFamily(next); setMonthOffset(0); };
  const moveMonth = (amount: number) => setMonthOffset((current) => Math.min(engine.data.months.length - 1, Math.max(0, current + amount)));

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: colors.canvas }]}>
      <View style={[styles.header, { backgroundColor: colors.panel, borderBottomColor: colors.line }]}>
        <Text style={[styles.title, { color: colors.ink }]}>Charts</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>Explore movements and monthly inflation drivers</Text>
        <SegmentedControl colors={colors} value={view} onChange={setView} options={[
          { label: "Monthly drivers", value: "drivers" }, { label: "Headline trends", value: "headlines" },
        ]} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {view === "drivers" ? (
          <>
            <SegmentedControl compact colors={colors} value={family} onChange={updateFamily} options={[
              { label: "CPI", value: "CPI" }, { label: "CPIH", value: "CPIH" }, { label: "RPI", value: "RPI" },
            ]} />
            <SegmentedControl compact colors={colors} value={horizon} onChange={setHorizon} options={[
              { label: "MoM contribution", value: "mom" }, { label: "YoY contribution", value: "yoy" },
            ]} />
            <View style={styles.monthRow}>
              <Pressable accessibilityLabel="Older month" disabled={monthIndex === 0} onPress={() => moveMonth(1)} style={styles.monthButton}>
                <SymbolView name="chevron.left" tintColor={monthIndex === 0 ? colors.line : colors.ink} size={20} />
              </Pressable>
              <View style={styles.monthCopy}>
                <Text style={[styles.month, { color: colors.ink }]}>{monthLabel(engine.data.months[monthIndex])}</Text>
                <Text style={[styles.monthCaption, { color: colors.muted }]}>Contribution to {family} inflation, bp</Text>
              </View>
              <Pressable accessibilityLabel="Newer month" disabled={monthOffset === 0} onPress={() => moveMonth(-1)} style={styles.monthButton}>
                <SymbolView name="chevron.right" tintColor={monthOffset === 0 ? colors.line : colors.ink} size={20} />
              </Pressable>
            </View>
            <DriverSection colors={colors} empty="No positive contributions" largest={largestDriver} points={drivers.positive} title="UPWARD DRIVERS" />
            <DriverSection colors={colors} empty="No negative contributions" largest={largestDriver} negative points={drivers.negative} title="DOWNWARD DRIVERS" />
          </>
        ) : (
          <>
            <SegmentedControl compact colors={colors} value={horizon} onChange={setHorizon} options={[
              { label: "MoM", value: "mom" }, { label: "YoY", value: "yoy" },
            ]} />
            <SegmentedControl compact colors={colors} value={range} onChange={setRange} options={[
              { label: "1 year", value: "1y" }, { label: "5 years", value: "5y" }, { label: "All", value: "all" },
            ]} />
            <View style={[styles.chartSection, { backgroundColor: colors.panel, borderColor: colors.line }]}>
              <Text style={[styles.sectionTitle, { color: colors.ink }]}>Headline inflation</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>{horizon === "mom" ? "Month-on-month price change" : "Year-on-year price change"}</Text>
              <TimeSeriesChart colors={colors} decimals={chartDecimals("price")} lines={headlineLines} unit={chartUnit("price")} />
              <Text style={[styles.hint, { color: colors.muted }]}>Touch and drag across the chart to compare each month.</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DriverSection({ colors, empty, largest, negative, points, title }: {
  colors: ReturnType<typeof colorsFor>;
  empty: string;
  largest: number;
  negative?: boolean;
  points: ReturnType<typeof contributionDrivers>["positive"];
  title: string;
}) {
  const barColor = negative ? colors.red : colors.green;
  return (
    <View style={[styles.driverSection, { backgroundColor: colors.panel, borderColor: colors.line }]}>
      <Text style={[styles.driverHeading, { color: colors.muted }]}>{title}</Text>
      {!points.length ? <Text style={[styles.empty, { color: colors.muted }]}>{empty}</Text> : points.map((point) => (
        <View key={point.item.id} style={styles.driverRow}>
          <View style={styles.driverLabelRow}>
            <Text numberOfLines={1} style={[styles.driverName, { color: colors.ink }]}>{point.item.name.replace(/^\s*\d+(?:\.\d+)*\s*/, "")}</Text>
            <Text style={[styles.driverValue, { color: barColor }]}>{point.value.toFixed(1)} bp</Text>
          </View>
          <View style={[styles.barTrack, { backgroundColor: colors.panelMuted }]}>
            <View style={[styles.bar, { backgroundColor: barColor, width: `${Math.max(2, Math.abs(point.value) / largest * 100)}%` }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { borderBottomWidth: StyleSheet.hairlineWidth, gap: 2, padding: 14 },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { fontSize: 12, marginBottom: 10 },
  content: { gap: 10, padding: 14, paddingBottom: 36 },
  monthRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 58 },
  monthButton: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
  monthCopy: { alignItems: "center", flex: 1 },
  month: { fontSize: 18, fontWeight: "800" },
  monthCaption: { fontSize: 11, marginTop: 2 },
  driverSection: { borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, gap: 10, padding: 12 },
  driverHeading: { fontSize: 11, fontWeight: "800" },
  driverRow: { gap: 5 },
  driverLabelRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  driverName: { flex: 1, fontSize: 13 },
  driverValue: { fontSize: 12, fontVariant: ["tabular-nums"], fontWeight: "800" },
  barTrack: { borderRadius: 3, height: 6, overflow: "hidden" },
  bar: { borderRadius: 3, height: 6 },
  empty: { fontSize: 12, paddingVertical: 8 },
  chartSection: { borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", padding: 12 },
  sectionTitle: { fontSize: 17, fontWeight: "800" },
  sectionSubtitle: { fontSize: 11, marginBottom: 10, marginTop: 2 },
  hint: { fontSize: 10, marginTop: 4, textAlign: "center" },
});
