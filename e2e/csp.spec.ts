import { expect, test } from "./fixtures.ts";
import { fireOnce, placeRandomAndReady } from "./helpers.ts";

// S4: the Content-Security-Policy in public/_headers must not block anything the app needs, on both browsers.
// A blocked script, style, image, font or WebSocket shows up as a console error or a securitypolicyviolation event.

test("the app runs under its Content-Security-Policy with no violations", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      console.error(`CSP violation: ${e.violatedDirective} blocked ${e.blockedURI}`);
    });
  });

  const response = await page.goto("/");
  const csp = response?.headers()["content-security-policy"] ?? "";
  expect(csp, "the page is served with a CSP").toContain("default-src 'none'");
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");

  // Home, placement, the real WebSocket, a shot and its animations all run under the policy.
  await page.getByRole("button", { name: "Play the computer" }).click();
  await placeRandomAndReady(page);
  await expect(page.locator(".nt-banner--you, .nt-banner--opp").first()).toBeVisible();
  if (await page.locator(".nt-banner--you").count()) await fireOnce(page);

  expect(problems.filter((p) => /content security policy|csp|refused to|blocked/i.test(p)), problems.join("\n")).toEqual([]);
  expect(problems).toEqual([]);
});
