import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// S4: public/_headers carries the security headers. Keep it consistent with index.html.

const read = (path: string) => readFileSync(new URL(`../../public/${path}`, import.meta.url), "utf8");

/** Header name -> value for the `/*` block, in file order. */
function allPathsBlock(): Map<string, string> {
  const lines = read("_headers").split("\n");
  const start = lines.findIndex((l) => l.trim() === "/*");
  assert.notEqual(start, -1, "_headers has a /* block");
  const headers = new Map<string, string>();
  for (const line of lines.slice(start + 1)) {
    if (!/^\s+\S/.test(line)) break; // the block ends at the first non-indented line
    const i = line.indexOf(":");
    headers.set(line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim());
  }
  return headers;
}

test("_headers sets the expected security headers for every path", () => {
  const h = allPathsBlock();
  assert.equal(h.get("x-content-type-options"), "nosniff");
  assert.equal(h.get("x-frame-options"), "DENY");
  assert.equal(h.get("referrer-policy"), "no-referrer");
  assert.ok(h.get("permissions-policy")?.includes("camera=()"));
});

test("the CSP is strict: self-only scripts, no unsafe-inline or unsafe-eval, no framing", () => {
  const csp = allPathsBlock().get("content-security-policy")!;
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /script-src 'self'(;|$)/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /connect-src 'self' wss:/);
  assert.ok(!/unsafe-inline|unsafe-eval/.test(csp));
});

test("the CSP's style hash matches the one inline <style> block in index.html", () => {
  const html = read("index.html");
  const blocks = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)];
  assert.equal(blocks.length, 1, "exactly one inline style block");
  const hash = createHash("sha256").update(blocks[0][1]).digest("base64");
  assert.ok(allPathsBlock().get("content-security-policy")!.includes(`'sha256-${hash}'`), "update the hash in public/_headers after editing the inline style");
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(html), "no inline scripts (script-src 'self' would block them)");
  assert.ok(!/\sstyle="/.test(html) && !/\son\w+="/.test(html), "no style attributes or inline event handlers");
});

test("the headers file stays within Cloudflare's limits (100 rules, 2,000 characters per line)", () => {
  const lines = read("_headers").split("\n");
  assert.ok(lines.every((l) => l.length <= 2000));
  assert.ok(lines.filter((l) => /^\S/.test(l) && !l.startsWith("#") && l.trim()).length <= 100);
});
