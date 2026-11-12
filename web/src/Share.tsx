import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Internship } from './api';
import { Checkbox, useDismiss, WobbleButton } from './ui';

export const shareUrl = (token: string) => `${location.origin}/share/${token}`;

// The owner's "share" button: one read-only link for the whole internship, switched on or off.
// The link is the same every time it's switched on, and always shows the latest notes.
export default function ShareButton({ internship }: { internship: Internship }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => api<Pick<Internship, 'shareToken' | 'shareEnabled'>>('/share', { enabled }, 'PUT'),
    onSuccess: (s) => qc.setQueryData<Internship>(['internship'], (d) => d && { ...d, ...s }),
  });
  const on = internship.shareEnabled && !!internship.shareToken;
  const url = internship.shareToken ? shareUrl(internship.shareToken) : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ponytail: no clipboard (old browser, http): the link is in a selectable box right there.
    }
  };

  return (
    <div ref={ref} className="relative">
      <WobbleButton aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}>
        share
        {on && (
          <>
            <span aria-hidden="true" className="ml-1.5 inline-block size-2 rounded-full bg-highlighter align-middle shadow-[0_0_0_1.5px_#2A2520]" />
            <span className="sr-only"> (on)</span>
          </>
        )}
      </WobbleButton>
      {open && (
        <div role="dialog" aria-label="Share" className="absolute top-[56px] right-0 z-30 w-[340px] max-w-[calc(100vw-32px)] rounded-card bg-card p-4 shadow-[0_0_0_2px_#2A2520,4px_6px_0_rgba(42,37,32,0.15)]">
          <div className="flex items-center gap-1">
            <Checkbox checked={on} label="Anyone with the link can view" onToggle={() => !toggle.isPending && toggle.mutate(!on)} />
            <span className="font-hand text-[19px]">Anyone with the link can view</span>
          </div>
          {on ? (
            <>
              <div className="mt-2 flex items-center gap-2">
                <input readOnly aria-label="Share link" value={url} onFocus={(e) => e.currentTarget.select()} className="min-h-11 min-w-0 flex-1 rounded-none border-0 border-b-2 border-ink bg-transparent px-1 font-sans text-sm text-ink" />
                <button type="button" onClick={() => void copy()} className="tilt min-h-11 rounded-btn border-0 bg-ink px-4 font-hand text-[18px] text-paper">
                  {copied ? 'copied' : 'copy'}
                </button>
              </div>
              <p className="mt-3 font-hand text-base text-ink-soft">
                View only. Shows every week, your notes, tasks and reflections, always the latest. Turn it off any time; the same link comes back when you turn it on.
              </p>
            </>
          ) : (
            <p className="mt-2 font-hand text-base text-ink-soft">Off. Turn it on to get a view-only link to your whole internship. It stays the same link every time.</p>
          )}
          {toggle.error && <p role="alert" className="mt-2 font-hand text-base text-redpen">Could not change sharing: {toggle.error.message}</p>}
        </div>
      )}
    </div>
  );
}
