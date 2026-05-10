import { describe, expect, it } from "vitest";
import {
  buildCreateEventTransactionMarker,
  buildCreateEventTransactionSummary,
  buildReservationTransactionMarker,
  buildReservationTransactionSummary
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

  it("builds a stable attendee reservation transaction marker", () => {
    expect(
      buildReservationTransactionMarker({
        eventId: "evt_1",
        attendeeWallet: "wallet-browser-1",
        depositAmount: 20
      })
    ).toBe("reserve:evt_1:wallet-browser-1:20");
  });

  it("builds a readable attendee reservation transaction summary", () => {
    expect(
      buildReservationTransactionSummary({
        eventId: "evt_1",
        attendeeWallet: "wallet-browser-1",
        depositAmount: 20
      })
    ).toBe("Prepare reservation transaction for evt_1 with 20 USDC from wallet-browser-1");
  });
});
