import { createEventService } from "./services/event-service";
import type { InMemoryStore } from "./store/in-memory-store";

type TickOptions = {
  store: InMemoryStore;
  onStoreChange?: (store: InMemoryStore) => void;
};

export function createSystemTicker(options: TickOptions) {
  const eventService = createEventService(options.store);

  return {
    tick(nowMs: number = Date.now()) {
      const updatedEvents = eventService.advanceEventStatuses(nowMs);
      options.onStoreChange?.(options.store);
      return updatedEvents;
    }
  };
}
