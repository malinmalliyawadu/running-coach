import { MARATHON_KM, Run, RunType } from "./types";

/**
 * Marathon forecasting model.
 *
 * Each run is converted to an "equivalent flat-out race effort" at its distance
 * (easy runs are run well below race effort, so we credit them a margin), then
 * projected to marathon distance with Riegel's formula T2 = T1 * (D2/D1)^k.
 *
 * The Riegel exponent k is adapted to weekly volume: low-mileage runners fade
 * more over the marathon distance than the classic 1.06 predicts.
 *
 * Runs are weighted by recency (half-life ~45 days), distance relevance, and
 * how reliable the run type is as a fitness signal.
 */

// How much faster the runner could have covered that distance at race effort.
// estimatedRaceTime = duration * factor
const EFFORT_FACTOR: Record<RunType, number> = {
  race: 1.0,
  tempo: 0.97,
  long: 0.92,
  easy: 0.9,
  intervals: 1.0, // excluded via weight; avg pace incl. recovery is unreliable
};

const TYPE_RELIABILITY: Record<RunType, number> = {
  race: 1.0,
  tempo: 0.7,
  long: 0.6,
  easy: 0.35,
  intervals: 0,
};

const RECENCY_HALF_LIFE_DAYS = 45;

export interface Forecast {
  expectedSec: number;
  optimisticSec: number;
  conservativeSec: number;
  paceSecPerKm: number;
  sampleSize: number; // runs contributing meaningful weight
  exponent: number;
  confidence: "low" | "medium" | "high";
}

function daysBetween(aISO: string, bISO: string): number {
  return (new Date(bISO + "T12:00:00").getTime() - new Date(aISO + "T12:00:00").getTime()) / 86_400_000;
}

/** Average weekly km over the 6 weeks before `asOf`. */
export function weeklyVolumeKm(runs: Run[], asOf: string): number {
  const windowDays = 42;
  const total = runs
    .filter((r) => {
      const d = daysBetween(r.date, asOf);
      return d >= 0 && d <= windowDays;
    })
    .reduce((sum, r) => sum + r.distanceKm, 0);
  return total / 6;
}

/** Riegel exponent adapted to training volume: 1.10 at ≤30 km/wk down to 1.05 at ≥80 km/wk. */
function riegelExponent(weeklyKm: number): number {
  const k = 1.1 - ((weeklyKm - 30) * 0.05) / 50;
  return Math.min(1.1, Math.max(1.05, k));
}

function equivalentMarathonSec(run: Run, exponent: number): number {
  const raceTimeSec = run.durationSec * EFFORT_FACTOR[run.type];
  return raceTimeSec * Math.pow(MARATHON_KM / run.distanceKm, exponent);
}

function runWeight(run: Run, asOf: string): number {
  const daysAgo = daysBetween(run.date, asOf);
  if (daysAgo < 0) return 0;
  const recency = Math.pow(0.5, daysAgo / RECENCY_HALF_LIFE_DAYS);
  // Longer runs say more about marathon fitness; a 5k says less than a 30k.
  const distanceRelevance = Math.min(1, Math.pow(run.distanceKm / 21.1, 0.7));
  return recency * distanceRelevance * TYPE_RELIABILITY[run.type];
}

export function forecastMarathon(runs: Run[], asOf: string): Forecast | null {
  const eligible = runs.filter(
    (r) => r.distanceKm >= 3 && r.durationSec > 0 && daysBetween(r.date, asOf) >= 0
  );
  if (eligible.length === 0) return null;

  const weeklyKm = weeklyVolumeKm(eligible, asOf);
  const exponent = riegelExponent(weeklyKm);

  const weighted = eligible
    .map((r) => ({ eq: equivalentMarathonSec(r, exponent), w: runWeight(r, asOf) }))
    .filter((x) => x.w > 0.001);
  if (weighted.length === 0) return null;

  const totalW = weighted.reduce((s, x) => s + x.w, 0);
  const mean = weighted.reduce((s, x) => s + x.eq * x.w, 0) / totalW;
  const variance = weighted.reduce((s, x) => s + x.w * Math.pow(x.eq - mean, 2), 0) / totalW;
  const sigma = Math.sqrt(variance);

  // Effective sample size — many low-weight runs count less than a few strong signals.
  const ess = Math.pow(totalW, 2) / weighted.reduce((s, x) => s + x.w * x.w, 0);

  // Spread blends observed scatter with a floor of model uncertainty (~2.5%),
  // shrinking as the evidence base grows.
  const baseUncertainty = mean * 0.025;
  const spread = Math.max(sigma * 0.8, baseUncertainty) / Math.sqrt(Math.min(ess, 9) / 2);

  const confidence: Forecast["confidence"] = ess >= 6 ? "high" : ess >= 3 ? "medium" : "low";

  return {
    expectedSec: mean,
    optimisticSec: mean - spread,
    conservativeSec: mean + spread,
    paceSecPerKm: mean / MARATHON_KM,
    sampleSize: Math.round(ess),
    exponent,
    confidence,
  };
}

export interface TrendPoint {
  date: string;
  expectedSec: number;
  optimisticSec: number;
  conservativeSec: number;
}

/** Forecast recomputed at each run date — how the projection has evolved over training. */
export function forecastTrend(runs: Run[]): TrendPoint[] {
  const dates = [...new Set(runs.map((r) => r.date))].sort();
  const points: TrendPoint[] = [];
  for (const date of dates) {
    const f = forecastMarathon(runs, date);
    if (f) {
      points.push({
        date,
        expectedSec: f.expectedSec,
        optimisticSec: f.optimisticSec,
        conservativeSec: f.conservativeSec,
      });
    }
  }
  return points;
}
