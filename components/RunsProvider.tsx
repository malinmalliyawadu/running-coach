"use client";

import { createContext, useContext, ReactNode, useSyncExternalStore } from "react";
import { Run, Settings } from "@/lib/types";
import * as store from "@/lib/runsStore";

interface Store {
  runs: Run[];
  settings: Settings;
  hydrated: boolean;
  addRun: (run: Omit<Run, "id">) => void;
  deleteRun: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  loadSample: () => void;
  clearAll: () => void;
}

const StoreContext = createContext<Store | null>(null);

export function RunsProvider({ children }: { children: ReactNode }) {
  const { runs, settings, hydrated } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );

  return (
    <StoreContext.Provider
      value={{
        runs,
        settings,
        hydrated,
        addRun: store.addRun,
        deleteRun: store.deleteRun,
        updateSettings: store.updateSettings,
        loadSample: store.loadSample,
        clearAll: store.clearAll,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within RunsProvider");
  return ctx;
}
