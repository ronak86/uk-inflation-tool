import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

import bundledPayload from "@/assets/data/inflation.json";
import { InflationPayload } from "@/src/types";

const DATA_URL = "https://chitroda.com/web/data/inflation.json";
const CACHE_KEY = "uk-inflation:dataset:v1";

function isPayload(value: unknown): value is InflationPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<InflationPayload>;
  return Boolean(candidate.series?.CPI?.months?.length && candidate.series.CPI.items?.length);
}

export function useInflationData() {
  const [data, setData] = useState<InflationPayload>(bundledPayload as InflationPayload);
  const [refreshing, setRefreshing] = useState(false);
  const [source, setSource] = useState<"bundled" | "cached" | "live">("bundled");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const response = await fetch(`${DATA_URL}?t=${Date.now()}`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`Data request failed (${response.status})`);
      const payload: unknown = await response.json();
      if (!isPayload(payload)) throw new Error("The downloaded dataset is not valid");
      setData(payload);
      setSource("live");
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to refresh data");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function initialise() {
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached && mounted) {
          const payload: unknown = JSON.parse(cached);
          if (isPayload(payload)) {
            setData(payload);
            setSource("cached");
          }
        }
      } catch {
        // The bundled dataset remains a complete offline fallback.
      }
      if (mounted) await refresh();
    }
    initialise();
    return () => {
      mounted = false;
    };
  }, [refresh]);

  return { data, error, refresh, refreshing, source };
}
