"use client";

import { useState } from "react";
import { createEvent } from "../lib/api";

type CreatedEvent = {
  id: string;
  title: string;
  venue: string;
  depositAmount: number;
  seatCount: number;
};

export function EventForm() {
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [depositAmount, setDepositAmount] = useState("20");
  const [createdEvent, setCreatedEvent] = useState<CreatedEvent | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await createEvent({
        title,
        hostWallet: "demo-host-wallet",
        venue,
        startTime: "2026-05-20T19:00:00.000Z",
        depositAmount: Number(depositAmount),
        seatCount: 20,
        cutoffTime: "2026-05-20T17:00:00.000Z",
        settlementMode: "STRICT"
      });

      setCreatedEvent(response);
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
          <p>Share link: /events/{createdEvent.id}</p>
        </section>
      ) : null}
    </div>
  );
}
