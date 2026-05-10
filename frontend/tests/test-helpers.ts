import { expect, test as base } from "@playwright/test";

const RESET_URL = "http://127.0.0.1:4101/system/reset";

export const test = base.extend({});

test.beforeEach(async ({ request }) => {
  const response = await request.post(RESET_URL);

  expect(response.ok(), `expected ${RESET_URL} to reset backend state`).toBe(true);
});

export { expect };
