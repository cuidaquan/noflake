import { describe, expect, it } from "vitest";
import { eventSchema, reservationSchema } from "../src/schemas";

describe("shared schemas", () => {
  it("accepts a valid event payload", () => {
    const result = eventSchema.safeParse({
      id: "evt_1",
      title: "Builder Dinner",
      hostWallet: "host-wallet",
      venue: "Shanghai",
      startTime: "2026-05-20T19:00:00.000Z",
      depositAmount: 20,
      seatCount: 20,
      cutoffTime: "2026-05-20T17:00:00.000Z",
      settlementMode: "STRICT",
      status: "OPEN"
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid reservation status", () => {
    const result = reservationSchema.safeParse({
      id: "res_1",
      eventId: "evt_1",
      attendeeWallet: "wallet-1",
      status: "WRONG",
      paidAmount: 20
    });

    expect(result.success).toBe(false);
  });
});
