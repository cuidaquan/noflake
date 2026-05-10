"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode
} from "react";
import {
  DEMO_WALLET_ADDRESS,
  getBrowserWalletProvider,
  getConnectedWalletAddress,
  signWalletAuthorization
} from "../lib/wallet";

const DEMO_WALLETS = [
  "wallet-demo-1",
  "wallet-1",
  "wallet-2",
  "wallet-party-1",
  "wallet-party-2",
  "wallet-party-3",
  "wallet-sponsor-1",
  "wallet-sponsor-2",
  "wallet-sponsor-3",
  "wallet-undo-1"
] as const;

type WalletContextValue = {
  walletAddress: string | null;
  isDemoWallet: boolean;
  browserWalletAvailable: boolean;
  demoWallets: readonly string[];
  connectWallet: () => void;
  createWalletAuthorization: (message: string) => Promise<string | null>;
  selectDemoWallet: (walletAddress: string) => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isDemoWallet, setIsDemoWallet] = useState(true);
  const browserWalletAvailable = Boolean(getBrowserWalletProvider());

  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        isDemoWallet,
        browserWalletAvailable,
        demoWallets: DEMO_WALLETS,
        async connectWallet() {
          const provider = getBrowserWalletProvider();

          if (provider) {
            try {
              await provider.connect();
              const connectedAddress = getConnectedWalletAddress(provider);

              if (connectedAddress) {
                setWalletAddress(connectedAddress);
                setIsDemoWallet(false);
                return;
              }
            } catch {
              // Fall back to the local demo flow when browser wallet connection is unavailable.
            }
          }

          setWalletAddress(DEMO_WALLET_ADDRESS);
          setIsDemoWallet(true);
        },
        createWalletAuthorization(message) {
          return signWalletAuthorization(message);
        },
        selectDemoWallet(nextWalletAddress) {
          setWalletAddress(nextWalletAddress);
          setIsDemoWallet(true);
        }
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);

  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }

  return context;
}
