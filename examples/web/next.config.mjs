import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';

/** @returns {import('next').NextConfig} */
export default function config(phase) {
  const network = process.env.NEXT_PUBLIC_RENAISS_NETWORK ?? 'testnet';
  if (network !== 'testnet' && network !== 'mainnet')
    throw new Error(
      'NEXT_PUBLIC_RENAISS_NETWORK must be "testnet" or "mainnet".',
    );
  return {
    // The repository lints with Biome (`pnpm lint`). Without this, `next build`
    // searches parent folders for an ESLint config and lints the demo with
    // whatever it finds outside the repository. Type checking still runs.
    eslint: { ignoreDuringBuilds: true },
    images: {
      remotePatterns: [
        new URL('https://8nothtoc5ds7a0x3.public.blob.vercel-storage.com/**'),
      ],
    },
    // Inline the default too. An omitted build-time variable must not become
    // a runtime server-only choice that disagrees with the browser bundle.
    env: { NEXT_PUBLIC_RENAISS_NETWORK: network },
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
  };
}
