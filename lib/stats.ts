import { loggedQualitySegment, Run } from "./types";
import { todayISO } from "./format";

export interface Stats {
  totalKm: number;
  runCount: number;
  longestKm: number;
  bestPaceSecPerKm: number; // fastest sustained effort ≥ 3 km (see computeStats)
  thisWeekKm: number;
  avgWeeklyKm: number; // over the trained window (see avgWeeklyWeeks)
  avgWeeklyWeeks: number; // weeks the average spans: since first run, capped at 6
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
  let firstDate: string | null = null;

  for (const r of runs) {
    totalKm += r.distanceKm;
    longestKm = Math.max(longestKm, r.distanceKm);
    // Best pace means the fastest pace held without a break. For a tempo run
    // with a logged split that is the block itself, not the session average —
    // which is dragged slow by the warm-up and cool-down wrapped around it.
    // Interval sessions never count: their average belongs to no part of the
    // run, and even the reps alone are broken up by the recoveries.
    const tempoBlock = r.type === "tempo" ? loggedQualitySegment(r) : null;
    if (tempoBlock) {
      if (tempoBlock.km >= 3) bestPace = Math.min(bestPace, tempoBlock.durationSec / tempoBlock.km);
    } else if (r.distanceKm >= 3 && r.type !== "intervals") {
      bestPace = Math.min(bestPace, r.durationSec / r.distanceKm);
    }
    if (r.date >= weekStart && r.date <= today) thisWeekKm += r.distanceKm;
    if (r.date >= sixWeeksAgoISO && r.date <= today) last6wKm += r.distanceKm;
    if (r.distanceKm >= 28) longRunCount++;
    if (r.date <= today && (!firstDate || r.date < firstDate)) firstDate = r.date;
  }

  // Average over the weeks actually trained, capped at 6 — dividing a
  // four-week-old log by six dilutes the average with empty weeks.
  let avgWeeklyWeeks = 6;
  if (firstDate) {
    const daysOfData =
      (new Date(today + "T12:00:00").getTime() - new Date(firstDate + "T12:00:00").getTime()) /
      86_400_000;
    avgWeeklyWeeks = Math.min(6, Math.max(1, Math.round(daysOfData / 7)));
  }

  return {
    totalKm,
    runCount: runs.length,
    longestKm,
    bestPaceSecPerKm: isFinite(bestPace) ? bestPace : 0,
    thisWeekKm,
    avgWeeklyKm: last6wKm / avgWeeklyWeeks,
    avgWeeklyWeeks,
    longRunCount,
  };
}

export interface WeekBucket {
  weekLabel: string; // e.g. "18 May"
  weekStart: string;
  km: number;
}

export function weeklyBuckets(runs: Run[], maxWeeks = 14): WeekBucket[] {
  const buckets: WeekBucket[] = [];
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() - day);

  for (let i = maxWeeks - 1; i >= 0; i--) {
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

  // Chart only back to the first logged run — with a few weeks of history a
  // fixed window is mostly empty bars. Keep a small floor so the chart has
  // some shape early on.
  const MIN_WEEKS = 4;
  const firstDate = runs.reduce<string | null>(
    (min, r) => (!min || r.date < min ? r.date : min),
    null
  );
  if (firstDate) {
    let firstIdx = 0;
    for (let i = buckets.length - 1; i >= 0; i--) {
      if (buckets[i].weekStart <= firstDate) {
        firstIdx = i;
        break;
      }
    }
    return buckets.slice(Math.max(0, Math.min(firstIdx, buckets.length - MIN_WEEKS)));
  }
  return buckets;
}
