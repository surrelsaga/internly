import { weekToCatchUp, weeklyEmail } from './email.js';

const w1 = { id: 'w1', number: 1, startDate: '2026-10-05', endDate: '2026-10-11' };
const w2 = { id: 'w2', number: 2, startDate: '2026-10-12', endDate: '2026-10-18' };

describe('weeklyEmail', () => {
  it('has the week, its dates, the ticked tasks and the reflection link', () => {
    const m = weeklyEmail(w1, ['Ship login', 'Fix <b>bug</b>'], 'https://app.test');
    expect(m.subject).toContain('Week 1');
    for (const part of [m.subject, m.text, m.html]) expect(part).toMatch(/5 Oct/);
    expect(m.text).toContain('- Ship login');
    expect(m.text).toContain('https://app.test/weeks/w1?tab=reflection');
    expect(m.html).toContain('href="https://app.test/weeks/w1?tab=reflection"');
    expect(m.html).toContain('Fix &lt;b&gt;bug&lt;/b&gt;');
  });

  it('lists only the titles it is given', () => {
    // the caller passes tasks ticked in this week only; open or other-week tasks never reach the template
    const m = weeklyEmail(w2, ['Done in week 2'], 'https://app.test');
    expect(m.text).toContain('Done in week 2');
    expect(m.text).not.toContain('Done in week 1');
    expect(weeklyEmail(w2, [], 'https://app.test').text).toContain('Nothing ticked off');
  });
});

describe('weekToCatchUp', () => {
  const weeks = [w1, w2];
  // Friday 2026-10-16 18:00 Singapore = 10:00 UTC
  it('returns nothing for this week before Friday 18:00 Singapore time', () => {
    expect(weekToCatchUp([w2], null, new Date('2026-10-16T09:59:59Z'))).toBeNull();
  });

  it('returns this week after Friday 18:00', () => {
    expect(weekToCatchUp(weeks, 'w1', new Date('2026-10-16T10:00:00Z'))).toBe(w2);
  });

  it('returns the most recent past week when several were missed', () => {
    expect(weekToCatchUp(weeks, null, new Date('2026-10-20T00:00:00Z'))).toBe(w2);
  });

  it('returns null when that week was already emailed', () => {
    expect(weekToCatchUp(weeks, 'w2', new Date('2026-10-20T00:00:00Z'))).toBeNull();
  });
});
