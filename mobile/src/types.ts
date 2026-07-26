export type IndexFamily = "CPI" | "CPIH" | "RPI";
export type Horizon = "mom" | "yoy";
export type Measure = "contribution" | "price" | "weight";
export type SectorView = "all" | "services" | "goods" | "housing";
export type CoreView = "all" | "core" | "noncore";
export type BoeView = "all" | "boe" | "exboe";

export interface SectorFlags {
  boe: boolean;
  exBoe: boolean;
  services: boolean;
  nonCore: boolean;
  housing: boolean;
}

export interface InflationItem {
  name: string;
  level: number;
  weightCode: string;
  priceCode: string;
  weights: Array<number | null>;
  prices: Array<number | null>;
  sectors: SectorFlags;
  id?: number;
  parentId?: number | null;
  children?: number[];
}

export interface OverallSeries {
  priceCode: string;
  months: string[];
  prices: Array<number | null>;
}

export interface InflationSeries {
  series: IndexFamily;
  sourceWorkbook: string;
  months: string[];
  items: InflationItem[];
  overall3dp?: OverallSeries;
}

export interface InflationPayload {
  sourceWorkbook: string;
  series: Record<IndexFamily, InflationSeries>;
}

export interface FilterState {
  sector: SectorView;
  core: CoreView;
  boe: BoeView;
}

export interface ExplorerRow {
  item: InflationItem;
  value: number;
  hasChildren: boolean;
}
