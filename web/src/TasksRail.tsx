import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Week, type WeekDetail, type WeekTask } from './api';
import { Checkbox, dashedBtn, Marker, Tape, Wobble } from './ui';

function TaskRow({ task, onToggle, onRename, onDelete }: { task: WeekTask; onToggle: () => void; onRename: (title: string) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  // Enter, Escape and blur can all fire for one edit; only the first counts.
  const settled = useRef(false);
  const finish = (save: boolean, value: string) => {
    if (settled.current) return;
    settled.current = true;
    setEditing(false);
    const title = value.trim();
    if (save && title && title !== task.title) onRename(title);
  };
  return (
    <div className="flex items-start gap-1 border-b-[1.5px] border-dashed border-ink/20">
      <Checkbox checked={task.done} label={task.title} onToggle={onToggle} />
      <div className="min-w-0 flex-auto py-2.5">
        {editing ? (
          <input
            autoFocus
            aria-label="Task title"
            defaultValue={task.title}
            maxLength={500}
            onBlur={(e) => finish(true, e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') finish(true, e.currentTarget.value);
              if (e.key === 'Escape') finish(false, '');
            }}
            className="w-full rounded-none border-0 border-b-2 border-ink bg-transparent p-0 font-hand text-[19px] leading-tight text-ink"
          />
        ) : (
          <button
            type="button"
            title="Click to edit"
            onClick={() => {
              settled.current = false;
              setEditing(true);
            }}
            className={`block w-full border-0 bg-transparent p-0 text-left font-hand text-[19px] leading-tight [overflow-wrap:anywhere] ${task.done ? 'text-ink-mute line-through decoration-ink decoration-2' : 'text-ink'}`}
          >
            {task.title}
          </button>
        )}
        {task.fromWeek !== null && <span className="mt-1 inline-block rounded-full border-[1.5px] border-dashed border-ink-mute px-[9px] font-hand text-sm text-ink-mute">from week {task.fromWeek}</span>}
      </div>
      <button type="button" aria-label={`Delete ${task.title}`} onClick={onDelete} className="flex size-11 flex-none items-center justify-center border-0 bg-transparent p-0 font-hand text-[24px] text-ink-mute">
        ×
      </button>
    </div>
  );
}

// One step the undo button can take back: what it says, and the request that reverses it.
type Undo = { label: string; run: () => Promise<unknown> };

export default function TasksRail({ week, tasks }: { week: Week; tasks: WeekTask[] }) {
  const qc = useQueryClient();
  const key = ['week', week.id];
  const [title, setTitle] = useState('');
  const refresh = () => qc.invalidateQueries({ queryKey: ['week'] });
  // ponytail: kept in memory for this week's page only; leaving the week or reloading clears it.
  const [history, setHistory] = useState<Undo[]>([]);
  const remember = (u: Undo) => setHistory((h) => [...h.slice(-29), u]);
  const check = (t: WeekTask) => (t.done ? { done: false } : { done: true, weekId: week.id });

  const add = useMutation({
    mutationFn: (t: string) => api<{ id: string; title: string }>('/tasks', { title: t, weekId: week.id }),
    onSuccess: (t) => {
      setTitle('');
      remember({ label: `adding “${t.title}”`, run: () => api(`/tasks/${t.id}`, undefined, 'DELETE') });
    },
    onSettled: refresh,
  });
  const rename = useMutation({
    mutationFn: (v: { task: WeekTask; title: string }) => api(`/tasks/${v.task.id}`, { title: v.title }, 'PATCH'),
    onSuccess: (_r, v) => remember({ label: `renaming “${v.task.title}”`, run: () => api(`/tasks/${v.task.id}`, { title: v.task.title }, 'PATCH') }),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: (t: WeekTask) => api(`/tasks/${t.id}`, undefined, 'DELETE'),
    onSuccess: (_r, t) => remember({ label: `deleting “${t.title}”`, run: () => api(`/tasks/${t.id}/restore`, {}) }),
    onSettled: refresh,
  });
  const undo = useMutation({
    mutationFn: (u: Undo) => u.run(),
    onMutate: () => setHistory((h) => h.slice(0, -1)),
    onSettled: refresh,
  });
  const toggle = useMutation({
    mutationFn: (t: WeekTask) => api(`/tasks/${t.id}`, check(t), 'PATCH'),
    // after the toggle, the same task with `done` flipped; toggling that again reverses it
    onSuccess: (_r, t) => remember({ label: `${t.done ? 'unchecking' : 'checking'} “${t.title}”`, run: () => api(`/tasks/${t.id}`, check({ ...t, done: !t.done }), 'PATCH') }),
    // Tick instantly, roll back if the server says no.
    onMutate: async (t) => {
      await qc.cancelQueries({ queryKey: key });
      const before = qc.getQueryData<WeekDetail>(key);
      qc.setQueryData<WeekDetail>(key, (d) => d && { ...d, tasks: d.tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)) });
      return { before };
    },
    onError: (_e, _t, ctx) => qc.setQueryData(key, ctx?.before),
    onSettled: refresh,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (t) add.mutate(t);
  };
  const error = [add, rename, remove, toggle, undo].find((m) => m.error)?.error;
  const last = history[history.length - 1];
  const busy = [add, rename, remove, toggle, undo].some((m) => m.isPending);

  return (
    <aside aria-labelledby="tasks-title" className="order-first max-w-[340px] min-[901px]:sticky min-[901px]:top-4 min-[901px]:order-none min-[901px]:flex-[1_1_280px] min-[901px]:self-start">
      <div className="relative -rotate-[0.4deg] px-[22px] pt-[34px] pb-[22px]">
        <Wobble />
        <Tape className="-top-[13px] left-1/2 -ml-11 h-[26px] w-[88px] -rotate-[2.5deg] bg-[rgba(196,169,125,0.45)]" />
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 id="tasks-title" className="font-caveat text-[42px] leading-none font-bold">
            <Marker>tasks</Marker>
          </h2>
          <button
            type="button"
            disabled={!last || busy}
            onClick={() => last && undo.mutate(last)}
            aria-label={last ? `Undo ${last.label}` : 'Nothing to undo'}
            title={last ? `undo ${last.label}` : 'nothing to undo'}
            className={`flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[17px] ${dashedBtn} disabled:cursor-default disabled:opacity-40`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 14 L4 9 L9 4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4.5 9 H14 C 18 9, 20.5 11.5, 20.5 15 C 20.5 18.5, 18 20.5, 14.5 20.5 H11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
            undo
          </button>
        </div>
        <p className="mt-1.5 mb-3 font-hand text-base text-ink-soft">Unchecked ones move to next week.</p>
        {tasks.map((t) => (
          <TaskRow key={t.id} task={t} onToggle={() => toggle.mutate(t)} onRename={(v) => rename.mutate({ task: t, title: v })} onDelete={() => remove.mutate(t)} />
        ))}
        <form onSubmit={submit} className="mt-4 flex flex-wrap items-center gap-2.5">
          <label htmlFor="new-task" className="sr-only">New task</label>
          <input
            id="new-task"
            type="text"
            placeholder="add a task"
            maxLength={500}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="min-h-11 min-w-0 flex-[1_1_120px] rounded-none border-0 border-b-2 border-ink bg-transparent px-1 py-1.5 font-hand text-[19px] text-ink"
          />
          <button type="submit" disabled={add.isPending} className="tilt min-h-11 rounded-btn border-0 bg-ink px-5 font-hand text-[19px] text-paper">add</button>
        </form>
        {error && <p role="alert" className="mt-3 font-hand text-base text-redpen">Could not save: {error.message}</p>}
      </div>
    </aside>
  );
}
