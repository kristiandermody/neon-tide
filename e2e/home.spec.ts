import { expect, test } from "@playwright/test";

test("home shows the wordmark, both modes, and install/preview metadata", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("img", { name: "Neon Tide" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Play a friend" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play the computer" })).toBeVisible();
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /^https:\/\/.+\/og\.png$/);
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  expect((await request.get("/icons/icon-192.png")).status()).toBe(200);
});

test("an unknown game link says so and offers a new game", async ({ page }) => {
  await page.goto("/g/0000000000000000");
  await expect(page.getByRole("heading", { name: "No game here" })).toBeVisible();
  await page.getByRole("button", { name: "New game" }).click();
  await expect(page.getByRole("button", { name: "Play the computer" })).toBeVisible();
});

test("the mute toggle flips and persists", async ({ page }) => {
  await page.goto("/");
  const mute = page.getByRole("button", { name: "Mute sound" });
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByRole("button", { name: "Mute sound" })).toHaveAttribute("aria-pressed", "true");
});
