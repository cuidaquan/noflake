import { describe, expect, it } from "vitest";
import { createSettlementService } from "../src/services/settlement-service";

describe("settlement service", () => {
  it("refunds checked-in users and forfeits no-shows in strict mode", () => {
    const result = createSettlementService().settle({
      event: { id: "evt_1", settlementMode: "STRICT" },
      reservations: [
        { id: "a", attendeeWallet: "wallet-1", status: "CHECKED_IN", paidAmount: 20 },
        { id: "b", attendeeWallet: "wallet-2", status: "RESERVED", paidAmount: 20 }
      ]
    });

    expect(result.refundedAmount).toBe(20);
    expect(result.forfeitedAmount).toBe(20);
  });
});
