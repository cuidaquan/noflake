import { expect, test } from "@playwright/test";

test("attendee can reserve a seat", async ({ page }) => {
  await page.goto("/events/evt_1");
  await expect(page.getByRole("button", { name: "Connect wallet" })).toBeVisible();
  await page.getByRole("button", { name: "Connect wallet" }).click();
  await expect(page.getByText("Connected: wallet-demo-1")).toBeVisible();
  await page.getByRole("button", { name: "Reserve with USDC" }).click();
  await expect(page.getByText("Reservation confirmed")).toBeVisible();
});
