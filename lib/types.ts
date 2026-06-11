export type RunType = "easy" | "long" | "tempo" | "intervals" | "race";

export interface Run {
  id: string;
  date: string; // ISO yyyy-mm-dd
  distanceKm: number;
  durationSec: number;
  type: RunType;
  note?: string;
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
