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
});
