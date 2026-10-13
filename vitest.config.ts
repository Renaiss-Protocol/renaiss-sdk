import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'web',
          include: ['examples/web/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'bindings',
          include: ['packages/bindings/**/*.test.mjs'],
        },
      },
      {
        extends: true,
        test: {
          name: 'client',
          include: ['packages/client/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'error-codes',
          include: ['packages/error-codes/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'fp',
          include: ['packages/fp/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'schema-validation',
          include: ['packages/schema-validation/**/*.test.ts'],
        },
      },
    ],
  },
});
