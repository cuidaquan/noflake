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
});
