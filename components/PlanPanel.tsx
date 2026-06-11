"use client";

import { useState } from "react";
import { useStore } from "./RunsProvider";
import { generatePlan, suggestedPace, Phase, PlannedWeek } from "@/lib/plan";
import { forecastMarathon } from "@/lib/forecast";
import { formatPace, formatDateShort, todayISO } from "@/lib/format";

const PHASE_COLOR: Record<Phase, string> = {
  Base: "var(--paper-dim)",
  Build: "var(--glacier-deep)",
  Peak: "var(--glacier)",
  Taper: "var(--gold)",
  "Race week": "var(--coral)",
};

const SLOT_ICON: Record<string, string> = {
  quality: "◆",
  easy: "○",
  long: "●",
  race: "★",
};

export function PlanPanel() {
  const { runs, settings } = useStore();
  const [showAll, setShowAll] = useState(false);
  const today = todayISO();
  const plan = generatePlan(settings.raceDate, today, runs);
  const forecast = forecastMarathon(runs, today);

  if (plan.length === 0) return null;

  const thisWeek = plan[0];
  const doneCount = thisWeek.runs.filter((r) => r.done).length;

  return (
    <section className="panel rise rise-4 p-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-4">
          <h2 className="font-display text-lg font-semibold">Training plan</h2>
          <span className="label-caps" style={{ color: PHASE_COLOR[thisWeek.phase] }}>
            {thisWeek.phase}
          </span>
        </div>
        <span className="font-mono-num text-sm text-[var(--paper-dim)]">
          <span className={doneCount === 3 ? "text-[var(--glacier)]" : "text-[var(--coral)]"}>
            {doneCount}
          </span>
          <span className="text-[var(--paper-faint)]"> / 3 this week</span>
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {thisWeek.runs.map((run) => {
          const pace = suggestedPace(run.slot, run.type, forecast);
          return (
            <div
              key={run.slot}
              className={`rounded border p-4 transition-colors ${
                run.done
                  ? "border-[var(--glacier-deep)] bg-[rgba(46,161,141,0.08)]"
                  : "border-[var(--line)] bg-[rgba(10,18,20,0.4)]"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span
                  className="text-xs"
                  style={{ color: run.slot === "race" ? "var(--coral)" : "var(--glacier)" }}
                >
                  {SLOT_ICON[run.slot]}{" "}
                  <span className="label-caps ml-1" style={{ color: "inherit" }}>
                    {run.title}
                  </span>
                </span>
                {run.done && <span className="text-sm text-[var(--glacier)]">✓</span>}
              </div>
              <p className="font-mono-num text-2xl font-semibold">
                {run.km % 1 === 0 ? run.km : run.km.toFixed(1)}
                <span className="ml-1 text-xs font-normal text-[var(--paper-faint)]">km</span>
                {pace != null && (
                  <span className="ml-3 text-sm font-medium text-[var(--paper-dim)]">
                    {formatPace(pace)}
                    <span className="text-xs text-[var(--paper-faint)]">/km</span>
                  </span>
                )}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-[var(--paper-faint)]">{run.detail}</p>
            </div>
          );
        })}
      </div>

      <button
        className="btn-ghost mt-5 w-full"
        onClick={() => setShowAll((s) => !s)}
        aria-expanded={showAll}
      >
        {showAll ? "Hide full plan" : `Show full plan · ${plan.length} weeks to race day`}
      </button>

      {showAll && (
        <div className="mt-4 max-h-[420px] overflow-y-auto pr-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--panel)]">
              <tr className="text-left">
                <th className="label-caps py-2 pr-4 font-semibold">Week</th>
                <th className="label-caps py-2 pr-4 font-semibold">Phase</th>
                <th className="label-caps hidden py-2 pr-4 font-semibold sm:table-cell">Quality</th>
                <th className="label-caps hidden py-2 pr-4 font-semibold sm:table-cell">Easy</th>
                <th className="label-caps py-2 pr-4 font-semibold">Long</th>
                <th className="label-caps py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {plan.map((week) => (
                <PlanRow key={week.weekStart} week={week} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PlanRow({ week }: { week: PlannedWeek }) {
  const bySlot = (slot: string) => week.runs.find((r) => r.slot === slot || (slot === "long" && r.slot === "race"));
  const quality = bySlot("quality");
  const easy = bySlot("easy");
  const long = bySlot("long");

  return (
    <tr className={week.isCurrent ? "bg-[rgba(123,224,206,0.06)]" : ""}>
      <td className="font-mono-num whitespace-nowrap py-2.5 pr-4 text-xs text-[var(--paper-dim)]">
        {formatDateShort(week.weekStart)}
        {week.isCurrent && <span className="ml-2 text-[var(--glacier)]">●</span>}
      </td>
      <td className="py-2.5 pr-4">
        <span
          className="text-[0.65rem] font-semibold uppercase tracking-[0.14em]"
          style={{ color: PHASE_COLOR[week.phase] }}
        >
          {week.phase}
        </span>
      </td>
      <td className="font-mono-num hidden py-2.5 pr-4 text-xs sm:table-cell">
        <Cell run={quality} />
      </td>
      <td className="font-mono-num hidden py-2.5 pr-4 text-xs sm:table-cell">
        <Cell run={easy} />
      </td>
      <td className="font-mono-num py-2.5 pr-4 text-xs">
        <Cell run={long} />
      </td>
      <td className="font-mono-num py-2.5 text-right text-xs text-[var(--paper-dim)]">
        {week.totalKm} km
      </td>
    </tr>
  );
}

function Cell({ run }: { run?: { km: number; title: string; done: boolean; slot: string } }) {
  if (!run) return <span className="text-[var(--paper-faint)]">–</span>;
  return (
    <span className={run.done ? "text-[var(--glacier)]" : run.slot === "race" ? "text-[var(--coral)]" : ""}>
      {run.slot === "race" ? "RACE" : `${Math.round(run.km)} km`}
      {run.done && " ✓"}
    </span>
  );
}
