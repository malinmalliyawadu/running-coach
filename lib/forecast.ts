import { MARATHON_KM, Run } from "./types";

/**
 * Marathon forecasting model — Tanda (2011).
 *
 * Rather than treating any single run as a race in miniature, Tanda's model
 * reads the training block as a whole. Two indices over the 8 weeks before race
 * day turn out to carry almost all of the predictive signal:
 *
 *   K = mean weekly distance (km/week)
 *   P = mean training pace  (s/km, across every km run)
 *
 * and marathon pace follows from them directly:
 *
 *   marathonPace [s/km] = 17.1 + 140.0 * e^(-0.0053 * K) + 0.55 * P
 *
 * The volume term is the endurance base — it decays steeply, so the first 40
 * km/week buy far more than the last 40 — and the pace term is the runner's
 * underlying speed. Nothing else enters: not the shape of a session, not how
 * the reps were split, not a time trial. That is the model's claim, and the
 * price of it is that a fast standalone effort no longer moves the forecast on
 * its own; only the training it sits inside does.
 *
 * Fitted on well-trained recreational runners logging roughly 40–150 km/week,
 * so the further a log sits below that floor the wider the band we quote.
 */

/** Tanda's fitted coefficients, from his 2011 marathon-prediction paper. */
const TANDA_INTERCEPT = 17.1;
const TANDA_VOLUME_SCALE = 140.0;
const TANDA_VOLUME_DECAY = 0.0053;
const TANDA_PACE_COEFFICIENT = 0.55;

/** Marathon race pace, in seconds per km, from the two training indices. */
export function tandaRacePaceSecPerKm(weeklyKm: number, trainingPaceSecPerKm: number): number {
  return (
    TANDA_INTERCEPT +
    TANDA_VOLUME_SCALE * Math.exp(-TANDA_VOLUME_DECAY * weeklyKm) +
    TANDA_PACE_COEFFICIENT * trainingPaceSecPerKm
  );
}

/** The period the indices are averaged over — Tanda's own window. */
const WINDOW_WEEKS = 8;

// Two indices off a single run are not a training block. Three runs is about a
// week of training, the point where a mean weekly distance starts to mean
// something.
const MIN_RUNS_IN_WINDOW = 3;

// Below this the formula is extrapolating past the runners it was fitted on,
// and below half of it the extrapolation is far enough to distrust outright.
const CALIBRATED_MIN_WEEKLY_KM = 40;
const FAR_BELOW_CALIBRATION_KM = CALIBRATED_MIN_WEEKLY_KM / 2;

// Tanda reproduced his calibration set to within a few minutes; ~2.5% of the
// predicted time is a fair band for a runner the model fits (≈5.5 min on 3:40).
const BASE_SPREAD_SHARE = 0.025;
// Every week of the window with nothing logged is a week the indices are read
// off less evidence, so the band opens.
const SPREAD_PER_UNTRAINED_WEEK = 0.12;

export interface Forecast {
  expectedSec: number;
  optimisticSec: number;
  conservativeSec: number;
  paceSecPerKm: number;
  /** Mean weekly distance over the window — Tanda's volume index. */
  weeklyKm: number;
  /** Mean training pace over the window — Tanda's pace index. */
  trainingPaceSecPerKm: number;
  /** Runs the indices were computed from. */
  runCount: number;
  /** Weeks of the window with any running logged. */
  weeksTrained: number;
  /** Weeks the averages span — from the oldest logged week to now. */
  weeksSpanned: number;
  confidence: "low" | "medium" | "high";
}

function daysBetween(aISO: string, bISO: string): number {
  return (new Date(bISO + "T12:00:00").getTime() - new Date(aISO + "T12:00:00").getTime()) / 86_400_000;
}

export interface TrainingIndices {
  weeklyKm: number;
  paceSecPerKm: number;
  runCount: number;
  weeksTrained: number;
  weeksSpanned: number;
}

/**
 * Tanda's two indices over the 8 weeks before `asOf`.
 *
 * Every logged km counts, at the pace it was actually covered door to door —
 * warm-ups, recovery jogs and all. That is what the model was fitted on, and
 * it is why the forecast reads a block of training rather than a best effort.
 *
 * The averages span only back to the oldest week that has running in it. Weeks
 * before the log begins are unknown, not empty, and dividing by eight of them
 * would read a runner three weeks into a block as barely training. Empty weeks
 * *inside* the log do count as zero: a missed week is real lost load.
 */
export function trainingIndices(runs: Run[], asOf: string): TrainingIndices | null {
  const km = new Array<number>(WINDOW_WEEKS).fill(0);
  const sec = new Array<number>(WINDOW_WEEKS).fill(0);
  const count = new Array<number>(WINDOW_WEEKS).fill(0);

  for (const r of runs) {
    if (r.distanceKm <= 0 || r.durationSec <= 0) continue;
    const daysAgo = daysBetween(r.date, asOf);
    if (daysAgo < 0 || daysAgo >= WINDOW_WEEKS * 7) continue;
    const week = Math.floor(daysAgo / 7);
    km[week] += r.distanceKm;
    sec[week] += r.durationSec;
    count[week] += 1;
  }

  let oldestTrained = -1;
  for (let i = 0; i < WINDOW_WEEKS; i++) if (km[i] > 0) oldestTrained = i;
  if (oldestTrained < 0) return null;

  let totalKm = 0;
  let totalSec = 0;
  let runCount = 0;
  let weeksTrained = 0;
  for (let i = 0; i <= oldestTrained; i++) {
    totalKm += km[i];
    totalSec += sec[i];
    runCount += count[i];
    if (km[i] > 0) weeksTrained++;
  }

  const weeksSpanned = oldestTrained + 1;
  return {
    weeklyKm: totalKm / weeksSpanned,
    paceSecPerKm: totalSec / totalKm,
    runCount,
    weeksTrained,
    weeksSpanned,
  };
}

export function forecastMarathon(runs: Run[], asOf: string): Forecast | null {
  const indices = trainingIndices(runs, asOf);
  if (!indices || indices.runCount < MIN_RUNS_IN_WINDOW) return null;

  const paceSecPerKm = tandaRacePaceSecPerKm(indices.weeklyKm, indices.paceSecPerKm);
  const expectedSec = paceSecPerKm * MARATHON_KM;

  // Thin evidence and mileage below the fitted range both widen the band, and
  // they compound: a short log at low volume is the model at its least sure.
  const untrainedWeeks = WINDOW_WEEKS - indices.weeksTrained;
  const extrapolation =
    1 + Math.max(0, CALIBRATED_MIN_WEEKLY_KM - indices.weeklyKm) / CALIBRATED_MIN_WEEKLY_KM;
  const spread =
    expectedSec *
    BASE_SPREAD_SHARE *
    (1 + untrainedWeeks * SPREAD_PER_UNTRAINED_WEEK) *
    extrapolation;

  // Confidence needs both halves of the evidence: enough weeks of the window
  // logged, and enough volume in them for the formula to be interpolating
  // rather than reaching past the runners it was fitted on.
  const confidence: Forecast["confidence"] =
    indices.weeksTrained >= 6 && indices.weeklyKm >= CALIBRATED_MIN_WEEKLY_KM
      ? "high"
      : indices.weeksTrained >= 4 && indices.weeklyKm >= FAR_BELOW_CALIBRATION_KM
        ? "medium"
        : "low";

  return {
    expectedSec,
    optimisticSec: expectedSec - spread,
    conservativeSec: expectedSec + spread,
    paceSecPerKm,
    weeklyKm: indices.weeklyKm,
    trainingPaceSecPerKm: indices.paceSecPerKm,
    runCount: indices.runCount,
    weeksTrained: indices.weeksTrained,
    weeksSpanned: indices.weeksSpanned,
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
