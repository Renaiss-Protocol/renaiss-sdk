import type { ReactNode } from 'react';
import { RedeemProvider } from './redeem-provider';

/**
 * /redeem, /redeem/cart and /redeem/orders share one client provider so the
 * wallet access token, cart and journal survive client-side navigation. A full
 * reload drops the token (sign in for Redeem again); the journal is read back.
 */
export default function RedeemLayout({ children }: { children: ReactNode }) {
  // Public identity only; the builder API key remains in the backend proxy.
  const apiUrl = process.env.RENAISS_API_URL ?? 'https://api.renaiss.xyz';
  const walletSessionIssuer =
    process.env.RENAISS_WALLET_SESSION_ISSUER ??
    new URL('/v2/auth/wallet', apiUrl).href;
  return (
    <RedeemProvider walletSessionIssuer={walletSessionIssuer}>
      {children}
    </RedeemProvider>
  );
}
