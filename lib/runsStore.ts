import { Run, Settings, DEFAULT_SETTINGS } from "@/lib/types";
import { generateSampleRuns } from "@/lib/sample";

const RUNS_KEY = "qt-marathon-runs-v1";
const SETTINGS_KEY = "qt-marathon-settings-v1";

export interface StoreSnapshot {
  runs: Run[];
  settings: Settings;
  hydrated: boolean;
}

// The snapshot used during SSR and the first client render. Keeping it a stable
// singleton (and matching it on the client until hydration) keeps server-rendered
// HTML and the first client render identical, so there is no hydration mismatch.
const SERVER_SNAPSHOT: StoreSnapshot = {
  runs: [],
  settings: DEFAULT_SETTINGS,
  hydrated: false,
};

let snapshot: StoreSnapshot = SERVER_SNAPSHOT;
let initialized = false;
const listeners = new Set<() => void>();

function readFromStorage(): StoreSnapshot {
  let runs: Run[] = [];
  let settings: Settings = DEFAULT_SETTINGS;
  try {
    const storedRuns = localStorage.getItem(RUNS_KEY);
    if (storedRuns) runs = JSON.parse(storedRuns);
    const storedSettings = localStorage.getItem(SETTINGS_KEY);
    if (storedSettings) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings) };
  } catch {
    // corrupt storage — start fresh
  }
  return { runs, settings, hydrated: true };
}

// Lazily hydrate from localStorage on the client the first time the store is
// read or subscribed to. Idempotent, so it is safe to call from getSnapshot
// (which React may invoke on every render).
function ensureInitialized() {
  if (initialized) return;
  initialized = true;
  snapshot = readFromStorage();
}

function commit(next: StoreSnapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function persistRuns(runs: Run[]) {
  localStorage.setItem(RUNS_KEY, JSON.stringify(runs));
  commit({ ...snapshot, runs });
}

export function subscribe(listener: () => void): () => void {
  ensureInitialized();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): StoreSnapshot {
  ensureInitialized();
  return snapshot;
}

export function getServerSnapshot(): StoreSnapshot {
  return SERVER_SNAPSHOT;
}

export function addRun(run: Omit<Run, "id">) {
  const withId: Run = { ...run, id: crypto.randomUUID() };
  persistRuns(
    [...snapshot.runs.filter((r) => !r.id.startsWith("sample-")), withId].sort((a, b) =>
      a.date < b.date ? -1 : 1
    )
  );
}

/**
 * Replaces a run wholesale, so clearing a quality split or a rep set on an
 * edit actually drops it. Re-sorts because the date may have moved.
 */
export function updateRun(id: string, run: Omit<Run, "id">) {
  persistRuns(
    snapshot.runs
      .map((r) => (r.id === id ? { ...run, id } : r))
      .sort((a, b) => (a.date < b.date ? -1 : 1))
  );
}

export function deleteRun(id: string) {
  persistRuns(snapshot.runs.filter((r) => r.id !== id));
}

export function updateSettings(patch: Partial<Settings>) {
  const settings = { ...snapshot.settings, ...patch };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  commit({ ...snapshot, settings });
}

export function loadSample() {
  persistRuns(generateSampleRuns());
}

export function clearAll() {
  persistRuns([]);
}
