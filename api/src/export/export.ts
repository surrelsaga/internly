import { Controller, Get, NotFoundException, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DataSource, In } from 'typeorm';
import { CurrentUser } from '../auth/current-user.js';
import { Internship, Week } from '../internship/internship.entity.js';
import { singaporeDay } from '../internship/weeks.js';
import { Note, Section } from '../notes/note.entity.js';
import { Reflection } from '../reflection/reflection.entity.js';
import { internshipTasks, taskRows } from '../tasks/queries.js';
import { tasksForWeek, type TaskRow } from '../tasks/tasks.js';
import { User } from '../users/user.entity.js';

// A TipTap JSON node, as the note editor saves it.
type Node = { type?: string; text?: string; attrs?: Record<string, unknown>; marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: Node[] };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const day = (d: string) => `${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;
const weekday = (d: string) => `${DAYS[new Date(`${d}T00:00:00Z`).getUTCDay()]} ${day(d)}`;
const longDay = (d: string) => `${day(d)} ${d.slice(0, 4)}`;

function inline(nodes: Node[] = []): string {
  return nodes
    .map((n) => {
      if (n.type === 'hardBreak') return '  \n';
      if (n.type === 'image') return `![${n.attrs?.alt ?? ''}](${n.attrs?.src ?? ''})`;
      if (n.type !== 'text') return inline(n.content);
      let s = n.text ?? '';
      const has = (t: string) => n.marks?.some((m) => m.type === t);
      if (has('code')) s = `\`${s}\``;
      if (has('bold')) s = `**${s}**`;
      if (has('italic')) s = `*${s}*`;
      if (has('strike')) s = `~~${s}~~`;
      const link = n.marks?.find((m) => m.type === 'link');
      if (link) s = `[${s}](${link.attrs?.href ?? ''})`;
      // textStyle (font, size) and underline have no Markdown form; the text stays.
      return s;
    })
    .join('');
}

const indent = (s: string, pad: string) => s.replace(/\n(?=.)/g, `\n${pad}`);

// One block (and everything inside it) as Markdown. `shift` pushes headings down a level each (they sit under a note title).
function block(n: Node, shift: number): string {
  switch (n.type) {
    case 'paragraph':
      // A Tab indent at a line start would make Markdown read it as code, so it becomes non-breaking spaces.
      return inline(n.content).replace(/^\t+/gm, (t) => '\u00a0'.repeat(4 * t.length));
    case 'heading':
      return `${'#'.repeat(Math.min(6, Number(n.attrs?.level ?? 1) + shift))} ${inline(n.content)}`;
    case 'bulletList':
    case 'orderedList':
      return (n.content ?? [])
        .map((item, i) => {
          const marker = n.type === 'orderedList' ? `${Number(n.attrs?.start ?? 1) + i}.` : '-';
          // A list item's blocks: the first sits on the marker line, the rest (nested lists) indent under it.
          const body = (item.content ?? []).map((b) => block(b, shift)).join('\n');
          return body.trim() ? `${marker} ${indent(body, ' '.repeat(marker.length + 1))}` : '';
        })
        .filter(Boolean)
        .join('\n');
    case 'blockquote':
      return blocks(n.content, shift).replace(/^/gm, '> ');
    case 'codeBlock':
      return `\`\`\`${n.attrs?.language ?? ''}\n${inline(n.content)}\n\`\`\``;
    case 'horizontalRule':
      return '---';
    case 'image':
      return inline([n]);
    default:
      return blocks(n.content, shift);
  }
}

const blocks = (nodes: Node[] = [], shift: number) =>
  nodes
    .map((n) => block(n, shift))
    .filter((s) => s.trim())
    .join('\n\n');

// A note's TipTap JSON as Markdown.
export const tiptapToMd = (doc: Node, shift = 0) => blocks(doc.content, shift);

const REFLECTION = 'reflection';
const REFLECTION_FIELDS = [
  ['learnt', 'What I learnt'],
  ['wentWell', 'What went well'],
  ['needHelp', 'What I need help with'],
] as const;

type ExportData = {
  internship: Pick<Internship, 'company' | 'startDate' | 'endDate' | 'reflectionPosition'>;
  weeks: Pick<Week, 'id' | 'number' | 'startDate' | 'endDate'>[];
  sections: Pick<Section, 'id' | 'name' | 'position'>[];
  tasks: TaskRow[];
  reflections: Pick<Reflection, 'weekId' | 'learnt' | 'wentWell' | 'needHelp'>[];
  notes: Pick<Note, 'weekId' | 'sectionId' | 'title' | 'content' | 'position'>[];
  now: Date;
};

// Pure: the whole internship as one Markdown file. Weeks that haven't started are left out, and so is anything empty.
export function exportMarkdown({ internship, weeks, sections, tasks, reflections, notes, now }: ExportData) {
  const today = singaporeDay(now);
  // Same order as the tab bar: sections and reflection share one position scale.
  const tabs = [...sections.map((s) => ({ id: s.id, name: s.name, p: s.position })), { id: REFLECTION, name: 'Reflection', p: internship.reflectionPosition }].sort((a, b) => a.p - b.p);
  const out = [`# Intern log: ${internship.company}`, `${longDay(internship.startDate)} to ${longDay(internship.endDate)} · exported ${longDay(today)}`];

  for (const w of [...weeks].sort((a, b) => a.number - b.number).filter((x) => x.startDate <= today)) {
    out.push(`## Week ${w.number} · ${weekday(w.startDate)} to ${weekday(w.endDate)} ${w.endDate.slice(0, 4)}`);
    const list = tasksForWeek(tasks, w.number);
    if (list.length) out.push('### Tasks', list.map((t) => `- [${t.done ? 'x' : ' '}] ${t.title}${t.fromWeek === null ? '' : ` (from week ${t.fromWeek})`}`).join('\n'));

    for (const tab of tabs) {
      if (tab.id === REFLECTION) {
        const r = reflections.find((x) => x.weekId === w.id);
        const parts = REFLECTION_FIELDS.filter(([k]) => r?.[k].trim()).map(([k, label]) => `**${label}**\n\n${r![k].trim()}`);
        if (parts.length) out.push('### Reflection', ...parts);
        continue;
      }
      const mine = notes
        .filter((n) => n.weekId === w.id && n.sectionId === tab.id)
        .sort((a, b) => a.position - b.position)
        // Headings inside a note sit below the note title (####), so # becomes #####.
        .map((n) => ({ title: n.title || 'untitled', body: tiptapToMd(n.content as Node, 4) }))
        // A blank note nobody named is noise; a named one is kept, even empty.
        .filter((n) => n.body || n.title !== 'untitled');
      if (!mine.length) continue;
      out.push(`### ${tab.name}`);
      for (const n of mine) out.push(`#### ${n.title}`, ...(n.body ? [n.body] : []));
    }
  }
  return `${out.join('\n\n')}\n`;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'internship';

@Controller('export')
export class ExportController {
  constructor(private ds: DataSource) {}

  // The whole internship as a Markdown download. Reads only.
  // ponytail: images stay Cloudinary links; if those files are deleted, the export's images break too.
  @Get()
  async export(@CurrentUser() user: User, @Res({ passthrough: true }) res: Response) {
    const internship = await this.ds.getRepository(Internship).findOneBy({ userId: user.id });
    if (!internship) throw new NotFoundException();
    const weeks = await this.ds.getRepository(Week).findBy({ internshipId: internship.id });
    const weekIds = In(weeks.map((w) => w.id));
    const now = new Date();
    const md = exportMarkdown({
      internship,
      weeks,
      sections: await this.ds.getRepository(Section).findBy({ internshipId: internship.id }),
      tasks: taskRows(weeks, await internshipTasks(this.ds, internship.id)),
      reflections: await this.ds.getRepository(Reflection).findBy({ weekId: weekIds }),
      notes: await this.ds.getRepository(Note).findBy({ weekId: weekIds }),
      now,
    });
    res.attachment(`intern-log-${slug(internship.company)}-${singaporeDay(now)}.md`);
    res.type('text/markdown; charset=utf-8');
    return md;
  }
}
