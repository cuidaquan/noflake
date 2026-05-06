import type { InMemoryStore, EventRecord } from "../store/in-memory-store";

type CreateEventInput = Omit<EventRecord, "id" | "status">;

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
    }
  };
}
