import type { EoaPreparedPull, RenaissNetwork } from '@renaiss-protocol/client';

/** Reject another deployment before any on-chain approval or wallet signature. */
export function assertPullNetwork(
  prepared: EoaPreparedPull,
  network: RenaissNetwork,
) {
  const { usdt, permit2 } = network.marketplace.contracts;
  const typed = prepared.permit2TypedData;
  if (
    prepared.pack.vendingMachineAddress.toLowerCase() !==
      network.vendingMachineAddress.toLowerCase() ||
    typed.message.spender.toLowerCase() !==
      network.vendingMachineAddress.toLowerCase() ||
    prepared.chainId !== network.chainId ||
    typed.domain.chainId !== network.chainId ||
    prepared.approval.token.toLowerCase() !== usdt.toLowerCase() ||
    typed.message.permitted.token.toLowerCase() !== usdt.toLowerCase() ||
    prepared.approval.spender.toLowerCase() !== permit2.toLowerCase() ||
    typed.domain.verifyingContract.toLowerCase() !== permit2.toLowerCase()
  )
    throw new Error(
      'The API preparation does not match the configured network, vending machine, USDT or Permit2. Check the demo environment settings.',
    );
}
