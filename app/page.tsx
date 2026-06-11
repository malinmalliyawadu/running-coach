"use client";

import { RunsProvider, useStore } from "@/components/RunsProvider";
import { Header } from "@/components/Header";
import { ForecastPanel } from "@/components/ForecastPanel";
import { StatsGrid } from "@/components/StatsGrid";
import { ForecastTrendChart, WeeklyVolumeChart } from "@/components/Charts";
import { RunForm } from "@/components/RunForm";
import { RunList } from "@/components/RunList";
import { PlanPanel } from "@/components/PlanPanel";

function Dashboard() {
  const { hydrated } = useStore();
  if (!hydrated) return <div className="min-h-screen" />;

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
              <span className="label-caps">finish time</span>
            </div>
            <ForecastTrendChart />
          </section>
          <section className="panel p-6">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-display text-lg font-semibold">Weekly volume</h2>
              <span className="label-caps">last 14 weeks</span>
            </div>
            <WeeklyVolumeChart />
          </section>
        </div>

        <div className="rise rise-5 grid gap-6 lg:grid-cols-[380px_1fr]">
          <section className="panel h-fit p-6">
            <h2 className="font-display mb-5 text-lg font-semibold">Log a run</h2>
            <RunForm />
          </section>
          <section className="panel p-6">
            <h2 className="font-display mb-3 text-lg font-semibold">Training log</h2>
            <RunList />
          </section>
        </div>

        <footer className="pt-8 text-center">
          <p className="text-xs text-[var(--paper-faint)]">
            Forecasts use Riegel projection with effort, recency &amp; volume weighting.
            Data stays in your browser.
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
