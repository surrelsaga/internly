import type { ButtonHTMLAttributes, ReactNode } from 'react';

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

export function Checkbox({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={onToggle} className="group flex size-11 flex-none items-center justify-center border-0 bg-transparent p-0">
      <span className="relative block size-[22px] transition-transform duration-150 group-hover:-rotate-6 motion-reduce:group-hover:rotate-0">
        <Wobble radius="rounded-box" />
        {/* always rendered: the tick draws in when aria-checked flips (index.css), and is hidden when unticked */}
        <svg width="24" height="24" viewBox="0 0 26 26" fill="none" aria-hidden="true" className="tick absolute -top-1.5 left-[3px]">
          <path d="M3 14 L9 20 L22 4" pathLength="1" stroke="#2A2520" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
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
