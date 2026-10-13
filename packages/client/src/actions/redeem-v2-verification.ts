import {
  addressSchema,
  bytes32Schema,
  type PreparedRedemption,
  RedemptionAddressSchema,
  type RedemptionChallenge,
  RedemptionRecipientSchema,
} from '@renaiss-protocol/schema-validation';
import { z } from 'zod';
import type { RedemptionConfig } from '../networks-v2';
import type { RenaissSigner, TypedDataPayload } from '../signers';
import {
  parse,
  RedemptionClientError,
  type RedemptionExpectation,
} from './redeem-v2';

/** Validate the Redeem intent and API context of the sign-in message before the wallet signs it. */
export function verifyRedemptionChallenge(
  challenge: RedemptionChallenge,
  config: RedemptionConfig,
  wallet: string,
  origin: string,
  walletSessionIssuer: string,
) {
  let issuer: URL;
  try {
    issuer = new URL(walletSessionIssuer);
  } catch {
    throw new RedemptionClientError('Invalid walletSessionIssuer');
  }
  const frontend = new URL(origin);
  const lines = challenge.message.split('\n');
  const invalid = () => {
    throw new RedemptionClientError(
      'Sign-in message does not match the request',
    );
  };
  if (
    issuer.protocol !== 'https:' &&
    !(
      issuer.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(issuer.hostname)
    )
  )
    invalid();
  if (
    issuer.pathname !== '/v2/auth/wallet' ||
    issuer.search ||
    issuer.hash ||
    issuer.username ||
    issuer.password
  )
    invalid();
  if (
    lines[0] !==
      `${frontend.protocol}//${frontend.host} wants you to sign in with your Ethereum account:` ||
    lines[1]?.toLowerCase() !== wallet ||
    lines[2] !== '' ||
    lines[4] !== ''
  )
    invalid();
  const statement = lines[3] ?? '';
  const shippingStatement =
    /^Sign in to Renaiss for shipping on ([\x20-\x7e]+)\. By signing, you allow ([\x20-\x7e]+) to access your Renaiss shipping and redemption requests for this wallet for up to (\d+(?:\.\d+)?) (days?|hours?|minutes?|seconds?) \(access tokens last (\d+(?:\.\d+)?) (days?|hours?|minutes?|seconds?) and can renew within this session\)\. This does not authorize a transaction\.$/.exec(
      statement,
    );
  const positive = (value: string | undefined) =>
    Number.isFinite(Number(value)) && Number(value) > 0;
  const secondsPerUnit: Record<string, bigint> = {
    day: 86_400n,
    hour: 3_600n,
    minute: 60n,
    second: 1n,
  };
  // Exact comparison: each amount is digits / 10^scale, cross-multiplied.
  const notLonger = (
    accessAmount: string | undefined,
    accessUnit: string | undefined,
    signInAmount: string | undefined,
    signInUnit: string | undefined,
  ) => {
    const access = secondsPerUnit[accessUnit?.replace(/s$/, '') ?? ''];
    const signIn = secondsPerUnit[signInUnit?.replace(/s$/, '') ?? ''];
    if (!accessAmount || !signInAmount || !access || !signIn) return false;
    const [accessInt = '', accessFrac = ''] = accessAmount.split('.');
    const [signInInt = '', signInFrac = ''] = signInAmount.split('.');
    return (
      BigInt(accessInt + accessFrac) *
        access *
        10n ** BigInt(signInFrac.length) <=
      BigInt(signInInt + signInFrac) * signIn * 10n ** BigInt(accessFrac.length)
    );
  };
  const readableShippingStatement =
    shippingStatement?.[1] === frontend.host &&
    shippingStatement[2] === frontend.host &&
    positive(shippingStatement[3]) &&
    positive(shippingStatement[5]) &&
    notLonger(
      shippingStatement[5],
      shippingStatement[6],
      shippingStatement[3],
      shippingStatement[4],
    );
  if (!readableShippingStatement) invalid();
  const fields = new Map<string, string>();
  if (lines.length !== 12) invalid();
  for (const line of lines.slice(5, 12)) {
    const colon = line.indexOf(': ');
    const key = line.slice(0, colon);
    const value = line.slice(colon + 2);
    if (colon < 0 || fields.has(key)) invalid();
    fields.set(key, value);
  }
  if (
    fields.get('URI') !== origin ||
    fields.get('Version') !== '1' ||
    fields.get('Chain ID') !== String(config.chainId) ||
    !/^[a-zA-Z0-9]{8,}$/.test(fields.get('Nonce') ?? '') ||
    fields.get('Request ID') !== challenge.challengeId ||
    fields.get('Expiration Time') !== challenge.expiresAt
  )
    invalid();
  const issued = Date.parse(fields.get('Issued At') ?? '');
  const expiry = Date.parse(challenge.expiresAt);
  const now = Date.now();
  if (issued > now + 120_000 || issued < now - 300_000 || expiry <= now)
    throw new RedemptionClientError(
      'Your device clock appears incorrect. Sync its date and time, then call signInRedemptionWallet() again.',
    );
  if (!Number.isFinite(issued) || expiry <= issued || expiry > issued + 300_000)
    invalid();

  // This metadata is not signed separately. The API binds it to the immutable,
  // single-use sign-in message and rejects any substituted message or builder
  // at /verify.
  const { issuer: returnedIssuer, audience, scopes } = challenge.context;
  if (
    returnedIssuer !== issuer.href ||
    audience !== `${issuer.origin}/v2` ||
    scopes.length !== 2 ||
    !scopes.includes('redeem:read') ||
    !scopes.includes('redeem:write')
  )
    invalid();
}

function canonical(value: unknown, normalizeAddresses = false): string {
  if (Array.isArray(value))
    return `[${value.map((v) => canonical(v, normalizeAddresses)).join(',')}]`;
  if (typeof value === 'object' && value !== null)
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([k, v]) => `${JSON.stringify(k)}:${canonical(v, normalizeAddresses)}`,
      )
      .join(',')}}`;
  // Only enable for the fixed EIP-712 authorizations below: addresses encode
  // identically regardless of casing. Shipping/contact text stays case-sensitive.
  if (
    normalizeAddresses &&
    typeof value === 'string' &&
    /^0x[\da-fA-F]{40}$/.test(value)
  )
    return JSON.stringify(value.toLowerCase());
  return JSON.stringify(typeof value === 'bigint' ? String(value) : value);
}
const uint = z
  .string()
  .regex(/^\d{1,78}$/)
  .refine((v) => BigInt(v) < 2n ** 256n);
const tokenSet = (ids: bigint[]) =>
  ids
    .map(String)
    .sort((a, b) =>
      BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0,
    );
const batchTypes = {
  BatchRedemption: [
    { name: 'requestId', type: 'bytes32' },
    { name: 'user', type: 'address' },
    { name: 'tokenIds', type: 'uint256[]' },
    { name: 'salt', type: 'uint256' },
  ],
};
const permitTypes = {
  PermitWitnessTransferFrom: [
    { name: 'permitted', type: 'TokenPermissions' },
    { name: 'spender', type: 'address' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'witness', type: 'bytes32' },
  ],
  TokenPermissions: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
  ],
};
/** Rebuild both authorizations from known types; never sign arbitrary API types. */
export async function verifyRedemptionPreparation(
  prepared: PreparedRedemption,
  expected: RedemptionExpectation,
  config: RedemptionConfig,
  wallet: string,
  signer: RenaissSigner,
) {
  const invalid = () => {
    throw new RedemptionClientError(
      'Prepared redemption does not match the reviewed checkout',
    );
  };
  if (!signer.hashTypedData)
    throw new RedemptionClientError(
      'Redemption needs a signer with hashTypedData; use the viem adapter',
    );
  const ids = parse(
    z
      .array(
        z
          .bigint()
          .nonnegative()
          .max(2n ** 256n - 1n),
      )
      .min(1)
      .max(config.maxCards),
    expected.tokenIds,
  );
  if (
    new Set(ids).size !== ids.length ||
    new Set(prepared.tokenIds).size !== prepared.tokenIds.length ||
    canonical(tokenSet(ids)) !== canonical(tokenSet(prepared.tokenIds)) ||
    prepared.walletAddress.toLowerCase() !== wallet
  )
    invalid();
  if (
    canonical(parse(RedemptionAddressSchema, expected.address)) !==
      canonical(prepared.address) ||
    canonical(parse(RedemptionRecipientSchema, expected.recipient)) !==
      canonical(prepared.recipient)
  )
    invalid();
  if (
    typeof expected.totalFeeInUsdt !== 'bigint' ||
    expected.totalFeeInUsdt <= 0n ||
    prepared.fees.totalFeeInUsdt !== expected.totalFeeInUsdt ||
    (prepared.fees.handlingFeeInUsd +
      prepared.fees.shippingFeeInUsd +
      prepared.fees.insuranceFeeInUsd) *
      10n ** 16n !==
      prepared.fees.totalFeeInUsdt
  )
    invalid();
  const expiry = Date.parse(prepared.expiresAt);
  if (expiry > Date.now() + 720_000)
    throw new RedemptionClientError(
      'The quote expiry is too far ahead. Check your device clock and request a fresh quote.',
    );
  if (!Number.isFinite(expiry)) invalid();
  if (expiry <= Date.now())
    throw new RedemptionClientError(
      'The quote expired; request a fresh quote and prepare again. An existing token approval remains valid. If this happens immediately after preparing, your device clock may be ahead; sync its date and time.',
    );
  const batchMessage = parse(
    z
      .object({
        requestId: bytes32Schema,
        user: addressSchema,
        tokenIds: z.array(uint),
        salt: uint,
      })
      .strict(),
    prepared.redemptionTypedData.message,
  );
  const batch: TypedDataPayload = {
    domain: {
      name: 'CollectibleManager',
      version: '1',
      chainId: config.chainId,
      verifyingContract: config.managerAddress,
    },
    primaryType: 'BatchRedemption',
    types: batchTypes,
    message: {
      requestId: prepared.requestId,
      user: prepared.walletAddress,
      tokenIds: tokenSet(ids),
      salt: batchMessage.salt,
    },
  };
  if (canonical(batch, true) !== canonical(prepared.redemptionTypedData, true))
    invalid();
  const message = parse(
    z
      .object({
        permitted: z.object({ token: addressSchema, amount: uint }).strict(),
        spender: addressSchema,
        nonce: uint,
        deadline: uint,
        witness: bytes32Schema,
      })
      .strict(),
    prepared.permitTypedData.message,
  );
  const witness = parse(bytes32Schema, await signer.hashTypedData(batch));
  const permit: TypedDataPayload = {
    domain: {
      name: 'Permit2',
      chainId: config.chainId,
      verifyingContract: config.permit2Address,
    },
    primaryType: 'PermitWitnessTransferFrom',
    types: permitTypes,
    message: {
      permitted: {
        token: config.tokenAddress,
        amount: String(expected.totalFeeInUsdt),
      },
      spender: config.cashierAddress,
      nonce: message.nonce,
      deadline: String(Math.floor(expiry / 1000)),
      witness,
    },
  };
  if (canonical(permit, true) !== canonical(prepared.permitTypedData, true))
    invalid();
}
