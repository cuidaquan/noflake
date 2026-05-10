import cors from "cors";
import express from "express";
import { createEventService } from "./services/event-service";
import { createReservationService } from "./services/reservation-service";
import { createSettlementService } from "./services/settlement-service";
import { createSystemTicker } from "./system-tick";
import type { InMemoryStore } from "./store/in-memory-store";
import { createInMemoryStore, resetInMemoryStore } from "./store/in-memory-store";

type BuildServerOptions = {
  store?: InMemoryStore;
  onStoreChange?: (store: InMemoryStore) => void;
  allowTestReset?: boolean;
};

export function buildServer(options: BuildServerOptions = {}) {
  const app = express();
  const store = options.store ?? createInMemoryStore();
  const allowTestReset = options.allowTestReset ?? process.env.NOAFLAKE_ALLOW_TEST_RESET === "true";
  const eventService = createEventService(store);
  const reservationService = createReservationService(store);
  const settlementService = createSettlementService();
  const persistStore = () => options.onStoreChange?.(store);
  const ticker = createSystemTicker({
    store,
    onStoreChange: options.onStoreChange
  });

  app.use(
    cors({
      origin: [
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:3001",
        "http://localhost:3001",
        "http://127.0.0.1:3101",
        "http://localhost:3101"
      ]
    })
  );
  app.use(express.json());

  app.post("/system/tick", (_req, res) => {
    const updatedEvents = ticker.tick();
    res.status(200).json({ updatedEvents });
  });

  if (allowTestReset) {
    app.post("/system/reset", (_req, res) => {
      const resetStore = resetInMemoryStore();
      persistStore();
      res.status(200).json({
        events: resetStore.events.length,
        reservations: resetStore.reservations.length
      });
    });
  }

  app.post("/events", (req, res) => {
    const creationPath =
      req.body.creationPath === "BROWSER_WALLET" ? "BROWSER_WALLET" : "DEMO_BACKEND";
    const hostAuthorizationMessage =
      typeof req.body.hostAuthorizationMessage === "string"
        ? req.body.hostAuthorizationMessage
        : undefined;
    const hostWalletAuthorization =
      typeof req.body.hostWalletAuthorization === "string"
        ? req.body.hostWalletAuthorization
        : undefined;

    if (creationPath === "BROWSER_WALLET" && !hostWalletAuthorization) {
      res.status(400).json({ message: "Host wallet authorization is required for browser wallet event creation" });
      return;
    }

    const event = eventService.createEvent({
      ...req.body,
      creationPath,
      hostAuthorizationMessage,
      hostWalletAuthorization
    });
    persistStore();
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

  app.get("/events/:eventId/dashboard", (req, res) => {
    const dashboard = eventService.getDashboard(req.params.eventId);

    if (!dashboard) {
      res.status(404).json({ message: "Event not found" });
      return;
    }

    res.status(200).json(dashboard);
  });

  app.post("/events/:eventId/reservations", (req, res) => {
    const paymentPath =
      req.body.paymentPath === "BROWSER_WALLET" ? "BROWSER_WALLET" : "DEMO_BACKEND";
    const walletAuthorizationMessage =
      typeof req.body.walletAuthorizationMessage === "string"
        ? req.body.walletAuthorizationMessage
        : undefined;
    const walletAuthorization =
      typeof req.body.walletAuthorization === "string" ? req.body.walletAuthorization : undefined;

    if (paymentPath === "BROWSER_WALLET" && !walletAuthorization) {
      res.status(400).json({ message: "Wallet authorization is required for browser wallet reservations" });
      return;
    }

    const reservation = reservationService.reserveSeat(
      req.params.eventId,
      req.body.attendeeWallet ?? "demo-attendee-wallet",
      paymentPath,
      walletAuthorizationMessage,
      walletAuthorization
    );
    persistStore();

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
    persistStore();

    res.status(200).json(result);
  });

  app.post("/events/:eventId/check-in", (req, res) => {
    const reservation = reservationService.checkIn(
      req.params.eventId,
      req.body.attendeeWallet ?? "wallet-1"
    );
    persistStore();

    res.status(200).json(reservation);
  });

  app.post("/events/:eventId/check-in/undo", (req, res) => {
    const reservation = reservationService.undoCheckIn(
      req.params.eventId,
      req.body.attendeeWallet ?? "wallet-1"
    );
    persistStore();

    res.status(200).json(reservation);
  });

  app.post("/events/:eventId/fund-sponsor-pool", (req, res) => {
    const event = eventService.getEventById(req.params.eventId);

    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }

    if (event.settlementMode !== "SPONSOR") {
      res.status(400).json({ message: "Sponsor pool funding is only available for sponsor events" });
      return;
    }

    if (event.status === "CANCELLED") {
      res.status(400).json({ message: "Sponsor pool funding is closed after cancellation" });
      return;
    }

    if (event.status === "SETTLING" || event.status === "SETTLED") {
      res.status(400).json({ message: "Sponsor pool funding is closed after settlement starts" });
      return;
    }

    const amount = Number(req.body.amount ?? 0);

    if (amount <= 0) {
      res.status(400).json({ message: "Sponsor pool amount must be greater than zero" });
      return;
    }

    event.sponsorPoolFunded = amount;
    persistStore();
    res.status(200).json(event);
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
    const result = settlementService.settleReservations({ event, reservations });

    store.reservations = store.reservations.map((reservation) => {
      if (reservation.eventId !== req.params.eventId) {
        return reservation;
      }

      return result.updatedReservations.find((candidate) => candidate.id === reservation.id) ?? reservation;
    });
    event.status = event.settlementMode === "STRICT" ? "SETTLED" : "SETTLING";
    event.distributionStatus = result.summary.distributionStatus;
    persistStore();

    res.status(200).json(result.summary);
  });

  app.post("/events/:eventId/prepare-party-distribution", (req, res) => {
    const event = eventService.getEventById(req.params.eventId);

    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }

    if (event.status === "CANCELLED") {
      res.status(400).json({ message: "Party distribution is closed after cancellation" });
      return;
    }

    const reservations = reservationService.getReservations(req.params.eventId);
    const result = settlementService.preparePartyDistribution({ event, reservations });
    Object.assign(event, result.updatedEvent);
    persistStore();

    res.status(200).json(result.summary);
  });

  app.post("/events/:eventId/prepare-sponsor-distribution", (req, res) => {
    const event = eventService.getEventById(req.params.eventId);

    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }

    if (event.status === "CANCELLED") {
      res.status(400).json({ message: "Sponsor distribution is closed after cancellation" });
      return;
    }

    const reservations = reservationService.getReservations(req.params.eventId);
    const result = settlementService.prepareSponsorDistribution({ event, reservations });
    Object.assign(event, result.updatedEvent);
    persistStore();

    res.status(200).json(result.summary);
  });

  app.post("/events/:eventId/claim-party-bonus", (req, res) => {
    const event = eventService.getEventById(req.params.eventId);

    if (event.status === "CANCELLED") {
      res.status(400).json({ message: "Party claim is closed after cancellation" });
      return;
    }

    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }

    try {
      const reservations = reservationService.getReservations(req.params.eventId);
      const result = settlementService.claimPartyBonus({
        event,
        reservations,
        attendeeWallet: req.body.attendeeWallet
      });
      Object.assign(event, result.updatedEvent);
      persistStore();
      res.status(200).json({ reservation: result.reservation, event });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Party claim failed" });
    }
  });

  app.post("/events/:eventId/claim-sponsor-bonus", (req, res) => {
    const event = eventService.getEventById(req.params.eventId);

    if (event.status === "CANCELLED") {
      res.status(400).json({ message: "Sponsor claim is closed after cancellation" });
      return;
    }

    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }

    try {
      const reservations = reservationService.getReservations(req.params.eventId);
      const result = settlementService.claimSponsorBonus({
        event,
        reservations,
        attendeeWallet: req.body.attendeeWallet
      });
      Object.assign(event, result.updatedEvent);
      persistStore();
      res.status(200).json({ reservation: result.reservation, event });
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Sponsor claim failed" });
    }
  });

  app.post("/events/:eventId/finalize", (req, res) => {
    const event = eventService.getEventById(req.params.eventId);

    if (event.status === "CANCELLED") {
      res.status(400).json({ message: "Finalize is closed after cancellation" });
      return;
    }

    if (!event) {
      res.status(404).json({ message: "Event not found" });
      return;
    }

    try {
      const reservations = reservationService.getReservations(req.params.eventId);
      const updatedEvent = settlementService.finalizeEvent({ event, reservations });
      Object.assign(event, updatedEvent);
      persistStore();
      res.status(200).json(event);
    } catch (error) {
      res.status(400).json({ message: error instanceof Error ? error.message : "Finalize failed" });
    }
  });

  app.post("/events/:eventId/cancel", (req, res) => {
    const event = eventService.cancelEvent(req.params.eventId);
    const reservations = reservationService.getReservations(req.params.eventId);

    for (const reservation of reservations) {
      if (
        reservation.status === "RESERVED" ||
        reservation.status === "CHECKED_IN" ||
        reservation.status === "WAITLISTED"
      ) {
        reservation.status = "REFUNDED";
        reservation.checkedInAt = null;
      }
    }
    persistStore();

    res.status(200).json(event);
  });

  return app;
}
