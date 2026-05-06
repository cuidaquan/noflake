"use client";

import { useState } from "react";
import { reserveSeat as createReservation, type ReservationDetails } from "../lib/api";
import { useWallet } from "./wallet-provider";

type ReservationCardProps = {
  eventId: string;
  title: string;
  venue: string;
  depositAmount: number;
};

export function ReservationCard({
  eventId,
  title,
  venue,
  depositAmount
}: ReservationCardProps) {
  const { walletAddress, connectWallet } = useWallet();
  const [reservation, setReservation] = useState<ReservationDetails | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleReserveSeat() {
    if (!walletAddress) {
      throw new Error("Wallet not connected");
    }

    setIsSubmitting(true);

    try {
      const payload = await createReservation(eventId, walletAddress);
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
      <div className="wallet-row">
        <button className="secondary-action" onClick={connectWallet} disabled={Boolean(walletAddress)}>
          Connect wallet
        </button>
        <p className="inline-meta">
          {walletAddress ? `Connected: ${walletAddress}` : "Connect wallet to reserve your seat"}
        </p>
      </div>
      <button
        className="primary-action"
        onClick={handleReserveSeat}
        disabled={isSubmitting || !walletAddress}
      >
        {isSubmitting ? "Reserving..." : "Reserve with USDC"}
      </button>

      {reservation ? (
        <p className="success-text">
          Reservation confirmed: {reservation.status} for {reservation.attendeeWallet}
        </p>
      ) : null}
    </section>
  );
}
