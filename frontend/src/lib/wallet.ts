export const DEMO_WALLET_ADDRESS = "wallet-demo-1";

type SolanaProvider = {
  isPhantom?: boolean;
  publicKey?: {
    toBase58: () => string;
  };
  connect: () => Promise<unknown>;
};

export function getBrowserWalletProvider(): SolanaProvider | null {
  if (typeof window === "undefined") {
    return null;
  }

  const provider = (window as Window & {
    solana?: SolanaProvider;
  }).solana;

  if (!provider || typeof provider.connect !== "function") {
    return null;
  }

  return provider;
}

export function getConnectedWalletAddress(provider: SolanaProvider | null): string | null {
  return provider?.publicKey?.toBase58?.() ?? null;
}
