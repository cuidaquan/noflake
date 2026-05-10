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
