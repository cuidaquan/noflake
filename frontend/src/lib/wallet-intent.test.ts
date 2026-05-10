import { describe, expect, it, vi } from "vitest";
import {
  prepareCreateEventWalletIntent,
  prepareReservationWalletIntent
} from "./wallet-intent";

describe("wallet intent helpers", () => {
  it("builds a reservation intent with shared copy and signed authorization", async () => {
    const createAuthorization = vi.fn(async (message: string) => `signed:${message}`);

    const intent = prepareReservationWalletIntent({
      eventId: "evt_1",
      walletAddress: "wallet-1",
      createAuthorization
    });

    expect(intent.awaitingSignatureStatus).toBe("Awaiting browser wallet signature...");
    expect(intent.submittingStatus).toBe("Signed. Submitting reservation...");
    expect(intent.authorizationMessage).toBe("reserve:evt_1:wallet-1");
    await expect(intent.sign()).resolves.toBe("signed:reserve:evt_1:wallet-1");
  });

  it("builds a create-event intent with shared copy and signed authorization", async () => {
    const createAuthorization = vi.fn(async (message: string) => `signed:${message}`);

    const intent = prepareCreateEventWalletIntent({
      hostWallet: "host-1",
      title: "Builder Dinner",
      createAuthorization
    });

    expect(intent.awaitingSignatureStatus).toBe("Awaiting browser wallet signature...");
    expect(intent.submittingStatus).toBe("Signed. Submitting event...");
    expect(intent.authorizationMessage).toBe("create-event:host-1:Builder Dinner");
    await expect(intent.sign()).resolves.toBe("signed:create-event:host-1:Builder Dinner");
  });
});
