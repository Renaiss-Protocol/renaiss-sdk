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

export type RenaissSigner = {
  getAddress(): Promise<string> | string;
  signMessage(message: string): Promise<string>;
  /** Required by redemption to verify the readable batch against its Permit2 witness. */
  hashTypedData?(typedData: TypedDataPayload): Promise<string> | string;
  signTypedData(typedData: TypedDataPayload): Promise<string>;
};
