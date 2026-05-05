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
        <EventForm />
      </section>
    </main>
  );
}
