import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WalletIntentPreview } from "./wallet-intent-preview";

describe("WalletIntentPreview", () => {
  it("renders a shared preview for wallet intents", () => {
    const html = renderToStaticMarkup(
      <WalletIntentPreview
        label="Wallet intent"
        authorizationMessage="reserve:evt_1:wallet-1"
        preflight={{
          action: "reserve",
          subject: "evt_1",
          summary: "Reserve a seat for evt_1 with wallet-1",
          paymentToken: "USDC"
        }}
      />
    );

    expect(html).toContain("Wallet intent: Reserve a seat for evt_1 with wallet-1");
    expect(html).toContain("Authorization payload: reserve:evt_1:wallet-1");
    expect(html).toContain("Intent action: reserve");
    expect(html).toContain("Intent target: evt_1");
    expect(html).toContain("Settlement token: USDC");
  });
});
