import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, useColorScheme, View } from "react-native";

import { ScreenHeader } from "@/src/components/ScreenHeader";
import { SegmentedControl } from "@/src/components/SegmentedControl";
import { useAppData } from "@/src/context/AppDataContext";
import { InflationEngine, prepareSeries } from "@/src/engine/InflationEngine";
import { colorsFor } from "@/src/theme";
import { Horizon, IndexFamily } from "@/src/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function heatmapColors(value: number | undefined) {
  if (value === undefined) return { backgroundColor: "#F1F1F1", color: "#111111" };
  const absolute = Math.abs(value);
  if (absolute < 0.5) return { backgroundColor: "#F7FBF7", color: "#111111" };
  if (absolute < 2) {
    return value > 0
      ? { backgroundColor: "#D9EAD3", color: "#174E24" }
      : { backgroundColor: "#F4CCCC", color: "#7F1D1D" };
  }
  if (absolute < 5) {
    return value > 0
      ? { backgroundColor: "#93C47D", color: "#0B3415" }
      : { backgroundColor: "#E06666", color: "#FFFFFF" };
  }
  return value > 0
    ? { backgroundColor: "#38761D", color: "#FFFFFF" }
    : { backgroundColor: "#990000", color: "#FFFFFF" };
}

export default function ErrorsScreen() {
  const colors = colorsFor(useColorScheme());
  const { data } = useAppData();
  const [family, setFamily] = useState<IndexFamily>("CPI");
  const [horizon, setHorizon] = useState<Horizon>("mom");
  const matrix = useMemo(() => {
    const series = prepareSeries(data.series[family]);
    const engine = new InflationEngine(series, { sector: "all", core: "all", boe: "all" });
    const leafLevel = family === "RPI" ? 3 : 4;
    const leaves = series.items.filter((item) => item.level === leafLevel);
    const values = new Map<string, number>();
    series.months.forEach((month, monthIndex) => {
      const calculated = leaves.reduce((sum, item) => sum + engine.contribution(item, monthIndex, horizon), 0) * 100;
      const headline = engine.value(engine.allItems(), monthIndex, horizon, "price") * 100;
      const error = calculated - headline;
      if (Number.isFinite(error)) values.set(month, error);
    });
    const years = [...new Set(series.months.map((month) => Number(month.slice(0, 4))))].sort((a, b) => b - a);
    return { values, years };
  }, [data, family, horizon]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <ScreenHeader title="Error check" subtitle="Calculated Level 4 (Level 3 for RPI) contributions minus the published headline rate, in basis points.">
        <View style={styles.controls}>
          <SegmentedControl colors={colors} value={family} onChange={setFamily} options={[
            { label: "CPI", value: "CPI" }, { label: "CPIH", value: "CPIH" }, { label: "RPI", value: "RPI" },
          ]} />
          <SegmentedControl colors={colors} value={horizon} onChange={setHorizon} options={[
            { label: "Month on month", value: "mom" }, { label: "Year on year", value: "yoy" },
          ]} />
        </View>
      </ScreenHeader>
      <View style={[styles.matrixTitle, { backgroundColor: colors.blue }]}>
        <Text selectable style={styles.matrixTitleText}>{family} {horizon === "mom" ? "MoM" : "YoY"} Error, bp</Text>
      </View>
      <ScrollView horizontal contentContainerStyle={styles.matrix} showsHorizontalScrollIndicator>
        <View>
          <View style={[styles.row, { backgroundColor: colors.blue }]}>
            <Text selectable style={[styles.monthCell, styles.headerText]}>Month</Text>
            {matrix.years.map((year) => <Text selectable key={year} style={[styles.valueCell, styles.headerText]}>{year}</Text>)}
          </View>
          {MONTHS.map((month, monthIndex) => (
            <View
              key={month}
              style={[
                styles.row,
                {
                  backgroundColor: monthIndex % 2 ? colors.blueLight : colors.panel,
                  borderBottomColor: colors.line,
                },
              ]}
            >
              <Text selectable style={[styles.monthCell, { color: colors.ink }]}>{month}</Text>
              {matrix.years.map((year) => {
                const value = matrix.values.get(`${year}-${String(monthIndex + 1).padStart(2, "0")}`);
                const display = value === undefined ? "" : (Math.abs(value) < 0.05 ? 0 : value).toFixed(1);
                return <Text selectable key={year} style={[styles.valueCell, heatmapColors(value)]}>{display}</Text>;
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  controls: { gap: 8, marginTop: 8 },
  matrixTitle: { paddingHorizontal: 12, paddingVertical: 7 },
  matrixTitleText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  matrix: { paddingBottom: 8 },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", minHeight: 31 },
  monthCell: { fontSize: 12, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 7, width: 64 },
  valueCell: { fontSize: 12, fontVariant: ["tabular-nums"], paddingHorizontal: 6, paddingVertical: 7, textAlign: "center", width: 62 },
  headerText: { color: "#FFFFFF", fontWeight: "800", textAlign: "center" },
});
