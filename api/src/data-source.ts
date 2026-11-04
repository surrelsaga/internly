import { DataSource } from 'typeorm';
import { User } from './users/user.entity.js';
import { Init1700000000000 } from './migrations/1700000000000-Init.js';

// One .env at the repo root (absent on Render, where real env vars are set).
// Real env vars win over the file.
try {
  process.loadEnvFile(new URL('../../.env', import.meta.url));
} catch {
  // no .env file, fine
}

// Shared by the app and the migration CLI. Tests point DATABASE_URL at
// TEST_DATABASE_URL (see test/setup.ts), so this is the only URL read.
// ponytail: explicit lists, add each new entity and migration here.
export const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: true,
  synchronize: false,
  entities: [User],
  migrations: [Init1700000000000],
});
