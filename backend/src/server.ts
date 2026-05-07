import cors from "cors";
import express from "express";
import { createEventService } from "./services/event-service";
import { createReservationService } from "./services/reservation-service";
import { createSettlementService } from "./services/settlement-service";
import { createInMemoryStore } from "./store/in-memory-store";

export function buildServer() {
  const app = express();
  const store = createInMemoryStore();
  const eventService = createEventService(store);
  const reservationService = createReservationService(store);
  const settlementService = createSettlementService();

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
    const event =
      eventService.getEventById(req.params.eventId) ??
      reservationService.getEvent(req.params.eventId);

    if (!event) {
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

  app.get("/events/:eventId/reservations", (req, res) => {
    const reservations = reservationService.getReservations(req.params.eventId);
    res.status(200).json(reservations);
  });

  app.post("/events/:eventId/reservations/cancel", (req, res) => {
    const result = reservationService.cancelReservation(
      req.params.eventId,
      req.body.attendeeWallet ?? "demo-attendee-wallet"
    );

    res.status(200).json(result);
  });

  app.post("/events/:eventId/check-in", (req, res) => {
    const reservation = reservationService.checkIn(
      req.params.eventId,
      req.body.attendeeWallet ?? "wallet-1"
    );

    res.status(200).json(reservation);
  });

  app.post("/events/:eventId/settle", (req, res) => {
    const event =
      eventService.getEventById(req.params.eventId) ??
      reservationService.getEvent(req.params.eventId);

    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }

    const reservations = reservationService.getReservations(req.params.eventId);
    const summary = settlementService.settle({ event, reservations });

    for (const reservation of reservations) {
      if (reservation.status === "CHECKED_IN") {
        reservation.status = "REFUNDED";
      } else if (reservation.status === "RESERVED") {
        reservation.status = event.settlementMode === "STRICT" ? "FORFEITED" : "NO_SHOW";
      }
    }

    event.status = "SETTLED";
    res.status(200).json(summary);
  });

  return app;
}
