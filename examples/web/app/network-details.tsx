import { demoNetwork } from './demo-network';

export function NetworkDetails() {
  return (
    <p>
      {demoNetwork.label} · Chain ID {demoNetwork.chain.id} ·{' '}
      {demoNetwork.tokenLabel}
    </p>
  );
}
