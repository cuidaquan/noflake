"use client";

import { use, useEffect, useRef, useState } from "react";
import { formatPaymentPathLabel } from "../../../../../shared/src/constants";
import {
  cancelEvent,
  checkInAttendee,
  finalizeEvent,
  fundSponsorPool,
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
  const [sponsorPoolAmount, setSponsorPoolAmount] = useState("30");
  const [actionError, setActionError] = useState<string | null>(null);
  const [scanPayload, setScanPayload] = useState("");
  const [scannedAttendeeWallet, setScannedAttendeeWallet] = useState<string | null>(null);
  const scanPayloadInputRef = useRef<HTMLInputElement | null>(null);

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
    setActionError(null);
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
    setActionError(null);

    try {
      const summary = await preparePartyDistribution(eventId);
      const updatedEvent = await getEvent(eventId);
      setSettlement(summary);
      setEvent(updatedEvent);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to prepare party distribution");
    }
  }

  async function handlePrepareSponsorDistribution() {
    setActionError(null);

    try {
      const summary = await prepareSponsorDistribution(eventId);
      const updatedEvent = await getEvent(eventId);
      setSettlement(summary);
      setEvent(updatedEvent);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to prepare sponsor distribution");
    }
  }

  async function handleUndoCheckIn(attendeeWallet: string) {
    setActionError(null);
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
    setActionError(null);
    const updatedEvent = await cancelEvent(eventId);
    const updatedReservations = await getReservations(eventId);
    setEvent(updatedEvent);
    setReservations(updatedReservations);
    setEventCancelled(true);
  }

  function handleApplyScanPayload() {
    setActionError(null);

    try {
      const rawScanPayload = scanPayloadInputRef.current?.value ?? scanPayload;
      const normalizedScanPayload = rawScanPayload.trim();

      if (!normalizedScanPayload) {
        throw new Error("Scanned payload is empty");
      }

      setScanPayload(rawScanPayload);

      const parsed = new URL(normalizedScanPayload, window.location.origin);
      const match = parsed.pathname.match(/^\/check-in\/([^/]+)$/);
      const payloadEventId = match?.[1];
      const attendeeWallet = parsed.searchParams.get("attendeeWallet");

      if (!payloadEventId || payloadEventId !== eventId) {
        throw new Error("Scanned payload does not match this event");
      }

      if (!attendeeWallet) {
        throw new Error("Scanned payload is missing attendee wallet");
      }

      setScannedAttendeeWallet(attendeeWallet);
    } catch (error) {
      setScannedAttendeeWallet(null);
      setActionError(error instanceof Error ? error.message : "Failed to parse scan payload");
    }
  }

  async function handleFundSponsorPool() {
    setActionError(null);

    try {
      const updatedEvent = await fundSponsorPool(eventId, Number(sponsorPoolAmount));
      setEvent(updatedEvent);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to fund sponsor pool");
    }
  }

  async function handleFinalizeEvent() {
    setActionError(null);

    try {
      const updatedEvent = await finalizeEvent(eventId);
      setEvent(updatedEvent);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to finalize event");
    }
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
        {event ? (
          <section className="panel">
            <p className="eyebrow">HOST PROVENANCE</p>
            <p>Host wallet: {event.hostWallet}</p>
            <p>
              Host wallet path:{" "}
              {event.creationPath === "BROWSER_WALLET" ? "Browser wallet" : "Demo backend host"}
            </p>
            {event.hostWalletAuthorization ? (
              <p>Host authorization: Signed in browser wallet</p>
            ) : null}
            {event.hostAuthorizationMessage ? (
              <p>Host authorization payload: {event.hostAuthorizationMessage}</p>
            ) : null}
          </section>
        ) : null}

        {event?.settlementMode === "SPONSOR" && event.status === "OPEN" ? (
          <section className="panel">
            <p className="eyebrow">SPONSOR FUNDING</p>
            <label className="field">
              <span>Sponsor pool amount</span>
              <input value={sponsorPoolAmount} onChange={(event) => setSponsorPoolAmount(event.target.value)} />
            </label>
            <button className="secondary-action" onClick={() => void handleFundSponsorPool()}>
              Fund Sponsor Pool
            </button>
          </section>
        ) : null}

        <section className="panel">
          <p className="eyebrow">SCAN CHECK-IN PASS</p>
          <label className="field">
            <span>Scan payload</span>
            <input
              ref={scanPayloadInputRef}
              value={scanPayload}
              onChange={(event) => setScanPayload(event.target.value)}
            />
          </label>
          <button className="secondary-action" onClick={handleApplyScanPayload}>
            Apply Scan Payload
          </button>
          {scannedAttendeeWallet ? (
            <p className="success-text">Scanned attendee: {scannedAttendeeWallet}</p>
          ) : null}
        </section>

        <section className="flow-grid">
          {reservations.map((reservation) => (
            <article key={reservation.id} className="panel attendee-row">
              <div>
                <strong>{reservation.attendeeWallet}</strong>
                <p className="inline-meta">Status: {reservation.status}</p>
                <p className="inline-meta">
                  Payment path: {formatPaymentPathLabel(reservation.paymentPath)}
                </p>
                {reservation.walletAuthorization ? (
                  <p className="inline-meta">Wallet authorization: Present</p>
                ) : null}
                {reservation.walletAuthorizationMessage ? (
                  <p className="inline-meta">
                    Authorization payload: {reservation.walletAuthorizationMessage}
                  </p>
                ) : null}
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
          {event?.settlementMode !== "STRICT" ? (
            <button
              className="secondary-action"
              onClick={() => void handleFinalizeEvent()}
              disabled={event?.distributionStatus !== "COMPLETED"}
            >
              Finalize Event
            </button>
          ) : null}
          <button className="secondary-action" onClick={handleCancelEvent}>
            Cancel Event
          </button>
        </div>

        {eventCancelled ? <p className="success-text">Event cancelled</p> : null}
        {event?.status === "SETTLED" ? <p className="success-text">Event finalized</p> : null}
        {event?.distributionStatus ? (
          <p className="inline-meta">Distribution status: {event.distributionStatus}</p>
        ) : null}
        {actionError ? <p className="error-text">{actionError}</p> : null}

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
