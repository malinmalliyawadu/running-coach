export type RunType = "easy" | "long" | "tempo" | "intervals" | "race";

export interface Run {
  id: string;
  date: string; // ISO yyyy-mm-dd
  distanceKm: number; // whole session, door to door
  durationSec: number; // whole session, door to door
  type: RunType;
  /**
   * The hard part of a quality session — the tempo block, or the reps only —
   * with warm-up, cool-down and recovery jogs left out. Optional: when it is
   * missing the model infers it from a typical session shape, but logging it
   * makes the run a much stronger fitness signal.
   */
  qualityKm?: number;
  qualityDurationSec?: number;
  note?: string;
}

/** Types whose logged total mixes hard running with jogging. */
export function isQualityType(type: RunType): boolean {
  return type === "tempo" || type === "intervals";
}

/** The logged hard portion of a run, or null when it wasn't recorded. */
export function loggedQualitySegment(run: Run): { km: number; durationSec: number } | null {
  const { qualityKm: km, qualityDurationSec: sec } = run;
  if (!km || !sec || km <= 0 || sec <= 0) return null;
  if (km > run.distanceKm || sec > run.durationSec) return null;
  return { km, durationSec: sec };
}

export interface Settings {
  raceDate: string; // ISO yyyy-mm-dd
  goalTimeSec: number | null;
}

export const MARATHON_KM = 42.195;

export const DEFAULT_SETTINGS: Settings = {
  // Queenstown Marathon 2026 (editable in the header)
  raceDate: "2026-11-14",
  goalTimeSec: null,
};

export const RUN_TYPE_LABELS: Record<RunType, string> = {
  easy: "Easy",
  long: "Long run",
  tempo: "Tempo",
  intervals: "Intervals",
  race: "Race / Time trial",
};
