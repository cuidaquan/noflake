import { expect, test } from "@playwright/test";

test("organizer can check in attendee and settle event", async ({ page }) => {
  await page.goto("/check-in/evt_1");
  await page.getByRole("button", { name: "Check In wallet-1" }).click();
  await page.getByRole("button", { name: "Settle Event" }).click();
  await expect(page.getByText("Settlement complete")).toBeVisible();
});
