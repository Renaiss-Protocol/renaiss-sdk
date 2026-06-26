import { z } from 'zod';
import { addressSchema } from './wallet';

export const AuthenticatedUserSchema = z.object({
  user: z.object({
    avatarUrl: z.string().nullable(),
    id: z.string().uuid(),
    username: z.string(),
  }),
  wallets: z.object({
    ownerWalletAddress: addressSchema,
    safeWalletAddress: addressSchema.nullable(),
  }),
});

export type AuthenticatedUser = z.infer<typeof AuthenticatedUserSchema>;
