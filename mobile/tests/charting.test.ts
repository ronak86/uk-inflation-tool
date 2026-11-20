import { describe, expect, it } from "vitest";

import payload from "@/assets/data/inflation.json";
import { chartScale, chartValue, contributionDrivers, historyPoints } from "@/src/charting";
import { InflationEngine, prepareSeries } from "@/src/engine/InflationEngine";
import { FilterState, InflationPayload } from "@/src/types";

const data = payload as InflationPayload;
const filters: FilterState = { sector: "all", core: "all", boe: "all", importIntensity: [], energyIntensity: [] };
const engine = new InflationEngine(prepareSeries(data.series.CPI), filters);

describe("chart data", () => {
  it("converts calculation units for display", () => {
    expect(chartValue(0.123, "contribution")).toBeCloseTo(12.3);
    expect(chartValue(123, "weight")).toBeCloseTo(12.3);
    expect(chartValue(2.34, "price")).toBeCloseTo(2.34);
  });

  it("limits history without changing chronological order", () => {
    const points = historyPoints(engine, engine.allItems(), "yoy", "price", "1y");
    expect(points.length).toBeLessThanOrEqual(12);
    expect(points.map((point) => point.month)).toEqual([...points.map((point) => point.month)].sort());
    expect(points.every((point) => Number.isFinite(point.value))).toBe(true);
  });

  it("uses rounded axes and includes zero", () => {
    expect(chartScale([-17, 12, 38])).toEqual({ maxValue: 40, mostNegativeValue: 20, sections: 4, sectionsBelow: 2, step: 10 });
    expect(chartScale([2, 4, 9])).toEqual({ maxValue: 10, mostNegativeValue: 0, sections: 2, sectionsBelow: 0, step: 5 });
  });

  it("ranks positive and negative division contributions", () => {
    const monthIndex = engine.data.months.length - 1;
    const drivers = contributionDrivers(engine, monthIndex, "yoy", 3);
    expect(drivers.positive.length).toBeLessThanOrEqual(3);
    expect(drivers.negative.length).toBeLessThanOrEqual(3);
    expect(drivers.positive.map((point) => point.value)).toEqual([...drivers.positive.map((point) => point.value)].sort((a, b) => b - a));
    expect(drivers.negative.map((point) => point.value)).toEqual([...drivers.negative.map((point) => point.value)].sort((a, b) => a - b));
  });
});
