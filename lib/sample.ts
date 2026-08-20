import { Run } from "./types";

/**
 * Generates ~12 weeks of plausible marathon-buildup training ending today,
 * so the dashboard can be explored before any real runs are logged.
 *
 * Quality sessions are built the way they are actually run — a warm-up and
 * cool-down wrapped around the work, plus jog recoveries between reps — and
 * carry the split the log displays (`qualityKm` / `qualityDurationSec`).
 */
export function generateSampleRuns(): Run[] {
  const runs: Run[] = [];
  const today = new Date();

  let id = 0;
  const push = (daysAgo: number, run: Omit<Run, "id" | "date">) => {
    const d = new Date(today);
    d.setDate(today.getDate() - daysAgo);
    if (d > today) return;
    runs.push({ id: `sample-${id++}`, date: d.toISOString().slice(0, 10), ...run });
  };

  const round1 = (n: number) => Math.round(n * 10) / 10;

  for (let w = 12; w >= 1; w--) {
    // Fitness improves through the block: easy pace drifts from 6:05 to 5:40 /km
    const easyPace = 365 - (12 - w) * 2.1;
    const longKm = round1(18 + (12 - w) * 1.4); // long run builds 18 → ~33 km
    const jitter = ((w * 7) % 11) - 5; // deterministic, looks organic
    const dayOf = (idx: number) => w * 7 - idx * 2;

    push(dayOf(0), {
      type: "easy",
      distanceKm: 8,
      durationSec: Math.round(8 * (easyPace + jitter)),
    });

    // The quality session alternates tempo and reps, matching the plan.
    if (w % 2 === 0) {
      // 2 km easy · 6 km comfortably hard · 2 km easy
      const tempoPace = easyPace - 50 + jitter;
      const qualityDurationSec = Math.round(6 * tempoPace);
      push(dayOf(1), {
        type: "tempo",
        distanceKm: 10,
        durationSec: qualityDurationSec + Math.round(4 * (easyPace + 10)),
        qualityKm: 6,
        qualityDurationSec,
      });
    } else {
      // 2 km warm-up · 6 × 800 m hard w/ 400 m jogs · 1.8 km cool-down.
      // The set drifts a couple of seconds slower rep to rep, the way a real
      // one does, with the last one run in on whatever is left.
      const repPace = easyPace - 85 + jitter;
      const reps = Array.from({ length: 6 }, (_, i) => ({
        km: 0.8,
        durationSec: Math.round(0.8 * (repPace + i * 1.5 - (i === 5 ? 6 : 0))),
      }));
      const workSec = reps.reduce((s, r) => s + r.durationSec, 0);
      push(dayOf(1), {
        type: "intervals",
        distanceKm: 10.8,
        durationSec: workSec + Math.round(6 * (easyPace + 15)),
        reps,
      });
    }

    push(dayOf(2), {
      type: "easy",
      distanceKm: 7,
      durationSec: Math.round(7 * (easyPace + 5 + jitter)),
    });

    push(dayOf(3), {
      type: "long",
      distanceKm: longKm,
      durationSec: Math.round(longKm * (easyPace + 12 + jitter)),
    });
  }

  // A 10k time trial 3 weeks ago — a strong forecast signal
  push(21, {
    type: "race",
    distanceKm: 10,
    durationSec: 10 * 290, // 48:20
    note: "10k time trial",
  });

  return runs.sort((a, b) => (a.date < b.date ? -1 : 1));
}
