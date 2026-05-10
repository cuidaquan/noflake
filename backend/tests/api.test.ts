import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { buildServer } from "../src/server";
import { resetInMemoryStore } from "../src/store/in-memory-store";

describe("backend api", () => {
  beforeEach(() => {
    resetInMemoryStore();
  });

  it("creates and fetches an event", async () => {
    const app = buildServer();

    const createResponse = await request(app).post("/events").send({
      title: "Dinner",
      hostWallet: "host",
      venue: "Shanghai",
      startTime: "2026-05-20T19:00:00.000Z",
      depositAmount: 20,
      seatCount: 20,
      cutoffTime: "2026-05-20T17:00:00.000Z",
      settlementMode: "STRICT"
    });

    expect(createResponse.status).toBe(201);

    const fetchResponse = await request(app).get(`/events/${createResponse.body.id}`);
    expect(fetchResponse.status).toBe(200);
    expect(fetchResponse.body.title).toBe("Dinner");
  });

  it("automatically marks an open event in progress after its start time", async () => {
    const app = buildServer();
    const originalNow = Date.now;
    Date.now = () => new Date("2026-05-20T20:00:00.000Z").getTime();

    try {
      const createResponse = await request(app).post("/events").send({
        title: "Dinner",
        hostWallet: "host",
        venue: "Shanghai",
        startTime: "2026-05-20T19:00:00.000Z",
        depositAmount: 20,
        seatCount: 20,
        cutoffTime: "2026-05-20T17:00:00.000Z",
        settlementMode: "STRICT"
      });

      const tickResponse = await request(app).post("/system/tick");

      expect(tickResponse.status).toBe(200);
      expect(tickResponse.body.updatedEvents).toContain(createResponse.body.id);

      const eventResponse = await request(app).get(`/events/${createResponse.body.id}`);
      expect(eventResponse.body.status).toBe("IN_PROGRESS");
    } finally {
      Date.now = originalNow;
    }
  });

  it("resets the backend store through a test-only endpoint when enabled", async () => {
    const previousValue = process.env.NOAFLAKE_ALLOW_TEST_RESET;
    process.env.NOAFLAKE_ALLOW_TEST_RESET = "true";

    try {
      const app = buildServer();

      const createResponse = await request(app).post("/events").send({
        title: "Dinner",
        hostWallet: "host",
        venue: "Shanghai",
        startTime: "2026-05-20T19:00:00.000Z",
        depositAmount: 20,
        seatCount: 20,
        cutoffTime: "2026-05-20T17:00:00.000Z",
        settlementMode: "STRICT"
      });

      const resetResponse = await request(app).post("/system/reset");
      expect(resetResponse.status).toBe(200);

      const eventResponse = await request(app).get(`/events/${createResponse.body.id}`);
      expect(eventResponse.status).toBe(200);
      expect(eventResponse.body.title).not.toBe(createResponse.body.title);
    } finally {
      process.env.NOAFLAKE_ALLOW_TEST_RESET = previousValue;
    }
  });

  it("does not expose the backend reset endpoint unless explicitly enabled", async () => {
    const previousValue = process.env.NOAFLAKE_ALLOW_TEST_RESET;
    delete process.env.NOAFLAKE_ALLOW_TEST_RESET;

    try {
      const app = buildServer();
      const resetResponse = await request(app).post("/system/reset");
      expect(resetResponse.status).toBe(404);
    } finally {
      process.env.NOAFLAKE_ALLOW_TEST_RESET = previousValue;
    }
  });

  it("returns organizer dashboard counts and share metadata", async () => {
    const app = buildServer();

    const createResponse = await request(app).post("/events").send({
      title: "Dinner",
      hostWallet: "host",
      venue: "Shanghai",
      startTime: "2026-05-20T19:00:00.000Z",
      depositAmount: 20,
      seatCount: 2,
      cutoffTime: "2099-05-20T17:00:00.000Z",
      settlementMode: "PARTY"
    });

    const response = await request(app).get(`/events/${createResponse.body.id}/dashboard`);
    expect(response.status).toBe(200);
    expect(response.body.shareUrl).toContain(`/events/${createResponse.body.id}`);
    expect(response.body.qrValue).toContain(`/events/${createResponse.body.id}`);
    expect(response.body.checkInUrl).toContain(`/check-in/${createResponse.body.id}`);
    expect(response.body.counts.reserved).toBeTypeOf("number");
  });

  it("stores browser wallet authorization proof on browser-wallet event creation", async () => {
    const app = buildServer();

    const response = await request(app).post("/events").send({
      title: "Signed Host Dinner",
      hostWallet: "host-browser-1",
      hostAuthorizationMessage: "create-event:host-browser-1:Signed Host Dinner",
      hostWalletAuthorization: "signed-host-proof",
      creationPath: "BROWSER_WALLET",
      venue: "Shanghai",
      startTime: "2026-05-20T19:00:00.000Z",
      depositAmount: 20,
      seatCount: 20,
      cutoffTime: "2026-05-20T17:00:00.000Z",
      settlementMode: "STRICT"
    });

    expect(response.status).toBe(201);
    expect(response.body.creationPath).toBe("BROWSER_WALLET");
    expect(response.body.hostAuthorizationMessage).toBe(
      "create-event:host-browser-1:Signed Host Dinner"
    );
    expect(response.body.hostWalletAuthorization).toBe("signed-host-proof");

    const fetchResponse = await request(app).get(`/events/${response.body.id}`);
    expect(fetchResponse.status).toBe(200);
    expect(fetchResponse.body.hostAuthorizationMessage).toBe(
      "create-event:host-browser-1:Signed Host Dinner"
    );
  });

  it("rejects browser-wallet event creation without wallet authorization", async () => {
    const app = buildServer();

    const response = await request(app).post("/events").send({
      title: "Unsigned Host Dinner",
      hostWallet: "host-browser-2",
      creationPath: "BROWSER_WALLET",
      venue: "Shanghai",
      startTime: "2026-05-20T19:00:00.000Z",
      depositAmount: 20,
      seatCount: 20,
      cutoffTime: "2026-05-20T17:00:00.000Z",
      settlementMode: "STRICT"
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Host wallet authorization is required");
  });

  it("rejects browser-wallet event creation without authorization payload", async () => {
    const app = buildServer();

    const response = await request(app).post("/events").send({
      title: "Unsigned Host Dinner",
      hostWallet: "host-browser-2",
      creationPath: "BROWSER_WALLET",
      hostWalletAuthorization: "signed-host-proof",
      venue: "Shanghai",
      startTime: "2026-05-20T19:00:00.000Z",
      depositAmount: 20,
      seatCount: 20,
      cutoffTime: "2026-05-20T17:00:00.000Z",
      settlementMode: "STRICT"
    });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Host authorization payload is required");
  });

  it("creates a sponsor event without requiring sponsor pool at event creation time", async () => {
    const app = buildServer();

    const response = await request(app).post("/events").send({
      title: "Builder Dinner",
      hostWallet: "host-wallet",
      venue: "Shanghai",
      startTime: "2026-05-20T19:00:00.000Z",
      depositAmount: 20,
      seatCount: 20,
      cutoffTime: "2026-05-20T17:00:00.000Z",
      settlementMode: "SPONSOR"
    });

    expect(response.status).toBe(201);
    expect(response.body.settlementMode).toBe("SPONSOR");
    expect(response.body.sponsorPoolAmount).toBeUndefined();
  });

  it("cancels an event and undoes a check-in before settlement", async () => {
    const app = buildServer();

    const createResponse = await request(app).post("/events").send({
      title: "Dinner",
      hostWallet: "host",
      venue: "Shanghai",
      startTime: "2026-05-20T19:00:00.000Z",
      depositAmount: 20,
      seatCount: 2,
      cutoffTime: "2099-05-20T17:00:00.000Z",
      settlementMode: "STRICT"
    });

    await request(app)
      .post(`/events/${createResponse.body.id}/reservations`)
      .send({ attendeeWallet: "wallet-1" });

    const checkInResponse = await request(app)
      .post(`/events/${createResponse.body.id}/check-in`)
      .send({ attendeeWallet: "wallet-1" });
    expect(checkInResponse.status).toBe(200);

    const undoResponse = await request(app)
      .post(`/events/${createResponse.body.id}/check-in/undo`)
      .send({ attendeeWallet: "wallet-1" });
    expect(undoResponse.status).toBe(200);
    expect(undoResponse.body.status).toBe("RESERVED");

    const cancelResponse = await request(app).post(`/events/${createResponse.body.id}/cancel`);
    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.status).toBe("CANCELLED");
  });

  it("records the reservation payment path when a seat is reserved", async () => {
    const app = buildServer();

    const createResponse = await request(app).post("/events").send({
      title: "Payment Path Dinner",
      hostWallet: "host",
      venue: "Shanghai",
      startTime: "2026-05-20T19:00:00.000Z",
      depositAmount: 20,
      seatCount: 2,
      cutoffTime: "2099-05-20T17:00:00.000Z",
      settlementMode: "STRICT"
    });

    const reserveResponse = await request(app)
      .post(`/events/${createResponse.body.id}/reservations`)
      .send({
        attendeeWallet: "wallet-browser-1",
        paymentPath: "BROWSER_WALLET",
        walletAuthorizationMessage: `reserve:${createResponse.body.id}:wallet-browser-1`,
        walletAuthorization: "signed-intent-proof-1"
      });

    expect(reserveResponse.status).toBe(201);
    expect(reserveResponse.body.paymentPath).toBe("BROWSER_WALLET");

    const reservationsResponse = await request(app).get(
      `/events/${createResponse.body.id}/reservations`
    );
    expect(reservationsResponse.status).toBe(200);
    expect(reservationsResponse.body[0].paymentPath).toBe("BROWSER_WALLET");
  });

  it("stores browser wallet authorization proof on browser-wallet reservations", async () => {
    const app = buildServer();

    const createResponse = await request(app).post("/events").send({
      title: "Signed Reservation Dinner",
      hostWallet: "host",
      venue: "Shanghai",
      startTime: "2026-05-20T19:00:00.000Z",
      depositAmount: 20,
      seatCount: 2,
      cutoffTime: "2099-05-20T17:00:00.000Z",
      settlementMode: "STRICT"
    });

    const reserveResponse = await request(app)
      .post(`/events/${createResponse.body.id}/reservations`)
      .send({
        attendeeWallet: "wallet-browser-2",
        paymentPath: "BROWSER_WALLET",
        walletAuthorizationMessage: `reserve:${createResponse.body.id}:wallet-browser-2`,
        walletAuthorization: "signed-intent-proof"
      });

    expect(reserveResponse.status).toBe(201);
    expect(reserveResponse.body.walletAuthorizationMessage).toBe(
      `reserve:${createResponse.body.id}:wallet-browser-2`
    );
    expect(reserveResponse.body.walletAuthorization).toBe("signed-intent-proof");

    const reservationsResponse = await request(app).get(
      `/events/${createResponse.body.id}/reservations`
    );
    expect(reservationsResponse.body[0].walletAuthorizationMessage).toBe(
      `reserve:${createResponse.body.id}:wallet-browser-2`
    );
    expect(reservationsResponse.body[0].walletAuthorization).toBe("signed-intent-proof");
  });

  it("rejects browser-wallet reservations that do not include wallet authorization", async () => {
    const app = buildServer();

    const createResponse = await request(app).post("/events").send({
      title: "Unsigned Browser Wallet Dinner",
      hostWallet: "host",
      venue: "Shanghai",
      startTime: "2026-05-20T19:00:00.000Z",
      depositAmount: 20,
      seatCount: 2,
      cutoffTime: "2099-05-20T17:00:00.000Z",
      settlementMode: "STRICT"
    });

    const reserveResponse = await request(app)
      .post(`/events/${createResponse.body.id}/reservations`)
      .send({
        attendeeWallet: "wallet-browser-3",
        paymentPath: "BROWSER_WALLET"
      });

    expect(reserveResponse.status).toBe(400);
    expect(reserveResponse.body.message).toContain("Wallet authorization is required");
  });

  it("rejects browser-wallet reservations that do not include authorization payload", async () => {
    const app = buildServer();

    const createResponse = await request(app).post("/events").send({
      title: "Unsigned Browser Wallet Dinner",
      hostWallet: "host",
      venue: "Shanghai",
      startTime: "2026-05-20T19:00:00.000Z",
      depositAmount: 20,
      seatCount: 2,
      cutoffTime: "2099-05-20T17:00:00.000Z",
      settlementMode: "STRICT"
    });

    const reserveResponse = await request(app)
      .post(`/events/${createResponse.body.id}/reservations`)
      .send({
        attendeeWallet: "wallet-browser-4",
        paymentPath: "BROWSER_WALLET",
        walletAuthorization: "signed-proof-only"
      });

    expect(reserveResponse.status).toBe(400);
    expect(reserveResponse.body.message).toContain("Authorization payload is required");
  });

  it("runs sponsor settlement as settle -> prepare instead of one-pass completion", async () => {
    const app = buildServer();

    const createResponse = await request(app).post("/events").send({
      title: "Builder Sponsor Dinner",
      hostWallet: "host-wallet",
      venue: "Shanghai",
      startTime: "2026-05-20T19:00:00.000Z",
      depositAmount: 20,
      seatCount: 2,
      cutoffTime: "2099-05-20T17:00:00.000Z",
      settlementMode: "SPONSOR"
    });

    await request(app)
      .post(`/events/${createResponse.body.id}/fund-sponsor-pool`)
      .send({ amount: 30 });

    await request(app)
      .post(`/events/${createResponse.body.id}/reservations`)
      .send({ attendeeWallet: "wallet-1" });
    await request(app)
      .post(`/events/${createResponse.body.id}/reservations`)
      .send({ attendeeWallet: "wallet-2" });
    await request(app)
      .post(`/events/${createResponse.body.id}/check-in`)
      .send({ attendeeWallet: "wallet-1" });

    const settleResponse = await request(app).post(`/events/${createResponse.body.id}/settle`);
    expect(settleResponse.status).toBe(200);
    expect(settleResponse.body.forfeitedAmount).toBe(20);

    const eventAfterSettle = await request(app).get(`/events/${createResponse.body.id}`);
    expect(eventAfterSettle.body.status).toBe("SETTLING");

    const prepareResponse = await request(app).post(
      `/events/${createResponse.body.id}/prepare-sponsor-distribution`
    );
    expect(prepareResponse.status).toBe(200);
    expect(prepareResponse.body.sponsorBonusPerAttendee).toBe(30);
  });

  it("rejects sponsor pool funding after sponsor settlement has started", async () => {
    const app = buildServer();

    const createResponse = await request(app).post("/events").send({
      title: "Late Sponsor Dinner",
      hostWallet: "host-wallet",
      venue: "Shanghai",
      startTime: "2026-05-20T19:00:00.000Z",
      depositAmount: 20,
      seatCount: 2,
      cutoffTime: "2099-05-20T17:00:00.000Z",
      settlementMode: "SPONSOR"
    });

    await request(app)
      .post(`/events/${createResponse.body.id}/fund-sponsor-pool`)
      .send({ amount: 30 });
    await request(app)
      .post(`/events/${createResponse.body.id}/reservations`)
      .send({ attendeeWallet: "wallet-1" });
    await request(app)
      .post(`/events/${createResponse.body.id}/reservations`)
      .send({ attendeeWallet: "wallet-2" });
    await request(app)
      .post(`/events/${createResponse.body.id}/check-in`)
      .send({ attendeeWallet: "wallet-1" });
    await request(app).post(`/events/${createResponse.body.id}/settle`);

    const response = await request(app)
      .post(`/events/${createResponse.body.id}/fund-sponsor-pool`)
      .send({ amount: 10 });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain("Sponsor pool funding is closed");
  });

  it("requires all eligible party attendees to claim before finalizing", async () => {
    const app = buildServer();

    const settleResponse = await request(app).post("/events/evt_party/settle");
    expect(settleResponse.status).toBe(200);

    const prepareResponse = await request(app).post("/events/evt_party/prepare-party-distribution");
    expect(prepareResponse.status).toBe(200);

    const firstClaim = await request(app)
      .post("/events/evt_party/claim-party-bonus")
      .send({ attendeeWallet: "wallet-party-1" });
    expect(firstClaim.status).toBe(200);

    const finalizeBeforeAllClaims = await request(app).post("/events/evt_party/finalize");
    expect(finalizeBeforeAllClaims.status).toBe(400);
    expect(finalizeBeforeAllClaims.body.message).toContain("All eligible attendees must claim");

    const secondClaim = await request(app)
      .post("/events/evt_party/claim-party-bonus")
      .send({ attendeeWallet: "wallet-party-2" });
    expect(secondClaim.status).toBe(200);

    const finalizeResponse = await request(app).post("/events/evt_party/finalize");
    expect(finalizeResponse.status).toBe(200);
    expect(finalizeResponse.body.status).toBe("SETTLED");
  });

  it("allows sponsor attendees to claim once and blocks duplicate sponsor claims", async () => {
    const app = buildServer();

    const settleResponse = await request(app).post("/events/evt_sponsor/settle");
    expect(settleResponse.status).toBe(200);

    const prepareResponse = await request(app).post("/events/evt_sponsor/prepare-sponsor-distribution");
    expect(prepareResponse.status).toBe(200);

    const firstClaim = await request(app)
      .post("/events/evt_sponsor/claim-sponsor-bonus")
      .send({ attendeeWallet: "wallet-sponsor-1" });
    expect(firstClaim.status).toBe(200);
    expect(firstClaim.body.reservation.sponsorBonusClaimed).toBe(true);
    expect(firstClaim.body.event.distributionStatus).toBe("CLAIM_IN_PROGRESS");

    const duplicateClaim = await request(app)
      .post("/events/evt_sponsor/claim-sponsor-bonus")
      .send({ attendeeWallet: "wallet-sponsor-1" });
    expect(duplicateClaim.status).toBe(400);
    expect(duplicateClaim.body.message).toContain("already claimed");

    const secondClaim = await request(app)
      .post("/events/evt_sponsor/claim-sponsor-bonus")
      .send({ attendeeWallet: "wallet-sponsor-2" });
    expect(secondClaim.status).toBe(200);
    expect(secondClaim.body.event.distributionStatus).toBe("COMPLETED");
  });

  it("refunds sponsor pool and attendee reservations when a sponsor event is cancelled before finalize", async () => {
    const app = buildServer();

    const createResponse = await request(app).post("/events").send({
      title: "Sponsor Cancel Dinner",
      hostWallet: "host-wallet",
      venue: "Shanghai",
      startTime: "2026-05-20T19:00:00.000Z",
      depositAmount: 20,
      seatCount: 2,
      cutoffTime: "2099-05-20T17:00:00.000Z",
      settlementMode: "SPONSOR"
    });

    await request(app)
      .post(`/events/${createResponse.body.id}/fund-sponsor-pool`)
      .send({ amount: 30 });
    await request(app)
      .post(`/events/${createResponse.body.id}/reservations`)
      .send({ attendeeWallet: "wallet-1" });
    await request(app)
      .post(`/events/${createResponse.body.id}/reservations`)
      .send({ attendeeWallet: "wallet-2" });
    await request(app)
      .post(`/events/${createResponse.body.id}/check-in`)
      .send({ attendeeWallet: "wallet-1" });

    const cancelResponse = await request(app).post(`/events/${createResponse.body.id}/cancel`);
    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.status).toBe("CANCELLED");

    const eventAfterCancel = await request(app).get(`/events/${createResponse.body.id}`);
    expect(eventAfterCancel.body.status).toBe("CANCELLED");

    const reservationsAfterCancel = await request(app)
      .get(`/events/${createResponse.body.id}/reservations`);
    expect(reservationsAfterCancel.body.every((reservation: { status: string }) => reservation.status === "REFUNDED")).toBe(true);

    const lateClaim = await request(app)
      .post(`/events/${createResponse.body.id}/claim-sponsor-bonus`)
      .send({ attendeeWallet: "wallet-1" });
    expect(lateClaim.status).toBe(400);
  });

  it("blocks sponsor funding and claim flow after a sponsor event is cancelled", async () => {
    const app = buildServer();

    const createResponse = await request(app).post("/events").send({
      title: "Sponsor Cancel Guard",
      hostWallet: "host-wallet",
      venue: "Shanghai",
      startTime: "2026-05-20T19:00:00.000Z",
      depositAmount: 20,
      seatCount: 2,
      cutoffTime: "2099-05-20T17:00:00.000Z",
      settlementMode: "SPONSOR"
    });

    await request(app)
      .post(`/events/${createResponse.body.id}/fund-sponsor-pool`)
      .send({ amount: 30 });
    await request(app)
      .post(`/events/${createResponse.body.id}/reservations`)
      .send({ attendeeWallet: "wallet-1" });
    await request(app).post(`/events/${createResponse.body.id}/cancel`);

    const lateFunding = await request(app)
      .post(`/events/${createResponse.body.id}/fund-sponsor-pool`)
      .send({ amount: 10 });
    expect(lateFunding.status).toBe(400);

    const latePrepare = await request(app).post(
      `/events/${createResponse.body.id}/prepare-sponsor-distribution`
    );
    expect(latePrepare.status).toBe(400);

    const lateClaim = await request(app)
      .post(`/events/${createResponse.body.id}/claim-sponsor-bonus`)
      .send({ attendeeWallet: "wallet-1" });
    expect(lateClaim.status).toBe(400);
  });
});
