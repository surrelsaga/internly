// Pure week rules. Days are 'YYYY-MM-DD' strings; weeks are Monday to Sunday.
// Singapore is UTC+8 with no daylight saving, so a fixed offset is enough.

export type WeekSpan = { number: number; startDate: string; endDate: string };

const DAY = 86_400_000;
const toMs = (day: string) => Date.parse(`${day}T00:00:00Z`);
const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function mondayOf(day: string): string {
  const dow = new Date(toMs(day)).getUTCDay(); // 0 = Sunday
  return toDay(toMs(day) - ((dow + 6) % 7) * DAY);
}

// Today's date in Singapore.
export function singaporeDay(now: Date): string {
  return toDay(now.getTime() + 8 * 3_600_000);
}

export function generateWeeks(startDate: string, endDate: string): WeekSpan[] {
  const weeks: WeekSpan[] = [];
  const last = toMs(mondayOf(endDate));
  for (let ms = toMs(mondayOf(startDate)); ms <= last; ms += 7 * DAY) {
    weeks.push({ number: weeks.length + 1, startDate: toDay(ms), endDate: toDay(ms + 6 * DAY) });
  }
  return weeks;
}

// ISO day strings compare correctly as plain strings.
export function currentWeek<T extends { startDate: string; endDate: string }>(weeks: T[], now: Date): T {
  const today = singaporeDay(now);
  return weeks.find((w) => today <= w.endDate) ?? weeks[weeks.length - 1];
}

// The week that must be reflected first, or null. Only last week can lock, and only if tracking had begun by then.
export function lockedWeek<T extends { id: string; startDate: string; endDate: string }>(
  weeks: T[],
  reflections: { weekId: string; learnt: string }[],
  trackingStartDate: string,
  now: Date,
): T | null {
  const last = weeks[weeks.indexOf(currentWeek(weeks, now)) - 1];
  if (!last || last.startDate < trackingStartDate) return null;
  return reflections.some((r) => r.weekId === last.id && r.learnt.trim()) ? null : last;
}
