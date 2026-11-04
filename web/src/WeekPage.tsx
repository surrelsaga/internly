import { useState, type FormEvent } from 'react';
import { devNotes, reflectionFields, researchNotes, tasks as fakeTasks, weeks, type Block, type Task } from './fake';
import { Checkbox, Marker, Tape, Wobble } from './ui';

type Tab = 'dev' | 'research' | 'reflection';

const tabs: { id: Tab; label: string }[] = [
  { id: 'dev', label: 'dev notes' },
  { id: 'research', label: 'research notes' },
  { id: 'reflection', label: 'reflection' },
];

const dashedBtn = 'border-[1.5px] border-dashed border-ink-mute bg-transparent font-hand text-ink-soft';

function WeekDropdown() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-[60px] items-center gap-2.5 border-0 bg-transparent px-2 text-ink">
        <span className="font-caveat text-[64px] leading-none font-bold">Week 5</span>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-3.5">
          <path d="M5 9 L12 16 L19 9" stroke="#2A2520" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <svg width="200" height="12" viewBox="0 0 240 14" fill="none" aria-hidden="true" className="-mt-0.5 ml-2 block">
        <path d="M4 9 C 40 2, 78 14, 120 7 S 196 4, 236 9" stroke="#2A2520" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {open && (
        <div role="listbox" aria-label="Choose a week" className="absolute top-[76px] left-0 z-20 w-[300px] rounded-card bg-card p-2.5 shadow-[0_0_0_2px_#2A2520,4px_6px_0_rgba(42,37,32,0.15)]">
          {weeks.map((w) => (
            <a
              key={w.n}
              href="#top"
              role="option"
              aria-selected={w.state === 'now'}
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
              }}
              className={`flex min-h-12 items-center gap-3 rounded-chip px-3 py-1 text-ink no-underline ${w.state === 'now' ? 'bg-highlighter' : ''}`}
            >
              <span className="flex-none basis-[76px] font-hand text-[20px]">Week {w.n}</span>
              <span className="flex-1 font-hand text-base text-ink-soft">{w.dates}</span>
              {w.state === 'done' && <span aria-label="reflected" className="text-[18px]">✓</span>}
              {w.state === 'empty' && <span className="font-hand text-sm text-ink-mute">backfill</span>}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

const toolBtn = 'flex size-11 items-center justify-center rounded-[9px] border-[1.5px] border-ink/55 bg-transparent p-0 text-ink';

function Toolbar() {
  return (
    <div className="sticky top-0 z-[5] flex flex-wrap items-center justify-between gap-2.5 rounded-t-[14px_10px] border-b-[1.5px] border-dashed border-ink/35 bg-paper/95 px-7 py-3">
      <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-2">
        <button type="button" aria-label="Bold" className={`${toolBtn} font-sans text-[17px] font-medium`}>B</button>
        <button type="button" aria-label="Italic" className={`${toolBtn} font-sans text-[17px] italic`}>I</button>
        <button type="button" aria-label="Add link" className={toolBtn}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M10 14 a4 4 0 0 0 5.7 0 l3-3 a4 4 0 0 0 -5.7 -5.7 l-1 1 M14 10 a4 4 0 0 0 -5.7 0 l-3 3 a4 4 0 0 0 5.7 5.7 l1 -1" stroke="#2A2520" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button type="button" aria-label="Add image" className={toolBtn}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="4.5" width="18" height="15" rx="2.5" stroke="#2A2520" strokeWidth="1.9" />
            <circle cx="9" cy="10" r="1.8" stroke="#2A2520" strokeWidth="1.7" />
            <path d="M4 17 L9.5 12.5 L13 15.5 L16 13 L20.5 17" stroke="#2A2520" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button type="button" aria-label="Bulleted list" className={toolBtn}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="5" cy="7" r="1.3" fill="#2A2520" />
            <circle cx="5" cy="12" r="1.3" fill="#2A2520" />
            <circle cx="5" cy="17" r="1.3" fill="#2A2520" />
            <path d="M10 7 H20 M10 12 H20 M10 17 H20" stroke="#2A2520" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <span className="font-hand text-[17px] text-ink-soft">saved 2 min ago</span>
    </div>
  );
}

function BlockView({ b }: { b: Block }) {
  switch (b.k) {
    case 'h':
      return <h3 className="mt-[26px] mb-2 font-caveat text-[32px] leading-[1.1] font-bold">{b.text}</h3>;
    case 'p':
      return <p className="mb-3.5">{b.text}</p>;
    case 'li':
      return (
        <div className="mb-1.5 flex gap-3 pl-1.5">
          <span aria-hidden="true">•</span>
          <span className="min-w-0 flex-auto">{b.text}</span>
        </div>
      );
    case 'code':
      return <pre className="mt-1.5 mb-4 overflow-x-auto rounded-lg bg-code px-[18px] py-3.5 font-[ui-monospace,Menlo,monospace] text-sm leading-[1.6]">{b.text}</pre>;
    case 'img':
      return (
        <div className="mt-2 mb-[18px] flex h-[190px] max-w-full items-center justify-center rounded-lg border-[1.5px] border-ink/35 bg-img">
          <span className="font-hand text-[18px] text-ink-soft">{b.text}</span>
        </div>
      );
  }
}

type Active = Record<'dev' | 'research', number>;

function Notes({ tab, active, setActive }: { tab: 'dev' | 'research'; active: Active; setActive: (a: Active) => void }) {
  const list = tab === 'dev' ? devNotes : researchNotes;
  const note = list[active[tab]];
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        {list.map((n, i) => {
          const on = i === active[tab];
          return (
            <button
              key={n.title}
              type="button"
              aria-pressed={on}
              onClick={() => setActive({ ...active, [tab]: i })}
              className={`min-h-11 rounded-chip border-0 px-[18px] font-hand text-[20px] text-ink ${on ? 'bg-highlighter' : 'bg-transparent shadow-[inset_0_0_0_1.5px_rgba(42,37,32,0.45)]'}`}
            >
              {n.title}
            </button>
          );
        })}
        <button type="button" className={`min-h-11 rounded-full px-4 text-[19px] ${dashedBtn}`}>+ new note</button>
      </div>
      <article className="relative pb-14">
        <Wobble />
        <Toolbar />
        <div className="px-11 pt-[30px] font-sans [overflow-wrap:anywhere] text-base leading-[1.75]">
          <h2 className="mb-[18px] font-caveat text-[48px] leading-[1.05] font-bold">{note.title}</h2>
          {note.blocks.map((b, i) => (
            <BlockView key={i} b={b} />
          ))}
          <p className="mt-[26px] font-hand text-[18px] text-ink-mute">keep typing here. The page just gets longer, there is no box to scroll.</p>
        </div>
      </article>
    </div>
  );
}

function Reflection() {
  return (
    <section aria-labelledby="refl-title" className="relative px-9 pt-9 pb-[34px]">
      <Wobble />
      <div className="flex flex-wrap items-start justify-between gap-[22px]">
        <div className="flex-[1_1_260px]">
          <h2 id="refl-title" className="font-caveat text-[46px] leading-none font-bold">
            <Marker>reflection</Marker>
          </h2>
          <p className="mt-2.5 font-hand text-[18px] text-ink-soft">Saves as you type.</p>
        </div>
        <div className="relative w-[260px] max-w-full rotate-2 rounded-[3px_3px_14px_3px] bg-highlighter px-[18px] pt-5 pb-4 font-hand text-[18px] leading-[1.35]">
          <Tape className="-top-2.5 left-1/2 -ml-[30px] h-5 w-[60px] -rotate-4 bg-[rgba(196,169,125,0.5)]" />
          Friday 6pm: reminder email. Week 6 stays locked until <span className="text-[#b83a2c]">What I learnt</span> is written.
        </div>
      </div>
      {reflectionFields.map((f) => (
        <div key={f.id} className="mt-[30px]">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <label htmlFor={f.id} className="font-hand text-[23px]">
              {f.label}
              {f.required && <span aria-hidden="true" className="ml-1 text-[28px] text-redpen">*</span>}
            </label>
            {/* ponytail: does nothing until step 10 */}
            <button type="button" aria-label="Refine the wording of this field" className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[17px] ${dashedBtn}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 20 L5 15 L16.5 3.5 a2.1 2.1 0 0 1 3 3 L8 18 Z M14.5 5.5 L18.5 9.5" stroke="#4A4540" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              refine
            </button>
          </div>
          <textarea id={f.id} rows={3} placeholder={f.placeholder} defaultValue={f.value} className="lined mt-1.5 block min-h-24 w-full resize-y rounded-none border-0 px-1.5 font-sans text-base text-ink" />
        </div>
      ))}
    </section>
  );
}

function TasksRail({ tasks, setTasks }: { tasks: Task[]; setTasks: (t: Task[]) => void }) {
  const [title, setTitle] = useState('');
  const toggle = (id: number) => setTasks(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const add = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    setTasks([...tasks, { id: Date.now(), title: t, from: 0, done: false }]);
    setTitle('');
  };
  return (
    <aside aria-labelledby="tasks-title" className="order-first max-w-[340px] min-[901px]:sticky min-[901px]:top-4 min-[901px]:order-none min-[901px]:flex-[1_1_280px] min-[901px]:self-start">
      <div className="relative -rotate-[0.4deg] px-[22px] pt-[34px] pb-[22px]">
        <Wobble />
        <Tape className="-top-[13px] left-1/2 -ml-11 h-[26px] w-[88px] -rotate-[2.5deg] bg-[rgba(196,169,125,0.45)]" />
        <h2 id="tasks-title" className="mb-1 font-caveat text-[42px] leading-none font-bold">
          <Marker>tasks</Marker>
        </h2>
        <p className="mt-1.5 mb-3 font-hand text-base text-ink-soft">Unticked ones move to next week.</p>
        {tasks.map((t) => (
          <div key={t.id} className="flex items-start gap-1 border-b-[1.5px] border-dashed border-ink/20">
            <Checkbox checked={t.done} label={t.title} onToggle={() => toggle(t.id)} />
            <div className="min-w-0 flex-auto py-2.5">
              <span className={`block font-hand text-[19px] leading-tight ${t.done ? 'text-ink-mute line-through decoration-ink decoration-2' : 'text-ink'}`}>{t.title}</span>
              {t.from > 0 && <span className="mt-1 inline-block rounded-full border-[1.5px] border-dashed border-ink-mute px-[9px] font-hand text-sm text-ink-mute">from week {t.from}</span>}
            </div>
          </div>
        ))}
        <form onSubmit={add} className="mt-4 flex flex-wrap items-center gap-2.5">
          <label htmlFor="new-task" className="sr-only">New task</label>
          <input
            id="new-task"
            type="text"
            placeholder="add a task"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="min-h-11 min-w-0 flex-[1_1_120px] rounded-none border-0 border-b-2 border-ink bg-transparent px-1 py-1.5 font-hand text-[19px] text-ink"
          />
          <button type="submit" className="min-h-11 rounded-btn border-0 bg-ink px-5 font-hand text-[19px] text-paper">add</button>
        </form>
      </div>
    </aside>
  );
}

export default function WeekPage() {
  const [tab, setTab] = useState<Tab>('dev');
  const [tasks, setTasks] = useState<Task[]>(fakeTasks);
  // lives here so the chosen note survives a trip to the reflection tab
  const [active, setActive] = useState<Active>({ dev: 0, research: 0 });
  return (
    <main className="mx-auto max-w-[1240px] px-8 pt-7">
      <section aria-label="Week" className="flex flex-wrap items-center gap-x-7 gap-y-3.5">
        <WeekDropdown />
        <div className="flex flex-col gap-1">
          <span className="font-hand text-[23px]">Mon 2 Nov to Sun 8 Nov 2026</span>
          <span className="font-hand text-[17px] text-ink-soft">Speedback, day 3 of 5</span>
        </div>
        <span className="rounded-tab bg-highlighter px-4 py-1 font-hand text-[19px]">{tasks.filter((t) => t.done).length} of {tasks.length} ticked</span>
      </section>

      <div role="tablist" aria-label="Sections" className="mt-[26px] mb-[22px] flex flex-wrap gap-2.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-12 rounded-tab border-0 px-6 font-hand text-[23px] text-ink ${tab === t.id ? 'bg-highlighter' : 'bg-transparent'}`}
          >
            {t.label}
            {t.id === 'reflection' && <span aria-hidden="true" className="text-redpen"> *</span>}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-9 min-[901px]:flex-row min-[901px]:items-start">
        <div className="min-w-0 min-[901px]:max-w-[820px] min-[901px]:flex-[999_1_560px]">{tab === 'reflection' ? <Reflection /> : <Notes tab={tab} active={active} setActive={setActive} />}</div>
        <TasksRail tasks={tasks} setTasks={setTasks} />
      </div>
    </main>
  );
}
