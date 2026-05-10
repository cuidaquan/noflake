import { describe, expect, it } from "vitest";
import {
  buildCreateEventAuthorizationMessage,
  buildReservationAuthorizationMessage,
  HOST_EVENT_SUBMISSION_STATUS,
  RESERVATION_SUBMISSION_STATUS
} from "../src/constants";

describe("shared constants", () => {
  it("builds stable browser-wallet authorization messages", () => {
    expect(buildReservationAuthorizationMessage("evt_1", "wallet-1")).toBe("reserve:evt_1:wallet-1");
    expect(buildCreateEventAuthorizationMessage("host-1", "Builder Dinner")).toBe(
      "create-event:host-1:Builder Dinner"
    );
  });

  it("exposes shared submission status copy for reservation and host flows", () => {
    expect(RESERVATION_SUBMISSION_STATUS.awaitingSignature).toBe(
      "Awaiting browser wallet signature..."
    );
    expect(RESERVATION_SUBMISSION_STATUS.submitting).toBe("Signed. Submitting reservation...");
    expect(HOST_EVENT_SUBMISSION_STATUS.awaitingSignature).toBe(
      "Awaiting browser wallet signature..."
    );
    expect(HOST_EVENT_SUBMISSION_STATUS.submitting).toBe("Signed. Submitting event...");
  });
});
