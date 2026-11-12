import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { Internship, Week } from '../internship/internship.entity.js';
import { currentWeek } from '../internship/weeks.js';
import { weekTasks } from '../tasks/queries.js';
import { ownerEmail, User } from '../users/user.entity.js';

type WeekLike = { id: string; number: number; startDate: string; endDate: string };

const DAY = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDay = (d: string) => `${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

type EmailTask = { title: string; done: boolean; fromWeek: number | null };

const REFLECTION_PARTS = ['What I learnt (required)', 'What went well', 'What I need help with'];

// Pure: the email for one week. `tasks` is that week's list as the app shows it (checked and still open).
export function weeklyEmail({ week, tasks, name, company, appUrl }: { week: WeekLike; tasks: EmailTask[]; name: string; company: string; appUrl: string }) {
  const n = week.number;
  const dates = `${shortDay(week.startDate)} – ${shortDay(week.endDate)}`;
  const link = `${appUrl}/weeks/${week.id}?tab=reflection`;
  const first = name.trim().split(/\s+/)[0] || 'there';
  const done = tasks.filter((t) => t.done);
  const open = tasks.filter((t) => !t.done).map((t) => (t.fromWeek === null ? t.title : `${t.title} (from week ${t.fromWeek})`));

  const subject = `Week ${n} at ${company}: time to write your reflection`;
  const intro =
    `Week ${n} of your internship at ${company} (${dates}) is wrapping up, so it's time to complete your reflection for Week ${n}. ` +
    `It only takes a few minutes, and "What I learnt" is the one part that's required.`;
  const summary = `Here's how the week went: ${done.length} of ${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'} checked off.`;
  // [heading, bullets, line shown when there are none]
  const sections: [string, string[], string][] = [
    ['Checked off:', done.map((t) => t.title), 'Nothing checked off this week.'],
    ['Still open (these carry over to next week):', open, 'Nothing left open, nice work.'],
    ['Your reflection covers:', REFLECTION_PARTS, ''],
  ];

  const text = [
    `Hi ${first},`,
    '',
    intro,
    '',
    summary,
    ...sections.flatMap(([h, items, none]) => ['', h, ...(items.length ? items.map((i) => `- ${i}`) : [none])]),
    '',
    `Write your reflection: ${link}`,
    '',
    'Best regards,',
    'Intern Log',
  ].join('\n');

  // Inline styles only: most email clients drop <style> blocks and web fonts.
  const p = 'margin:0 0 16px';
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#2A2520;max-width:560px">` +
    `<p style="${p}">Hi ${esc(first)},</p>` +
    `<p style="${p}">${esc(intro)}</p>` +
    `<p style="${p}">${esc(summary)}</p>` +
    sections
      .map(
        ([h, items, none]) =>
          `<p style="margin:0 0 4px"><strong>${esc(h)}</strong></p>` +
          (items.length ? `<ul style="margin:0 0 16px;padding-left:22px">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : `<p style="${p}">${esc(none)}</p>`),
      )
      .join('') +
    `<p style="margin:24px 0 8px"><a href="${esc(link)}" style="display:inline-block;background:#FFE066;color:#2A2520;text-decoration:none;font-weight:bold;padding:10px 20px;border-radius:999px;border:2px solid #2A2520">Write your Week ${n} reflection</a></p>` +
    `<p style="margin:0 0 24px;font-size:13px;color:#6B6359">Or open this link: <a href="${esc(link)}" style="color:#4A6FA5">${esc(link)}</a></p>` +
    `<p style="margin:0">Best regards,<br>Intern Log</p>` +
    `</div>`;
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
    const tasks = await weekTasks(this.ds, week);
    await this.email.send(user.email, weeklyEmail({ week, tasks, name: user.name, company: internship.company, appUrl: process.env.APP_URL ?? '' }));
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
    const user = await this.ds.getRepository(User).findOneByOrFail({ email: ownerEmail() });
    const internship = await this.ds.getRepository(Internship).findOneBy({ userId: user.id });
    if (!internship) throw new Error(`Owner ${user.email} has no internship yet; set one up in the app first`);
    const weeks = await this.ds.getRepository(Week).find({ where: { internshipId: internship.id } });
    await this.mailFor(internship, currentWeek(weeks, now));
  }
}
