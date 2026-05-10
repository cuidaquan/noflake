import { expect, test } from "./test-helpers";

test("organizer can create an event", async ({ page }) => {
  await page.goto("/organizer");
  await page.getByLabel("Title").fill("Builder Dinner");
  await page.getByLabel("Venue").fill("Shanghai");
  await page.getByLabel("Deposit Amount").fill("20");
  await page.getByRole("button", { name: "Create Event" }).click();
  await expect(page.getByText("Builder Dinner")).toBeVisible();
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
  await expect(page.getByText(/^QR payload:/)).toBeVisible();
  await expect(page.getByText("Reserved")).toBeVisible();
});

test("organizer sees sponsor funding guidance for sponsor mode", async ({ page }) => {
  await page.goto("/organizer");
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
