import { EmailService, WeeklyEmail, weekToCatchUp, weeklyEmail } from './email.js';

const w1 = { id: 'w1', number: 1, startDate: '2026-10-05', endDate: '2026-10-11' };
const w2 = { id: 'w2', number: 2, startDate: '2026-10-12', endDate: '2026-10-18' };

describe('sendNow', () => {
  it('explains when the owner has no internship', async () => {
    const repo = { findOneByOrFail: async () => ({ id: 'owner', email: 'me@example.com' }), findOneBy: async () => null };
    const ds = { getRepository: () => repo } as any;
    vi.stubEnv('ALLOWED_EMAILS', 'me@example.com');
    try {
      await expect(new WeeklyEmail(ds, new EmailService()).sendNow()).rejects.toThrow('Owner me@example.com has no internship yet; set one up in the app first');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('weeklyEmail', () => {
  const base = { name: 'Daniel Nguyen', company: 'Speedback', appUrl: 'https://app.test' };
  const tasks = [
    { title: 'Ship login', done: true, fromWeek: null },
    { title: 'Fix <b>bug</b>', done: true, fromWeek: null },
    { title: 'Read docs', done: false, fromWeek: null },
    { title: 'Flaky test', done: false, fromWeek: 1 },
  ];

  it('greets, asks for the reflection, lists checked and open tasks, and signs off', () => {
    const m = weeklyEmail({ ...base, week: w2, tasks });
    expect(m.subject).toBe('Week 2 at Speedback: time to write your reflection');
    expect(m.text).toMatch(/^Hi Daniel,/);
    expect(m.text).toContain('complete your reflection for Week 2');
    expect(m.text).toContain('12 Oct – 18 Oct');
    expect(m.text).toContain('2 of 4 tasks checked off');
    expect(m.text).toContain('Checked off:\n- Ship login\n- Fix <b>bug</b>');
    expect(m.text).toContain('Still open (these carry over to next week):\n- Read docs\n- Flaky test (from week 1)');
    expect(m.text).toContain('- What I learnt (required)');
    expect(m.text).toContain('https://app.test/weeks/w2?tab=reflection');
    expect(m.text).toMatch(/Best regards,\nIntern Log$/);
    expect(m.html).toContain('href="https://app.test/weeks/w2?tab=reflection"');
    expect(m.html).toContain('<li>Fix &lt;b&gt;bug&lt;/b&gt;</li>');
    expect(m.html).toContain('Best regards,<br>Intern Log');
  });

  it('says so when a list is empty', () => {
    const m = weeklyEmail({ ...base, week: w1, tasks: [] });
    expect(m.text).toContain('Nothing checked off this week.');
    expect(m.text).toContain('Nothing left open, nice work.');
    expect(m.text).toContain('0 of 0 tasks');
  });

  it('escapes the name and company in the html', () => {
    const m = weeklyEmail({ ...base, name: '<Dan>', company: 'A&B', week: w1, tasks });
    expect(m.html).toContain('Hi &lt;Dan&gt;,');
    expect(m.html).toContain('A&amp;B');
    expect(m.html).not.toContain('<Dan>');
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
