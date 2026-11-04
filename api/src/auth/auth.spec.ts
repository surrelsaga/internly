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
const allowed = 'me@example.com, other@example.com';

describe('validateLogin', () => {
  it('rejects an email that is not on the allowlist', async () => {
    const users = fakeUsers();
    expect(await validateLogin({ ...login, email: 'stranger@example.com' }, allowed, users)).toBeNull();
    expect(users.rows).toHaveLength(0);
  });

  it('rejects an unverified email', async () => {
    expect(await validateLogin({ ...login, emailVerified: false }, allowed, fakeUsers())).toBeNull();
  });

  it('attaches the googleId to the seeded user instead of creating a new one', async () => {
    const users = fakeUsers({ email: 'me@example.com', name: 'me' });
    const user = await validateLogin(login, allowed, users);
    expect(user).toMatchObject({ id: 'u0', googleId: 'g1' });
    expect(users.rows).toHaveLength(1);
  });

  it('finds a returning user by googleId, and creates a new allowed user', async () => {
    const users = fakeUsers({ email: 'me@example.com', name: 'me', googleId: 'g1' });
    expect(await validateLogin(login, allowed, users)).toMatchObject({ id: 'u0' });
    const created = await validateLogin({ ...login, googleId: 'g2', email: 'other@example.com' }, allowed, users);
    expect(created).toMatchObject({ email: 'other@example.com', googleId: 'g2' });
    expect(users.rows).toHaveLength(2);
  });
});
