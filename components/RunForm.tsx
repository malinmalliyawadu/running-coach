"use client";

import { useState } from "react";
import { useStore } from "./RunsProvider";
import { parseDuration, todayISO, formatPace } from "@/lib/format";
import { RunType, RUN_TYPE_LABELS } from "@/lib/types";

export function RunForm() {
  const { addRun } = useStore();
  const [date, setDate] = useState(todayISO());
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [type, setType] = useState<RunType>("easy");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const distanceNum = parseFloat(distance);
  const durationSec = parseDuration(duration);
  const livePace =
    distanceNum > 0 && durationSec ? formatPace(durationSec / distanceNum) : null;

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
    addRun({
      date,
      distanceKm: Math.round(distanceNum * 100) / 100,
      durationSec,
      type,
      note: note.trim() || undefined,
    });
    setDistance("");
    setDuration("");
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
