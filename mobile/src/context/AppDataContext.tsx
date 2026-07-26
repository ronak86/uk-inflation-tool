import { createContext, PropsWithChildren, useContext } from "react";

import { useInflationData } from "@/src/data/useInflationData";

type AppDataContextValue = ReturnType<typeof useInflationData>;

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: PropsWithChildren) {
  const value = useInflationData();
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const value = useContext(AppDataContext);
  if (!value) throw new Error("useAppData must be used within AppDataProvider");
  return value;
}
