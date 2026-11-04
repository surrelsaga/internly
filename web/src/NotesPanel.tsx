import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import Image from '@tiptap/extension-image';
import StarterKit from '@tiptap/starter-kit';
import { api, uploadImage, type Note, type NoteType, type WeekDetail } from './api';
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

const imageFile = (files?: FileList | null) => Array.from(files ?? []).find((f) => f.type.startsWith('image/'));

function Toolbar({ editor, status, onImage }: { editor: Editor; status: Status; onImage: (f: File) => void }) {
  // The editor doesn't re-render React on every transaction, so read the active marks explicitly.
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({ bold: e.isActive('bold'), italic: e.isActive('italic'), link: e.isActive('link'), list: e.isActive('bulletList') }),
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
      <div role="toolbar" aria-label="Formatting" className="flex flex-wrap gap-2">
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
    } catch {
      pending.current = { ...body, ...pending.current };
      setStatus('error');
    }
  };
  // Leaving the note, tab or week saves what's still waiting.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => void flushRef.current(), []);

  const queue = (p: { title?: string; content?: object }) => {
    Object.assign(pending.current, p);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 800);
  };

  const editor = useEditor({
    // StarterKit includes Link. Clicking a link while editing shouldn't navigate away.
    extensions: [StarterKit.configure({ link: { openOnClick: false } }), Image],
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

  if (!editor) return null;
  return (
    <article className="relative pb-14">
      <Wobble />
      <Toolbar editor={editor} status={status} onImage={(f) => void upload(f, (src) => editor.chain().focus().setImage({ src }).run())} />
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

export default function NotesPanel({ weekId, type, notes, activeId, setActiveId }: { weekId: string; type: NoteType; notes: Note[]; activeId?: string; setActiveId: (id: string) => void }) {
  const qc = useQueryClient();
  const list = notes.filter((n) => n.type === type);
  const note = list.find((n) => n.id === activeId) ?? list[0];
  const [failed, setFailed] = useState(false);

  const add = async () => {
    setFailed(false);
    try {
      const created = await api<Note>(`/weeks/${weekId}/notes`, { type, title: 'untitled' });
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
              className={`min-h-11 rounded-chip border-0 px-[18px] font-hand text-[20px] text-ink ${sel ? 'bg-highlighter' : 'bg-transparent shadow-[inset_0_0_0_1.5px_rgba(42,37,32,0.45)]'}`}
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
        <p className="font-hand text-[20px] text-ink-mute">No {type} notes this week yet.</p>
      )}
    </div>
  );
}
