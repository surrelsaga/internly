import { useEffect, type ButtonHTMLAttributes, type ReactNode, type RefObject } from 'react';

// Closes a pop-up on a click outside it or on Escape.
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, close: () => void) {
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

// The page top: logo on the left, `children` on the right, then a wavy rule.
export function Masthead({ children }: { children: ReactNode }) {
  return (
    <header className="mx-auto max-w-[1240px] px-8 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 pb-[18px]">
        <div className="flex shrink-0 items-center gap-3.5">
          <svg width="46" height="46" viewBox="0 0 46 46" fill="none" aria-hidden="true">
            <rect x="8" y="5" width="30" height="36" rx="4" stroke="#2A2520" strokeWidth="2.4" />
            <path d="M4 12 H12 M4 21 H12 M4 30 H12" stroke="#2A2520" strokeWidth="2.4" strokeLinecap="round" />
            <path d="M17 17 H31 M17 25 H28" stroke="#2A2520" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          <div>
            <span className="block font-caveat text-[42px] leading-none font-bold text-ink">intern log</span>
            <svg width="132" height="12" viewBox="0 0 132 12" fill="none" aria-hidden="true" className="mt-0.5 block">
              <path d="M3 7 C 25 2, 45 11, 68 6 S 110 3, 129 7" stroke="#2A2520" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
          </div>
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-3.5 sm:w-auto">{children}</div>
      </div>
      <svg width="100%" height="14" viewBox="0 0 1200 14" preserveAspectRatio="none" fill="none" aria-hidden="true" className="block">
        <path
          d="M0 8 C 60 2, 120 14, 180 7 S 300 3, 360 8 S 480 13, 540 6 S 660 4, 720 9 S 840 13, 900 6 S 1020 3, 1080 8 S 1160 12, 1200 7"
          stroke="#2A2520"
          strokeOpacity="0.55"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    </header>
  );
}

// The one wobble filter, defined once. Only ever used by <Wobble>.
export function WobbleFilter() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
      <defs>
        <filter id="jp-wobble" x="-4%" y="-4%" width="108%" height="108%">
          <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3.5" />
        </filter>
      </defs>
    </svg>
  );
}

// The border layer behind a card/button/checkbox. The only place the filter is applied.
export function Wobble({ radius = 'rounded-card', className = '' }: { radius?: string; className?: string }) {
  return <span aria-hidden="true" className={`pointer-events-none absolute inset-0 block border-2 border-ink ${radius} [filter:url(#jp-wobble)] ${className}`} />;
}

// A hand-drawn underline that scribbles in on hover/focus of a .wiggle parent (see index.css).
export function Scribble() {
  return (
    <svg viewBox="0 0 120 10" preserveAspectRatio="none" fill="none" aria-hidden="true" className="scribble pointer-events-none absolute right-5 bottom-1.5 left-5 h-2 w-[calc(100%-40px)]">
      <path d="M3 6 C 20 1, 40 11, 62 5 S 100 3, 117 6" pathLength="1" stroke="#2A2520" strokeWidth="2.2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function WobbleButton({ className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...rest} className={`wiggle relative min-h-11 border-0 bg-transparent px-5 font-hand whitespace-nowrap text-[19px] text-ink ${className}`}>
      <Wobble />
      {children}
      <Scribble />
    </button>
  );
}

// Without onToggle it is view-only (the share page): same look, not clickable.
export function Checkbox({ checked, label, onToggle }: { checked: boolean; label: string; onToggle?: () => void }) {
  const box = (
    <span className="relative block size-[22px] transition-transform duration-150 group-hover:-rotate-6 motion-reduce:group-hover:rotate-0">
      <Wobble radius="rounded-box" />
      {/* always rendered: the tick draws in when aria-checked flips (index.css), and is hidden when unticked */}
      <svg width="24" height="24" viewBox="0 0 26 26" fill="none" aria-hidden="true" className="tick absolute -top-1.5 left-[3px]">
        <path d="M3 14 L9 20 L22 4" pathLength="1" stroke="#2A2520" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
  if (!onToggle) {
    return (
      <span role="checkbox" aria-checked={checked} aria-readonly="true" aria-label={label} className="flex size-11 flex-none items-center justify-center">
        {box}
      </span>
    );
  }
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={onToggle} className="group flex size-11 flex-none items-center justify-center border-0 bg-transparent p-0">
      {box}
    </button>
  );
}

// Dashed pill. On hover the border darkens and it lifts a pixel.
export const dashedBtn =
  'border-[1.5px] border-dashed border-ink-mute bg-transparent font-hand text-ink-soft transition duration-150 enabled:hover:-translate-y-px enabled:hover:border-ink enabled:hover:text-ink motion-reduce:enabled:hover:translate-y-0';

export function Tape({ className }: { className: string }) {
  return <div aria-hidden="true" className={`absolute ${className}`} />;
}

export function Marker({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`marker px-2 ${className}`}>{children}</span>;
}
