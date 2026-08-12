"use client";

import { createContext, useContext, ReactNode, useState, useSyncExternalStore } from "react";
import { Run, Settings } from "@/lib/types";
import * as store from "@/lib/runsStore";

interface Store {
  runs: Run[];
  settings: Settings;
  hydrated: boolean;
  addRun: (run: Omit<Run, "id">) => void;
  updateRun: (id: string, run: Omit<Run, "id">) => void;
  deleteRun: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  loadSample: () => void;
  clearAll: () => void;
  /** The run the form is currently editing, if any. */
  editingRunId: string | null;
  setEditingRunId: (id: string | null) => void;
}

const StoreContext = createContext<Store | null>(null);

export function RunsProvider({ children }: { children: ReactNode }) {
  const { runs, settings, hydrated } = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );
  const [editingRunId, setEditingRunId] = useState<string | null>(null);

  return (
    <StoreContext.Provider
      value={{
        runs,
        settings,
        hydrated,
        addRun: store.addRun,
        updateRun: store.updateRun,
        deleteRun: store.deleteRun,
        updateSettings: store.updateSettings,
        loadSample: store.loadSample,
        clearAll: store.clearAll,
        editingRunId,
        setEditingRunId,
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
