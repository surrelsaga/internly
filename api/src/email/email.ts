import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { Internship, Week } from '../internship/internship.entity.js';
import { currentWeek } from '../internship/weeks.js';
import { Task } from '../tasks/task.entity.js';
import { User } from '../users/user.entity.js';

type WeekLike = { id: string; number: number; startDate: string; endDate: string };

const DAY = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDay = (d: string) => `${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Pure: the email for one week. `done` is the titles ticked in that week, nothing else.
export function weeklyEmail(week: WeekLike, done: string[], appUrl: string) {
  const dates = `${shortDay(week.startDate)} – ${shortDay(week.endDate)}`;
  const link = `${appUrl}/weeks/${week.id}?tab=reflection`;
  const subject = `Week ${week.number} (${dates}): time to reflect`;
  const intro = `Week ${week.number}, ${dates}. Here is what you ticked off:`;
  const none = 'Nothing ticked off this week.';
  const text = [intro, '', ...(done.length ? done.map((t) => `- ${t}`) : [none]), '', `Write your reflection: ${link}`].join('\n');
  const html =
    `<p>${intro}</p>` +
    (done.length ? `<ul>${done.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : `<p>${none}</p>`) +
    `<p><a href="${esc(link)}">Write your reflection</a></p>`;
  return { subject, text, html };
}

// Pure: the most recent week whose Friday 18:00 Singapore time has passed, unless it was already emailed.
export function weekToCatchUp<T extends WeekLike>(weeks: T[], lastEmailedWeekId: string | null, now: Date): T | null {
  const fridayEvening = (w: T) => Date.parse(`${w.startDate}T18:00:00+08:00`) + 4 * DAY;
  const due = weeks.filter((w) => fridayEvening(w) <= now.getTime()).sort((a, b) => b.number - a.number)[0];
  return due && due.id !== lastEmailedWeekId ? due : null;
}

// The only place that sends email.
@Injectable()
export class EmailService {
  async send(to: string, mail: { subject: string; html: string; text: string }) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to, ...mail }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  }
}

@Injectable()
export class WeeklyEmail {
  private log = new Logger(WeeklyEmail.name);

  constructor(
    private ds: DataSource,
    private email: EmailService,
  ) {}

  private async mailFor(internship: Internship, week: Week) {
    const user = await this.ds.getRepository(User).findOneByOrFail({ id: internship.userId });
    const tasks = await this.ds.getRepository(Task).find({ where: { doneWeekId: week.id }, order: { createdAt: 'ASC' } });
    await this.email.send(user.email, weeklyEmail(week, tasks.map((t) => t.title), process.env.APP_URL ?? ''));
  }

  // Friday 6pm Singapore: the week that just ended its working week. Same rule as the startup catch-up.
  @Cron('0 18 * * 5', { timeZone: 'Asia/Singapore' })
  async sendDue(now = new Date()) {
    for (const internship of await this.ds.getRepository(Internship).find()) {
      try {
        const weeks = await this.ds.getRepository(Week).find({ where: { internshipId: internship.id } });
        // Weeks before tracking began are backfill: no email for those.
        const week = weekToCatchUp(weeks.filter((w) => w.startDate >= internship.trackingStartDate), internship.lastEmailedWeekId, now);
        if (!week) continue;
        await this.mailFor(internship, week);
        await this.ds.getRepository(Internship).update(internship.id, { lastEmailedWeekId: week.id });
      } catch (err) {
        this.log.error(`weekly email failed: ${err}`);
      }
    }
  }

  // For the owner's manual check. Does not set lastEmailedWeekId, so Friday's email still goes out.
  async sendNow(now = new Date()) {
    for (const internship of await this.ds.getRepository(Internship).find()) {
      const weeks = await this.ds.getRepository(Week).find({ where: { internshipId: internship.id } });
      await this.mailFor(internship, currentWeek(weeks, now));
    }
  }
}
