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

export function WobbleButton({ className = '', children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...rest} className={`relative min-h-11 border-0 bg-transparent px-5 font-hand text-[19px] text-ink ${className}`}>
      <Wobble />
      {children}
    </button>
  );
}

export function Checkbox({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={onToggle} className="flex size-11 flex-none items-center justify-center border-0 bg-transparent p-0">
      <span className="relative block size-[22px]">
        <Wobble radius="rounded-box" />
        {checked && (
          <svg width="24" height="24" viewBox="0 0 26 26" fill="none" aria-hidden="true" className="absolute -top-1.5 left-[3px]">
            <path d="M3 14 L9 20 L22 4" stroke="#2A2520" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </button>
  );
}

export const dashedBtn = 'border-[1.5px] border-dashed border-ink-mute bg-transparent font-hand text-ink-soft';

export function Tape({ className }: { className: string }) {
  return <div aria-hidden="true" className={`absolute ${className}`} />;
}

export function Marker({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`marker px-2 ${className}`}>{children}</span>;
}
