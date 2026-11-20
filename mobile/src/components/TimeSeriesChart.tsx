import { useMemo, useState } from "react";
import { GestureResponderEvent, LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";

import { chartScale } from "@/src/charting";
import { AppColors } from "@/src/theme";

export interface TimeSeriesPoint { month: string; value: number; }
export interface TimeSeriesLine { name: string; color: string; points: TimeSeriesPoint[]; }
interface Props { colors: AppColors; decimals: number; lines: TimeSeriesLine[]; unit: string; }

const chartHeight = 270;
const margin = { top: 18, right: 10, bottom: 36, left: 47 };

function shortMonth(month: string) {
  const [year, monthNumber] = month.split("-");
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[Number(monthNumber) - 1]} ${year.slice(2)}`;
}

function linePath(points: TimeSeriesPoint[], x: (index: number) => number, y: (value: number) => number) {
  return points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(2)},${y(point.value).toFixed(2)}`).join(" ");
}

export function TimeSeriesChart({ colors, decimals, lines, unit }: Props) {
  const [width, setWidth] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const visibleLines = lines.filter((line) => line.points.length > 1).slice(0, 3);
  const longest = Math.max(0, ...visibleLines.map((line) => line.points.length));
  const scale = useMemo(
    () => chartScale(visibleLines.flatMap((line) => line.points.map((point) => point.value))),
    [visibleLines],
  );
  const plotWidth = Math.max(1, width - margin.left - margin.right);
  const plotHeight = chartHeight - margin.top - margin.bottom;
  const totalRange = scale.maxValue + scale.mostNegativeValue;
  const x = (index: number) => margin.left + (longest <= 1 ? 0 : index / (longest - 1) * plotWidth);
  const y = (value: number) => margin.top + (scale.maxValue - value) / totalRange * plotHeight;
  const ticks = Array.from({ length: scale.sections + scale.sectionsBelow + 1 }, (_, index) => -scale.mostNegativeValue + index * scale.step);
  const xTickIndices = Array.from(new Set([0, Math.round((longest - 1) / 4), Math.round((longest - 1) / 2), Math.round((longest - 1) * 3 / 4), longest - 1]));

  const inspect = (event: GestureResponderEvent) => {
    if (longest < 2) return;
    const location = Math.max(margin.left, Math.min(margin.left + plotWidth, event.nativeEvent.locationX));
    setSelectedIndex(Math.round((location - margin.left) / plotWidth * (longest - 1)));
  };

  if (!visibleLines.length) {
    return <View style={styles.empty}><Text style={{ color: colors.muted }}>Not enough history to chart.</Text></View>;
  }

  const selected = selectedIndex === null ? [] : visibleLines.map((line) => line.points[Math.min(selectedIndex, line.points.length - 1)]);
  const selectedMonth = selected.find(Boolean)?.month;

  return (
    <View onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)} style={styles.wrap}>
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
        <View style={styles.chartWrap}>
          <Svg height={chartHeight} width={width}>
            {ticks.map((tick) => (
              <Line key={tick} stroke={Math.abs(tick) < 0.0000001 ? colors.ink : colors.line} strokeWidth={Math.abs(tick) < 0.0000001 ? 1.2 : 1} x1={margin.left} x2={margin.left + plotWidth} y1={y(tick)} y2={y(tick)} />
            ))}
            <Line stroke={colors.ink} strokeWidth={1} x1={margin.left} x2={margin.left} y1={margin.top} y2={margin.top + plotHeight} />
            {ticks.map((tick) => (
              <SvgText fill={colors.muted} fontSize={9} key={`label-${tick}`} textAnchor="end" x={margin.left - 6} y={y(tick) + 3}>
                {`${tick.toFixed(Math.abs(scale.step) < 1 ? 1 : 0)}${unit ? ` ${unit}` : ""}`}
              </SvgText>
            ))}
            {xTickIndices.map((index) => (
              <SvgText fill={colors.muted} fontSize={9} key={`month-${index}`} textAnchor={index === 0 ? "start" : index === longest - 1 ? "end" : "middle"} x={x(index)} y={chartHeight - 12}>
                {shortMonth(visibleLines[0].points[index]?.month ?? "")}
              </SvgText>
            ))}
            {visibleLines.map((line) => (
              <Path d={linePath(line.points, x, y)} fill="none" key={line.name} stroke={line.color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} />
            ))}
            {selectedIndex !== null ? (
              <>
                <Line stroke={colors.muted} strokeWidth={1} x1={x(selectedIndex)} x2={x(selectedIndex)} y1={margin.top} y2={margin.top + plotHeight} />
                {visibleLines.map((line) => {
                  const point = line.points[Math.min(selectedIndex, line.points.length - 1)];
                  return point ? <Circle cx={x(selectedIndex)} cy={y(point.value)} fill={line.color} key={`point-${line.name}`} r={4} stroke={colors.panel} strokeWidth={2} /> : null;
                })}
              </>
            ) : null}
          </Svg>
          <View onMoveShouldSetResponder={() => true} onResponderGrant={inspect} onResponderMove={inspect} onStartShouldSetResponder={() => true} style={StyleSheet.absoluteFill} />
          {selectedMonth ? (
            <View pointerEvents="none" style={[styles.tooltip, { backgroundColor: colors.ink }]}>
              <Text style={[styles.tooltipMonth, { color: colors.panel }]}>{shortMonth(selectedMonth)}</Text>
              {selected.map((point, index) => point ? (
                <View key={visibleLines[index].name} style={styles.tooltipRow}>
                  <View style={[styles.tooltipDot, { backgroundColor: visibleLines[index].color }]} />
                  <Text numberOfLines={1} style={[styles.tooltipText, { color: colors.panel }]}>
                    {visibleLines.length > 1 ? `${visibleLines[index].name}: ` : ""}{point.value.toFixed(decimals)} {unit}
                  </Text>
                </View>
              ) : null)}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minHeight: 292, width: "100%" },
  chartWrap: { height: chartHeight, position: "relative", width: "100%" },
  empty: { alignItems: "center", height: 280, justifyContent: "center" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 8 },
  legendItem: { alignItems: "center", flexDirection: "row", gap: 5 },
  legendDot: { borderRadius: 4, height: 8, width: 8 },
  legendText: { fontSize: 11, fontWeight: "700" },
  tooltip: { borderRadius: 6, left: 52, minWidth: 128, paddingHorizontal: 8, paddingVertical: 7, position: "absolute", top: 5 },
  tooltipMonth: { fontSize: 11, fontWeight: "800", marginBottom: 1 },
  tooltipRow: { alignItems: "center", flexDirection: "row", gap: 5 },
  tooltipDot: { borderRadius: 3, height: 6, width: 6 },
  tooltipText: { fontSize: 10, fontVariant: ["tabular-nums"] },
});
