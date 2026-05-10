"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode
} from "react";

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
  demoWallets: readonly string[];
  connectWallet: () => void;
  selectDemoWallet: (walletAddress: string) => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        isDemoWallet: true,
        demoWallets: DEMO_WALLETS,
        connectWallet() {
          setWalletAddress(DEMO_WALLETS[0]);
        },
        selectDemoWallet(nextWalletAddress) {
          setWalletAddress(nextWalletAddress);
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
