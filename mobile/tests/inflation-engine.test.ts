import { describe, expect, it } from "vitest";

import payload from "@/assets/data/inflation.json";
import { InflationEngine, prepareSeries } from "@/src/engine/InflationEngine";
import {
  FilterState,
  Horizon,
  IndexFamily,
  InflationPayload,
  InflationSeries,
} from "@/src/types";

const data = payload as InflationPayload;
const families: IndexFamily[] = ["CPI", "CPIH", "RPI"];
const horizons: Horizon[] = ["mom", "yoy"];
const allFilters: FilterState = { sector: "all", core: "all", boe: "all" };

function engineFor(family: IndexFamily, filters = allFilters) {
  return new InflationEngine(prepareSeries(data.series[family]), filters);
}

function finite(value: number | null | undefined): value is number {
  return Number.isFinite(value);
}

describe("bundled inflation data", () => {
  it.each(families)("%s has a complete, ordered and internally aligned dataset", (family) => {
    const series = data.series[family];
    const expectedLeafLevel = family === "RPI" ? 3 : 4;

    expect(series.series).toBe(family);
    expect(series.months.length).toBeGreaterThan(12);
    expect(new Set(series.months).size).toBe(series.months.length);
    expect(series.months).toEqual([...series.months].sort());
    expect(series.months.every((month) => /^\d{4}-(0[1-9]|1[0-2])$/.test(month))).toBe(true);
    expect(series.items[0].level).toBe(0);
    expect(Math.max(...series.items.map((item) => item.level))).toBe(expectedLeafLevel);

    for (const item of series.items) {
      expect(item.weights).toHaveLength(series.months.length);
      expect(item.prices).toHaveLength(series.months.length);
      expect(item.weights.every((value) => value === null || finite(value))).toBe(true);
      expect(item.prices.every((value) => value === null || finite(value))).toBe(true);
    }
  });

  it.each(["CPI", "CPIH"] as const)("%s has aligned three-decimal headline indices", (family) => {
    const series = data.series[family];
    expect(series.overall3dp).toBeDefined();
    expect(series.overall3dp!.months).toEqual(series.months);
    expect(series.overall3dp!.prices).toHaveLength(series.months.length);
  });
});

describe("basket hierarchy", () => {
  it.each(families)("%s assigns every non-headline item to a valid parent", (family) => {
    const series = prepareSeries(data.series[family]);
    for (const item of series.items.slice(1)) {
      expect(item.parentId).not.toBeNull();
      const parent = series.items[item.parentId!];
      expect(parent.level).toBeLessThan(item.level);
      expect(parent.children).toContain(item.id);
    }
  });

  it.each(families)("%s headline and parent contributions equal their child roll-ups", (family) => {
    const engine = engineFor(family);
    const monthIndices = [engine.data.months.length - 1, engine.data.months.length - 4];

    for (const horizon of horizons) {
      for (const monthIndex of monthIndices) {
        for (const item of engine.data.items.filter((candidate) => candidate.children?.length)) {
          const parentValue = engine.contribution(item, monthIndex, horizon);
          const childValues = item.children!
            .map((id) => engine.contribution(engine.data.items[id], monthIndex, horizon))
            .filter(finite);
          if (!finite(parentValue) || childValues.length === 0) continue;
          expect(childValues.reduce((sum, value) => sum + value, 0)).toBeCloseTo(parentValue, 10);
        }
      }
    }
  });
});

describe("headline reconciliation", () => {
  it.each(families)("%s granular contributions remain close to the published headline", (family) => {
    const engine = engineFor(family);
    const leaves = engine.data.items.filter((item) => item.level === engine.leafLevel);
    const errorLimits = {
      CPI: { mom: 10, yoy: 13 },
      CPIH: { mom: 8, yoy: 11 },
      RPI: { mom: 5, yoy: 6 },
    };

    for (const horizon of horizons) {
      const errors: Array<{ month: string; value: number }> = [];
      for (let monthIndex = horizon === "mom" ? 1 : 12; monthIndex < engine.data.months.length; monthIndex += 1) {
        const calculated = leaves
          .map((leaf) => engine.contribution(leaf, monthIndex, horizon))
          .filter(finite)
          .reduce((sum, value) => sum + value, 0);
        const actual = engine.value(engine.allItems(), monthIndex, horizon, "price");
        if (!finite(calculated) || !finite(actual)) continue;
        const errorBp = Math.abs((calculated - actual) * 100);
        errors.push({ month: engine.data.months[monthIndex], value: errorBp });
      }
      const worst = errors.sort((left, right) => right.value - left.value)[0];
      expect(
        worst.value,
        `${family} ${horizon} maximum error occurred in ${worst.month}`,
      ).toBeLessThanOrEqual(errorLimits[family][horizon]);
    }
  });
});

describe("classification partitions", () => {
  it.each(families)("%s core and non-core leaf weights reconstruct the full basket", (family) => {
    const all = engineFor(family);
    const core = engineFor(family, { ...allFilters, core: "core" });
    const nonCore = engineFor(family, { ...allFilters, core: "noncore" });
    const monthIndex = all.data.months.length - 1;
    const headline = all.allItems();

    const allWeight = all.value(headline, monthIndex, "mom", "weight");
    const partitionWeight =
      core.value(core.allItems(), monthIndex, "mom", "weight") +
      nonCore.value(nonCore.allItems(), monthIndex, "mom", "weight");
    expect(Math.abs(partitionWeight - allWeight)).toBeLessThan(0.01);
  });

  it.each(families)("%s sector definitions assign each leaf to exactly one primary sector", (family) => {
    const engine = engineFor(family);
    const leaves = engine.data.items.filter((item) => item.level === engine.leafLevel);
    for (const leaf of leaves) {
      const memberships = family === "RPI"
        ? [leaf.sectors.services, leaf.sectors.housing, !leaf.sectors.services && !leaf.sectors.housing]
        : [leaf.sectors.services, !leaf.sectors.services];
      expect(memberships.filter(Boolean)).toHaveLength(1);
    }
  });

  it.each(families)("%s primary sector weights reconstruct the full basket", (family) => {
    const all = engineFor(family);
    const services = engineFor(family, { ...allFilters, sector: "services" });
    const goods = engineFor(family, { ...allFilters, sector: "goods" });
    const housing = family === "RPI"
      ? engineFor(family, { ...allFilters, sector: "housing" })
      : null;
    const monthIndex = all.data.months.length - 1;
    const allWeight = all.value(all.allItems(), monthIndex, "mom", "weight");
    const partitionWeight =
      services.value(services.allItems(), monthIndex, "mom", "weight") +
      goods.value(goods.allItems(), monthIndex, "mom", "weight") +
      (housing ? housing.value(housing.allItems(), monthIndex, "mom", "weight") : 0);
    expect(Math.abs(partitionWeight - allWeight)).toBeLessThan(0.01);
  });

  it.each(["CPI", "CPIH"] as const)("%s BoE flags partition services and exclude goods", (family) => {
    const engine = engineFor(family);
    const leaves = engine.data.items.filter((item) => item.level === engine.leafLevel);
    for (const leaf of leaves) {
      if (leaf.sectors.services) {
        expect([leaf.sectors.boe, leaf.sectors.exBoe].filter(Boolean)).toHaveLength(1);
      } else {
        expect(leaf.sectors.boe).toBe(false);
        expect(leaf.sectors.exBoe).toBe(false);
      }
    }
  });
});

function syntheticSeries(series: IndexFamily): InflationSeries {
  const months = ["2025-01", "2025-12", "2026-01"];
  const sectors = { boe: false, exBoe: false, services: false, nonCore: false, housing: false };
  return {
    series,
    sourceWorkbook: "synthetic",
    months,
    items: [
      {
        name: `${series} (overall index)`,
        level: 0,
        weightCode: "ALLW",
        priceCode: "ALLP",
        weights: [1000, 1000, 1000],
        prices: [100, 105, 102],
        sectors,
      },
      {
        name: "01 Test item",
        level: 1,
        weightCode: "ITEMW",
        priceCode: "ITEMP",
        weights: [100, 100, 100],
        prices: [100, 110, 120],
        sectors,
      },
    ],
  };
}

describe("January chain-link rules", () => {
  it("uses the December bridge for CPI January monthly contributions", () => {
    const engine = new InflationEngine(syntheticSeries("CPI"), allFilters);
    const item = engine.data.items[1];
    expect(engine.contribution(item, 2, "mom")).toBeCloseTo((120 / 110 - 1) * 100 * 0.1, 10);
  });

  it("uses the previous January base and December weights for RPI January", () => {
    const engine = new InflationEngine(syntheticSeries("RPI"), allFilters);
    const item = engine.data.items[1];
    const current = 120;
    const previous = 110;
    const allPrevious = 105;
    const expected = (current / previous - 1) * 100 * (previous / allPrevious) * 0.1;
    expect(engine.contribution(item, 2, "mom")).toBeCloseTo(expected, 10);
  });
});
