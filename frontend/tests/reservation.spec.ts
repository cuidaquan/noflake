import { expect, test } from "./test-helpers";

test("attendee can reserve a seat", async ({ page }) => {
  await page.goto("/events/evt_1");
  await expect(page.getByRole("button", { name: "Connect wallet" })).toBeVisible();
  await expect(page.getByText("Browser wallet not detected. Using demo wallets for local flow.")).toBeVisible();
  await expect(page.getByText("Payment path: Demo backend reservation")).toBeVisible();
  await page.getByRole("button", { name: "Connect wallet" }).click();
  await expect(page.getByText("Connected: wallet-demo-1")).toBeVisible();
  await page.getByRole("button", { name: "Reserve with USDC" }).click();
  await expect(page.getByText("Reservation status: RESERVED")).toBeVisible();
  await expect(page.getByText("Reservation path: Demo backend reservation")).toBeVisible();
  await expect(page.getByText(/^Check-in pass:/)).toBeVisible();
  await expect(page.getByText(/\/check-in\/evt_1\?attendeeWallet=wallet-demo-1/)).toBeVisible();
});

test("attendee uses the browser wallet reservation path when an injected wallet is available", async ({
  page
}) => {
  await page.addInitScript(() => {
    const provider = {
      publicKey: {
        toBase58: () => "wallet-browser-1"
      },
      connect: async () => ({ publicKey: { toBase58: () => "wallet-browser-1" } }),
      signMessage: async () => new Uint8Array([115, 105, 103])
    };

    Object.defineProperty(window, "solana", {
      configurable: true,
      value: provider
    });
  });

  await page.goto("/events/evt_1");
  await expect(page.getByText("Payment path: Browser wallet available")).toBeVisible();
  await expect(
    page.getByText("Browser wallet not detected. Using demo wallets for local flow.")
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Connect wallet" }).click();
  await expect(page.getByText("Connected: wallet-browser-1")).toBeVisible();
  await expect(
    page.getByText("Wallet intent: Reserve a seat for evt_1 with wallet-browser-1")
  ).toBeVisible();
  await expect(page.getByText("Intent action: reserve")).toBeVisible();
  await expect(page.getByText("Intent target: evt_1")).toBeVisible();
  await expect(page.getByText("Settlement token: USDC")).toBeVisible();
  await expect(page.getByText("Payment path: Browser wallet connected")).toBeVisible();
  await page.getByRole("button", { name: "Reserve with USDC" }).click();
  await expect(page.getByText("Reservation path: Browser wallet")).toBeVisible();
  await expect(page.getByText("Wallet authorization: Signed in browser wallet")).toBeVisible();
});

test("attendee sees browser-wallet signing progress before reservation submission completes", async ({
  page
}) => {
  await page.addInitScript(() => {
    let releaseSignature: (() => void) | null = null;
    let releaseReservationRequest: (() => void) | null = null;

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.includes("/reservations") && init?.method === "POST") {
        await new Promise<void>((resolve) => {
          releaseReservationRequest = resolve;
        });
      }

      return originalFetch(input, init);
    };

    const provider = {
      publicKey: {
        toBase58: () => "wallet-browser-delayed"
      },
      connect: async () => ({ publicKey: { toBase58: () => "wallet-browser-delayed" } }),
      signMessage: async () => {
        await new Promise<void>((resolve) => {
          releaseSignature = resolve;
        });
        return new Uint8Array([115, 105, 103]);
      }
    };

    Object.defineProperty(window, "solana", {
      configurable: true,
      value: provider
    });

    Object.defineProperty(window, "__noflakeWalletTest", {
      configurable: true,
      value: {
        releaseSignature: () => releaseSignature?.(),
        releaseReservationRequest: () => releaseReservationRequest?.()
      }
    });
  });

  await page.goto("/events/evt_1");
  await page.getByRole("button", { name: "Connect wallet" }).click();
  await expect(page.getByText("Connected: wallet-browser-delayed")).toBeVisible();

  const reserveClick = page.getByRole("button", { name: "Reserve with USDC" }).click();
  await expect(
    page.getByText("Authorization status: Awaiting browser wallet signature...")
  ).toBeVisible();

  await page.evaluate(() => {
    (
      window as Window & {
        __noflakeWalletTest?: {
          releaseSignature: () => void;
          releaseReservationRequest: () => void;
        };
      }
    ).__noflakeWalletTest?.releaseSignature();
  });

  await expect(page.getByText("Authorization status: Signed. Submitting reservation...")).toBeVisible();
  await page.evaluate(() => {
    (
      window as Window & {
        __noflakeWalletTest?: {
          releaseSignature: () => void;
          releaseReservationRequest: () => void;
        };
      }
    ).__noflakeWalletTest?.releaseReservationRequest();
  });

  await reserveClick;
  await expect(page.getByText("Reservation path: Browser wallet")).toBeVisible();
});

test("attendee sees an authorization error when the browser wallet cannot sign", async ({
  page
}) => {
  await page.addInitScript(() => {
    const provider = {
      publicKey: {
        toBase58: () => "wallet-browser-nosign"
      },
      connect: async () => ({ publicKey: { toBase58: () => "wallet-browser-nosign" } })
    };

    Object.defineProperty(window, "solana", {
      configurable: true,
      value: provider
    });
  });

  await page.goto("/events/evt_1");
  await page.getByRole("button", { name: "Connect wallet" }).click();
  await expect(page.getByText("Connected: wallet-browser-nosign")).toBeVisible();
  await page.getByRole("button", { name: "Reserve with USDC" }).click();
  await expect(
    page.getByText("Browser wallet authorization is required before reserving.")
  ).toBeVisible();
});

test("attendee can inspect event details before reserving", async ({ page, request }) => {
  const createResponse = await request.post("http://127.0.0.1:4101/events", {
    data: {
      title: "Details Dinner",
      hostWallet: "host-wallet",
      venue: "Shanghai",
      startTime: "2026-05-20T19:00:00.000Z",
      depositAmount: 20,
      seatCount: 20,
      cutoffTime: "2099-05-20T17:00:00.000Z",
      settlementMode: "STRICT"
    }
  });
  const event = await createResponse.json();
  await request.post(`http://127.0.0.1:4101/events/${event.id}/reservations`, {
    data: { attendeeWallet: "wallet-existing-1" }
  });
  await request.post(`http://127.0.0.1:4101/events/${event.id}/reservations`, {
    data: { attendeeWallet: "wallet-existing-2" }
  });

  await page.goto(`/events/${event.id}`);
  await expect(page.getByText("Settlement mode: STRICT")).toBeVisible();
  await expect(page.getByText("Host wallet: host-wallet")).toBeVisible();
  await expect(page.getByText("Cutoff time: 2099-05-20T17:00:00.000Z")).toBeVisible();
  await expect(page.getByText("Event status: OPEN")).toBeVisible();
  await expect(page.getByText("Seat capacity: 20")).toBeVisible();
  await expect(page.getByText("Seats taken: 2 / 20")).toBeVisible();
  await expect(page.getByText("Remaining seats: 18")).toBeVisible();
  await expect(
    page.getByText("Waitlist rule: New reservations join the waitlist after all seats are taken.")
  ).toBeVisible();
  await expect(page.getByText("Refund rule: Cancel before cutoff for a full refund.")).toBeVisible();
  await expect(page.getByText("Check-in rule: Organizer confirms attendance at the door.")).toBeVisible();
});

test("event detail page shows browser-wallet host provenance when the organizer used a signed wallet", async ({
  page,
  request
}) => {
  const createResponse = await request.post("http://127.0.0.1:4101/events", {
    data: {
      title: "Signed Host Details Dinner",
      hostWallet: "host-browser-1",
      creationPath: "BROWSER_WALLET",
      hostWalletAuthorization: "signed-host-proof",
      venue: "Shanghai",
      startTime: "2026-05-20T19:00:00.000Z",
      depositAmount: 20,
      seatCount: 20,
      cutoffTime: "2099-05-20T17:00:00.000Z",
      settlementMode: "STRICT"
    }
  });
  const event = await createResponse.json();

  await page.goto(`/events/${event.id}`);
  await expect(page.getByText("Host wallet path: Browser wallet")).toBeVisible();
  await expect(page.getByText("Host authorization: Signed in browser wallet")).toBeVisible();
});

test("event detail page shows full capacity and active waitlist pressure", async ({
  page,
  request
}) => {
  const createResponse = await request.post("http://127.0.0.1:4101/events", {
    data: {
      title: "Waitlist Dinner",
      hostWallet: "host-wallet",
      venue: "Shanghai",
      startTime: "2026-05-20T19:00:00.000Z",
      depositAmount: 20,
      seatCount: 2,
      cutoffTime: "2099-05-20T17:00:00.000Z",
      settlementMode: "STRICT"
    }
  });
  const event = await createResponse.json();

  for (const attendeeWallet of ["wallet-1", "wallet-2", "wallet-3"]) {
    await request.post(`http://127.0.0.1:4101/events/${event.id}/reservations`, {
      data: { attendeeWallet }
    });
  }

  await page.goto(`/events/${event.id}`);
  await expect(page.getByText("Event status: FULL")).toBeVisible();
  await expect(page.getByText("Seat capacity: 2")).toBeVisible();
  await expect(page.getByText("Seats taken: 2 / 2")).toBeVisible();
  await expect(page.getByText("Remaining seats: 0")).toBeVisible();
  await expect(page.getByText("Waitlisted seats: 1")).toBeVisible();
  await expect(page.getByText("Waitlist is active for this event.")).toBeVisible();
});

test("homepage explains the pricing and sponsor campaign path", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Pricing: 9 USDC / event")).toBeVisible();
  await expect(page.getByText("Sponsor campaigns are a later expansion path.")).toBeVisible();
});

test("attendee can cancel before cutoff", async ({ page }) => {
  await page.goto("/events/evt_cancel");
  await page.getByRole("button", { name: "Connect wallet" }).click();
  await page.getByRole("button", { name: "Reserve with USDC" }).click();
  await page.getByRole("button", { name: "Cancel reservation" }).click();
  await expect(page.getByText("Reservation cancelled")).toBeVisible();
});

test("eligible party attendees can switch demo wallets and claim a prepared bonus", async ({ page }) => {
  await page.goto("/check-in/evt_party");
  await page.getByRole("button", { name: "Settle Event" }).click();
  await page.getByRole("button", { name: "Prepare Party Distribution" }).click();

  await page.goto("/events/evt_party");
  await expect(page.getByText("Settlement progress: CLAIM_IN_PROGRESS")).toBeVisible();
  await expect(page.getByText("Party bonus per attendee: 10 USDC")).toBeVisible();
  await page.getByLabel("Demo wallet").selectOption("wallet-party-1");
  await expect(page.getByText("Connected: wallet-party-1")).toBeVisible();
  await page.getByRole("button", { name: "Claim Party Bonus" }).click();
  await expect(page.getByText("Party bonus claimed")).toBeVisible();
});
