type CreateEventTransactionInput = {
  hostWallet: string;
  title: string;
  depositAmount: number;
  seatCount: number;
};

export function buildCreateEventTransactionMarker(input: CreateEventTransactionInput) {
  return `create-event:${input.hostWallet}:${input.title}:${input.depositAmount}:${input.seatCount}`;
}

export function buildCreateEventTransactionSummary(input: CreateEventTransactionInput) {
  return `Prepare create-event transaction for ${input.title} with ${input.depositAmount} USDC and ${input.seatCount} seats`;
}
