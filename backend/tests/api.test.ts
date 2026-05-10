import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildServer } from "../src/server";

describe("backend api", () => {
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
    expect(response.body.counts.reserved).toBeTypeOf("number");
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
});
