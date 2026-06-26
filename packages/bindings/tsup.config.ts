/* eslint-disable import/no-default-export */

import { defineConfig } from 'tsup';

export default defineConfig(() => ({
  entry: {
    index: 'src/index.ts',
    'api/index': 'api/index.ts',
  },
  outDir: 'dist',
  sourcemap: true,
  treeshake: true,
  clean: true,
  tsconfig: 'tsconfig.build.json',
  bundle: true,
  minify: true,
  dts: true,
  platform: 'neutral',
  format: ['esm'],
}));
