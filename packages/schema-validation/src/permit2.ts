import type { GachaPermit2TypedData } from './gacha';

/**
 * EIP-712 struct for a Permit2 witness transfer carrying a gacha pull.
 *
 * This must match the deployed TokenVendingMachineV3 witness. A mismatch does
 * not fail to compile — it produces a signature that recovers to the wrong
 * address at signing time.
 */
const GACHA_PULL_PERMIT2_TYPES = {
  PermitWitnessTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions' },
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'witness', type: 'PermitFundWitness' },
  ],
  TokenPermissions: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
  PermitFundWitness: [
    { name: 'packId', type: 'bytes32' },
    { name: 'builder', type: 'bytes32' },
    { name: 'numOfTokens', type: 'uint256' },
  ],
} as const;

type BuildGachaPullTypedDataInput = {
  amountPerToken: string;
  builderCode: string;
  chainId: number;
  deadline: number;
  nonce: string;
  numOfTokens: number;
  onChainPackId: string;
  permit2Address: string;
  usdtAddress: string;
  vendingMachineAddress: string;
};

/**
 * Builds the Permit2 typed data the buyer signs to fund a gacha pull.
 *
 * @remarks
 * `permitted.amount` is the whole pull — `amountPerToken * numOfTokens` — while
 * the payload's `amountPerToken` stays per-token, matching what the vending
 * machine verifies.
 */
export function buildGachaPullTypedData(
  input: BuildGachaPullTypedDataInput,
): GachaPermit2TypedData {
  const totalAmount = (
    BigInt(input.amountPerToken) * BigInt(input.numOfTokens)
  ).toString();

  return {
    domain: {
      name: 'Permit2',
      chainId: input.chainId,
      verifyingContract: input.permit2Address as `0x${string}`,
    },
    types: GACHA_PULL_PERMIT2_TYPES as unknown as Record<
      string,
      { name: string; type: string }[]
    >,
    primaryType: 'PermitWitnessTransferFrom',
    message: {
      permitted: {
        token: input.usdtAddress as `0x${string}`,
        amount: totalAmount,
      },
      spender: input.vendingMachineAddress as `0x${string}`,
      nonce: input.nonce,
      // Serialized as a string here because the signed struct types it
      // `uint256`, while the stream payload carries it as a JSON number.
      deadline: String(input.deadline),
      witness: {
        packId: input.onChainPackId,
        builder: input.builderCode,
        numOfTokens: String(input.numOfTokens),
      },
    },
  };
}
