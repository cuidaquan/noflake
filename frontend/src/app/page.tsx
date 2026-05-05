export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">FREE EVENTS, REAL COMMITMENT</p>
        <h1>NoFlake</h1>
        <p className="subtitle">anti-no-show RSVP layer</p>
        <p className="body-copy">
          Reserve a seat with a refundable USDC deposit, check in on-site, and
          settle attendance transparently on Solana.
        </p>
        <div className="actions">
          <a href="/organizer" className="primary-action">
            Organizer Flow
          </a>
          <a href="/events/evt_demo" className="secondary-action">
            Attendee Demo
          </a>
        </div>
      </section>
    </main>
  );
}
