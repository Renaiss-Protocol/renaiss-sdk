// Explicit opt-in funded integration check. Never part of pnpm test.
// Run from examples/web after building the SDK; see README.md.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  createGachaClient,
  getError,
  getValue,
  isFailed,
} from '@renaiss-protocol/client';
import { signerFrom } from '@renaiss-protocol/client/viem';
import { createPublicClient, createWalletClient, erc20Abi, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bscTestnet } from 'viem/chains';

const baseUrl =
  process.env.TESTNET_API_URL ?? 'http://127.0.0.1:3100/api/renaiss';
const account = privateKeyToAccount(process.env.PK);
const transport = http(process.env.RPC_URL, { timeout: 20_000, retryCount: 1 });
const rpc = createPublicClient({ chain: bscTestnet, transport });
const wallet = createWalletClient({ account, chain: bscTestnet, transport });
const sdk = createGachaClient({
  baseUrl,
  expectedChainId: 97,
  signer: signerFrom(wallet),
  ...(process.env.TESTNET_DIRECT === '1'
    ? { builderApiKey: process.env.RENAISS_BUILDER_API_KEY }
    : {}),
});
const directory = '../../reports';
mkdirSync(directory, { recursive: true });
const journalPath = `${directory}/testnet-flow.json`;
if (existsSync(journalPath)) {
  const previous = JSON.parse(readFileSync(journalPath, 'utf8'));
  if (previous.submitted && !previous.complete)
    throw new Error(
      `Unreconciled test submission. Recover ${previous.permitFundTxHash ?? 'from chain/history'} before a new test.`,
    );
}
const report = {
  api: baseUrl,
  buyer: account.address,
  startedAt: new Date().toISOString(),
  events: [],
};
function save() {
  writeFileSync(journalPath, `${JSON.stringify(report, null, 2)}\n`, {
    mode: 0o600,
  });
}
function value(result) {
  if (isFailed(result)) {
    const e = getError(result);
    throw new Error(`${e.code}: ${e.detail}`);
  }
  return getValue(result);
}
async function balance(token) {
  return rpc.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account.address],
  });
}
assert.equal(await rpc.getChainId(), 97);
assert.equal(
  await rpc.getCode({ address: account.address }),
  undefined,
  'EOA must have no deployed code',
);
const slug = process.env.PACK_SLUG;
if (!slug) {
  console.error('Set PACK_SLUG to the slug of the machine to test.');
  process.exit(1);
}
const machine = value(await sdk.fetchGachaMachine({ slug }));
value(await sdk.listGachaMachines({ pageSize: 2 }).firstPage());
value(await sdk.listGachaMachineContents({ slug, pageSize: 2 }).firstPage());
value(await sdk.listGachaPullHistory({ slug, pageSize: 2 }).firstPage());
const prepared = value(
  await sdk.prepareGachaPull({
    machineSlug: slug,
    expectedPriceInUsdt: BigInt(machine.priceInUsdt),
    buyerWalletAddress: account.address,
  }),
);
assert.equal(prepared.chainId, 97);
assert.equal(
  prepared.approval.token.toLowerCase(),
  (
    process.env.MOCK_TOKEN ?? '0x3d2745c844cee4a62B66DF18b5Fd93781C26958b'
  ).toLowerCase(),
);
assert.equal(
  prepared.approval.spender.toLowerCase(),
  '0x000000000022d473030f116ddee9f6b43ac78ba3',
);
const token = prepared.approval.token;
const required = BigInt(prepared.approval.requiredAmount);
assert(
  required > 0n && required === BigInt(machine.priceInUsdt),
  'The test must pay for exactly one card',
);
const before = await balance(token);
assert(before >= required, 'Insufficient mock token balance');
assert(
  (await rpc.getBalance({ address: account.address })) > 0n,
  'EOA needs native testnet gas',
);
Object.assign(report, {
  chainId: 97,
  packId: machine.id,
  packSlug: slug,
  token,
  builderCode: prepared.unsignedPullPayload.builderCode,
  payment: required.toString(),
  balanceBefore: before.toString(),
});
console.log('Preflight passed', {
  buyer: report.buyer,
  token,
  payment: report.payment,
  balance: report.balanceBefore,
});
const allowance = await rpc.readContract({
  address: token,
  abi: erc20Abi,
  functionName: 'allowance',
  args: [account.address, prepared.approval.spender],
});
if (allowance < required) {
  for (const amount of allowance > 0n ? [0n, required] : [required]) {
    const hash = await wallet.writeContract({
      address: token,
      abi: erc20Abi,
      functionName: 'approve',
      args: [prepared.approval.spender, amount],
    });
    const receipt = await rpc.waitForTransactionReceipt({
      hash,
      timeout: 60_000,
    });
    assert.equal(receipt.status, 'success');
    console.log('Approved', hash);
  }
}
const signed = value(
  await sdk.signGachaPull({
    prepared,
    expected: {
      packId: machine.id,
      onChainPackId: machine.onChainPackId,
      priceInUsdt: BigInt(machine.priceInUsdt),
      quantity: 1,
    },
  }),
);
report.submitted = true;
save();
const result = await sdk.submitGachaPull({
  pull: signed,
  onEvent(event) {
    report.events.push(event.event);
    if ('permitFundTxHash' in event.data && event.data.permitFundTxHash)
      report.permitFundTxHash = event.data.permitFundTxHash;
    save();
    console.log(
      event.event,
      'permitFundTxHash' in event.data ? event.data.permitFundTxHash : '',
    );
  },
});
const pull = value(result);
report.pull = pull;
save();
assert.equal(pull.draws.length, 1);
const status = value(
  await sdk.fetchGachaDrawStatus({
    buyerWalletAddress: account.address,
    permitFundTxHash: pull.permitFundTxHash,
  }),
);
assert.equal(status.status, 'RESOLVED');
const history = value(
  await sdk
    .listWalletPulls({ buyerWalletAddress: account.address })
    .firstPage(),
);
assert(history.items.some((p) => p.permitFundTxHash === pull.permitFundTxHash));
const offers = value(
  await sdk.fetchGachaBuybackOffers({ buyerWalletAddress: account.address }),
);
const offer = offers.find((o) => o.settlementId === pull.draws[0].settlementId);
assert(offer, 'Resolved draw should have a current buyback offer');
const buyback = value(
  await sdk.createGachaBuyback({
    buyerWalletAddress: account.address,
    offers: [offer],
    chainId: prepared.chainId,
    token,
  }),
);
const payout = value(await sdk.submitGachaBuyback(buyback));
report.buyback = payout;
save();
const receipt = await rpc.waitForTransactionReceipt({
  hash: payout.txHash,
  timeout: 60_000,
});
assert.equal(receipt.status, 'success');
const after = await balance(token);
assert.equal(after, before - required + BigInt(payout.totalAmountInUsdt));
report.balanceAfter = after.toString();
report.balanceReconciled = true;
report.finalStatus = value(
  await sdk.fetchGachaDrawStatus({
    buyerWalletAddress: account.address,
    permitFundTxHash: pull.permitFundTxHash,
  }),
);
assert.equal(
  report.finalStatus.draws[0].buybackTxHash?.toLowerCase(),
  payout.txHash.toLowerCase(),
);
report.complete = true;
report.completedAt = new Date().toISOString();
save();
console.log('Testnet flow passed', {
  funding: pull.permitFundTxHash,
  buyback: payout.txHash,
  payment: report.payment,
  payout: payout.totalAmountInUsdt,
  balanceBefore: report.balanceBefore,
  balanceAfter: report.balanceAfter,
});
