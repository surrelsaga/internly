import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { WeeklyEmail } from '../src/email/email.js';
import { Internship, Week } from '../src/internship/internship.entity.js';
import { Task } from '../src/tasks/task.entity.js';
import { User } from '../src/users/user.entity.js';

describe('weekly email (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let internship: Internship;
  let weeks: Week[];
  const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response('{}', { status: 200 }));
  const sentBodies = () => fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body as string));

  beforeAll(async () => {
    vi.stubGlobal('fetch', fetchMock);
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
    ds = app.get(DataSource);

    const owner = await ds.getRepository(User).findOneByOrFail({ email: process.env.ALLOWED_EMAILS!.split(',')[0].trim().toLowerCase() });
    internship = await ds.getRepository(Internship).save({
      userId: owner.id,
      company: 'Speedback',
      startDate: '2026-10-05',
      endDate: '2026-10-18',
      trackingStartDate: '2026-10-05',
      lastEmailedWeekId: null,
    });
    weeks = await ds.getRepository(Week).save([
      { internshipId: internship.id, number: 1, startDate: '2026-10-05', endDate: '2026-10-11' },
      { internshipId: internship.id, number: 2, startDate: '2026-10-12', endDate: '2026-10-18' },
    ]);
    const task = (title: string, doneWeekId: string | null) =>
      ds.getRepository(Task).save({ internshipId: internship.id, title, createdWeekId: weeks[0].id, doneWeekId });
    await task('ticked in week 1', weeks[0].id);
    await task('ticked in week 2', weeks[1].id);
    await task('still open', null);
    // checked in week 1, then deleted: not in the email
    await ds.getRepository(Task).softDelete((await task('deleted after checking', weeks[0].id)).id);
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await app.close();
  });

  it('catch-up sends exactly once, and a restart sends nothing', async () => {
    const emailer = app.get(WeeklyEmail);
    // Friday 2026-10-09 18:00 Singapore = 10:00 UTC
    await emailer.sendDue(new Date('2026-10-09T09:00:00Z'));
    expect(fetchMock).not.toHaveBeenCalled();

    await emailer.sendDue(new Date('2026-10-09T10:00:00Z'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.resend.com/emails');
    const [mail] = sentBodies();
    expect(mail.to).toBe(process.env.ALLOWED_EMAILS!.split(',')[0].trim().toLowerCase());
    expect(mail.text).toContain('ticked in week 1');
    expect(mail.text).not.toContain('ticked in week 2');
    expect(mail.text).not.toContain('still open');
    expect(mail.text).not.toContain('deleted after checking');
    expect(mail.text).toContain(`/weeks/${weeks[0].id}?tab=reflection`);
    expect((await ds.getRepository(Internship).findOneByOrFail({ id: internship.id })).lastEmailedWeekId).toBe(weeks[0].id);

    // simulated restart (and the cron firing afterwards): nothing more goes out
    await emailer.sendDue(new Date('2026-10-09T10:00:05Z'));
    await emailer.sendDue(new Date('2026-10-11T00:00:00Z'));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // the next Friday sends week 2
    await emailer.sendDue(new Date('2026-10-16T10:00:00Z'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentBodies()[1].text).toContain('ticked in week 2');
  });

  it('a failed send is not marked as sent, so the next run retries', async () => {
    await ds.getRepository(Internship).update(internship.id, { lastEmailedWeekId: null });
    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 500 }));
    const emailer = app.get(WeeklyEmail);
    await emailer.sendDue(new Date('2026-10-09T10:00:00Z'));
    expect((await ds.getRepository(Internship).findOneByOrFail({ id: internship.id })).lastEmailedWeekId).toBeNull();
    await emailer.sendDue(new Date('2026-10-09T10:01:00Z'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
