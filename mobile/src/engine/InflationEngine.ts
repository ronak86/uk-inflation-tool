import {
  FilterState,
  Horizon,
  InflationItem,
  InflationSeries,
  Measure,
} from "@/src/types";

const finite = (value: number | null | undefined): value is number => Number.isFinite(value);

function codePrefix(name: string) {
  return (name.match(/^\s*(\d+(?:\.\d+)*)/) ?? [null, ""])[1];
}

export function prepareSeries(input: InflationSeries): InflationSeries {
  const items = input.items.map((item, id) => ({
    ...item,
    id,
    parentId: null as number | null,
    children: [] as number[],
  }));
  const stack: InflationItem[] = [];
  for (const item of items) {
    while (stack.length && stack[stack.length - 1].level >= item.level) stack.pop();
    item.parentId = stack.length ? stack[stack.length - 1].id! : null;
    if (item.parentId !== null) items[item.parentId].children!.push(item.id!);
    stack.push(item);
  }
  return { ...input, items };
}

export class InflationEngine {
  readonly data: InflationSeries;
  readonly filters: FilterState;
  readonly leafLevel: number;
  private readonly contributionCache = new Map<string, number>();
  private readonly activeLeavesCache: InflationItem[];

  constructor(data: InflationSeries, filters: FilterState) {
    this.data = data.items[0]?.id === undefined ? prepareSeries(data) : data;
    this.filters = filters;
    this.leafLevel = Math.max(...this.data.items.map((item) => item.level));
    this.activeLeavesCache = this.data.items
      .filter((item) => item.level === this.leafLevel)
      .filter((item) => this.leafIsActive(item));
  }

  get isRpi() {
    return this.data.series === "RPI";
  }

  get isFiltered() {
    return this.filters.sector !== "all" || this.filters.core !== "all" || (!this.isRpi && this.filters.boe !== "all");
  }

  allItems() {
    return this.data.items.find((item) => item.level === 0)!;
  }

  monthParts(index: number) {
    const [year, month] = this.data.months[index].split("-").map(Number);
    return { year, month };
  }

  findMonth(year: number, month: number) {
    return this.data.months.indexOf(`${year}-${String(month).padStart(2, "0")}`);
  }

  activeBasketName() {
    const parts: string[] = [this.data.series];
    if (this.filters.core === "core") parts.push("Core");
    if (this.filters.core === "noncore") parts.push("Non Core");
    if (this.filters.sector === "services") parts.push("Services");
    if (this.filters.sector === "goods") parts.push("Goods");
    if (this.filters.sector === "housing") parts.push("Housing");
    if (!this.isRpi && this.filters.boe === "boe") parts.push("BoE Services");
    if (!this.isRpi && this.filters.boe === "exboe") parts.push("ex BoE Services");
    return parts.length === 1 ? this.allItems().name : `${parts.join(" ")} index`;
  }

  displayName(item: InflationItem) {
    return item.level === 0 ? this.activeBasketName() : item.name.replace(/\s+/g, " ").trim();
  }

  value(item: InflationItem, monthIndex: number, horizon: Horizon, measure: Measure) {
    if (measure === "contribution") return this.contribution(item, monthIndex, horizon);
    if (measure === "weight") return this.weightValue(item, monthIndex);
    return this.priceValue(item, monthIndex, horizon);
  }

  format(value: number, measure: Measure) {
    if (!Number.isFinite(value)) return "n/a";
    if (measure === "contribution") return (value * 100).toFixed(1);
    if (measure === "price") return value.toFixed(2);
    return (value / 10).toFixed(2);
  }

  private leafIsActive(item: InflationItem) {
    const flags = item.sectors ?? { services: false, housing: false, nonCore: false, boe: false, exBoe: false };
    if (this.filters.sector === "services" && !flags.services) return false;
    if (this.filters.sector === "goods" && (flags.services || flags.housing)) return false;
    if (this.filters.sector === "housing" && !flags.housing) return false;
    if (this.filters.core === "core" && flags.nonCore) return false;
    if (this.filters.core === "noncore" && !flags.nonCore) return false;
    if (!this.isRpi && this.filters.boe === "boe" && !flags.boe) return false;
    if (!this.isRpi && this.filters.boe === "exboe" && !flags.exBoe) return false;
    return true;
  }

  private descendantsAtLevel(item: InflationItem, level: number) {
    const output: InflationItem[] = [];
    const queue = [...(item.children ?? [])];
    while (queue.length) {
      const child = this.data.items[queue.shift()!];
      if (child.level === level) output.push(child);
      queue.unshift(...(child.children ?? []));
    }
    return output;
  }

  private leavesFor(item: InflationItem) {
    if (item.level === this.leafLevel) return [item];
    if (item.level === 0) return this.data.items.filter((candidate) => candidate.level === this.leafLevel);
    return this.descendantsAtLevel(item, this.leafLevel);
  }

  activeLeavesFor(item: InflationItem) {
    return this.leavesFor(item).filter((leaf) => this.leafIsActive(leaf));
  }

  visibleAtLevel(level: number) {
    if (level === 0) return [this.allItems()];
    return this.data.items
      .filter((item) => item.level === level)
      .filter((item) => !this.isFiltered || this.activeLeavesFor(item).length > 0);
  }

  private weightTotal(monthIndex: number, leaves: InflationItem[]) {
    const values = leaves.map((leaf) => leaf.weights[monthIndex]).filter(finite);
    return values.length ? values.reduce((sum, value) => sum + value, 0) : Number.NaN;
  }

  private weightValue(item: InflationItem, monthIndex: number) {
    if (!this.isFiltered) return item.weights[monthIndex] ?? Number.NaN;
    return this.weightTotal(monthIndex, this.activeLeavesFor(item));
  }

  private priceChange(item: InflationItem, monthIndex: number, horizon: Horizon) {
    const lag = horizon === "mom" ? 1 : 12;
    if (monthIndex < lag) return Number.NaN;
    const current = item.prices[monthIndex];
    const previous = item.prices[monthIndex - lag];
    return finite(current) && finite(previous) ? (current / previous - 1) * 100 : Number.NaN;
  }

  private actualHeadlineChange(monthIndex: number, horizon: Horizon) {
    const lag = horizon === "mom" ? 1 : 12;
    if (monthIndex < lag) return Number.NaN;
    const overall = this.data.overall3dp;
    if (overall) {
      const month = this.data.months[monthIndex];
      const previousMonth = this.data.months[monthIndex - lag];
      const currentIndex = overall.months.indexOf(month);
      const previousIndex = overall.months.indexOf(previousMonth);
      const current = overall.prices[currentIndex];
      const previous = overall.prices[previousIndex];
      if (finite(current) && finite(previous)) return (current / previous - 1) * 100;
    }
    return this.priceChange(this.allItems(), monthIndex, horizon);
  }

  private priceValue(item: InflationItem, monthIndex: number, horizon: Horizon) {
    if (!this.isFiltered) return item.level === 0 ? this.actualHeadlineChange(monthIndex, horizon) : this.priceChange(item, monthIndex, horizon);
    if (item.level === this.leafLevel) return this.priceChange(item, monthIndex, horizon);
    const leaves = this.activeLeavesFor(item);
    const values = leaves
      .map((leaf) => horizon === "mom" ? this.monthlySubsetContribution(leaf, monthIndex, leaves) : this.annualSubsetContribution(leaf, monthIndex, leaves))
      .filter(Number.isFinite);
    return values.length ? values.reduce((sum, value) => sum + value, 0) : Number.NaN;
  }

  private previousJanuary(year: number) {
    return this.findMonth(year - 1, 1);
  }

  private monthlyWeightIndex(monthIndex: number) {
    return this.isRpi && this.monthParts(monthIndex).month === 1 ? monthIndex - 1 : monthIndex;
  }

  private unchainedIndex(item: InflationItem, monthIndex: number) {
    const { year, month } = this.monthParts(monthIndex);
    const current = item.prices[monthIndex];
    if (!finite(current)) return Number.NaN;
    if (month === 1) {
      const base = this.isRpi ? this.previousJanuary(year) : this.findMonth(year - 1, 12);
      const baseValue = item.prices[base];
      return base >= 0 && finite(baseValue) ? (current / baseValue) * 100 : Number.NaN;
    }
    const januaryValue = item.prices[this.findMonth(year, 1)];
    return finite(januaryValue) ? (current / januaryValue) * 100 : Number.NaN;
  }

  private unchainedJanuary(item: InflationItem, monthIndex: number) {
    const january = this.findMonth(this.monthParts(monthIndex).year, 1);
    const current = item.prices[monthIndex];
    const base = item.prices[january];
    return finite(current) && finite(base) ? (current / base) * 100 : Number.NaN;
  }

  private subsetJanuary(monthIndex: number, weightIndex: number, leaves: InflationItem[]) {
    const total = this.weightTotal(weightIndex, leaves);
    if (!finite(total) || total === 0) return Number.NaN;
    const values = leaves.map((leaf) => {
      const index = this.unchainedJanuary(leaf, monthIndex);
      const weight = leaf.weights[weightIndex];
      return finite(index) && finite(weight) ? (weight / total) * index : Number.NaN;
    }).filter(Number.isFinite);
    return values.length ? values.reduce((sum, value) => sum + value, 0) : Number.NaN;
  }

  private subsetIndex(monthIndex: number, weightIndex: number, leaves: InflationItem[]) {
    const total = this.weightTotal(weightIndex, leaves);
    if (!finite(total) || total === 0) return Number.NaN;
    const values = leaves.map((leaf) => {
      const index = this.unchainedIndex(leaf, monthIndex);
      const weight = leaf.weights[weightIndex];
      return finite(index) && finite(weight) ? (weight / total) * index : Number.NaN;
    }).filter(Number.isFinite);
    return values.length ? values.reduce((sum, value) => sum + value, 0) : Number.NaN;
  }

  private monthlyContribution(item: InflationItem, monthIndex: number) {
    if (monthIndex <= 0) return Number.NaN;
    const all = this.allItems();
    const { month } = this.monthParts(monthIndex);
    let current: number;
    let previous: number;
    let allPrevious: number;
    if (month === 1) {
      current = this.unchainedIndex(item, monthIndex);
      if (this.isRpi) {
        previous = this.unchainedJanuary(item, monthIndex - 1);
        allPrevious = this.unchainedJanuary(all, monthIndex - 1);
      } else {
        previous = 100;
        allPrevious = 100;
      }
    } else {
      current = this.unchainedJanuary(item, monthIndex);
      previous = this.unchainedJanuary(item, monthIndex - 1);
      allPrevious = this.unchainedJanuary(all, monthIndex - 1);
    }
    const weight = item.weights[this.monthlyWeightIndex(monthIndex)];
    return finite(current) && finite(previous) && finite(allPrevious) && finite(weight)
      ? (current / previous - 1) * 100 * (previous / allPrevious) * (weight / 1000)
      : Number.NaN;
  }

  private monthlySubsetContribution(item: InflationItem, monthIndex: number, leaves = this.activeLeavesCache) {
    if (monthIndex <= 0) return Number.NaN;
    const weightIndex = this.monthlyWeightIndex(monthIndex);
    const total = this.weightTotal(weightIndex, leaves);
    const weight = item.weights[weightIndex];
    if (!finite(total) || !finite(weight) || total === 0) return Number.NaN;
    const { month } = this.monthParts(monthIndex);
    let current: number;
    let previous: number;
    let subsetPrevious: number;
    if (month === 1) {
      current = this.unchainedIndex(item, monthIndex);
      if (this.isRpi) {
        previous = this.unchainedJanuary(item, monthIndex - 1);
        subsetPrevious = this.subsetJanuary(monthIndex - 1, monthIndex, leaves);
      } else {
        previous = 100;
        subsetPrevious = 100;
      }
    } else {
      current = this.unchainedJanuary(item, monthIndex);
      previous = this.unchainedJanuary(item, monthIndex - 1);
      subsetPrevious = this.subsetJanuary(monthIndex - 1, monthIndex, leaves);
    }
    return finite(current) && finite(previous) && finite(subsetPrevious)
      ? (current / previous - 1) * 100 * (previous / subsetPrevious) * (weight / total)
      : Number.NaN;
  }

  private annualContribution(item: InflationItem, monthIndex: number) {
    return this.isRpi ? this.annualRpiContribution(item, monthIndex) : this.annualCpiContribution(item, monthIndex);
  }

  private annualCpiContribution(item: InflationItem, monthIndex: number) {
    if (monthIndex < 12) return Number.NaN;
    const { year, month } = this.monthParts(monthIndex);
    const previousMonth = this.findMonth(year - 1, month);
    const previousDecember = this.findMonth(year - 1, 12);
    const currentJanuary = this.findMonth(year, 1);
    const currentFebruary = this.findMonth(year, 2);
    const previousFebruary = this.findMonth(year - 1, 2);
    if ([previousMonth, previousDecember, currentJanuary, previousFebruary].some((index) => index < 0)) return Number.NaN;
    const all = this.allItems();
    const denom = this.unchainedJanuary(all, previousMonth);
    const allPrevDec = this.unchainedJanuary(all, previousDecember);
    const allCurrentJan = this.unchainedIndex(all, currentJanuary);
    const previousWeight = item.weights[previousFebruary];
    const januaryWeight = item.weights[currentJanuary];
    const februaryWeight = item.weights[currentFebruary];
    if (![denom, allPrevDec, allCurrentJan, previousWeight, januaryWeight].every(finite)) return Number.NaN;
    const termOne = (previousWeight! / 1000) * ((this.unchainedJanuary(item, previousDecember) - this.unchainedJanuary(item, previousMonth)) / denom) * 100;
    const termTwo = (januaryWeight! / 1000) * ((this.unchainedIndex(item, currentJanuary) - 100) / denom) * allPrevDec;
    const termThree = month === 1 || currentFebruary < 0 || !finite(februaryWeight) ? 0 : (februaryWeight / 1000) * ((this.unchainedJanuary(item, monthIndex) - 100) / denom) * (allCurrentJan / 100) * allPrevDec;
    return termOne + termTwo + termThree;
  }

  private annualRpiContribution(item: InflationItem, monthIndex: number) {
    if (monthIndex < 12) return Number.NaN;
    const { year, month } = this.monthParts(monthIndex);
    const previousMonth = this.findMonth(year - 1, month);
    const previousJanuary = this.previousJanuary(year);
    const currentJanuary = this.findMonth(year, 1);
    if ([previousMonth, previousJanuary, currentJanuary].some((index) => index < 0)) return Number.NaN;
    const all = this.allItems();
    const denom = this.unchainedJanuary(all, previousMonth);
    const allCurrentJan = this.unchainedIndex(all, currentJanuary);
    const previousWeight = item.weights[previousJanuary];
    const currentWeight = item.weights[currentJanuary];
    if (![denom, allCurrentJan, previousWeight, currentWeight].every(finite)) return Number.NaN;
    const termOne = (previousWeight! / 1000) * ((this.unchainedIndex(item, currentJanuary) - this.unchainedJanuary(item, previousMonth)) / denom) * 100;
    const termTwo = month === 1 ? 0 : (currentWeight! / 1000) * ((this.unchainedJanuary(item, monthIndex) - 100) / denom) * (allCurrentJan / 100) * 100;
    return termOne + termTwo;
  }

  private annualSubsetContribution(item: InflationItem, monthIndex: number, leaves = this.activeLeavesCache) {
    return this.isRpi ? this.annualRpiSubset(item, monthIndex, leaves) : this.annualCpiSubset(item, monthIndex, leaves);
  }

  private annualCpiSubset(item: InflationItem, monthIndex: number, leaves: InflationItem[]) {
    if (monthIndex < 12) return Number.NaN;
    const { year, month } = this.monthParts(monthIndex);
    const previousMonth = this.findMonth(year - 1, month);
    const previousDecember = this.findMonth(year - 1, 12);
    const currentJanuary = this.findMonth(year, 1);
    const currentFebruary = this.findMonth(year, 2);
    const previousFebruary = this.findMonth(year - 1, 2);
    if ([previousMonth, previousDecember, currentJanuary, currentFebruary, previousFebruary].some((index) => index < 0)) return Number.NaN;
    const previousTotal = this.weightTotal(previousFebruary, leaves);
    const januaryTotal = this.weightTotal(currentJanuary, leaves);
    const februaryTotal = this.weightTotal(currentFebruary, leaves);
    const previousWeight = item.weights[previousFebruary];
    const januaryWeight = item.weights[currentJanuary];
    const februaryWeight = item.weights[currentFebruary];
    if (![previousTotal, januaryTotal, februaryTotal, previousWeight, januaryWeight].every(finite) || previousTotal === 0 || januaryTotal === 0 || februaryTotal === 0) return Number.NaN;
    const denom = this.subsetJanuary(previousMonth, previousFebruary, leaves);
    const subsetPrevDec = this.subsetJanuary(previousDecember, previousFebruary, leaves);
    const subsetCurrentJan = this.subsetIndex(currentJanuary, currentJanuary, leaves);
    const termOne = (previousWeight! / previousTotal) * ((this.unchainedJanuary(item, previousDecember) - this.unchainedJanuary(item, previousMonth)) / denom) * 100;
    const termTwo = (januaryWeight! / januaryTotal) * ((this.unchainedIndex(item, currentJanuary) - 100) / denom) * subsetPrevDec;
    const termThree = month === 1 || !finite(februaryWeight) ? 0 : (februaryWeight / februaryTotal) * ((this.unchainedJanuary(item, monthIndex) - 100) / denom) * (subsetCurrentJan / 100) * subsetPrevDec;
    return termOne + termTwo + termThree;
  }

  private annualRpiSubset(item: InflationItem, monthIndex: number, leaves: InflationItem[]) {
    if (monthIndex < 12) return Number.NaN;
    const { year, month } = this.monthParts(monthIndex);
    const previousMonth = this.findMonth(year - 1, month);
    const previousJanuary = this.previousJanuary(year);
    const currentJanuary = this.findMonth(year, 1);
    if ([previousMonth, previousJanuary, currentJanuary].some((index) => index < 0)) return Number.NaN;
    const previousTotal = this.weightTotal(previousJanuary, leaves);
    const currentTotal = this.weightTotal(currentJanuary, leaves);
    const previousWeight = item.weights[previousJanuary];
    const currentWeight = item.weights[currentJanuary];
    if (![previousTotal, currentTotal, previousWeight, currentWeight].every(finite) || previousTotal === 0 || currentTotal === 0) return Number.NaN;
    const denom = this.subsetJanuary(previousMonth, previousJanuary, leaves);
    const subsetCurrentJan = this.subsetIndex(currentJanuary, currentJanuary, leaves);
    const termOne = (previousWeight! / previousTotal) * ((this.unchainedIndex(item, currentJanuary) - this.unchainedJanuary(item, previousMonth)) / denom) * 100;
    const termTwo = month === 1 ? 0 : (currentWeight! / currentTotal) * ((this.unchainedJanuary(item, monthIndex) - 100) / denom) * (subsetCurrentJan / 100) * 100;
    return termOne + termTwo;
  }

  contribution(item: InflationItem, monthIndex: number, horizon: Horizon) {
    const key = `${item.id}|${monthIndex}|${horizon}`;
    const cached = this.contributionCache.get(key);
    if (cached !== undefined) return cached;
    const leaves = this.isFiltered ? this.activeLeavesFor(item) : this.leavesFor(item);
    const values = leaves.map((leaf) => {
      if (this.isFiltered) return horizon === "mom" ? this.monthlySubsetContribution(leaf, monthIndex) : this.annualSubsetContribution(leaf, monthIndex);
      return horizon === "mom" ? this.monthlyContribution(leaf, monthIndex) : this.annualContribution(leaf, monthIndex);
    }).filter(Number.isFinite);
    const value = values.length ? values.reduce((sum, candidate) => sum + candidate, 0) : Number.NaN;
    this.contributionCache.set(key, value);
    return value;
  }
}

export function itemPrefix(item: InflationItem) {
  return codePrefix(item.name);
}
