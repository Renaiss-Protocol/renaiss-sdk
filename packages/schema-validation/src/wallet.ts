import { z } from 'zod';

const HEX_REGEX = /^0x[0-9a-fA-F]*$/;
const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;
const BYTES32_REGEX = /^0x[0-9a-fA-F]{64}$/;

/** A base-10 unsigned integer carried as a string to survive JSON. */
export const numericStringSchema = z.string().regex(/^\d+$/);

/** A `0x`-prefixed hex string. */
export const hexSchema = z
  .string()
  .refine((value) => HEX_REGEX.test(value), { message: 'Invalid hex string' });

/** A `0x`-prefixed 32-byte EVM value. */
export const bytes32Schema = z
  .string()
  .refine((value) => BYTES32_REGEX.test(value), {
    message: 'Invalid bytes32 value',
  });

/** A `0x`-prefixed 20-byte EVM address (any case). */
export const addressSchema = z
  .string()
  .refine((value) => ADDRESS_REGEX.test(value), { message: 'Invalid address' })
  .transform((value) => value as `0x${string}`);
