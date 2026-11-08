import { useRef, useState, type DragEvent, type ReactNode } from 'react';
import { dashedBtn } from './ui';

// A tab. With `fixed`, it shows that instead of its name and can be moved but not renamed or deleted (reflection).
export type TabItem = { id: string; name: string; fixed?: ReactNode };

// A row of tabs, then "+ new …". Click the open tab (or double-click any) to rename it, × to delete it, drag to reorder.
// Used for the week's section tabs and for the notes inside a section. The parent owns the data: each callback updates
// its cache, and a callback that throws (save failed) shows "could not … the <noun>".
export function Tabs({
  label,
  noun,
  items,
  active,
  onSelect,
  tabClass,
  addClass,
  maxLength,
  onAdd,
  onRename,
  onDelete,
  setOrder,
  saveOrder,
  className,
}: {
  label: string;
  noun: string;
  items: TabItem[];
  active?: string;
  onSelect: (id: string) => void;
  tabClass: (on: boolean) => string;
  addClass: string; // the "+ new …" button's size
  maxLength: number;
  onAdd: () => Promise<TabItem>; // creates it and selects it; it opens for renaming
  onRename: (item: TabItem, name: string) => Promise<void>;
  onDelete: (item: TabItem) => Promise<void>;
  setOrder: (ids: string[]) => void; // show this order now
  saveOrder: (ids: string[]) => Promise<void>;
  className: string;
}) {
  const order = items.map((t) => t.id);
  const [editing, setEditing] = useState<{ item: TabItem; draft: string } | null>(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const cancelled = useRef(false);
  // The tab being dragged, and the order before the drag (to detect a change and to undo a failed save).
  const drag = useRef<{ id: string; before: string[] } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const rename = (item: TabItem) => {
    cancelled.current = false;
    setError('');
    setEditing({ item, draft: item.name });
  };

  const save = async () => {
    const e = editing;
    setEditing(null);
    const name = e?.draft.trim();
    if (cancelled.current || !e || !name || name === e.item.name) return;
    try {
      await onRename(e.item, name);
    } catch {
      setError(`could not rename the ${noun}, try again`);
    }
  };

  const add = async () => {
    setError('');
    setAdding(true);
    try {
      rename(await onAdd());
    } catch {
      setError(`could not add a ${noun}, try again`);
    }
    setAdding(false);
  };

  const remove = async (item: TabItem) => {
    setError('');
    try {
      await onDelete(item);
    } catch {
      setError(`could not delete the ${noun}, try again`);
    }
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

  // Dropped outside the row (or Escape) puts it back; otherwise the new order is saved.
  const dragEnd = async (e: DragEvent) => {
    const d = drag.current;
    drag.current = null;
    setDragging(null);
    if (!d) return;
    if (e.dataTransfer.dropEffect === 'none') return setOrder(d.before);
    if (order.join() === d.before.join()) return;
    try {
      await saveOrder(order);
    } catch {
      setOrder(d.before);
      setError(`could not move the ${noun}, try again`);
    }
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      // the whole row is a drop zone, so letting go between tabs keeps the new order
      onDragOver={(e) => drag.current && e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
      className={`flex flex-wrap items-center gap-2.5 ${className}`}
    >
      {items.map((t) => {
        const on = t.id === active;
        // The wrapper is what drags, for every tab, open or not.
        const draggable = {
          draggable: true,
          onDragStart: (e: DragEvent) => {
            e.dataTransfer.setData('text/plain', t.id); // Firefox won't start a drag without data
            e.dataTransfer.effectAllowed = 'move';
            drag.current = { id: t.id, before: order };
            setDragging(t.id);
          },
          onDragOver: (e: DragEvent) => dragOver(e, t.id),
          onDragEnd: (e: DragEvent) => void dragEnd(e),
        };
        if (t.fixed) {
          return (
            <span key={t.id} {...draggable} className={dragging === t.id ? 'opacity-40' : ''}>
              <button type="button" role="tab" aria-selected={on} title="drag to move" onClick={() => onSelect(t.id)} className={`${tabClass(on)} cursor-grab active:cursor-grabbing`}>
                {t.fixed}
              </button>
            </span>
          );
        }
        return editing?.item.id === t.id ? (
          // The invisible copy of the text sets the width, so the box fits the name exactly and grows as you type.
          <span key={t.id} className="inline-grid">
            <span aria-hidden="true" className={`${tabClass(true)} invisible col-start-1 row-start-1 whitespace-pre`}>
              {editing.draft || ' '}
            </span>
            <input
              aria-label={`${noun[0].toUpperCase()}${noun.slice(1)} name`}
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              value={editing.draft}
              maxLength={maxLength}
              onChange={(e) => setEditing({ item: t, draft: e.target.value })}
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
          <span key={t.id} {...draggable} className={`group relative ${dragging === t.id ? 'opacity-40' : ''}`}>
            <button
              type="button"
              role="tab"
              aria-selected={on}
              title={on ? 'click to rename, drag to move' : 'double-click to rename, drag to move'}
              onClick={() => (on ? rename(t) : onSelect(t.id))}
              onDoubleClick={() => rename(t)}
              className={`${tabClass(on)} cursor-grab active:cursor-grabbing`}
            >
              {t.name}
            </button>
            {/* Always on the open tab (so phones can reach it); on hover or focus for the rest. */}
            <button
              type="button"
              aria-label={`Delete ${noun} “${t.name}”`}
              title={`delete ${noun}`}
              onClick={() => void remove(t)}
              // 24px hit area (fine for touch), 16px badge you see
              className={`group/del absolute -top-2 -right-2 size-6 items-center justify-center border-0 bg-transparent p-0 text-ink ${on ? 'flex' : 'hidden group-focus-within:flex group-hover:flex'}`}
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
      <button type="button" disabled={adding} onClick={() => void add()} className={`${addClass} ${dashedBtn}`}>
        + new {noun}
      </button>
      {error && <span role="alert" className="font-hand text-[17px] text-redpen">{error}</span>}
    </div>
  );
}
