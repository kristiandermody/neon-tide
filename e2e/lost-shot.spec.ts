import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures.ts";
import { placeRandomAndReady, shotCells, targetCells } from "./helpers.ts";

/** The banner says "your turn" even before the socket is replaced, so keep aiming until Fire unlocks. */
async function expectSecondShotLands(page: Page): Promise<void> {
  const fire = page.getByRole("button", { name: /^Fire/ });
  await expect(async () => {
    await targetCells(page).first().click();
    await expect(fire).toBeEnabled({ timeout: 500 });
  }).toPass({ timeout: 15_000 });
  await fire.click();
  await expect(shotCells(page)).toHaveCount(1);
}

// B1: after an iOS lock screen a socket can report OPEN while dead. The fire frame is lost, no result or
// error ever arrives, and the client used to keep `firing` set after the reconnect, so Fire stayed disabled.

test("a shot lost on a dead socket does not freeze the turn after the reconnect", async ({ page }) => {
  let dropNextFire = false;
  await page.routeWebSocket(/\/ws\//, (ws) => {
    const server = ws.connectToServer();
    let dead = false;
    ws.onMessage((message) => {
      if (dead) return;
      if (dropNextFire && typeof message === "string" && message.includes('"fire"')) {
        // The frame goes nowhere and this socket never answers again, like a socket killed by the lock screen.
        dropNextFire = false;
        dead = true;
        return;
      }
      server.send(message);
    });
    server.onMessage((message) => {
      if (!dead) ws.send(message);
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Play the computer" }).click();
  await placeRandomAndReady(page);
  await expect(page.locator(".nt-banner--you")).toBeVisible();

  dropNextFire = true;
  await targetCells(page).first().click();
  await page.getByRole("button", { name: /^Fire/ }).click();
  await expect(shotCells(page)).toHaveCount(0);

  // The player unlocks the phone: the client probes the socket, finds it dead and replaces it (about 3 s).
  await page.evaluate(() => dispatchEvent(new Event("pageshow")));
  await expect(page.locator(".nt-banner--you")).toBeVisible();

  await expectSecondShotLands(page);
});

test("a socket that closes right after the shot also leaves the turn playable", async ({ page }) => {
  let dropNextFire = false;
  await page.routeWebSocket(/\/ws\//, (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((message) => {
      if (dropNextFire && typeof message === "string" && message.includes('"fire"')) {
        dropNextFire = false;
        ws.close();
        return;
      }
      server.send(message);
    });
    server.onMessage((message) => ws.send(message));
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Play the computer" }).click();
  await placeRandomAndReady(page);
  await expect(page.locator(".nt-banner--you")).toBeVisible();

  dropNextFire = true;
  await targetCells(page).first().click();
  await page.getByRole("button", { name: /^Fire/ }).click();

  await expectSecondShotLands(page);
});
