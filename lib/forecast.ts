import { isQualityType, loggedQualitySegment, MARATHON_KM, Run, RunType } from "./types";

/**
 * Marathon forecasting model.
 *
 * Each run is reduced to the stretch that actually carries a fitness signal —
 * for a quality session that is the tempo block or the reps, not the warm-up,
 * cool-down and recovery jogs wrapped around them (see `workSegment`). That
 * stretch is converted to an "equivalent flat-out race effort" at its distance
 * (easy runs are run well below race effort, so we credit them a margin), then
 * projected to marathon distance with Riegel's formula T2 = T1 * (D2/D1)^k.
 *
 * The Riegel exponent k is adapted to weekly volume: low-mileage runners fade
 * more over the marathon distance than the classic 1.06 predicts.
 *
 * Runs are weighted by recency (half-life ~45 days), distance relevance, and
 * how reliable the run type is as a fitness signal.
 */

// How much faster the runner could have covered the work segment at race
// effort. estimatedRaceTime = segmentDuration * factor
const EFFORT_FACTOR: Record<RunType, number> = {
  race: 1.0,
  tempo: 0.97,
  long: 0.92,
  easy: 0.9,
  // Reps split by recoveries are run faster than the same total distance in one
  // unbroken effort, so a continuous race over it would be *slower* than the
  // reps add up to — the only factor above 1.
  intervals: 1.05,
};

const TYPE_RELIABILITY: Record<RunType, number> = {
  race: 1.0,
  tempo: 0.7,
  long: 0.6,
  // Short fast reps extrapolate to the marathon less surely than a threshold
  // block, but with the recoveries stripped out they are a real signal — this
  // was 0 back when the whole diluted session was all the model had to go on.
  intervals: 0.5,
  easy: 0.35,
};

// An inferred work segment is a reading of a typical session, not a measurement,
// so it counts for less than one the runner actually logged.
const INFERRED_SEGMENT_DISCOUNT = 0.7;

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

/**
 * Typical easy-jog pace as of `asOf`, learned from easy and long runs and
 * weighted by recency. It is what the warm-up, cool-down and recovery jogs
 * inside a quality session get priced at. Null when the log has nothing easy
 * to learn it from.
 */
function easyPaceSecPerKm(runs: Run[], asOf: string): number | null {
  let num = 0;
  let den = 0;
  for (const r of runs) {
    if (r.type !== "easy" && r.type !== "long") continue;
    if (r.distanceKm <= 0 || r.durationSec <= 0) continue;
    const daysAgo = daysBetween(r.date, asOf);
    if (daysAgo < 0) continue;
    const w = Math.pow(0.5, daysAgo / RECENCY_HALF_LIFE_DAYS);
    num += (r.durationSec / r.distanceKm) * w;
    den += w;
  }
  return den > 0 ? num / den : null;
}

export interface WorkSegment {
  km: number;
  durationSec: number;
  /** False when the split was inferred rather than logged by the runner. */
  logged: boolean;
}

// A session's warm-up and cool-down: the plan prescribes 2 km either side, but
// cap it as a share of the session so a short one isn't stripped to nothing.
const WARMUP_COOLDOWN_KM = 4;
const WARMUP_COOLDOWN_MAX_SHARE = 0.3;
// 8 × 800 m hard with 400 m jog recoveries — the plan's default rep session —
// leaves a third of the non-warm-up distance in the recoveries.
const RECOVERY_SHARE = 1 / 3;
// Riegel from a shorter stretch than this extrapolates too far to be worth much.
const MIN_SEGMENT_KM = 1.5;
// Easy jogging sits roughly 22% per km off the pace of the work it surrounds.
// Used to split a session when the log has no easy runs to calibrate against.
const JOG_TO_WORK_PACE_RATIO = 1.22;
// Faster than this share of easy pace and the implied work is not believable —
// the entry is most likely the reps alone, with no jogging folded into it.
const FASTEST_BELIEVABLE_WORK_SHARE_OF_EASY = 0.62;

/** Distance in a quality session spent jogging rather than working. */
function jogDistanceKm(run: Run): number {
  const warmupCooldown = Math.min(WARMUP_COOLDOWN_KM, run.distanceKm * WARMUP_COOLDOWN_MAX_SHARE);
  if (run.type !== "intervals") return warmupCooldown;
  return warmupCooldown + (run.distanceKm - warmupCooldown) * RECOVERY_SHARE;
}

/**
 * The part of a run that says something about race fitness.
 *
 * Easy, long and race efforts are continuous, so that is the whole run. A
 * quality session is not: its total lumps a fast tempo block or set of reps in
 * with the jogging either side and, for intervals, the recoveries in between —
 * an average pace that belongs to no part of the session. Taking that average
 * at face value reads a tempo run as a mediocre continuous effort and made
 * interval sessions unusable altogether.
 *
 * Preference order: the runner's own logged split, then the jogging priced out
 * at their easy pace, then — with no easy runs to calibrate against — a split
 * that assumes the usual gap between jog and work pace.
 */
export function workSegment(run: Run, easyPaceSec: number | null): WorkSegment {
  const whole = { km: run.distanceKm, durationSec: run.durationSec, logged: true };
  if (!isQualityType(run.type)) return whole;

  const logged = loggedQualitySegment(run);
  if (logged) return { ...logged, logged: true };

  const jogKm = jogDistanceKm(run);
  const km = run.distanceKm - jogKm;
  // Too short to split meaningfully — read it as one continuous effort, which
  // for a rep session is the conservative reading.
  if (km < MIN_SEGMENT_KM) return { ...whole, logged: false };

  if (easyPaceSec != null) {
    const durationSec = run.durationSec - jogKm * easyPaceSec;
    const workPace = durationSec / km;
    const believable =
      durationSec > 0 &&
      workPace >= easyPaceSec * FASTEST_BELIEVABLE_WORK_SHARE_OF_EASY &&
      workPace < easyPaceSec;
    // When the split comes out unbelievable the session wasn't shaped the way
    // we assumed — either the entry is the work alone with the jogging already
    // left off, or nothing in it was run harder than a jog. Either way the
    // honest reading is one continuous effort over the whole entry.
    return believable ? { km, durationSec, logged: false } : { ...whole, logged: false };
  }

  // Nothing easy in the log to price the jogging against, so lean on the usual
  // gap between jog and work pace. Self-consistent by construction: it can only
  // ever read the work as faster than the session average, never slower.
  const workPace = run.durationSec / (jogKm * JOG_TO_WORK_PACE_RATIO + km);
  return { km, durationSec: km * workPace, logged: false };
}

function equivalentMarathonSec(run: Run, segment: WorkSegment, exponent: number): number {
  const raceTimeSec = segment.durationSec * EFFORT_FACTOR[run.type];
  return raceTimeSec * Math.pow(MARATHON_KM / segment.km, exponent);
}

function runWeight(run: Run, segment: WorkSegment, asOf: string): number {
  const daysAgo = daysBetween(run.date, asOf);
  if (daysAgo < 0) return 0;
  if (segment.km < MIN_SEGMENT_KM) return 0;
  const recency = Math.pow(0.5, daysAgo / RECENCY_HALF_LIFE_DAYS);
  // Longer efforts say more about marathon fitness; a 5k says less than a 30k.
  const distanceRelevance = Math.min(1, Math.pow(segment.km / 21.1, 0.7));
  const certainty = segment.logged ? 1 : INFERRED_SEGMENT_DISCOUNT;
  return recency * distanceRelevance * TYPE_RELIABILITY[run.type] * certainty;
}

export function forecastMarathon(runs: Run[], asOf: string): Forecast | null {
  const eligible = runs.filter(
    (r) => r.distanceKm >= 3 && r.durationSec > 0 && daysBetween(r.date, asOf) >= 0
  );
  if (eligible.length === 0) return null;

  const weeklyKm = weeklyVolumeKm(eligible, asOf);
  const exponent = riegelExponent(weeklyKm);
  const easyPace = easyPaceSecPerKm(eligible, asOf);

  const weighted = eligible
    .map((r) => {
      const segment = workSegment(r, easyPace);
      return { eq: equivalentMarathonSec(r, segment, exponent), w: runWeight(r, segment, asOf) };
    })
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
