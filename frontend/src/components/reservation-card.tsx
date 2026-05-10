"use client";

import { useEffect, useState } from "react";
import {
  cancelReservation as cancelReservationRequest,
  claimPartyBonus,
  claimSponsorBonus,
  getReservations,
  reserveSeat as createReservation,
  type ReservationDetails
} from "../lib/api";
import { useWallet } from "./wallet-provider";

type ReservationCardProps = {
  eventId: string;
  title: string;
  venue: string;
  depositAmount: number;
  settlementMode: "STRICT" | "PARTY" | "SPONSOR";
  sponsorBonusPerAttendee?: number;
  partyBonusPerAttendee?: number;
  distributionStatus?: "PENDING" | "PREPARED" | "CLAIM_IN_PROGRESS" | "COMPLETED";
};

export function ReservationCard({
  eventId,
  title,
  venue,
  depositAmount,
  settlementMode,
  sponsorBonusPerAttendee,
  partyBonusPerAttendee,
  distributionStatus
}: ReservationCardProps) {
  const { walletAddress, isDemoWallet, connectWallet, demoWallets, selectDemoWallet } = useWallet();
  const [reservation, setReservation] = useState<ReservationDetails | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function syncReservation() {
      if (!walletAddress) {
        setReservation(null);
        return;
      }

      const reservations = await getReservations(eventId);
      setReservation(
        reservations.find((candidate) => candidate.attendeeWallet === walletAddress) ?? null
      );
    }

    void syncReservation();
  }, [eventId, walletAddress]);

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

  async function handleClaimPartyBonus() {
    if (!walletAddress) {
      throw new Error("Wallet not connected");
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await claimPartyBonus(eventId, walletAddress);
      setReservation(result.reservation);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Party claim failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleClaimSponsorBonus() {
    if (!walletAddress) {
      throw new Error("Wallet not connected");
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await claimSponsorBonus(eventId, walletAddress);
      setReservation(result.reservation);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Sponsor claim failed");
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
      {isDemoWallet ? (
        <label className="field">
          <span>Demo wallet</span>
          <select
            aria-label="Demo wallet"
            value={walletAddress ?? ""}
            onChange={(event) => selectDemoWallet(event.target.value)}
          >
            <option value="">Choose demo wallet</option>
            {demoWallets.map((demoWallet) => (
              <option key={demoWallet} value={demoWallet}>
                {demoWallet}
              </option>
            ))}
          </select>
        </label>
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

      {settlementMode === "PARTY" &&
      reservation?.status === "REFUNDED" &&
      !reservation.partyBonusClaimed &&
      distributionStatus !== "PENDING" ? (
        <button className="secondary-action" onClick={handleClaimPartyBonus} disabled={isSubmitting}>
          {isSubmitting ? "Claiming..." : "Claim Party Bonus"}
        </button>
      ) : null}

      {settlementMode === "SPONSOR" &&
      reservation?.status === "REFUNDED" &&
      !reservation.sponsorBonusClaimed &&
      distributionStatus !== "PENDING" ? (
        <button className="secondary-action" onClick={handleClaimSponsorBonus} disabled={isSubmitting}>
          {isSubmitting ? "Claiming..." : "Claim Sponsor Bonus"}
        </button>
      ) : null}

      {reservation ? (
        <p className="success-text">
          {reservation.status === "CANCELLED"
            ? `Reservation cancelled for ${reservation.attendeeWallet}`
            : `Reservation status: ${reservation.status} for ${reservation.attendeeWallet}`}
        </p>
      ) : null}

      {reservation?.partyBonusClaimed ? <p className="success-text">Party bonus claimed</p> : null}
      {reservation?.sponsorBonusClaimed ? <p className="success-text">Sponsor bonus claimed</p> : null}
      {settlementMode === "PARTY" && distributionStatus && partyBonusPerAttendee !== undefined ? (
        <p className="inline-meta">Party bonus: {partyBonusPerAttendee} USDC</p>
      ) : null}
      {settlementMode === "SPONSOR" && distributionStatus && sponsorBonusPerAttendee !== undefined ? (
        <p className="inline-meta">Sponsor bonus: {sponsorBonusPerAttendee} USDC</p>
      ) : null}

      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
    </section>
  );
}
