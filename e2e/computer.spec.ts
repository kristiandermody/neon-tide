import { expect, test } from "./fixtures.ts";
import { fireOnce, placeRandomAndReady, playToEnd, shotCells } from "./helpers.ts";

test("a full game against the computer at phone width", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/");
  await page.getByRole("button", { name: "Play the computer" }).click();
  await expect(page).toHaveURL(/\/g\/[0-9a-z]{16}$/);

  // Tap-to-place: carrier at A1, rotate the next ship, place it, then fill the rest.
  await page.getByRole("gridcell", { name: "A1", exact: true }).click();
  await page.getByRole("button", { name: "Rotate" }).click();
  await page.getByRole("gridcell", { name: "J1", exact: true }).click();
  await expect(page.getByRole("gridcell", { name: "J4, your ship" })).toBeVisible();
  await placeRandomAndReady(page);

  await expect(page.locator(".nt-banner")).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  expect(width, "no horizontal scroll").toBe(true);
  await playToEnd(page);
  const title = page.locator("dialog[open] h2");
  await expect(title).toHaveText(/You (win|lose)/);
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "New game" }).click();
  await expect(page.getByRole("button", { name: "Play the computer" })).toBeVisible();
});

test("closing the tab mid-game and reopening the link resumes the same game", async ({ context }) => {
  let page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Play the computer" }).click();
  await placeRandomAndReady(page);
  for (let i = 0; i < 4; i++) {
    await expect(page.locator(".nt-banner--you")).toBeVisible();
    await fireOnce(page);
  }
  await expect(page.locator(".nt-banner--you")).toBeVisible();
  const url = page.url();
  await page.close();

  page = await context.newPage();
  await page.goto(url);
  await expect(page.locator(".nt-banner--you")).toBeVisible();
  await expect(shotCells(page)).toHaveCount(4);
  await fireOnce(page);
  await expect(shotCells(page)).toHaveCount(5);
});
