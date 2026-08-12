export function formatDuration(totalSec: number): string {
  const sec = Math.round(totalSec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatPace(secPerKm: number): string {
  if (!isFinite(secPerKm) || secPerKm <= 0) return "–";
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * How a runner would say a rep set out loud — "6 × 800 m", "4 × 2 km". Null
 * when the reps are mixed lengths and there is no shorthand for them.
 */
export function formatRepSet(reps: { km: number }[]): string | null {
  if (reps.length === 0) return null;
  const first = reps[0].km;
  if (!reps.every((r) => Math.abs(r.km - first) < 0.001)) return null;
  const metres = Math.round(first * 1000);
  const length = metres >= 1000 && metres % 1000 === 0 ? `${metres / 1000} km` : `${metres} m`;
  return `${reps.length} × ${length}`;
}

/** Parses "47:30", "1:42:05", "95" (minutes) into seconds. Returns null if invalid. */
export function parseDuration(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":").map((p) => p.trim());
  if (parts.some((p) => p === "" || !/^\d+(\.\d+)?$/.test(p))) return null;
  const nums = parts.map(Number);
  if (nums.length === 1) return Math.round(nums[0] * 60); // minutes
  if (nums.length === 2) return Math.round(nums[0] * 60 + nums[1]);
  if (nums.length === 3) return Math.round(nums[0] * 3600 + nums[1] * 60 + nums[2]);
  return null;
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
}

export function formatDateLong(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
