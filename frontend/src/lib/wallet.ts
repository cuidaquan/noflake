export const DEMO_WALLET_ADDRESS = "wallet-demo-1";

type SolanaProvider = {
  isPhantom?: boolean;
  publicKey?: {
    toBase58: () => string;
  };
  connect: () => Promise<unknown>;
  signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
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

function toBase64(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

export async function signWalletAuthorization(message: string): Promise<string | null> {
  const provider = getBrowserWalletProvider();

  if (!provider?.signMessage) {
    return null;
  }

  const signature = await provider.signMessage(new TextEncoder().encode(message));
  return toBase64(signature);
}
