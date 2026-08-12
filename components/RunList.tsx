"use client";

import { useStore } from "./RunsProvider";
import { formatDuration, formatPace, formatDateShort, formatRepSet } from "@/lib/format";
import { RUN_TYPE_LABELS, RunType, loggedQualitySegment, validReps } from "@/lib/types";

const TYPE_COLOR: Record<RunType, string> = {
  easy: "var(--paper-dim)",
  long: "var(--gold)",
  tempo: "var(--glacier)",
  intervals: "var(--paper-dim)",
  race: "var(--coral)",
};

export function RunList() {
  const { runs, deleteRun, loadSample, clearAll, editingRunId, setEditingRunId } = useStore();

  function edit(id: string) {
    setEditingRunId(id);
    // The form sits above the log on narrow screens, out of view on a long log.
    document.getElementById("run-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  const sorted = [...runs].sort((a, b) => (a.date > b.date ? -1 : 1));
  const isSample = runs.some((r) => r.id.startsWith("sample-"));

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 py-6">
        <p className="text-sm leading-relaxed text-[var(--paper-faint)]">
          No runs yet. Log your first one on the left — or explore the dashboard with
          sample training data first.
        </p>
        <button className="btn-ghost" onClick={loadSample}>
          Load sample data
        </button>
      </div>
    );
  }

  return (
    <div>
      {isSample && (
        <div className="mb-4 flex items-center justify-between gap-4 rounded border border-dashed border-[var(--line-strong)] px-4 py-2.5">
          <p className="text-xs text-[var(--paper-dim)]">
            Showing sample data — it clears when you log a real run.
          </p>
          <button className="btn-ghost" onClick={clearAll}>
            Clear
          </button>
        </div>
      )}
      <ul className="max-h-[480px] divide-y divide-[var(--line)] overflow-y-auto pr-1">
        {sorted.map((run) => {
          const pace = run.durationSec / run.distanceKm;
          const quality = loggedQualitySegment(run);
          // A rep set reads better as "6 × 800 m" than as its total distance.
          const qualityLabel = quality
            ? `${formatRepSet(validReps(run)) ?? `${Math.round(quality.km * 100) / 100} km`} @ ${formatPace(
                quality.durationSec / quality.km
              )}`
            : null;
          return (
            <li
              key={run.id}
              className={`group flex items-baseline gap-4 py-3 ${
                run.id === editingRunId ? "-mx-2 rounded bg-[rgba(123,224,206,0.07)] px-2" : ""
              }`}
            >
              <span className="font-mono-num w-14 shrink-0 text-xs text-[var(--paper-faint)]">
                {formatDateShort(run.date)}
              </span>
              <span
                className="w-20 shrink-0 text-[0.65rem] font-semibold uppercase tracking-[0.14em]"
                style={{ color: TYPE_COLOR[run.type] }}
              >
                {RUN_TYPE_LABELS[run.type].split(" ")[0]}
              </span>
              <span className="font-mono-num shrink-0 text-sm font-semibold">
                {run.distanceKm} km
              </span>
              <span className="font-mono-num shrink-0 text-sm text-[var(--paper-dim)]">
                {formatDuration(run.durationSec)}
              </span>
              <span className="font-mono-num shrink-0 text-xs text-[var(--paper-faint)]">
                {formatPace(pace)}/km
              </span>
              {qualityLabel && quality && (
                <span
                  className="font-mono-num hidden shrink-0 text-xs text-[var(--glacier)] sm:inline"
                  title={`${Math.round(quality.km * 100) / 100} km of hard running at ${formatPace(
                    quality.durationSec / quality.km
                  )}/km`}
                >
                  {qualityLabel}
                </span>
              )}
              {run.note && (
                <span className="hidden truncate text-xs italic text-[var(--paper-faint)] md:inline">
                  {run.note}
                </span>
              )}
              <button
                onClick={() => edit(run.id)}
                className={`ml-auto shrink-0 text-xs text-[var(--paper-faint)] transition-opacity hover:text-[var(--glacier)] group-hover:opacity-100 ${
                  run.id === editingRunId ? "text-[var(--glacier)] opacity-100" : "opacity-0"
                }`}
                aria-label={`Edit run from ${formatDateShort(run.date)}`}
              >
                Edit
              </button>
              <button
                onClick={() => {
                  if (run.id === editingRunId) setEditingRunId(null);
                  deleteRun(run.id);
                }}
                className="shrink-0 text-xs text-[var(--paper-faint)] opacity-0 transition-opacity hover:text-[var(--coral)] group-hover:opacity-100"
                aria-label={`Delete run from ${formatDateShort(run.date)}`}
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
