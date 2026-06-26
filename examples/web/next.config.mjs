/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@renaiss-protocol/client',
    '@renaiss-protocol/fp',
    '@renaiss-protocol/error-codes',
  ],
};

export default nextConfig;
