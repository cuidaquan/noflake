import { expect, test } from "./test-helpers";

test("organizer can create an event", async ({ page }) => {
  await page.goto("/organizer");
  await expect(page.getByText("Connected host wallet: demo-host-wallet")).toBeVisible();
  await expect(page.getByLabel("Host demo wallet")).toBeVisible();
  await page.getByLabel("Host demo wallet").selectOption("wallet-demo-1");
  await expect(page.getByText("Connected host wallet: wallet-demo-1")).toBeVisible();
  await page.getByLabel("Title").fill("Builder Dinner");
  await page.getByLabel("Venue").fill("Shanghai");
  await page.getByLabel("Deposit Amount").fill("20");
  await page.getByRole("button", { name: "Create Event" }).click();
  await expect(page.getByText("Builder Dinner")).toBeVisible();
  await expect(page.getByText(/^Host wallet: wallet-demo-1$/)).toBeVisible();
  await expect(page.getByText("Created path: Demo backend host")).toBeVisible();
});

test("organizer uses the browser wallet creation path when an injected wallet is available", async ({
  page
}) => {
  await page.addInitScript(() => {
    const provider = {
      publicKey: {
        toBase58: () => "host-browser-1"
      },
      connect: async () => ({ publicKey: { toBase58: () => "host-browser-1" } }),
      signMessage: async () => new Uint8Array([104, 111, 115, 116])
    };

    Object.defineProperty(window, "solana", {
      configurable: true,
      value: provider
    });
  });

  await page.goto("/organizer");
  await expect(page.getByText("Host wallet path: Browser wallet available")).toBeVisible();
  await page.getByRole("button", { name: "Connect host wallet" }).click();
  await expect(page.getByText("Connected host wallet: host-browser-1")).toBeVisible();
  await page.getByLabel("Title").fill("Browser Host Dinner");
  await expect(
    page.getByText("Host wallet intent: Create event Browser Host Dinner with host-browser-1")
  ).toBeVisible();
  await expect(
    page.getByText("Authorization payload: create-event:host-browser-1:Browser Host Dinner")
  ).toBeVisible();
  await expect(page.getByText("Intent action: create-event")).toBeVisible();
  await expect(page.getByText("Intent target: Browser Host Dinner")).toBeVisible();
  await expect(page.getByText("Settlement token: USDC")).toBeVisible();
  await page.getByLabel("Venue").fill("Shanghai");
  await page.getByLabel("Deposit Amount").fill("20");
  await page.getByRole("button", { name: "Create Event" }).click();
  await expect(page.getByText(/^Host wallet: host-browser-1$/)).toBeVisible();
  await expect(page.getByText("Created path: Browser wallet")).toBeVisible();
  await expect(page.getByText("Host authorization: Signed in browser wallet")).toBeVisible();
  await expect(
    page.getByText("Host authorization payload: create-event:host-browser-1:Browser Host Dinner")
  ).toBeVisible();
});

test("organizer sees browser-wallet signing progress before event creation completes", async ({
  page
}) => {
  await page.addInitScript(() => {
    let releaseSignature: (() => void) | null = null;
    let releaseCreateEvent: (() => void) | null = null;

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.endsWith("/events") && init?.method === "POST") {
        await new Promise<void>((resolve) => {
          releaseCreateEvent = resolve;
        });
      }

      return originalFetch(input, init);
    };

    const provider = {
      publicKey: {
        toBase58: () => "host-browser-delayed"
      },
      connect: async () => ({ publicKey: { toBase58: () => "host-browser-delayed" } }),
      signMessage: async () => {
        await new Promise<void>((resolve) => {
          releaseSignature = resolve;
        });
        return new Uint8Array([104, 111, 115, 116]);
      }
    };

    Object.defineProperty(window, "solana", {
      configurable: true,
      value: provider
    });

    Object.defineProperty(window, "__noflakeHostWalletTest", {
      configurable: true,
      value: {
        releaseSignature: () => releaseSignature?.(),
        releaseCreateEvent: () => releaseCreateEvent?.()
      }
    });
  });

  await page.goto("/organizer");
  await page.getByRole("button", { name: "Connect host wallet" }).click();
  await expect(page.getByText("Connected host wallet: host-browser-delayed")).toBeVisible();
  await page.getByLabel("Title").fill("Delayed Host Dinner");
  await page.getByLabel("Venue").fill("Shanghai");
  await page.getByLabel("Deposit Amount").fill("20");

  const createClick = page.getByRole("button", { name: "Create Event" }).click();
  await expect(
    page.getByText("Host authorization status: Awaiting browser wallet signature...")
  ).toBeVisible();

  await page.evaluate(() => {
    (
      window as Window & {
        __noflakeHostWalletTest?: {
          releaseSignature: () => void;
          releaseCreateEvent: () => void;
        };
      }
    ).__noflakeHostWalletTest?.releaseSignature();
  });

  await expect(
    page.getByText("Host authorization status: Signed. Submitting event...")
  ).toBeVisible();

  await page.evaluate(() => {
    (
      window as Window & {
        __noflakeHostWalletTest?: {
          releaseSignature: () => void;
          releaseCreateEvent: () => void;
        };
      }
    ).__noflakeHostWalletTest?.releaseCreateEvent();
  });

  await createClick;
  await expect(page.getByText(/^Host wallet: host-browser-delayed$/)).toBeVisible();
});

test("organizer sees event creation disabled when the browser wallet cannot sign", async ({
  page
}) => {
  await page.addInitScript(() => {
    const provider = {
      publicKey: {
        toBase58: () => "host-browser-nosign"
      },
      connect: async () => ({ publicKey: { toBase58: () => "host-browser-nosign" } })
    };

    Object.defineProperty(window, "solana", {
      configurable: true,
      value: provider
    });
  });

  await page.goto("/organizer");
  await expect(
    page.getByText("Connected browser wallet does not support message signing. Use demo flow or a compatible wallet.")
  ).toBeVisible();
  await page.getByRole("button", { name: "Connect host wallet" }).click();
  await expect(page.getByText("Connected host wallet: host-browser-nosign")).toBeVisible();
  await page.getByLabel("Title").fill("Unsigned Host Dinner");
  await page.getByLabel("Venue").fill("Shanghai");
  await page.getByLabel("Deposit Amount").fill("20");
  await expect(page.getByRole("button", { name: "Create Event" })).toBeDisabled();
  await expect(
    page.getByText("Browser host wallet authorization is required before creating an event.")
  ).toHaveCount(0);
});

test("organizer can switch to demo fallback and hide browser-wallet intent preview", async ({
  page
}) => {
  await page.addInitScript(() => {
    const provider = {
      publicKey: {
        toBase58: () => "host-browser-1"
      },
      connect: async () => ({ publicKey: { toBase58: () => "host-browser-1" } }),
      signMessage: async () => new Uint8Array([104, 111, 115, 116])
    };

    Object.defineProperty(window, "solana", {
      configurable: true,
      value: provider
    });
  });

  await page.goto("/organizer");
  await expect(page.getByText(/^Host wallet intent:/)).toHaveCount(0);
  await expect(page.getByLabel("Host demo wallet")).toBeVisible();
  await page.getByLabel("Host demo wallet").selectOption("wallet-demo-1");
  await expect(page.getByText("Connected host wallet: wallet-demo-1")).toBeVisible();
  await expect(
    page.getByText("Host wallet intent: Create event Untitled event with wallet-demo-1")
  ).toHaveCount(0);
  await page.getByLabel("Title").fill("Demo Host Dinner");
  await page.getByLabel("Venue").fill("Shanghai");
  await page.getByLabel("Deposit Amount").fill("20");
  await page.getByRole("button", { name: "Create Event" }).click();
  await expect(page.getByText(/^Host wallet: wallet-demo-1$/)).toBeVisible();
});

test("organizer can switch back to browser wallet after choosing demo fallback", async ({
  page
}) => {
  await page.addInitScript(() => {
    const provider = {
      publicKey: {
        toBase58: () => "host-browser-return"
      },
      connect: async () => ({ publicKey: { toBase58: () => "host-browser-return" } }),
      signMessage: async () => new Uint8Array([104, 111, 115, 116])
    };

    Object.defineProperty(window, "solana", {
      configurable: true,
      value: provider
    });
  });

  await page.goto("/organizer");
  await expect(page.getByLabel("Host demo wallet")).toBeVisible();
  await page.getByLabel("Host demo wallet").selectOption("wallet-demo-1");
  await expect(page.getByText("Connected host wallet: wallet-demo-1")).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect host wallet" })).toBeEnabled();
  await page.getByRole("button", { name: "Connect host wallet" }).click();
  await expect(page.getByText("Connected host wallet: host-browser-return")).toBeVisible();
  await expect(page.getByText("Host wallet path: Browser wallet connected")).toBeVisible();
  await expect(
    page.getByText("Host wallet intent: Create event Untitled event with host-browser-return")
  ).toBeVisible();
});

test("organizer sees share link, QR payload, and dashboard counts after creating an event", async ({
  page
}) => {
  await page.goto("/organizer");
  await page.getByLabel("Title").fill("Builder Dinner");
  await page.getByLabel("Venue").fill("Shanghai");
  await page.getByLabel("Deposit Amount").fill("20");
  await page.getByRole("button", { name: "Create Event" }).click();
  await expect(page.getByText(/^Share link:/)).toBeVisible();
  await expect(page.getByText(/^Check-in console:/)).toBeVisible();
  await expect(page.getByText(/^QR payload:/)).toBeVisible();
  await expect(page.getByText("Reserved")).toBeVisible();
});

test("organizer sees sponsor funding guidance for sponsor mode", async ({ page }) => {
  await page.goto("/organizer");
  await expect(
    page.getByText("Attendees can connect a browser wallet or use the local demo fallback.")
  ).toBeVisible();
  await page.getByLabel("Title").fill("Sponsor Dinner");
  await page.getByLabel("Venue").fill("Shanghai");
  await page.getByLabel("Deposit Amount").fill("20");
  await page.getByLabel("Settlement Mode").selectOption("SPONSOR");
  await expect(
    page.getByText("Sponsor funds the bonus pool after event creation in a separate step.")
  ).toBeVisible();
});

test("organizer sees the per-event pricing note", async ({ page }) => {
  await page.goto("/organizer");
  await expect(page.getByText("Pricing: 9 USDC / event")).toBeVisible();
  await expect(page.getByText("Sponsor campaigns can be scoped separately later.")).toBeVisible();
});

test("organizer sees a QR payload and check-in guidance after creating an event", async ({ page }) => {
  await page.goto("/organizer");
  await page.getByLabel("Title").fill("Builder Dinner");
  await page.getByLabel("Venue").fill("Shanghai");
  await page.getByLabel("Deposit Amount").fill("20");
  await page.getByRole("button", { name: "Create Event" }).click();
  await expect(page.getByText("QR payload")).toBeVisible();
  await expect(page.getByLabel("QR code")).toBeVisible();
  await expect(page.getByText("Scan this at the door for check-in.")).toBeVisible();
});
