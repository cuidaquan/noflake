import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl } from "./api-base-url";

describe("resolveApiBaseUrl", () => {
  it("trims whitespace around configured base URLs", () => {
    expect(resolveApiBaseUrl(" http://127.0.0.1:4102 ")).toBe("http://127.0.0.1:4102");
  });

  it("falls back when configured base URL is blank", () => {
    expect(resolveApiBaseUrl("   ")).toBe("http://127.0.0.1:4000");
  });
});
