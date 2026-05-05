import type { InMemoryStore, ReservationRecord } from "../store/in-memory-store";

export function createReservationService(store: InMemoryStore) {
  return {
    reserveSeat(eventId: string, attendeeWallet: string): ReservationRecord {
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

      if (!event) {
        throw new Error(`Event not found: ${eventId}`);
      }

      const reservedCount = store.reservations.filter(
        (reservation) => reservation.eventId === eventId && reservation.status === "RESERVED"
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
    }
  };
}
