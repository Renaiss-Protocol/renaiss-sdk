import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'api/index': 'api/index.ts',
  },
  sourcemap: true,
  treeshake: true,
  clean: true,
  tsconfig: 'tsconfig.build.json',
  minify: true,
  dts: true,
  platform: 'neutral',
  format: ['esm'],
});
