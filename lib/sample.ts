import { Run, RunType } from "./types";

/**
 * Generates ~12 weeks of plausible marathon-buildup training ending today,
 * so the dashboard can be explored before any real runs are logged.
 */
export function generateSampleRuns(): Run[] {
  const runs: Run[] = [];
  const today = new Date();

  // Weekly template: [type, km, secPerKm offset from base easy pace]
  const week: Array<[RunType, number, number]> = [
    ["easy", 8, 0],
    ["tempo", 10, -45],
    ["easy", 7, 5],
    ["long", 24, 12],
  ];

  let id = 0;
  for (let w = 12; w >= 1; w--) {
    // Fitness improves through the block: easy pace drifts from 6:05 to 5:40 /km
    const baseEasyPace = 365 - (12 - w) * 2.1;
    const longKm = 18 + (12 - w) * 1.4; // long run builds 18 → ~33 km

    week.forEach(([type, km, offset], idx) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (w * 7 - idx * 2));
      if (d > today) return;
      const distance = type === "long" ? longKm : km + (w % 3 === 0 && idx === 0 ? 2 : 0);
      const jitter = ((w * 7 + idx * 13) % 11) - 5; // deterministic, looks organic
      const pace = baseEasyPace + offset + jitter;
      runs.push({
        id: `sample-${id++}`,
        date: d.toISOString().slice(0, 10),
        distanceKm: Math.round(distance * 10) / 10,
        durationSec: Math.round(distance * pace),
        type,
      });
    });
  }

  // A 10k time trial 3 weeks ago — a strong forecast signal
  const tt = new Date(today);
  tt.setDate(today.getDate() - 21);
  runs.push({
    id: `sample-${id++}`,
    date: tt.toISOString().slice(0, 10),
    distanceKm: 10,
    durationSec: 10 * 290, // 48:20
    type: "race",
    note: "10k time trial",
  });

  return runs.sort((a, b) => (a.date < b.date ? -1 : 1));
}
