import { z } from 'zod';
import { addressSchema, hexSchema } from './wallet';

const numericStringSchema = z.string().regex(/^\d+$/);

export enum SafeWalletDeploymentStatus {
  AlreadyDeployed = 'already_deployed',
  NeedsSignature = 'needs_signature',
  Deployed = 'deployed',
}

export enum Permit2UsdtApprovalStatus {
  AlreadyApproved = 'already_approved',
  NeedsSignature = 'needs_signature',
  Submitted = 'submitted',
}

export enum SafeWalletReadinessStatus {
  Ready = 'ready',
}

const TypedDataFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
});

export const SafeWalletSchema = z.object({
  ownerWalletAddress: addressSchema,
  safeWalletAddress: addressSchema,
});

export type SafeWallet = z.infer<typeof SafeWalletSchema>;

export const SponsoredUserOperationSchema = z.object({
  sender: addressSchema,
  nonce: numericStringSchema,
  factory: addressSchema.optional(),
  factoryData: hexSchema.optional(),
  callData: hexSchema,
  callGasLimit: numericStringSchema,
  verificationGasLimit: numericStringSchema,
  preVerificationGas: numericStringSchema,
  maxFeePerGas: numericStringSchema,
  maxPriorityFeePerGas: numericStringSchema,
  paymaster: addressSchema.optional(),
  paymasterVerificationGasLimit: numericStringSchema.optional(),
  paymasterPostOpGasLimit: numericStringSchema.optional(),
  paymasterData: hexSchema.optional(),
  signature: hexSchema.optional(),
});

export type SponsoredUserOperation = z.infer<
  typeof SponsoredUserOperationSchema
>;

export const SafeOpTypedDataSchema = z.object({
  domain: z.object({
    chainId: z.number().int().positive(),
    verifyingContract: addressSchema,
  }),
  types: z.object({
    SafeOp: z.array(TypedDataFieldSchema),
  }),
  primaryType: z.literal('SafeOp'),
  message: z.object({
    safe: addressSchema,
    callData: hexSchema,
    nonce: numericStringSchema,
    initCode: hexSchema,
    maxFeePerGas: numericStringSchema,
    maxPriorityFeePerGas: numericStringSchema,
    preVerificationGas: numericStringSchema,
    verificationGasLimit: numericStringSchema,
    callGasLimit: numericStringSchema,
    paymasterAndData: hexSchema,
    validAfter: z.number().int().nonnegative(),
    validUntil: z.number().int().nonnegative(),
    entryPoint: addressSchema,
  }),
});

export type SafeOpTypedData = z.infer<typeof SafeOpTypedDataSchema>;

export const PrepareSafeWalletDeploymentResponseSchema = z.object({
  chainId: z.number().int().positive(),
  status: z.enum([
    SafeWalletDeploymentStatus.AlreadyDeployed,
    SafeWalletDeploymentStatus.NeedsSignature,
  ]),
  safe: SafeWalletSchema,
  sponsoredUserOperation: SponsoredUserOperationSchema.nullable(),
  safeOpTypedData: SafeOpTypedDataSchema.nullable(),
});

export type PrepareSafeWalletDeploymentResponse = z.infer<
  typeof PrepareSafeWalletDeploymentResponseSchema
>;

export const DeploySafeWalletResponseSchema = z.object({
  chainId: z.number().int().positive(),
  status: z.literal(SafeWalletDeploymentStatus.Deployed),
  safe: SafeWalletSchema,
  userOperationHash: hexSchema,
  transactionHash: hexSchema,
});

export type DeploySafeWalletResponse = z.infer<
  typeof DeploySafeWalletResponseSchema
>;

export const Permit2UsdtApprovalSchema = z.object({
  tokenAddress: addressSchema,
  spenderAddress: addressSchema,
  approvalAmount: numericStringSchema,
  currentAllowance: numericStringSchema,
});

export type Permit2UsdtApproval = z.infer<typeof Permit2UsdtApprovalSchema>;

export const PreparePermit2UsdtApprovalResponseSchema = z.object({
  chainId: z.number().int().positive(),
  status: z.enum([
    Permit2UsdtApprovalStatus.AlreadyApproved,
    Permit2UsdtApprovalStatus.NeedsSignature,
  ]),
  safe: SafeWalletSchema.extend({
    deploymentStatus: z.enum([
      SafeWalletDeploymentStatus.AlreadyDeployed,
      SafeWalletDeploymentStatus.Deployed,
    ]),
    deploymentTxHash: hexSchema.nullable(),
  }),
  approval: Permit2UsdtApprovalSchema,
  sponsoredUserOperation: SponsoredUserOperationSchema.nullable(),
  safeOpTypedData: SafeOpTypedDataSchema.nullable(),
});

export type PreparePermit2UsdtApprovalResponse = z.infer<
  typeof PreparePermit2UsdtApprovalResponseSchema
>;

export const ApprovePermit2UsdtResponseSchema = z.object({
  chainId: z.number().int().positive(),
  status: z.literal(Permit2UsdtApprovalStatus.Submitted),
  safe: SafeWalletSchema,
  approval: Permit2UsdtApprovalSchema,
  userOperationHash: hexSchema,
  transactionHash: hexSchema,
});

export type ApprovePermit2UsdtResponse = z.infer<
  typeof ApprovePermit2UsdtResponseSchema
>;

export const SafeWalletReadinessResultSchema = z.object({
  status: z.literal(SafeWalletReadinessStatus.Ready),
  safe: SafeWalletSchema,
  deployment: z.object({
    status: z.enum([
      SafeWalletDeploymentStatus.AlreadyDeployed,
      SafeWalletDeploymentStatus.Deployed,
    ]),
    transactionHash: hexSchema.nullable(),
    userOperationHash: hexSchema.nullable(),
  }),
  permit2UsdtApproval: z.object({
    status: z.enum([
      Permit2UsdtApprovalStatus.AlreadyApproved,
      Permit2UsdtApprovalStatus.Submitted,
    ]),
    approval: Permit2UsdtApprovalSchema,
    transactionHash: hexSchema.nullable(),
    userOperationHash: hexSchema.nullable(),
  }),
});

export type SafeWalletReadinessResult = z.infer<
  typeof SafeWalletReadinessResultSchema
>;
