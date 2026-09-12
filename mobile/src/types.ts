export type IndexFamily = "CPI" | "CPIH" | "RPI";
export type Horizon = "mom" | "yoy";
export type Measure = "contribution" | "price" | "weight";
export type SectorView = "all" | "services" | "goods" | "housing";
export type CoreView = "all" | "core" | "noncore";
export type BoeView = "all" | "boe" | "exboe";
export type ImportIntensityView = "all" | "0-10" | "10-25" | "25-40" | "40-plus" | "energy" | "ooh" | "unclassified";
export type EnergyIntensityView = "all" | "very-low" | "low" | "high" | "very-high" | "energy" | "rents" | "unclassified";

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
  intensity?: {
    import: { direct: number | null; total: number | null; group: string } | null;
    energy: { rate: number | null; group: string } | null;
  };
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
  classifications?: {
    importIntensity: "official" | null;
    energyIntensity: "official" | "cpi-derived" | null;
  };
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
  importIntensity: ImportIntensityView;
  energyIntensity: EnergyIntensityView;
}

export interface ExplorerRow {
  item: InflationItem;
  value: number;
  hasChildren: boolean;
}
