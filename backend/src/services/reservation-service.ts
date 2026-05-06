import type { InMemoryStore, ReservationRecord } from "../store/in-memory-store";

export function createReservationService(store: InMemoryStore) {
  function ensureEvent(eventId: string) {
    let event = store.events.find((candidate) => candidate.id === eventId);

    if (!event && eventId === "evt_1") {
      event = {
        id: "evt_1",
        title: "Builder Dinner",
        hostWallet: "demo-host-wallet",
        venue: "Shanghai",
        startTime: "2026-05-20T19:00:00.000Z",
        depositAmount: 20,
        seatCount: 20,
        cutoffTime: "2026-05-20T17:00:00.000Z",
        settlementMode: "STRICT",
        status: "OPEN"
      };
      store.events.push(event);
    }

    return event;
  }

  function ensureDemoReservations(eventId: string) {
    if (eventId !== "evt_1") {
      return;
    }

    const existingReservations = store.reservations.filter(
      (reservation) => reservation.eventId === eventId
    );

    if (existingReservations.length > 0) {
      return;
    }

    store.reservations.push(
      {
        id: "res_1",
        eventId,
        attendeeWallet: "wallet-1",
        status: "RESERVED",
        paidAmount: 20
      },
      {
        id: "res_2",
        eventId,
        attendeeWallet: "wallet-2",
        status: "RESERVED",
        paidAmount: 20
      }
    );
  }

  return {
    getEvent(eventId: string) {
      return ensureEvent(eventId);
    },

    reserveSeat(eventId: string, attendeeWallet: string): ReservationRecord {
      const event = ensureEvent(eventId);

      if (!event) {
        throw new Error(`Event not found: ${eventId}`);
      }

      const reservedCount = store.reservations.filter(
        (reservation) =>
          reservation.eventId === eventId &&
          (reservation.status === "RESERVED" || reservation.status === "CHECKED_IN")
      ).length;

      const status = reservedCount < event.seatCount ? "RESERVED" : "WAITLISTED";

      const reservation: ReservationRecord = {
        id: `res_${store.reservations.length + 1}`,
        eventId,
        attendeeWallet,
        status,
        paidAmount: event.depositAmount
      };

      store.reservations.push(reservation);
      return reservation;
    },

    getReservations(eventId: string): ReservationRecord[] {
      const event = ensureEvent(eventId);

      if (!event) {
        throw new Error(`Event not found: ${eventId}`);
      }

      ensureDemoReservations(eventId);

      return store.reservations.filter((reservation) => reservation.eventId === eventId);
    },

    checkIn(eventId: string, attendeeWallet: string): ReservationRecord {
      const reservation = this.getReservations(eventId).find(
        (candidate) => candidate.attendeeWallet === attendeeWallet
      );

      if (!reservation) {
        throw new Error(`Reservation not found for ${attendeeWallet}`);
      }

      reservation.status = "CHECKED_IN";
      return reservation;
    }
  };
}
