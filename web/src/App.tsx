import { WobbleButton, WobbleFilter } from './ui';
import WeekPage from './WeekPage';

function Header() {
  return (
    <header className="mx-auto max-w-[1240px] px-8 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 pb-[18px]">
        <div className="flex items-center gap-3.5">
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
        <div className="flex items-center gap-3.5">
          <span className="font-hand text-[19px] text-ink-soft">Daniel</span>
          {/* ponytail: inert until step 9 (auth) */}
          <WobbleButton>sign out</WobbleButton>
        </div>
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

export default function App() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-paper bg-[radial-gradient(rgba(42,37,32,0.07)_1px,transparent_1px)] bg-[length:24px_24px] pb-[72px] font-sans text-ink">
      <WobbleFilter />
      <Header />
      <WeekPage />
    </div>
  );
}
