import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, dayOfWeek, go, longRange, nowWeek, shortDay, type Internship, type ReflectionData, type Section, type Week, type WeekDetail } from './api';
import NotesPanel from './NotesPanel';
import { REFINE_HINT, RefineButton, RefinePanel, useRefine } from './Refine';
import TasksRail from './TasksRail';
import { dashedBtn, Marker, Tape, Wobble } from './ui';

// A section id, or the reflection tab.
type Tab = string;
const REFLECTION = 'reflection';
const tabClass = (on: boolean) => `min-h-12 rounded-tab border-0 px-6 font-hand text-[23px] text-ink ${on ? 'bg-highlighter' : 'swipe bg-transparent'}`;

// Note tabs and reflection share one position scale; this is every tab id in display order.
const tabOrder = (i: Pick<Internship, 'sections' | 'reflectionPosition'>) =>
  [...i.sections.map((s) => ({ id: s.id, p: s.position })), { id: REFLECTION, p: i.reflectionPosition }].sort((a, b) => a.p - b.p).map((t) => t.id);

// The user's tabs (reflection among them), then "+ new tab". Click the open tab (or double-click any) to rename it,
// × to delete it, drag to reorder.
function TabBar({ internship, tab, setTab }: { internship: Internship; tab: Tab; setTab: (t: Tab) => void }) {
  const { sections } = internship;
  const order = tabOrder(internship);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ id: string; draft: string } | null>(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const cancelled = useRef(false);
  // The tab being dragged, and the order before the drag (to detect a change and to undo a failed save).
  const drag = useRef<{ id: string; before: string[] } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const setSections = (f: (s: Section[]) => Section[]) => qc.setQueryData<Internship>(['internship'], (d) => d && { ...d, sections: f(d.sections) });
  // Puts the tabs in this order (positions become indexes; only the relative order matters).
  const setOrder = (ids: string[]) =>
    qc.setQueryData<Internship>(['internship'], (d) => {
      if (!d) return d;
      const sections = d.sections.map((s) => ({ ...s, position: ids.indexOf(s.id) })).sort((a, b) => a.position - b.position);
      return { ...d, sections, reflectionPosition: ids.indexOf(REFLECTION) };
    });
  const rename = (s: Section) => {
    cancelled.current = false;
    setError('');
    setEditing({ id: s.id, draft: s.name });
  };

  const save = async () => {
    const e = editing;
    setEditing(null);
    const old = sections.find((s) => s.id === e?.id);
    const name = e?.draft.trim();
    if (cancelled.current || !old || !name || name === old.name) return;
    const named = (n: string) => setSections((ss) => ss.map((s) => (s.id === old.id ? { ...s, name: n } : s)));
    named(name);
    try {
      await api(`/sections/${old.id}`, { name }, 'PATCH');
    } catch {
      named(old.name);
      setError('could not rename the tab, try again');
    }
  };

  const add = async () => {
    setError('');
    setAdding(true);
    try {
      const s = await api<Section>('/sections', { name: 'untitled' });
      setSections((ss) => [...ss, s]);
      setTab(s.id);
      rename(s);
    } catch {
      setError('could not add a tab, try again');
    }
    setAdding(false);
  };

  // An empty tab goes straight away. One with notes in any week asks first, since they go with it.
  const remove = async (s: Section) => {
    setError('');
    const failed = () => setError('could not delete the tab, try again');
    try {
      await api(`/sections/${s.id}`, undefined, 'DELETE');
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 409)) return failed();
      if (!window.confirm(`${e.message} Delete “${s.name}” and all of them?`)) return;
      try {
        await api(`/sections/${s.id}?force=true`, undefined, 'DELETE');
      } catch {
        return failed();
      }
    }
    setSections((ss) => ss.filter((x) => x.id !== s.id));
    if (tab === s.id) setTab(order.find((id) => id !== s.id && id !== REFLECTION) ?? REFLECTION);
  };

  // Moves the dragged tab into the hovered tab's place once the pointer passes its middle, so wide tabs don't flicker back and forth.
  const dragOver = (e: DragEvent, overId: string) => {
    const d = drag.current;
    if (!d || overId === d.id) return;
    const from = order.indexOf(d.id);
    const to = order.indexOf(overId);
    const r = e.currentTarget.getBoundingClientRect();
    if (from < to ? e.clientX < r.left + r.width / 2 : e.clientX > r.left + r.width / 2) return;
    const next = [...order];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setOrder(next);
  };

  // Dropped outside the tab bar (or Escape) puts it back; otherwise the new order is saved.
  const dragEnd = async (e: DragEvent) => {
    const d = drag.current;
    drag.current = null;
    setDragging(null);
    if (!d) return;
    if (e.dataTransfer.dropEffect === 'none') return setOrder(d.before);
    if (order.join() === d.before.join()) return;
    try {
      await api('/tabs/order', { ids: order }, 'PUT');
    } catch {
      setOrder(d.before);
      setError('could not move the tab, try again');
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Sections"
      // the whole bar is a drop zone, so letting go between tabs keeps the new order
      onDragOver={(e) => drag.current && e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
      className="mt-[26px] mb-[22px] flex flex-wrap items-center gap-2.5"
    >
      {order.map((id) => {
        // The wrapper is what drags, for every tab (reflection too), open or not.
        const draggable = {
          draggable: true,
          onDragStart: (e: DragEvent) => {
            e.dataTransfer.setData('text/plain', id); // Firefox won't start a drag without data
            e.dataTransfer.effectAllowed = 'move';
            drag.current = { id, before: order };
            setDragging(id);
          },
          onDragOver: (e: DragEvent) => dragOver(e, id),
          onDragEnd: (e: DragEvent) => void dragEnd(e),
        };
        if (id === REFLECTION) {
          return (
            <span key={id} {...draggable} className={dragging === id ? 'opacity-40' : ''}>
              <button type="button" role="tab" aria-selected={tab === REFLECTION} title="drag to move" onClick={() => setTab(REFLECTION)} className={`${tabClass(tab === REFLECTION)} cursor-grab active:cursor-grabbing`}>
                reflection<span aria-hidden="true" className="text-redpen"> *</span>
              </button>
            </span>
          );
        }
        const s = sections.find((x) => x.id === id)!;
        return editing?.id === s.id ? (
          // The invisible copy of the text sets the width, so the box fits the name exactly and grows as you type.
          <span key={s.id} className="inline-grid">
            <span aria-hidden="true" className={`${tabClass(true)} invisible col-start-1 row-start-1 whitespace-pre`}>
              {editing.draft || ' '}
            </span>
            <input
              aria-label="Tab name"
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              value={editing.draft}
              maxLength={40}
              onChange={(e) => setEditing({ id: s.id, draft: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') {
                  cancelled.current = true;
                  e.currentTarget.blur();
                }
              }}
              onBlur={() => void save()}
              size={1}
              className={`${tabClass(true)} col-start-1 row-start-1 w-0 min-w-full outline-2 outline-ink`}
            />
          </span>
        ) : (
          <span
            key={s.id}
            {...draggable}
            className={`group relative ${dragging === s.id ? 'opacity-40' : ''}`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === s.id}
              title={tab === s.id ? 'click to rename, drag to move' : 'double-click to rename, drag to move'}
              onClick={() => (tab === s.id ? rename(s) : setTab(s.id))}
              onDoubleClick={() => rename(s)}
              className={`${tabClass(tab === s.id)} cursor-grab active:cursor-grabbing`}
            >
              {s.name}
            </button>
            {/* Always on the open tab (so phones can reach it); on hover or focus for the rest. */}
            <button
              type="button"
              aria-label={`Delete tab “${s.name}”`}
              title="delete tab"
              onClick={() => void remove(s)}
              // 24px hit area (fine for touch), 16px badge you see
              className={`group/del absolute -top-2 -right-2 size-6 items-center justify-center border-0 bg-transparent p-0 text-ink ${tab === s.id ? 'flex' : 'hidden group-focus-within:flex group-hover:flex'}`}
            >
              <span className="flex size-4 items-center justify-center rounded-full bg-paper shadow-[0_0_0_1.5px_#2A2520] group-hover/del:bg-redpen group-hover/del:text-paper">
                <svg width="7" height="7" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                  <path d="M1.5 1.5 L6.5 6.5 M6.5 1.5 L1.5 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </span>
            </button>
          </span>
        );
      })}
      <button type="button" disabled={adding} onClick={() => void add()} className={`min-h-12 rounded-tab px-5 text-[21px] ${dashedBtn}`}>
        + new tab
      </button>
      {error && <span role="alert" className="font-hand text-[17px] text-redpen">{error}</span>}
    </div>
  );
}

function WeekDropdown({ internship, week, lock }: { internship: Internship; week: Week; lock: Week | null }) {
  const [open, setOpen] = useState(false);
  const nowId = nowWeek(internship.weeks).id;
  const off = (w: Week) => !!lock && w.number > lock.number;
  return (
    <div className="relative">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)} className="nudge flex min-h-[60px] items-center gap-2.5 border-0 bg-transparent px-2 text-ink">
        <span className="font-caveat text-[64px] leading-none font-bold">Week {week.number}</span>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-3.5">
          <path d="M5 9 L12 16 L19 9" stroke="#2A2520" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <svg width="200" height="12" viewBox="0 0 240 14" fill="none" aria-hidden="true" className="-mt-0.5 ml-2 block">
        <path d="M4 9 C 40 2, 78 14, 120 7 S 196 4, 236 9" stroke="#2A2520" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {open && (
        <div role="listbox" aria-label="Choose a week" className="absolute top-[76px] left-0 z-20 w-[300px] rounded-card bg-card p-2.5 shadow-[0_0_0_2px_#2A2520,4px_6px_0_rgba(42,37,32,0.15)]">
          {internship.weeks.map((w) => (
            <a
              key={w.id}
              href={`/weeks/${w.id}`}
              role="option"
              aria-selected={w.id === week.id}
              aria-disabled={off(w)}
              onClick={(e) => {
                e.preventDefault();
                if (off(w)) return;
                setOpen(false);
                go(`/weeks/${w.id}`);
              }}
              className={`flex min-h-12 items-center gap-3 rounded-chip px-3 py-1 text-ink no-underline ${w.id === nowId ? 'bg-highlighter' : ''} ${off(w) ? 'cursor-not-allowed opacity-40' : ''}`}
            >
              <span className="flex-none basis-[76px] font-hand text-[20px]">Week {w.number}</span>
              <span className="flex-1 font-hand text-base text-ink-soft">{shortDay(w.startDate)} to {shortDay(w.endDate)}</span>
              {w.endDate < internship.trackingStartDate && <span className="font-hand text-sm text-ink-mute">backfill</span>}
              {w.reflected && <span aria-label="reflected" className="font-hand text-[20px]">✓</span>}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

const fields: { key: keyof ReflectionData; label: string; required?: boolean; placeholder: string }[] = [
  { key: 'learnt', label: 'What I learnt', required: true, placeholder: 'The one thing you now know that you did not on Monday' },
  { key: 'wentWell', label: 'What went well', placeholder: 'Something you would do the same way again' },
  { key: 'needHelp', label: 'What I need help with', placeholder: 'What is unclear, blocked or worth asking about' },
];

type Status = 'idle' | 'saving' | 'saved' | 'error';
const statusText = { idle: '', saving: 'saving…', saved: 'saved', error: 'could not save, will retry' };

function ReflectionField({ f, value, locked, onChange }: { f: (typeof fields)[number]; value: string; locked: boolean; onChange: (v: string) => void }) {
  const r = useRefine();
  return (
    <div className="mt-[30px]">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <label htmlFor={`refl-${f.key}`} className="font-hand text-[23px]">
          {locked && f.required ? <Marker>{f.label}</Marker> : f.label}
          {f.required && <span aria-hidden="true" className="ml-1 text-[28px] text-redpen">*</span>}
        </label>
        <RefineButton label={`Refine ${f.label}`} busy={r.busy} disabled={!value.trim()} onClick={() => void r.run(value)} />
      </div>
      <textarea id={`refl-${f.key}`} rows={3} placeholder={f.placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="lined mt-1.5 block min-h-24 w-full resize-y rounded-none border-0 px-1.5 font-sans text-base text-ink" />
      <RefinePanel
        suggestion={r.suggestion}
        error={r.error}
        onAccept={() => {
          onChange(r.suggestion ?? value);
          r.clear();
        }}
        onDiscard={r.clear}
      />
    </div>
  );
}

function Reflection({ week, initial, locked }: { week: Week; initial: ReflectionData; locked: boolean }) {
  const qc = useQueryClient();
  const [values, setValues] = useState(initial);
  const [status, setStatus] = useState<Status>('idle');
  // Fields typed since the last save, and the pending debounce timer.
  const pending = useRef<Partial<ReflectionData>>({});
  const timer = useRef<number | undefined>(undefined);

  const flush = async () => {
    window.clearTimeout(timer.current);
    const body = pending.current;
    if (!Object.keys(body).length) return;
    pending.current = {};
    setStatus('saving');
    try {
      await api(`/weeks/${week.id}/reflection`, body, 'PUT');
      if ('learnt' in body) qc.invalidateQueries({ queryKey: ['internship'] });
      setStatus(Object.keys(pending.current).length ? 'saving' : 'saved');
    } catch (e) {
      pending.current = { ...body, ...pending.current };
      setStatus('error');
      // Network errors and 5xx (e.g. a dropped database connection) retry on their own.
      if (!(e instanceof ApiError) || e.status >= 500) timer.current = window.setTimeout(flush, 3000);
    }
  };
  // Leaving the tab or week, or closing/reloading the page, saves what's still waiting.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    const onHide = () => void flushRef.current();
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      void flushRef.current();
    };
  }, []);

  const change = (key: keyof ReflectionData, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    pending.current[key] = value;
    // keep the cached week current, so leaving and coming back to this tab shows what was typed
    qc.setQueryData<WeekDetail>(['week', week.id], (d) => d && { ...d, reflection: { ...d.reflection, [key]: value } });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 800);
  };

  return (
    <section aria-labelledby="refl-title" className="relative px-9 pt-9 pb-[34px]">
      <Wobble />
      <div className="flex flex-wrap items-start justify-between gap-[22px]">
        <div className="flex-[1_1_260px]">
          <h2 id="refl-title" className="font-caveat text-[46px] leading-none font-bold">
            <Marker>reflection</Marker>
          </h2>
          <p className="mt-2.5 font-hand text-[18px] text-ink-soft">
            Saves as you type. <span role="status" aria-live="polite">{statusText[status]}</span>
          </p>
          <p className="mt-1 font-hand text-base text-ink-mute">{REFINE_HINT}</p>
        </div>
        <div className="relative w-[260px] max-w-full rotate-2 rounded-[3px_3px_14px_3px] bg-highlighter px-[18px] pt-5 pb-4 font-hand text-[18px] leading-[1.35]">
          <Tape className="-top-2.5 left-1/2 -ml-[30px] h-5 w-[60px] -rotate-4 bg-[rgba(196,169,125,0.5)]" />
          Friday 6pm: reminder email. Week {week.number} stays locked until <span className="text-[#b83a2c]">What I learnt</span> is written.
        </div>
      </div>
      {fields.map((f) => (
        <ReflectionField key={f.key} f={f} locked={locked} value={values[f.key]} onChange={(v) => change(f.key, v)} />
      ))}
    </section>
  );
}

export default function WeekPage({ internship, week, lock }: { internship: Internship; week: Week; lock: Week | null }) {
  const day = dayOfWeek(week);
  const locked = lock?.id === week.id;
  // ?tab=reflection opens that tab (the Friday email links there); a locked week always does
  const sections = internship.sections;
  const [tab, setTab] = useState<Tab>(() => (locked || new URLSearchParams(location.search).get('tab') === REFLECTION ? REFLECTION : (sections[0]?.id ?? REFLECTION)));
  const section = sections.find((s) => s.id === tab);
  const detail = useQuery({ queryKey: ['week', week.id], queryFn: () => api<WeekDetail>(`/weeks/${week.id}`) });
  const tasks = detail.data?.tasks ?? [];
  // lives here so the chosen note (by id) survives a trip to the reflection tab
  const [active, setActive] = useState<Record<string, string>>({});
  return (
    <main className="mx-auto max-w-[1240px] px-8 pt-7">
      <section aria-label="Week" className="flex flex-wrap items-center gap-x-7 gap-y-3.5">
        <WeekDropdown internship={internship} week={week} lock={lock} />
        <div className="flex flex-col gap-1">
          <span className="font-hand text-[23px]">{longRange(week)}</span>
          <span className="font-hand text-[17px] text-ink-soft">{day ? `${internship.company}, day ${day} of 5` : internship.company}</span>
        </div>
        <span className="rounded-tab bg-highlighter px-4 py-1 font-hand text-[19px]">{tasks.filter((t) => t.done).length} of {tasks.length} checked</span>
      </section>

      {locked && (
        <p role="alert" className="mt-4 font-hand text-[23px] text-redpen">
          Write your reflection to continue. Week {week.number} needs “What I learnt” before you move on.
        </p>
      )}

      <TabBar internship={internship} tab={tab} setTab={setTab} />

      <div className="flex flex-col gap-9 min-[901px]:flex-row min-[901px]:items-start">
        <div className="min-w-0 min-[901px]:max-w-[820px] min-[901px]:flex-[999_1_560px]">
          {!detail.data ? (
            <p className="font-hand text-[23px]">loading…</p>
          ) : section ? (
            <NotesPanel weekId={week.id} section={section} notes={detail.data.notes} activeId={active[tab]} setActiveId={(id) => setActive({ ...active, [tab]: id })} />
          ) : (
            <Reflection week={week} initial={detail.data.reflection} locked={locked} />
          )}
        </div>
        <TasksRail week={week} tasks={tasks} />
      </div>
    </main>
  );
}
