import { useSyncExternalStore } from 'react';

export type Week = { id: string; number: number; startDate: string; endDate: string; reflected: boolean };
// ponytail: the lock is enforced in the frontend only. One person's own journal, so no server-side check.
export type CurrentWeek = Week & { locked: boolean };
export type Internship = {
  id: string;
  company: string;
  startDate: string;
  endDate: string;
  trackingStartDate: string;
  weeks: Week[];
};

export type Me = { id: string; email: string; name: string };
export type WeekTask = { id: string; title: string; done: boolean; fromWeek: number | null };
export type ReflectionData = { learnt: string; wentWell: string; needHelp: string };
export type NoteType = 'dev' | 'research';
export type Note = { id: string; type: NoteType; title: string; content: object; position: number };
export type WeekDetail = Week & { tasks: WeekTask[]; reflection: ReflectionData; notes: Note[] };

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<T> {
  const res = await fetch(`/api${path}`, { method, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  if (!res.ok) {
    if (res.status === 401 && location.pathname !== '/login') go('/login', true);
    const data = await res.json().catch(() => null);
    const msg = data?.message;
    throw new ApiError(res.status, Array.isArray(msg) ? msg.join(', ') : (msg ?? res.statusText));
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

// Uploads an image to Cloudinary through the API and returns its URL.
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/uploads/image', { method: 'POST', body: form });
  if (!res.ok) throw new ApiError(res.status, res.statusText);
  return (await res.json()).url;
}

// ponytail: a hand-rolled router, because there are only two routes. Add react-router if more arrive.
export function go(path: string, replace = false) {
  history[replace ? 'replaceState' : 'pushState'](null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function usePath() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('popstate', cb);
      return () => window.removeEventListener('popstate', cb);
    },
    () => location.pathname,
  );
}

// Days are 'YYYY-MM-DD'. Singapore is UTC+8 all year.
export const todaySg = () => new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);

const fmt = (day: string, opts: Intl.DateTimeFormatOptions) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
export const shortDay = (day: string) => fmt(day, { day: 'numeric', month: 'short' });
const withWeekday = (day: string) => `${fmt(day, { weekday: 'short' })} ${shortDay(day)}`;
export const longRange = (w: Week) => `${withWeekday(w.startDate)} to ${withWeekday(w.endDate)} ${w.endDate.slice(0, 4)}`;

// Same rule as the API's currentWeek: first week not yet over, else the last.
export const nowWeek = (weeks: Week[]) => weeks.find((w) => todaySg() <= w.endDate) ?? weeks[weeks.length - 1];

// 1 to 5 for Mon to Fri; the weekend counts as day 5. Null if today is outside the week.
export function dayOfWeek(w: Week, today = todaySg()) {
  if (today < w.startDate || today > w.endDate) return null;
  return Math.min(5, ((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7) + 1);
}
