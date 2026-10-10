import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLASSIC_RULES,
  fire,
  markReady,
  newGame,
  placeFleet,
  seededRng,
  shotsAt,
  sunkShips,
  type GameState,
  type Placement,
} from "../../src/engine/index.ts";

const R = CLASSIC_RULES;
const stacked = (): Placement[] => R.fleet.map((s, i) => ({ ship: s.id, cell: i * R.size, orientation: "h" }));
const fleetCells = (): number[] => R.fleet.flatMap((s, i) => Array.from({ length: s.length }, (_, k) => i * R.size + k));

/** Both seats placed and ready, seat 0 to move. */
function started(): GameState {
  const game = newGame();
  assert.equal(placeFleet(R, game, 0, stacked()).ok, true);
  assert.equal(placeFleet(R, game, 1, stacked()).ok, true);
  markReady(game, 0, () => 0);
  markReady(game, 1, () => 0);
  return game;
}

test("placement: invalid fleets are rejected, valid ones can be replaced until ready", () => {
  const game = newGame();
  assert.deepEqual(placeFleet(R, game, 0, stacked().slice(1)), { ok: false, error: "wrong_fleet" });
  assert.equal(placeFleet(R, game, 0, stacked()).ok, true);
  const moved = stacked();
  moved[4] = { ship: "destroyer", cell: 95, orientation: "h" };
  assert.equal(placeFleet(R, game, 0, moved).ok, true);
  assert.equal(game.players[0].fleet![4].cell, 95);
});

test("ready needs a fleet, locks it, and is one-way", () => {
  const game = newGame();
  assert.deepEqual(markReady(game, 0, () => 0), { ok: false, error: "no_fleet" });
  placeFleet(R, game, 0, stacked());
  assert.equal(markReady(game, 0, () => 0).ok, true);
  assert.deepEqual(markReady(game, 0, () => 0), { ok: false, error: "already_ready" });
  assert.deepEqual(placeFleet(R, game, 0, stacked()), { ok: false, error: "already_ready" });
  assert.equal(game.phase, "placing");
});

test("both ready starts play and a coin flip picks the first turn", () => {
  const a = newGame();
  placeFleet(R, a, 0, stacked());
  placeFleet(R, a, 1, stacked());
  markReady(a, 0, () => 0.9);
  markReady(a, 1, () => 0.9);
  assert.equal(a.phase, "playing");
  assert.equal(a.turn, 1);
  assert.equal(started().turn, 0);
});

test("firing is rejected before play, out of turn, off the board, or twice at one cell", () => {
  const early = newGame();
  assert.deepEqual(fire(R, early, 0, 0), { ok: false, error: "wrong_phase" });
  const game = started();
  assert.deepEqual(fire(R, game, 1, 0), { ok: false, error: "not_your_turn" });
  assert.deepEqual(fire(R, game, 0, 100), { ok: false, error: "bad_cell" });
  assert.deepEqual(fire(R, game, 0, 1.5), { ok: false, error: "bad_cell" });
  fire(R, game, 0, 99);
  fire(R, game, 1, 99);
  assert.deepEqual(fire(R, game, 0, 99), { ok: false, error: "already_shot" });
});

test("miss, hit (with ship) and sunk (with ship and its cells); turns strictly alternate even after a hit", () => {
  const game = started();
  const miss = fire(R, game, 0, 99);
  assert.ok(miss.ok);
  assert.equal(miss.value.result, "miss");
  assert.equal(miss.value.ship, undefined);
  assert.equal(game.turn, 1);

  fire(R, game, 1, 99);
  const hit = fire(R, game, 0, 40); // destroyer row, first cell
  assert.ok(hit.ok);
  assert.equal(hit.value.result, "hit");
  assert.equal(hit.value.ship, "destroyer");
  assert.equal(game.turn, 1, "a hit does not grant another turn");

  fire(R, game, 1, 98);
  const sunk = fire(R, game, 0, 41);
  assert.ok(sunk.ok);
  assert.equal(sunk.value.result, "sunk");
  assert.equal(sunk.value.ship, "destroyer");
  assert.deepEqual(sunk.value.sunkCells, [40, 41]);
  assert.deepEqual(sunkShips(R, game.players[1]), ["destroyer"]);
});

test("shotsAt replays results as the shooter saw them, without revealing unhit ship cells", () => {
  const game = started();
  for (const [a, b] of [[40, 99], [99, 98], [41, 97]]) {
    fire(R, game, 0, a);
    fire(R, game, 1, b);
  }
  const seen = shotsAt(R, game.players[1]);
  assert.deepEqual(seen.map((s) => s.result), ["hit", "miss", "sunk"]);
  const revealed = new Set(seen.flatMap((s) => [s.cell, ...(s.sunkCells ?? [])]));
  assert.deepEqual([...revealed].sort((x, y) => x - y), [40, 41, 99]);
});

test("sinking the whole fleet wins and ends the game", () => {
  const game = started();
  const targets = fleetCells();
  let last;
  for (let i = 0; i < targets.length; i++) {
    last = fire(R, game, 0, targets[i]);
    assert.ok(last.ok);
    if (i < targets.length - 1) {
      assert.equal(last.value.winner, null);
      assert.ok(fire(R, game, 1, 99 - i).ok);
    }
  }
  assert.ok(last && last.ok);
  assert.equal(last.value.winner, 0);
  assert.equal(game.phase, "over");
  assert.equal(game.winner, 0);
  assert.equal(game.turn, null);
  assert.deepEqual(fire(R, game, 1, 50), { ok: false, error: "wrong_phase" });
});

test("game state is plain JSON and survives a round trip", () => {
  const game = started();
  fire(R, game, 0, 40);
  const copy = JSON.parse(JSON.stringify(game)) as GameState;
  assert.deepEqual(copy, game);
  assert.equal(fire(R, copy, 1, 0).ok, true);
  assert.equal(seededRng(1)() === seededRng(1)(), true);
});
