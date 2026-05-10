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
  await page.getByLabel("Venue").fill("Shanghai");
  await page.getByLabel("Deposit Amount").fill("20");
  await page.getByRole("button", { name: "Create Event" }).click();
  await expect(page.getByText(/^Host wallet: host-browser-1$/)).toBeVisible();
  await expect(page.getByText("Host authorization: Signed in browser wallet")).toBeVisible();
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
