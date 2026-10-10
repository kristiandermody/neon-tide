import { expect, test } from "@playwright/test";
import { placeRandomAndReady, playToEnd } from "./helpers.ts";

test("two players finish a game over a shared link; the link then stays finished", async ({ browser, contextOptions }) => {
  const host = await (await browser.newContext(contextOptions)).newPage();
  const guest = await (await browser.newContext(contextOptions)).newPage();

  await host.goto("/");
  await host.getByRole("button", { name: "Play a friend" }).click();
  await expect(host.getByRole("heading", { name: "Invite a friend" })).toBeVisible();
  const link = await host.getByLabel("Invite link", { exact: true }).inputValue();
  expect(link).toMatch(/\/g\/[0-9a-z]{16}$/);

  await host.getByRole("button", { name: "Place your fleet" }).click();
  await placeRandomAndReady(host);
  await expect(host.getByText("Waiting for a friend")).toBeVisible();

  await guest.goto(link);
  await expect(host.getByText("Friend joined")).toBeVisible();
  await placeRandomAndReady(guest);

  await playToEnd(host, guest);
  const hostResult = (await host.locator("dialog[open] h2").textContent())!;
  const guestResult = await guest.locator("dialog[open] h2").textContent();
  expect([hostResult, guestResult].sort()).toEqual(["You lose", "You win"]);

  // A third device cannot take part, and the players' links still show the result.
  const stranger = await (await browser.newContext(contextOptions)).newPage();
  await stranger.goto(link);
  await expect(stranger.getByRole("heading", { name: "Game over" })).toBeVisible();
  await host.reload();
  await expect(host.locator("dialog[open] h2")).toHaveText(hostResult);
});

test("a game with two players refuses a third", async ({ browser, contextOptions }) => {
  const [a, b, c] = await Promise.all([0, 1, 2].map(async () => (await browser.newContext(contextOptions)).newPage()));
  await a.goto("/");
  await a.getByRole("button", { name: "Play a friend" }).click();
  const link = await a.getByLabel("Invite link", { exact: true }).inputValue();
  await b.goto(link);
  await expect(b.getByRole("heading", { name: "Place fleet" })).toBeVisible();
  await c.goto(link);
  await expect(c.getByRole("heading", { name: "Game is full" })).toBeVisible();
});
