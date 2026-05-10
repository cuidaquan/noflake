import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { beforeEach, describe, expect, it } from "vitest";
import { createEventService } from "../src/services/event-service";
import { createReservationService } from "../src/services/reservation-service";
import {
  createInMemoryStore,
  readStoreFromFile,
  resetInMemoryStore,
  writeStoreToFile
} from "../src/store/in-memory-store";

describe("reservation service", () => {
  beforeEach(() => {
    resetInMemoryStore();
  });

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
    expect(eventService.getEventById(event.id)?.status).toBe("FULL");
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

  it("loads events and reservations back from a persisted store file", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "noflake-store-"));
    const storagePath = join(tempDir, "store.json");

    const firstStore = createInMemoryStore();
    const firstEventService = createEventService(firstStore);
    const firstReservationService = createReservationService(firstStore);

    const event = firstEventService.createEvent({
      title: "Persisted Dinner",
      hostWallet: "host",
      venue: "Shanghai",
      startTime: "2026-05-20T19:00:00.000Z",
      depositAmount: 20,
      seatCount: 2,
      cutoffTime: "2026-05-20T17:00:00.000Z",
      settlementMode: "STRICT"
    });

    firstReservationService.reserveSeat(event.id, "wallet-1");
    writeStoreToFile(storagePath, firstStore);

    const reloadedStore = readStoreFromFile(storagePath);
    const reloadedEventService = createEventService(reloadedStore);
    const reloadedReservationService = createReservationService(reloadedStore);

    expect(reloadedEventService.getEventById(event.id)).toBeDefined();
    expect(reloadedReservationService.getReservations(event.id)).toHaveLength(1);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("marks open events as in progress once their start time passes", () => {
    const store = createInMemoryStore();
    const eventService = createEventService(store);

    const event = eventService.createEvent({
      title: "Started Dinner",
      hostWallet: "host",
      venue: "Shanghai",
      startTime: "2026-05-20T19:00:00.000Z",
      depositAmount: 20,
      seatCount: 2,
      cutoffTime: "2026-05-20T17:00:00.000Z",
      settlementMode: "STRICT"
    });

    const updatedEvents = eventService.advanceEventStatuses(
      new Date("2026-05-20T20:00:00.000Z").getTime()
    );

    expect(updatedEvents).toEqual([event.id]);
    expect(eventService.getEventById(event.id)?.status).toBe("IN_PROGRESS");
  });
});
