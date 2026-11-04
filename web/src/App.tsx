import { useQuery } from '@tanstack/react-query';

export default function App() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await fetch('/api/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as { ok: boolean };
    },
  });

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Intern Log</h1>
      <p>
        API health:{' '}
        {health.isPending ? 'checking…' : health.isError ? `error (${health.error.message})` : JSON.stringify(health.data)}
      </p>
    </main>
  );
}
