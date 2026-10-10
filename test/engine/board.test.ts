import { test } from "node:test";
import assert from "node:assert/strict";
import { CLASSIC_RULES, cellLabel, randomFleet, seededRng, shipCells, validateFleet, type Placement, type RulesConfig } from "../../src/engine/index.ts";

const R = CLASSIC_RULES;
const at = (label: string) => (Number(label.slice(1)) - 1) * R.size + (label.charCodeAt(0) - 65);

// One ship per row, all horizontal, starting in column A.
const stacked = (): Placement[] => R.fleet.map((s, i) => ({ ship: s.id, cell: i * R.size, orientation: "h" }));

test("classic rules: 10x10, five ships, 4-length ship is the Dreadnought, touching allowed", () => {
  assert.equal(R.size, 10);
  assert.deepEqual(R.fleet.map((s) => s.length), [5, 4, 3, 3, 2]);
  assert.equal(R.fleet.find((s) => s.length === 4)!.name, "Dreadnought");
  assert.equal(R.shipsMayTouch, true);
});

test("cell labels run A-J by 1-10", () => {
  assert.equal(cellLabel(R, 0), "A1");
  assert.equal(cellLabel(R, 9), "J1");
  assert.equal(cellLabel(R, 99), "J10");
  assert.equal(at("C7"), 62);
});

test("shipCells covers horizontal and vertical runs and rejects runs off the board", () => {
  assert.deepEqual(shipCells(R, at("B2"), "h", 3), [at("B2"), at("C2"), at("D2")]);
  assert.deepEqual(shipCells(R, at("B2"), "v", 3), [at("B2"), at("B3"), at("B4")]);
  assert.equal(shipCells(R, at("H1"), "h", 4), null);
  assert.equal(shipCells(R, at("A8"), "v", 4), null);
  assert.equal(shipCells(R, 100, "h", 2), null);
  assert.equal(shipCells(R, -1, "h", 2), null);
});

test("a full, in-bounds, non-overlapping fleet is valid, and touching ships are allowed", () => {
  assert.deepEqual(validateFleet(R, stacked()), { ok: true });
});

test("fleet must contain each ship exactly once", () => {
  const fleet = stacked();
  assert.equal(validateFleet(R, fleet.slice(1)).ok, false);
  const dup = [...fleet.slice(0, 4), { ...fleet[0], cell: at("A9") }];
  assert.deepEqual(validateFleet(R, dup), { ok: false, error: "wrong_fleet" });
  const unknown = [...fleet.slice(0, 4), { ship: "rowboat", cell: at("A9"), orientation: "h" as const }];
  assert.deepEqual(validateFleet(R, unknown), { ok: false, error: "wrong_fleet" });
  const badOrientation = [...fleet.slice(0, 4), { ...fleet[4], orientation: "d" as "h" }];
  assert.deepEqual(validateFleet(R, badOrientation), { ok: false, error: "wrong_fleet" });
});

test("ships may not leave the board", () => {
  const fleet = stacked();
  fleet[0] = { ship: "carrier", cell: at("G1"), orientation: "h" };
  assert.deepEqual(validateFleet(R, fleet), { ok: false, error: "out_of_bounds", ship: "carrier" });
});

test("ships may not overlap", () => {
  const fleet = stacked();
  fleet[4] = { ship: "destroyer", cell: at("C1"), orientation: "v" };
  assert.deepEqual(validateFleet(R, fleet), { ok: false, error: "overlap", ship: "destroyer" });
});

test("a no-touching rule set rejects adjacent ships (engine stays open for other rules)", () => {
  const strict: RulesConfig = { ...R, shipsMayTouch: false };
  assert.equal(validateFleet(strict, stacked()).ok, false);
  const spaced = R.fleet.map((s, i) => ({ ship: s.id, cell: i * 2 * R.size, orientation: "h" as const }));
  assert.deepEqual(validateFleet(strict, spaced), { ok: true });
});

test("randomFleet always produces a valid fleet", () => {
  const rng = seededRng(7);
  for (let i = 0; i < 200; i++) assert.deepEqual(validateFleet(R, randomFleet(R, rng)), { ok: true });
});
