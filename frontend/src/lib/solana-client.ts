import { resolveSolanaRpcUrl as resolveConfiguredSolanaRpcUrl, DEFAULT_SOLANA_RPC_URL } from "./solana-config";

export type TransactionCapableSolanaProvider = {
  connect: () => Promise<unknown>;
  signTransaction?: <T>(transaction: T) => Promise<T>;
  signAllTransactions?: <T>(transactions: T[]) => Promise<T[]>;
};

export function getDefaultSolanaRpcUrl() {
  return DEFAULT_SOLANA_RPC_URL;
}

export function resolveSolanaRpcUrl(configuredRpcUrl?: string) {
  return resolveConfiguredSolanaRpcUrl(configuredRpcUrl);
}

export function hasTransactionSigningCapability(
  provider: TransactionCapableSolanaProvider | null | undefined
) {
  return Boolean(provider?.signTransaction || provider?.signAllTransactions);
}
