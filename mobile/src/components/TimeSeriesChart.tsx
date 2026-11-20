import { useMemo, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { LineChart } from "react-native-gifted-charts";

import { chartScale } from "@/src/charting";
import { AppColors } from "@/src/theme";

export interface TimeSeriesPoint {
  month: string;
  value: number;
}

export interface TimeSeriesLine {
  name: string;
  color: string;
  points: TimeSeriesPoint[];
}

interface Props {
  colors: AppColors;
  decimals: number;
  lines: TimeSeriesLine[];
  unit: string;
}

interface GiftedPoint {
  value: number;
  month: string;
  label: string;
  labelTextStyle: { color: string; fontSize: number };
}

function shortMonth(month: string) {
  const [year, monthNumber] = month.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[Number(monthNumber) - 1]}\n${year.slice(2)}`;
}

export function TimeSeriesChart({ colors, decimals, lines, unit }: Props) {
  const [width, setWidth] = useState(0);
  const visibleLines = lines.slice(0, 3);
  const scale = useMemo(
    () => chartScale(visibleLines.flatMap((line) => line.points.map((point) => point.value))),
    [visibleLines],
  );
  const longest = Math.max(0, ...visibleLines.map((line) => line.points.length));
  const labelEvery = Math.max(1, Math.ceil(longest / 5));
  const chartData = visibleLines.map((line) => line.points.map((point, index): GiftedPoint => ({
    value: point.value,
    month: point.month,
    label: index % labelEvery === 0 || index === line.points.length - 1 ? shortMonth(point.month) : "",
    labelTextStyle: { color: colors.muted, fontSize: 9 },
  })));

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  if (!visibleLines.length || longest < 2) {
    return <View style={styles.empty}><Text style={{ color: colors.muted }}>Not enough history to chart.</Text></View>;
  }

  const formatValue = (value: number) => `${value.toFixed(decimals)} ${unit}`;
  const pointerLabel = (items: GiftedPoint[]) => {
    if (!items?.length) return null;
    return (
      <View style={[styles.tooltip, { backgroundColor: colors.ink }]}>
        <Text style={[styles.tooltipMonth, { color: colors.panel }]}>{shortMonth(items[0].month).replace("\n", " ")}</Text>
        {items.map((item, index) => (
          <View key={`${visibleLines[index]?.name}-${index}`} style={styles.tooltipRow}>
            <View style={[styles.tooltipDot, { backgroundColor: visibleLines[index]?.color ?? colors.blue }]} />
            <Text numberOfLines={1} style={[styles.tooltipText, { color: colors.panel }]}>
              {visibleLines.length > 1 ? `${visibleLines[index]?.name}: ` : ""}{formatValue(item.value)}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <View onLayout={onLayout} style={styles.wrap}>
      {visibleLines.length > 1 ? (
        <View style={styles.legend}>
          {visibleLines.map((line) => (
            <View key={line.name} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: line.color }]} />
              <Text style={[styles.legendText, { color: colors.ink }]}>{line.name}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {width > 0 ? (
        <LineChart
          adjustToWidth
          areaChart={visibleLines.length === 1}
          color1={visibleLines[0]?.color}
          color2={visibleLines[1]?.color}
          color3={visibleLines[2]?.color}
          data={chartData[0]}
          data2={chartData[1]}
          data3={chartData[2]}
          dataPointsRadius1={0}
          dataPointsRadius2={0}
          dataPointsRadius3={0}
          disableScroll
          endFillColor1={visibleLines[0]?.color}
          endOpacity={0.03}
          endSpacing={8}
          formatYLabel={(label) => Number(label).toFixed(Math.abs(scale.step) < 1 ? 1 : 0)}
          height={245}
          initialSpacing={8}
          maxValue={scale.maxValue}
          mostNegativeValue={scale.mostNegativeValue}
          noOfSections={scale.sections}
          noOfSectionsBelowXAxis={scale.sectionsBelow}
          pointerConfig={{
            activatePointersInstantlyOnTouch: true,
            autoAdjustPointerLabelPosition: true,
            pointerColor: visibleLines[0]?.color,
            pointerLabelComponent: pointerLabel,
            pointerLabelHeight: 76,
            pointerLabelWidth: 156,
            pointerStripColor: colors.muted,
            pointerStripWidth: 1,
            radius: 4,
          }}
          rulesColor={colors.line}
          rulesType="solid"
          startFillColor1={visibleLines[0]?.color}
          startOpacity={0.14}
          thickness1={2.5}
          thickness2={2.5}
          thickness3={2.5}
          width={Math.max(220, width - 54)}
          xAxisColor={colors.ink}
          xAxisLabelTextStyle={{ color: colors.muted, fontSize: 9 }}
          xAxisThickness={1}
          yAxisColor={colors.ink}
          yAxisLabelSuffix={unit ? ` ${unit}` : ""}
          yAxisTextStyle={{ color: colors.muted, fontSize: 9 }}
          yAxisThickness={1}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minHeight: 292, width: "100%" },
  empty: { alignItems: "center", height: 280, justifyContent: "center" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 8 },
  legendItem: { alignItems: "center", flexDirection: "row", gap: 5 },
  legendDot: { borderRadius: 4, height: 8, width: 8 },
  legendText: { fontSize: 11, fontWeight: "700" },
  tooltip: { borderRadius: 6, gap: 3, paddingHorizontal: 8, paddingVertical: 7, width: 150 },
  tooltipMonth: { fontSize: 11, fontWeight: "800", marginBottom: 1 },
  tooltipRow: { alignItems: "center", flexDirection: "row", gap: 5 },
  tooltipDot: { borderRadius: 3, height: 6, width: 6 },
  tooltipText: { flex: 1, fontSize: 10, fontVariant: ["tabular-nums"] },
});
