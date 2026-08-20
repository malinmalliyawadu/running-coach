"use client";

import { useState } from "react";
import { RunsProvider, useStore } from "@/components/RunsProvider";
import { Header } from "@/components/Header";
import { ForecastPanel } from "@/components/ForecastPanel";
import { StatsGrid } from "@/components/StatsGrid";
import { ForecastTrendChart, WeeklyVolumeChart } from "@/components/Charts";
import { RunForm } from "@/components/RunForm";
import { RunList } from "@/components/RunList";
import { PlanPanel } from "@/components/PlanPanel";
import { AnalyzeButton } from "@/components/AnalyzeButton";
import { weeklyBuckets } from "@/lib/stats";

function Dashboard() {
  const { hydrated, runs, editingRunId } = useStore();
  const [showProjection, setShowProjection] = useState(true);
  if (!hydrated) return <div className="min-h-screen" />;

  const volumeWeeks = weeklyBuckets(runs).length;

  return (
    <div className="relative z-10 mx-auto max-w-6xl pb-24">
      <Header />

      <main className="space-y-6 px-6 pt-10 md:px-10">
        <ForecastPanel />
        <StatsGrid />
        <PlanPanel />

        <div className="rise rise-4 grid gap-6 lg:grid-cols-2">
          <section className="panel p-6">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-display text-lg font-semibold">Forecast over time</h2>
              <div className="flex items-baseline gap-3">
                <span className="label-caps">finish time</span>
                <button
                  type="button"
                  className="btn-ghost px-2.5! py-1! text-xs!"
                  aria-pressed={showProjection}
                  onClick={() => setShowProjection((s) => !s)}
                >
                  {showProjection ? "Hide projection" : "Show projection"}
                </button>
              </div>
            </div>
            <ForecastTrendChart showProjection={showProjection} />
          </section>
          <section className="panel p-6">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-display text-lg font-semibold">Weekly volume</h2>
              <span className="label-caps">last {volumeWeeks} weeks</span>
            </div>
            <WeeklyVolumeChart />
          </section>
        </div>

        <div className="rise rise-5 grid gap-6 lg:grid-cols-[380px_1fr]">
          <section id="run-form" className="panel h-fit min-w-0 p-6">
            <h2 className="font-display mb-5 text-lg font-semibold">
              {editingRunId ? "Edit run" : "Log a run"}
            </h2>
            <RunForm />
          </section>
          <section className="panel min-w-0 p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold">Training log</h2>
              <AnalyzeButton />
            </div>
            <RunList />
          </section>
        </div>

        <footer className="pt-8 text-center">
          <p className="text-xs text-[var(--paper-faint)]">
            Forecasts use the Tanda model — weekly volume and training pace over the last 8
            weeks. Data stays in your browser.
          </p>
        </footer>
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <RunsProvider>
      <Dashboard />
    </RunsProvider>
  );
}
