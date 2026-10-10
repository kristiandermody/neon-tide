import { expect, type Page } from "@playwright/test";

export const targetCells = (page: Page) => page.locator('.nt-board:not(.nt-board--mini) button.nt-cell:not([aria-disabled="true"])');
export const shotCells = (page: Page) =>
  page.locator(".nt-board:not(.nt-board--mini) :is(.nt-cell--miss, .nt-cell--hit, .nt-cell--sunk)");

export async function placeRandomAndReady(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Place fleet" })).toBeVisible();
  await page.getByRole("button", { name: "Randomize" }).click();
  await page.getByRole("button", { name: "Ready" }).click();
}

/** Aims at the first open cell and fires. Assumes it is this page's turn. */
export async function fireOnce(page: Page): Promise<void> {
  await targetCells(page).first().click();
  await page.getByRole("button", { name: /^Fire/ }).click();
  await page.waitForFunction(() => !document.querySelector(".nt-banner--you") || document.querySelector("dialog[open]"));
}

const isOver = async (page: Page) => (await page.locator("dialog[open]").count()) > 0;
const isMyTurn = async (page: Page) => (await page.locator(".nt-banner--you").count()) > 0;

/** Plays until every page shows the game-over dialog. Each page fires whenever it has the turn. */
export async function playToEnd(...pages: Page[]): Promise<number> {
  let shots = 0;
  const deadline = Date.now() + 3 * 60 * 1000;
  while (Date.now() < deadline) {
    const over = await Promise.all(pages.map(isOver));
    if (over.every(Boolean)) return shots;
    let fired = false;
    for (const page of pages) {
      if (!(await isOver(page)) && (await isMyTurn(page))) {
        await fireOnce(page);
        shots++;
        fired = true;
      }
    }
    if (!fired) await pages[0].waitForTimeout(100);
  }
  throw new Error(`game did not finish after ${shots} shots`);
}
