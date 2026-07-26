import { SymbolView } from "expo-symbols";
import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { RadioGroup } from "@/src/components/RadioGroup";
import { SegmentedControl } from "@/src/components/SegmentedControl";
import { useAppData } from "@/src/context/AppDataContext";
import { InflationEngine, prepareSeries } from "@/src/engine/InflationEngine";
import { colorsFor } from "@/src/theme";
import {
  BoeView,
  CoreView,
  FilterState,
  Horizon,
  IndexFamily,
  InflationItem,
  Measure,
  SectorView,
} from "@/src/types";

const monthFormatter = new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

function monthLabel(month: string) {
  return monthFormatter.format(new Date(`${month}-01T00:00:00Z`));
}

function measureLabel(measure: Measure) {
  if (measure === "contribution") return "Contribution, bp";
  if (measure === "price") return "Price change, %";
  return "Weight, %";
}

function levelOptions(family: IndexFamily) {
  const names = family === "RPI"
    ? ["Broad Groups", "Groups", "Sections"]
    : ["Divisions", "Groups", "Classes", "Sub Classes"];
  return [
    { label: "All levels", value: "all" },
    ...names.map((name, index) => ({ label: `Level ${index + 1} (${name})`, value: String(index + 1) })),
  ];
}

function visibleTreeItems(engine: InflationEngine, expanded: Set<number>) {
  return engine.data.items.filter((item) => {
    if (engine.isFiltered && item.level > 0 && engine.activeLeavesFor(item).length === 0) return false;
    if (item.level === 0) return true;
    let parentId = item.parentId;
    while (parentId !== null && parentId !== undefined) {
      if (!expanded.has(parentId)) return false;
      parentId = engine.data.items[parentId].parentId;
    }
    return true;
  });
}

export default function ExplorerScreen() {
  const colors = colorsFor(useColorScheme());
  const { data, error, refresh, refreshing, source } = useAppData();
  const [family, setFamily] = useState<IndexFamily>("CPI");
  const [horizon, setHorizon] = useState<Horizon>("mom");
  const [measure, setMeasure] = useState<Measure>("contribution");
  const [filters, setFilters] = useState<FilterState>({ sector: "all", core: "all", boe: "all" });
  const [monthOffsets, setMonthOffsets] = useState<Record<IndexFamily, number>>({ CPI: 0, CPIH: 0, RPI: 0 });
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));
  const [level, setLevel] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sortDirection, setSortDirection] = useState<"none" | "asc" | "desc">("none");

  const series = useMemo(() => prepareSeries(data.series[family]), [data, family]);
  const engine = useMemo(() => new InflationEngine(series, filters), [series, filters]);
  const monthIndex = Math.max(0, series.months.length - 1 - monthOffsets[family]);

  const rows = useMemo(() => {
    const search = query.trim().toLowerCase();
    const makeRow = (item: InflationItem) => ({
      item,
      value: engine.value(item, monthIndex, horizon, measure),
      hasChildren: Boolean(item.children?.length),
    });
    const compareRows = (left: ReturnType<typeof makeRow>, right: ReturnType<typeof makeRow>) => {
      const leftFinite = Number.isFinite(left.value);
      const rightFinite = Number.isFinite(right.value);
      if (!leftFinite && !rightFinite) return 0;
      if (!leftFinite) return 1;
      if (!rightFinite) return -1;
      return sortDirection === "asc" ? left.value - right.value : right.value - left.value;
    };
    const sortRows = (items: InflationItem[]) => {
      const output = items.map(makeRow);
      return sortDirection === "none" ? output : output.sort(compareRows);
    };

    if (search) {
      return sortRows(engine.data.items.filter((item) => engine.displayName(item).toLowerCase().includes(search)));
    }

    if (level !== "all") {
      return [makeRow(engine.allItems()), ...sortRows(engine.visibleAtLevel(Number(level)))];
    }

    if (sortDirection === "none") {
      return visibleTreeItems(engine, expanded).map(makeRow);
    }

    const output: ReturnType<typeof makeRow>[] = [];
    const visit = (item: InflationItem) => {
      if (engine.isFiltered && item.level > 0 && engine.activeLeavesFor(item).length === 0) return;
      output.push(makeRow(item));
      if (!expanded.has(item.id!)) return;
      const children = (item.children ?? []).map((id) => engine.data.items[id]);
      for (const child of sortRows(children)) visit(child.item);
    };
    visit(engine.allItems());
    return output;
  }, [engine, expanded, horizon, level, measure, monthIndex, query, sortDirection]);

  const updateFamily = (next: IndexFamily) => {
    setFamily(next);
    setExpanded(new Set([0]));
    setLevel("all");
    if (next === "RPI") setFilters((current) => ({ ...current, boe: "all" }));
    if (next !== "RPI" && filters.sector === "housing") setFilters((current) => ({ ...current, sector: "all" }));
  };

  const moveMonth = (amount: number) => {
    setMonthOffsets((current) => ({
      ...current,
      [family]: Math.min(series.months.length - 1, Math.max(0, current[family] + amount)),
    }));
  };

  const toggleExpanded = (item: InflationItem) => {
    if (!item.children?.length || level !== "all") return;
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(item.id!)) next.delete(item.id!);
      else next.add(item.id!);
      return next;
    });
  };

  const setSector = (sector: SectorView) => setFilters((current) => ({ ...current, sector }));
  const setCore = (core: CoreView) => setFilters((current) => ({ ...current, core }));
  const setBoe = (boe: BoeView) => setFilters((current) => ({ ...current, boe }));

  return (
    <SafeAreaView edges={["top"]} style={[styles.safe, { backgroundColor: colors.canvas }]}>
      <View style={[styles.header, { backgroundColor: colors.panel, borderBottomColor: colors.line }]}>
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.title, { color: colors.ink }]}>UK Inflation</Text>
            <Text style={[styles.source, { color: error ? colors.red : colors.muted }]}>
              {error ? "Offline data" : source === "live" ? "Latest ONS data" : "Checking for updates"}
            </Text>
          </View>
          <Pressable accessibilityLabel="Open filters" onPress={() => setFilterOpen(true)} style={[styles.filterButton, { borderColor: colors.line }]}>
            <SymbolView name="line.3.horizontal.decrease" tintColor={colors.blue} size={20} />
            <Text style={[styles.filterText, { color: colors.blue }]}>Filters</Text>
          </Pressable>
        </View>

        <SegmentedControl colors={colors} value={family} onChange={updateFamily} options={[
          { label: "CPI", value: "CPI" },
          { label: "CPIH", value: "CPIH" },
          { label: "RPI", value: "RPI" },
        ]} />
        <View style={styles.controlRow}>
          <View style={styles.controlHalf}>
            <SegmentedControl compact colors={colors} value={horizon} onChange={setHorizon} options={[
              { label: "MoM", value: "mom" },
              { label: "YoY", value: "yoy" },
            ]} />
          </View>
          <View style={styles.controlMeasure}>
            <SegmentedControl compact colors={colors} value={measure} onChange={setMeasure} options={[
              { label: "Ctrb", value: "contribution" },
              { label: "Price", value: "price" },
              { label: "Weight", value: "weight" },
            ]} />
          </View>
        </View>

        <View style={styles.monthRow}>
          <Pressable accessibilityLabel="Older month" disabled={monthIndex === 0} onPress={() => moveMonth(1)} style={styles.monthArrow}>
            <SymbolView name="chevron.left" tintColor={monthIndex === 0 ? colors.line : colors.ink} size={18} />
          </Pressable>
          <View style={styles.monthTitle}>
            <Text selectable style={[styles.monthText, { color: colors.ink }]}>{monthLabel(series.months[monthIndex])}</Text>
            <Text style={[styles.measureText, { color: colors.muted }]}>{measureLabel(measure)}</Text>
          </View>
          <Pressable accessibilityLabel="Newer month" disabled={monthOffsets[family] === 0} onPress={() => moveMonth(-1)} style={styles.monthArrow}>
            <SymbolView name="chevron.right" tintColor={monthOffsets[family] === 0 ? colors.line : colors.ink} size={18} />
          </Pressable>
        </View>
        <TextInput
          accessibilityLabel="Search basket"
          autoCorrect={false}
          clearButtonMode="while-editing"
          onChangeText={setQuery}
          placeholder="Search the basket"
          placeholderTextColor={colors.muted}
          selectTextOnFocus={false}
          selectionColor={colors.blue}
          style={[styles.search, { backgroundColor: colors.panelMuted, borderColor: colors.line, color: colors.ink }]}
          value={query}
        />
      </View>

      <View style={[styles.columnHeader, { backgroundColor: colors.blue }]}>
        <Pressable
          accessibilityLabel="Reset to name order"
          onPress={() => setSortDirection("none")}
          style={styles.columnNameButton}
        >
          <Text style={styles.columnName}>Name</Text>
          <SymbolView name="arrow.up" tintColor={sortDirection === "none" ? colors.amber : "#FFFFFF"} size={12} />
        </Pressable>
        <Pressable
          accessibilityLabel={`Sort values ${sortDirection === "desc" ? "ascending" : "descending"}`}
          onPress={() => setSortDirection((current) => current === "desc" ? "asc" : "desc")}
          style={styles.columnValueButton}
        >
          <Text style={styles.columnValueLabel}>{measure === "contribution" ? "bp" : "%"}</Text>
          <SymbolView
            name={sortDirection === "asc" ? "arrow.up" : sortDirection === "desc" ? "arrow.down" : "arrow.up.arrow.down"}
            tintColor="#FFFFFF"
            size={12}
          />
        </Pressable>
      </View>
      <FlatList
        data={rows}
        keyExtractor={({ item }) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.blue} />}
        renderItem={({ item: row, index }) => {
          const headline = row.item.level === 0;
          const expandable = row.hasChildren && level === "all" && !query;
          const open = expanded.has(row.item.id!);
          const positive = Number.isFinite(row.value) && row.value > 0.0000001;
          const negative = Number.isFinite(row.value) && row.value < -0.0000001;
          return (
            <Pressable
              onPress={() => toggleExpanded(row.item)}
              style={({ pressed }) => [
                styles.dataRow,
                {
                  backgroundColor: headline
                    ? colors.blue
                    : index % 2 === 0 ? colors.panel : colors.blueLight,
                  borderBottomColor: colors.line,
                  paddingLeft: 10 + Math.min(row.item.level, 4) * 12,
                },
                pressed && expandable && { opacity: 0.68 },
              ]}
            >
              <View style={styles.rowNameWrap}>
                <View style={styles.disclosureSlot}>
                  {expandable ? (
                    <SymbolView name={open ? "minus.circle.fill" : "plus.circle.fill"} tintColor={headline ? "#FFFFFF" : colors.blue} size={17} />
                  ) : null}
                </View>
                <Text selectable numberOfLines={2} style={[styles.rowName, { color: headline ? "#FFFFFF" : colors.ink }, headline && styles.headlineText]}>
                  {engine.displayName(row.item)}
                </Text>
                <Text selectable style={[styles.level, { color: headline ? "#FFFFFF" : colors.muted }]}>L{row.item.level}</Text>
              </View>
              <Text selectable style={[
                styles.rowValue,
                { color: headline ? "#FFFFFF" : positive ? colors.green : negative ? colors.red : colors.ink },
                headline && styles.headlineText,
              ]}>
                {engine.format(row.value, measure)}
              </Text>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={[styles.empty, { color: colors.muted }]}>No basket items match this search.</Text>}
      />

      <Modal animationType="slide" onRequestClose={() => setFilterOpen(false)} presentationStyle="pageSheet" visible={filterOpen}>
        <SafeAreaView style={[styles.modal, { backgroundColor: colors.canvas }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.line }]}>
            <Text style={[styles.modalTitle, { color: colors.ink }]}>Filters</Text>
            <Pressable onPress={() => setFilterOpen(false)}><Text style={[styles.done, { color: colors.blue }]}>Done</Text></Pressable>
          </View>
          <FlatList
            data={["filters"]}
            keyExtractor={(item) => item}
            renderItem={() => (
              <View style={styles.filterContent}>
                <FilterSection title="Sector" colors={colors}>
                  <RadioGroup colors={colors} value={filters.sector} onChange={setSector} options={family === "RPI" ? [
                    { label: "All", value: "all" }, { label: "Services", value: "services" }, { label: "Goods", value: "goods" }, { label: "Housing", value: "housing" },
                  ] : [
                    { label: "All", value: "all" }, { label: "Services", value: "services" }, { label: "Goods", value: "goods" },
                  ]} />
                </FilterSection>
                <FilterSection title="Core" colors={colors}>
                  <RadioGroup colors={colors} value={filters.core} onChange={setCore} options={[
                    { label: "All", value: "all" }, { label: "Core", value: "core" }, { label: "Non Core", value: "noncore" },
                  ]} />
                </FilterSection>
                {family !== "RPI" ? (
                  <FilterSection title="BoE Services" colors={colors}>
                    <RadioGroup colors={colors} value={filters.boe} onChange={setBoe} options={[
                      { label: "All", value: "all" }, { label: "BoE Services", value: "boe" }, { label: "All excluding BoE Services", value: "exboe" },
                    ]} />
                  </FilterSection>
                ) : null}
                <FilterSection title="Basket level" colors={colors}>
                  <RadioGroup colors={colors} value={level} onChange={setLevel} options={levelOptions(family)} />
                </FilterSection>
                <Pressable
                  onPress={() => { setFilters({ sector: "all", core: "all", boe: "all" }); setLevel("all"); }}
                  style={[styles.resetButton, { borderColor: colors.line }]}
                >
                  <Text style={[styles.resetText, { color: colors.blue }]}>Reset all filters</Text>
                </Pressable>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function FilterSection({ title, colors, children }: { title: string; colors: ReturnType<typeof colorsFor>; children: React.ReactNode }) {
  return (
    <View style={[styles.filterSection, { backgroundColor: colors.panel, borderColor: colors.line }]}>
      <Text style={[styles.filterHeading, { color: colors.muted }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { borderBottomWidth: StyleSheet.hairlineWidth, gap: 9, padding: 12 },
  titleRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: 0 },
  source: { fontSize: 12, marginTop: 1 },
  filterButton: { alignItems: "center", borderRadius: 7, borderWidth: 1, flexDirection: "row", gap: 5, minHeight: 36, paddingHorizontal: 10 },
  filterText: { fontSize: 13, fontWeight: "800" },
  controlRow: { flexDirection: "row", gap: 8 },
  controlHalf: { flex: 0.72 },
  controlMeasure: { flex: 1.28 },
  monthRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  monthArrow: { alignItems: "center", height: 40, justifyContent: "center", width: 44 },
  monthTitle: { alignItems: "center" },
  monthText: { fontSize: 17, fontWeight: "800" },
  measureText: { fontSize: 11, marginTop: 1 },
  search: { borderRadius: 7, borderWidth: 1, fontSize: 14, height: 38, paddingHorizontal: 11 },
  columnHeader: { alignItems: "center", flexDirection: "row", minHeight: 28, paddingHorizontal: 10 },
  columnNameButton: { alignItems: "center", flex: 1, flexDirection: "row", gap: 4, minHeight: 28 },
  columnName: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  columnValueButton: { alignItems: "center", flexDirection: "row", gap: 4, justifyContent: "flex-end", minHeight: 28, width: 72 },
  columnValueLabel: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  dataRow: { alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", minHeight: 43, paddingRight: 10, paddingVertical: 5 },
  rowNameWrap: { alignItems: "center", flex: 1, flexDirection: "row", minWidth: 0 },
  disclosureSlot: { alignItems: "center", justifyContent: "center", width: 23 },
  rowName: { flex: 1, fontSize: 13, lineHeight: 16 },
  level: { fontSize: 10, fontWeight: "700", marginLeft: 5 },
  rowValue: { fontSize: 13, fontVariant: ["tabular-nums"], fontWeight: "700", textAlign: "right", width: 72 },
  headlineText: { fontWeight: "800" },
  empty: { padding: 24, textAlign: "center" },
  modal: { flex: 1 },
  modalHeader: { alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "space-between", padding: 16 },
  modalTitle: { fontSize: 20, fontWeight: "800" },
  done: { fontSize: 16, fontWeight: "800" },
  filterContent: { gap: 10, padding: 14, paddingBottom: 40 },
  filterSection: { borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  filterHeading: { fontSize: 11, fontWeight: "800", marginBottom: 5 },
  resetButton: { alignItems: "center", borderRadius: 8, borderWidth: 1, marginTop: 4, padding: 13 },
  resetText: { fontSize: 14, fontWeight: "800" },
});
