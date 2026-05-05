"use client";

import { useState } from "react";

type ReservationCardProps = {
  eventId: string;
  title: string;
  venue: string;
  depositAmount: number;
};

type ReservationResult = {
  id: string;
  status: string;
};

export function ReservationCard({
  eventId,
  title,
  venue,
  depositAmount
}: ReservationCardProps) {
  const [reservation, setReservation] = useState<ReservationResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function reserveSeat() {
    setIsSubmitting(true);

    try {
      const response = await fetch(`http://127.0.0.1:4000/events/${eventId}/reservations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          attendeeWallet: "demo-attendee-wallet"
        })
      });

      if (!response.ok) {
        throw new Error(`Reservation failed: ${response.status}`);
      }

      const payload = (await response.json()) as ReservationResult;
      setReservation(payload);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="panel">
      <p className="eyebrow">ATTENDEE FLOW</p>
      <h1>{title}</h1>
      <p>{venue}</p>
      <p>{depositAmount} USDC refundable deposit</p>
      <button className="primary-action" onClick={reserveSeat} disabled={isSubmitting}>
        {isSubmitting ? "Reserving..." : "Reserve with USDC"}
      </button>

      {reservation ? (
        <p className="success-text">Reservation confirmed: {reservation.status}</p>
      ) : null}
    </section>
  );
}
