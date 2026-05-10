import { describe, expect, it } from "vitest";
import {
  formatCurrentHostPathLabel,
  formatCurrentReservationPathLabel
} from "./wallet-path";

describe("wallet path helpers", () => {
  it("formats attendee reservation path states", () => {
    expect(
      formatCurrentReservationPathLabel({
        walletAddress: "wallet-demo-1",
        isDemoWallet: true,
        browserWalletAvailable: true
      })
    ).toBe("Demo backend reservation");
    expect(
      formatCurrentReservationPathLabel({
        walletAddress: "wallet-browser-1",
        isDemoWallet: false,
        browserWalletAvailable: true
      })
    ).toBe("Browser wallet connected");
    expect(
      formatCurrentReservationPathLabel({
        walletAddress: null,
        isDemoWallet: true,
        browserWalletAvailable: true
      })
    ).toBe("Browser wallet available");
    expect(
      formatCurrentReservationPathLabel({
        walletAddress: null,
        isDemoWallet: true,
        browserWalletAvailable: false
      })
    ).toBe("Demo backend reservation");
  });

  it("formats organizer host path states", () => {
    expect(
      formatCurrentHostPathLabel({
        walletAddress: "wallet-demo-1",
        isDemoWallet: true,
        browserWalletAvailable: true
      })
    ).toBe("Demo backend host");
    expect(
      formatCurrentHostPathLabel({
        walletAddress: "host-browser-1",
        isDemoWallet: false,
        browserWalletAvailable: true
      })
    ).toBe("Browser wallet connected");
    expect(
      formatCurrentHostPathLabel({
        walletAddress: null,
        isDemoWallet: true,
        browserWalletAvailable: true
      })
    ).toBe("Browser wallet available");
    expect(
      formatCurrentHostPathLabel({
        walletAddress: null,
        isDemoWallet: true,
        browserWalletAvailable: false
      })
    ).toBe("Demo backend host");
  });
});
