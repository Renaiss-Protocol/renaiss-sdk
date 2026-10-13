export type ContractAddress = `0x${string}`;

/** Static integration metadata, versioned with the SDK; no HTTP request is needed. */
export type MarketplaceConfig = {
  readonly chainId: number;
  readonly platformFeeBps: number;
  readonly contracts: {
    readonly nft: ContractAddress;
    readonly usdt: ContractAddress;
    readonly permit2: ContractAddress;
    readonly orderbook: ContractAddress;
  };
};
/**
 * Static redemption contract addresses and limits. It carries no country list:
 * the API decides at quote and address validation time which destinations it
 * ships to (an unsupported country returns `WRONG_REQUEST_PARAMS`), and an app
 * supplies its own country list for its address form.
 */
export type RedemptionConfig = {
  readonly chainId: number;
  readonly tokenAddress: ContractAddress;
  readonly permit2Address: ContractAddress;
  readonly cashierAddress: ContractAddress;
  readonly managerAddress: ContractAddress;
  readonly maxCards: number;
};
export type RenaissNetwork = {
  readonly chainId: number;
  readonly vendingMachineAddress: ContractAddress;
  readonly marketplace: MarketplaceConfig;
  readonly redemption: RedemptionConfig;
};

/** Server-enforced cart limit; update together with the API and network reference. */
export const MAX_REDEMPTION_CARDS = 50;

/** BNB testnet (97): the supported v2 evaluation deployment, verified 2026-09-29.
 * Contract or fee changes require a coordinated SDK release. Never replace
 * these expectations with addresses or fees taken from a signing response.
 */
export const BNB_TESTNET: RenaissNetwork = Object.freeze({
  chainId: 97,
  vendingMachineAddress: '0xeeddf88d5cb406cc27f6eea4636566b4943e3737',
  marketplace: Object.freeze({
    chainId: 97,
    platformFeeBps: 200,
    contracts: Object.freeze({
      nft: '0x57eE95884Ac93E6d081Fd9366AFEF9891C8Eceb4',
      usdt: '0x3d2745c844cee4a62B66DF18b5Fd93781C26958b',
      permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
      orderbook: '0x2F562bAE70Ea1Efc9BFC7BC9ccE9a4e2d6bE8A6c',
    }),
  }),
  redemption: Object.freeze({
    chainId: 97,
    tokenAddress: '0x3d2745c844cee4a62B66DF18b5Fd93781C26958b',
    permit2Address: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    cashierAddress: '0x34C63BDD63c437aAd7dA28961817DEb981a06A29',
    managerAddress: '0xc3dc2f3a70742c5ec29b82a60a2d0fe1e3b558ed',
    maxCards: MAX_REDEMPTION_CARDS,
  }),
});

/**
 * BNB mainnet (56). Contracts verified on-chain 2026-09-29.
 * Select explicitly; SDK clients continue to default to BNB_TESTNET.
 * Requires an API deployment and builder credential for this network.
 * Contract or fee changes require a coordinated SDK release.
 */
export const BNB_MAINNET: RenaissNetwork = Object.freeze({
  chainId: 56,
  vendingMachineAddress: '0xd4d18607d6111c5fa2f93a4a5b2c0e28f1563f9f',
  marketplace: Object.freeze({
    chainId: 56,
    platformFeeBps: 200,
    contracts: Object.freeze({
      nft: '0xF8646A3Ca093e97Bb404c3b25e675C0394DD5b30',
      usdt: '0x55d398326f99059fF775485246999027B3197955',
      permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
      orderbook: '0xAE3e7268EF5A062946216A44f58A8F685fFD11d0',
    }),
  }),
  redemption: Object.freeze({
    chainId: 56,
    tokenAddress: '0x55d398326f99059fF775485246999027B3197955',
    permit2Address: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    cashierAddress: '0x3F364C839fa0C81485d39E2887917153d95e63AF',
    managerAddress: '0xB95F8867fF54fd16342Cb414c0F57237be7Dc512',
    maxCards: MAX_REDEMPTION_CARDS,
  }),
});
