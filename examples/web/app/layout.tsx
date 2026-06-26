import type { ReactNode } from 'react';

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
        {children}
      </body>
    </html>
  );
}
