import { ReservationCard } from "../../../components/reservation-card";
import { getReservations } from "../../../lib/api";

type EventPageProps = {
  params: Promise<{
    eventId: string;
  }>;
};

async function getEvent(eventId: string) {
  const response = await fetch(`http://127.0.0.1:4000/events/${eventId}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to load event: ${response.status}`);
  }

  return response.json();
}

export default async function EventPage({ params }: EventPageProps) {
  const { eventId } = await params;
  const [event, reservations] = await Promise.all([getEvent(eventId), getReservations(eventId)]);

  return (
    <main className="page-shell">
      <section className="panel">
        <p className="eyebrow">EVENT DETAILS</p>
        <h1>{event.title}</h1>
        <p>Settlement mode: {event.settlementMode}</p>
        <p>Cutoff time: {event.cutoffTime}</p>
        <p>Reserved seats: {reservations.filter((reservation) => reservation.status === "RESERVED").length}</p>
        <p>Waitlisted seats: {reservations.filter((reservation) => reservation.status === "WAITLISTED").length}</p>
        <p>Checked in: {reservations.filter((reservation) => reservation.status === "CHECKED_IN").length}</p>
        <p>Event status: {event.status}</p>
      </section>
      <ReservationCard
        eventId={event.id}
        title={event.title}
        venue={event.venue}
        depositAmount={event.depositAmount}
        settlementMode={event.settlementMode}
        sponsorBonusPerAttendee={event.sponsorBonusPerAttendee}
        partyBonusPerAttendee={event.partyBonusPerAttendee}
        distributionStatus={event.distributionStatus}
      />
    </main>
  );
}
