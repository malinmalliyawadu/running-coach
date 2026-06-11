"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { Run, Settings, DEFAULT_SETTINGS } from "@/lib/types";
import { generateSampleRuns } from "@/lib/sample";

const RUNS_KEY = "qt-marathon-runs-v1";
const SETTINGS_KEY = "qt-marathon-settings-v1";

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
  const [runs, setRuns] = useState<Run[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const storedRuns = localStorage.getItem(RUNS_KEY);
      if (storedRuns) setRuns(JSON.parse(storedRuns));
      const storedSettings = localStorage.getItem(SETTINGS_KEY);
      if (storedSettings) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings) });
    } catch {
      // corrupt storage — start fresh
    }
    setHydrated(true);
  }, []);

  const persistRuns = useCallback((next: Run[]) => {
    setRuns(next);
    localStorage.setItem(RUNS_KEY, JSON.stringify(next));
  }, []);

  const addRun = useCallback(
    (run: Omit<Run, "id">) => {
      const withId: Run = { ...run, id: crypto.randomUUID() };
      persistRuns([...runs.filter((r) => !r.id.startsWith("sample-")), withId].sort((a, b) => (a.date < b.date ? -1 : 1)));
    },
    [runs, persistRuns]
  );

  const deleteRun = useCallback(
    (id: string) => persistRuns(runs.filter((r) => r.id !== id)),
    [runs, persistRuns]
  );

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const loadSample = useCallback(() => persistRuns(generateSampleRuns()), [persistRuns]);
  const clearAll = useCallback(() => persistRuns([]), [persistRuns]);

  return (
    <StoreContext.Provider value={{ runs, settings, hydrated, addRun, deleteRun, updateSettings, loadSample, clearAll }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within RunsProvider");
  return ctx;
}
