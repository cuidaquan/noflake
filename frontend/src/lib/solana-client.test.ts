import { describe, expect, it } from "vitest";
import {
  getDefaultSolanaRpcUrl,
  hasTransactionSigningCapability,
  resolveSolanaRpcUrl
} from "./solana-client";

describe("solana client helpers", () => {
  it("resolves configured rpc urls and trims whitespace", () => {
    expect(resolveSolanaRpcUrl(" https://api.devnet.solana.com ")).toBe(
      "https://api.devnet.solana.com"
    );
  });

  it("falls back to the default devnet rpc when the configured value is blank", () => {
    expect(resolveSolanaRpcUrl("   ")).toBe(getDefaultSolanaRpcUrl());
  });

  it("detects transaction signing capability from injected wallet providers", () => {
    expect(
      hasTransactionSigningCapability({
        connect: async () => ({})
      })
    ).toBe(false);

    expect(
      hasTransactionSigningCapability({
        connect: async () => ({}),
        signTransaction: async (transaction) => transaction
      })
    ).toBe(true);

    expect(
      hasTransactionSigningCapability({
        connect: async () => ({}),
        signAllTransactions: async (transactions) => transactions
      })
    ).toBe(true);
  });
});
