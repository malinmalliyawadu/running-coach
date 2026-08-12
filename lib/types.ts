export type RunType = "easy" | "long" | "tempo" | "intervals" | "race";

/** One work interval of a rep session. Recovery jogs are not reps. */
export interface Rep {
  km: number;
  durationSec: number;
}

export interface Run {
  id: string;
  date: string; // ISO yyyy-mm-dd
  distanceKm: number; // whole session, door to door
  durationSec: number; // whole session, door to door
  type: RunType;
  /** The work intervals of a rep session, logged one by one. */
  reps?: Rep[];
  /**
   * The hard part of a quality session — the tempo block, or the reps only —
   * with warm-up, cool-down and recovery jogs left out. Optional: when it is
   * missing the model infers it from a typical session shape, but logging it
   * makes the run a much stronger fitness signal. Rep sessions carry `reps`
   * instead and get totalled up here by `loggedQualitySegment`.
   */
  qualityKm?: number;
  qualityDurationSec?: number;
  note?: string;
}

/** Types whose logged total mixes hard running with jogging. */
export function isQualityType(type: RunType): boolean {
  return type === "tempo" || type === "intervals";
}

/** The reps of a session, ignoring any that were logged incompletely. */
export function validReps(run: Run): Rep[] {
  return (run.reps ?? []).filter((r) => r.km > 0 && r.durationSec > 0);
}

/**
 * The logged hard portion of a run, or null when it wasn't recorded. Rep
 * sessions are logged interval by interval and summed here, so the runner
 * never has to add them up themselves.
 */
export function loggedQualitySegment(run: Run): { km: number; durationSec: number } | null {
  const reps = validReps(run);
  const segment = reps.length
    ? reps.reduce(
        (total, r) => ({ km: total.km + r.km, durationSec: total.durationSec + r.durationSec }),
        { km: 0, durationSec: 0 }
      )
    : { km: run.qualityKm ?? 0, durationSec: run.qualityDurationSec ?? 0 };

  if (segment.km <= 0 || segment.durationSec <= 0) return null;
  if (segment.km > run.distanceKm || segment.durationSec > run.durationSec) return null;
  return segment;
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
