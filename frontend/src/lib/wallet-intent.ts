import {
  buildCreateEventAuthorizationMessage,
  buildReservationAuthorizationMessage,
  HOST_EVENT_SUBMISSION_STATUS,
  RESERVATION_SUBMISSION_STATUS
} from "../../../shared/src/constants";

type AuthorizationFactory = (message: string) => Promise<string | null>;

type WalletIntentPreflight = {
  action: "reserve" | "create-event";
  subject: string;
  summary: string;
  paymentToken: string;
};

type WalletIntent = {
  authorizationMessage: string;
  awaitingSignatureStatus: string;
  submittingStatus: string;
  preflight: WalletIntentPreflight;
  sign: () => Promise<string | null>;
};

export function prepareReservationWalletIntent(input: {
  eventId: string;
  walletAddress: string;
  createAuthorization: AuthorizationFactory;
}): WalletIntent {
  const authorizationMessage = buildReservationAuthorizationMessage(
    input.eventId,
    input.walletAddress
  );

  return {
    authorizationMessage,
    awaitingSignatureStatus: RESERVATION_SUBMISSION_STATUS.awaitingSignature,
    submittingStatus: RESERVATION_SUBMISSION_STATUS.submitting,
    preflight: {
      action: "reserve",
      subject: input.eventId,
      summary: `Reserve a seat for ${input.eventId} with ${input.walletAddress}`,
      paymentToken: "USDC"
    },
    sign: () => input.createAuthorization(authorizationMessage)
  };
}

export function prepareCreateEventWalletIntent(input: {
  hostWallet: string;
  title: string;
  createAuthorization: AuthorizationFactory;
}): WalletIntent {
  const authorizationMessage = buildCreateEventAuthorizationMessage(
    input.hostWallet,
    input.title
  );

  return {
    authorizationMessage,
    awaitingSignatureStatus: HOST_EVENT_SUBMISSION_STATUS.awaitingSignature,
    submittingStatus: HOST_EVENT_SUBMISSION_STATUS.submitting,
    preflight: {
      action: "create-event",
      subject: input.title,
      summary: `Create event ${input.title} with ${input.hostWallet}`,
      paymentToken: "USDC"
    },
    sign: () => input.createAuthorization(authorizationMessage)
  };
}
