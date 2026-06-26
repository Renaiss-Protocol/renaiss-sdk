---
name: new-package
description: Scaffold a new SDK package
---

# Create a New Package

Creates a new package in `packages/<name>`.

## Usage

```
/new-package <name>
```

## Requirements

- Use TodoWrite for the main steps
- Create:
  - `packages/<name>/package.json`
  - `packages/<name>/README.md`
  - `packages/<name>/src/index.ts`
  - `packages/<name>/tsconfig.build.json`
  - `packages/<name>/tsconfig.json`
  - `packages/<name>/tsup.config.ts`
- Use npm package name `@renaiss-protocol/<name>` unless the user asks otherwise
- Create `README.md` from `.claude/skills/new-package/templates/README.md.template`, replacing placeholders for package name and description
- Keep the package ESM-only
- Set `main` to `dist/index.js` and `types` to `dist/index.d.ts`
- Export `.` from `./dist/index.js`
- Use `files: ["dist"]`, `sideEffects: false`, `license: MIT`, `publishConfig.access: public`
- Add `build` as `tsup` and `typecheck` as `tsc -p tsconfig.build.json --noEmit`
- Use repo versions for `tsup` and `typescript`
- Start `src/index.ts` with `export {};` unless the user asks for real exports
- Add a path mapping in the root `tsconfig.json` for `@renaiss-protocol/<name>`
- Do not add extra files, generators, tests, or docs unless requested

## Validation

- Run `pnpm --filter @renaiss-protocol/<name> build`
- Run `pnpm --filter @renaiss-protocol/<name> typecheck`
- If the new package is wired into another workspace package in the same task, build it before validating the dependent package. If multiple workspace packages changed or the dependency chain is unclear, prefer `pnpm build` from the repo root first.
