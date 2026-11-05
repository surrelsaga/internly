import { defineConfig } from 'vitest/config';

// extends: projects inherit the root test options (the 30s timeout), otherwise they fall back to 5s.
const shared = { extends: true, resolve: { tsconfigPaths: true } };

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30_000, // Neon is slow to wake
    fileParallelism: false, // e2e files share one database
    projects: [
      // Pure rules: no database.
      { ...shared, test: { name: 'unit', globals: true, include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'] } },
      // Hit the real endpoints; setup migrates, truncates and seeds per file.
      {
        ...shared,
        test: { name: 'e2e', globals: true, include: ['test/**/*.e2e-spec.ts'], setupFiles: ['test/setup.ts'] },
      },
    ],
  },
});
