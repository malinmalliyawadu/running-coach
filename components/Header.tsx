"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { useStore } from "./RunsProvider";
import { formatDateLong, parseDuration, formatDuration } from "@/lib/format";

// Client-only "current time" that ticks on an interval. Returns null during SSR
// and the first client render (keeping server/client HTML consistent), then the
// real time once subscribed. Reads come from a ref so each tick yields a stable
// snapshot reference, which useSyncExternalStore requires.
function useNow(intervalMs: number): Date | null {
  const nowRef = useRef<Date | null>(null);
  const subscribe = useCallback(
    (onChange: () => void) => {
      nowRef.current = new Date();
      onChange();
      const t = setInterval(() => {
        nowRef.current = new Date();
        onChange();
      }, intervalMs);
      return () => clearInterval(t);
    },
    [intervalMs]
  );
  return useSyncExternalStore(
    subscribe,
    () => nowRef.current,
    () => null
  );
}

function useCountdown(raceDate: string) {
  const now = useNow(60_000);
  if (!now) return null;
  const race = new Date(raceDate + "T07:00:00");
  const ms = race.getTime() - now.getTime();
  const days = Math.max(0, Math.floor(ms / 86_400_000));
  return { weeks: Math.floor(days / 7), days: days % 7, totalDays: days };
}

export function Header() {
  const { settings, updateSettings } = useStore();
  const countdown = useCountdown(settings.raceDate);
  const [editing, setEditing] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");

  return (
    <header className="relative z-10">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-6 py-4 md:px-10">
        <div className="flex items-center gap-3">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--coral)] pulse-dot" />
          <span className="label-caps">Marathon Build · 2026</span>
        </div>
        <button className="btn-ghost" onClick={() => setEditing((e) => !e)}>
          {editing ? "Done" : "Race settings"}
        </button>
      </div>

      {editing && (
        <div className="border-b border-[var(--line)] bg-[var(--ink-2)] px-6 py-4 md:px-10">
          <div className="flex flex-wrap items-end gap-6">
            <label className="block">
              <span className="label-caps mb-2 block">Race day</span>
              <input
                type="date"
                className="input-field"
                value={settings.raceDate}
                onChange={(e) => updateSettings({ raceDate: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="label-caps mb-2 block">Goal time (optional)</span>
              <div className="flex gap-2">
                <input
                  className="input-field w-36"
                  placeholder="e.g. 3:45:00"
                  value={goalDraft || (settings.goalTimeSec ? formatDuration(settings.goalTimeSec) : "")}
                  onChange={(e) => setGoalDraft(e.target.value)}
                  onBlur={() => {
                    if (goalDraft === "") return;
                    const sec = parseDuration(goalDraft);
                    updateSettings({ goalTimeSec: sec });
                    setGoalDraft("");
                  }}
                />
                {settings.goalTimeSec && (
                  <button
                    className="btn-ghost"
                    onClick={() => updateSettings({ goalTimeSec: null })}
                  >
                    Clear
                  </button>
                )}
              </div>
            </label>
          </div>
        </div>
      )}

      <div className="px-6 pb-2 pt-10 md:px-10 md:pt-16">
        <p className="label-caps rise rise-1 mb-4 text-[var(--glacier)]">
          Lake Wakatipu · 42.195 km
        </p>
        <h1 className="font-display rise rise-2 text-[clamp(2.8rem,9vw,7.5rem)] font-extrabold leading-[0.92] tracking-tight">
          ROAD TO
          <br />
          <span className="text-[var(--glacier)]">QUEENSTOWN</span>
        </h1>
        <div className="rise rise-3 mt-6 flex flex-wrap items-center gap-x-8 gap-y-3">
          <span className="text-sm text-[var(--paper-dim)]">
            {formatDateLong(settings.raceDate)}
          </span>
          {countdown && (
            <span className="font-mono-num text-sm">
              <span className="text-[var(--coral)]">{countdown.weeks}</span>
              <span className="text-[var(--paper-faint)]"> wks </span>
              <span className="text-[var(--coral)]">{countdown.days}</span>
              <span className="text-[var(--paper-faint)]"> days to go</span>
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
