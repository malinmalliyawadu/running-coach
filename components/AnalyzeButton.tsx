"use client";

import { useStore } from "./RunsProvider";
import { forecastMarathon } from "@/lib/forecast";
import { computeStats } from "@/lib/stats";
import { generatePlan } from "@/lib/plan";
import { formatDuration, formatPace, todayISO } from "@/lib/format";
import { RUN_TYPE_LABELS } from "@/lib/types";

const MAX_RUNS_IN_PROMPT = 80;

function buildPrompt(store: ReturnType<typeof useStore>): string {
  const { runs, settings } = store;
  const today = todayISO();
  const forecast = forecastMarathon(runs, today);
  const stats = computeStats(runs);
  const plan = generatePlan(settings.raceDate, today, runs);
  const thisWeek = plan[0];

  const lines: string[] = [];
  lines.push(
    `I'm training for the Queenstown Marathon (42.2 km) on ${settings.raceDate}, which is ${plan.length} weeks away. Please analyse my training data below as a running coach: tell me whether I'm on track, my biggest strengths and risks, what to focus on in the coming weeks, and a suggested race-day pacing strategy.`
  );
  if (settings.goalTimeSec) {
    lines.push(`My goal time is ${formatDuration(settings.goalTimeSec)}.`);
  }

  if (forecast) {
    lines.push(
      `\nCurrent model forecast: ${formatDuration(forecast.expectedSec)} (range ${formatDuration(
        forecast.optimisticSec
      )}–${formatDuration(forecast.conservativeSec)}, ${forecast.confidence} confidence), requiring ${formatPace(
        forecast.paceSecPerKm
      )}/km. The model uses Riegel projection with effort, recency and volume weighting.`
    );
  }

  lines.push(
    `\nStats: ${stats.totalKm.toFixed(0)} km total over ${stats.runCount} runs · avg ${stats.avgWeeklyKm.toFixed(
      1
    )} km/week (last 6 weeks) · longest run ${stats.longestKm.toFixed(1)} km · best pace ${
      stats.bestPaceSecPerKm ? formatPace(stats.bestPaceSecPerKm) + "/km" : "n/a"
    } · ${stats.thisWeekKm.toFixed(1)} km so far this week.`
  );

  if (thisWeek) {
    const planned = thisWeek.runs
      .map((r) => `${r.title} ${Math.round(r.km)}km${r.done ? " (done)" : ""}`)
      .join(", ");
    lines.push(
      `\nI follow a 3-runs-per-week plan (quality + easy + long). Current phase: ${thisWeek.phase}. This week: ${planned}.`
    );
  }

  const sorted = [...runs].sort((a, b) => (a.date > b.date ? -1 : 1));
  const included = sorted.slice(0, MAX_RUNS_IN_PROMPT);
  lines.push(`\nRun log (date, type, distance, time, pace)${
    sorted.length > included.length ? ` — most recent ${included.length} of ${sorted.length}` : ""
  }:`);
  for (const r of included) {
    lines.push(
      `${r.date} ${RUN_TYPE_LABELS[r.type]} ${r.distanceKm}km ${formatDuration(r.durationSec)} ${formatPace(
        r.durationSec / r.distanceKm
      )}/km${r.note ? ` — ${r.note}` : ""}`
    );
  }

  return lines.join("\n");
}

export function AnalyzeButton() {
  const store = useStore();
  const disabled = store.runs.length === 0;

  function open() {
    const prompt = buildPrompt(store);
    window.open(`https://claude.ai/new?q=${encodeURIComponent(prompt)}`, "_blank", "noopener");
  }

  return (
    <button
      onClick={open}
      disabled={disabled}
      title={disabled ? "Log some runs first" : "Open Claude with your training data for analysis"}
      className="btn-ghost flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span aria-hidden="true" className="text-[var(--coral)]">✦</span>
      Analyse with Claude
    </button>
  );
}
