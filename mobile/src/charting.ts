import { InflationEngine } from "@/src/engine/InflationEngine";
import { Horizon, InflationItem, Measure } from "@/src/types";

export type ChartRange = "1y" | "5y" | "all";

export interface ChartPoint {
  month: string;
  value: number;
}

export interface DriverPoint {
  item: InflationItem;
  value: number;
}

export interface ChartScale {
  maxValue: number;
  mostNegativeValue: number;
  sections: number;
  sectionsBelow: number;
  step: number;
}

export function chartValue(value: number, measure: Measure) {
  if (measure === "contribution") return value * 100;
  if (measure === "weight") return value / 10;
  return value;
}

export function chartUnit(measure: Measure) {
  return measure === "contribution" ? "bp" : "%";
}

export function chartDecimals(measure: Measure) {
  return measure === "price" ? 2 : 1;
}

export function historyPoints(
  engine: InflationEngine,
  item: InflationItem,
  horizon: Horizon,
  measure: Measure,
  range: ChartRange,
) {
  const rangeMonths = range === "1y" ? 12 : range === "5y" ? 60 : engine.data.months.length;
  const start = Math.max(0, engine.data.months.length - rangeMonths);
  const points: ChartPoint[] = [];

  for (let index = start; index < engine.data.months.length; index += 1) {
    const value = chartValue(engine.value(item, index, horizon, measure), measure);
    if (Number.isFinite(value)) points.push({ month: engine.data.months[index], value });
  }
  return points;
}

function niceStep(rawStep: number) {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalised = rawStep / magnitude;
  const factor = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return factor * magnitude;
}

export function chartScale(values: number[], sections = 4): ChartScale {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return { maxValue: 1, mostNegativeValue: 0, sections: 4, sectionsBelow: 0, step: 0.25 };

  const maximum = Math.max(0, ...finite);
  const minimum = Math.min(0, ...finite);
  const largestMagnitude = Math.max(maximum, Math.abs(minimum));
  const step = niceStep(largestMagnitude / sections);
  const positiveSections = Math.max(1, Math.ceil(maximum / step));
  const sectionsBelow = minimum < 0 ? Math.ceil(Math.abs(minimum) / step) : 0;
  return {
    maxValue: positiveSections * step,
    mostNegativeValue: sectionsBelow * step,
    sections: positiveSections,
    sectionsBelow,
    step,
  };
}

export function contributionDrivers(engine: InflationEngine, monthIndex: number, horizon: Horizon, limit = 5) {
  const candidates = engine.visibleAtLevel(1)
    .map((item) => ({ item, value: chartValue(engine.value(item, monthIndex, horizon, "contribution"), "contribution") }))
    .filter((point) => Number.isFinite(point.value));
  const positive = candidates.filter((point) => point.value > 0).sort((a, b) => b.value - a.value).slice(0, limit);
  const negative = candidates.filter((point) => point.value < 0).sort((a, b) => a.value - b.value).slice(0, limit);
  return { positive, negative };
}
