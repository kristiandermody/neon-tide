import { expect, test } from "./fixtures.ts";
import { fireOnce, placeRandomAndReady } from "./helpers.ts";

// Decision 2026-10-22 (overrides spec section 3): a plain hit tells the shooter "hit" and nothing else.
// The ship is named, and its damage shown, only once it has sunk. Guards against the client regressing.

test("a plain hit shows no ship name and no enemy damage pips", async ({ page }) => {
  // Record every toast: they are replaced within a second, so the page cannot be polled for them.
  await page.addInitScript(() => {
    const seen: Array<{ title: string; body: string }> = [];
    (window as unknown as { __toasts: typeof seen }).__toasts = seen;
    document.addEventListener("DOMContentLoaded", () => {
      const region = document.getElementById("toasts");
      if (!region) return;
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of Array.from(record.addedNodes)) {
            if (!(node instanceof HTMLElement) || !node.classList.contains("nt-toast")) continue;
            const title = node.querySelector(".nt-toast__title")?.textContent ?? "";
            seen.push({ title, body: (node.textContent ?? "").slice(title.length) });
          }
        }
      }).observe(region, { childList: true });
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Play the computer" }).click();
  await placeRandomAndReady(page);

  const enemyBoardHits = page.locator(".nt-board:not(.nt-board--mini) .nt-cell--hit");
  const enemyFleet = page.locator(".nt-fleet", { has: page.locator(".nt-fleet__head", { hasText: "Enemy fleet" }) });

  // Fire until the enemy board shows two plain hits (a sunk wreck is drawn as sunk, not hit).
  for (let shots = 0; shots < 70 && (await enemyBoardHits.count()) < 2; shots++) {
    await expect(page.locator(".nt-banner--you")).toBeVisible();
    await fireOnce(page);
    await expect(page.locator(".nt-banner--you, dialog[open]").first()).toBeVisible();
  }
  expect(await enemyBoardHits.count(), "the run produced plain hits to inspect").toBeGreaterThan(0);

  // Every "Hit" toast carries only a cell label such as "B4", never a ship name.
  const toasts = await page.evaluate(() => (window as unknown as { __toasts: Array<{ title: string; body: string }> }).__toasts);
  const hitToasts = toasts.filter((t) => t.title === "Hit");
  expect(hitToasts.length, "saw a hit toast").toBeGreaterThan(0);
  for (const t of hitToasts) expect(t.body).toMatch(/^[A-J](10|[1-9])$/);

  // Ships that have not sunk show no damage pips and no hit count in the enemy fleet tracker.
  const afloat = enemyFleet.locator("li.nt-fleet__ship:not(.is-sunk)");
  expect(await afloat.count()).toBeGreaterThan(0);
  await expect(afloat.locator(".nt-pip--hit")).toHaveCount(0);
  for (const label of await afloat.evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""))) {
    expect(label).toMatch(/: afloat$/);
  }
});
