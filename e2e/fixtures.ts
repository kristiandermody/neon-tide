import { test as base, type Page } from "@playwright/test";

// Headless browsers still play Web Audio, and test clicks unlock it, so every context starts muted
// (the app's own mute setting). Only set when absent, so the mute test can still flip and persist it.
const startMuted = () => {
  try {
    if (localStorage.getItem("nt:muted") === null) localStorage.setItem("nt:muted", "1");
  } catch {
    // storage unavailable; Chromium also runs with --mute-audio
  }
};

export const test = base.extend<{ newPlayer: () => Promise<Page> }>({
  context: async ({ context }, use) => {
    await context.addInitScript(startMuted);
    await use(context);
  },
  /** A separate device: its own context, storage and player token. */
  newPlayer: async ({ browser, contextOptions }, use) => {
    await use(async () => {
      const ctx = await browser.newContext(contextOptions);
      await ctx.addInitScript(startMuted);
      return ctx.newPage();
    });
  },
});

export { expect } from "@playwright/test";
