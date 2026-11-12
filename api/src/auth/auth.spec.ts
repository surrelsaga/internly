import { User } from '../users/user.entity.js';
import { validateLogin } from './auth.js';

// An in-memory stand-in for the users repository.
function fakeUsers(...seed: Partial<User>[]) {
  const rows = seed.map((u, i) => ({ id: `u${i}`, googleId: null, ...u }) as User);
  return {
    rows,
    findOneBy: async (where: Partial<User>) => rows.find((u) => Object.entries(where).every(([k, v]) => u[k as keyof User] === v)) ?? null,
    create: (u: Partial<User>) => ({ id: `u${rows.length}`, googleId: null, ...u }) as User,
    save: async (u: User) => {
      if (!rows.includes(u)) rows.push(u);
      return u;
    },
  } as any;
}

const login = { googleId: 'g1', email: 'Me@Example.com', emailVerified: true, name: 'Me' };

describe('validateLogin', () => {
  it('rejects an unverified email', async () => {
    expect(await validateLogin({ ...login, emailVerified: false }, fakeUsers())).toBeNull();
  });

  it('attaches the googleId to the seeded user instead of creating a new one', async () => {
    const users = fakeUsers({ email: 'me@example.com', name: 'me' });
    const user = await validateLogin(login, users);
    expect(user).toMatchObject({ id: 'u0', googleId: 'g1' });
    expect(users.rows).toHaveLength(1);
  });

  it('rejects a different Google account using an already linked email', async () => {
    const users = fakeUsers({ email: 'me@example.com', googleId: 'g-old' });
    expect(await validateLogin({ ...login, googleId: 'g-new', email: 'me@example.com' }, users)).toBeNull();
    expect(users.rows[0].googleId).toBe('g-old');
  });

  it('finds a returning user by googleId, and creates a new user', async () => {
    const users = fakeUsers({ email: 'me@example.com', name: 'me', googleId: 'g1' });
    expect(await validateLogin(login, users)).toMatchObject({ id: 'u0' });
    const created = await validateLogin({ ...login, googleId: 'g2', email: 'stranger@example.com' }, users);
    expect(created).toMatchObject({ email: 'stranger@example.com', googleId: 'g2' });
    expect(users.rows).toHaveLength(2);
  });
});
