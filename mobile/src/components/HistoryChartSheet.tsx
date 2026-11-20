import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ChartRange, chartDecimals, chartUnit, historyPoints } from "@/src/charting";
import { InflationEngine } from "@/src/engine/InflationEngine";
import { AppColors } from "@/src/theme";
import { Horizon, InflationItem, Measure } from "@/src/types";
import { SegmentedControl } from "@/src/components/SegmentedControl";
import { TimeSeriesChart } from "@/src/components/TimeSeriesChart";

interface Props {
  colors: AppColors;
  engine: InflationEngine;
  initialHorizon: Horizon;
  initialMeasure: Measure;
  item: InflationItem | null;
  onClose: () => void;
}

export function HistoryChartSheet({ colors, engine, initialHorizon, initialMeasure, item, onClose }: Props) {
  const [horizon, setHorizon] = useState(initialHorizon);
  const [measure, setMeasure] = useState(initialMeasure);
  const [range, setRange] = useState<ChartRange>("5y");
  useEffect(() => {
    if (!item) return;
    setHorizon(initialHorizon);
    setMeasure(initialMeasure);
  }, [initialHorizon, initialMeasure, item]);
  const points = useMemo(
    () => item ? historyPoints(engine, item, horizon, measure, range) : [],
    [engine, horizon, item, measure, range],
  );

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={Boolean(item)}>
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]}>
        <View style={[styles.header, { backgroundColor: colors.panel, borderBottomColor: colors.line }]}>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: colors.muted }]}>HISTORY</Text>
            <Text numberOfLines={2} style={[styles.title, { color: colors.ink }]}>{item ? engine.displayName(item) : ""}</Text>
          </View>
          <Pressable accessibilityLabel="Close chart" onPress={onClose} style={styles.closeButton}>
            <SymbolView name="xmark.circle.fill" tintColor={colors.muted} size={28} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.controlRow}>
            <View style={styles.horizonControl}>
              <SegmentedControl compact colors={colors} value={horizon} onChange={setHorizon} options={[
                { label: "MoM", value: "mom" }, { label: "YoY", value: "yoy" },
              ]} />
            </View>
            <View style={styles.measureControl}>
              <SegmentedControl compact colors={colors} value={measure} onChange={setMeasure} options={[
                { label: "Ctrb", value: "contribution" }, { label: "Price", value: "price" }, { label: "Weight", value: "weight" },
              ]} />
            </View>
          </View>
          <SegmentedControl compact colors={colors} value={range} onChange={setRange} options={[
            { label: "1 year", value: "1y" }, { label: "5 years", value: "5y" }, { label: "All", value: "all" },
          ]} />
          <View style={[styles.chartCard, { backgroundColor: colors.panel, borderColor: colors.line }]}>
            <View style={styles.chartHeadingRow}>
              <View>
                <Text style={[styles.chartTitle, { color: colors.ink }]}>{measure === "contribution" ? "Inflation contribution" : measure === "price" ? "Price change" : "Basket weight"}</Text>
                <Text style={[styles.chartSubtitle, { color: colors.muted }]}>{measure === "weight" ? "Share of the basket" : horizon === "mom" ? "Month-on-month" : "Year-on-year"}</Text>
              </View>
              <Text style={[styles.unit, { color: colors.blue }]}>{chartUnit(measure)}</Text>
            </View>
            <TimeSeriesChart
              colors={colors}
              decimals={chartDecimals(measure)}
              lines={[{ name: engine.displayName(item!), color: colors.blue, points }]}
              unit={chartUnit(measure)}
            />
            <Text style={[styles.hint, { color: colors.muted }]}>Touch and drag across the chart to inspect each month.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", padding: 14 },
  headerCopy: { flex: 1, paddingRight: 10 },
  eyebrow: { fontSize: 10, fontWeight: "800" },
  title: { fontSize: 18, fontWeight: "800", lineHeight: 22 },
  closeButton: { alignItems: "center", height: 40, justifyContent: "center", width: 40 },
  content: { gap: 10, padding: 14, paddingBottom: 40 },
  controlRow: { flexDirection: "row", gap: 8 },
  horizonControl: { flex: 0.7 },
  measureControl: { flex: 1.3 },
  chartCard: { borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden", padding: 12 },
  chartHeadingRow: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  chartTitle: { fontSize: 16, fontWeight: "800" },
  chartSubtitle: { fontSize: 11, marginTop: 2 },
  unit: { fontSize: 12, fontWeight: "800" },
  hint: { fontSize: 10, marginTop: 4, textAlign: "center" },
});
