"use client";

import { use, useEffect, useState } from "react";
import {
  checkInAttendee,
  getEvent,
  getReservations,
  settleEvent,
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
      setSettlement(summary);
    } finally {
      setIsSettling(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">CHECK-IN CONSOLE</p>
        <h1>{event?.title ?? "Loading event..."}</h1>
        <p className="body-copy">
          Check attendees in at the door, then settle refunds and no-show penalties in one pass.
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
            </article>
          ))}
        </section>

        <div className="actions">
          <button className="primary-action" onClick={handleSettlement} disabled={isSettling}>
            {isSettling ? "Settling..." : "Settle Event"}
          </button>
        </div>

        {settlement ? (
          <section className="panel settlement-panel">
            <p className="success-text">Settlement complete</p>
            <p className="inline-meta">
              Refunded: {settlement.refundedAmount} USDC • Forfeited: {settlement.forfeitedAmount} USDC
            </p>
            {event?.settlementMode === "PARTY" ? (
              <p className="inline-meta">
                Party bonus: {settlement.partyBonusPerAttendee ?? 0} USDC per checked-in attendee
              </p>
            ) : null}
          </section>
        ) : null}
      </section>
    </main>
  );
}
