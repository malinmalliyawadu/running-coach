"use client";

import { Fragment, useRef, useState } from "react";
import { useStore } from "./RunsProvider";
import {
  parseDuration,
  todayISO,
  formatPace,
  formatDuration,
  formatRepSet,
  formatDateShort,
} from "@/lib/format";
import { Rep, Run, RunType, RUN_TYPE_LABELS, isQualityType, validReps } from "@/lib/types";

interface RepInput {
  distanceM: string;
  time: string;
}

const EMPTY_REP: RepInput = { distanceM: "", time: "" };

/**
 * Logs a new run, or edits an existing one. Keyed on the run being edited so
 * picking a different one remounts with fresh initial state — no effect
 * syncing form fields to props.
 */
export function RunForm() {
  const { runs, editingRunId } = useStore();
  const editing = runs.find((r) => r.id === editingRunId) ?? null;
  return <RunFormFields key={editing?.id ?? "new"} editing={editing} />;
}

function repsToInputs(run: Run | null): RepInput[] {
  const reps = run ? validReps(run) : [];
  if (reps.length === 0) return [EMPTY_REP];
  return reps.map((r) => ({
    distanceM: String(Math.round(r.km * 1000)),
    time: formatDuration(r.durationSec),
  }));
}

function RunFormFields({ editing }: { editing: Run | null }) {
  const { addRun, updateRun, setEditingRunId } = useStore();
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [distance, setDistance] = useState(editing ? String(editing.distanceKm) : "");
  const [duration, setDuration] = useState(editing ? formatDuration(editing.durationSec) : "");
  const [type, setType] = useState<RunType>(editing?.type ?? "easy");
  const [qualityDistance, setQualityDistance] = useState(
    editing?.qualityKm ? String(editing.qualityKm) : ""
  );
  const [qualityDuration, setQualityDuration] = useState(
    editing?.qualityDurationSec ? formatDuration(editing.qualityDurationSec) : ""
  );
  const [reps, setReps] = useState<RepInput[]>(repsToInputs(editing));
  const [note, setNote] = useState(editing?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const repTimeRefs = useRef<(HTMLInputElement | null)[]>([]);

  const distanceNum = parseFloat(distance);
  const durationSec = parseDuration(duration);
  const livePace =
    distanceNum > 0 && durationSec ? formatPace(durationSec / distanceNum) : null;

  const showReps = type === "intervals";
  const showQuality = isQualityType(type) && !showReps;
  const qualityDistanceNum = parseFloat(qualityDistance);
  const qualityDurationSec = parseDuration(qualityDuration);
  const liveQualityPace =
    showQuality && qualityDistanceNum > 0 && qualityDurationSec
      ? formatPace(qualityDurationSec / qualityDistanceNum)
      : null;

  // Rows left completely blank are ignored, so the section stays optional and
  // the trailing empty row you get after "Add rep" is never an error.
  const startedReps = reps.filter((r) => r.distanceM.trim() !== "" || r.time.trim() !== "");
  const parsedReps: Rep[] = startedReps.map((r) => ({
    km: parseFloat(r.distanceM) / 1000,
    durationSec: parseDuration(r.time) ?? 0,
  }));
  const repsComplete = parsedReps.every((r) => r.km > 0 && r.durationSec > 0);
  const repTotals =
    startedReps.length > 0 && repsComplete
      ? parsedReps.reduce(
          (total, r) => ({ km: total.km + r.km, durationSec: total.durationSec + r.durationSec }),
          { km: 0, durationSec: 0 }
        )
      : null;
  const repShorthand = repTotals ? formatRepSet(parsedReps) : null;

  function updateRep(index: number, patch: Partial<RepInput>) {
    setReps((current) => current.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  /** Carries the previous rep's distance down, so a rep set is just its times. */
  function addRep(focus = false) {
    setReps((current) => [
      ...current,
      { distanceM: current[current.length - 1]?.distanceM ?? "", time: "" },
    ]);
    if (focus) {
      const next = reps.length;
      setTimeout(() => repTimeRefs.current[next]?.focus(), 0);
    }
  }

  function removeRep(index: number) {
    setReps((current) => (current.length === 1 ? [EMPTY_REP] : current.filter((_, i) => i !== index)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!distanceNum || distanceNum <= 0) {
      setError("Enter a distance in km.");
      return;
    }
    if (!durationSec || durationSec <= 0) {
      setError("Enter a time like 47:30 or 1:42:05.");
      return;
    }

    const hasQuality = showQuality && (qualityDistance.trim() !== "" || qualityDuration.trim() !== "");
    if (hasQuality) {
      if (!qualityDistanceNum || qualityDistanceNum <= 0 || !qualityDurationSec) {
        setError("Give both the distance and the time of the hard part, or leave both blank.");
        return;
      }
      if (qualityDistanceNum > distanceNum || qualityDurationSec > durationSec) {
        setError("The hard part has to fit inside the session total.");
        return;
      }
    }

    const hasReps = showReps && startedReps.length > 0;
    if (hasReps) {
      if (!repTotals) {
        setError("Give a distance and a time for every rep.");
        return;
      }
      if (repTotals.km > distanceNum || repTotals.durationSec > durationSec) {
        setError("The reps add up to more than the session total.");
        return;
      }
    }

    const next = {
      date,
      distanceKm: Math.round(distanceNum * 100) / 100,
      durationSec,
      type,
      reps: hasReps ? parsedReps : undefined,
      qualityKm: hasQuality ? Math.round(qualityDistanceNum * 100) / 100 : undefined,
      qualityDurationSec: hasQuality ? qualityDurationSec! : undefined,
      note: note.trim() || undefined,
    };

    if (editing) {
      updateRun(editing.id, next);
      setEditingRunId(null); // remounts the form back to a blank entry
      return;
    }

    addRun(next);
    setDistance("");
    setDuration("");
    setQualityDistance("");
    setQualityDuration("");
    setReps([EMPTY_REP]);
    setNote("");
    setError(null);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {editing && (
        <div className="flex items-center justify-between gap-3 rounded border border-[var(--glacier-deep)] bg-[rgba(123,224,206,0.06)] px-3 py-2">
          <p className="text-xs text-[var(--paper-dim)]">
            Editing the {RUN_TYPE_LABELS[editing.type].toLowerCase()} from{" "}
            {formatDateShort(editing.date)}
          </p>
          <button
            type="button"
            className="text-xs text-[var(--paper-faint)] transition-colors hover:text-[var(--glacier)]"
            onClick={() => setEditingRunId(null)}
          >
            Cancel
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label-caps mb-2 block">Date</span>
          <input
            type="date"
            className="input-field"
            value={date}
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="label-caps mb-2 block">Type</span>
          <select
            className="input-field"
            value={type}
            onChange={(e) => setType(e.target.value as RunType)}
          >
            {Object.entries(RUN_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label-caps mb-2 block">Distance (km)</span>
          <input
            className="input-field"
            inputMode="decimal"
            placeholder="10.0"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="label-caps mb-2 block">Time</span>
          <input
            className="input-field"
            placeholder="52:30"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
        </label>
      </div>

      {showQuality && (
        <fieldset className="rounded border border-dashed border-[var(--line-strong)] px-4 pb-4 pt-3">
          <legend className="label-caps px-1">Hard part (optional)</legend>
          <p className="mb-3 text-xs leading-relaxed text-[var(--paper-faint)]">
            The tempo block only — leave out the warm-up and cool-down. It keeps your best-pace
            stat honest and shows the session at the pace you actually ran the work.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label-caps mb-2 block">Distance (km)</span>
              <input
                className="input-field"
                inputMode="decimal"
                placeholder="6.0"
                value={qualityDistance}
                onChange={(e) => setQualityDistance(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="label-caps mb-2 block">Time</span>
              <input
                className="input-field"
                placeholder="30:30"
                value={qualityDuration}
                onChange={(e) => setQualityDuration(e.target.value)}
              />
            </label>
          </div>
          {liveQualityPace && (
            <p className="font-mono-num mt-3 text-sm text-[var(--glacier)]">
              {liveQualityPace} <span className="text-[var(--paper-faint)]">/km at effort</span>
            </p>
          )}
        </fieldset>
      )}

      {showReps && (
        <fieldset className="rounded border border-dashed border-[var(--line-strong)] px-4 pb-4 pt-3">
          <legend className="label-caps px-1">Work intervals (optional)</legend>
          <p className="mb-3 text-xs leading-relaxed text-[var(--paper-faint)]">
            One row per rep — the app adds them up. Leave out the warm-up, cool-down and the
            recovery jogs between them.
          </p>

          <div className="grid grid-cols-[1.25rem_1fr_1fr_1.5rem] items-center gap-x-3 gap-y-2">
            <span />
            <span className="label-caps">Distance (m)</span>
            <span className="label-caps">Time</span>
            <span />
            {reps.map((rep, i) => (
              <Fragment key={i}>
                <span className="font-mono-num text-xs text-[var(--paper-faint)]">{i + 1}</span>
                <input
                  className="input-field"
                  inputMode="decimal"
                  placeholder="800"
                  aria-label={`Rep ${i + 1} distance in metres`}
                  value={rep.distanceM}
                  onChange={(e) => updateRep(i, { distanceM: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    repTimeRefs.current[i]?.focus();
                  }}
                />
                <input
                  className="input-field"
                  placeholder="3:36"
                  aria-label={`Rep ${i + 1} time`}
                  ref={(el) => {
                    repTimeRefs.current[i] = el;
                  }}
                  value={rep.time}
                  onChange={(e) => updateRep(i, { time: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    // Enter belongs to the rep list: it drops you into the next
                    // rep, so a set of 12 is one uninterrupted run of typing.
                    // Always swallowed, so a stray Enter mid-set can never
                    // submit the run half-entered. Read off the element rather
                    // than the render closure, which lags a fast keystroke.
                    e.preventDefault();
                    if (i === reps.length - 1 && e.currentTarget.value.trim() !== "") addRep(true);
                  }}
                />
                <button
                  type="button"
                  onClick={() => removeRep(i)}
                  aria-label={`Remove rep ${i + 1}`}
                  className="text-xs text-[var(--paper-faint)] transition-colors hover:text-[var(--coral)]"
                >
                  ✕
                </button>
              </Fragment>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <button type="button" className="btn-ghost" onClick={() => addRep(true)}>
              + Add rep
            </button>
            {repTotals && (
              <p className="font-mono-num text-sm text-[var(--glacier)]">
                {repShorthand ? `${repShorthand} · ` : ""}
                {Math.round(repTotals.km * 100) / 100} km · {formatDuration(repTotals.durationSec)} ·{" "}
                {formatPace(repTotals.durationSec / repTotals.km)}
                <span className="text-[var(--paper-faint)]"> /km</span>
              </p>
            )}
          </div>
        </fieldset>
      )}

      <label className="block">
        <span className="label-caps mb-2 block">Note (optional)</span>
        <input
          className="input-field"
          placeholder="Felt strong on the hills"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      <div className="flex items-center justify-between gap-4">
        {livePace ? (
          <span className="font-mono-num text-sm text-[var(--paper-dim)]">
            {livePace} <span className="text-[var(--paper-faint)]">/km</span>
          </span>
        ) : (
          <span />
        )}
        <button type="submit" className="btn-primary">
          {editing ? "Save changes" : "Log run"}
        </button>
      </div>
      {error && <p className="text-sm text-[var(--coral)]">{error}</p>}
    </form>
  );
}
