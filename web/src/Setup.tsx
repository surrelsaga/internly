import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Internship } from './api';
import { Wobble } from './ui';

const input = 'mt-1.5 block min-h-11 w-full rounded-none border-0 border-b-2 border-ink bg-transparent px-1 py-1.5 font-hand text-[21px] text-ink';

export default function Setup() {
  const qc = useQueryClient();
  const [company, setCompany] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const save = useMutation({
    mutationFn: () => api<Internship>('/internship', { company, startDate, endDate }),
    onSuccess: (data) => qc.setQueryData(['internship'], data),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };
  return (
    <main className="mx-auto max-w-[560px] px-8 pt-7">
      <form onSubmit={submit} aria-labelledby="setup-title" className="relative px-9 pt-9 pb-[34px]">
        <Wobble />
        <h1 id="setup-title" className="font-caveat text-[46px] leading-none font-bold">set up your internship</h1>
        <p className="mt-2.5 font-hand text-[18px] text-ink-soft">Weeks run Monday to Sunday. Weeks before this one become backfill.</p>
        <label className="mt-[26px] block font-hand text-[23px]">
          Company
          <input type="text" required maxLength={200} value={company} onChange={(e) => setCompany(e.target.value)} className={input} />
        </label>
        <label className="mt-[22px] block font-hand text-[23px]">
          Start date
          <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className={input} />
        </label>
        <label className="mt-[22px] block font-hand text-[23px]">
          End date
          <input type="date" required min={startDate || undefined} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={input} />
        </label>
        {save.error && (
          <p role="alert" className="mt-4 font-hand text-[19px] text-redpen">
            {save.error.message}
          </p>
        )}
        <button type="submit" disabled={save.isPending} className="tilt mt-[30px] min-h-11 rounded-btn border-0 bg-ink px-6 font-hand text-[21px] text-paper disabled:opacity-60">
          {save.isPending ? 'saving…' : 'start my log'}
        </button>
      </form>
    </main>
  );
}
