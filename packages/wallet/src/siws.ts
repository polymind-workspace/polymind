export interface SiwsNonceResponse {
  nonce: string;
  message: string;
}

export interface SiwsVerifyResponse {
  token: string;
  expires_at: number;
}

export interface SiwsApi {
  nonce: (address: string) => Promise<SiwsNonceResponse>;
  verify: (body: {
    address: string;
    nonce: string;
    message: string;
    signature: string;
  }) => Promise<SiwsVerifyResponse>;
}

/**
 * Run a Sign-In with Solana handshake.
 *
 * @param address Wallet address to authenticate.
 * @param signMessageBase58 Function that signs a UTF-8 message and returns a base58 signature.
 * @param api Backend SIWS endpoints.
 * @returns JWT token.
 */
export async function runAuthHandshake(
  address: string,
  signMessageBase58: (msg: string) => Promise<string>,
  api: SiwsApi
): Promise<string> {
  const { nonce, message } = await api.nonce(address);
  const signature = await signMessageBase58(message);
  const out = await api.verify({ address, nonce, message, signature });
  return out.token;
}
