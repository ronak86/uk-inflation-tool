const state = {
  datasets: null,
  data: null,
  indexFamily: "CPI",
  monthIndex: 0,
  horizon: "mom",
  measure: "contribution",
  sectorView: "all",
  coreView: "all",
  boeView: "all",
  timeRange: "1",
  levelView: "all",
  activeTab: "explorer",
  chart: null,
  contextRowId: null,
  sort: { type: "name", monthIndex: null },
  expanded: new Set(),
  selectedRowId: null,
  theme: "light",
};

const els = {
  itemHead: document.querySelector("#itemHead"),
  itemCols: document.querySelector("#itemCols"),
  itemTable: document.querySelector("#itemTable"),
  itemRows: document.querySelector("#itemRows"),
  errorRows: document.querySelector("#errorRows"),
  valueHeader: document.querySelector("#valueHeader"),
  explorerPanel: document.querySelector("#explorerPanel"),
  chartPanel: document.querySelector("#chartPanel"),
  chartTab: document.querySelector("#chartTab"),
  chartTitle: document.querySelector("#chartTitle"),
  chartSubtitle: document.querySelector("#chartSubtitle"),
  chartSvg: document.querySelector("#chartSvg"),
  chartClose: document.querySelector("#chartClose"),
  chartContextMenu: document.querySelector("#chartContextMenu"),
  chartTooltip: document.querySelector("#chartTooltip"),
  definitionsPanel: document.querySelector("#definitionsPanel"),
  definitionsCols: document.querySelector("#definitionsCols"),
  definitionsHead: document.querySelector("#definitionsHead"),
  definitionsRows: document.querySelector("#definitionsRows"),
  definitionsSummary: document.querySelector("#definitionsSummary"),
  featuresPanel: document.querySelector("#featuresPanel"),
  errorsPanel: document.querySelector("#errorsPanel"),
  themeToggle: document.querySelector("#themeToggle"),
  panelResizer: document.querySelector("#panelResizer"),
  mobileFiltersOpen: document.querySelector("#mobileFiltersOpen"),
  mobileFiltersClose: document.querySelector("#mobileFiltersClose"),
  mobileDrawerBackdrop: document.querySelector("#mobileDrawerBackdrop"),
  mobileDesktopView: document.querySelector("#mobileDesktopView"),
  mobileViewReturn: document.querySelector("#mobileViewReturn"),
  mobileMonthPrevious: document.querySelector("#mobileMonthPrevious"),
  mobileMonthNext: document.querySelector("#mobileMonthNext"),
  mobileMonthSelect: document.querySelector("#mobileMonthSelect"),
  mobileSelectionSummary: document.querySelector("#mobileSelectionSummary"),
};

const controlsWidthStorageKey = "ukInflationControlsWidth";
const controlsWidthMin = 150;
const controlsWidthMax = 340;
const mobileViewportQuery = window.matchMedia("(max-width: 1099px)");

const calcCache = {
  key: "",
  activeLeaves: null,
  activeLeavesForItem: new Map(),
  activeWeightTotals: new Map(),
  subsetUnchainedJanuary: new Map(),
  subsetUnchainedIndex: new Map(),
  leafContributions: new Map(),
  contributions: new Map(),
};

let errorsHtmlCache = "";

const monthLabel = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  year: "numeric",
});

function monthDate(month) {
  return new Date(`${month}-01T00:00:00`);
}

function formatMonth(month) {
  return monthLabel.format(monthDate(month));
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "n/a";
  return `${value.toFixed(3)}%`;
}

function formatContribution(value) {
  if (!Number.isFinite(value)) return "n/a";
  return (value * 100).toFixed(1);
}

function formatContributionForCopy(value) {
  if (!Number.isFinite(value)) return "n/a";
  return (value * 100).toFixed(6);
}

function formatBp(value) {
  if (!Number.isFinite(value)) return "n/a";
  return value.toFixed(1);
}

function formatNumber(value, decimals = 1) {
  if (!Number.isFinite(value)) return "n/a";
  return value.toFixed(decimals);
}

function formatAxisValue(value) {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value) < 0.000001) return "0";
  const abs = Math.abs(value);
  if (abs >= 100) return value.toFixed(0);
  if (abs >= 10) return value.toFixed(1);
  return value.toFixed(2);
}

function niceTickStep(span, targetTicks = 5) {
  if (!Number.isFinite(span) || span <= 0) return 1;
  const roughStep = span / Math.max(1, targetTicks - 1);
  const power = 10 ** Math.floor(Math.log10(roughStep));
  const scaled = roughStep / power;
  const niceScaled = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
  return niceScaled * power;
}

function niceChartScale(values, targetTicks = 7, options = {}) {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return { min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1] };

  const dataMin = Math.min(...finite);
  const dataMax = Math.max(...finite);
  if (dataMin === dataMax) {
    if (dataMin === 0) return { min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1] };
    const pad = Math.abs(dataMin) * 0.12 || 1;
    return niceChartScale([dataMin - pad, dataMax + pad], targetTicks);
  }

  let min = dataMin;
  let max = dataMax;
  const forceZeroMin = options.forceZeroMin && dataMax > 0;
  const isPositiveOnly = dataMin >= 0 || forceZeroMin;
  const isNegativeOnly = dataMax <= 0;

  if (isPositiveOnly) {
    min = 0;
  } else if (isNegativeOnly) {
    max = 0;
  } else {
    const pad = (dataMax - dataMin) * 0.08;
    min -= pad;
    max += pad;
  }

  const step = niceTickStep(max - min, targetTicks);
  const niceMin = isPositiveOnly ? 0 : Math.floor(min / step) * step;
  const niceMax = isNegativeOnly ? 0 : Math.ceil(max / step) * step;
  const ticks = [];
  for (let tick = niceMin; tick <= niceMax + step * 0.5; tick += step) {
    ticks.push(Math.abs(tick) < step / 1000000 ? 0 : tick);
  }
  if (!ticks.some((tick) => Math.abs(tick) < 0.000001)) ticks.push(0);
  ticks.sort((a, b) => a - b);

  return { min: niceMin, max: niceMax, ticks };
}

function formatWeight(value) {
  if (!Number.isFinite(value)) return "n/a";
  return (value / 10).toFixed(2);
}

function formatWeightForCopy(value) {
  if (!Number.isFinite(value)) return "n/a";
  return (value / 10).toFixed(6);
}

function priceChange(item, monthIndex, horizon) {
  if (horizon === "mom") {
    if (monthIndex <= 0) return NaN;
    return ((item.prices[monthIndex] / item.prices[monthIndex - 1]) - 1) * 100;
  }
  if (monthIndex < 12) return NaN;
  return ((item.prices[monthIndex] / item.prices[monthIndex - 12]) - 1) * 100;
}

function overall3dpIndex(monthIndex) {
  const overall = state.data?.overall3dp;
  if (!overall) return NaN;
  const month = state.data.months[monthIndex];
  const overallMonthIndex = overall.months.indexOf(month);
  if (overallMonthIndex < 0) return NaN;
  const value = overall.prices[overallMonthIndex];
  return Number.isFinite(value) ? value : NaN;
}

function roundedHeadlineChange(monthIndex, horizon) {
  const allItems = getAllItems();
  if (horizon === "mom") {
    if (monthIndex <= 0) return NaN;
    return ((allItems.prices[monthIndex] / allItems.prices[monthIndex - 1]) - 1) * 100;
  }
  if (monthIndex < 12) return NaN;
  return ((allItems.prices[monthIndex] / allItems.prices[monthIndex - 12]) - 1) * 100;
}

function actualHeadlineChange(monthIndex, horizon) {
  const current = overall3dpIndex(monthIndex);
  if (!Number.isFinite(current)) return roundedHeadlineChange(monthIndex, horizon);

  const previousIndex = horizon === "mom" ? monthIndex - 1 : monthIndex - 12;
  if (previousIndex < 0) return NaN;

  const previous = overall3dpIndex(previousIndex);
  if (!Number.isFinite(previous)) return roundedHeadlineChange(monthIndex, horizon);

  return ((current / previous) - 1) * 100;
}

function priceMeasureValue(item, monthIndex) {
  if (isSectorFiltered()) {
    if (item.level === leafLevel()) return priceChange(item, monthIndex, state.horizon);
    return aggregatePriceChange(activeLeafItemsFor(item), monthIndex, state.horizon);
  }
  return item.level === 0
    ? actualHeadlineChange(monthIndex, state.horizon)
    : priceChange(item, monthIndex, state.horizon);
}

function weightMeasureValue(item, monthIndex) {
  if (!isSectorFiltered()) return item.weights[monthIndex];
  const leaves = activeLeafItemsFor(item);
  const itemWeight = activeWeightTotal(monthIndex, leaves);
  if (!Number.isFinite(itemWeight)) return NaN;
  return itemWeight;
}

function signedClass(value) {
  if (!Number.isFinite(value) || Math.abs(value) < 0.0000001) return "";
  return value > 0 ? "positive" : "negative";
}

function codePrefix(name) {
  return (name.match(/^\s*(\d+(?:\.\d+)*)/) || [null, ""])[1];
}

function getAllItems() {
  return state.data.items.find((item) => item.level === 0);
}

function isRpi() {
  return state.indexFamily === "RPI";
}

function leafLevel() {
  return Math.max(...state.data.items.map((item) => item.level));
}

function maxSelectableLevel() {
  return leafLevel();
}

function previousJanuaryIndex(year) {
  return findMonthIndex(year - 1, 1);
}

function monthlyWeightIndex(monthIndex) {
  const { month } = monthParts(monthIndex);
  return isRpi() && month === 1 ? monthIndex - 1 : monthIndex;
}

function calcCacheKey() {
  return [
    state.indexFamily,
    state.horizon,
    state.sectorView,
    state.coreView,
    state.boeView,
  ].join("|");
}

function ensureCalcCache() {
  const key = calcCacheKey();
  if (calcCache.key === key) return calcCache;

  calcCache.key = key;
  calcCache.activeLeaves = null;
  calcCache.activeLeavesForItem = new Map();
  calcCache.activeWeightTotals = new Map();
  calcCache.subsetUnchainedJanuary = new Map();
  calcCache.subsetUnchainedIndex = new Map();
  calcCache.leafContributions = new Map();
  calcCache.contributions = new Map();
  return calcCache;
}

function invalidateCalcCache() {
  calcCache.key = "";
}

function monthParts(index) {
  const [year, month] = state.data.months[index].split("-").map(Number);
  return { year, month };
}

function findMonthIndex(year, month) {
  return state.data.months.indexOf(`${year}-${String(month).padStart(2, "0")}`);
}

function buildHierarchy() {
  const stack = [];
  state.data.items.forEach((item, index) => {
    item.id = index;
    item.children = [];
    item.prefix = codePrefix(item.name);
    while (stack.length && stack[stack.length - 1].level >= item.level) stack.pop();
    item.parentId = stack.length ? stack[stack.length - 1].id : null;
    if (item.parentId !== null) state.data.items[item.parentId].children.push(item.id);
    stack.push(item);
  });

  state.expanded = new Set([0]);
}

function setIndexFamily(indexFamily) {
  state.indexFamily = indexFamily;
  state.data = state.datasets[indexFamily];
  syncIndexFamilyInput();
  state.monthIndex = state.data.months.length - 1;
  state.sort = { type: "name", monthIndex: null };
  state.selectedRowId = null;
  if (isRpi() && state.boeView !== "all") {
    state.boeView = "all";
    checkRadio('[data-boe-view="all"]');
  }
  if (!isRpi() && state.sectorView === "housing") {
    state.sectorView = "all";
    checkRadio('[data-sector-view="all"]');
  }
  if (Number(state.levelView) > maxSelectableLevel()) {
    state.levelView = "all";
    checkRadio('[data-level-view="all"]');
  }
  invalidateCalcCache();
  buildHierarchy();
  updateIndexSpecificControls();
}

function descendantsAtLevel(item, level) {
  const out = [];
  const stack = [...item.children];
  while (stack.length) {
    const id = stack.shift();
    const child = state.data.items[id];
    if (child.level === level) out.push(child);
    stack.unshift(...child.children);
  }
  return out;
}

function leafItemsFor(item) {
  const level = leafLevel();
  if (item.level === level) return [item];
  if (item.level === 0) return state.data.items.filter((candidate) => candidate.level === level);
  return descendantsAtLevel(item, level);
}

function isSectorFiltered() {
  return state.sectorView !== "all" || state.coreView !== "all" || (!isRpi() && state.boeView !== "all");
}

function leafInActiveSectors(leaf) {
  const sectors = leaf.sectors || {};
  if (state.sectorView === "services" && !sectors.services) return false;
  if (state.sectorView === "goods" && (sectors.services || sectors.housing)) return false;
  if (state.sectorView === "housing" && !sectors.housing) return false;
  if (state.coreView === "noncore" && !sectors.nonCore) return false;
  if (state.coreView === "core" && sectors.nonCore) return false;
  if (!isRpi() && state.boeView === "boe" && !sectors.boe) return false;
  if (!isRpi() && state.boeView === "exboe" && !sectors.exBoe) return false;
  return true;
}

function activeLeafItems() {
  const cache = ensureCalcCache();
  if (!cache.activeLeaves) {
    cache.activeLeaves = state.data.items
      .filter((candidate) => candidate.level === leafLevel())
      .filter(leafInActiveSectors);
  }
  return cache.activeLeaves;
}

function activeLeafItemsFor(item) {
  const cache = ensureCalcCache();
  if (!cache.activeLeavesForItem.has(item.id)) {
    const leaves = leafItemsFor(item).filter(leafInActiveSectors);
    cache.activeLeavesForItem.set(item.id, leaves);
  }
  return cache.activeLeavesForItem.get(item.id);
}

function activeWeightTotal(monthIndex, leaves = null) {
  const cache = ensureCalcCache();
  if (!leaves) {
    if (!cache.activeWeightTotals.has(monthIndex)) {
      cache.activeWeightTotals.set(monthIndex, activeWeightTotal(monthIndex, activeLeafItems()));
    }
    return cache.activeWeightTotals.get(monthIndex);
  }

  const values = leaves
    .map((leaf) => leaf.weights[monthIndex])
    .filter(Number.isFinite);
  if (!values.length) return NaN;
  return values.reduce((sum, value) => sum + value, 0);
}

function activeBasketName() {
  const parts = [state.indexFamily];
  if (state.coreView === "core") parts.push("Core");
  if (state.coreView === "noncore") parts.push("Non Core");
  if (state.sectorView === "services") parts.push("Services");
  if (state.sectorView === "goods") parts.push("Goods");
  if (state.sectorView === "housing") parts.push("Housing");
  if (!isRpi() && state.boeView === "boe") parts.push("BoE Services");
  if (!isRpi() && state.boeView === "exboe") parts.push("ex BoE Services");
  if (parts.length === 1) return getAllItems().name;
  return `${parts.join(" ")} index`;
}

function displayName(item) {
  return item.level === 0 ? activeBasketName() : item.name;
}

function displayWeightCode(item) {
  return item.level === 0 && isSectorFiltered() ? "" : item.weightCode;
}

function displayPriceCode(item) {
  return item.level === 0 && isSectorFiltered() ? "" : item.priceCode;
}

function sectorDefinitionLabel(item) {
  const sectors = item.sectors || {};
  if (sectors.housing) return "Housing";
  if (sectors.services) return "Services";
  return "Goods";
}

function coreDefinitionLabel(item) {
  return item.sectors?.nonCore ? "Non Core" : "Core";
}

function boeDefinitionLabel(item) {
  if (isRpi()) return "";
  if (item.sectors?.boe) return "BoE Services";
  if (item.sectors?.exBoe) return "ex BoE Services";
  return "";
}

function definitionColumnKeys(showBoeColumn) {
  const keys = ["name", "level", "weightCode", "priceCode", "sector", "core"];
  if (showBoeColumn) keys.push("boe");
  keys.push("latestWeight");
  return keys;
}

function definitionHeaderHtml(label, key) {
  return `<th data-definition-col="${key}">${label}</th>`;
}

function onsSeriesUrl(code) {
  const clean = String(code || "").trim().toLowerCase();
  if (!clean) return "";
  return `https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/${clean}/mm23`;
}

function codeLinkHtml(code) {
  const clean = String(code || "").trim();
  if (!clean) return "";
  return `<a class="code-link" href="${onsSeriesUrl(clean)}" target="_blank" rel="noopener noreferrer">${clean}</a>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function ancestorsExpanded(item) {
  let parentId = item.parentId;
  while (parentId !== null) {
    if (!state.expanded.has(parentId)) return false;
    parentId = state.data.items[parentId].parentId;
  }
  return true;
}

function unchainedIndex(item, monthIndex) {
  const { year, month } = monthParts(monthIndex);
  const current = item.prices[monthIndex];
  if (month === 1) {
    const baseIndex = isRpi() ? previousJanuaryIndex(year) : findMonthIndex(year - 1, 12);
    if (baseIndex < 0) return NaN;
    return (current / item.prices[baseIndex]) * 100;
  }
  const january = findMonthIndex(year, 1);
  return (current / item.prices[january]) * 100;
}

function unchainedFromCurrentJanuary(item, monthIndex) {
  const { year } = monthParts(monthIndex);
  const january = findMonthIndex(year, 1);
  return (item.prices[monthIndex] / item.prices[january]) * 100;
}

function subsetUnchainedFromCurrentJanuary(monthIndex, weightMonthIndex, leaves = activeLeafItems()) {
  const cache = ensureCalcCache();
  const cacheKey = `${monthIndex}|${weightMonthIndex}`;
  if (leaves === activeLeafItems() && cache.subsetUnchainedJanuary.has(cacheKey)) {
    return cache.subsetUnchainedJanuary.get(cacheKey);
  }

  const totalWeight = activeWeightTotal(weightMonthIndex, leaves);
  if (!Number.isFinite(totalWeight) || totalWeight === 0) return NaN;

  const values = leaves
    .map((leaf) => {
      const index = unchainedFromCurrentJanuary(leaf, monthIndex);
      if (!Number.isFinite(index)) return NaN;
      return (leaf.weights[weightMonthIndex] / totalWeight) * index;
    })
    .filter(Number.isFinite);
  const value = values.length ? values.reduce((sum, value) => sum + value, 0) : NaN;
  if (leaves === activeLeafItems()) cache.subsetUnchainedJanuary.set(cacheKey, value);
  return value;
}

function subsetUnchainedIndex(monthIndex, weightMonthIndex, leaves = activeLeafItems()) {
  const cache = ensureCalcCache();
  const cacheKey = `${monthIndex}|${weightMonthIndex}`;
  if (leaves === activeLeafItems() && cache.subsetUnchainedIndex.has(cacheKey)) {
    return cache.subsetUnchainedIndex.get(cacheKey);
  }

  const totalWeight = activeWeightTotal(weightMonthIndex, leaves);
  if (!Number.isFinite(totalWeight) || totalWeight === 0) return NaN;

  const values = leaves
    .map((leaf) => {
      const index = unchainedIndex(leaf, monthIndex);
      if (!Number.isFinite(index)) return NaN;
      return (leaf.weights[weightMonthIndex] / totalWeight) * index;
    })
    .filter(Number.isFinite);
  const value = values.length ? values.reduce((sum, value) => sum + value, 0) : NaN;
  if (leaves === activeLeafItems()) cache.subsetUnchainedIndex.set(cacheKey, value);
  return value;
}

function monthlyLeafContribution(item, monthIndex) {
  if (monthIndex <= 0) return NaN;

  if (isSectorFiltered()) {
    return monthlySubsetLeafContribution(item, monthIndex, activeLeafItems());
  }

  const allItems = getAllItems();
  const { month } = monthParts(monthIndex);
  let itemCurrent;
  let itemPrevious;
  let allPrevious;

  if (month === 1) {
    itemCurrent = unchainedIndex(item, monthIndex);
    if (isRpi()) {
      itemPrevious = unchainedFromCurrentJanuary(item, monthIndex - 1);
      allPrevious = unchainedFromCurrentJanuary(allItems, monthIndex - 1);
    } else {
      itemPrevious = 100;
      allPrevious = 100;
    }
  } else {
    itemCurrent = unchainedFromCurrentJanuary(item, monthIndex);
    itemPrevious = unchainedFromCurrentJanuary(item, monthIndex - 1);
    allPrevious = unchainedFromCurrentJanuary(allItems, monthIndex - 1);
  }

  return (
    ((itemCurrent / itemPrevious) - 1) *
    100 *
    (itemPrevious / allPrevious) *
    (item.weights[monthlyWeightIndex(monthIndex)] / 1000)
  );
}

function monthlySubsetLeafContribution(item, monthIndex, leaves) {
  if (monthIndex <= 0) return NaN;

  const weightIndex = monthlyWeightIndex(monthIndex);
  const selectedWeight = activeWeightTotal(weightIndex, leaves);
  if (!Number.isFinite(selectedWeight) || selectedWeight === 0) return NaN;

  const { month } = monthParts(monthIndex);
  let itemCurrent;
  let itemPrevious;
  let subsetPrevious;

  if (month === 1) {
    itemCurrent = unchainedIndex(item, monthIndex);
    if (isRpi()) {
      itemPrevious = unchainedFromCurrentJanuary(item, monthIndex - 1);
      subsetPrevious = subsetUnchainedFromCurrentJanuary(monthIndex - 1, monthIndex, leaves);
    } else {
      itemPrevious = 100;
      subsetPrevious = 100;
    }
  } else {
    itemCurrent = unchainedFromCurrentJanuary(item, monthIndex);
    itemPrevious = unchainedFromCurrentJanuary(item, monthIndex - 1);
    subsetPrevious = subsetUnchainedFromCurrentJanuary(monthIndex - 1, monthIndex, leaves);
  }

  return (
    ((itemCurrent / itemPrevious) - 1) *
    100 *
    (itemPrevious / subsetPrevious) *
    (item.weights[weightIndex] / selectedWeight)
  );
}

function annualLeafContribution(item, monthIndex) {
  if (isRpi()) return annualRpiLeafContribution(item, monthIndex);

  const { year, month } = monthParts(monthIndex);
  if (monthIndex < 12) return NaN;

  const allItems = getAllItems();
  const previousMonthIndex = findMonthIndex(year - 1, month);
  const previousDecemberIndex = findMonthIndex(year - 1, 12);
  const currentJanuaryIndex = findMonthIndex(year, 1);
  const currentFebruaryIndex = findMonthIndex(year, 2);
  const previousFebruaryIndex = findMonthIndex(year - 1, 2);

  if (
    previousMonthIndex < 0 ||
    previousDecemberIndex < 0 ||
    currentJanuaryIndex < 0 ||
    previousFebruaryIndex < 0
  ) {
    return NaN;
  }

  const denom = unchainedFromCurrentJanuary(allItems, previousMonthIndex);
  const allPreviousDecember = unchainedFromCurrentJanuary(allItems, previousDecemberIndex);
  const allCurrentJanuary = unchainedIndex(allItems, currentJanuaryIndex);

  const itemPreviousMonth = unchainedFromCurrentJanuary(item, previousMonthIndex);
  const itemPreviousDecember = unchainedFromCurrentJanuary(item, previousDecemberIndex);
  const itemCurrentJanuary = unchainedIndex(item, currentJanuaryIndex);
  const itemCurrentMonth = unchainedFromCurrentJanuary(item, monthIndex);

  const previousWeight = item.weights[previousFebruaryIndex] / 1000;
  const januaryWeight = item.weights[currentJanuaryIndex] / 1000;

  const termOne =
    previousWeight * ((itemPreviousDecember - itemPreviousMonth) / denom) * 100;
  const termTwo =
    januaryWeight *
    ((itemCurrentJanuary - 100) / denom) *
    allPreviousDecember;
  const termThree =
    month === 1 || currentFebruaryIndex < 0
      ? 0
      : (item.weights[currentFebruaryIndex] / 1000) *
        ((itemCurrentMonth - 100) / denom) *
        (allCurrentJanuary / 100) *
        allPreviousDecember;

  return termOne + termTwo + termThree;
}

function annualRpiLeafContribution(item, monthIndex) {
  const { year, month } = monthParts(monthIndex);
  if (monthIndex < 12) return NaN;

  const allItems = getAllItems();
  const previousMonthIndex = findMonthIndex(year - 1, month);
  const previousJanuary = previousJanuaryIndex(year);
  const currentJanuary = findMonthIndex(year, 1);

  if (previousMonthIndex < 0 || previousJanuary < 0 || currentJanuary < 0) return NaN;

  const denom = unchainedFromCurrentJanuary(allItems, previousMonthIndex);
  const allCurrentJanuary = unchainedIndex(allItems, currentJanuary);
  const itemPreviousMonth = unchainedFromCurrentJanuary(item, previousMonthIndex);
  const itemCurrentJanuary = unchainedIndex(item, currentJanuary);
  const itemCurrentMonth =
    month === 1 ? 100 : unchainedFromCurrentJanuary(item, monthIndex);

  const previousWeight = item.weights[previousJanuary] / 1000;
  const currentWeight = item.weights[currentJanuary] / 1000;

  const termOne = previousWeight * ((itemCurrentJanuary - itemPreviousMonth) / denom) * 100;
  const termTwo =
    month === 1
      ? 0
      : currentWeight *
        ((itemCurrentMonth - 100) / denom) *
        (allCurrentJanuary / 100) *
        100;

  return termOne + termTwo;
}

function annualSubsetLeafContribution(item, monthIndex, leaves = activeLeafItems()) {
  if (isRpi()) return annualRpiSubsetLeafContribution(item, monthIndex, leaves);

  const { year, month } = monthParts(monthIndex);
  if (monthIndex < 12) return NaN;

  const previousMonthIndex = findMonthIndex(year - 1, month);
  const previousDecemberIndex = findMonthIndex(year - 1, 12);
  const currentJanuaryIndex = findMonthIndex(year, 1);
  const currentFebruaryIndex = findMonthIndex(year, 2);
  const previousFebruaryIndex = findMonthIndex(year - 1, 2);

  if (
    previousMonthIndex < 0 ||
    previousDecemberIndex < 0 ||
    currentJanuaryIndex < 0 ||
    previousFebruaryIndex < 0
  ) {
    return NaN;
  }

  const previousWeightTotal = activeWeightTotal(previousFebruaryIndex, leaves);
  const januaryWeightTotal = activeWeightTotal(currentJanuaryIndex, leaves);
  const februaryWeightTotal = activeWeightTotal(currentFebruaryIndex, leaves);
  if (
    !Number.isFinite(previousWeightTotal) ||
    !Number.isFinite(januaryWeightTotal) ||
    !Number.isFinite(februaryWeightTotal) ||
    previousWeightTotal === 0 ||
    januaryWeightTotal === 0 ||
    februaryWeightTotal === 0
  ) {
    return NaN;
  }

  const denom = subsetUnchainedFromCurrentJanuary(previousMonthIndex, previousFebruaryIndex, leaves);
  const subsetPreviousDecember = subsetUnchainedFromCurrentJanuary(previousDecemberIndex, previousFebruaryIndex, leaves);
  const subsetCurrentJanuary = subsetUnchainedIndex(currentJanuaryIndex, currentJanuaryIndex, leaves);

  const itemPreviousMonth = unchainedFromCurrentJanuary(item, previousMonthIndex);
  const itemPreviousDecember = unchainedFromCurrentJanuary(item, previousDecemberIndex);
  const itemCurrentJanuary = unchainedIndex(item, currentJanuaryIndex);
  const itemCurrentMonth = unchainedFromCurrentJanuary(item, monthIndex);

  const previousWeight = item.weights[previousFebruaryIndex] / previousWeightTotal;
  const januaryWeight = item.weights[currentJanuaryIndex] / januaryWeightTotal;

  const termOne =
    previousWeight * ((itemPreviousDecember - itemPreviousMonth) / denom) * 100;
  const termTwo =
    januaryWeight *
    ((itemCurrentJanuary - 100) / denom) *
    subsetPreviousDecember;
  const termThree =
    month === 1 || currentFebruaryIndex < 0
      ? 0
      : (item.weights[currentFebruaryIndex] / februaryWeightTotal) *
        ((itemCurrentMonth - 100) / denom) *
        (subsetCurrentJanuary / 100) *
        subsetPreviousDecember;

  return termOne + termTwo + termThree;
}

function annualRpiSubsetLeafContribution(item, monthIndex, leaves = activeLeafItems()) {
  const { year, month } = monthParts(monthIndex);
  if (monthIndex < 12) return NaN;

  const previousMonthIndex = findMonthIndex(year - 1, month);
  const previousJanuary = previousJanuaryIndex(year);
  const currentJanuary = findMonthIndex(year, 1);

  if (previousMonthIndex < 0 || previousJanuary < 0 || currentJanuary < 0) return NaN;

  const previousWeightTotal = activeWeightTotal(previousJanuary, leaves);
  const currentWeightTotal = activeWeightTotal(currentJanuary, leaves);
  if (
    !Number.isFinite(previousWeightTotal) ||
    !Number.isFinite(currentWeightTotal) ||
    previousWeightTotal === 0 ||
    currentWeightTotal === 0
  ) {
    return NaN;
  }

  const denom = subsetUnchainedFromCurrentJanuary(previousMonthIndex, previousJanuary, leaves);
  const subsetCurrentJanuary = subsetUnchainedIndex(currentJanuary, currentJanuary, leaves);
  const itemPreviousMonth = unchainedFromCurrentJanuary(item, previousMonthIndex);
  const itemCurrentJanuary = unchainedIndex(item, currentJanuary);
  const itemCurrentMonth =
    month === 1 ? 100 : unchainedFromCurrentJanuary(item, monthIndex);

  const previousWeight = item.weights[previousJanuary] / previousWeightTotal;
  const currentWeight = item.weights[currentJanuary] / currentWeightTotal;

  const termOne = previousWeight * ((itemCurrentJanuary - itemPreviousMonth) / denom) * 100;
  const termTwo =
    month === 1
      ? 0
      : currentWeight *
        ((itemCurrentMonth - 100) / denom) *
        (subsetCurrentJanuary / 100) *
        100;

  return termOne + termTwo;
}

function aggregatePriceChange(leaves, monthIndex, horizon) {
  if (!leaves.length) return NaN;
  const values = leaves
    .map((leaf) =>
      horizon === "mom"
        ? monthlySubsetLeafContribution(leaf, monthIndex, leaves)
        : annualSubsetLeafContribution(leaf, monthIndex, leaves),
    )
    .filter(Number.isFinite);
  if (!values.length) return NaN;
  return values.reduce((sum, value) => sum + value, 0);
}

function leafContribution(item, monthIndex, horizon) {
  const cache = ensureCalcCache();
  const cacheKey = `${item.id}|${monthIndex}|${horizon}`;
  if (cache.leafContributions.has(cacheKey)) return cache.leafContributions.get(cacheKey);

  const value = isSectorFiltered() && horizon === "yoy"
    ? annualSubsetLeafContribution(item, monthIndex)
    : horizon === "mom"
    ? monthlyLeafContribution(item, monthIndex)
    : annualLeafContribution(item, monthIndex);
  cache.leafContributions.set(cacheKey, value);
  return value;
}

function contribution(item, monthIndex, horizon) {
  const cache = ensureCalcCache();
  const cacheKey = `${item.id}|${monthIndex}|${horizon}`;
  if (cache.contributions.has(cacheKey)) return cache.contributions.get(cacheKey);

  const leaves = isSectorFiltered() ? activeLeafItemsFor(item) : leafItemsFor(item);
  const values = leaves
    .map((leaf) => leafContribution(leaf, monthIndex, horizon))
    .filter(Number.isFinite);
  const value = values.length ? values.reduce((sum, value) => sum + value, 0) : NaN;
  cache.contributions.set(cacheKey, value);
  return value;
}

function headlineChange(monthIndex, horizon) {
  return actualHeadlineChange(monthIndex, horizon);
}

function calculatedTotal(level, monthIndex, horizon) {
  const items =
    level === 0
      ? [getAllItems()]
      : state.data.items.filter((item) => item.level === level);
  const values = items
    .map((item) => contribution(item, monthIndex, horizon))
    .filter(Number.isFinite);
  if (!values.length) return NaN;
  return values.reduce((sum, value) => sum + value, 0);
}

function currentCalculatedTotal() {
  const level = state.levelView === "all" ? 0 : Number(state.levelView);
  return calculatedTotal(level, state.monthIndex, state.horizon);
}

function rowValue(item) {
  if (state.measure === "weight") return weightMeasureValue(item, state.monthIndex);
  if (state.measure === "price") return priceMeasureValue(item, state.monthIndex);
  return contribution(item, state.monthIndex, state.horizon);
}

function formattedRowValue(value) {
  if (state.measure === "weight") return formatWeight(value);
  if (state.measure === "price") return formatNumber(value, 2);
  return formatContribution(value);
}

function shortMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[monthNumber - 1]} ${String(year).slice(2)}`;
}

function visibleMonthIndices() {
  const count = state.data.months.length;
  const allIndices = state.data.months.map((_, index) => index);
  const visible = state.timeRange === "all"
    ? allIndices
    : allIndices.slice(Math.max(0, count - (Number(state.timeRange) * 12)));
  return visible.reverse();
}

function isMobileExplorer() {
  return mobileViewportQuery.matches && document.body.classList.contains("mobile-explorer");
}

function syncResponsiveMode(event = mobileViewportQuery) {
  if (event.matches) return;
  const hadMobileMode = document.body.classList.contains("mobile-explorer") || document.body.classList.contains("mobile-desktop");
  document.body.classList.remove("mobile-explorer", "mobile-desktop", "mobile-filters-open");
  if (hadMobileMode && state.data) render();
}

function setMobileView(mode) {
  if (!mobileViewportQuery.matches) {
    syncResponsiveMode();
    return;
  }
  document.body.classList.remove("mobile-explorer", "mobile-desktop", "mobile-filters-open");
  document.body.classList.add(mode === "desktop" ? "mobile-desktop" : "mobile-explorer");
  if (mode === "explorer") {
    state.activeTab = "explorer";
    setActiveButtons("[data-tab]", state.activeTab, "tab");
    els.explorerPanel.classList.add("active");
    els.chartPanel?.classList.remove("active");
    els.definitionsPanel?.classList.remove("active");
    els.featuresPanel.classList.remove("active");
    els.errorsPanel.classList.remove("active");
  }
  render();
  window.scrollTo({ top: 0, left: 0 });
}

function renderMobileChrome() {
  if (!state.data) return;
  const measure = {
    contribution: "Contribution",
    price: "Price change",
    weight: "Weight",
  }[state.measure];
  if (els.mobileSelectionSummary) {
    els.mobileSelectionSummary.textContent = `${state.indexFamily} · ${state.horizon === "mom" ? "MoM" : "YoY"} · ${measure}`;
  }
  if (els.mobileMonthSelect) {
    els.mobileMonthSelect.innerHTML = state.data.months
      .map((month, index) => `<option value="${index}" ${index === state.monthIndex ? "selected" : ""}>${formatMonth(month)}</option>`)
      .join("");
  }
  if (els.mobileMonthPrevious) els.mobileMonthPrevious.disabled = state.monthIndex <= 0;
  if (els.mobileMonthNext) els.mobileMonthNext.disabled = state.monthIndex >= state.data.months.length - 1;
}

function renderSummary() {
}

function sortLabel(item) {
  return displayName(item).toLocaleLowerCase("en-GB");
}

function sortValue(item, monthIndex) {
  if (state.measure === "weight") return weightMeasureValue(item, monthIndex);
  if (state.measure === "price") return priceMeasureValue(item, monthIndex);
  return contribution(item, monthIndex, state.horizon);
}

function sortedItems(items) {
  const sorted = [...items];
  if (state.sort.type === "month") {
    sorted.sort((a, b) => {
      const aValue = sortValue(a, state.sort.monthIndex);
      const bValue = sortValue(b, state.sort.monthIndex);
      const aFinite = Number.isFinite(aValue);
      const bFinite = Number.isFinite(bValue);
      if (aFinite && bFinite && bValue !== aValue) return bValue - aValue;
      if (aFinite !== bFinite) return aFinite ? -1 : 1;
      return sortLabel(a).localeCompare(sortLabel(b), "en-GB", { numeric: true });
    });
    return sorted;
  }

  sorted.sort((a, b) =>
    sortLabel(a).localeCompare(sortLabel(b), "en-GB", { numeric: true }),
  );
  return sorted;
}

function visibleAllItemsSorted() {
  const root = getAllItems();
  const out = [];

  function appendBranch(item) {
    if (item.level !== 0 && isSectorFiltered() && !activeLeafItemsFor(item).length) return;
    out.push(item);
    if (!state.expanded.has(item.id)) return;
    sortedItems(item.children.map((id) => state.data.items[id])).forEach(appendBranch);
  }

  appendBranch(root);
  return out;
}

function visibleItems() {
  if (state.levelView !== "all") {
    return [
      getAllItems(),
      ...sortedItems(
        state.data.items.filter(
          (item) =>
            item.level === Number(state.levelView) &&
            (!isSectorFiltered() || activeLeafItemsFor(item).length),
        ),
      ),
    ];
  }
  return visibleAllItemsSorted();
}

function expandableItemIds() {
  return state.data.items
    .filter((item) => item.children.length && (item.level === 0 || !isSectorFiltered() || activeLeafItemsFor(item).length))
    .map((item) => item.id);
}

function renderExplorer() {
  const mobile = isMobileExplorer();
  const measureTitle = {
    weight: "Wgt, %",
    price: `Price Chg, % (${state.horizon === "mom" ? "MoM" : "YoY"})`,
    contribution: "Ctrb, bp",
  }[state.measure];
  els.itemRows.dataset.view = state.levelView;
  const monthIndices = mobile ? [state.monthIndex] : visibleMonthIndices();
  const monthCount = monthIndices.length;
  const tableClass =
    mobile ? "mobile-explorer-table" : monthCount <= 12 ? "range-compact" : monthCount <= 24 ? "range-two-year" : "range-scroll";
  const fixedColumnWidth = 746;
  document.documentElement.style.setProperty("--month-count", monthCount);
  document.documentElement.style.setProperty("--fixed-col-width", `${fixedColumnWidth}px`);
  document.documentElement.style.setProperty("--month-col-width", "64px");
  els.itemTable.className = tableClass;

  els.itemCols.innerHTML = mobile ? `
      <col class="col-name" />
      <col class="col-mobile-value" />
  ` : `
      <col class="col-name" />
      <col class="col-level" />
      <col class="col-weight-code" />
      <col class="col-price-code" />
      ${monthIndices.map(() => `<col class="col-month" />`).join("")}
  `;

  const nameSortIcon =
    state.sort.type === "name" ? `<span class="sort-icon sort-icon-az" aria-label="Sorted A to Z"></span>` : "";
  const treeActions =
    state.levelView === "all" && !mobile
      ? `
        <span class="header-tree-actions" aria-label="Tree controls">
          <button type="button" data-tree-action="expand" title="Expand all" aria-label="Expand all">Expand All</button>
          <button type="button" data-tree-action="collapse" title="Collapse all" aria-label="Collapse all">Collapse All</button>
        </span>
      `
      : "";
  els.itemHead.innerHTML = `
    <tr>
      <th class="sticky-name sortable-header ${state.sort.type === "name" ? "sorted-header" : ""}" data-sort-name="true" title="Right-click to sort A to Z"><span class="header-label">Name</span>${treeActions}${nameSortIcon}</th>
      ${mobile ? "" : `<th class="meta-col">Level</th><th class="meta-col code-col">Weight Code</th><th class="meta-col code-col">Price Code</th>`}
      ${monthIndices
        .map(
          (index) => `
            <th class="number month-head sortable-header ${state.sort.type === "month" && state.sort.monthIndex === index ? "sorted-header" : ""}" data-sort-month="${index}" title="Right-click to sort largest to smallest">
              <span class="month-label" title="${formatMonth(state.data.months[index])}">${shortMonth(state.data.months[index])}</span>
              ${mobile ? `<span class="mobile-measure-title">${measureTitle}</span>` : ""}
              ${state.sort.type === "month" && state.sort.monthIndex === index ? `<span class="sort-icon sort-icon-desc" aria-label="Sorted largest to smallest"></span>` : ""}
            </th>
          `,
        )
        .join("")}
    </tr>
  `;

  const rows = visibleItems()
    .map((item) => {
      const values = monthIndices
        .map((monthIndex) => {
          let value;
          if (state.measure === "weight") value = weightMeasureValue(item, monthIndex);
          else if (state.measure === "price") value = priceMeasureValue(item, monthIndex);
          else value = contribution(item, monthIndex, state.horizon);
          return `
            <td class="number month-cell ${state.measure === "contribution" || state.measure === "price" ? signedClass(value) : ""}">
              ${formattedRowValue(value)}
            </td>
          `;
        })
        .join("");
      const hasChildren = item.children.length > 0;
      const expanded = state.expanded.has(item.id);
      const toggle = hasChildren
        ? `<button class="tree-toggle" data-toggle="${item.id}" aria-label="${expanded ? "Collapse" : "Expand"} ${item.name}">${expanded ? "-" : "+"}</button>`
        : `<span class="tree-spacer"></span>`;
      return `
        <tr class="level-row level-${item.level} ${state.selectedRowId === item.id ? "selected-row" : ""}" data-row-id="${item.id}" data-chart-row="true">
          <td class="sticky-name">
            <div class="tree-name" style="--depth:${item.level}">
              ${state.levelView === "all" ? toggle : ""}
              <span>${displayName(item)}</span>
            </div>
          </td>
          ${mobile ? "" : `<td class="meta-cell"><span class="level-pill">L${item.level}</span></td><td class="meta-cell code-cell">${codeLinkHtml(displayWeightCode(item))}</td><td class="meta-cell code-cell">${codeLinkHtml(displayPriceCode(item))}</td>`}
          ${values}
        </tr>
      `;
    })
    .join("");

  els.itemRows.innerHTML = rows;
}

function renderDefinitions() {
  const leafLevelValue = leafLevel();
  const latestMonthIndex = state.data.months.length - 1;
  const rows = state.data.items
    .filter((item) => item.level === leafLevelValue)
    .filter(leafInActiveSectors)
    .sort((a, b) => sortLabel(a).localeCompare(sortLabel(b), "en-GB", { numeric: true }));
  const showBoeColumn = !isRpi();
  const filterParts = [];
  if (state.sectorView !== "all") filterParts.push(state.sectorView === "housing" ? "Housing" : state.sectorView === "services" ? "Services" : "Goods");
  if (state.coreView !== "all") filterParts.push(state.coreView === "noncore" ? "Non Core" : "Core");
  if (showBoeColumn && state.boeView !== "all") filterParts.push(state.boeView === "boe" ? "BoE Services" : "All exc BoE Services");
  const filterLabel = filterParts.length ? filterParts.join(", ") : "All definitions";
  const columnKeys = definitionColumnKeys(showBoeColumn);
  const columnWidths = showBoeColumn
    ? { name: 31, level: 6, weightCode: 10, priceCode: 10, sector: 10, core: 10, boe: 12, latestWeight: 11 }
    : { name: 36, level: 7, weightCode: 12, priceCode: 12, sector: 12, core: 11, latestWeight: 10 };

  els.definitionsSummary.textContent = `${state.indexFamily}: ${rows.length} leaf definitions shown for ${filterLabel}.`;
  els.definitionsCols.innerHTML = columnKeys
    .map((key) => `<col data-definition-col="${key}" style="width:${columnWidths[key]}%" />`)
    .join("");
  els.definitionsRows.closest("table").style.width = "100%";
  els.definitionsHead.innerHTML = `
    <tr>
      ${definitionHeaderHtml("Name", "name")}
      ${definitionHeaderHtml("Level", "level")}
      ${definitionHeaderHtml("Weight Code", "weightCode")}
      ${definitionHeaderHtml("Price Code", "priceCode")}
      ${definitionHeaderHtml("Sector", "sector")}
      ${definitionHeaderHtml("Core", "core")}
      ${showBoeColumn ? definitionHeaderHtml("BoE Services", "boe") : ""}
      ${definitionHeaderHtml("Latest Weight, %", "latestWeight")}
    </tr>
  `;
  els.definitionsRows.innerHTML = rows
    .map(
      (item) => `
        <tr>
          <td class="definition-name-cell">${escapeHtml(item.name)}</td>
          <td class="definition-center-cell"><span class="level-pill">L${item.level}</span></td>
          <td class="definition-center-cell code-cell">${codeLinkHtml(item.weightCode)}</td>
          <td class="definition-center-cell code-cell">${codeLinkHtml(item.priceCode)}</td>
          <td class="definition-center-cell">${sectorDefinitionLabel(item)}</td>
          <td class="definition-center-cell">${coreDefinitionLabel(item)}</td>
          ${showBoeColumn ? `<td class="definition-center-cell">${boeDefinitionLabel(item)}</td>` : ""}
          <td class="definition-number-cell">${formatWeight(item.weights[latestMonthIndex])}</td>
        </tr>
      `,
    )
    .join("");
}

function copyValue(item, monthIndex) {
  if (state.measure === "weight") return formatWeightForCopy(weightMeasureValue(item, monthIndex));
  if (state.measure === "price") return formatNumber(priceMeasureValue(item, monthIndex), 6);
  return formatContributionForCopy(contribution(item, monthIndex, state.horizon));
}

function visibleTableTsv() {
  const measureTitle = {
    weight: "Wgt, %",
    price: `Price Chg, % (${state.horizon === "mom" ? "MoM" : "YoY"})`,
    contribution: "Ctrb, bp",
  }[state.measure];
  const monthIndices = isMobileExplorer() ? [state.monthIndex] : visibleMonthIndices();
  const header = ["Name", "Level", "Wgt Code", "Px Code", ...monthIndices.map((index) => shortMonth(state.data.months[index]))];
  const rows = visibleItems().map((item) => [
    displayName(item),
    `L${item.level}`,
    displayWeightCode(item),
    displayPriceCode(item),
    ...monthIndices.map((monthIndex) => copyValue(item, monthIndex)),
  ]);
  return [header, ...rows]
    .map((row) => row.map((cell) => String(cell ?? "").replace(/\t|\r?\n/g, " ")).join("\t"))
    .join("\n");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function visibleTableHtml() {
  const tsv = visibleTableTsv();
  const rows = tsv.split("\n").map((line) => line.split("\t"));
  return `
    <table>
      ${rows
        .map(
          (row, rowIndex) => `
            <tr>
              ${row
                .map((cell) =>
                  rowIndex === 0
                    ? `<th>${escapeHtml(cell)}</th>`
                    : `<td>${escapeHtml(cell)}</td>`,
                )
                .join("")}
            </tr>
          `,
        )
        .join("")}
    </table>
  `;
}

function fullMonthIndices() {
  return state.data.months.map((_, index) => index);
}

function chartValue(item, monthIndex, mode) {
  if (mode === "weight") return weightMeasureValue(item, monthIndex) / 10;
  if (mode === "contribution") return contribution(item, monthIndex, state.horizon) * 100;
  if (mode === "contribution-cumulative") {
    return fullMonthIndices()
      .filter((index) => index <= monthIndex)
      .reduce((sum, index) => {
        const value = contribution(item, index, state.horizon);
        return Number.isFinite(value) ? sum + value * 100 : sum;
      }, 0);
  }
  if (mode === "price-change") return priceMeasureValue(item, monthIndex);
  if (mode === "price-index") {
    const base = item.prices[0];
    const current = item.prices[monthIndex];
    if (!Number.isFinite(base) || !Number.isFinite(current) || base === 0) return NaN;
    return (current / base) * 100;
  }
  return NaN;
}

function chartModeLabel(mode) {
  return {
    weight: "Weight, %",
    contribution: `Contribution, bp (${state.horizon === "mom" ? "MoM" : "YoY"})`,
    "contribution-cumulative": `Cumulative contribution, bp (${state.horizon === "mom" ? "MoM" : "YoY"})`,
    "price-change": `Price change, % (${state.horizon === "mom" ? "MoM" : "YoY"})`,
    "price-index": "Index, Jan 2015 = 100",
  }[mode] || "Chart";
}

function chartSeriesLabel(item, mode) {
  const measure =
    mode === "weight"
      ? "WEIGHT"
      : mode === "price-index"
      ? "INDEX"
      : mode === "price-change"
      ? "PRICE CHANGE"
      : mode === "contribution-cumulative"
      ? "CUMULATIVE CONTRIBUTION"
      : "CONTRIBUTION";
  return `${state.indexFamily} ${measure} ${displayName(item).toUpperCase()} ${mode === "price-index" ? "2015=100" : ""}`.trim();
}

function setActiveTab(tab) {
  state.activeTab = tab;
  setActiveButtons("[data-tab]", state.activeTab, "tab");
  els.explorerPanel.classList.toggle("active", state.activeTab === "explorer");
  els.chartPanel?.classList.toggle("active", state.activeTab === "chart");
  els.definitionsPanel?.classList.toggle("active", state.activeTab === "definitions");
  els.featuresPanel.classList.toggle("active", state.activeTab === "features");
  els.errorsPanel.classList.toggle("active", state.activeTab === "errors");
  render();
}

function openChart(item, mode) {
  state.chart = {
    itemId: item.id,
    mode,
    indexFamily: state.indexFamily,
    horizon: state.horizon,
    measure: state.measure,
    sectorView: state.sectorView,
    coreView: state.coreView,
    boeView: state.boeView,
  };
  if (els.chartTab) els.chartTab.hidden = false;
  setActiveTab("chart");
}

function hideChartContextMenu() {
  if (!els.chartContextMenu) return;
  els.chartContextMenu.hidden = true;
  els.chartContextMenu.innerHTML = "";
  state.contextRowId = null;
}

function showChartTooltip(event, point) {
  if (!els.chartTooltip) return;
  const month = point.dataset.chartMonth;
  const value = point.dataset.chartValue;
  const label = point.dataset.chartLabel;
  els.chartTooltip.innerHTML = `<strong>${escapeHtml(month)}</strong><span>${escapeHtml(label)}: ${escapeHtml(value)}</span>`;
  els.chartTooltip.style.left = `${event.clientX + 12}px`;
  els.chartTooltip.style.top = `${event.clientY + 12}px`;
  els.chartTooltip.hidden = false;
}

function hideChartTooltip() {
  if (!els.chartTooltip) return;
  els.chartTooltip.hidden = true;
}

function showChartContextMenu(event, item) {
  if (!els.chartContextMenu) return;
  if (state.measure === "contribution") {
    hideChartContextMenu();
    return;
  }
  state.contextRowId = item.id;
  const options =
    state.measure === "weight"
      ? [{ mode: "weight", label: "Weight over time", icon: "W" }]
      : [
          { mode: "price-change", label: "Price change, %", icon: "%" },
          { mode: "price-index", label: "Index, Jan 2015 = 100", icon: "I" },
        ];

  els.chartContextMenu.innerHTML = `
    <div class="context-menu-title">
      <span class="context-menu-title-icon" aria-hidden="true">
        <svg viewBox="0 0 20 20" focusable="false">
          <path d="M3 15.5h14" />
          <path d="M4 13l3.2-3.4 3 2.1L16 5" />
          <circle cx="4" cy="13" r="1.2" />
          <circle cx="7.2" cy="9.6" r="1.2" />
          <circle cx="10.2" cy="11.7" r="1.2" />
          <circle cx="16" cy="5" r="1.2" />
        </svg>
      </span>
      <span>
        <strong>Plot Chart</strong>
        <small>${escapeHtml(displayName(item))}</small>
      </span>
    </div>
    <div class="context-menu-separator"></div>
    ${options
      .map(
        (option) => `
          <button type="button" data-chart-mode="${option.mode}">
            <span class="context-menu-option-icon" aria-hidden="true">${escapeHtml(option.icon)}</span>
            <span>${escapeHtml(option.label)}</span>
          </button>
        `,
      )
      .join("")}
  `;
  const menuWidth = 284;
  const menuHeight = 58 + options.length * 38;
  const left = Math.min(event.clientX, window.innerWidth - menuWidth - 8);
  const top = Math.min(event.clientY, window.innerHeight - menuHeight - 8);
  els.chartContextMenu.style.left = `${Math.max(8, left)}px`;
  els.chartContextMenu.style.top = `${Math.max(8, top)}px`;
  els.chartContextMenu.hidden = false;
}

function renderChart() {
  if (!state.chart || !els.chartSvg) return;
  const item = state.data.items[state.chart.itemId];
  if (!item) return;

  const width = 1200;
  const height = Math.max(460, els.chartSvg.clientHeight || 560);
  const margin = { top: 52, right: 28, bottom: 84, left: 72 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const months = fullMonthIndices();
  const values = months.map((monthIndex) => chartValue(item, monthIndex, state.chart.mode));
  const finite = values.filter(Number.isFinite);
  if (!finite.length) {
    els.chartSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    els.chartSvg.innerHTML = `<text x="24" y="40" class="chart-empty">No chartable values</text>`;
    return;
  }

  const forceZeroMin = ["contribution-cumulative", "index", "weight"].includes(state.chart.mode);
  const scale = niceChartScale(finite, 7, { forceZeroMin });
  const { min, max, ticks } = scale;
  const plotValue = (value) => (forceZeroMin ? Math.max(0, value) : value);

  const x = (i) => margin.left + (months.length <= 1 ? 0 : (i / (months.length - 1)) * plotWidth);
  const y = (value) => margin.top + ((max - value) / (max - min)) * plotHeight;
  const zeroY = y(0);
  const path = values
    .map((value, i) => (Number.isFinite(value) ? `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(plotValue(value)).toFixed(2)}` : ""))
    .filter(Boolean)
    .join(" ");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const tickTarget = 13;
  const tickStep = Math.max(1, Math.ceil(months.length / tickTarget));
  const xTicks = months
    .map((monthIndex, i) => ({ monthIndex, i }))
    .filter(({ i }) => i === 0 || i % tickStep === 0);
  const lastTick = xTicks[xTicks.length - 1];
  if (!lastTick || months.length - 1 - lastTick.i >= Math.ceil(tickStep * 0.65)) {
    xTicks.push({ monthIndex: months[months.length - 1], i: months.length - 1 });
  }
  const monthLabels = xTicks
    .map(({ monthIndex, i }) => {
      const monthNumber = Number(state.data.months[monthIndex].slice(5, 7));
      const year = state.data.months[monthIndex].slice(0, 4);
      return `
        <text class="chart-x-year" x="${x(i)}" y="${height - 52}" text-anchor="middle">${year}</text>
        <text class="chart-x-month" x="${x(i)}" y="${height - 34}" text-anchor="middle">${monthNames[monthNumber - 1].toUpperCase()}</text>
      `;
    })
    .join("");
  const yGrid = ticks
    .map((tick) => `
      <line class="chart-grid" x1="${margin.left}" x2="${width - margin.right}" y1="${y(tick)}" y2="${y(tick)}" />
      <text class="chart-y-label" x="${margin.left - 10}" y="${y(tick) + 4}" text-anchor="end">${formatAxisValue(tick)}</text>
    `)
    .join("");

  const seriesLabel = chartSeriesLabel(item, state.chart.mode);
  els.chartTitle.textContent = `${displayName(item)} - ${chartModeLabel(state.chart.mode)}`;
  els.chartSubtitle.textContent = `${state.indexFamily}, full history, ${state.data.months[0]} to ${state.data.months[state.data.months.length - 1]}`;
  els.chartSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  els.chartSvg.innerHTML = `
    <rect class="chart-bg" x="0" y="0" width="${width}" height="${height}" />
    <text class="chart-main-title" x="${width / 2}" y="28" text-anchor="middle">${escapeHtml(seriesLabel)}</text>
    <text class="chart-y-title" x="${margin.left - 48}" y="${margin.top - 12}">${escapeHtml(chartModeLabel(state.chart.mode))}</text>
    ${yGrid}
    <line class="chart-zero" x1="${margin.left}" x2="${width - margin.right}" y1="${zeroY}" y2="${zeroY}" />
    <line class="chart-axis" x1="${margin.left}" x2="${margin.left}" y1="${margin.top}" y2="${height - margin.bottom}" />
    <line class="chart-axis" x1="${margin.left}" x2="${width - margin.right}" y1="${height - margin.bottom}" y2="${height - margin.bottom}" />
    <path class="chart-line" d="${path}" />
    ${values
      .map((value, i) => Number.isFinite(value) ? `<circle class="chart-point" cx="${x(i)}" cy="${y(plotValue(value))}" r="3" data-chart-month="${escapeHtml(formatMonth(state.data.months[months[i]]))}" data-chart-value="${formatAxisValue(value)}" data-chart-label="${escapeHtml(chartModeLabel(state.chart.mode))}"></circle>` : "")
      .join("")}
    ${monthLabels}
    <g class="chart-legend">
      <line x1="${width / 2 - 160}" x2="${width / 2 - 140}" y1="${height - 22}" y2="${height - 22}" />
      <circle cx="${width / 2 - 150}" cy="${height - 22}" r="2" />
      <text x="${width / 2 - 132}" y="${height - 18}">${escapeHtml(seriesLabel)}</text>
    </g>
  `;
}

function renderErrors() {
  if (errorsHtmlCache) {
    els.errorRows.innerHTML = errorsHtmlCache;
    return;
  }

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function withDataset(indexFamily, callback) {
    const previous = {
      data: state.data,
      indexFamily: state.indexFamily,
      sectorView: state.sectorView,
      coreView: state.coreView,
      boeView: state.boeView,
      expanded: new Set(state.expanded),
    };
    state.indexFamily = indexFamily;
    state.data = state.datasets[indexFamily];
    state.sectorView = "all";
    state.coreView = "all";
    state.boeView = "none";
    invalidateCalcCache();
    buildHierarchy();
    const result = callback();
    state.data = previous.data;
    state.indexFamily = previous.indexFamily;
    state.sectorView = previous.sectorView;
    state.coreView = previous.coreView;
    state.boeView = previous.boeView;
    invalidateCalcCache();
    buildHierarchy();
    state.expanded = previous.expanded;
    return result;
  }

  function errorFor(year, monthNumber, horizon) {
    const monthKey = `${year}-${String(monthNumber).padStart(2, "0")}`;
    const index = findMonthIndex(Number(year), monthNumber);
    if (state.data.months[index] !== monthKey) return NaN;
    if (index < 0) return NaN;
    const actual = headlineChange(index, horizon);
    const calculated = calculatedTotal(0, index, horizon);
    if (!Number.isFinite(actual) || !Number.isFinite(calculated)) return NaN;
    return (calculated - actual) * 100;
  }

  function heatClass(value) {
    if (!Number.isFinite(value)) return "empty";
    const abs = Math.abs(value);
    if (abs < 0.5) return "neutral";
    if (abs < 2) return value > 0 ? "pos-low" : "neg-low";
    if (abs < 5) return value > 0 ? "pos-mid" : "neg-mid";
    return value > 0 ? "pos-high" : "neg-high";
  }

  function grid(indexFamily, horizon) {
    return withDataset(indexFamily, () => {
      const years = [...new Set(state.data.months.map((month) => month.slice(0, 4)))];
      const title = `${horizon === "mom" ? "MoM" : "YoY"} Error, bp`;

      return `
        <section class="error-grid-card compact">
          <h2>${title}</h2>
          <table class="error-grid">
            <thead>
              <tr>
                <th>Month</th>
                ${years.map((year) => `<th>${year}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${monthNames
                .map(
                  (monthName, monthIndex) => `
                    <tr>
                      <th>${monthName}</th>
                      ${years
                        .map((year) => {
                          const value = errorFor(year, monthIndex + 1, horizon);
                          return `<td class="${heatClass(value)}">${Number.isFinite(value) ? formatBp(value) : ""}</td>`;
                        })
                        .join("")}
                    </tr>
                  `,
                )
                .join("")}
            </tbody>
          </table>
        </section>
      `;
    });
  }

  function indexGrid(indexFamily) {
    if (!state.datasets[indexFamily]) return "";
    return `
      <section class="error-index-card">
        <h2>${indexFamily}</h2>
        <div class="error-index-grids">
          ${grid(indexFamily, "mom")}
          ${grid(indexFamily, "yoy")}
        </div>
      </section>
    `;
  }

  errorsHtmlCache = `
    ${indexGrid("CPI")}
    ${indexGrid("CPIH")}
    ${indexGrid("RPI")}
  `;
  els.errorRows.innerHTML = errorsHtmlCache;
}

function render() {
  renderSummary();
  renderMobileChrome();
  if (state.activeTab === "explorer") {
    renderExplorer();
  } else if (state.activeTab === "definitions") {
    renderDefinitions();
  } else if (state.activeTab === "chart") {
    renderChart();
  } else if (state.activeTab === "errors") {
    renderErrors();
  }
}

function setActiveButtons(selector, value, attr) {
  document.querySelectorAll(selector).forEach((button) => {
    button.classList.toggle("active", button.dataset[attr] === value);
  });
}

function checkRadio(selector) {
  const input = document.querySelector(selector);
  if (input) input.checked = true;
}

function syncIndexFamilyInput() {
  checkRadio(`[data-index-family="${state.indexFamily}"]`);
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  els.themeToggle.setAttribute("aria-pressed", String(state.theme === "dark"));
}

function updateIndexSpecificControls() {
  const isRpiSeries = isRpi();
  const labels = isRpiSeries
    ? {
        1: "Level 1 (Broad Groups)",
        2: "Level 2 (Groups)",
        3: "Level 3 (Sections)",
        4: "Level 4",
      }
    : {
        1: "Level 1 (Divisions)",
        2: "Level 2 (Groups)",
        3: "Level 3 (Classes)",
        4: "Level 4 (Sub Classes)",
      };

  Object.entries(labels).forEach(([level, label]) => {
    document.querySelectorAll(`[data-level-label="${level}"]`).forEach((node) => {
      node.textContent = label;
    });
  });

  document.querySelectorAll("[data-level-option='4']").forEach((node) => {
    node.hidden = isRpiSeries;
  });
  document.querySelectorAll("[data-boe-control]").forEach((node) => {
    node.hidden = isRpiSeries;
  });
  document.querySelectorAll("[data-sector-option='housing']").forEach((node) => {
    node.hidden = !isRpiSeries;
  });
}

function selectExplorerTable() {
  if (state.activeTab !== "explorer") return false;
  const selection = window.getSelection();
  if (!selection) return false;

  const range = document.createRange();
  range.selectNodeContents(els.itemTable);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

function isEditableTarget(target) {
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function clampControlsWidth(width) {
  return Math.max(controlsWidthMin, Math.min(controlsWidthMax, width));
}

function setControlsWidth(width, persist = false) {
  const clamped = clampControlsWidth(width);
  document.documentElement.style.setProperty("--controls-width", `${clamped}px`);
  if (persist) {
    try {
      localStorage.setItem(controlsWidthStorageKey, String(Math.round(clamped)));
    } catch {
      // Local storage may be unavailable in some embedded browser contexts.
    }
  }
}

function restoreControlsWidth() {
  try {
    const stored = Number(localStorage.getItem(controlsWidthStorageKey));
    if (Number.isFinite(stored)) setControlsWidth(stored);
  } catch {
    return;
  }
}

function bindPanelResizer() {
  if (!els.panelResizer) return;
  let startX = 0;
  let startWidth = 0;

  const onMove = (event) => {
    setControlsWidth(startWidth + event.clientX - startX);
  };

  const onUp = () => {
    document.body.classList.remove("resizing-controls");
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    const current = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--controls-width"));
    if (Number.isFinite(current)) setControlsWidth(current, true);
  };

  els.panelResizer.addEventListener("pointerdown", (event) => {
    startX = event.clientX;
    startWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--controls-width")) || controlsWidthMin;
    document.body.classList.add("resizing-controls");
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  });

  els.panelResizer.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const current = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--controls-width")) || controlsWidthMin;
    setControlsWidth(current + (event.key === "ArrowRight" ? 12 : -12), true);
  });
}

function bindEvents() {
  if (typeof mobileViewportQuery.addEventListener === "function") {
    mobileViewportQuery.addEventListener("change", syncResponsiveMode);
  } else {
    mobileViewportQuery.addListener(syncResponsiveMode);
  }

  document.querySelectorAll("[data-mobile-entry]").forEach((button) => {
    button.addEventListener("click", () => setMobileView(button.dataset.mobileEntry));
  });

  els.mobileFiltersOpen?.addEventListener("click", () => {
    document.body.classList.add("mobile-filters-open");
  });
  const closeMobileFilters = () => document.body.classList.remove("mobile-filters-open");
  els.mobileFiltersClose?.addEventListener("click", closeMobileFilters);
  els.mobileDrawerBackdrop?.addEventListener("click", closeMobileFilters);
  els.mobileDesktopView?.addEventListener("click", () => setMobileView("desktop"));
  els.mobileViewReturn?.addEventListener("click", () => setMobileView("explorer"));
  els.mobileMonthSelect?.addEventListener("change", () => {
    state.monthIndex = Number(els.mobileMonthSelect.value);
    state.sort = { type: "name", monthIndex: null };
    render();
  });
  els.mobileMonthPrevious?.addEventListener("click", () => {
    if (state.monthIndex <= 0) return;
    state.monthIndex -= 1;
    state.sort = { type: "name", monthIndex: null };
    render();
  });
  els.mobileMonthNext?.addEventListener("click", () => {
    if (state.monthIndex >= state.data.months.length - 1) return;
    state.monthIndex += 1;
    state.sort = { type: "name", monthIndex: null };
    render();
  });

  document.querySelectorAll("[data-horizon]").forEach((button) => {
    button.addEventListener("change", () => {
      state.horizon = button.dataset.horizon;
      render();
    });
  });

  document.querySelectorAll("[data-index-family]").forEach((button) => {
    button.addEventListener("change", () => {
      if (!button.checked || !state.datasets[button.dataset.indexFamily]) return;
      setIndexFamily(button.dataset.indexFamily);
      render();
    });
  });

  document.querySelectorAll("[data-measure]").forEach((button) => {
    button.addEventListener("change", () => {
      state.measure = button.dataset.measure;
      render();
    });
  });

  document.querySelectorAll("[data-sector-view]").forEach((button) => {
    button.addEventListener("change", () => {
      state.sectorView = button.dataset.sectorView;
      state.sort = { type: "name", monthIndex: null };
      state.selectedRowId = null;
      render();
    });
  });

  document.querySelectorAll("[data-core-view]").forEach((button) => {
    button.addEventListener("change", () => {
      state.coreView = button.dataset.coreView;
      state.sort = { type: "name", monthIndex: null };
      state.selectedRowId = null;
      render();
    });
  });

  document.querySelectorAll("[data-boe-view]").forEach((button) => {
    button.addEventListener("change", () => {
      state.boeView = button.dataset.boeView;
      if (state.boeView !== "all") {
        state.sectorView = "all";
        state.coreView = "all";
        checkRadio('[data-sector-view="all"]');
        checkRadio('[data-core-view="all"]');
      }
      state.sort = { type: "name", monthIndex: null };
      state.selectedRowId = null;
      render();
    });
  });

  document.querySelectorAll("[data-time-range]").forEach((button) => {
    const updateRange = () => {
      state.timeRange = button.dataset.timeRange;
      render();
    };
    button.addEventListener("change", updateRange);
    button.addEventListener("click", updateRange);
  });

  document.querySelectorAll("[data-level-view]").forEach((button) => {
    button.addEventListener("change", () => {
      state.levelView = button.dataset.levelView;
      render();
    });
  });

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.tab === "chart" && !state.chart) return;
      setActiveTab(button.dataset.tab);
    });
  });

  els.itemHead.addEventListener("contextmenu", (event) => {
    const nameHeader = event.target.closest("[data-sort-name]");
    const monthHeader = event.target.closest("[data-sort-month]");
    if (!nameHeader && !monthHeader) return;

    event.preventDefault();
    if (nameHeader) {
      state.sort = { type: "name", monthIndex: null };
    } else {
      state.sort = { type: "month", monthIndex: Number(monthHeader.dataset.sortMonth) };
    }
    renderExplorer();
  });

  els.itemHead.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tree-action]");
    if (!button || state.levelView !== "all") return;
    event.stopPropagation();
    if (button.dataset.treeAction === "expand") {
      state.expanded = new Set(expandableItemIds());
    } else {
      state.expanded = new Set([getAllItems().id]);
    }
    renderExplorer();
  });

  els.itemRows.addEventListener("click", (event) => {
    const button = event.target.closest("[data-toggle]");
    if (button) {
      const id = Number(button.dataset.toggle);
      if (state.expanded.has(id)) state.expanded.delete(id);
      else state.expanded.add(id);
      renderExplorer();
      return;
    }
    const row = event.target.closest("[data-row-id]");
    if (!row) return;
    const id = Number(row.dataset.rowId);
    state.selectedRowId = state.selectedRowId === id ? null : id;
    renderExplorer();
  });

  els.itemRows.addEventListener("contextmenu", (event) => {
    const row = event.target.closest("[data-chart-row]");
    if (!row) return;
    event.preventDefault();
    const id = Number(row.dataset.rowId);
    const item = state.data.items[id];
    if (!item) return;
    showChartContextMenu(event, item);
  });

  els.chartContextMenu?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-chart-mode]");
    if (!button) return;
    const item = state.data.items[state.contextRowId];
    hideChartContextMenu();
    if (item) openChart(item, button.dataset.chartMode);
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#chartContextMenu")) hideChartContextMenu();
  });

  window.addEventListener("resize", () => {
    if (state.activeTab === "chart") renderChart();
  });

  els.chartClose?.addEventListener("click", () => {
    state.chart = null;
    if (els.chartTab) els.chartTab.hidden = true;
    setActiveTab("explorer");
  });

  els.chartSvg?.addEventListener("pointermove", (event) => {
    const point = event.target.closest(".chart-point");
    if (!point) {
      hideChartTooltip();
      return;
    }
    showChartTooltip(event, point);
  });

  els.chartSvg?.addEventListener("pointerleave", hideChartTooltip);

  els.themeToggle.addEventListener("click", () => {
    state.theme = state.theme === "light" ? "dark" : "light";
    applyTheme();
  });

  window.addEventListener("copy", (event) => {
    if (!state.data) return;
    event.clipboardData.setData("text/plain", visibleTableTsv());
    event.clipboardData.setData("text/html", visibleTableHtml());
    event.preventDefault();
  }, true);

  window.addEventListener("keydown", (event) => {
    const isSelectAll = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a";
    if (!isSelectAll || isEditableTarget(event.target)) return;
    if (!selectExplorerTable()) return;
    event.preventDefault();
  });

  bindPanelResizer();
}

async function loadData() {
  try {
    const appScript = document.querySelector('script[src*="app.js"]');
    const appBase = appScript ? new URL(".", appScript.src) : new URL(".", window.location.href);
    const dataUrl = new URL(`data/inflation.json?v=${Date.now()}`, appBase);
    const response = await fetch(dataUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Data request failed: ${response.status}`);
    return response.json();
  } catch (error) {
    if (window.INFLATION_DATA) return window.INFLATION_DATA;
    if (window.CPIH_DATA) return window.CPIH_DATA;
    throw error;
  }
}

function normalizePayload(payload) {
  if (payload?.series?.CPIH || payload?.series?.CPI) return payload.series;
  return { CPIH: payload };
}

async function init() {
  try {
    applyTheme();
    syncResponsiveMode();
    restoreControlsWidth();
    state.datasets = normalizePayload(await loadData());
    const indexParam = new URLSearchParams(window.location.search).get("index")?.toUpperCase();
    state.indexFamily = indexParam && state.datasets[indexParam] ? indexParam : "CPI";
    setIndexFamily(state.indexFamily);
    const rangeParam = new URLSearchParams(window.location.search).get("range");
    if (["1", "2", "5", "10", "all"].includes(rangeParam)) {
      state.timeRange = rangeParam;
      const rangeInput = document.querySelector(`[data-time-range="${rangeParam}"]`);
      if (rangeInput) rangeInput.checked = true;
    }
    bindEvents();
    render();
  } catch (error) {
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<div class="load-error">Data load failed: ${error.message}</div>`,
    );
  }
}

init();
