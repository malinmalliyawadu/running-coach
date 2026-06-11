import { Run } from "./types";
import { todayISO } from "./format";

export interface Stats {
  totalKm: number;
  runCount: number;
  longestKm: number;
  bestPaceSecPerKm: number; // fastest single-run average pace (runs ≥ 3 km)
  thisWeekKm: number;
  avgWeeklyKm: number; // over last 6 weeks
  longRunCount: number; // runs ≥ 28 km — marathon-specific endurance
}

function startOfWeekISO(): string {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function computeStats(runs: Run[]): Stats {
  const today = todayISO();
  const weekStart = startOfWeekISO();
  const sixWeeksAgo = new Date();
  sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);
  const sixWeeksAgoISO = sixWeeksAgo.toISOString().slice(0, 10);

  let totalKm = 0;
  let longestKm = 0;
  let bestPace = Infinity;
  let thisWeekKm = 0;
  let last6wKm = 0;
  let longRunCount = 0;

  for (const r of runs) {
    totalKm += r.distanceKm;
    longestKm = Math.max(longestKm, r.distanceKm);
    if (r.distanceKm >= 3 && r.type !== "intervals") {
      bestPace = Math.min(bestPace, r.durationSec / r.distanceKm);
    }
    if (r.date >= weekStart && r.date <= today) thisWeekKm += r.distanceKm;
    if (r.date >= sixWeeksAgoISO && r.date <= today) last6wKm += r.distanceKm;
    if (r.distanceKm >= 28) longRunCount++;
  }

  return {
    totalKm,
    runCount: runs.length,
    longestKm,
    bestPaceSecPerKm: isFinite(bestPace) ? bestPace : 0,
    thisWeekKm,
    avgWeeklyKm: last6wKm / 6,
    longRunCount,
  };
}

export interface WeekBucket {
  weekLabel: string; // e.g. "18 May"
  weekStart: string;
  km: number;
}

export function weeklyBuckets(runs: Run[], weeks = 14): WeekBucket[] {
  const buckets: WeekBucket[] = [];
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - day);

  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisMonday);
    start.setDate(thisMonday.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const startISO = start.toISOString().slice(0, 10);
    const endISO = end.toISOString().slice(0, 10);
    const km = runs
      .filter((r) => r.date >= startISO && r.date <= endISO)
      .reduce((s, r) => s + r.distanceKm, 0);
    buckets.push({
      weekLabel: start.toLocaleDateString("en-NZ", { day: "numeric", month: "short" }),
      weekStart: startISO,
      km: Math.round(km * 10) / 10,
    });
  }
  return buckets;
}
