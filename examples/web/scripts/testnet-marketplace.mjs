// Explicit opt-in testnet check; never part of pnpm test. Run from examples/web.
// node --env-file=../../.env.local --env-file=../../.env.testnet.local scripts/testnet-marketplace.mjs
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  BNB_TESTNET,
  createMarketplaceClient,
  getError,
  getValue,
  isFailed,
} from '@renaiss-protocol/client';
import { signerFrom } from '@renaiss-protocol/client/viem';
import { createPublicClient, createWalletClient, erc20Abi, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bscTestnet } from 'viem/chains';

const account = privateKeyToAccount(process.env.PK);
const baseUrl =
  process.env.TESTNET_API_URL ?? 'http://127.0.0.1:3100/api/renaiss';
const transport = http(process.env.RPC_URL, { timeout: 20_000, retryCount: 1 });
const rpc = createPublicClient({ chain: bscTestnet, transport });
const wallet = createWalletClient({ chain: bscTestnet, account, transport });
const client = createMarketplaceClient({
  baseUrl,
  signer: signerFrom(wallet),
  expectedChainId: 97,
  ...(process.env.TESTNET_DIRECT === '1'
    ? { builderApiKey: process.env.RENAISS_BUILDER_API_KEY }
    : {}),
});
function value(result) {
  if (isFailed(result)) {
    const error = getError(result);
    throw new Error(`${error.code}: ${error.detail}`);
  }
  return getValue(result);
}
const directory = '../../reports';
const journalPath = `${directory}/testnet-marketplace.json`;
mkdirSync(directory, { recursive: true });
if (existsSync(journalPath)) {
  const previous = JSON.parse(readFileSync(journalPath, 'utf8'));
  assert(
    !previous.submitted || previous.complete,
    `Reconcile the previous order ${previous.orderId ?? 'from its saved token ID'} before a new test.`,
  );
}
const report = {
  api: baseUrl,
  wallet: account.address,
  startedAt: new Date().toISOString(),
};
function save() {
  writeFileSync(journalPath, `${JSON.stringify(report, null, 2)}\n`, {
    mode: 0o600,
  });
}
const config = BNB_TESTNET.marketplace;
assert.equal(config.chainId, 97);
assert.equal(await rpc.getChainId(), 97);
assert.equal(
  config.contracts.usdt.toLowerCase(),
  process.env.MOCK_TOKEN.toLowerCase(),
);
const bidAmount = 10n ** 18n; // 1 mock USDT, the minimum standing bid; resting bid only, five-minute expiry.
const balance = await rpc.readContract({
  address: config.contracts.usdt,
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: [account.address],
});
assert(balance >= bidAmount, 'Test EOA needs mock USDT');
const allowance = await rpc.readContract({
  address: config.contracts.usdt,
  abi: erc20Abi,
  functionName: 'allowance',
  args: [account.address, config.contracts.permit2],
});
assert(
  allowance >= bidAmount,
  'Approve at least 1 mock USDT to Permit2 before running this check',
);
const page = value(
  await client
    .listMarketplaceCards({ listedOnly: true, pageSize: 25 })
    .firstPage(),
);
const card = page.items.find(
  (card) =>
    card.ownerAddress.toLowerCase() !== account.address.toLowerCase() &&
    card.askPriceInUsdt &&
    BigInt(card.askPriceInUsdt) > bidAmount,
);
assert(card, 'Need a visible listed testnet card owned by another account');
report.tokenId = card.tokenId;
report.bidAmountInUsdt = bidAmount.toString();
report.balanceBefore = balance.toString();
value(await client.fetchCard({ tokenId: card.tokenId }));
const before = value(await client.fetchCardOrders({ tokenId: card.tokenId }));
assert(
  !before.activeBids.some(
    (order) =>
      order.ownerAddress.toLowerCase() === account.address.toLowerCase(),
  ),
  'Do not replace an existing user bid during the test',
);
report.submitted = true;
save();
const created = value(
  await client.createBid({
    tokenId: card.tokenId,
    amountInUsdt: bidAmount,
    expiresInSeconds: 300,
  }),
);
report.orderId = created.orderId;
report.createdStatus = created.status;
save();
assert.equal(created.executed, false);
assert.equal(created.status, 'ACTIVE');
try {
  const cancelled = value(
    await client.cancelOrder({ orderId: created.orderId }),
  );
  assert.equal(cancelled.orderId, created.orderId);
  assert.equal(cancelled.status, 'CANCELLED');
  report.cancelled = true;
  // Order reads have a short shared cache; cancellation's authenticated response
  // is authoritative, while a later read can independently confirm convergence.
  report.balanceAfter = String(
    await rpc.readContract({
      address: config.contracts.usdt,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account.address],
    }),
  );
  assert.equal(report.balanceAfter, report.balanceBefore);
  report.complete = true;
  save();
} finally {
  save();
}
console.log(JSON.stringify(report, null, 2));
