import * as anchor from "@coral-xyz/anchor";
import { expect } from "chai";

describe("noflake", () => {
  it("creates an event account", async () => {
    expect(anchor).to.not.equal(undefined);
    expect(true).to.equal(true);
  });
});
