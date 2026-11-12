// The read-only page behind a share link (/share/<token>/weeks/<id>). No login, nothing editable.
// It reads the live data, so it always shows the latest notes, tasks and reflection.
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EditorContent, useEditor } from '@tiptap/react';
import Image from '@tiptap/extension-image';
import { FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
import StarterKit from '@tiptap/starter-kit';
import { api, ApiError, dayOfWeek, go, longRange, nowWeek, usePath, type Note, type ReflectionData, type SharedInternship, type WeekDetail, type WeekTask } from './api';
import { chipClass } from './NotesPanel';
import { Checkbox, Marker, Masthead, Tape, Wobble } from './ui';
import { REFLECTION, tabClass, tabOrder, WeekDropdown } from './WeekPage';

// While a visitor keeps the page open, changes show up within this long (and on coming back to the tab).
const REFRESH_MS = 30_000;
const msg = 'mx-auto max-w-[1240px] px-8 pt-7 font-hand text-[23px]';

// Fonts, sizes, images and links exactly as written; links open (it isn't an editor here).
function NoteView({ note }: { note: Note }) {
  const editor = useEditor({
    editable: false,
    extensions: [StarterKit.configure({ link: { openOnClick: true } }), Image, TextStyle, FontFamily, FontSize],
    content: note.content,
    editorProps: { attributes: { class: 'note-body min-h-[120px] outline-none', 'aria-label': `Note: ${note.title}` } },
  });
  return (
    <article className="relative pt-2 pb-12">
      <Wobble />
      <div className="px-11 pt-[30px] font-sans [overflow-wrap:anywhere] text-base leading-[1.75]">
        <EditorContent editor={editor} />
      </div>
    </article>
  );
}

function NotesView({ notes, sectionId, sectionName }: { notes: Note[]; sectionId: string; sectionName: string }) {
  const list = notes.filter((n) => n.sectionId === sectionId);
  const [activeId, setActiveId] = useState<string>();
  const note = list.find((n) => n.id === activeId) ?? list[0];
  if (!note) return <p className="font-hand text-[20px] text-ink-mute">No notes in “{sectionName}” this week.</p>;
  return (
    <div>
      <div role="tablist" aria-label="Notes" className="mb-4 flex flex-wrap items-center gap-2.5">
        {list.map((n) => (
          <button key={n.id} type="button" role="tab" aria-selected={n.id === note.id} onClick={() => setActiveId(n.id)} className={chipClass(n.id === note.id)}>
            {n.title || 'untitled'}
          </button>
        ))}
      </div>
      {/* Keyed by updatedAt too, so a refresh that brings a newer version shows it. */}
      <NoteView key={`${note.id}:${note.updatedAt}`} note={note} />
    </div>
  );
}

const fields: { key: keyof ReflectionData; label: string }[] = [
  { key: 'learnt', label: 'What I learnt' },
  { key: 'wentWell', label: 'What went well' },
  { key: 'needHelp', label: 'What I need help with' },
];

function ReflectionView({ reflection }: { reflection: ReflectionData }) {
  return (
    <section aria-labelledby="refl-title" className="relative px-9 pt-9 pb-[34px]">
      <Wobble />
      <h2 id="refl-title" className="font-caveat text-[46px] leading-none font-bold">
        <Marker>reflection</Marker>
      </h2>
      {fields.map((f) => (
        <div key={f.key} className="mt-[30px]">
          <h3 className="font-hand text-[23px]">{f.label}</h3>
          {reflection[f.key].trim() ? (
            <p className="mt-1.5 font-sans text-base leading-[1.75] whitespace-pre-wrap [overflow-wrap:anywhere]">{reflection[f.key]}</p>
          ) : (
            <p className="mt-1.5 font-hand text-[18px] text-ink-mute">nothing yet</p>
          )}
        </div>
      ))}
    </section>
  );
}

function TasksView({ tasks }: { tasks: WeekTask[] }) {
  return (
    <aside aria-labelledby="tasks-title" className="order-first max-w-[340px] min-[901px]:sticky min-[901px]:top-4 min-[901px]:order-none min-[901px]:flex-[1_1_280px] min-[901px]:self-start">
      <div className="relative -rotate-[0.4deg] px-[22px] pt-[34px] pb-[22px]">
        <Wobble />
        <Tape className="-top-[13px] left-1/2 -ml-11 h-[26px] w-[88px] -rotate-[2.5deg] bg-[rgba(196,169,125,0.45)]" />
        <h2 id="tasks-title" className="mb-3 font-caveat text-[42px] leading-none font-bold">
          <Marker>tasks</Marker>
        </h2>
        {tasks.length === 0 && <p className="font-hand text-base text-ink-mute">No tasks this week.</p>}
        {tasks.map((t) => (
          <div key={t.id} className="flex items-start gap-1 border-b-[1.5px] border-dashed border-ink/20 last:border-b-0">
            <Checkbox checked={t.done} label={t.title} />
            <div className="min-w-0 flex-auto py-2.5">
              <span className={`block font-hand text-[19px] leading-tight [overflow-wrap:anywhere] ${t.done ? 'text-ink-mute line-through decoration-ink decoration-2' : 'text-ink'}`}>{t.title}</span>
              {t.fromWeek !== null && <span className="mt-1 inline-block rounded-full border-[1.5px] border-dashed border-ink-mute px-[9px] font-hand text-sm text-ink-mute">from week {t.fromWeek}</span>}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

const notShared = (e: unknown) => e instanceof ApiError && e.status === 404;

export default function SharedPage() {
  const path = usePath();
  const [, token, weekId] = path.match(/^\/share\/([^/]+)(?:\/weeks\/([^/]+))?\/?$/) ?? [];
  const base = `/share/${token}`;
  const shared = useQuery({ queryKey: ['shared', token], queryFn: () => api<SharedInternship>(`/shared/${token}`), refetchInterval: REFRESH_MS, retry: (n, e) => !notShared(e) && n < 3 });
  const week = shared.data?.weeks.find((w) => w.id === weekId);
  const detail = useQuery({
    queryKey: ['shared', token, weekId],
    queryFn: () => api<WeekDetail>(`/shared/${token}/weeks/${weekId}`),
    enabled: !!week,
    refetchInterval: REFRESH_MS,
  });
  const [tab, setTab] = useState(() => new URLSearchParams(location.search).get('tab') ?? '');

  // The bare link opens this week.
  useEffect(() => {
    if (shared.data && !weekId) go(`${base}/weeks/${nowWeek(shared.data.weeks).id}`, true);
  }, [shared.data, weekId, base]);

  const title = shared.data && !notShared(shared.error) ? `${shared.data.name}'s internship at ${shared.data.company}` : '';
  useEffect(() => {
    document.title = title ? `${title} · Intern Log` : 'Intern Log';
  }, [title]);

  const masthead = (
    <Masthead>
      {title && <span className="font-hand text-[19px] text-ink-soft">{title}</span>}
      <span className="rounded-tab bg-highlighter px-4 py-1 font-hand text-[19px]">view only</span>
    </Masthead>
  );

  if (!token || notShared(shared.error))
    return (
      <>
        {masthead}
        <p className={msg}>This link isn't shared right now. Ask the owner for a new one, or to turn sharing back on.</p>
      </>
    );
  if (shared.error) return <>{masthead}<p role="alert" className={msg}>Could not load: {shared.error.message}</p></>;
  if (!shared.data || !weekId) return <>{masthead}<p className={msg}>loading…</p></>;
  if (!week)
    return (
      <>
        {masthead}
        <p className={msg}>
          That week does not exist. <a href={base} onClick={(e) => { e.preventDefault(); go(base); }} className="underline">Open this week</a>
        </p>
      </>
    );

  const s = shared.data;
  const order = tabOrder(s);
  // The chosen tab, if it still exists (it may have been deleted since), else the first.
  const active = order.includes(tab) ? tab : order[0];
  const section = s.sections.find((x) => x.id === active);
  const tasks = detail.data?.tasks ?? [];
  const day = dayOfWeek(week);

  return (
    <>
      {masthead}
      <main className="mx-auto max-w-[1240px] px-8 pt-7">
        <section aria-label="Week" className="flex flex-wrap items-center gap-x-7 gap-y-3.5">
          <WeekDropdown internship={s} week={week} lock={null} base={base} />
          <div className="flex flex-col gap-1">
            <span className="font-hand text-[23px]">{longRange(week)}</span>
            <span className="font-hand text-[17px] text-ink-soft">{day ? `${s.company}, day ${day} of 5` : s.company}</span>
          </div>
          <span className="rounded-tab bg-highlighter px-4 py-1 font-hand text-[19px]">{tasks.filter((t) => t.done).length} of {tasks.length} checked</span>
        </section>

        <div role="tablist" aria-label="Sections" className="mt-[26px] mb-[22px] flex flex-wrap items-center gap-2.5">
          {order.map((id) => (
            <button key={id} type="button" role="tab" aria-selected={id === active} onClick={() => setTab(id)} className={tabClass(id === active)}>
              {id === REFLECTION ? 'reflection' : s.sections.find((x) => x.id === id)!.name}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-9 min-[901px]:flex-row min-[901px]:items-start">
          <div className="min-w-0 min-[901px]:max-w-[820px] min-[901px]:flex-[999_1_560px]">
            {detail.error ? (
              <p role="alert" className="font-hand text-[23px]">Could not load: {detail.error.message}</p>
            ) : !detail.data ? (
              <p className="font-hand text-[23px]">loading…</p>
            ) : section ? (
              <NotesView key={`${week.id}:${section.id}`} notes={detail.data.notes} sectionId={section.id} sectionName={section.name} />
            ) : (
              <ReflectionView reflection={detail.data.reflection} />
            )}
          </div>
          <TasksView tasks={tasks} />
        </div>
      </main>
    </>
  );
}
