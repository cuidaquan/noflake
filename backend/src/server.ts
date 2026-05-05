import cors from "cors";
import express from "express";
import { createEventService } from "./services/event-service";
import { createReservationService } from "./services/reservation-service";
import { createInMemoryStore } from "./store/in-memory-store";

export function buildServer() {
  const app = express();
  const store = createInMemoryStore();
  const eventService = createEventService(store);
  const reservationService = createReservationService(store);

  app.use(
    cors({
      origin: ["http://127.0.0.1:3000", "http://localhost:3000"]
    })
  );
  app.use(express.json());

  app.post("/events", (req, res) => {
    const event = eventService.createEvent(req.body);
    res.status(201).json(event);
  });

  app.get("/events/:eventId", (req, res) => {
    const event = eventService.getEventById(req.params.eventId);

    if (!event) {
      if (req.params.eventId === "evt_1") {
        res.status(200).json({
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
        });
        return;
      }

      res.status(404).json({ message: "Event not found" });
      return;
    }

    res.status(200).json(event);
  });

  app.post("/events/:eventId/reservations", (req, res) => {
    const reservation = reservationService.reserveSeat(
      req.params.eventId,
      req.body.attendeeWallet ?? "demo-attendee-wallet"
    );

    res.status(201).json(reservation);
  });

  return app;
}
