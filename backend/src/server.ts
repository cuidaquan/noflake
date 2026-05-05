import express from "express";
import { createEventService } from "./services/event-service";
import { createInMemoryStore } from "./store/in-memory-store";

export function buildServer() {
  const app = express();
  const store = createInMemoryStore();
  const eventService = createEventService(store);

  app.use(express.json());

  app.post("/events", (req, res) => {
    const event = eventService.createEvent(req.body);
    res.status(201).json(event);
  });

  app.get("/events/:eventId", (req, res) => {
    const event = eventService.getEventById(req.params.eventId);

    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }

    res.status(200).json(event);
  });

  return app;
}
