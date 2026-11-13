import { expect, test } from "./fixtures.ts";
import { FAKE_GAME_ID, fakeComputerGame, recordToasts, toastsSeen } from "./fake-server.ts";
import { placeRandomAndReady, targetCells } from "./helpers.ts";

// These run against a scripted server (see fake-server.ts), so they need no real game and are browser independent.

test("B4: the computer's opening shot waits for the battle screen instead of playing on the placement screen", async ({ page }) => {
  await recordToasts(page);
  await fakeComputerGame(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Play the computer" }).click();
  await placeRandomAndReady(page);
  await expect(page.locator(".nt-banner--you")).toBeVisible();

  await expect.poll(async () => (await toastsSeen(page)).length).toBeGreaterThan(0);
  const toasts = await toastsSeen(page);
  const opening = toasts.find((t) => t.title === "Computer missed");
  expect(opening, "the computer's opening shot is announced").toBeDefined();
  expect(opening!.body).toBe("A1");
  expect(opening!.battle, "announced on the battle screen").toBe(true);
  expect(opening!.placing, "not while 'Place fleet' is still showing").toBe(false);
  // The shot is on the player's own board once, and it is the player's turn.
  await expect(page.locator(".nt-board--mini .nt-cell--miss")).toHaveCount(1);
});

test("B6: a game link with characters the server never issues says 'No game here'", async ({ page }) => {
  const fake = await fakeComputerGame(page);
  for (const bad of ["iiiiiiiiiiiiiiii", "0123456789abcdeu", "short"]) {
    await page.goto(`/g/${bad}`);
    await expect(page.getByRole("heading", { name: "No game here" })).toBeVisible();
    await expect(page.getByRole("button", { name: "New game" })).toBeVisible();
  }
  expect(fake.urls, "no socket is opened for a malformed id").toEqual([]);
});

test("B6: an upper-case copy of a valid link still opens that game", async ({ page }) => {
  const fake = await fakeComputerGame(page);
  await page.goto(`/g/${FAKE_GAME_ID.toUpperCase()}`);
  await expect(page.getByRole("heading", { name: "Place fleet" })).toBeVisible();
  expect(fake.urls[0]).toMatch(new RegExp(`/ws/${FAKE_GAME_ID}$`));
});

test("B9: a fired cell loses its is-firing class once the result is in", async ({ page }) => {
  await fakeComputerGame(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Play the computer" }).click();
  await placeRandomAndReady(page);
  await expect(page.locator(".nt-banner--you")).toBeVisible();

  await targetCells(page).nth(5).click();
  await page.getByRole("button", { name: /^Fire/ }).click();
  await expect(page.locator(".nt-board:not(.nt-board--mini) .nt-cell--miss")).toHaveCount(1);
  await expect(page.locator(".is-firing")).toHaveCount(0);
});

test("B9: mute listeners do not pile up as screens are replaced", async ({ page }) => {
  await fakeComputerGame(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Play the computer" }).click();
  await placeRandomAndReady(page);
  await expect(page.locator(".nt-banner--you")).toBeVisible();

  // One listener per mute button on screen: the buttons of the home and placement screens were released.
  const counts = await page.evaluate(async () => {
    const path: string = "/js/feedback.js";
    const { muteListenerCount } = await import(path);
    return { listeners: muteListenerCount() as number, buttons: document.querySelectorAll(".nt-mute").length };
  });
  expect(counts.listeners).toBe(counts.buttons);
});
