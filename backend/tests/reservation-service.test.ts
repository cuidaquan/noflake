import { describe, expect, it } from "vitest";
import { createEventService } from "../src/services/event-service";
import { createReservationService } from "../src/services/reservation-service";
import { createInMemoryStore } from "../src/store/in-memory-store";

describe("reservation service", () => {
  it("moves a user to waitlist after capacity is reached", () => {
    const store = createInMemoryStore();
    const eventService = createEventService(store);
    const reservationService = createReservationService(store);

    const event = eventService.createEvent({
      title: "Dinner",
      hostWallet: "host",
      venue: "Shanghai",
      startTime: "2026-05-20T19:00:00.000Z",
      depositAmount: 20,
      seatCount: 1,
      cutoffTime: "2026-05-20T17:00:00.000Z",
      settlementMode: "STRICT"
    });

    const first = reservationService.reserveSeat(event.id, "wallet-1");
    const second = reservationService.reserveSeat(event.id, "wallet-2");

    expect(first.status).toBe("RESERVED");
    expect(second.status).toBe("WAITLISTED");
  });

  it("cancels a reserved seat before cutoff and promotes the earliest waitlisted attendee", () => {
    const store = createInMemoryStore();
    const eventService = createEventService(store);
    const reservationService = createReservationService(store);

    const event = eventService.createEvent({
      title: "Dinner",
      hostWallet: "host",
      venue: "Shanghai",
      startTime: "2026-05-20T19:00:00.000Z",
      depositAmount: 20,
      seatCount: 1,
      cutoffTime: "2099-05-20T17:00:00.000Z",
      settlementMode: "STRICT"
    });

    const first = reservationService.reserveSeat(event.id, "wallet-1");
    reservationService.reserveSeat(event.id, "wallet-2");
    const result = reservationService.cancelReservation(event.id, "wallet-1");

    expect(result.cancelled.id).toBe(first.id);
    expect(result.cancelled.status).toBe("CANCELLED");
    expect(result.promoted?.attendeeWallet).toBe("wallet-2");
    expect(result.promoted?.status).toBe("RESERVED");
  });
});
