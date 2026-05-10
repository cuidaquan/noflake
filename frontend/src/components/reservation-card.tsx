"use client";

import { useEffect, useState } from "react";
import { formatPaymentPathLabel } from "../../../shared/src/constants";
import {
  cancelReservation as cancelReservationRequest,
  claimPartyBonus,
  claimSponsorBonus,
  getReservations,
  reserveSeat as createReservation,
  type ReservationDetails
} from "../lib/api";
import { formatCurrentReservationPathLabel } from "../lib/wallet-path";
import { prepareReservationWalletIntent } from "../lib/wallet-intent";
import {
  buildReservationTransactionMarker,
  buildReservationTransactionSummary
} from "../lib/solana-transaction";
import { useWallet } from "./wallet-provider";
import { WalletIntentPreview } from "./wallet-intent-preview";

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
  const {
    walletAddress,
    isDemoWallet,
    browserWalletAvailable,
    browserWalletCanSign,
    browserWalletCanSignTransactions,
    connectWallet,
    createWalletAuthorization,
    createWalletTransactionSignature,
    demoWallets,
    selectDemoWallet
  } = useWallet();
  const [reservation, setReservation] = useState<ReservationDetails | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authorizationStatus, setAuthorizationStatus] = useState<string | null>(null);
  const walletIntent =
    browserWalletAvailable && !isDemoWallet && walletAddress
      ? prepareReservationWalletIntent({
          eventId,
          walletAddress,
          createAuthorization: createWalletAuthorization
        })
      : browserWalletAvailable && !isDemoWallet
        ? prepareReservationWalletIntent({
            eventId,
            walletAddress: "browser wallet",
            createAuthorization: createWalletAuthorization
          })
        : null;
  const browserWalletBlocked = browserWalletAvailable && !browserWalletCanSign && !isDemoWallet;
  const checkInPass =
    reservation && walletAddress
      ? `/check-in/${eventId}?attendeeWallet=${encodeURIComponent(walletAddress)}`
      : null;

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
    setAuthorizationStatus(null);

    try {
      const activeWalletIntent =
        !isDemoWallet && walletAddress
          ? prepareReservationWalletIntent({
              eventId,
              walletAddress,
              createAuthorization: createWalletAuthorization
            })
          : null;

      if (!isDemoWallet) {
        setAuthorizationStatus(activeWalletIntent?.awaitingSignatureStatus ?? null);
      }

      const walletAuthorization =
        activeWalletIntent ? await activeWalletIntent.sign() : undefined;

      if (!isDemoWallet && !walletAuthorization) {
        throw new Error("Browser wallet authorization is required before reserving.");
      }

      if (!isDemoWallet) {
        setAuthorizationStatus("Preparing Solana transaction...");
      }

      const transactionSignature =
        !isDemoWallet && walletAddress
          ? await createWalletTransactionSignature(
              buildReservationTransactionMarker({
                eventId,
                attendeeWallet: walletAddress,
                depositAmount
              })
            )
          : undefined;

      if (!isDemoWallet) {
        setAuthorizationStatus(activeWalletIntent?.submittingStatus ?? null);
      }

      const payload = await createReservation(
        eventId,
        walletAddress,
        isDemoWallet ? "DEMO_BACKEND" : "BROWSER_WALLET",
        walletAuthorization ? activeWalletIntent?.authorizationMessage : undefined,
        walletAuthorization ?? undefined
      );
      setReservation({
        ...payload,
        transactionSignature
      } as ReservationDetails & { transactionSignature?: string });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Reservation failed");
    } finally {
      setAuthorizationStatus(null);
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
      {walletIntent ? (
        <WalletIntentPreview
          label="Wallet intent"
          authorizationMessage={walletIntent.authorizationMessage}
          preflight={walletIntent.preflight}
        />
      ) : null}
      <p className="eyebrow">ATTENDEE FLOW</p>
      <h1>{title}</h1>
      <p>{venue}</p>
      <p>{depositAmount} USDC refundable deposit</p>
      <p className="inline-meta">Full refund if you cancel before the cutoff time.</p>
      <p className="inline-meta">
        Payment path:{" "}
        {formatCurrentReservationPathLabel({
          walletAddress,
          isDemoWallet,
          browserWalletAvailable
        })}
      </p>
      {!browserWalletAvailable ? (
        <p className="inline-meta">
          Browser wallet not detected. Using demo wallets for local flow.
        </p>
      ) : null}
      {browserWalletAvailable && !browserWalletCanSign ? (
        <p className="inline-meta">
          Connected browser wallet does not support message signing. Use demo flow or a
          compatible wallet.
        </p>
      ) : null}
      {browserWalletAvailable && !isDemoWallet ? (
        <>
          <p className="inline-meta">
            Transaction path:{" "}
            {browserWalletCanSignTransactions
              ? "Browser wallet can sign transactions"
              : "Browser wallet transaction signing unavailable"}
          </p>
          {browserWalletCanSignTransactions ? (
            <p className="inline-meta">
              {buildReservationTransactionSummary({
                eventId,
                attendeeWallet: walletAddress ?? "browser wallet",
                depositAmount
              })}
            </p>
          ) : null}
        </>
      ) : null}
      {isDemoWallet ? (
        <p className="inline-meta">
          Demo flow: wallet connect is mocked in the frontend, while contract funding is verified in
          WSL tests.
        </p>
      ) : null}
      {(isDemoWallet || browserWalletAvailable) ? (
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
        <button
          className="secondary-action"
          onClick={() => void connectWallet()}
          disabled={Boolean(walletAddress) && !isDemoWallet}
        >
          Connect wallet
        </button>
        <p className="inline-meta">
          {walletAddress ? `Connected: ${walletAddress}` : "Connect wallet to reserve your seat"}
        </p>
      </div>
      {authorizationStatus ? (
        <p className="inline-meta">Authorization status: {authorizationStatus}</p>
      ) : null}
      <button
        className="primary-action"
        onClick={handleReserveSeat}
        disabled={isSubmitting || !walletAddress || browserWalletBlocked}
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
        <>
          <p className="success-text">
            {reservation.status === "CANCELLED"
              ? `Reservation cancelled for ${reservation.attendeeWallet}`
              : `Reservation status: ${reservation.status} for ${reservation.attendeeWallet}`}
          </p>
          <p className="inline-meta">
            Reservation path:{" "}
            {formatPaymentPathLabel(reservation.paymentPath)}
          </p>
          {reservation.walletAuthorization ? (
            <p className="inline-meta">Wallet authorization: Signed in browser wallet</p>
          ) : null}
          {reservation.walletAuthorizationMessage ? (
            <p className="inline-meta">
              Authorization payload: {reservation.walletAuthorizationMessage}
            </p>
          ) : null}
          {"transactionSignature" in reservation &&
          typeof reservation.transactionSignature === "string" ? (
            <p className="inline-meta">Transaction signature: {reservation.transactionSignature}</p>
          ) : null}
          {checkInPass && reservation.status !== "CANCELLED" ? (
            <p className="inline-meta">
              Check-in pass: <code data-testid="checkin-pass-payload">{checkInPass}</code>
            </p>
          ) : null}
        </>
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
