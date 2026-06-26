import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  root: './',
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'client',
          include: ['packages/client/**/*.test.ts'],
          exclude: [...configDefaults.exclude],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'error-codes',
          include: ['packages/error-codes/**/*.test.ts'],
          exclude: [...configDefaults.exclude],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'fp',
          include: ['packages/fp/**/*.test.ts'],
          exclude: [...configDefaults.exclude],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'schema-validation',
          include: ['packages/schema-validation/**/*.test.ts'],
          exclude: [...configDefaults.exclude],
          environment: 'node',
        },
      },
    ],
  },
});
