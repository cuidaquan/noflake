import { expect, test } from "@playwright/test";

test("attendee can reserve a seat", async ({ page }) => {
  await page.goto("/events/evt_1");
  await expect(page.getByRole("button", { name: "Connect wallet" })).toBeVisible();
  await page.getByRole("button", { name: "Connect wallet" }).click();
  await expect(page.getByText("Connected: wallet-demo-1")).toBeVisible();
  await page.getByRole("button", { name: "Reserve with USDC" }).click();
  await expect(page.getByText("Reservation status: RESERVED")).toBeVisible();
});

test("attendee can inspect event details before reserving", async ({ page }) => {
  await page.goto("/events/evt_1");
  await expect(page.getByText("Settlement mode: STRICT")).toBeVisible();
  await expect(page.getByText("Cutoff time: 2026-05-20T17:00:00.000Z")).toBeVisible();
  await expect(page.getByText("Event status: OPEN")).toBeVisible();
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
  await page.getByLabel("Demo wallet").selectOption("wallet-party-1");
  await expect(page.getByText("Connected: wallet-party-1")).toBeVisible();
  await page.getByRole("button", { name: "Claim Party Bonus" }).click();
  await expect(page.getByText("Party bonus claimed")).toBeVisible();
});
