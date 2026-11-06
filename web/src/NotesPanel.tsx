import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { EditorContent, Extension, useEditor, useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import Image from '@tiptap/extension-image';
import { FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
import StarterKit from '@tiptap/starter-kit';
import { api, ApiError, uploadImage, type Note, type Section, type WeekDetail } from './api';
import { REFINE_HINT, RefineButton, RefinePanel, useRefine } from './Refine';
import { dashedBtn, Wobble } from './ui';

const toolBtn = 'flex size-11 items-center justify-center rounded-[9px] border-[1.5px] border-ink/55 bg-transparent p-0 text-ink';
const on = 'bg-highlighter';

type Status = 'idle' | 'saving' | 'saved' | 'error' | 'uploading' | 'uploadError';
const statusText: Record<Status, string> = {
  idle: 'saved',
  saving: 'saving…',
  saved: 'saved',
  error: 'could not save, will retry',
  uploading: 'uploading image…',
  uploadError: 'could not upload that image (png, jpeg, gif or webp, up to 5MB)',
};

// '' = the note's default font (Inter). Each value is the CSS font-family stored on the text.
const FONTS = [
  { label: 'Default', value: '' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Comic Sans', value: '"Comic Sans MS", "Comic Sans", cursive' },
  { label: 'Courier New', value: '"Courier New", monospace' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Roboto', value: 'Roboto, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
];
const fontCss = (value: string) => value || 'Inter, sans-serif';
const SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72, 96];
const ctrlBox = 'h-11 rounded-[9px] border-[1.5px] border-ink/55 bg-transparent text-ink';
// The pop-up lists: same card look as the week dropdown.
const popover = 'absolute top-[50px] z-20 rounded-card bg-card p-1.5 shadow-[0_0_0_2px_#2A2520,4px_6px_0_rgba(42,37,32,0.15)]';
const optionRow = (on: boolean) => `block w-full rounded-chip border-0 px-3 py-1.5 text-left text-ink ${on ? 'bg-highlighter' : 'bg-transparent hover:bg-highlighter/45'}`;

// A chain that formats the selection, or, with just a caret in (or at the edge of) a word, that whole word, the way
// Google Docs does. The caret is put back afterwards. Otherwise it formats what you type next.
function formatChain(e: Editor, apply: (c: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) {
  const { empty, $from, from } = e.state.selection;
  if (!empty) return apply(e.chain().focus()).run();
  // one character per leaf node (images), so string offsets line up with document positions
  const text = $from.parent.textBetween(0, $from.parent.content.size, undefined, '\ufffc');
  let a = $from.parentOffset;
  let b = a;
  while (a > 0 && /[\p{L}\p{N}_'-]/u.test(text[a - 1])) a--;
  while (b < text.length && /[\p{L}\p{N}_'-]/u.test(text[b])) b++;
  if (a === b) return apply(e.chain().focus()).run();
  const start = $from.start();
  return apply(e.chain().focus().setTextSelection({ from: start + a, to: start + b })).setTextSelection(from).run();
}

// Closes a pop-up on a click outside it or on Escape.
function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onDown = (ev: PointerEvent) => !ref.current?.contains(ev.target as Node) && close();
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && close();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  });
}

// Up/Down move between the options of an open list.
const arrowKeys = (ev: ReactKeyboardEvent<HTMLElement>) => {
  if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
  ev.preventDefault();
  const opts = [...ev.currentTarget.querySelectorAll<HTMLElement>('[role=option]')];
  const i = opts.indexOf(document.activeElement as HTMLElement);
  opts[(i + (ev.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length]?.focus();
};

// The font picker: the current font's name in its own typeface, and a list of fonts, each shown in itself.
function FontPicker({ editor, font }: { editor: Editor; font: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useDismiss(box, open, () => setOpen(false));
  const current = FONTS.find((f) => f.value === font) ?? FONTS[0];
  const pick = (value: string) => {
    setOpen(false);
    formatChain(editor, (c) => (value ? c.setFontFamily(value) : c.unsetFontFamily()));
  };
  return (
    <div ref={box} className="relative" onKeyDown={open ? arrowKeys : undefined}>
      <button
        type="button"
        aria-label={`Font: ${current.label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`${ctrlBox} flex w-[156px] items-center justify-between gap-2 pr-2.5 pl-3 text-[15px] ${open ? on : ''}`}
      >
        <span className="truncate" style={{ fontFamily: fontCss(current.value) }}>{current.label}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`flex-none transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M5 9 L12 16 L19 9" stroke="#2A2520" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div role="listbox" aria-label="Fonts" className={`${popover} left-0 w-[200px]`}>
          {FONTS.map((f) => (
            <button key={f.label} type="button" role="option" aria-selected={f.value === current.value} onClick={() => pick(f.value)} style={{ fontFamily: fontCss(f.value) }} className={`${optionRow(f.value === current.value)} text-[17px]`}>
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// The size at the caret: the one set on the text, else what the page renders there (16 for body text, 32 in a heading).
// NaN when it can't be measured (e.g. while the editor is still mounting); the size box covers that.
function sizeAt(e: Editor) {
  const set = e.getAttributes('textStyle').fontSize as string | undefined;
  if (set) return parseFloat(set);
  const { node } = e.view.domAtPos(e.state.selection.from);
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);
  return el ? Math.round(parseFloat(getComputedStyle(el).fontSize)) : NaN;
}

// One pill: − [size] +. Clicking the number lists common sizes; or type one (1 to 400) and press Enter.
// Resizes the selected text, or, with nothing selected, what you type next.
function FontSizeControl({ editor, size }: { editor: Editor; size: number }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const pill = useRef<HTMLDivElement>(null);
  useDismiss(pill, open, () => setOpen(false));
  // When the size can't be read, show the last one seen or set, else the default.
  const last = useRef(16);
  if (Number.isFinite(size)) last.current = size;
  const shown = last.current;
  const apply = (n: number) => {
    setDraft(null);
    setOpen(false);
    if (!Number.isFinite(n)) return void editor.commands.focus();
    const v = Math.min(400, Math.max(1, Math.round(n)));
    last.current = v;
    // Only the selection, or with just a caret, the text typed next. Never the word already written.
    editor.chain().focus().setFontSize(`${v}px`).run();
  };
  const step = 'flex h-full w-8 items-center justify-center rounded-[7px] border-0 bg-transparent p-0 font-sans text-[18px] leading-none text-ink hover:bg-highlighter/45';
  return (
    <div ref={pill} className="relative" onKeyDown={open ? arrowKeys : undefined}>
      <div className={`${ctrlBox} flex items-center p-[3px] focus-within:border-ink ${open ? 'border-ink' : ''}`}>
        <button type="button" aria-label="Smaller text" title="smaller" onClick={() => apply(shown - 1)} className={step}>−</button>
        <input
          aria-label="Font size"
          inputMode="numeric"
          value={draft ?? String(shown)}
          onFocus={(e) => {
            e.currentTarget.select();
            setOpen(true);
          }}
          onBlur={() => setDraft(null)}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 3))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply(draft ? parseInt(draft, 10) : shown);
            if (e.key === 'Escape') apply(NaN);
          }}
          className="h-full w-9 rounded-[6px] border-0 bg-transparent p-0 text-center font-sans text-[15px] text-ink focus-visible:outline-none"
        />
        <button type="button" aria-label="Bigger text" title="bigger" onClick={() => apply(shown + 1)} className={step}>+</button>
      </div>
      {open && (
        <div role="listbox" aria-label="Font sizes" className={`${popover} left-1/2 max-h-72 w-[76px] -translate-x-1/2 overflow-y-auto`}>
          {SIZES.map((n) => (
            <button key={n} type="button" role="option" aria-selected={n === shown} onClick={() => apply(n)} className={`${optionRow(n === shown)} text-center font-sans text-[15px]`}>
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Tab indents instead of jumping to the next field. In a bullet list it nests the item; elsewhere it inserts a tab at
// the caret, or at the start of every selected line (so a selection is never replaced). Shift+Tab undoes one level, and
// when there's nothing to undo it moves focus out as usual, so the keyboard can still leave the editor.
const TabIndent = Extension.create({
  name: 'tabIndent',
  addKeyboardShortcuts() {
    const lineStarts = () => {
      const { from, to } = this.editor.state.selection;
      const starts: number[] = [];
      this.editor.state.doc.nodesBetween(from, to, (node, pos) => {
        if (node.isTextblock) starts.push(pos + 1);
      });
      return starts.reverse(); // edit from the end so earlier positions stay valid
    };
    return {
      Tab: () => {
        if (this.editor.isActive('listItem')) return this.editor.commands.sinkListItem('listItem') || true;
        const { state, view } = this.editor;
        const tr = state.tr;
        if (state.selection.empty) tr.insertText('\t');
        else for (const p of lineStarts()) tr.insertText('\t', p);
        view.dispatch(tr);
        return true;
      },
      'Shift-Tab': () => {
        if (this.editor.isActive('listItem')) return this.editor.commands.liftListItem('listItem');
        const { state, view } = this.editor;
        const tr = state.tr;
        const { empty, from } = state.selection;
        if (empty && state.doc.textBetween(from - 1, from) === '\t') tr.delete(from - 1, from);
        else for (const p of lineStarts()) if (state.doc.textBetween(p, p + 1) === '\t') tr.delete(p, p + 1);
        if (!tr.docChanged) return false;
        view.dispatch(tr);
        return true;
      },
    };
  },
});

const imageFile = (files?: FileList | null) => Array.from(files ?? []).find((f) => f.type.startsWith('image/'));

function Toolbar({ editor, status, onImage, refine }: { editor: Editor; status: Status; onImage: (f: File) => void; refine: ReactNode }) {
  // The editor doesn't re-render React on every transaction, so read the active marks explicitly.
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      link: e.isActive('link'),
      list: e.isActive('bulletList'),
      font: (e.getAttributes('textStyle').fontFamily as string | undefined) ?? '',
      size: sizeAt(e),
    }),
  });
  const file = useRef<HTMLInputElement>(null);
  const link = () => {
    const href = window.prompt('Link URL (leave empty to remove the link)', editor.getAttributes('link').href ?? 'https://');
    if (href === null) return;
    const chain = editor.chain().focus().extendMarkRange('link');
    (href.trim() ? chain.setLink({ href: href.trim() }) : chain.unsetLink()).run();
  };
  return (
    <div className="sticky top-0 z-[5] flex flex-wrap items-center justify-between gap-2.5 rounded-t-[14px_10px] border-b-[1.5px] border-dashed border-ink/35 bg-paper/95 px-7 py-3">
      {/* Keep the caret (and the selection) in the editor when a toolbar button is pressed. The size box still takes focus. */}
      <div role="toolbar" aria-label="Formatting" onMouseDown={(e) => !(e.target as HTMLElement).closest('input') && e.preventDefault()} className="flex flex-wrap gap-2">
        <FontPicker editor={editor} font={s.font} />
        <FontSizeControl editor={editor} size={s.size} />
        <button type="button" aria-label="Bold" aria-pressed={s.bold} onClick={() => editor.chain().focus().toggleBold().run()} className={`${toolBtn} font-sans text-[17px] font-medium ${s.bold ? on : ''}`}>B</button>
        <button type="button" aria-label="Italic" aria-pressed={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()} className={`${toolBtn} font-sans text-[17px] italic ${s.italic ? on : ''}`}>I</button>
        <button type="button" aria-label="Add link" aria-pressed={s.link} onClick={link} className={`${toolBtn} ${s.link ? on : ''}`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M10 14 a4 4 0 0 0 5.7 0 l3-3 a4 4 0 0 0 -5.7 -5.7 l-1 1 M14 10 a4 4 0 0 0 -5.7 0 l-3 3 a4 4 0 0 0 5.7 5.7 l1 -1" stroke="#2A2520" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button type="button" aria-label="Add image" onClick={() => file.current?.click()} className={toolBtn}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="4.5" width="18" height="15" rx="2.5" stroke="#2A2520" strokeWidth="1.9" />
            <circle cx="9" cy="10" r="1.8" stroke="#2A2520" strokeWidth="1.7" />
            <path d="M4 17 L9.5 12.5 L13 15.5 L16 13 L20.5 17" stroke="#2A2520" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <input
          ref={file}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          aria-label="Choose an image"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) onImage(f);
          }}
        />
        <button type="button" aria-label="Bulleted list" aria-pressed={s.list} onClick={() => editor.chain().focus().toggleBulletList().run()} className={`${toolBtn} ${s.list ? on : ''}`}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="5" cy="7" r="1.3" fill="#2A2520" />
            <circle cx="5" cy="12" r="1.3" fill="#2A2520" />
            <circle cx="5" cy="17" r="1.3" fill="#2A2520" />
            <path d="M10 7 H20 M10 12 H20 M10 17 H20" stroke="#2A2520" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </button>
        {refine}
      </div>
      <span role="status" aria-live="polite" className="font-hand text-[17px] text-ink-soft">{statusText[status]}</span>
    </div>
  );
}

// One open note. Keyed by note id in the parent, so switching notes remounts it.
function NoteEditor({ weekId, note, onDeleted }: { weekId: string; note: Note; onDeleted: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(note.title);
  const [status, setStatus] = useState<Status>('idle');
  // What was typed since the last save, and the pending debounce timer.
  const pending = useRef<{ title?: string; content?: object }>({});
  const timer = useRef<number | undefined>(undefined);

  const patchCache = (p: Partial<Note>) =>
    qc.setQueryData<WeekDetail>(['week', weekId], (d) => d && { ...d, notes: d.notes.map((n) => (n.id === note.id ? { ...n, ...p } : n)) });

  const flush = async () => {
    window.clearTimeout(timer.current);
    const body = pending.current;
    if (!Object.keys(body).length) return;
    pending.current = {};
    patchCache(body); // so coming back to this note shows what was typed
    setStatus('saving');
    try {
      await api(`/notes/${note.id}`, body, 'PATCH');
      setStatus(Object.keys(pending.current).length ? 'saving' : 'saved');
    } catch (e) {
      pending.current = { ...body, ...pending.current };
      setStatus('error');
      // Network errors and 5xx (e.g. a dropped database connection) retry on their own.
      if (!(e instanceof ApiError) || e.status >= 500) timer.current = window.setTimeout(flush, 3000);
    }
  };
  // Leaving the note, tab or week saves what's still waiting.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    // ponytail: best-effort save on reload/close; no keepalive, since it caps the body at 64KB and long notes would fail.
    const onHide = () => void flushRef.current();
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      void flushRef.current();
    };
  }, []);

  const queue = (p: { title?: string; content?: object }) => {
    Object.assign(pending.current, p);
    setStatus('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 800);
  };

  const editor = useEditor({
    // StarterKit includes Link. Clicking a link while editing shouldn't navigate away.
    extensions: [StarterKit.configure({ link: { openOnClick: false } }), Image, TextStyle, FontFamily, FontSize, TabIndent],
    content: note.content,
    onUpdate: ({ editor: e }) => queue({ content: e.getJSON() }),
    editorProps: {
      attributes: { class: 'note-body min-h-[260px] outline-none', 'aria-label': 'Note body', role: 'textbox', 'aria-multiline': 'true' },
      handlePaste: (view, event) => {
        const f = imageFile(event.clipboardData?.files);
        if (!f) return false;
        // The image node is built from the view, so this doesn't depend on a render's `editor`.
        void upload(f, (src) => view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.nodes.image.create({ src }))));
        return true;
      },
    },
  });

  const upload = async (file: File, insert: (src: string) => void) => {
    setStatus('uploading');
    try {
      insert(await uploadImage(file));
      setStatus('idle');
    } catch {
      setStatus('uploadError');
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete the note “${title || 'untitled'}”?`)) return;
    window.clearTimeout(timer.current);
    pending.current = {}; // nothing left to save
    await api(`/notes/${note.id}`, undefined, 'DELETE');
    onDeleted();
  };

  const refine = useRefine();
  // The selected range and its text, when the refine was asked for.
  const asked = useRef<{ from: number; to: number; text: string } | null>(null);
  const selected = useEditorState({ editor, selector: ({ editor: e }) => (e ? e.state.doc.textBetween(e.state.selection.from, e.state.selection.to, '\n') : '') }) ?? '';

  if (!editor) return null;
  const ask = () => {
    const { from, to } = editor.state.selection;
    asked.current = { from, to, text: selected };
    void refine.run(selected);
  };
  const accept = () => {
    const a = asked.current;
    if (!a || refine.suggestion === null) return;
    if (editor.state.doc.textBetween(a.from, a.to, '\n') !== a.text) return refine.fail('The note changed while the AI was working. Select the text and refine again.');
    // ponytail: replaces the range with plain text, so bold/links inside it are lost.
    editor.chain().focus().insertContentAt({ from: a.from, to: a.to }, { type: 'text', text: refine.suggestion }).run();
    refine.clear();
  };
  return (
    <article className="relative pb-14">
      {/* z-10: above the sticky toolbar (z-5), so the wobbly top edge isn't cut by it. It ignores clicks. */}
      <Wobble className="z-10" />
      <Toolbar
        editor={editor}
        status={status}
        onImage={(f) => void upload(f, (src) => editor.chain().focus().setImage({ src }).run())}
        refine={<RefineButton label="Refine selected text" busy={refine.busy} disabled={!selected.trim()} onClick={ask} />}
      />
      <div className="px-11 pt-3 font-hand text-base text-ink-mute">
        {REFINE_HINT} Select some text first.
        <RefinePanel suggestion={refine.suggestion} error={refine.error} onAccept={accept} onDiscard={refine.clear} />
      </div>
      <div className="px-11 pt-[30px] font-sans [overflow-wrap:anywhere] text-base leading-[1.75]">
        <div className="mb-[18px] flex flex-wrap items-start justify-between gap-3">
          <input
            aria-label="Note title"
            value={title}
            maxLength={200}
            onChange={(e) => {
              setTitle(e.target.value);
              patchCache({ title: e.target.value });
              queue({ title: e.target.value });
            }}
            className="min-w-0 flex-[1_1_280px] border-0 bg-transparent p-0 font-caveat text-[48px] leading-[1.05] font-bold text-ink"
          />
          <button type="button" onClick={remove} className={`min-h-11 rounded-full px-4 text-[17px] ${dashedBtn}`}>delete note</button>
        </div>
        <EditorContent editor={editor} />
      </div>
    </article>
  );
}

export default function NotesPanel({ weekId, section, notes, activeId, setActiveId }: { weekId: string; section: Section; notes: Note[]; activeId?: string; setActiveId: (id: string) => void }) {
  const qc = useQueryClient();
  const list = notes.filter((n) => n.sectionId === section.id);
  const note = list.find((n) => n.id === activeId) ?? list[0];
  const [failed, setFailed] = useState(false);

  const add = async () => {
    setFailed(false);
    try {
      const created = await api<Note>(`/weeks/${weekId}/notes`, { sectionId: section.id, title: 'untitled' });
      qc.setQueryData<WeekDetail>(['week', weekId], (d) => d && { ...d, notes: [...d.notes, created] });
      setActiveId(created.id);
    } catch {
      setFailed(true);
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        {list.map((n) => {
          const sel = n.id === note?.id;
          return (
            <button
              key={n.id}
              type="button"
              aria-pressed={sel}
              onClick={() => setActiveId(n.id)}
              className={`min-h-11 rounded-chip border-0 px-[18px] font-hand text-[20px] text-ink ${sel ? 'bg-highlighter' : 'swipe bg-transparent shadow-[inset_0_0_0_1.5px_rgba(42,37,32,0.45)]'}`}
            >
              {n.title || 'untitled'}
            </button>
          );
        })}
        <button type="button" onClick={add} className={`min-h-11 rounded-full px-4 text-[19px] ${dashedBtn}`}>+ new note</button>
        {failed && <span role="alert" className="font-hand text-[17px] text-redpen">could not create the note, try again</span>}
      </div>
      {note ? (
        <NoteEditor
          key={note.id}
          weekId={weekId}
          note={note}
          onDeleted={() => qc.setQueryData<WeekDetail>(['week', weekId], (d) => d && { ...d, notes: d.notes.filter((n) => n.id !== note.id) })}
        />
      ) : (
        <p className="font-hand text-[20px] text-ink-mute">No notes in “{section.name}” this week yet.</p>
      )}
    </div>
  );
}
