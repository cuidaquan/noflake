"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode
} from "react";
import { DEMO_WALLET_ADDRESS } from "../lib/wallet";

type WalletContextValue = {
  walletAddress: string | null;
  isDemoWallet: boolean;
  connectWallet: () => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  return (
    <WalletContext.Provider
      value={{
        walletAddress,
        isDemoWallet: true,
        connectWallet() {
          setWalletAddress(DEMO_WALLET_ADDRESS);
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
