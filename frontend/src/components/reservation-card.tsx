"use client";

import { useState } from "react";
import {
  cancelReservation as cancelReservationRequest,
  reserveSeat as createReservation,
  type ReservationDetails
} from "../lib/api";
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
  const { walletAddress, isDemoWallet, connectWallet } = useWallet();
  const [reservation, setReservation] = useState<ReservationDetails | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleReserveSeat() {
    if (!walletAddress) {
      throw new Error("Wallet not connected");
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = await createReservation(eventId, walletAddress);
      setReservation(payload);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Reservation failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancelReservation() {
    if (!walletAddress) {
      throw new Error("Wallet not connected");
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await cancelReservationRequest(eventId, walletAddress);
      setReservation(result.cancelled);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Cancellation failed");
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
      <p className="inline-meta">Full refund if you cancel before the cutoff time.</p>
      {isDemoWallet ? (
        <p className="inline-meta">
          Demo flow: wallet connect is mocked in the frontend, while contract funding is verified in
          WSL tests.
        </p>
      ) : null}
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

      {reservation && (reservation.status === "RESERVED" || reservation.status === "WAITLISTED") ? (
        <button className="secondary-action" onClick={handleCancelReservation} disabled={isSubmitting}>
          {isSubmitting ? "Cancelling..." : "Cancel reservation"}
        </button>
      ) : null}

      {reservation ? (
        <p className="success-text">
          {reservation.status === "CANCELLED"
            ? `Reservation cancelled for ${reservation.attendeeWallet}`
            : `Reservation status: ${reservation.status} for ${reservation.attendeeWallet}`}
        </p>
      ) : null}

      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
    </section>
  );
}
