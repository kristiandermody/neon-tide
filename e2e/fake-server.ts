import type { Page } from "@playwright/test";

// A scripted game server for client behaviour that depends on exact message order. It replaces both the
// create call and the WebSocket, so nothing reaches the real worker and no real game (or create quota) is used.

export const FAKE_GAME_ID = "0123456789abcdef";

type Placement = { ship: string; cell: number; orientation: "h" | "v" };

export interface FakeServer {
  /** WebSocket URLs the page asked for, in order. */
  urls: string[];
}

/**
 * Computer game as the real server plays it: join/resume -> placing state; on `ready` the computer moves
 * first (a `result` sent BEFORE the playing `state`, as in src/index.ts); every `fire` is answered with a
 * miss and a fresh state.
 */
export async function fakeComputerGame(page: Page): Promise<FakeServer> {
  const fake: FakeServer = { urls: [] };
  await page.route("**/api/games", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: FAKE_GAME_ID }) }));

  let fleet: Placement[] | null = null;
  let ready = false;
  const yourShots: Array<{ cell: number; result: "miss" }> = [];
  const opponentShots: Array<{ cell: number; result: "miss" }> = [];
  const state = (turn: "you" | "opponent" | null) => ({
    type: "state",
    id: FAKE_GAME_ID,
    mode: "computer",
    phase: ready ? "playing" : "placing",
    turn: ready ? turn : null,
    winner: null,
    yourFleet: fleet,
    yourReady: ready,
    opponentReady: true,
    opponentJoined: true,
    opponentConnected: true,
    yourShots,
    opponentShots,
    yourSunk: [],
    opponentSunk: [],
  });

  await page.routeWebSocket(/\/ws\//, (ws) => {
    fake.urls.push(ws.url());
    ws.onMessage((raw) => {
      const msg = JSON.parse(String(raw)) as { type: string; fleet?: Placement[]; cell?: number };
      if (msg.type === "join" || msg.type === "resume") ws.send(JSON.stringify(state("you")));
      else if (msg.type === "place") fleet = msg.fleet!;
      else if (msg.type === "ready") {
        ready = true;
        opponentShots.push({ cell: 0, result: "miss" });
        ws.send(JSON.stringify({ type: "result", by: "opponent", cell: 0, result: "miss", winner: null }));
        ws.send(JSON.stringify(state("you")));
      } else if (msg.type === "fire") {
        yourShots.push({ cell: msg.cell!, result: "miss" });
        ws.send(JSON.stringify({ type: "result", by: "you", cell: msg.cell, result: "miss", winner: null }));
        ws.send(JSON.stringify(state("you")));
      }
    });
  });
  return fake;
}

/** Records every toast with what the screen looked like when it appeared. */
export async function recordToasts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen: Array<{ title: string; body: string; battle: boolean; placing: boolean }> = [];
    (window as unknown as { __toasts: typeof seen }).__toasts = seen;
    document.addEventListener("DOMContentLoaded", () => {
      const region = document.getElementById("toasts");
      if (!region) return;
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of Array.from(record.addedNodes)) {
            if (!(node instanceof HTMLElement) || !node.classList.contains("nt-toast")) continue;
            const title = node.querySelector(".nt-toast__title")?.textContent ?? "";
            seen.push({
              title,
              body: (node.textContent ?? "").slice(title.length),
              battle: document.querySelector(".nt-banner") !== null,
              placing: (document.body.textContent ?? "").includes("Place fleet"),
            });
          }
        }
      }).observe(region, { childList: true });
    });
  });
}

export const toastsSeen = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __toasts: Array<{ title: string; body: string; battle: boolean; placing: boolean }> }).__toasts,
  );
