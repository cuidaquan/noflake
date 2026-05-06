const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:4000";

export type CreateEventInput = {
  title: string;
  hostWallet: string;
  venue: string;
  startTime: string;
  depositAmount: number;
  seatCount: number;
  cutoffTime: string;
  settlementMode: "STRICT" | "PARTY" | "SPONSOR";
};

export type EventDetails = CreateEventInput & {
  id: string;
  status: "OPEN" | "SETTLED";
};

export type ReservationDetails = {
  id: string;
  eventId: string;
  attendeeWallet: string;
  status: string;
  paidAmount: number;
};

export type SettlementSummary = {
  eventId: string;
  checkedInCount: number;
  noShowCount: number;
  refundedAmount: number;
  forfeitedAmount: number;
  distributionStatus: "COMPLETED" | "PENDING";
};

export async function createEvent(input: CreateEventInput) {
  const response = await fetch(`${API_BASE_URL}/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    throw new Error(`Failed to create event: ${response.status}`);
  }

  return response.json();
}

export async function getEvent(eventId: string): Promise<EventDetails> {
  const response = await fetch(`${API_BASE_URL}/events/${eventId}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to load event: ${response.status}`);
  }

  return response.json();
}

export async function getReservations(eventId: string): Promise<ReservationDetails[]> {
  const response = await fetch(`${API_BASE_URL}/events/${eventId}/reservations`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to load reservations: ${response.status}`);
  }

  return response.json();
}

export async function checkInAttendee(
  eventId: string,
  attendeeWallet: string
): Promise<ReservationDetails> {
  const response = await fetch(`${API_BASE_URL}/events/${eventId}/check-in`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ attendeeWallet })
  });

  if (!response.ok) {
    throw new Error(`Failed to check in attendee: ${response.status}`);
  }

  return response.json();
}

export async function settleEvent(eventId: string): Promise<SettlementSummary> {
  const response = await fetch(`${API_BASE_URL}/events/${eventId}/settle`, {
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Failed to settle event: ${response.status}`);
  }

  return response.json();
}
