export const SUPPORTED_PAYMENT_TOKEN = "USDC";
export const DEFAULT_DEPOSIT_AMOUNT = 20;

export const RESERVATION_SUBMISSION_STATUS = {
  awaitingSignature: "Awaiting browser wallet signature...",
  submitting: "Signed. Submitting reservation..."
} as const;

export const HOST_EVENT_SUBMISSION_STATUS = {
  awaitingSignature: "Awaiting browser wallet signature...",
  submitting: "Signed. Submitting event..."
} as const;

export function buildReservationAuthorizationMessage(eventId: string, walletAddress: string) {
  return `reserve:${eventId}:${walletAddress}`;
}

export function buildCreateEventAuthorizationMessage(hostWallet: string, title: string) {
  return `create-event:${hostWallet}:${title}`;
}

export function formatPaymentPathLabel(paymentPath?: "DEMO_BACKEND" | "BROWSER_WALLET") {
  return paymentPath === "BROWSER_WALLET" ? "Browser wallet" : "Demo backend reservation";
}

export function formatCreationPathLabel(creationPath?: "DEMO_BACKEND" | "BROWSER_WALLET") {
  return creationPath === "BROWSER_WALLET" ? "Browser wallet" : "Demo backend host";
}
