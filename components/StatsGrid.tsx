"use client";

import { useStore } from "./RunsProvider";
import { computeStats } from "@/lib/stats";
import { formatPace } from "@/lib/format";

export function StatsGrid() {
  const { runs } = useStore();
  const stats = computeStats(runs);

  const items = [
    { label: "Total volume", value: stats.totalKm.toFixed(0), unit: "km" },
    { label: "Runs logged", value: String(stats.runCount), unit: "" },
    { label: "This week", value: stats.thisWeekKm.toFixed(1), unit: "km" },
    { label: "Avg weekly (6w)", value: stats.avgWeeklyKm.toFixed(1), unit: "km" },
    { label: "Longest run", value: stats.longestKm.toFixed(1), unit: "km" },
    {
      label: "Best pace",
      value: stats.bestPaceSecPerKm ? formatPace(stats.bestPaceSecPerKm) : "–",
      unit: "/km",
    },
  ];

  return (
    <section className="rise rise-4 grid grid-cols-2 gap-px overflow-hidden rounded border border-[var(--line)] bg-[var(--line)] sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="bg-[var(--ink-2)] p-5">
          <p className="label-caps mb-3">{item.label}</p>
          <p className="font-mono-num text-2xl font-semibold">
            {item.value}
            {item.unit && (
              <span className="ml-1 text-xs font-normal text-[var(--paper-faint)]">{item.unit}</span>
            )}
          </p>
        </div>
      ))}
    </section>
  );
}
