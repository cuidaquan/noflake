import type { InMemoryStore, ReservationRecord } from "../store/in-memory-store";

export function createReservationService(store: InMemoryStore) {
  return {
    reserveSeat(eventId: string, attendeeWallet: string): ReservationRecord {
      const event = store.events.find((candidate) => candidate.id === eventId);

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
