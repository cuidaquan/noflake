import { EventForm } from "../../components/event-form";

export default function OrganizerPage() {
  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">ORGANIZER CONSOLE</p>
        <h1>Create a NoFlake event</h1>
        <p className="body-copy">
          Set your deposit, publish the event link, and use on-site check-in to
          settle attendance cleanly.
        </p>
        <p className="inline-meta">
          Attendees can connect a browser wallet or use the local demo fallback.
        </p>
        <p className="inline-meta">
          Real devnet mode needs RPC, program ID, funded wallets, and a deposit-mint configuration.
        </p>
        <p className="inline-meta">Setup guide: docs/devnet-wallet-payment-setup.md</p>
        <section className="panel">
          <p className="eyebrow">COMMERCIAL MODEL</p>
          <p>Pricing: 9 USDC / event</p>
          <p>Sponsor campaigns can be scoped separately later.</p>
        </section>
        <section className="panel">
          <p className="eyebrow">CHECK-IN FLOW</p>
          <p>Generate a share link, display the QR code at the door, and use the check-in console on-site.</p>
        </section>
        <EventForm />
      </section>
    </main>
  );
}
