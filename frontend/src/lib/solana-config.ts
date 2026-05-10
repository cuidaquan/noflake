export const DEFAULT_SOLANA_RPC_URL = "https://api.devnet.solana.com";

export function resolveSolanaRpcUrl(configuredRpcUrl?: string) {
  const trimmed = configuredRpcUrl?.trim();

  if (!trimmed) {
    return DEFAULT_SOLANA_RPC_URL;
  }

  return trimmed;
}
