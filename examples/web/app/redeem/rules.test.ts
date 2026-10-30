import { describe, expect, it } from 'vitest';
import {
  addressLabel,
  checkPrepared,
  decideAdd,
  feeLines,
  initialRegion,
  journalKey,
  normalizeCountryCode,
  orderedRegions,
  orderNumber,
  parseJournal,
  quoteKey,
  serializeJournal,
  splitOrderCards,
  sumFmv,
  toForm,
  toRecipient,
  toShippingAddress,
  trackingLabel,
  trackingStageIndex,
  validateAddress,
  validateContact,
} from './rules';
import type { PreparedRedemption, RedeemableCard } from './types';

function card(
  tokenId: bigint,
  region = 'HK',
  fmv: bigint | null = 1000n,
): RedeemableCard {
  return {
    tokenId,
    name: `Card #${tokenId}`,
    frontImageUrl: 'https://img.example/card.png',
    rixPriceInUsd: fmv,
    rixPriceUpdatedAt: null,
    ownerAcquiredAt: null,
    regionCountryCode: region,
    vaultDisplayName: `${region} vault`,
  };
}

describe('cart rules', () => {
  it('keeps one region per cart and checks the region before the limit', () => {
    const cart = [card(1n, 'HK')];
    expect(decideAdd(cart, card(2n, 'US'), 1)).toEqual({
      kind: 'region-conflict',
      region: 'HK',
    });
    expect(decideAdd(cart, card(2n, 'HK'), 1)).toEqual({ kind: 'limit' });
    expect(decideAdd(cart, card(2n, 'HK'), 50)).toEqual({ kind: 'added' });
    expect(decideAdd(cart, card(1n, 'HK'))).toEqual({ kind: 'already' });
  });

  it('sums FMV in bigint cents and reports N/A when nothing is priced', () => {
    expect(
      sumFmv([
        card(1n, 'HK', 150n),
        card(2n, 'HK', null),
        card(3n, 'HK', 250n),
      ]),
    ).toBe(400n);
    expect(sumFmv([card(1n, 'HK', null)])).toBeNull();
  });
});

describe('checkout form', () => {
  const address = {
    countryCode: 'US',
    addressLine1: '1 Example Street',
    addressLine2: '',
    city: 'Exampleville',
    state: '',
    postalCode: '12345',
  };

  it('does not decide whether a state is needed; the API does', () => {
    expect(validateAddress(address)).toEqual({});
    expect(validateAddress({ ...address, state: 'TX' })).toEqual({});
    expect(
      validateAddress({ ...address, state: 'x'.repeat(201) }).state,
    ).toMatch(/200/);
  });

  it.each([
    ' US ',
    ' us ',
    'u s',
    'usa',
  ])('normalises the country code "%s" to "US"', (raw) => {
    expect(normalizeCountryCode(raw)).toBe('US');
  });

  it('validates and serialises a padded country code as the bare code', () => {
    const padded = { ...address, countryCode: ' us ' };
    expect(validateAddress(padded)).toEqual({});
    expect(toShippingAddress(padded).countryCode).toBe('US');
  });

  it.each([
    '',
    ' ',
    'U',
    'U1',
  ])('rejects the country code "%s" before any request', (countryCode) => {
    expect(validateAddress({ ...address, countryCode }).countryCode).toMatch(
      /two-letter country code/,
    );
  });

  it('accepts any two-letter uppercase country code', () => {
    expect(validateAddress({ ...address, countryCode: 'TW' })).toEqual({});
  });

  it.each([
    {
      countryCode: 'TW',
      addressLine1: '1 Example Street',
      city: 'Exampleville',
      postalCode: '12345',
    },
    // A state is kept even where one is not usually needed.
    {
      countryCode: 'HK',
      addressLine1: '1 Example Street',
      city: 'Exampleville',
      state: 'Kowloon',
      postalCode: '12345',
    },
    {
      countryCode: 'DE',
      addressLine1: '1 Example Street',
      city: 'Exampleville',
      state: 'Bavaria',
      postalCode: '12345',
    },
  ])('edits and resubmits a saved $countryCode address unchanged', (saved) => {
    const form = toForm(saved);
    expect(form.countryCode).toBe(saved.countryCode);
    expect(form.state).toBe('state' in saved ? saved.state : '');
    expect(validateAddress(form)).toEqual({});
    expect(toShippingAddress(form)).toEqual(saved);
    // Editing another field keeps the country and state as they were.
    expect(toShippingAddress({ ...form, city: 'Otherville' })).toEqual({
      ...saved,
      city: 'Otherville',
    });
  });

  it('enforces the address line length limit', () => {
    const long = 'x'.repeat(36);
    const errors = validateAddress({
      ...address,
      state: 'TX',
      addressLine1: long,
    });
    expect(errors.addressLine1).toMatch(/35/);
  });

  it('omits blank optional address fields from the request', () => {
    expect(toShippingAddress({ ...address, state: '  ' })).toEqual({
      countryCode: 'US',
      addressLine1: '1 Example Street',
      city: 'Exampleville',
      postalCode: '12345',
    });
  });

  it('caps the combined name at 22 characters and requires E.164 phones', () => {
    const contact = {
      firstName: 'Bartholomew',
      lastName: 'Featherstonehaugh',
      email: 'ann@example.com',
      phone: '+12025550101',
      taxId: '',
      chineseName: '',
    };
    expect(validateContact(contact, 'HK').lastName).toMatch(/22/);
    const ok = { ...contact, firstName: 'Ann', lastName: 'Lee' };
    expect(validateContact(ok, 'HK')).toEqual({});
    expect(
      validateContact({ ...ok, phone: '12345678' }, 'HK').phone,
    ).toBeDefined();
  });

  it('asks for a Han-character name in Taiwan and a tax ID where required', () => {
    const contact = {
      firstName: 'Ann',
      lastName: 'Lee',
      email: 'ann@example.com',
      phone: '+12025550102',
      taxId: '',
      chineseName: 'Ann',
    };
    expect(validateContact(contact, 'TW').chineseName).toMatch(/Chinese/);
    expect(validateContact(contact, 'TW').taxId).toMatch(/required/);
    expect(
      validateContact(
        { ...contact, chineseName: '示例姓名', taxId: 'EXAMPLE-0001' },
        'TW',
      ),
    ).toEqual({});
    expect(validateContact(contact, 'DE').taxId).toBeDefined();
    expect(validateContact(contact, 'HK').taxId).toBeUndefined();
  });

  it('drops tax ID and Chinese name for destinations that do not use them', () => {
    const recipient = toRecipient(
      {
        firstName: 'Ann',
        lastName: 'Lee',
        email: 'ann@example.com',
        phone: '+1 202-555-0101',
        taxId: 'X',
        chineseName: '示例姓名',
      },
      'HK',
    );
    expect(recipient).toEqual({
      name: 'Ann Lee',
      phone: '+12025550101',
      email: 'ann@example.com',
    });
  });

  it('formats the address label', () => {
    expect(
      addressLabel({
        countryCode: 'US',
        addressLine1: '1 Example Street',
        city: 'Exampleville',
        state: 'TX',
        postalCode: '12345',
      }),
    ).toBe('1 Example Street, Exampleville, TX, 12345, US');
  });

  it('invalidates a quote when the address or the card set changes', () => {
    const base = {
      countryCode: 'HK',
      addressLine1: 'A',
      city: 'B',
      postalCode: '0',
    };
    expect(quoteKey(base, [2n, 1n])).toBe(quoteKey(base, [1n, 2n]));
    expect(quoteKey(base, [1n])).not.toBe(quoteKey(base, [1n, 2n]));
    expect(quoteKey({ ...base, postalCode: '1' }, [1n])).not.toBe(
      quoteKey(base, [1n]),
    );
  });
});

describe('fees', () => {
  const courier = {
    id: 'c',
    name: 'Example Courier',
    logoUrl: null,
    estimatedDays: '3-5 working days',
    shippingFeeInUsd: 2599n,
    insuranceFeeInUsd: 120n,
    dutyAndTaxesInUsd: 999n,
  };
  const quote = {
    quoteId: 'q',
    expiresAt: '2026-01-01T00:10:00.000Z',
    handlingFeeInUsd: 400n,
    couriers: [courier],
  };

  it('adds handling, shipping and optional insurance, never duties', () => {
    expect(feeLines(quote, courier, false).total).toBe(2999n);
    expect(feeLines(quote, courier, true).total).toBe(3119n);
    expect(feeLines(quote, courier, true).duties).toBe(999n);
  });
});

describe('preparation cross-check', () => {
  const prepared: PreparedRedemption = {
    preparationId: 'p',
    requestId: `0x${'ab'.repeat(32)}`,
    walletAddress: '0x000000000000000000000000000000000000dEaD',
    tokenIds: [2n, 1n],
    expiresAt: '2026-01-01T00:10:00.000Z',
    address: {
      countryCode: 'HK',
      addressLine1: 'A',
      city: 'B',
      postalCode: '0',
    },
    recipient: {
      name: 'Ann Lee',
      phone: '+12025550101',
      email: 'ann@example.com',
    },
    courierName: 'Example Courier',
    fees: {
      handlingFeeInUsd: 400n,
      shippingFeeInUsd: 2599n,
      insuranceFeeInUsd: 0n,
      dutyAndTaxesInUsd: 0n,
      totalFeeInUsdt: 29_990_000_000_000_000_000n,
    },
    redemptionTypedData: {
      domain: {},
      types: {},
      primaryType: 'BatchRedemption',
      message: {},
    },
    permitTypedData: {
      domain: {},
      types: {},
      primaryType: 'PermitWitnessTransferFrom',
      message: {},
    },
  };
  const expected = {
    tokenIds: [1n, 2n],
    totalFeeInUsdt: 29_990_000_000_000_000_000n,
    address: prepared.address,
    recipient: prepared.recipient,
  };
  const now = Date.parse('2026-01-01T00:00:00.000Z');

  it('accepts a matching preparation regardless of token order', () => {
    expect(
      checkPrepared(
        prepared,
        expected,
        '0x000000000000000000000000000000000000dead',
        now,
      ),
    ).toBeNull();
  });

  it('rejects drift in wallet, cards, amount, expiry, address or recipient', () => {
    expect(
      checkPrepared(
        prepared,
        expected,
        '0x1111111111111111111111111111111111111111',
        now,
      ),
    ).toMatch(/wallet/);
    expect(
      checkPrepared(
        prepared,
        { ...expected, tokenIds: [1n] },
        prepared.walletAddress,
        now,
      ),
    ).toMatch(/cards/);
    expect(
      checkPrepared(
        prepared,
        { ...expected, totalFeeInUsdt: 1n },
        prepared.walletAddress,
        now,
      ),
    ).toMatch(/total/);
    expect(
      checkPrepared(
        prepared,
        expected,
        prepared.walletAddress,
        now + 3_600_000,
      ),
    ).toMatch(/expired/);
    expect(
      checkPrepared(
        prepared,
        { ...expected, address: { ...expected.address, postalCode: '9' } },
        prepared.walletAddress,
        now,
      ),
    ).toMatch(/address/);
    expect(
      checkPrepared(
        prepared,
        {
          ...expected,
          recipient: { ...expected.recipient, email: 'other@example.com' },
        },
        prepared.walletAddress,
        now,
      ),
    ).toMatch(/contact/);
  });
});

describe('order display', () => {
  it('maps status and courier strings to the four tracking stages', () => {
    expect(trackingStageIndex('Initiated', null)).toBe(0);
    expect(trackingStageIndex('Processing', 'Delivered')).toBe(0);
    expect(trackingStageIndex('Shipped', null)).toBe(1);
    expect(trackingStageIndex('Shipped', 'Tracking Info Received')).toBe(1);
    expect(trackingStageIndex('Shipped', 'out for delivery')).toBe(2);
    expect(trackingStageIndex('Shipped', 'Delivered')).toBe(3);
    expect(trackingStageIndex('Shipped', 'created')).toBe(1);
    expect(trackingStageIndex('Shipped', 'in_transit')).toBe(2);
    expect(trackingStageIndex('Canceled', null)).toBe(-1);
  });

  it.each([
    'exception',
    'in transit',
    'in_transit',
    'in-transit',
    'in transit to customer',
    'out for delivery',
    'failed delivery attempt',
  ])('puts a shipped order with courier status "%s" in transit', (status) => {
    expect(trackingStageIndex('Shipped', status)).toBe(2);
  });

  it('labels cancelled, failed and exception orders consistently', () => {
    expect(trackingLabel('Canceled', null)).toBe('Cancelled');
    expect(trackingLabel('Failed', null)).toBe('Failed');
    expect(trackingLabel('Shipped', 'exception')).toBe('Exception');
    expect(trackingLabel('Shipped', 'delivered')).toBe('Delivered');
    expect(trackingLabel('Initiated', null)).toBe('Initiated');
  });

  it('splits owner-cancelled cards out of the redemption summary', () => {
    const cards = [{ tokenId: 1n }, { tokenId: 2n }];
    const split = splitOrderCards(cards, {
      '2': 'REDEMPTION_OWNER_CANCELED',
      '1': 'REDEMPTION_VAULT_DISPATCHED',
    });
    expect(split.available.map((c) => c.tokenId)).toEqual([1n]);
    expect(split.cancelled.map((c) => c.tokenId)).toEqual([2n]);
  });

  it('shortens request ids to a short order number', () => {
    expect(orderNumber(`0x${'ab'.repeat(32)}`)).toBe('0xabab...abab');
  });
});

describe('recovery journal', () => {
  it('persists only opaque ids and the wallet, never form or token data', () => {
    const raw = serializeJournal({
      preparationId: 'p',
      requestId: '0x1',
      walletAddress: '0xabc',
      savedAt: '2026-01-01T00:00:00.000Z',
      ...({
        accessToken: 'secret',
        addressLine1: '1 Example Street',
      } as object),
    });
    expect(JSON.parse(raw)).toEqual({
      preparationId: 'p',
      requestId: '0x1',
      walletAddress: '0xabc',
      savedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(raw).not.toContain('secret');
  });

  it('rejects malformed or foreign journal entries', () => {
    expect(parseJournal(null)).toBeNull();
    expect(parseJournal('{"preparationId":1}')).toBeNull();
    expect(parseJournal('not json')).toBeNull();
    expect(
      parseJournal(
        '{"preparationId":"p","requestId":"r","walletAddress":"w","savedAt":"s"}',
      ),
    ).toEqual({
      preparationId: 'p',
      requestId: 'r',
      walletAddress: 'w',
      savedAt: 's',
    });
  });

  it('scopes the storage key by chain and API base', () => {
    expect(journalKey(97, 'https://api.example')).toBe(
      'renaiss:redeem-demo:97:https://api.example:pending',
    );
  });
});

describe('regions', () => {
  it('orders the regions the API returned by country code', () => {
    expect(orderedRegions({ US: 2, AA: 0, MY: 1 })).toEqual(['AA', 'MY', 'US']);
  });

  it('selects the first region in code order that has cards', () => {
    expect(initialRegion({ ZZ: 4, AA: 0, MM: 1 })).toBe('MM');
  });

  it('selects all when no region has cards or none is returned', () => {
    expect(initialRegion({ AA: 0, BB: 0 })).toBe('all');
    expect(initialRegion({})).toBe('all');
    expect(orderedRegions({})).toEqual([]);
  });
});
