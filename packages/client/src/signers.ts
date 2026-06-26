export type TypedDataField = {
  name: string;
  type: string;
};

export type TypedDataPayload = {
  domain: Record<string, unknown>;
  message: Record<string, unknown>;
  primaryType: string;
  types: Record<string, TypedDataField[]>;
};

export type SafeTypedDataRequest = {
  chainId: number;
  safeAddress?: string;
  typedData: TypedDataPayload;
};

export type RenaissSigner = {
  getAddress(): Promise<string> | string;
  signMessage(message: string): Promise<string>;
  signTypedData(typedData: TypedDataPayload): Promise<string>;
  signSafeTypedData?(request: SafeTypedDataRequest): Promise<string> | string;
};

export async function resolveSignerAddress(
  signer: RenaissSigner,
): Promise<string> {
  return signer.getAddress();
}
