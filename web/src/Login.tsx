import { Wobble } from './ui';

export default function Login() {
  const notAllowed = new URLSearchParams(location.search).get('error') === 'not-allowed';
  return (
    <main className="mx-auto max-w-[560px] px-8 pt-16">
      <section aria-labelledby="login-title" className="relative px-9 pt-9 pb-[34px]">
        <Wobble />
        <h1 id="login-title" className="font-caveat text-[46px] leading-none font-bold">intern log</h1>
        <p className="mt-2.5 font-hand text-[18px] text-ink-soft">Sign in to open your journal.</p>
        {notAllowed && (
          <p role="alert" className="mt-4 font-hand text-[19px] text-redpen">
            That Google account isn't allowed here.
          </p>
        )}
        {/* A full navigation, not a fetch: Google's consent screen needs the browser. */}
        <a href="/api/auth/google" className="tilt mt-[30px] inline-flex min-h-11 items-center rounded-btn bg-ink px-6 font-hand text-[21px] text-paper no-underline">
          Sign in with Google
        </a>
      </section>
    </main>
  );
}
