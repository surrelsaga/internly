import { DataSource } from 'typeorm';
import { User } from './users/user.entity.js';
import { Internship, Week } from './internship/internship.entity.js';
import { Note, Section } from './notes/note.entity.js';
import { Reflection } from './reflection/reflection.entity.js';
import { Task } from './tasks/task.entity.js';
import { Init1700000000000 } from './migrations/1700000000000-Init.js';
import { Internship1700000001000 } from './migrations/1700000001000-Internship.js';
import { Tasks1700000002000 } from './migrations/1700000002000-Tasks.js';
import { Reflections1700000003000 } from './migrations/1700000003000-Reflections.js';
import { Notes1700000004000 } from './migrations/1700000004000-Notes.js';
import { Sections1700000005000 } from './migrations/1700000005000-Sections.js';
import { ReflectionPosition1700000006000 } from './migrations/1700000006000-ReflectionPosition.js';
import { TaskSoftDelete1700000007000 } from './migrations/1700000007000-TaskSoftDelete.js';
import { Share1700000008000 } from './migrations/1700000008000-Share.js';

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
  entities: [User, Internship, Week, Task, Reflection, Note, Section],
  migrations: [Init1700000000000, Internship1700000001000, Tasks1700000002000, Reflections1700000003000, Notes1700000004000, Sections1700000005000, ReflectionPosition1700000006000, TaskSoftDelete1700000007000, Share1700000008000],
});
