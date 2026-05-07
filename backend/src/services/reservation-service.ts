import type { InMemoryStore, ReservationRecord } from "../store/in-memory-store";

export function createReservationService(store: InMemoryStore) {
  function getEventReservations(eventId: string) {
    return store.reservations.filter((reservation) => reservation.eventId === eventId);
  }

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

    if (!event && eventId === "evt_party") {
      event = {
        id: "evt_party",
        title: "Builder Party",
        hostWallet: "demo-host-wallet",
        venue: "Shanghai",
        startTime: "2026-05-20T19:00:00.000Z",
        depositAmount: 20,
        seatCount: 20,
        cutoffTime: "2026-05-20T17:00:00.000Z",
        settlementMode: "PARTY",
        status: "OPEN"
      };
      store.events.push(event);
    }

    return event;
  }

  function ensureDemoReservations(eventId: string) {
    if (eventId !== "evt_1" && eventId !== "evt_party") {
      return;
    }

    const existingReservations = store.reservations.filter(
      (reservation) => reservation.eventId === eventId
    );

    if (existingReservations.length > 0) {
      return;
    }

    if (eventId === "evt_1") {
      store.reservations.push(
      {
        id: "res_1",
        eventId,
        attendeeWallet: "wallet-1",
        status: "RESERVED",
        paidAmount: 20,
        createdAt: "2026-05-01T10:00:00.000Z",
        checkedInAt: null,
        waitlistOrder: null
      },
      {
        id: "res_2",
        eventId,
        attendeeWallet: "wallet-2",
        status: "RESERVED",
        paidAmount: 20,
        createdAt: "2026-05-01T10:05:00.000Z",
        checkedInAt: null,
        waitlistOrder: null
      }
    );
      return;
    }

    store.reservations.push(
      {
        id: "res_party_1",
        eventId,
        attendeeWallet: "wallet-party-1",
        status: "CHECKED_IN",
        paidAmount: 20,
        createdAt: "2026-05-01T10:00:00.000Z",
        checkedInAt: "2026-05-01T10:15:00.000Z",
        waitlistOrder: null
      },
      {
        id: "res_party_2",
        eventId,
        attendeeWallet: "wallet-party-2",
        status: "CHECKED_IN",
        paidAmount: 20,
        createdAt: "2026-05-01T10:05:00.000Z",
        checkedInAt: "2026-05-01T10:20:00.000Z",
        waitlistOrder: null
      },
      {
        id: "res_party_3",
        eventId,
        attendeeWallet: "wallet-party-3",
        status: "RESERVED",
        paidAmount: 20,
        createdAt: "2026-05-01T10:10:00.000Z",
        checkedInAt: null,
        waitlistOrder: null
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

      const eventReservations = getEventReservations(eventId);
      const reservedCount = eventReservations.filter(
        (reservation) =>
          (reservation.status === "RESERVED" || reservation.status === "CHECKED_IN")
      ).length;

      const status = reservedCount < event.seatCount ? "RESERVED" : "WAITLISTED";
      const waitlistOrder =
        status === "WAITLISTED"
          ? eventReservations.reduce((maxOrder, reservation) => {
              if (reservation.waitlistOrder === null) {
                return maxOrder;
              }

              return Math.max(maxOrder, reservation.waitlistOrder);
            }, 0) + 1
          : null;

      const reservation: ReservationRecord = {
        id: `res_${store.reservations.length + 1}`,
        eventId,
        attendeeWallet,
        status,
        paidAmount: event.depositAmount,
        createdAt: new Date().toISOString(),
        checkedInAt: null,
        waitlistOrder
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

    cancelReservation(eventId: string, attendeeWallet: string) {
      const event = ensureEvent(eventId);

      if (!event) {
        throw new Error(`Event not found: ${eventId}`);
      }

      if (Date.now() > new Date(event.cutoffTime).getTime()) {
        throw new Error("Reservation cancellation deadline has passed");
      }

      const reservations = this.getReservations(eventId);
      const reservation = reservations.find(
        (candidate) => candidate.attendeeWallet === attendeeWallet
      );

      if (!reservation) {
        throw new Error(`Reservation not found for ${attendeeWallet}`);
      }

      if (reservation.status !== "RESERVED" && reservation.status !== "WAITLISTED") {
        throw new Error(`Reservation cannot be cancelled from status ${reservation.status}`);
      }

      const cancelledStatus = reservation.status;
      reservation.status = "CANCELLED";
      reservation.checkedInAt = null;
      reservation.waitlistOrder = null;

      let promoted: ReservationRecord | undefined;

      if (cancelledStatus === "RESERVED") {
        promoted = reservations
          .filter((candidate) => candidate.status === "WAITLISTED")
          .sort((left, right) => (left.waitlistOrder ?? 0) - (right.waitlistOrder ?? 0))[0];

        if (promoted) {
          promoted.status = "RESERVED";
          promoted.waitlistOrder = null;
        }
      }

      return {
        cancelled: reservation,
        promoted
      };
    },

    checkIn(eventId: string, attendeeWallet: string): ReservationRecord {
      const reservation = this.getReservations(eventId).find(
        (candidate) => candidate.attendeeWallet === attendeeWallet
      );

      if (!reservation) {
        throw new Error(`Reservation not found for ${attendeeWallet}`);
      }

      reservation.status = "CHECKED_IN";
      reservation.checkedInAt = new Date().toISOString();
      return reservation;
    }
  };
}
