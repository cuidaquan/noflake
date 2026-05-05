import { expect, test } from "@playwright/test";

test("homepage shows NoFlake value proposition", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("NoFlake")).toBeVisible();
  await expect(page.getByText("anti-no-show RSVP layer")).toBeVisible();
});
