import { expect, test } from "@playwright/test";

test("organizer can check in attendee and settle event", async ({ page }) => {
  await page.goto("/check-in/evt_cancel");
  await page.getByRole("button", { name: "Check In wallet-1" }).click();
  await page.getByRole("button", { name: "Settle Event" }).click();
  await expect(page.getByText("Settlement complete")).toBeVisible();
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
