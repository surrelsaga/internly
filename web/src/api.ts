import { useSyncExternalStore } from 'react';

export type Week = { id: string; number: number; startDate: string; endDate: string };
export type Internship = {
  id: string;
  company: string;
  startDate: string;
  endDate: string;
  trackingStartDate: string;
  weeks: Week[];
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const msg = data?.message;
    throw new ApiError(res.status, Array.isArray(msg) ? msg.join(', ') : (msg ?? res.statusText));
  }
  return res.json();
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
export const longRange = (w: Week) => `${fmt(w.startDate, { weekday: 'short', day: 'numeric', month: 'short' })} to ${fmt(w.endDate, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}`;

// 1 to 5 for Mon to Fri; the weekend counts as day 5. Null if today is outside the week.
export function dayOfWeek(w: Week, today = todaySg()) {
  if (today < w.startDate || today > w.endDate) return null;
  return Math.min(5, ((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7) + 1);
}
