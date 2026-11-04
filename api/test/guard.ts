// Refuses to run tests unless APP_ENV=development, then points the app at the
// test database. Without this, a test run could hit a real database.
export function useTestDatabase(env: NodeJS.ProcessEnv) {
  if (env.APP_ENV !== 'development') throw new Error('Tests only run with APP_ENV=development');
  if (!env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is not set');
  env.DATABASE_URL = env.TEST_DATABASE_URL;
}
