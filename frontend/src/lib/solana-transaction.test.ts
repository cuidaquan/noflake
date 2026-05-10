import { describe, expect, it } from "vitest";
import {
  buildCreateEventTransactionMarker,
  buildCreateEventTransactionSummary
} from "./solana-transaction";

describe("solana transaction helpers", () => {
  it("builds a stable organizer create-event transaction marker", () => {
    expect(
      buildCreateEventTransactionMarker({
        hostWallet: "host-browser-1",
        title: "Builder Dinner",
        depositAmount: 20,
        seatCount: 24
      })
    ).toBe("create-event:host-browser-1:Builder Dinner:20:24");
  });

  it("builds a readable organizer transaction summary", () => {
    expect(
      buildCreateEventTransactionSummary({
        hostWallet: "host-browser-1",
        title: "Builder Dinner",
        depositAmount: 20,
        seatCount: 24
      })
    ).toBe("Prepare create-event transaction for Builder Dinner with 20 USDC and 24 seats");
  });
});
