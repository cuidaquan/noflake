import { expect, test } from "./test-helpers";

test("organizer can check in attendee and settle event", async ({ page }) => {
  await page.goto("/check-in/evt_cancel");
  await page.getByRole("button", { name: "Check In wallet-1" }).click();
  await page.getByRole("button", { name: "Settle Event" }).click();
  await expect(page.getByText("Settlement complete")).toBeVisible();
});

test("organizer can apply a scanned check-in payload and check in the matching attendee", async ({
  page
}) => {
  await page.goto("/events/evt_cancel");
  await page.getByLabel("Demo wallet").selectOption("wallet-undo-1");
  await page.getByRole("button", { name: "Reserve with USDC" }).click();
  await expect(page.getByText(/Check-in pass:/)).toBeVisible();
  await expect(page.getByTestId("checkin-pass-payload")).toHaveText(
    /\/check-in\/evt_cancel\?attendeeWallet=wallet-undo-1/
  );
  const payload = await page.getByTestId("checkin-pass-payload").evaluate((element) =>
    element.textContent?.trim() ?? ""
  );
  expect(payload).toBe("/check-in/evt_cancel?attendeeWallet=wallet-undo-1");

  await page.goto("/check-in/evt_cancel");
  await page.getByLabel("Scan payload").fill(payload);
  await page.getByRole("button", { name: "Apply Scan Payload" }).click();
  await expect(page.getByText("Scanned attendee: wallet-undo-1")).toBeVisible();
  await page.getByRole("button", { name: "Check In wallet-undo-1" }).click();
  await expect(page.getByText("Status: CHECKED_IN")).toBeVisible();
});

test("check-in console shows wallet provenance for browser-wallet reservations", async ({
  page,
  request
}) => {
  const createResponse = await request.post("http://127.0.0.1:4101/events", {
    data: {
      title: "Wallet Provenance Dinner",
      hostWallet: "host-browser-1",
      creationPath: "BROWSER_WALLET",
      hostAuthorizationMessage: "create-event:host-browser-1:Wallet Provenance Dinner",
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

  await request.post(`http://127.0.0.1:4101/events/${event.id}/reservations`, {
    data: {
      attendeeWallet: "wallet-browser-1",
      paymentPath: "BROWSER_WALLET",
      walletAuthorizationMessage: `reserve:${event.id}:wallet-browser-1`,
      walletAuthorization: "signed-intent-proof"
    }
  });

  await page.goto(`/check-in/${event.id}`);
  await expect(page.getByText("Host wallet: host-browser-1")).toBeVisible();
  await expect(page.getByText("Host wallet path: Browser wallet")).toBeVisible();
  await expect(page.getByText("Host authorization: Signed in browser wallet")).toBeVisible();
  await expect(
    page.getByText("Host authorization payload: create-event:host-browser-1:Wallet Provenance Dinner")
  ).toBeVisible();
  await expect(page.getByText("Payment path: Browser wallet")).toBeVisible();
  await expect(page.getByText("Wallet authorization: Present")).toBeVisible();
  await expect(
    page.getByText(`Authorization payload: reserve:${event.id}:wallet-browser-1`)
  ).toBeVisible();
});

test("settlement page shows party bonus when the event is in party mode", async ({ page }) => {
  await page.goto("/check-in/evt_party");
  await page.getByRole("button", { name: "Settle Event" }).click();
  await expect(page.getByText("Party bonus")).toBeVisible();
});

test("sponsor mode shows prepare distribution after settlement instead of one-pass completion", async ({
  page
}) => {
  await page.goto("/check-in/evt_sponsor");
  await page.getByRole("button", { name: "Settle Event" }).click();

  await expect(page.getByRole("button", { name: "Prepare Sponsor Distribution" })).toBeVisible();
  await expect(page.getByText(/Forfeited: 20 USDC/)).toBeVisible();
});

test("organizer can undo check-in and cancel an event", async ({ page }) => {
  await page.goto("/check-in/evt_undo");
  await page.getByRole("button", { name: "Check In wallet-undo-1" }).click();
  await page.getByRole("button", { name: "Undo Check-In wallet-undo-1" }).click();
  await expect(page.getByText("Status: RESERVED")).toBeVisible();
  await page.getByRole("button", { name: "Cancel Event" }).click();
  await expect(page.getByText("Event cancelled")).toBeVisible();
});

test("organizer funds sponsor pool and can only finalize after all sponsor attendees claim", async ({
  page
}) => {
  await page.goto("/check-in/evt_sponsor_funding");
  await expect(page.getByRole("button", { name: "Fund Sponsor Pool" })).toBeVisible();
  await page.getByRole("button", { name: "Settle Event" }).click();
  await page.getByRole("button", { name: "Prepare Sponsor Distribution" }).click();

  await expect(page.getByRole("button", { name: "Finalize Event" })).toBeDisabled();

  await page.goto("/events/evt_sponsor_funding");
  await page.getByLabel("Demo wallet").selectOption("wallet-sponsor-1");
  await page.getByRole("button", { name: "Claim Sponsor Bonus" }).click();
  await page.getByLabel("Demo wallet").selectOption("wallet-sponsor-2");
  await page.getByRole("button", { name: "Claim Sponsor Bonus" }).click();

  await page.goto("/check-in/evt_sponsor_funding");
  await expect(page.getByRole("button", { name: "Finalize Event" })).toBeEnabled();
  await page.getByRole("button", { name: "Finalize Event" }).click();
  await expect(page.getByText("Event finalized")).toBeVisible();
});
