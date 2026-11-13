import { expect, test } from "./fixtures.ts";

// S1: per-game socket cap and per-socket message budget, against the real Durable Object.
// One game only: E2E runs share one IP, whose game creation is limited to 20 per 10 minutes.
// The per-IP upgrade limit is not exercised here (it would starve the other tests of upgrades); see the unit tests.
test.skip(({ browserName }) => browserName !== "chromium", "browser-independent server behaviour; one project is enough");

test("a game refuses socket 17, and a socket that floods messages is closed with 4429", async ({ page, request }) => {
  const token = "c".repeat(32);
  const created = await request.post("/api/games", { data: { mode: "friend", token } });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  await page.goto("/");

  const result = await page.evaluate(async (gameId) => {
    const url = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/${gameId}`;
    const open = (): Promise<WebSocket | null> =>
      new Promise((resolve) => {
        const ws = new WebSocket(url);
        ws.onopen = () => resolve(ws);
        ws.onerror = () => resolve(null);
      });

    // 1. Flood one socket with junk: it must be closed with the rate-limit code.
    const flooder = await open();
    if (!flooder) return { error: "could not open the first socket" };
    const flooderClose = new Promise<number>((resolve) => (flooder.onclose = (e) => resolve(e.code)));
    for (let i = 0; i < 60; i++) flooder.send('{"type":"bogus"}');
    const closeCode = await Promise.race([flooderClose, new Promise<number>((r) => setTimeout(() => r(-1), 10_000))]);

    // 2. Fill the game with idle sockets. The flooder is gone, so 16 fit and the 17th is refused.
    await new Promise((r) => setTimeout(r, 500));
    const sockets: WebSocket[] = [];
    let firstRefused: number | null = null;
    for (let i = 1; i <= 18; i++) {
      const ws = await open();
      if (ws) sockets.push(ws);
      else firstRefused ??= i;
    }
    sockets.forEach((s) => s.close());
    return { closeCode, opened: sockets.length, firstRefused };
  }, id);

  expect(result).toEqual({ closeCode: 4429, opened: 16, firstRefused: 17 });
});
