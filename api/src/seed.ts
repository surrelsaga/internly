import { DataSource } from 'typeorm';
import { dataSource } from './data-source.js';
import { ownerEmail, User } from './users/user.entity.js';

// The owner is the first address in ALLOWED_EMAILS. Safe to run repeatedly.
export async function seedOwner(ds: DataSource) {
  const email = ownerEmail();
  await ds.getRepository(User).upsert({ email, name: email.split('@')[0] }, ['email']);
}

if (process.argv[1] === import.meta.filename) {
  await dataSource.initialize();
  await seedOwner(dataSource);
  await dataSource.destroy();
  console.log('seeded');
}
