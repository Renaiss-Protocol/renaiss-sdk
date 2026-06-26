# Renaiss TypeScript SDK

![Beta](https://img.shields.io/badge/status-beta-yellow)

This repository is the home for Renaiss's official TypeScript SDK packages, enabling third-party integrators to embed the Renaiss gacha experience.

## Beta Status

The TypeScript SDK is currently in beta. We are working toward a stable public API and will use feedback during the beta period to refine the developer experience.

We welcome bug reports, feature requests, and general feedback through GitHub Issues. Please use the provided issue templates so we can triage reports consistently.

## Repository Structure

This repository is organized as a pnpm workspace with SDK packages and (later) examples.

| Package                                                          | Description                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| [`packages/client`](./packages/client)                           | Official TypeScript client for building on Renaiss _(coming soon)_  |
| [`packages/schema-validation`](./packages/schema-validation)     | Shared Zod schemas and validation primitives                        |
| [`packages/fp`](./packages/fp)                                   | `Result`/`Action` primitives — errors as values, never throw        |
| [`packages/error-codes`](./packages/error-codes)                 | Shared error codes                                                  |

For installation and usage, see [`packages/client`](./packages/client) once published.

## Local Development

### Requirements

- Node.js `>=24`
- pnpm `>=10`

Install dependencies:

```bash
nvm use
corepack install
pnpm install
```

Set up local environment variables:

```bash
cp .env.example .env
```

Then open `.env` and fill in the fields.

Build all workspace packages:

```bash
pnpm build
```

### Development Scripts

The root scripts are:

- `pnpm build` - build all workspace packages that expose a build script
- `pnpm clean` - remove package build output from `packages/*/dist`
- `pnpm lint` / `pnpm lint:fix` - lint with Biome
- `pnpm typecheck` - typecheck all packages
- `pnpm test` - run the test suite

## TypeScript Config

- Root `tsconfig.json` and package-level `tsconfig.json` files are for editor tooling and source navigation.
- `tsconfig.build.json` files are the configs used by package build and typecheck commands.
- When changing build behavior, prefer updating `tsconfig.build.json`.

## Maintainer Notes

### Publishing

Publishing is managed by the Changesets GitHub Action and will be enabled once an npm organization and publish credentials are configured.

## License

This project is licensed under the [MIT License](./LICENSE).
