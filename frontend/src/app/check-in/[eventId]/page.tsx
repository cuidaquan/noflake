"use client";

import { use, useEffect, useState } from "react";
import {
  cancelEvent,
  checkInAttendee,
  getEvent,
  getReservations,
  preparePartyDistribution,
  prepareSponsorDistribution,
  settleEvent,
  undoCheckInAttendee,
  type EventDetails,
  type ReservationDetails,
  type SettlementSummary
} from "../../../lib/api";

type CheckInPageProps = {
  params: Promise<{
    eventId: string;
  }>;
};

export default function CheckInPage({ params }: CheckInPageProps) {
  const { eventId } = use(params);
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [reservations, setReservations] = useState<ReservationDetails[]>([]);
  const [settlement, setSettlement] = useState<SettlementSummary | null>(null);
  const [loadingWallet, setLoadingWallet] = useState<string | null>(null);
  const [isSettling, setIsSettling] = useState(false);
  const [eventCancelled, setEventCancelled] = useState(false);

  useEffect(() => {
    async function loadPage() {
      const [eventPayload, reservationPayload] = await Promise.all([
        getEvent(eventId),
        getReservations(eventId)
      ]);

      setEvent(eventPayload);
      setReservations(reservationPayload);
    }

    void loadPage();
  }, [eventId]);

  async function handleCheckIn(attendeeWallet: string) {
    setLoadingWallet(attendeeWallet);

    try {
      const updatedReservation = await checkInAttendee(eventId, attendeeWallet);
      setReservations((current) =>
        current.map((reservation) =>
          reservation.id === updatedReservation.id ? updatedReservation : reservation
        )
      );
    } finally {
      setLoadingWallet(null);
    }
  }

  async function handleSettlement() {
    setIsSettling(true);

    try {
      const summary = await settleEvent(eventId);
      const updatedEvent = await getEvent(eventId);
      const updatedReservations = await getReservations(eventId);
      setSettlement(summary);
      setEvent(updatedEvent);
      setReservations(updatedReservations);
    } finally {
      setIsSettling(false);
    }
  }

  async function handlePreparePartyDistribution() {
    const summary = await preparePartyDistribution(eventId);
    const updatedEvent = await getEvent(eventId);
    setSettlement(summary);
    setEvent(updatedEvent);
  }

  async function handlePrepareSponsorDistribution() {
    const summary = await prepareSponsorDistribution(eventId);
    const updatedEvent = await getEvent(eventId);
    setSettlement(summary);
    setEvent(updatedEvent);
  }

  async function handleUndoCheckIn(attendeeWallet: string) {
    setLoadingWallet(attendeeWallet);

    try {
      const updatedReservation = await undoCheckInAttendee(eventId, attendeeWallet);
      setReservations((current) =>
        current.map((reservation) =>
          reservation.id === updatedReservation.id ? updatedReservation : reservation
        )
      );
    } finally {
      setLoadingWallet(null);
    }
  }

  async function handleCancelEvent() {
    const updatedEvent = await cancelEvent(eventId);
    const updatedReservations = await getReservations(eventId);
    setEvent(updatedEvent);
    setReservations(updatedReservations);
    setEventCancelled(true);
  }

  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">CHECK-IN CONSOLE</p>
        <h1>{event?.title ?? "Loading event..."}</h1>
        <p className="body-copy">
          Check attendees in at the door, settle deposits first, then prepare any Party or Sponsor
          bonus distribution before the event is fully done.
        </p>

        <section className="flow-grid">
          {reservations.map((reservation) => (
            <article key={reservation.id} className="panel attendee-row">
              <div>
                <strong>{reservation.attendeeWallet}</strong>
                <p className="inline-meta">Status: {reservation.status}</p>
              </div>
              <button
                className="secondary-action"
                onClick={() => handleCheckIn(reservation.attendeeWallet)}
                disabled={loadingWallet === reservation.attendeeWallet || reservation.status === "CHECKED_IN"}
              >
                {loadingWallet === reservation.attendeeWallet
                  ? `Checking In ${reservation.attendeeWallet}...`
                  : `Check In ${reservation.attendeeWallet}`}
              </button>
              {reservation.status === "CHECKED_IN" ? (
                <button
                  className="secondary-action"
                  onClick={() => handleUndoCheckIn(reservation.attendeeWallet)}
                  disabled={loadingWallet === reservation.attendeeWallet}
                >
                  {loadingWallet === reservation.attendeeWallet
                    ? `Undoing ${reservation.attendeeWallet}...`
                    : `Undo Check-In ${reservation.attendeeWallet}`}
                </button>
              ) : null}
            </article>
          ))}
        </section>

        <div className="actions">
          <button className="primary-action" onClick={handleSettlement} disabled={isSettling}>
            {isSettling ? "Settling..." : "Settle Event"}
          </button>
          {event?.settlementMode === "PARTY" && event.status === "SETTLING" ? (
            <button className="secondary-action" onClick={() => void handlePreparePartyDistribution()}>
              Prepare Party Distribution
            </button>
          ) : null}
          {event?.settlementMode === "SPONSOR" && event.status === "SETTLING" ? (
            <button className="secondary-action" onClick={() => void handlePrepareSponsorDistribution()}>
              Prepare Sponsor Distribution
            </button>
          ) : null}
          <button className="secondary-action" onClick={handleCancelEvent}>
            Cancel Event
          </button>
        </div>

        {eventCancelled ? <p className="success-text">Event cancelled</p> : null}

        {settlement ? (
          <section className="panel settlement-panel">
            <p className="success-text">
              {event?.status === "SETTLED" ? "Settlement complete" : "Settlement step complete"}
            </p>
            <p className="inline-meta">
              Refunded: {settlement.refundedAmount} USDC • Forfeited: {settlement.forfeitedAmount} USDC
            </p>
            {event?.settlementMode === "PARTY" ? (
              <p className="inline-meta">
                Party bonus: {settlement.partyBonusPerAttendee ?? 0} USDC per checked-in attendee
              </p>
            ) : null}
            {event?.settlementMode === "SPONSOR" ? (
              <p className="inline-meta">
                Sponsor bonus: {settlement.sponsorBonusPerAttendee ?? 0} USDC per checked-in attendee
              </p>
            ) : null}
          </section>
        ) : null}
      </section>
    </main>
  );
}
