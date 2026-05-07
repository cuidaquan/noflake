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
  sponsorPoolAmount?: number;
};

export type EventDetails = CreateEventInput & {
  id: string;
  status: "OPEN" | "SETTLED";
};

export type EventDashboard = {
  eventId: string;
  title: string;
  settlementMode: "STRICT" | "PARTY" | "SPONSOR";
  seatCount: number;
  shareUrl: string;
  qrValue: string;
  counts: {
    reserved: number;
    waitlisted: number;
    checkedIn: number;
    noShow: number;
    refunded: number;
    forfeited: number;
  };
};

export type ReservationDetails = {
  id: string;
  eventId: string;
  attendeeWallet: string;
  status: string;
  paidAmount: number;
  createdAt: string;
  checkedInAt: string | null;
  waitlistOrder: number | null;
};

export type CancellationResult = {
  cancelled: ReservationDetails;
  promoted?: ReservationDetails;
};

export type SettlementSummary = {
  eventId: string;
  checkedInCount: number;
  noShowCount: number;
  refundedAmount: number;
  forfeitedAmount: number;
  partyBonusPerAttendee?: number;
  sponsorBonusPerAttendee?: number;
  totalReturnedToAttendees?: number;
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

export async function undoCheckInAttendee(
  eventId: string,
  attendeeWallet: string
): Promise<ReservationDetails> {
  const response = await fetch(`${API_BASE_URL}/events/${eventId}/check-in/undo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ attendeeWallet })
  });

  if (!response.ok) {
    throw new Error(`Failed to undo check in attendee: ${response.status}`);
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

export async function reserveSeat(
  eventId: string,
  attendeeWallet: string
): Promise<ReservationDetails> {
  const response = await fetch(`${API_BASE_URL}/events/${eventId}/reservations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ attendeeWallet })
  });

  if (!response.ok) {
    throw new Error(`Reservation failed: ${response.status}`);
  }

  return response.json();
}

export async function getEventDashboard(eventId: string): Promise<EventDashboard> {
  const response = await fetch(`${API_BASE_URL}/events/${eventId}/dashboard`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to load event dashboard: ${response.status}`);
  }

  return response.json();
}

export async function cancelReservation(
  eventId: string,
  attendeeWallet: string
): Promise<CancellationResult> {
  const response = await fetch(`${API_BASE_URL}/events/${eventId}/reservations/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ attendeeWallet })
  });

  if (!response.ok) {
    throw new Error(`Cancellation failed: ${response.status}`);
  }

  return response.json();
}

export async function cancelEvent(eventId: string): Promise<EventDetails> {
  const response = await fetch(`${API_BASE_URL}/events/${eventId}/cancel`, {
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Failed to cancel event: ${response.status}`);
  }

  return response.json();
}
