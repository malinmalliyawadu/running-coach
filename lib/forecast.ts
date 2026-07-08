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

/**
 * Recency-weighted weekly volume over the 6 weeks before `asOf`.
 *
 * A flat mean (total ÷ 6) badly understates a runner mid-ramp: when most of the
 * km sit in the last week or two, the near-empty early weeks halve the average
 * and the model reads a far smaller endurance base than the runner actually has.
 * Instead each week is weighted by recency (10-day half-life) so the figure
 * tracks current training load, and the average spans only from the first run in
 * the window — weeks before the block began don't dilute it.
 */
export function weeklyVolumeKm(runs: Run[], asOf: string): number {
  const WEEKS = 6;
  const WEEK_DECAY = Math.pow(0.5, 7 / 10); // 10-day half-life, applied per week
  const km = new Array<number>(WEEKS).fill(0);
  for (const r of runs) {
    const d = daysBetween(r.date, asOf);
    if (d < 0 || d >= WEEKS * 7) continue;
    km[Math.floor(d / 7)] += r.distanceKm;
  }

  let lastActive = -1;
  for (let i = 0; i < WEEKS; i++) if (km[i] > 0) lastActive = i;
  if (lastActive < 0) return 0;

  let num = 0;
  let den = 0;
  for (let i = 0; i <= lastActive; i++) {
    const w = Math.pow(WEEK_DECAY, i);
    num += km[i] * w;
    den += w;
  }
  return num / den;
}

/**
 * Riegel exponent adapted to training volume: more mileage means less fade over
 * the marathon distance. Slopes smoothly from 1.10 at ≤12 km/wk down to 1.05 at
 * ≥80 km/wk — the old curve was flat at 1.10 below 30 km/wk, a dead zone that
 * gave a 28 km/wk runner the same fade penalty as a 10 km/wk one.
 */
function riegelExponent(weeklyKm: number): number {
  const k = 1.1 - ((weeklyKm - 12) * 0.05) / 68;
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

export interface ProjectionPoint {
  date: string;
  projectedSec: number;
}

// Fit weights favour the recent trajectory; the taper flattens the projected
// improvement because fitness gains slow as training accumulates.
const PROJECTION_FIT_HALF_LIFE_DAYS = 28;
const PROJECTION_TAPER_HALF_LIFE_DAYS = 42;

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + days);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Extends the forecast trend from the latest forecast to race day.
 *
 * A recency-weighted least-squares line through the trend gives the current
 * rate of improvement; the extrapolation decays that rate exponentially rather
 * than running it straight to race day, since a straight line would credit a
 * runner mid-ramp with months of their current (unsustainable) gains.
 * Anchored at the last real forecast so the projected line joins the trend.
 * Returns weekly points ending exactly on race day; empty when race day is not
 * after the last forecast or the trend is too short to fit a slope.
 */
export function projectTrend(trend: TrendPoint[], raceDateISO: string): ProjectionPoint[] {
  if (trend.length < 2) return [];
  const last = trend[trend.length - 1];
  const horizonDays = daysBetween(last.date, raceDateISO);
  if (horizonDays <= 0) return [];

  let sw = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const p of trend) {
    const x = daysBetween(last.date, p.date); // 0 or negative
    const w = Math.pow(0.5, -x / PROJECTION_FIT_HALF_LIFE_DAYS);
    sw += w;
    sx += w * x;
    sy += w * p.expectedSec;
    sxx += w * x * x;
    sxy += w * x * p.expectedSec;
  }
  const det = sw * sxx - sx * sx;
  if (det <= 0) return []; // all trend points on one day — no slope to fit
  const slopeSecPerDay = (sw * sxy - sx * sy) / det;

  const tau = PROJECTION_TAPER_HALF_LIFE_DAYS / Math.LN2;
  const gain = (days: number) => slopeSecPerDay * tau * (1 - Math.exp(-days / tau));

  const points: ProjectionPoint[] = [{ date: last.date, projectedSec: last.expectedSec }];
  for (let t = 7; t < horizonDays; t += 7) {
    points.push({ date: addDaysISO(last.date, t), projectedSec: last.expectedSec + gain(t) });
  }
  points.push({ date: raceDateISO, projectedSec: last.expectedSec + gain(horizonDays) });
  return points;
}
