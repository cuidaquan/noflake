import { expect, test } from "@playwright/test";

test("attendee can reserve a seat", async ({ page }) => {
  await page.goto("/events/evt_1");
  await page.getByRole("button", { name: "Reserve with USDC" }).click();
  await expect(page.getByText("Reservation confirmed")).toBeVisible();
});
