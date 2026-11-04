import { useState } from 'react';
import { api } from './api';
import { dashedBtn } from './ui';

export const REFINE_HINT = 'Refine sends this text to a free AI model. Your company name is hidden first.';
const MAX = 4000;

// State of one refine: ask, then show the suggestion until it is accepted or discarded. Nothing is saved here.
export function useRefine() {
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (text: string) => {
    setSuggestion(null);
    setError(null);
    if (text.length > MAX) return setError(`Too long to refine, the limit is ${MAX} characters.`);
    setBusy(true);
    try {
      setSuggestion((await api<{ suggestion: string }>('/ai/refine', { text })).suggestion);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Could not refine this text. Your text is unchanged.');
    } finally {
      setBusy(false);
    }
  };
  const clear = () => {
    setSuggestion(null);
    setError(null);
  };
  const fail = (message: string) => {
    setSuggestion(null);
    setError(message);
  };
  return { busy, suggestion, error, run, clear, fail };
}

export function RefineButton({ busy, disabled, label, onClick }: { busy: boolean; disabled?: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" aria-label={label} title={REFINE_HINT} disabled={busy || disabled} onClick={onClick} className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[17px] disabled:opacity-50 ${dashedBtn}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 20 L5 15 L16.5 3.5 a2.1 2.1 0 0 1 3 3 L8 18 Z M14.5 5.5 L18.5 9.5" stroke="#4A4540" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {busy ? 'refining…' : 'refine'}
    </button>
  );
}

export function RefinePanel({ suggestion, error, onAccept, onDiscard }: { suggestion: string | null; error: string | null; onAccept: () => void; onDiscard: () => void }) {
  if (error)
    return (
      <p role="alert" className="mt-2 font-hand text-[17px] text-redpen">
        {error}{' '}
        <button type="button" onClick={onDiscard} className="border-0 bg-transparent p-0 font-hand text-[17px] text-ink-soft underline">dismiss</button>
      </p>
    );
  if (suggestion === null) return null;
  return (
    <div role="region" aria-label="Suggestion" className="mt-2 rounded-[10px] border-[1.5px] border-dashed border-ink/55 bg-highlighter/40 px-4 py-3">
      <p className="font-sans text-base leading-[1.6] whitespace-pre-wrap">{suggestion}</p>
      <div className="mt-2 flex gap-2.5">
        <button type="button" onClick={onAccept} className="min-h-11 rounded-full border-0 bg-highlighter px-4 font-hand text-[17px] text-ink">accept</button>
        <button type="button" onClick={onDiscard} className={`min-h-11 rounded-full px-4 text-[17px] ${dashedBtn}`}>discard</button>
      </div>
    </div>
  );
}
