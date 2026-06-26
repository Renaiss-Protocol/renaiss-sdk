import { z } from 'zod';

const HEX_REGEX = /^0x[0-9a-fA-F]*$/;
const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

/** Coerces a decimal string (or number/bigint) into a `bigint`. */
export const bigIntSchema = z.coerce.bigint();

/** A `0x`-prefixed hex string. */
export const hexSchema = z
  .string()
  .refine((value) => HEX_REGEX.test(value), { message: 'Invalid hex string' });

/** A `0x`-prefixed 20-byte EVM address (any case). */
export const addressSchema = z
  .string()
  .refine((value) => ADDRESS_REGEX.test(value), { message: 'Invalid address' })
  .transform((value) => value as `0x${string}`);

/** An EVM address normalized to lowercase. */
export const lowercasedAddressSchema = addressSchema.transform(
  (value) => value.toLowerCase() as `0x${string}`,
);

/** On-chain transaction execution status. */
export const txStatusSchema = z.enum(['success', 'reverted']);
