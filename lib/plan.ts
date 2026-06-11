import { Run, RunType, MARATHON_KM } from "./types";
import { Forecast } from "./forecast";

/**
 * Generates a 3-runs-per-week marathon plan anchored to race day:
 * a quality session (alternating tempo / intervals), a midweek easy run,
 * and a weekend long run that builds to 32 km three weeks out, with a
 * cutback every 4th week and a 2-week taper.
 *
 * The progression is computed backward from race day, so the plan stays
 * stable as weeks pass — past weeks don't shift underneath you.
 */

export type Phase = "Base" | "Build" | "Peak" | "Taper" | "Race week";

export interface PlannedRun {
  slot: "quality" | "easy" | "long" | "race";
  type: RunType;
  km: number;
  title: string;
  detail: string;
  done: boolean;
}

export interface PlannedWeek {
  weekStart: string; // ISO Monday
  weeksToRace: number; // 0 = race week
  phase: Phase;
  runs: PlannedRun[];
  totalKm: number;
  isCurrent: boolean;
  isPast: boolean;
}

function mondayOf(iso: string): Date {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function phaseFor(w: number): Phase {
  if (w === 0) return "Race week";
  if (w <= 2) return "Taper";
  if (w <= 7) return "Peak";
  if (w <= 15) return "Build";
  return "Base";
}

/** Long-run distance for a week `w` weeks before race week. */
function longRunKm(w: number): number {
  if (w === 0) return MARATHON_KM;
  if (w === 1) return 14;
  if (w === 2) return 22;
  const ramped = 32 - (w - 3) * 1.5;
  const base = Math.max(16, ramped);
  // Cutback every 4th week before race (w = 4, 8, 12, ...), skipping the peak zone edge
  if (w >= 4 && w % 4 === 0) return Math.round(base * 0.72);
  return Math.round(base);
}

function qualityRun(w: number): Omit<PlannedRun, "done"> {
  if (w === 0) {
    return { slot: "quality", type: "easy", km: 6, title: "Shakeout", detail: "Very easy, loosen the legs" };
  }
  if (w <= 2) {
    return {
      slot: "quality",
      type: "tempo",
      km: 7,
      title: "Sharpener",
      detail: "2 km easy · 3 km at marathon pace · 2 km easy",
    };
  }
  const tempoWeek = w % 2 === 0;
  if (tempoWeek) {
    const tempoKm = w > 15 ? 3 : w > 7 ? 5 : 6;
    return {
      slot: "quality",
      type: "tempo",
      km: tempoKm + 4,
      title: "Tempo",
      detail: `2 km easy · ${tempoKm} km comfortably hard · 2 km easy`,
    };
  }
  const reps = w > 15 ? 5 : w > 7 ? 6 : 8;
  return {
    slot: "quality",
    type: "intervals",
    km: 8,
    title: "Intervals",
    detail: `${reps} × 800 m hard with 400 m jog recoveries`,
  };
}

function easyRun(w: number): Omit<PlannedRun, "done"> {
  if (w === 0) return { slot: "easy", type: "easy", km: 4, title: "Pre-race legs", detail: "Easy with 4 × 20 s strides" };
  const km = w <= 2 ? 6 : w <= 7 ? 10 : w <= 15 ? 9 : 8;
  return { slot: "easy", type: "easy", km, title: "Easy run", detail: "Conversational pace, fully relaxed" };
}

function longRun(w: number): Omit<PlannedRun, "done"> {
  const km = longRunKm(w);
  if (w === 0) {
    return { slot: "race", type: "race", km: MARATHON_KM, title: "Queenstown Marathon", detail: "Race day — trust the training" };
  }
  const detail =
    w <= 7 && w >= 3 && km >= 26
      ? `Steady, finish the last ${Math.min(8, Math.round(km / 4))} km at marathon pace`
      : "Relaxed effort, fuel every 40 min";
  return { slot: "long", type: "long", km, title: "Long run", detail };
}

/** Greedily mark planned runs done from logged runs in the same week. */
function markDone(planned: Omit<PlannedRun, "done">[], logged: Run[]): PlannedRun[] {
  const pool = [...logged];
  const take = (pred: (r: Run) => boolean): boolean => {
    const i = pool.findIndex(pred);
    if (i === -1) return false;
    pool.splice(i, 1);
    return true;
  };
  // Match most specific slots first: race, long, quality, then easy soaks up the rest
  const order = ["race", "long", "quality", "easy"] as const;
  const result = new Map<Omit<PlannedRun, "done">, boolean>();
  for (const slot of order) {
    for (const p of planned.filter((x) => x.slot === slot)) {
      let done = false;
      if (slot === "race") done = take((r) => r.type === "race" && r.distanceKm >= 40);
      else if (slot === "long") done = take((r) => r.type === "long" || r.distanceKm >= p.km * 0.75);
      else if (slot === "quality") done = take((r) => r.type === "tempo" || r.type === "intervals" || r.type === "race");
      else done = take(() => true);
      result.set(p, done);
    }
  }
  return planned.map((p) => ({ ...p, done: result.get(p) ?? false }));
}

export function generatePlan(raceDateISO: string, todayISO: string, runs: Run[]): PlannedWeek[] {
  const raceMonday = mondayOf(raceDateISO);
  const currentMonday = mondayOf(todayISO);
  const totalWeeks = Math.round((raceMonday.getTime() - currentMonday.getTime()) / (7 * 86_400_000));
  if (totalWeeks < 0) return [];

  const weeks: PlannedWeek[] = [];
  for (let i = 0; i <= totalWeeks; i++) {
    const start = new Date(currentMonday);
    start.setDate(currentMonday.getDate() + i * 7);
    const startISO = toISO(start);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const endISO = toISO(end);
    const w = totalWeeks - i;

    const logged = runs.filter((r) => r.date >= startISO && r.date <= endISO);
    const planned = [qualityRun(w), easyRun(w), longRun(w)];
    const withDone = markDone(planned, logged);

    weeks.push({
      weekStart: startISO,
      weeksToRace: w,
      phase: phaseFor(w),
      runs: withDone,
      totalKm: Math.round(withDone.reduce((s, r) => s + r.km, 0)),
      isCurrent: i === 0,
      isPast: false,
    });
  }
  return weeks;
}

/** Suggested pace per planned run, derived from the current forecast. */
export function suggestedPace(slot: PlannedRun["slot"], type: RunType, forecast: Forecast | null): number | null {
  if (!forecast) return null;
  const mp = forecast.paceSecPerKm;
  if (slot === "race") return mp;
  switch (type) {
    case "easy":
      return mp * 1.15;
    case "long":
      return mp * 1.1;
    case "tempo":
      return mp * 0.95;
    case "intervals":
      return mp * 0.88;
    default:
      return mp;
  }
}
