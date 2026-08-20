"use client";

import { useStore } from "./RunsProvider";
import { forecastMarathon } from "@/lib/forecast";
import { formatDuration, formatPace, todayISO } from "@/lib/format";

const CONFIDENCE_LABEL = {
  low: "Low confidence — the model needs a fuller training block",
  medium: "Medium confidence",
  high: "High confidence",
} as const;

export function ForecastPanel() {
  const { runs, settings } = useStore();
  const forecast = forecastMarathon(runs, todayISO());

  if (!forecast) {
    return (
      <section className="panel rise rise-3 p-8 md:p-10">
        <p className="label-caps mb-3">Finish forecast</p>
        <p className="font-display text-3xl font-semibold text-[var(--paper-dim)]">
          Log a few runs to see a forecast.
        </p>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-[var(--paper-faint)]">
          The Tanda model reads your training block rather than any single run: how far you
          run in a typical week, and how fast you cover it. Those two numbers over the eight
          weeks before race day are what it turns into a finish time.
        </p>
      </section>
    );
  }

  const goalDelta =
    settings.goalTimeSec != null ? forecast.expectedSec - settings.goalTimeSec : null;

  return (
    <section className="panel rise rise-3 overflow-hidden p-8 md:p-10">
      <div className="flex flex-wrap items-start justify-between gap-8">
        <div>
          <p className="label-caps mb-4">Forecast finish time</p>
          <p className="font-mono-num text-[clamp(3rem,8vw,5.5rem)] font-bold leading-none text-[var(--glacier)]">
            {formatDuration(forecast.expectedSec)}
          </p>
          <div className="font-mono-num mt-4 flex items-center gap-3 text-sm text-[var(--paper-dim)]">
            <span className="text-[var(--glacier-deep)]">↑ {formatDuration(forecast.optimisticSec)}</span>
            <span className="h-px w-10 bg-[var(--line-strong)]" />
            <span className="text-[var(--coral)]">↓ {formatDuration(forecast.conservativeSec)}</span>
          </div>
          <p className="mt-3 text-xs text-[var(--paper-faint)]">
            {CONFIDENCE_LABEL[forecast.confidence]} · from {forecast.runCount} run
            {forecast.runCount === 1 ? "" : "s"}
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <p className="label-caps mb-2">Required pace</p>
            <p className="font-mono-num text-3xl font-semibold">
              {formatPace(forecast.paceSecPerKm)}
              <span className="ml-1 text-sm text-[var(--paper-faint)]">/km</span>
            </p>
          </div>
          {goalDelta != null && (
            <div>
              <p className="label-caps mb-2">vs goal</p>
              <p
                className={`font-mono-num text-3xl font-semibold ${
                  goalDelta <= 0 ? "text-[var(--glacier)]" : "text-[var(--coral)]"
                }`}
              >
                {goalDelta <= 0 ? "−" : "+"}
                {formatDuration(Math.abs(goalDelta))}
              </p>
              <p className="mt-1 text-xs text-[var(--paper-faint)]">
                {goalDelta <= 0 ? "ahead of your goal" : "behind your goal — keep building"}
              </p>
            </div>
          )}
          <div>
            <p className="label-caps mb-2">
              Last {forecast.weeksSpanned} week{forecast.weeksSpanned === 1 ? "" : "s"}
            </p>
            <p className="font-mono-num text-3xl font-semibold">
              {Math.round(forecast.weeklyKm)}
              <span className="ml-1 text-sm text-[var(--paper-faint)]">km/wk</span>
            </p>
            <p className="font-mono-num mt-1 text-sm text-[var(--paper-dim)]">
              {formatPace(forecast.trainingPaceSecPerKm)}
              <span className="ml-1 text-xs text-[var(--paper-faint)]">/km avg</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
