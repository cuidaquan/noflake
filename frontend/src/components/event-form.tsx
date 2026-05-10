"use client";

import { useState } from "react";
import { createEvent, getEventDashboard, type EventDashboard } from "../lib/api";
import { useWallet } from "./wallet-provider";

type CreatedEvent = {
  id: string;
  title: string;
  hostWallet: string;
  venue: string;
  depositAmount: number;
  seatCount: number;
  settlementMode: "STRICT" | "PARTY" | "SPONSOR";
};

export function EventForm() {
  const { walletAddress, demoWallets, selectDemoWallet, connectWallet } = useWallet();
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [depositAmount, setDepositAmount] = useState("20");
  const [seatCount, setSeatCount] = useState("20");
  const [cutoffTime, setCutoffTime] = useState("2026-05-20T17:00:00.000Z");
  const [settlementMode, setSettlementMode] = useState<"STRICT" | "PARTY" | "SPONSOR">("STRICT");
  const [createdEvent, setCreatedEvent] = useState<CreatedEvent | null>(null);
  const [dashboard, setDashboard] = useState<EventDashboard | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await createEvent({
        title,
        hostWallet: walletAddress ?? "demo-host-wallet",
        venue,
        startTime: "2026-05-20T19:00:00.000Z",
        depositAmount: Number(depositAmount),
        seatCount: Number(seatCount),
        cutoffTime,
        settlementMode
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
        <p className="inline-meta">Connected host wallet: {walletAddress ?? "demo-host-wallet"}</p>
        <label className="field">
          <span>Host demo wallet</span>
          <select
            aria-label="Host demo wallet"
            value={walletAddress ?? ""}
            onChange={(event) => selectDemoWallet(event.target.value)}
          >
            <option value="">Use demo-host-wallet fallback</option>
            {demoWallets.map((demoWallet) => (
              <option key={demoWallet} value={demoWallet}>
                {demoWallet}
              </option>
            ))}
          </select>
        </label>
        <button className="secondary-action" type="button" onClick={() => void connectWallet()}>
          Connect host wallet
        </button>

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
          <p className="inline-meta">
            Sponsor funds the bonus pool after event creation in a separate step.
          </p>
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
          <p>Host wallet: {createdEvent.hostWallet}</p>
          <p>{createdEvent.depositAmount} USDC deposit</p>
          <p>{createdEvent.seatCount} seats</p>
          <p>Mode: {createdEvent.settlementMode}</p>
          <p>Share link: {dashboard?.shareUrl ?? `/events/${createdEvent.id}`}</p>
          <p>Check-in console: {dashboard?.checkInUrl ?? `/check-in/${createdEvent.id}`}</p>
          <p>QR payload: {dashboard?.qrValue ?? `/events/${createdEvent.id}`}</p>
          <div className="qr-frame" aria-label="QR code">
            <span>QR code</span>
            <code>{dashboard?.qrValue ?? `/events/${createdEvent.id}`}</code>
          </div>
          <p className="inline-meta">Scan this at the door for check-in.</p>
          <p className="inline-meta">Share this event link so attendees can reserve and generate their pass.</p>
          <p>Reserved: {dashboard?.counts.reserved ?? 0}</p>
          <p>Waitlisted: {dashboard?.counts.waitlisted ?? 0}</p>
          <p>Checked In: {dashboard?.counts.checkedIn ?? 0}</p>
        </section>
      ) : null}
    </div>
  );
}
