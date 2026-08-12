"use client";

import { useState } from "react";
import { useStore } from "./RunsProvider";
import { parseDuration, todayISO, formatPace } from "@/lib/format";
import { RunType, RUN_TYPE_LABELS, isQualityType } from "@/lib/types";

export function RunForm() {
  const { addRun } = useStore();
  const [date, setDate] = useState(todayISO());
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [type, setType] = useState<RunType>("easy");
  const [qualityDistance, setQualityDistance] = useState("");
  const [qualityDuration, setQualityDuration] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const distanceNum = parseFloat(distance);
  const durationSec = parseDuration(duration);
  const livePace =
    distanceNum > 0 && durationSec ? formatPace(durationSec / distanceNum) : null;

  const showQuality = isQualityType(type);
  const qualityDistanceNum = parseFloat(qualityDistance);
  const qualityDurationSec = parseDuration(qualityDuration);
  const liveQualityPace =
    showQuality && qualityDistanceNum > 0 && qualityDurationSec
      ? formatPace(qualityDurationSec / qualityDistanceNum)
      : null;

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

    addRun({
      date,
      distanceKm: Math.round(distanceNum * 100) / 100,
      durationSec,
      type,
      qualityKm: hasQuality ? Math.round(qualityDistanceNum * 100) / 100 : undefined,
      qualityDurationSec: hasQuality ? qualityDurationSec! : undefined,
      note: note.trim() || undefined,
    });
    setDistance("");
    setDuration("");
    setQualityDistance("");
    setQualityDuration("");
    setNote("");
    setError(null);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
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
            The {type === "intervals" ? "reps" : "tempo block"} only — leave out the warm-up,
            cool-down{type === "intervals" ? " and recovery jogs" : ""}. Without it the model has
            to guess the split, and reads the session slower than you ran it.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label-caps mb-2 block">Distance (km)</span>
              <input
                className="input-field"
                inputMode="decimal"
                placeholder={type === "intervals" ? "4.8" : "6.0"}
                value={qualityDistance}
                onChange={(e) => setQualityDistance(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="label-caps mb-2 block">Time</span>
              <input
                className="input-field"
                placeholder={type === "intervals" ? "21:36" : "30:30"}
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
          Log run
        </button>
      </div>
      {error && <p className="text-sm text-[var(--coral)]">{error}</p>}
    </form>
  );
}
