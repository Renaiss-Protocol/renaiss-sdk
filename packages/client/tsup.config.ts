/* eslint-disable import/no-default-export */

import { defineConfig } from 'tsup';

export default defineConfig(() => ({
  entry: ['src/index.ts', 'src/viem.ts'],
  outDir: 'dist',
  sourcemap: true,
  treeshake: true,
  clean: true,
  tsconfig: 'tsconfig.build.json',
  bundle: true,
  // Inline the internal @renaiss-protocol/* workspace packages into the client
  // bundle (JS + types) so `@renaiss-protocol/client` is the only published
  // package. Third-party deps (zod, fp-ts, http-status-codes) stay external.
  noExternal: [/^@renaiss-protocol\//],
  minify: true,
  // `noExternal` inlines the JS; `dts.resolve` is needed to also inline the
  // *type* declarations from the internal packages into the bundled .d.ts
  // (otherwise tsup leaves them as external `import ... from "@renaiss-protocol/..."`).
  //
  // The `/generated/` pattern is required too: the root tsconfig `paths` map
  // resolves `@renaiss-protocol/bindings/api` to its *source* (`bindings/api`),
  // whose barrel re-exports the openapi types via relative imports
  // (`./generated`, `./error-codes.generated`). Those specifiers don't match the
  // `@renaiss-protocol/` pattern, so without this they leak into the published
  // `.d.ts` as dangling `import ... from "./generated"` and break consumers'
  // typechecks. Resolving them inlines the generated types instead.
  dts: { resolve: [/^@renaiss-protocol\//, /generated/] },
  platform: 'neutral',
  format: ['esm'],
}));
