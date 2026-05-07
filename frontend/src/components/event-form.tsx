"use client";

import { useState } from "react";
import { createEvent, getEventDashboard, type EventDashboard } from "../lib/api";

type CreatedEvent = {
  id: string;
  title: string;
  venue: string;
  depositAmount: number;
  seatCount: number;
  settlementMode: "STRICT" | "PARTY" | "SPONSOR";
  sponsorPoolAmount?: number;
};

export function EventForm() {
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [depositAmount, setDepositAmount] = useState("20");
  const [seatCount, setSeatCount] = useState("20");
  const [cutoffTime, setCutoffTime] = useState("2026-05-20T17:00:00.000Z");
  const [settlementMode, setSettlementMode] = useState<"STRICT" | "PARTY" | "SPONSOR">("STRICT");
  const [sponsorPoolAmount, setSponsorPoolAmount] = useState("");
  const [createdEvent, setCreatedEvent] = useState<CreatedEvent | null>(null);
  const [dashboard, setDashboard] = useState<EventDashboard | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (settlementMode === "SPONSOR" && !sponsorPoolAmount) {
        throw new Error("Sponsor pool is required for sponsor mode");
      }

      const response = await createEvent({
        title,
        hostWallet: "demo-host-wallet",
        venue,
        startTime: "2026-05-20T19:00:00.000Z",
        depositAmount: Number(depositAmount),
        seatCount: Number(seatCount),
        cutoffTime,
        settlementMode,
        sponsorPoolAmount: sponsorPoolAmount ? Number(sponsorPoolAmount) : undefined
      });

      setCreatedEvent(response);
      setDashboard(await getEventDashboard(response.id));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create event");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flow-grid">
      <form className="panel" onSubmit={handleSubmit}>
        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>

        <label className="field">
          <span>Venue</span>
          <input value={venue} onChange={(event) => setVenue(event.target.value)} />
        </label>

        <label className="field">
          <span>Deposit Amount</span>
          <input
            value={depositAmount}
            onChange={(event) => setDepositAmount(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Seat Count</span>
          <input value={seatCount} onChange={(event) => setSeatCount(event.target.value)} />
        </label>

        <label className="field">
          <span>Cutoff Time</span>
          <input value={cutoffTime} onChange={(event) => setCutoffTime(event.target.value)} />
        </label>

        <label className="field">
          <span>Settlement Mode</span>
          <select
            value={settlementMode}
            onChange={(event) =>
              setSettlementMode(event.target.value as "STRICT" | "PARTY" | "SPONSOR")
            }
          >
            <option value="STRICT">STRICT</option>
            <option value="PARTY">PARTY</option>
            <option value="SPONSOR">SPONSOR</option>
          </select>
        </label>

        {settlementMode === "SPONSOR" ? (
          <label className="field">
            <span>Sponsor Pool</span>
            <input
              value={sponsorPoolAmount}
              onChange={(event) => setSponsorPoolAmount(event.target.value)}
            />
          </label>
        ) : null}

        <button className="primary-action" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Event"}
        </button>

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
      </form>

      {createdEvent ? (
        <section className="panel">
          <p className="eyebrow">EVENT CREATED</p>
          <h2>{createdEvent.title}</h2>
          <p>{createdEvent.venue}</p>
          <p>{createdEvent.depositAmount} USDC deposit</p>
          <p>{createdEvent.seatCount} seats</p>
          <p>Mode: {createdEvent.settlementMode}</p>
          {createdEvent.sponsorPoolAmount ? <p>Sponsor pool: {createdEvent.sponsorPoolAmount} USDC</p> : null}
          <p>Share link: {dashboard?.shareUrl ?? `/events/${createdEvent.id}`}</p>
          <p>QR payload: {dashboard?.qrValue ?? `/events/${createdEvent.id}`}</p>
          <p>Reserved: {dashboard?.counts.reserved ?? 0}</p>
          <p>Waitlisted: {dashboard?.counts.waitlisted ?? 0}</p>
          <p>Checked In: {dashboard?.counts.checkedIn ?? 0}</p>
        </section>
      ) : null}
    </div>
  );
}
