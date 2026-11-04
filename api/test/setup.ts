// Runs before every e2e test file: migrate, truncate everything, seed.
import { beforeAll } from 'vitest';
import { useTestDatabase } from './guard.js';

// Load .env first (data-source does it on import), then swap in the test URL
// before the data source reads DATABASE_URL.
try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {
  // no .env file, fine
}
useTestDatabase(process.env);

beforeAll(async () => {
  const { dataSource } = await import('../src/data-source.js');
  const { seedOwner } = await import('../src/seed.js');
  await dataSource.initialize();
  await dataSource.runMigrations();
  const tables = await dataSource.query<{ tablename: string }[]>(
    `select tablename from pg_tables where schemaname = 'public' and tablename <> 'migrations'`,
  );
  if (tables.length) {
    await dataSource.query(`truncate ${tables.map((t) => `"${t.tablename}"`).join(', ')} restart identity cascade`);
  }
  await seedOwner(dataSource);
  await dataSource.destroy();
}, 30_000);
