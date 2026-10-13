import Link from 'next/link';
import type { ReactNode } from 'react';
import { demoNetwork } from './demo-network';

export const metadata = {
  title: 'Renaiss SDK example',
  description: 'Examples for integrating @renaiss-protocol/client',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='en'>
      <body
        style={{
          background: '#090b10',
          color: '#f6efe4',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          margin: 0,
        }}
      >
        <nav
          style={{
            borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            fontSize: '0.85rem',
            gap: 16,
            padding: '10px 20px',
          }}
        >
          <Link href='/gacha' style={{ color: 'inherit' }}>
            Gacha
          </Link>
          <Link href='/marketplace' style={{ color: 'inherit' }}>
            Marketplace
          </Link>
          <Link href='/redeem' style={{ color: 'inherit' }}>
            Redemption
          </Link>
          <span
            title='Configured network'
            style={{
              marginLeft: 'auto',
              border: '1px solid currentColor',
              borderRadius: 999,
              color: demoNetwork.isTestnet ? '#a5eab8' : '#ffd283',
              padding: '3px 10px',
            }}
          >
            {demoNetwork.label}
          </span>
        </nav>
        {children}
      </body>
    </html>
  );
}
