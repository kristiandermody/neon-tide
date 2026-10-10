import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLASSIC_RULES,
  chooseShot,
  fire,
  heatmap,
  markReady,
  newGame,
  placeFleet,
  randomFleet,
  seededRng,
  shotsAt,
  type Shot,
} from "../../src/engine/index.ts";

const R = CLASSIC_RULES;

/** Plays the AI as seat 0 against a random fleet; seat 1 always misses in a corner it never needs. */
function shotsToWin(seed: number): number {
  const rng = seededRng(seed);
  const game = newGame();
  placeFleet(R, game, 0, randomFleet(R, rng));
  placeFleet(R, game, 1, randomFleet(R, rng));
  markReady(game, 0, () => 0);
  markReady(game, 1, () => 0);
  let shots = 0;
  const filler = [...Array(100).keys()];
  while (game.phase === "playing") {
    const cell = chooseShot(R, shotsAt(R, game.players[1]), rng);
    const result = fire(R, game, 0, cell);
    assert.ok(result.ok, `AI picked an illegal cell ${cell}`);
    shots++;
    if (game.phase === "playing") {
      const taken = new Set(game.players[0].shotsReceived);
      assert.ok(fire(R, game, 1, filler.find((c) => !taken.has(c))!).ok);
    }
  }
  assert.equal(game.winner, 0);
  return shots;
}

test("opening shot targets the centre, where the most placements overlap", () => {
  const heat = heatmap(R, []);
  const max = Math.max(...heat);
  assert.ok(heat[0] < max, "corner is never the best opening");
  const centre = [44, 45, 54, 55];
  assert.ok(centre.every((c) => heat[c] === max));
  for (let seed = 0; seed < 20; seed++) assert.ok(centre.includes(chooseShot(R, [], seededRng(seed))));
});

test("ties break randomly", () => {
  const picks = new Set<number>();
  for (let seed = 0; seed < 50; seed++) picks.add(chooseShot(R, [], seededRng(seed)));
  assert.ok(picks.size > 1);
});

test("never fires at a shot cell and treats misses as blocked", () => {
  const shots: Shot[] = [44, 45, 54, 55].map((cell) => ({ cell, result: "miss" }));
  const heat = heatmap(R, shots);
  for (const s of shots) assert.equal(heat[s.cell], -1);
  // Cells walled in by misses can no longer hold the 2-length ship in one of their directions.
  assert.ok(!shots.some((s) => s.cell === chooseShot(R, shots, seededRng(3))));
});

test("after a hit it fires next to the hit", () => {
  const shots: Shot[] = [{ cell: 44, result: "hit", ship: "cruiser" }];
  for (let seed = 0; seed < 10; seed++) assert.ok([34, 43, 45, 54].includes(chooseShot(R, shots, seededRng(seed))));
});

test("after two hits in a line it continues along that line", () => {
  const shots: Shot[] = [
    { cell: 44, result: "hit", ship: "carrier" },
    { cell: 45, result: "hit", ship: "carrier" },
  ];
  for (let seed = 0; seed < 10; seed++) assert.ok([41, 42, 43, 46, 47, 48].includes(chooseShot(R, shots, seededRng(seed))));
  assert.ok([43, 46].includes(chooseShot(R, shots, seededRng(1))), "adjacent ends score highest");
});

test("sunk ships are removed and their wreck blocks placements", () => {
  const shots: Shot[] = [
    { cell: 0, result: "hit", ship: "destroyer" },
    { cell: 1, result: "sunk", ship: "destroyer" },
  ];
  const heat = heatmap(R, shots);
  assert.equal(heat[0], -1);
  assert.equal(heat[1], -1);
  // Back to hunting: the destroyer no longer counts, so the best cells move to the centre.
  const max = Math.max(...heat);
  assert.ok([44, 45, 54, 55].every((c) => heat[c] === max));
});

test("a hit known to be another ship's is not used to place this ship", () => {
  const shots: Shot[] = [
    { cell: 0, result: "hit", ship: "destroyer" },
    { cell: 2, result: "hit", ship: "cruiser" },
  ];
  // The destroyer must cover cell 0 and cannot cover cell 2, so it sits at 0-1 or 0-10.
  const heat = heatmap(R, shots);
  assert.ok(heat[1] > 0 && heat[10] > 0);
});

test("beats random fleets well under 100 shots on average (hard difficulty)", () => {
  const games = 40;
  let total = 0;
  for (let seed = 1; seed <= games; seed++) total += shotsToWin(seed);
  const avg = total / games;
  assert.ok(avg < 60, `average shots to win was ${avg}`);
});
