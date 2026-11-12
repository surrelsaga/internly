import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError, go, usePath, type CurrentWeek, type Internship, type Me } from './api';
import Login from './Login';
import Setup from './Setup';
import ShareButton from './Share';
import SharedPage from './SharedPage';
import { Masthead, WobbleButton, WobbleFilter } from './ui';
import WeekPage from './WeekPage';

// Under the 'internship' key so the header's share button and the page read the same data.
const useInternship = () =>
  useQuery({
    queryKey: ['internship'],
    queryFn: () => api<Internship>('/internship').catch((e) => (e instanceof ApiError && e.status === 404 ? null : Promise.reject(e))),
  });

function Header() {
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/auth/me') });
  const internship = useInternship();
  const signOut = async () => {
    await api('/auth/logout', {});
    // ponytail: no cache clear; signing in again is a full page load, so the cache starts empty.
    go('/login');
  };
  return (
    <Masthead>
      {/* hidden on phones so the buttons fit */}
      <span className="hidden font-hand text-[19px] text-ink-soft sm:inline">{me.data?.name}</span>
      {internship.data && <ShareButton internship={internship.data} />}
      {/* A plain navigation: the API answers with an attachment, so the browser saves the file and stays on this page. */}
      <WobbleButton title="Download everything as one Markdown file" onClick={() => location.assign('/api/export')}>export</WobbleButton>
      <WobbleButton onClick={signOut}>sign out</WobbleButton>
    </Masthead>
  );
}

const note = 'mx-auto max-w-[1240px] px-8 pt-7 font-hand text-[23px]';

function Body() {
  const path = usePath();
  const internship = useInternship();
  const weekId = path.match(/^\/weeks\/([^/]+)\/?$/)?.[1];
  // Under the 'internship' key so saving a reflection refetches it and the page unlocks.
  const current = useQuery({ queryKey: ['internship', 'current'], queryFn: () => api<CurrentWeek>('/weeks/current'), enabled: !!internship.data });
  const lock = current.data?.locked ? current.data : null;
  const week = internship.data?.weeks.find((w) => w.id === weekId);
  // Anything that isn't a week page opens the current week, or the locked one. While locked, weeks after it bounce back.
  useEffect(() => {
    if (!current.data) return;
    if (!weekId || (lock && week && week.number > lock.number)) go(`/weeks/${current.data.id}`, true);
  }, [current.data, lock, week, weekId]);

  if (internship.isPending) return <p className={note}>loading…</p>;
  if (internship.error) return <p role="alert" className={note}>Could not load: {internship.error.message}</p>;
  if (!internship.data) return <Setup />;
  if (current.error) return <p role="alert" className={note}>Could not load: {current.error.message}</p>;
  if (!weekId || !current.data) return <p className={note}>loading…</p>;
  if (!week) {
    return (
      <p className={note}>
        That week does not exist. <a href="/" className="underline" onClick={(e) => { e.preventDefault(); go('/'); }}>Back to this week</a>
      </p>
    );
  }
  if (lock && week.number > lock.number) return <p className={note}>loading…</p>;
  return <WeekPage key={week.id} internship={internship.data} week={week} lock={lock} />;
}

export default function App() {
  const path = usePath();
  return (
    <div className="relative min-h-screen overflow-x-clip bg-paper bg-[radial-gradient(rgba(42,37,32,0.07)_1px,transparent_1px)] bg-[length:24px_24px] pb-[72px] font-sans text-ink">
      <WobbleFilter />
      {path === '/login' ? (
        <Login />
      ) : path.startsWith('/share/') ? (
        <SharedPage />
      ) : (
        <>
          <Header />
          <Body />
        </>
      )}
    </div>
  );
}
