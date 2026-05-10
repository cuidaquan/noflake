type CreateEventTransactionInput = {
  hostWallet: string;
  title: string;
  depositAmount: number;
  seatCount: number;
};

type ReservationTransactionInput = {
  eventId: string;
  attendeeWallet: string;
  depositAmount: number;
};

export function buildCreateEventTransactionMarker(input: CreateEventTransactionInput) {
  return `create-event:${input.hostWallet}:${input.title}:${input.depositAmount}:${input.seatCount}`;
}

export function buildCreateEventTransactionSummary(input: CreateEventTransactionInput) {
  return `Prepare create-event transaction for ${input.title} with ${input.depositAmount} USDC and ${input.seatCount} seats`;
}

export function buildReservationTransactionMarker(input: ReservationTransactionInput) {
  return `reserve:${input.eventId}:${input.attendeeWallet}:${input.depositAmount}`;
}

export function buildReservationTransactionSummary(input: ReservationTransactionInput) {
  return `Prepare reservation transaction for ${input.eventId} with ${input.depositAmount} USDC from ${input.attendeeWallet}`;
}
