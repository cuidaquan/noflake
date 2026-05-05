import { ReservationCard } from "../../../components/reservation-card";

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
  const event = await getEvent(eventId);

  return (
    <main className="page-shell">
      <ReservationCard
        eventId={event.id}
        title={event.title}
        venue={event.venue}
        depositAmount={event.depositAmount}
      />
    </main>
  );
}
