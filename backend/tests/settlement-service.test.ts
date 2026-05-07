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

  it("splits the no-show pool across checked-in attendees in party mode", () => {
    const result = createSettlementService().settle({
      event: { id: "evt_1", settlementMode: "PARTY" },
      reservations: [
        { id: "a", attendeeWallet: "wallet-1", status: "CHECKED_IN", paidAmount: 20 },
        { id: "b", attendeeWallet: "wallet-2", status: "CHECKED_IN", paidAmount: 20 },
        { id: "c", attendeeWallet: "wallet-3", status: "RESERVED", paidAmount: 20 }
      ]
    });

    expect(result.refundedAmount).toBe(40);
    expect(result.forfeitedAmount).toBe(0);
    expect(result.partyBonusPerAttendee).toBe(10);
  });
});
