import { useTestDatabase } from './guard.js';

describe('useTestDatabase', () => {
  it('throws unless APP_ENV is development', () => {
    expect(() => useTestDatabase({ TEST_DATABASE_URL: 'x' })).toThrow();
    expect(() => useTestDatabase({ APP_ENV: 'production', TEST_DATABASE_URL: 'x' })).toThrow();
  });

  it('throws without TEST_DATABASE_URL', () => {
    expect(() => useTestDatabase({ APP_ENV: 'development' })).toThrow();
  });

  it('swaps DATABASE_URL for the test one', () => {
    const env: NodeJS.ProcessEnv = { APP_ENV: 'development', DATABASE_URL: 'real', TEST_DATABASE_URL: 'test' };
    useTestDatabase(env);
    expect(env.DATABASE_URL).toBe('test');
  });
});
