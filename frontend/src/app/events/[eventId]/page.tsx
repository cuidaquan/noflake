import { ReservationCard } from "../../../components/reservation-card";
import { resolveApiBaseUrl } from "../../../lib/api-base-url";
import { getReservations } from "../../../lib/api";

const API_BASE_URL = resolveApiBaseUrl(process.env.NOAFLAKE_API_BASE_URL);

type EventPageProps = {
  params: Promise<{
    eventId: string;
  }>;
};

async function getEvent(eventId: string) {
  const response = await fetch(`${API_BASE_URL}/events/${eventId}`, {
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
  const takenSeats = reservations.filter(
    (reservation) => reservation.status === "RESERVED" || reservation.status === "CHECKED_IN"
  ).length;
  const waitlistedSeats = reservations.filter((reservation) => reservation.status === "WAITLISTED").length;
  const checkedInSeats = reservations.filter((reservation) => reservation.status === "CHECKED_IN").length;
  const remainingSeats = Math.max(event.seatCount - takenSeats, 0);

  const settlementProgress =
    event.status === "SETTLED"
      ? "COMPLETED"
      : event.distributionStatus ?? (event.status === "SETTLING" ? "PENDING" : "NOT_STARTED");

  return (
    <main className="page-shell">
      <section className="panel">
        <p className="eyebrow">EVENT DETAILS</p>
        <h1>{event.title}</h1>
        <p>{event.venue}</p>
        <p>Deposit: {event.depositAmount} USDC</p>
        <p>Host wallet: {event.hostWallet}</p>
        <p>Settlement mode: {event.settlementMode}</p>
        <p>Cutoff time: {event.cutoffTime}</p>
        <p>Seat capacity: {event.seatCount}</p>
        <p>Seats taken: {takenSeats} / {event.seatCount}</p>
        <p>Remaining seats: {remainingSeats}</p>
        <p>Reserved seats: {reservations.filter((reservation) => reservation.status === "RESERVED").length}</p>
        <p>Waitlisted seats: {waitlistedSeats}</p>
        <p>Checked in: {checkedInSeats}</p>
        <p>Event status: {event.status}</p>
        <p>Settlement progress: {settlementProgress}</p>
        {event.partyBonusPerAttendee !== undefined ? (
          <p>Party bonus per attendee: {event.partyBonusPerAttendee} USDC</p>
        ) : null}
        {event.sponsorBonusPerAttendee !== undefined ? (
          <p>Sponsor bonus per attendee: {event.sponsorBonusPerAttendee} USDC</p>
        ) : null}
        <p className="inline-meta">Refund rule: Cancel before cutoff for a full refund.</p>
        <p className="inline-meta">
          Waitlist rule: New reservations join the waitlist after all seats are taken.
        </p>
        <p className="inline-meta">Check-in rule: Organizer confirms attendance at the door.</p>
        {waitlistedSeats > 0 ? <p className="inline-meta">Waitlist is active for this event.</p> : null}
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
