import type { InMemoryStore, EventRecord } from "../store/in-memory-store";

type CreateEventInput = Omit<EventRecord, "id" | "status">;
const FRONTEND_BASE_URL = "http://127.0.0.1:3000";

export function createEventService(store: InMemoryStore) {
  return {
    createEvent(input: CreateEventInput): EventRecord {
      const event: EventRecord = {
        ...input,
        id: `evt_${store.events.length + 1}`,
        status: "OPEN"
      };

      store.events.push(event);
      return event;
    },

    getEventById(eventId: string): EventRecord | undefined {
      return store.events.find((event) => event.id === eventId);
    },

    getDashboard(eventId: string) {
      const event = store.events.find((candidate) => candidate.id === eventId);

      if (!event) {
        return undefined;
      }

      const reservations = store.reservations.filter(
        (reservation) => reservation.eventId === eventId
      );

      return {
        eventId: event.id,
        title: event.title,
        settlementMode: event.settlementMode,
        seatCount: event.seatCount,
        shareUrl: `${FRONTEND_BASE_URL}/events/${event.id}`,
        qrValue: `${FRONTEND_BASE_URL}/events/${event.id}`,
        counts: {
          reserved: reservations.filter((reservation) => reservation.status === "RESERVED").length,
          waitlisted: reservations.filter((reservation) => reservation.status === "WAITLISTED").length,
          checkedIn: reservations.filter((reservation) => reservation.status === "CHECKED_IN").length,
          noShow: reservations.filter((reservation) => reservation.status === "NO_SHOW").length,
          refunded: reservations.filter((reservation) => reservation.status === "REFUNDED").length,
          forfeited: reservations.filter((reservation) => reservation.status === "FORFEITED").length
        }
      };
    }
  };
}
